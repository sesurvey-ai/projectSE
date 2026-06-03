import { db } from '../config/database';

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
};
