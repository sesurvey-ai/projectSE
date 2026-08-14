/**
 * ประตูอนุมัติ — จุดเดียวที่ตัดสินว่าเคสไหน "พร้อมให้บอทยกเข้า EMCS"
 *
 * กติกาที่ user เคาะ 15/08/69:
 *   หัวหน้าตรวจจบบนเว็บ → กดอนุมัติ → **ล็อกทั้งเคส** → บอทหยิบเฉพาะที่อนุมัติ
 *   จะแก้ต้องให้ **แอดมิน** ปลดล็อก แล้ว **อนุมัติใหม่** (ไม่ใช่แก้เงียบ ๆ แล้วบอทหยิบของใหม่ไป)
 *
 * ⛔ ทำไมต้องล็อก: หลังเฟส 3 บอทจะกดปุ่ม "ส่งงานใหม่" บน EMCS เอง ซึ่งถอยไม่ได้
 *    "อนุมัติ" จึงไม่ใช่ป้ายสถานะ แต่เป็นลายเซ็นว่าคนคนหนึ่งรับรองข้อมูลชุดนี้แล้ว
 *    ถ้าข้อมูลเปลี่ยนได้หลังอนุมัติ ลายเซ็นนั้นก็ไม่ได้รับรองอะไรเลย
 *
 * reviews มี 1 แถวต่อ 1 เคส (case_id UNIQUE) — อนุมัติ/ปลดล็อกคือการเปลี่ยนสถานะแถวเดิม
 * ไม่ใช่สร้างแถวใหม่ (INSERT ซ้ำจะชน UNIQUE)
 */
import { db } from '../config/database';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';

export const reviewService = {
  async submitReview(caseId: number, checkerId: number, data: { comment?: string; proposed_fee?: number; approved_fee?: number }) {
    const caseResult = await db.query('SELECT status FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');
    const status = caseResult.rows[0].status;
    if (status === 'reviewed') throw new ForbiddenError('เคสนี้อนุมัติแล้ว — ต้องให้แอดมินปลดล็อกก่อนจึงจะแก้/อนุมัติใหม่ได้');
    if (status !== 'surveyed') throw new ForbiddenError('Case is not ready for review');

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // อนุมัติซ้ำหลังปลดล็อก = ทับใบเดิม (คนอนุมัติ/เวลา เป็นของครั้งล่าสุดเสมอ)
      // unlocked_count ไม่รีเซ็ต — เก็บไว้ว่าเคสนี้ผ่านการปลดล็อกมากี่รอบ
      const reviewResult = await client.query(
        `INSERT INTO reviews (case_id, checker_id, comment, proposed_fee, approved_fee, status, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, 'approved', NOW())
         ON CONFLICT (case_id) DO UPDATE
            SET checker_id = EXCLUDED.checker_id,
                comment = EXCLUDED.comment,
                proposed_fee = EXCLUDED.proposed_fee,
                approved_fee = EXCLUDED.approved_fee,
                status = 'approved',
                reviewed_at = NOW()
         RETURNING *`,
        [caseId, checkerId, data.comment || null, data.proposed_fee || null, data.approved_fee || null]
      );

      await client.query(`UPDATE cases SET status = 'reviewed' WHERE id = $1`, [caseId]);

      await client.query('COMMIT');
      return reviewResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * ปลดล็อกเคสที่อนุมัติแล้วให้กลับไปแก้ได้ (แอดมินเท่านั้น — บังคับที่ชั้น route)
   *
   * ⛔ ปลดล็อกเคสที่เข้า EMCS ไปแล้วไม่ได้ — draft บน EMCS ลบไม่ได้ ปลดแล้วแก้ที่นี่
   *    ข้อมูล 2 ที่จะไม่ตรงกันโดยไม่มีใครรู้ ต้องไปแก้ที่ EMCS ตรง ๆ
   */
  async unlock(caseId: number, adminId: number, reason?: string) {
    const c = await db.query('SELECT status, emcs_imported_at FROM cases WHERE id = $1', [caseId]);
    if (c.rows.length === 0) throw new NotFoundError('Case not found');
    if (c.rows[0].status !== 'reviewed') throw new ForbiddenError('เคสนี้ยังไม่ได้อนุมัติ ไม่ต้องปลดล็อก');
    if (c.rows[0].emcs_imported_at) {
      throw new ForbiddenError('เคสนี้เข้า EMCS ไปแล้ว ปลดล็อกไม่ได้ — แก้ที่ EMCS โดยตรง');
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE reviews
            SET status = 'pending',
                unlocked_by = $2,
                unlocked_at = NOW(),
                unlocked_count = unlocked_count + 1,
                comment = COALESCE(NULLIF($3, ''), comment)
          WHERE case_id = $1
          RETURNING *`,
        [caseId, adminId, reason ?? '']
      );
      // ไม่มีใบอนุมัติแต่สถานะเป็น reviewed = ข้อมูลเพี้ยน ปล่อยผ่านไม่ได้
      if (r.rowCount === 0) throw new NotFoundError('ไม่พบใบอนุมัติของเคสนี้');
      await client.query(`UPDATE cases SET status = 'surveyed' WHERE id = $1`, [caseId]);
      await client.query('COMMIT');
      return r.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
