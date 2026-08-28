import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { isFirebaseReady } from '../config/firebase';
import { fcmService } from './fcm.service';
import { notifyLeaveChanged } from './leaveEvents';

const LEAVE_LABEL: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักร้อน',
  other: 'ลา',
};

/** 'YYYY-MM-DD' → '5 ก.ย.' — ใบลาส่วนใหญ่ยาว 1-2 วัน เลยไม่ต้องมีปีให้รก */
function thaiDay(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return String(iso ?? '');
  const month = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month}`;
}

export type PushStatus = { status: 'sent' | 'no_token' | 'failed' | 'no_fcm'; reason?: string };

/**
 * แจ้งผลอนุมัติกลับไปที่เครื่องพนักงาน
 *
 * ใช้ FCM แบบ `notification` (ไม่ใช่ data-only เหมือนการ์ดงาน) — แอนดรอยด์แสดงเองได้เลย
 * ตอนแอปอยู่เบื้องหลัง **จึงไม่ต้องแก้แอปมือถือ/แจก APK ใหม่** เพื่อให้แจ้งเตือนนี้ขึ้น
 *
 * ⛔ ห้ามให้การส่งแจ้งเตือนล้มแล้วทำให้ "อนุมัติไม่สำเร็จ" — ใบลาอนุมัติไปแล้วในฐานข้อมูล
 *    แต่ต้อง**คืนสถานะให้คนกดเห็น** ไม่ใช่ log เงียบ ๆ (ปัญหาเดียวกับตอนจ่ายงาน:
 *    ผู้สำรวจ active 144 คนมี fcm_token แค่ 84 — ที่เหลือไม่มีทางได้รับอะไรเลย)
 */
async function pushLeaveResult(row: {
  id: number; user_id: number; status: string; leave_type: string;
  start_date: string; end_date: string; review_note?: string | null;
}): Promise<PushStatus> {
  if (!isFirebaseReady()) {
    return { status: 'no_fcm', reason: 'ระบบแจ้งเตือนยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์' };
  }
  const { rows } = await db.query(
    'SELECT id, fcm_token FROM users WHERE id = $1',
    [row.user_id]
  );
  const token = rows[0]?.fcm_token;
  if (!token) {
    return { status: 'no_token', reason: 'เครื่องของพนักงานยังไม่เคยลงทะเบียนรับแจ้งเตือน' };
  }

  const kind = LEAVE_LABEL[row.leave_type] ?? 'ใบลา';
  const span = row.start_date === row.end_date
    ? thaiDay(row.start_date)
    : `${thaiDay(row.start_date)} – ${thaiDay(row.end_date)}`;
  const ok = row.status === 'approved';
  const title = ok ? `อนุมัติ${kind}แล้ว` : `${kind}ไม่ได้รับอนุมัติ`;
  const body = `${span}` + (row.review_note ? ` — ${row.review_note}` : '');

  try {
    await fcmService.sendNotification(token, title, body, {
      type: 'leave_reviewed',
      leave_id: String(row.id),
      status: String(row.status),
    });
    return { status: 'sent' };
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    // token ตายแล้ว (ถอนแอป/ล้างข้อมูล) → ล้างทิ้ง ไม่งั้นค้างหลอกว่ามี token
    if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
      await db.query('UPDATE users SET fcm_token = NULL WHERE id = $1', [row.user_id]).catch(() => {});
      return { status: 'no_token', reason: 'เครื่องของพนักงานถอนการลงทะเบียนแจ้งเตือนไปแล้ว' };
    }
    console.error('[FCM] แจ้งผลใบลาไม่สำเร็จ:', err);
    return { status: 'failed', reason: 'ส่งแจ้งเตือนไม่สำเร็จ' };
  }
}

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
    // กันช่วงวันซ้อนกับใบลาเดิมที่ยัง active (รอตรวจ/อนุมัติแล้ว) — เดิมยื่นซ้ำช่วงเดิมได้เรื่อย ๆ
    // ทำรายการเบิ้ลบนหน้าตรวจ + วันลาถูกนับซ้ำ; ใบที่ถูกปฏิเสธไม่ขวาง (ยื่นใหม่ช่วงเดิมได้)
    // SELECT+INSERT อยู่ใน transaction เดียว + advisory lock ต่อ user — กันสองคำขอพร้อมกัน
    // (retry หลัง timeout ที่คำขอแรกถึงจริง) ผ่าน SELECT ทั้งคู่แล้ว INSERT เบิ้ล
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('leave_' || $1::text))`, [userId]);
      const dup = await client.query(
        `SELECT to_char(start_date, 'DD/MM/YYYY') AS s, to_char(end_date, 'DD/MM/YYYY') AS e, status
           FROM leave_requests
          WHERE user_id = $1
            AND status IN ('pending', 'approved')
            AND start_date <= $3::date
            AND end_date   >= $2::date
          LIMIT 1`,
        [userId, data.start_date, data.end_date]
      );
      if (dup.rows.length > 0) {
        const d = dup.rows[0];
        const label = d.status === 'approved' ? 'อนุมัติแล้ว' : 'รอตรวจ';
        throw new AppError(400, `ช่วงวันลาซ้อนกับใบลาเดิม (${d.s} – ${d.e}, ${label}) — แก้ช่วงวันหรือติดต่อผู้ดูแลเพื่อยกเลิกใบเดิม`);
      }
      const { rows } = await client.query(
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
      await client.query('COMMIT');
      // บอกหน้าแอดมินว่ามีใบลาใหม่เข้ามา — หลัง COMMIT เท่านั้น ไม่งั้นอาจเตือนเรื่องที่ rollback ทิ้ง
      notifyLeaveChanged('created', userId);
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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

  // ใบลาที่ "อนุมัติแล้ว" และครอบคลุมวันที่ระบุ — สำหรับบอร์ดเข้างาน
  // เปิดเผยแค่ code + ประเภท + ช่วงวัน (ไม่รวมเหตุผล/ผู้อนุมัติ) → ให้ callcenter ใช้ได้โดยไม่เห็นข้อมูลอ่อนไหว
  async activeOn(date: string) {
    const { rows } = await db.query(
      `SELECT u.code, lr.leave_type,
              to_char(lr.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(lr.end_date,   'YYYY-MM-DD') AS end_date
         FROM leave_requests lr
         JOIN users u ON u.id = lr.user_id
        WHERE lr.status = 'approved'
          AND lr.start_date <= $1::date
          AND lr.end_date   >= $1::date`,
      [date]
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
    const row = rows[0];
    if (!row) return null;
    notifyLeaveChanged('reviewed', reviewerId);
    // ผลการส่งไหลกลับไปถึงคนกดอนุมัติ — ถ้าไปไม่ถึงเครื่องพนักงาน หัวหน้าจะได้โทรบอกเอง
    return { ...row, push: await pushLeaveResult(row) };
  },
};
