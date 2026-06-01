import { db } from '../config/database';

// เวลาท้องถิ่นไทย — "วันนี้" และเวลาเข้า/ออก อิงเขตเวลา Asia/Bangkok ไม่ขึ้นกับ TZ ของ server
const BKK = "(NOW() AT TIME ZONE 'Asia/Bangkok')";
const BKK_DATE = `${BKK}::date`;

// คืนเวลาเป็น string HH:MM (เวลาไทย) และวันที่ YYYY-MM-DD — แสดงผลได้ตรง ๆ ไม่ต้องแปลง timezone ฝั่ง client
const RET = `
  id, user_id,
  to_char(work_date,    'YYYY-MM-DD') AS work_date,
  to_char(check_in_at,  'HH24:MI')    AS check_in_time,
  to_char(check_out_at, 'HH24:MI')    AS check_out_time,
  check_in_lat, check_in_lng, check_out_lat, check_out_lng, check_in_photo`;

export const attendanceService = {
  // ลงเวลาเข้างาน — 1 แถว/วัน; ถ้าเข้าไปแล้วจะไม่ทับเวลา/รูปเดิม (COALESCE เก็บครั้งแรก)
  async checkIn(userId: number, lat: number | null, lng: number | null, photo: string | null) {
    const { rows } = await db.query(
      `INSERT INTO attendance_records (user_id, work_date, check_in_at, check_in_lat, check_in_lng, check_in_photo)
       VALUES ($1, ${BKK_DATE}, ${BKK}, $2, $3, $4)
       ON CONFLICT (user_id, work_date) DO UPDATE
         SET check_in_at    = COALESCE(attendance_records.check_in_at,    EXCLUDED.check_in_at),
             check_in_lat   = COALESCE(attendance_records.check_in_lat,   EXCLUDED.check_in_lat),
             check_in_lng   = COALESCE(attendance_records.check_in_lng,   EXCLUDED.check_in_lng),
             check_in_photo = COALESCE(attendance_records.check_in_photo, EXCLUDED.check_in_photo)
       RETURNING ${RET}`,
      [userId, lat, lng, photo]
    );
    return rows[0];
  },

  // ลงเวลาออกงาน — ต้องมีแถวของวันนี้ (เข้างานแล้ว) ก่อน
  async checkOut(userId: number, lat: number | null, lng: number | null) {
    const { rows } = await db.query(
      `UPDATE attendance_records
          SET check_out_at  = ${BKK},
              check_out_lat = $2,
              check_out_lng = $3
        WHERE user_id = $1 AND work_date = ${BKK_DATE}
        RETURNING ${RET}`,
      [userId, lat, lng]
    );
    return rows[0] ?? null;
  },

  // สถานะวันนี้
  async today(userId: number) {
    const { rows } = await db.query(
      `SELECT ${RET} FROM attendance_records WHERE user_id = $1 AND work_date = ${BKK_DATE}`,
      [userId]
    );
    return rows[0] ?? null;
  },

  // ประวัติของฉัน (ล่าสุดก่อน)
  async listMine(userId: number, limit = 30) {
    const lim = Math.min(Math.max(limit, 1), 100);
    const { rows } = await db.query(
      `SELECT ${RET} FROM attendance_records WHERE user_id = $1 ORDER BY work_date DESC LIMIT $2`,
      [userId, lim]
    );
    return rows;
  },

  // รายงานสำหรับ admin/callcenter
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
    const { rows } = await db.query(
      `SELECT ar.id, ar.user_id,
              to_char(ar.work_date,    'YYYY-MM-DD') AS work_date,
              to_char(ar.check_in_at,  'HH24:MI')    AS check_in_time,
              to_char(ar.check_out_at, 'HH24:MI')    AS check_out_time,
              ar.check_in_lat, ar.check_in_lng, ar.check_out_lat, ar.check_out_lng, ar.check_in_photo,
              (u.first_name || ' ' || u.last_name) AS user_name, u.username
         FROM attendance_records ar
         JOIN users u ON u.id = ar.user_id
         ${whereSql}
        ORDER BY ar.work_date DESC, user_name ASC
        LIMIT 500`,
      params
    );
    return { count: rows.length, rows };
  },
};
