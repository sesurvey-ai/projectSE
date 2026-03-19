import { db } from '../config/database';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';

export const reviewService = {
  async submitReview(caseId: number, checkerId: number, data: { comment?: string; proposed_fee?: number; approved_fee?: number }) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');
    if (caseResult.rows[0].status !== 'surveyed') throw new ForbiddenError('Case is not ready for review');

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const reviewResult = await client.query(
        `INSERT INTO reviews (case_id, checker_id, comment, proposed_fee, approved_fee, status, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, 'approved', NOW()) RETURNING *`,
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
};
