import { db } from '../config/database';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { fcmService } from './fcm.service';

export const caseService = {
  async create(data: { customer_name: string; incident_location: string; incident_lat?: number; incident_lng?: number }, createdBy: number) {
    const result = await db.query(
      `INSERT INTO cases (customer_name, incident_location, incident_lat, incident_lng, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.customer_name, data.incident_location, data.incident_lat || null, data.incident_lng || null, createdBy]
    );
    return result.rows[0];
  },

  async getMyCases(surveyorId: number) {
    const result = await db.query(
      `SELECT * FROM cases WHERE assigned_to = $1 ORDER BY created_at DESC`,
      [surveyorId]
    );
    return result.rows;
  },

  async assign(caseId: number, surveyorId: number) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const caseData = caseResult.rows[0];
    if (caseData.status !== 'pending') {
      throw new ForbiddenError('Case is already assigned');
    }

    const surveyorResult = await db.query(
      "SELECT id, fcm_token, first_name, last_name FROM users WHERE id = $1 AND role = 'surveyor' AND is_active = true",
      [surveyorId]
    );
    if (surveyorResult.rows.length === 0) throw new NotFoundError('Surveyor not found');

    const updated = await db.query(
      `UPDATE cases SET assigned_to = $1, status = 'assigned' WHERE id = $2 RETURNING *`,
      [surveyorId, caseId]
    );

    // Send push notification
    const surveyor = surveyorResult.rows[0];
    if (surveyor.fcm_token) {
      await fcmService.sendNotification(
        surveyor.fcm_token,
        'งานใหม่',
        `คุณได้รับมอบหมายงานสำรวจ: ${caseData.customer_name}`,
        { case_id: String(caseId) }
      ).catch(err => console.error('FCM send failed:', err));
    }

    return updated.rows[0];
  },

  async submitSurvey(caseId: number, surveyorId: number, data: { car_model?: string; car_color?: string; license_plate?: string; notes?: string; photo_paths: string[] }) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const caseData = caseResult.rows[0];
    if (caseData.status !== 'assigned') throw new ForbiddenError('Case is not in assigned status');
    if (caseData.assigned_to !== surveyorId) throw new ForbiddenError('Case is not assigned to you');

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const reportResult = await client.query(
        `INSERT INTO survey_reports (case_id, car_model, car_color, license_plate, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [caseId, data.car_model || null, data.car_color || null, data.license_plate || null, data.notes || null]
      );
      const report = reportResult.rows[0];

      for (const filePath of data.photo_paths) {
        await client.query(
          'INSERT INTO survey_photos (report_id, file_path) VALUES ($1, $2)',
          [report.id, filePath]
        );
      }

      await client.query(
        `UPDATE cases SET status = 'surveyed' WHERE id = $1`,
        [caseId]
      );

      await client.query('COMMIT');
      return report;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getById(caseId: number) {
    const result = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (result.rows.length === 0) throw new NotFoundError('Case not found');
    return result.rows[0];
  },

  async getForReview() {
    const result = await db.query(
      `SELECT c.*, u.first_name AS surveyor_first_name, u.last_name AS surveyor_last_name
       FROM cases c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.status IN ('surveyed', 'reviewed')
       ORDER BY c.created_at DESC`
    );
    return result.rows;
  },

  async getDetail(caseId: number) {
    const caseResult = await db.query(
      `SELECT c.*, u.first_name AS surveyor_first_name, u.last_name AS surveyor_last_name
       FROM cases c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = $1`,
      [caseId]
    );
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const reportResult = await db.query(
      'SELECT * FROM survey_reports WHERE case_id = $1',
      [caseId]
    );

    let photos: unknown[] = [];
    if (reportResult.rows.length > 0) {
      const photoResult = await db.query(
        'SELECT * FROM survey_photos WHERE report_id = $1',
        [reportResult.rows[0].id]
      );
      photos = photoResult.rows;
    }

    const reviewResult = await db.query(
      'SELECT * FROM reviews WHERE case_id = $1',
      [caseId]
    );

    return {
      case: caseResult.rows[0],
      report: reportResult.rows[0] || null,
      photos,
      review: reviewResult.rows[0] || null,
    };
  },
};
