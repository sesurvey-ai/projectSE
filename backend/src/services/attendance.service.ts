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
  // ลงเวลาเข้างาน — เปิด "รอบใหม่" (1 แถว) ได้ก็ต่อเมื่อไม่มีรอบที่ยังไม่ลงเวลาออกค้างอยู่
  // INSERT ... WHERE NOT EXISTS: ถ้ามีรอบเปิดค้าง จะ insert 0 แถว → คืน null ให้ controller แจ้งเตือน
  async checkIn(userId: number, lat: number | null, lng: number | null, photo: string | null) {
    const { rows } = await db.query(
      `INSERT INTO attendance_records (user_id, work_date, check_in_at, check_in_lat, check_in_lng, check_in_photo)
       SELECT $1, ${BKK_DATE}, ${BKK}, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM attendance_records WHERE user_id = $1 AND check_out_at IS NULL
       )
       RETURNING ${RET}`,
      [userId, lat, lng, photo]
    );
    return rows[0] ?? null;
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
    const { rows: open } = await db.query(
      `SELECT ${RET} FROM attendance_records
        WHERE user_id = $1 AND check_out_at IS NULL
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
    const { rows } = await db.query(
      `SELECT ar.id, ar.user_id,
              to_char(ar.work_date,    'YYYY-MM-DD') AS work_date,
              to_char(ar.check_in_at,  'HH24:MI')    AS check_in_time,
              to_char(ar.check_out_at, 'HH24:MI')    AS check_out_time,
              ar.check_in_lat, ar.check_in_lng, ar.check_out_lat, ar.check_out_lng, ar.check_in_photo,
              (u.first_name || ' ' || u.last_name) AS user_name, u.username, u.code
         FROM attendance_records ar
         JOIN users u ON u.id = ar.user_id
         ${whereSql}
        ORDER BY ar.work_date DESC, user_name ASC, ar.check_in_at ASC
        LIMIT 500`,
      params
    );
    return { count: rows.length, rows };
  },
};
