import { db } from '../config/database';

// เวลาท้องถิ่นไทย — "วันนี้" และเวลาเข้า/ออก อิงเขตเวลา Asia/Bangkok ไม่ขึ้นกับ TZ ของ server
const BKK = "(NOW() AT TIME ZONE 'Asia/Bangkok')";
const BKK_DATE = `${BKK}::date`;

// "รอบทิ้งร้าง" = เปิดค้าง (check_out_at IS NULL) นานเกิน STALE_OPEN_HOURS ชม. (เวลาไทย)
// กะยาวสุดจริง = FIX 14:00–23:00 = 9 ชม. (เวรดึก 23:00–07:00 = 8 ชม.) → 16 = 9 + เผื่อลืมเช็คเอาท์ ~7 ชม.
// และ < 24 ชม. จึงไม่มีทางไปแตะกะที่ยังทำงานจริง (โดยเฉพาะเวรดึกที่ข้ามคืนโดยชอบธรรม)
// ใช้ค่านี้ร่วมกันทั้ง auto-close (checkIn) และเกณฑ์ "รอบเปิดยังสด" (today) ให้ตรงกันเป๊ะ
export const STALE_OPEN_HOURS = 16;

// คืนเวลาเป็น string HH:MM (เวลาไทย) และวันที่ YYYY-MM-DD — แสดงผลได้ตรง ๆ ไม่ต้องแปลง timezone ฝั่ง client
const RET = `
  id, user_id,
  to_char(work_date,    'YYYY-MM-DD') AS work_date,
  to_char(check_in_at,  'HH24:MI')    AS check_in_time,
  to_char(check_out_at, 'HH24:MI')    AS check_out_time,
  check_in_lat, check_in_lng, check_out_lat, check_out_lng, check_in_photo`;

export const attendanceService = {
  // ลงเวลาเข้างาน — เปิด "รอบใหม่" (1 แถว) ได้ก็ต่อเมื่อไม่มีรอบที่ยังไม่ลงเวลาออกค้างอยู่
  // INSERT ... WHERE NOT EXISTS: ถ้ามีรอบเปิดค้าง จะ insert 0 แถว → คืน null ให้ controller แจ้งเตือน
  async checkIn(userId: number, lat: number | null, lng: number | null, photo: string | null) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      // 1) ปิด "รอบทิ้งร้าง" ก่อน: ตั้ง check_out_at = เวลาเข้างานเดิม (duration 0 ไม่ให้นับชั่วโมงเกินจริง) ไม่มี GPS ออก
      //    เทียบเวลาไทยทั้งสองฝั่ง (check_in_at เก็บเป็น naive เวลาไทย) — ห้ามใช้ NOW() ดิบ (UTC คลาด +7 ชม. = บั๊กของ _close_old_rounds.js)
      await client.query(
        `UPDATE attendance_records
            SET check_out_at = check_in_at
          WHERE user_id = $1
            AND check_out_at IS NULL
            AND check_in_at < ${BKK} - INTERVAL '${STALE_OPEN_HOURS} hours'`,
        [userId]
      );
      // 2) เปิดรอบใหม่ได้เมื่อไม่เหลือรอบเปิดค้าง (รอบที่ยัง < STALE_OPEN_HOURS ชม. = ทำงานจริง/เวรดึก → ยังบล็อกถูกต้อง)
      const { rows } = await client.query(
        `INSERT INTO attendance_records (user_id, work_date, check_in_at, check_in_lat, check_in_lng, check_in_photo)
         SELECT $1, ${BKK_DATE}, ${BKK}, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM attendance_records WHERE user_id = $1 AND check_out_at IS NULL
         )
         RETURNING ${RET}`,
        [userId, lat, lng, photo]
      );
      await client.query('COMMIT');
      return rows[0] ?? null;
    } catch (err) {
      await client.query('ROLLBACK');
      // แข่งกดเข้างานพร้อมกัน 2 อุปกรณ์: ตัวที่แพ้ชน partial unique index (user_id, work_date) WHERE check_out_at IS NULL → 23505
      //   → คืน null ให้ controller แจ้งเตือน 400 เป็นมิตร (ไม่ปล่อยให้หลุดเป็น 500)
      if ((err as { code?: string })?.code === '23505') return null;
      throw err;
    } finally {
      client.release();
    }
  },

  // ลงเวลาออกงาน — ปิดรอบที่ยังเปิดค้างอยู่ล่าสุดของพนักงาน (ถ้าไม่มี → คืน null)
  async checkOut(userId: number, lat: number | null, lng: number | null) {
    const { rows } = await db.query(
      `UPDATE attendance_records
          SET check_out_at  = ${BKK},
              check_out_lat = $2,
              check_out_lng = $3
        WHERE id = (
          SELECT id FROM attendance_records
            WHERE user_id = $1 AND check_out_at IS NULL
            ORDER BY check_in_at DESC
            LIMIT 1
        )
        RETURNING ${RET}`,
      [userId, lat, lng]
    );
    return rows[0] ?? null;
  },

  // สถานะวันนี้ — รายการรอบของวันนี้ (เรียงตามเวลาเข้า) + รอบที่เปิดค้าง (ถ้ามี) ไว้กำหนดปุ่มเข้า/ออก
  async today(userId: number) {
    const { rows: sessions } = await db.query(
      `SELECT ${RET} FROM attendance_records
        WHERE user_id = $1 AND work_date = ${BKK_DATE}
        ORDER BY check_in_at ASC`,
      [userId]
    );
    // เฉพาะรอบเปิดที่ยัง "สด" (< STALE_OPEN_HOURS ชม.) จึงนับว่า open →
    // รอบทิ้งร้างจะไม่ขึ้นเป็น open ทำให้ปุ่มมือถือกลับเป็น "ลงเวลาเข้า" (กดแล้วไป checkIn ซึ่ง auto-close ให้เอง)
    const { rows: open } = await db.query(
      `SELECT ${RET} FROM attendance_records
        WHERE user_id = $1 AND check_out_at IS NULL
          AND check_in_at >= ${BKK} - INTERVAL '${STALE_OPEN_HOURS} hours'
        ORDER BY check_in_at DESC LIMIT 1`,
      [userId]
    );
    return { sessions, open: open[0] ?? null };
  },

  // ประวัติของฉัน (รอบล่าสุดก่อน)
  async listMine(userId: number, limit = 50) {
    const lim = Math.min(Math.max(limit, 1), 200);
    const { rows } = await db.query(
      `SELECT ${RET} FROM attendance_records
        WHERE user_id = $1
        ORDER BY check_in_at DESC LIMIT $2`,
      [userId, lim]
    );
    return rows;
  },

  // รายงานสำหรับ admin/callcenter — หลายรอบต่อวันได้ เรียงตามวัน/ชื่อ/เวลาเข้า
  async report(q: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    const from = String(q.from || '');
    const to = String(q.to || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push(`ar.work_date >= $${p++}`);
      params.push(from);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push(`ar.work_date <= $${p++}`);
      params.push(to);
    }
    if (q.user_id && Number.isFinite(Number(q.user_id))) {
      where.push(`ar.user_id = $${p++}`);
      params.push(Number(q.user_id));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // เดิม 500 — วันยุ่ง (พนักงาน 80+ คน หลายรอบ/วัน + ช่วง 2 วันของบอร์ด) อาจเกิน 500
    // แล้วคนท้าย ๆ ถูกตัดทิ้งเงียบ ๆ → ขึ้นว่า "ยังไม่มา" ทั้งที่เช็คอินแล้ว. query ถูก bound ด้วยช่วงวันอยู่แล้ว
    const MAX_ROWS = 5000;
    const { rows } = await db.query(
      `SELECT ar.id, ar.user_id,
              to_char(ar.work_date,    'YYYY-MM-DD') AS work_date,
              to_char(ar.check_in_at,  'HH24:MI')    AS check_in_time,
              to_char(ar.check_out_at, 'HH24:MI')    AS check_out_time,
              ar.check_in_lat, ar.check_in_lng, ar.check_out_lat, ar.check_out_lng, ar.check_in_photo,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS user_name, u.username, u.code
         FROM attendance_records ar
         JOIN users u ON u.id = ar.user_id
         ${whereSql}
        ORDER BY ar.work_date DESC, user_name ASC, ar.check_in_at ASC
        LIMIT ${MAX_ROWS}`,
      params
    );
    return { count: rows.length, capped: rows.length >= MAX_ROWS, rows };
  },

  // เวลาปัจจุบันฝั่ง server (เวลาไทย) — ให้บอร์ดยึดเวลานี้แทนนาฬิกาเครื่อง client (กันเบราว์เซอร์ TZ อื่นคำนวณ "วันนี้"/อาสาเพี้ยน)
  // today = วันที่ไทย, nowMinutes = นาทีจากเที่ยงคืน(ไทย), epochMs = เวลา UTC absolute ไว้คำนวณ offset ฝั่ง client
  async now() {
    const { rows } = await db.query(
      `SELECT to_char(${BKK_DATE}, 'YYYY-MM-DD') AS today,
              (EXTRACT(HOUR FROM ${BKK}) * 60 + EXTRACT(MINUTE FROM ${BKK}))::int AS now_minutes,
              (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint AS epoch_ms`
    );
    return { today: rows[0].today, nowMinutes: rows[0].now_minutes, epochMs: Number(rows[0].epoch_ms) };
  },
};
