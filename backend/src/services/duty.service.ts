import { db } from '../config/database';

// เดือนตั้งต้นของการหมุนเวร (rotate_offset อ้างอิงเดือนนี้): มิ.ย. 2569 = 2026-06
const ANCHOR_YM = 2026 * 12 + 6;
const ROTATE_CYCLE = ['shift1', 'shift2', 'shift3'];
const SHIFT_LABEL: Record<string, string> = {
  shift1: 'เวร 1', shift2: 'เวร 2', shift3: 'เวร 3', fix1: 'Fix 1', fix2: 'Fix 2',
};

export type SlotInput = {
  station_id: number;
  kind: 'rotate' | 'fix';
  rotate_offset?: number | null;
  fixed_shift?: string | null;
  user_id?: number | null;
  weekly_off?: number | null;
  note?: string | null;
};

export const dutyService = {
  listStations: async () =>
    (await db.query(
      'SELECT id, name, region, sort_order, active FROM stations ORDER BY region, sort_order'
    )).rows,

  listShifts: async () =>
    (await db.query(
      `SELECT key, label, to_char(start_time,'HH24:MI') AS start_time,
              to_char(end_time,'HH24:MI') AS end_time, is_fix, sort_order
       FROM shifts ORDER BY sort_order`
    )).rows,

  // รายชื่อ surveyor ที่ active — ใช้เลือกใส่สล๊อต
  listSurveyors: async () =>
    (await db.query(
      `SELECT id, username, first_name, last_name, phone
       FROM users WHERE role = 'surveyor' AND is_active = true
       ORDER BY first_name NULLS LAST, last_name NULLS LAST, username`
    )).rows,

  // สล๊อตทั้งหมด + จุด + คนที่อยู่สล๊อต
  listSlots: async () =>
    (await db.query(
      `SELECT s.id, s.station_id, st.name AS station_name, st.region,
              s.kind, s.rotate_offset, s.fixed_shift,
              s.user_id, u.first_name, u.last_name, u.username, u.phone,
              s.weekly_off, s.note, s.active
         FROM duty_slots s
         JOIN stations st ON st.id = s.station_id
         LEFT JOIN users u ON u.id = s.user_id
        ORDER BY st.region, st.sort_order, s.kind DESC, s.rotate_offset, s.fixed_shift`
    )).rows,

  createSlot: async (d: SlotInput) =>
    (await db.query(
      `INSERT INTO duty_slots (station_id, kind, rotate_offset, fixed_shift, user_id, weekly_off, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.station_id, d.kind, d.rotate_offset ?? null, d.fixed_shift ?? null,
       d.user_id ?? null, d.weekly_off ?? null, d.note ?? null]
    )).rows[0],

  updateSlot: async (id: number, d: SlotInput) =>
    (await db.query(
      `UPDATE duty_slots
          SET station_id = $1, kind = $2, rotate_offset = $3, fixed_shift = $4,
              user_id = $5, weekly_off = $6, note = $7, updated_at = NOW()
        WHERE id = $8 RETURNING *`,
      [d.station_id, d.kind, d.rotate_offset ?? null, d.fixed_shift ?? null,
       d.user_id ?? null, d.weekly_off ?? null, d.note ?? null, id]
    )).rows[0] ?? null,

  deleteSlot: async (id: number) => {
    await db.query('DELETE FROM duty_slots WHERE id = $1', [id]);
  },

  // ── ตารางเวร "live" ของวันหนึ่ง ──────────────────────────
  // คำนวณเวรของแต่ละสล๊อตจากเดือน (เวร1-3 หมุนจาก anchor, Fix คงที่)
  // + สถานะจาก attendance (เข้างานแล้ว/เวลา) / leave (ลา) / weekly_off (วันหยุด)
  roster: async (date?: string) => {
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : (await db.query("SELECT to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS d")).rows[0].d;
    const [y, mo, day] = d.split('-').map(Number);
    const monthsSince = (y * 12 + mo) - ANCHOR_YM;
    const dow = new Date(Date.UTC(y, mo - 1, day)).getUTCDay(); // 0=อา..6=ส

    const slots = (await db.query(
      `SELECT s.kind, s.rotate_offset, s.fixed_shift, s.weekly_off, s.note,
              st.name AS station, st.region,
              s.user_id, u.username, u.first_name, u.last_name, u.phone
         FROM duty_slots s
         JOIN stations st ON st.id = s.station_id
         LEFT JOIN users u ON u.id = s.user_id
        WHERE s.active`
    )).rows;

    const att = (await db.query(
      `SELECT user_id, to_char(MIN(check_in_at), 'HH24:MI') AS check_in
         FROM attendance_records
        WHERE work_date = $1 AND check_in_at IS NOT NULL
        GROUP BY user_id`, [d]
    )).rows;
    const checkInBy = new Map<number, string>(att.map((r: any) => [r.user_id, r.check_in]));

    const lv = (await db.query(
      `SELECT DISTINCT user_id FROM leave_requests
        WHERE status = 'approved' AND start_date <= $1 AND end_date >= $1`, [d]
    )).rows;
    const onLeave = new Set<number>(lv.map((r: any) => r.user_id));

    const people = slots
      .filter((s: any) => s.user_id)
      .map((s: any) => {
        const shift = s.kind === 'fix'
          ? s.fixed_shift
          : ROTATE_CYCLE[(((s.rotate_offset + monthsSince) % 3) + 3) % 3];
        let status: 'present' | 'pending' | 'leave' | 'off';
        let check_in: string | null = null;
        if (onLeave.has(s.user_id)) status = 'leave';
        else if (s.weekly_off != null && s.weekly_off === dow) status = 'off';
        else if (checkInBy.has(s.user_id)) { status = 'present'; check_in = checkInBy.get(s.user_id)!; }
        else status = 'pending';
        return {
          user_id: s.user_id,
          code: s.username,
          name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.username,
          phone: s.phone || '',
          station: s.station,
          region: s.region,
          shift,
          shift_label: SHIFT_LABEL[shift] || shift,
          status,
          check_in,
          tags: s.kind === 'fix' ? [SHIFT_LABEL[s.fixed_shift] || 'FIX'] : [],
          note: s.note || null,
        };
      });

    // อาสา (volunteer) ของวันนั้น → เพิ่ม entry ที่จุดตัวเอง (tag อาสา + ช่วงเวลา)
    const userShift = new Map<number, string>(people.map((p) => [p.user_id, p.shift] as [number, string]));
    const vols = (await db.query(
      `SELECT v.user_id, to_char(v.start_time,'HH24:MI') AS s, to_char(v.end_time,'HH24:MI') AS e, v.note,
              u.username, u.first_name, u.last_name, u.phone, st.name AS station, st.region
         FROM volunteers v
         JOIN users u ON u.id = v.user_id
         JOIN stations st ON st.id = v.station_id
        WHERE v.work_date = $1`, [d]
    )).rows as any[];
    for (const v of vols) {
      const shift = userShift.get(v.user_id) || 'fix1';
      people.push({
        user_id: v.user_id,
        code: v.username,
        name: [v.first_name, v.last_name].filter(Boolean).join(' ') || v.username,
        phone: v.phone || '',
        station: v.station,
        region: v.region,
        shift,
        shift_label: SHIFT_LABEL[shift] || shift,
        status: 'present',
        check_in: `${v.s}–${v.e}`,
        tags: ['อาสา'],
        note: v.note || null,
      });
    }

    return { date: d, anchor: 'มิ.ย. 2569', people };
  },

  // ── อาสา (volunteer) ──────────────────────────────────────
  // จุด = จุดประจำของตัวเอง (จาก duty_slots); วันที่ = วันนี้ (เวลาไทย) ถ้าไม่ระบุ
  submitVolunteer: async (userId: number, start: string, end: string, date?: string) => {
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : (await db.query("SELECT to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS d")).rows[0].d;
    const slot = (await db.query('SELECT station_id FROM duty_slots WHERE user_id = $1 AND active ORDER BY id LIMIT 1', [userId])).rows[0];
    const row = (await db.query(
      `INSERT INTO volunteers (user_id, work_date, start_time, end_time, station_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, to_char(work_date,'YYYY-MM-DD') AS work_date,
                 to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time`,
      [userId, d, start, end, slot ? slot.station_id : null]
    )).rows[0];
    return row;
  },

  myVolunteers: async (userId: number, date?: string) => {
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : (await db.query("SELECT to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS d")).rows[0].d;
    return (await db.query(
      `SELECT id, to_char(work_date,'YYYY-MM-DD') AS work_date,
              to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
         FROM volunteers WHERE user_id = $1 AND work_date = $2 ORDER BY start_time`,
      [userId, d]
    )).rows;
  },

  cancelVolunteer: async (userId: number, id: number) => {
    const r = await db.query('DELETE FROM volunteers WHERE id = $1 AND user_id = $2', [id, userId]);
    return (r.rowCount ?? 0) > 0;
  },
};
