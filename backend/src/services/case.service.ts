import { db } from '../config/database';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { fcmService } from './fcm.service';
import { getIO } from '../socket';

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

    // Send push notification via FCM
    const surveyor = surveyorResult.rows[0];
    console.log(`[FCM] Surveyor ${surveyor.id} fcm_token: ${surveyor.fcm_token ? 'EXISTS' : 'NULL'}`);
    if (surveyor.fcm_token) {
      try {
        const fcmResult = await fcmService.sendNotification(
          surveyor.fcm_token,
          'งานใหม่',
          `คุณได้รับมอบหมายงานสำรวจ: ${caseData.customer_name}`,
          { case_id: String(caseId) }
        );
        console.log('[FCM] Send success:', fcmResult);
      } catch (err) {
        console.error('[FCM] Send failed:', err);
      }
    } else {
      console.warn('[FCM] No token — skip push notification');
    }

    // Send real-time notification via Socket.io
    const io = getIO();
    if (io) {
      io.to(`user:${surveyorId}`).emit('case_assigned', {
        case_id: caseId,
        customer_name: caseData.customer_name,
        incident_location: caseData.incident_location,
        message: `คุณได้รับมอบหมายงานสำรวจ: ${caseData.customer_name}`,
      });
    }

    return updated.rows[0];
  },

  async submitSurvey(caseId: number, surveyorId: number, data: Record<string, unknown> & { photo_paths: string[] }) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const caseData = caseResult.rows[0];
    if (caseData.status !== 'assigned') throw new ForbiddenError('Case is not in assigned status');
    if (caseData.assigned_to !== surveyorId) throw new ForbiddenError('Case is not assigned to you');

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const fields = [
        'car_model','car_color','license_plate','notes',
        'survey_company','survey_company_address','survey_company_phone',
        'claim_type','damage_level','car_lost','insurance_company','insurance_branch',
        'survey_job_no','claim_ref_no','claim_no',
        'prb_number','policy_no','driver_by_policy','policy_start','policy_end',
        'assured_name','policy_type','assured_email','risk_code','deductible',
        'car_brand','car_type','car_province','chassis_no','engine_no','mileage',
        'car_reg_year','ev_type','model_no',
        'driver_gender','driver_title','driver_name','driver_age','driver_birthdate',
        'driver_phone','driver_address','driver_id_card','driver_license_no',
        'driver_license_type','driver_license_place','driver_license_start','driver_license_end',
        'driver_relation','damage_description','estimated_cost',
        'acc_date','acc_time','acc_place','acc_province','acc_district',
        'acc_cause','acc_damage_type','acc_detail','acc_fault',
        'acc_reporter','acc_surveyor','acc_surveyor_branch','acc_surveyor_phone',
        'acc_customer_report_date','acc_insurance_notify_date',
        'acc_survey_arrive_date','acc_survey_complete_date',
        'acc_claim_opponent','acc_claim_amount','acc_claim_total_amount',
        'acc_police_name','acc_police_station','acc_police_comment','acc_police_date','acc_police_book_no',
        'acc_alcohol_test',
        'acc_followup','acc_followup_count','acc_followup_detail','acc_followup_date',
      ];
      const values = fields.map(f => data[f] ?? null);
      const placeholders = fields.map((_, i) => `$${i + 2}`).join(',');

      const reportResult = await client.query(
        `INSERT INTO survey_reports (case_id, ${fields.join(',')})
         VALUES ($1, ${placeholders}) RETURNING *`,
        [caseId, ...values]
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

  async updateReport(caseId: number, data: Record<string, unknown>) {
    // Find report for this case
    const reportResult = await db.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
    if (reportResult.rows.length === 0) throw new NotFoundError('Report not found');
    const reportId = reportResult.rows[0].id;

    // Get all valid column names from survey_reports
    const colResult = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'survey_reports' AND table_schema = 'public' AND column_name NOT IN ('id', 'case_id', 'created_at')"
    );
    const validCols = new Set(colResult.rows.map((r: { column_name: string }) => r.column_name));

    // Build update query from data
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const reportData = (data.report_data || data) as Record<string, string>;
    for (const [key, val] of Object.entries(reportData)) {
      if (validCols.has(key) && val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(val === '' ? null : val);
      }
    }

    if (fields.length === 0) return { message: 'No fields to update' };

    params.push(reportId);
    await db.query(`UPDATE survey_reports SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    return { message: 'Report updated', updated_fields: fields.length };
  },
};
