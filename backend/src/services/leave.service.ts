import { db } from '../config/database';

interface CreateLeaveInput {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

// คืนค่าเป็น string ที่แสดงผลได้ตรง ๆ (กันปัญหา timezone ฝั่ง client)
// วันที่ = YYYY-MM-DD; timestamp เก็บเป็นเวลาไทย (Asia/Bangkok) ตรง ๆ เหมือน attendance → อ่านตรง ๆ ไม่ต้องแปลง
const COLS = `
  lr.id, lr.user_id, lr.leave_type,
  to_char(lr.start_date, 'YYYY-MM-DD')          AS start_date,
  to_char(lr.end_date,   'YYYY-MM-DD')          AS end_date,
  lr.reason, lr.status, lr.reviewed_by, lr.review_note,
  to_char(lr.reviewed_at, 'YYYY-MM-DD HH24:MI') AS reviewed_at,
  to_char(lr.created_at,  'YYYY-MM-DD HH24:MI') AS created_at`;

export const leaveService = {
  // พนักงานยื่นใบลา
  async create(userId: number, data: CreateLeaveInput) {
    const { rows } = await db.query(
      `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Asia/Bangkok')
       RETURNING
         id, user_id, leave_type,
         to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date,   'YYYY-MM-DD') AS end_date,
         reason, status, reviewed_by, review_note,
         to_char(reviewed_at, 'YYYY-MM-DD HH24:MI') AS reviewed_at,
         to_char(created_at,  'YYYY-MM-DD HH24:MI') AS created_at`,
      [userId, data.leave_type, data.start_date, data.end_date, data.reason ?? null]
    );
    return rows[0];
  },

  // ใบลาของฉัน (ทุกสถานะ)
  async listMine(userId: number) {
    const { rows } = await db.query(
      `SELECT ${COLS}, (rv.first_name || ' ' || rv.last_name) AS reviewer_name
         FROM leave_requests lr
         LEFT JOIN users rv ON rv.id = lr.reviewed_by
        WHERE lr.user_id = $1
        ORDER BY lr.created_at DESC`,
      [userId]
    );
    return rows;
  },

  // รายการใบลาทั้งหมด (admin/callcenter) — กรองด้วย status / user_id ได้, รอตรวจขึ้นก่อน
  async listAll(q: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    const status = String(q.status || '');
    if (['pending', 'approved', 'rejected'].includes(status)) {
      where.push(`lr.status = $${p++}`);
      params.push(status);
    }
    if (q.user_id && Number.isFinite(Number(q.user_id))) {
      where.push(`lr.user_id = $${p++}`);
      params.push(Number(q.user_id));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT ${COLS},
              (u.first_name || ' ' || u.last_name)   AS user_name,
              u.username,
              (rv.first_name || ' ' || rv.last_name) AS reviewer_name
         FROM leave_requests lr
         JOIN users u  ON u.id  = lr.user_id
         LEFT JOIN users rv ON rv.id = lr.reviewed_by
         ${whereSql}
        ORDER BY (lr.status = 'pending') DESC, lr.created_at DESC`,
      params
    );
    return rows;
  },

  // อนุมัติ/ไม่อนุมัติ
  async review(id: number, reviewerId: number, status: string, note?: string | null) {
    const { rows } = await db.query(
      `UPDATE leave_requests
          SET status = $1, reviewed_by = $2, reviewed_at = NOW() AT TIME ZONE 'Asia/Bangkok', review_note = $3
        WHERE id = $4
        RETURNING
          id, user_id, leave_type,
          to_char(start_date, 'YYYY-MM-DD') AS start_date,
          to_char(end_date,   'YYYY-MM-DD') AS end_date,
          reason, status, reviewed_by, review_note,
          to_char(reviewed_at, 'YYYY-MM-DD HH24:MI') AS reviewed_at,
          to_char(created_at,  'YYYY-MM-DD HH24:MI') AS created_at`,
      [status, reviewerId, note ?? null, id]
    );
    return rows[0] ?? null;
  },
};
