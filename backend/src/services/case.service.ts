import { db } from '../config/database';
import { env } from '../config/env';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { fcmService } from './fcm.service';
import { generateSurveyXml, emcsNameWarnings } from './xmlExport.service';
import type { XmlImportResult } from './xmlImport.service';
import { getIO } from '../socket';

// คอลัมน์ JSONB บน survey_reports (ข้อมูล 1:N) — node-pg ไม่ serialize array ให้เอง
// ต้อง JSON.stringify ก่อน bind ไม่งั้นถูกตีความเป็น Postgres array literal แล้ว error
const JSONB_FIELDS = new Set([
  'opposing_parties', 'injured_persons', 'damaged_property', 'insured_damage',
]);
// ข้อความ placeholder ของ dropdown ในแอป — ต้องไม่ถูกบันทึกเป็นค่าจริง (เคยหลุดเข้า acc_province/
// car_color → รหัสจังหวัดใน XML ที่ส่งเข้า EMCS ว่าง) → normalize เป็นค่าว่างที่ชั้น bind (กันทุกฟิลด์)
const PLACEHOLDER_SENTINELS = new Set(['-- ระบุ --', '-- เลือก --']);
const stripSentinel = (v: unknown): unknown =>
  (typeof v === 'string' && PLACEHOLDER_SENTINELS.has(v.trim())) ? '' : v;

// รูป "ยืนยันถึงที่เกิดเหตุ" (แอปถ่ายให้ตอนกดปุ่มถึงที่เกิดเหตุ) ไม่ได้อยู่ในหมวดที่
// มือถือส่งมา (photo_categories) เลยเคยลงเป็น category = NULL แล้วไปกองรวมใน
// "ไม่ระบุหมวด" บนหน้าเคส — ติดป้ายให้ตั้งแต่ตอนบันทึก จะได้ไม่ต้องตามใส่ทีหลัง
// (ไม่กระทบการนำเข้า EMCS: se-autokey กรองรูปนี้ทิ้งด้วย "ชื่อไฟล์" ไม่ได้ดูหมวด)
const ARRIVAL_CATEGORY = 'รูปยืนยันถึงที่เกิดเหตุ';
const arrivalCategory = (fileName: string): string | null =>
  (/^arrival(_\d+)?\.(jpe?g|png)$/i.test(fileName) ? ARRIVAL_CATEGORY : null);

// แปลงค่า field ให้พร้อม bind: JSONB → stringify (ยกเว้นเป็น string อยู่แล้ว), อื่นๆ → ตามเดิม
const bindVal = (f: string, v: unknown): unknown => {
  if (JSONB_FIELDS.has(f)) {
    if (v === undefined || v === null) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  return stripSentinel(v) ?? null;
};

export type CaseUser = { id: number; role: string };

// เลขเซอร์เวย์ (SETP-xxx ทั้งเลขหลักและเลขครั้งที่ 2) เป็นเลขอ้างอิงการเบิกเงิน — ห้ามซ้ำข้ามเคสเด็ดขาด
// excludeCaseId: ตอน submit เคสเดิมย่อมเจอเลขของตัวเอง ต้องยกเว้น
const assertSurveyJobNoUnique = async (jobNos: unknown[], excludeCaseId?: number): Promise<void> => {
  for (const raw of jobNos) {
    const jobNo = String(raw ?? '').trim();
    if (!jobNo) continue;
    const dup = await db.query(
      `SELECT c.id FROM cases c JOIN survey_reports sr ON sr.case_id = c.id
        WHERE (sr.survey_job_no = $1 OR sr.survey_job_no_2 = $1) AND c.id != $2 LIMIT 1`,
      [jobNo, excludeCaseId ?? -1]);
    if (dup.rows.length > 0) {
      throw new AppError(409,
        `เลขเซอร์เวย์ ${jobNo} ถูกใช้แล้วในเคส #${dup.rows[0].id} — เลขเซอร์เวย์ใช้อ้างอิงเบิกเงิน ห้ามซ้ำ`);
    }
  }
};

// surveyor เข้าถึงได้เฉพาะเคสที่มอบหมายให้ตัวเอง (กัน IDOR ไล่เลข id อ่าน/ทับเคสคนอื่น)
// checker/admin/callcenter เข้าถึงได้ทุกเคส (ตรวจงาน/จัดการ)
const assertCaseAccess = (caseData: { assigned_to: number | null }, user?: CaseUser): void => {
  if (user?.role === 'surveyor' && caseData.assigned_to !== user.id) {
    throw new ForbiddenError('Case is not assigned to you');
  }
};

/**
 * ยอดเงินใน XML มีเฉพาะงานที่นำเข้าจาก ISURVEY:
 *
 *  mobile      — แอปมือถือไม่มีหน้า "ค่าใช้จ่าย" (ยังอยู่นอกขอบเขต) จึงไม่มียอดให้ส่ง
 *                หัวหน้ากรอกเองที่หน้าค่าใช้จ่ายของ EMCS แล้วกดส่งงาน
 *                กันไว้ด้วย source ไม่ใช่แค่ "ว่างก็ไม่ส่ง" เผื่อผู้ตรวจเผลอกรอกช่อง
 *                ค่าใช้จ่ายบนหน้าเว็บ — ค่านั้นไม่ควรไหลไปทับของหัวหน้าใน EMCS
 *  isurvey_xml — ไฟล์จากระบบเก่ามียอดที่ "หัวหน้ากรอกไว้แล้ว" ติดมาด้วย → ต้องส่งต่อ
 *                ไม่งั้นข้อมูลของหัวหน้าหายตอนย้ายระบบ
 */
async function withBillIfImported(caseId: number, report: Record<string, unknown>) {
  const src = await db.query('SELECT source FROM cases WHERE id = $1', [caseId]);
  if (src.rows[0]?.source !== 'isurvey_xml') return report;
  const exp = await db.query('SELECT * FROM survey_expenses WHERE report_id = $1', [report.id]);
  return exp.rows.length ? { ...report, ...exp.rows[0], id: report.id } : report;
}

export const caseService = {
  async create(data: Record<string, unknown> & { customer_name: string; incident_location: string }, createdBy: number) {
    // เลขเซอร์เวย์ (SETP-xxx) ห้ามซ้ำ — เป็นเลขอ้างอิงเบิกเงิน
    // (เลขเคลมซ้ำได้โดยตั้งใจ: 1 เคลมออกงานหลายครั้ง — ระบบนับ "ครั้งที่" จาก claim_no เดิมอยู่แล้ว)
    await assertSurveyJobNoUnique([data.survey_job_no, data.survey_job_no_2]);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // หมายเหตุ: ตาราง cases ไม่มีคอลัมน์ insurance_company — ค่านี้ถูกเก็บใน survey_reports แทน (ดู reportFields)
      const caseResult = await client.query(
        `INSERT INTO cases (customer_name, incident_location, incident_lat, incident_lng, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.customer_name, data.incident_location, data.incident_lat || null, data.incident_lng || null, createdBy]
      );
      const newCase = caseResult.rows[0];

      // สร้าง survey_report เบื้องต้น ถ้ามีข้อมูลจากใบเคลม
      const reportFields = [
        'survey_company','survey_company_address',
        'claim_type','claim_no','claim_ref_no','insurance_company','insurance_branch',
        'survey_job_no','survey_job_no_2','car_lost',
        'policy_no','policy_type','policy_start','policy_end','assured_name','prb_number','deductible',
        'car_brand','car_model','car_type','car_color','license_plate','car_province',
        'chassis_no','engine_no','car_reg_year',
        'driver_first_name','driver_last_name','driver_phone',
        'acc_date','acc_time','acc_place','acc_subdistrict','acc_province','acc_district',
        'acc_cause','acc_damage_type','acc_detail','acc_fault',
        'acc_reporter','reporter_phone','acc_customer_report_date','acc_insurance_notify_date',
        'acc_insurance_notify_time','receiver_name','surveyor_name','surveyor_phone',
        'counterparty_plate','counterparty_brand','counterparty_insurance','counterparty_detail',
        'notes',
      ];
      const providedFields: string[] = [];
      const providedValues: unknown[] = [];
      for (const f of reportFields) {
        const val = stripSentinel(data[f]); // กัน placeholder "-- ระบุ --" หลุดเข้าเป็นค่าจริง
        if (val !== undefined && val !== '') {
          providedFields.push(f);
          providedValues.push(val);
        }
      }

      if (providedFields.length > 0) {
        const cols = ['case_id', ...providedFields].join(', ');
        const placeholders = [newCase.id, ...providedValues].map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO survey_reports (${cols}) VALUES (${placeholders})`,
          [newCase.id, ...providedValues]
        );
      }

      // ย้ายรูป OCR เข้าโฟลเดอร์ประจำเคส — ผูกกับ case id (immutable) เท่านั้น
      // (เดิมตั้งชื่อตามเลขเคลมที่แก้ไขได้ → เลขเปลี่ยนแล้วโฟลเดอร์ upload/submit ไม่ตรงกัน รูปหลุดเงียบ)
      const ocrImagePaths = data.ocr_image_paths as string[] | undefined;
      const claimFolder = `case_${newCase.id}`;
      const jobFolder = `job_${newCase.id}`;

      if (ocrImagePaths && Array.isArray(ocrImagePaths) && ocrImagePaths.length > 0) {
        const fs = await import('fs');
        const pathMod = await import('path');
        const folderPath = pathMod.default.resolve(env.UPLOAD_DIR, claimFolder, jobFolder);
        if (!fs.default.existsSync(folderPath)) {
          fs.default.mkdirSync(folderPath, { recursive: true });
        }

        for (const rawFilePath of ocrImagePaths) {
          // กัน path traversal: ใช้เฉพาะชื่อไฟล์ (basename) — client ส่ง '../../.env' มาย้าย/ลบไฟล์ระบบไม่ได้
          const filePath = pathMod.default.basename(String(rawFilePath));
          if (!filePath || filePath === '.' || filePath === '..') continue;

          const srcPath = pathMod.default.resolve(env.UPLOAD_DIR, filePath);
          const uploadRoot = pathMod.default.resolve(env.UPLOAD_DIR);
          // ยืนยันว่า src อยู่ใน UPLOAD_DIR จริง (กันหลุดกรอบแม้ basename แล้ว)
          if (srcPath !== uploadRoot && !srcPath.startsWith(uploadRoot + pathMod.default.sep)) continue;

          const destPath = pathMod.default.join(folderPath, filePath);
          try {
            if (fs.default.existsSync(srcPath) && !fs.default.existsSync(destPath)) {
              fs.default.renameSync(srcPath, destPath);
            }
          } catch { /* skip */ }

          await client.query(
            'INSERT INTO case_images (case_id, file_path, image_type) VALUES ($1, $2, $3)',
            [newCase.id, `${claimFolder}/${jobFolder}/${filePath}`, 'ocr']
          );
        }
      }

      await client.query('COMMIT');
      return newCase;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getMyCases(surveyorId: number) {
    const result = await db.query(
      `SELECT c.*, sr.claim_no, sr.survey_job_no, sr.claim_ref_no
       FROM cases c
       LEFT JOIN survey_reports sr ON sr.case_id = c.id
       WHERE c.assigned_to = $1
       ORDER BY c.created_at DESC`,
      [surveyorId]
    );
    return result.rows;
  },

  async assign(caseId: number, surveyorId: number) {
    // ดึง claim_no + insurance_company จาก survey_reports มาด้วย (โชว์บนการ์ดงานมือถือ)
    const caseResult = await db.query(
      `SELECT c.*, sr.claim_no AS sr_claim_no, sr.insurance_company AS sr_insurance_company
         FROM cases c LEFT JOIN survey_reports sr ON sr.case_id = c.id WHERE c.id = $1`,
      [caseId]
    );
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const caseData = caseResult.rows[0];

    const surveyorResult = await db.query(
      "SELECT id, fcm_token, first_name, last_name FROM users WHERE id = $1 AND role = 'surveyor' AND is_active = true",
      [surveyorId]
    );
    if (surveyorResult.rows.length === 0) throw new NotFoundError('Surveyor not found');

    // มอบหมายแบบ atomic — กัน race (callcenter 2 คนกดพร้อมกัน จ่ายคนละคน) ด้วย guard status ใน UPDATE
    // และรองรับ reassign เคสที่ถูกปฏิเสธ ('declined') ไม่ใช่แค่ 'pending'
    const updated = await db.query(
      `UPDATE cases SET assigned_to = $1, status = 'assigned'
         WHERE id = $2 AND status IN ('pending','declined') RETURNING *`,
      [surveyorId, caseId]
    );
    if (updated.rowCount === 0) {
      throw new ForbiddenError('ไม่สามารถมอบหมายงานนี้ได้ (อาจถูกมอบหมายไปแล้ว)');
    }

    // "แจ้งเซอร์เวย์" (ไทม์ไลน์งานบนมือถือ) = เวลาที่ callcenter กดมอบหมายงาน → บันทึกลง acc_insurance_notify_date
    // ต้องเป็นเวลาไทย (Asia/Bangkok) ไม่ใช่เวลา server (prod = UTC); รูปแบบ D/M/พ.ศ.|HH:MM ตรงกับที่มือถืออ่าน (splitDT)
    // reassign หลัง 'declined' จะเขียนทับเป็นเวลาแจ้งครั้งล่าสุด (= เวลาที่ surveyor คนใหม่ถูกแจ้งจริง)
    try {
      const tRes = await db.query(
        `SELECT to_char(n, 'FMDD/FMMM/') || (EXTRACT(YEAR FROM n)::int + 543) || '|' || to_char(n, 'HH24:MI') AS ts
           FROM (SELECT NOW() AT TIME ZONE 'Asia/Bangkok' AS n) s`
      );
      const notifyTime = tRes.rows[0].ts as string;
      const existingReport = await db.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
      if (existingReport.rows.length > 0) {
        await db.query('UPDATE survey_reports SET acc_insurance_notify_date = $1 WHERE case_id = $2', [notifyTime, caseId]);
      } else {
        await db.query('INSERT INTO survey_reports (case_id, acc_insurance_notify_date) VALUES ($1, $2)', [caseId, notifyTime]);
      }
    } catch (err) {
      console.error('[assign] เขียน acc_insurance_notify_date ไม่สำเร็จ (ไม่บล็อกการมอบหมาย):', err);
    }

    // Send push notification via FCM
    const surveyor = surveyorResult.rows[0];
    console.log(`[FCM] Surveyor ${surveyor.id} fcm_token: ${surveyor.fcm_token ? 'EXISTS' : 'NULL'}`);
    if (surveyor.fcm_token) {
      try {
        const fcmResult = await fcmService.sendUrgentSurvey(
          surveyor.fcm_token,
          caseId,
          caseData.incident_location || '',
          caseData.sr_claim_no || '',
          caseData.sr_insurance_company || ''
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

  async declineCase(caseId: number, surveyorId: number) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');
    const caseData = caseResult.rows[0];
    if (caseData.assigned_to !== surveyorId) throw new ForbiddenError('Case is not assigned to you');

    // เคลียร์ assigned_to ด้วย — งานที่ถูกปฏิเสธจะได้ไม่ค้างในรายการของคนที่ปฏิเสธ (getMyCases กรองด้วย assigned_to)
    const result = await db.query(
      "UPDATE cases SET status = 'declined', assigned_to = NULL WHERE id = $1 RETURNING *",
      [caseId]
    );
    return result.rows[0];
  },

  async updateSurvey(caseId: number, surveyorId: number, data: Record<string, unknown>) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const caseData = caseResult.rows[0];
    if (caseData.assigned_to !== surveyorId) throw new ForbiddenError('Case is not assigned to you');

    const reportResult = await db.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
    if (reportResult.rows.length === 0) throw new NotFoundError('Survey report not found');

    const fields = [
      'car_model','car_color','license_plate','notes',
      'survey_company','survey_company_address','survey_company_phone',
      'claim_type','damage_level','car_lost','insurance_company','insurance_branch',
      'survey_job_no','claim_ref_no','claim_no',
      'prb_number','policy_no','driver_by_policy','policy_start','policy_end',
      'assured_name','policy_type','assured_email','risk_code','deductible',
      'car_brand','car_type','car_province','chassis_no','engine_no','mileage',
      'car_reg_year','ev_type','ev_battery_no','ev_battery_start','ev_charger_no','model_no',
      'driver_gender','driver_title','driver_name','driver_first_name','driver_last_name',
      'driver_age','driver_birthdate',
      'driver_phone','driver_address','driver_province','driver_district',
      'driver_id_card','driver_license_no',
      'driver_license_type','driver_license_place','driver_license_start','driver_license_end',
      'driver_relation','driver_ticket','damage_description','estimated_cost','insured_damage',
      'acc_date','acc_time','acc_place','acc_subdistrict','acc_province','acc_district',
      'acc_cause','acc_damage_type','acc_detail','acc_fault','acc_fault_opponent_no',
      'acc_reporter','reporter_phone','acc_surveyor','acc_surveyor_branch','acc_surveyor_phone',
      'acc_customer_report_date','customer_reported_at','acc_insurance_notify_date',
      'acc_survey_arrive_date','acc_survey_complete_date',
      'acc_claim_opponent','acc_claim_amount','acc_claim_total_amount','opposing_parties',
      'injured_persons','damaged_property','has_opponents','has_injured','has_property',
      'acc_police_name','acc_police_station','acc_police_comment','acc_police_date','acc_police_book_no',
      'acc_alcohol_test','acc_alcohol_result',
      'acc_followup','acc_followup_count','acc_followup_detail','acc_followup_date',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (data[f] !== undefined) {
        setClauses.push(`${f} = $${idx}`);
        values.push(bindVal(f, data[f]));
        idx++;
      }
    }
    if (setClauses.length === 0) throw new Error('No fields to update');

    values.push(caseId);
    const result = await db.query(
      `UPDATE survey_reports SET ${setClauses.join(', ')} WHERE case_id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  // keepRaw = JSON array ของชื่อไฟล์ทั้งชุดที่ client ตั้งใจให้เหลืออยู่ (แอปใหม่ส่งทีละไฟล์ + keep ทุกคำขอ)
  // ไม่ส่ง keep = แอปเก่าส่งทุกไฟล์ในคำขอเดียว → ใช้พฤติกรรมเดิม (ล้าง non-OCR ทั้งหมดก่อนเขียนใหม่)
  async uploadCaseFolder(caseId: number, _folderName: string, files: Express.Multer.File[], user?: CaseUser, keepRaw?: unknown) {
    // กัน IDOR: uploadCaseFolder ลบรูปเดิมของเคสก่อนเขียนใหม่ — surveyor ต้องเป็นเจ้าของเคสเท่านั้น
    const own = await db.query('SELECT assigned_to FROM cases WHERE id = $1', [caseId]);
    if (own.rows.length === 0) throw new NotFoundError('Case not found');
    assertCaseAccess(own.rows[0], user);

    // โฟลเดอร์เก็บรูปผูกกับ case id (immutable) เท่านั้น — เดิมใช้เลขเคลมจาก DB ซึ่งแก้ไขได้
    // → เลขเปลี่ยนระหว่าง upload กับ submit แล้วรูปหลุดจากรายงานทั้งชุดแบบเงียบ (folderName จาก client ไม่ใช้แล้ว)
    const claimNo = `case_${caseId}`;
    const surveyJobNo = `job_${caseId}`;

    const fs = await import('fs');
    const pathMod = await import('path');

    // โครงสร้าง: uploads/{เลขเคลม}/{เลขเรื่องเซอร์เวย์}/
    const subFolderPath = pathMod.default.resolve(env.UPLOAD_DIR, claimNo, surveyJobNo);
    if (!fs.default.existsSync(subFolderPath)) {
      fs.default.mkdirSync(subFolderPath, { recursive: true });
    }

    // ลบรูปที่อยู่นอกโฟลเดอร์เคลม (uploads/ root) ของเคสนี้
    const surveyPhotos = await db.query(
      `SELECT sp.file_path FROM survey_photos sp JOIN survey_reports sr ON sp.report_id = sr.id WHERE sr.case_id = $1`, [caseId]
    );
    const caseImages = await db.query(
      'SELECT file_path FROM case_images WHERE case_id = $1', [caseId]
    );
    for (const row of [...surveyPhotos.rows, ...caseImages.rows]) {
      const fp = row.file_path as string;
      if (!fp.includes('/')) {
        const fullPath = pathMod.default.resolve(env.UPLOAD_DIR, fp);
        try { if (fs.default.existsSync(fullPath)) fs.default.unlinkSync(fullPath); } catch { /* skip */ }
      }
    }

    // ดึงชื่อไฟล์ OCR ที่ต้องเก็บไว้
    const ocrFiles = new Set<string>();
    const ocrResult = await db.query(
      "SELECT file_path FROM case_images WHERE case_id = $1 AND image_type = 'ocr'", [caseId]
    );
    for (const row of ocrResult.rows) {
      const fp = row.file_path as string;
      ocrFiles.add(pathMod.default.basename(fp));
    }

    // keep set (ชื่อไฟล์ base เท่านั้น — กัน path traversal)
    let keep: Set<string> | null = null;
    if (typeof keepRaw === 'string' && keepRaw) {
      try {
        const arr = JSON.parse(keepRaw);
        if (Array.isArray(arr)) keep = new Set(arr.map((x) => pathMod.default.basename(String(x))));
      } catch { /* keep พัง → ปฏิบัติเหมือนไม่ส่ง */ }
    }

    // ลบรูปเก่าในโฟลเดอร์ย่อย ยกเว้นรูป OCR
    // มี keep → ลบเฉพาะไฟล์ที่หลุดจากชุดปัจจุบันของ client (ผู้ใช้ลบรูปในแอป) — ไฟล์ที่อัปโหลดไว้แล้ว
    // จากคำขอก่อนหน้า (per-file + retry) ต้องคงอยู่; ไม่มี keep → ล้าง non-OCR ทั้งหมด (แอปเก่า)
    try {
      const existing = fs.default.readdirSync(subFolderPath);
      for (const f of existing) {
        if (ocrFiles.has(f)) continue; // ข้ามรูป OCR
        if (keep !== null && keep.has(f)) continue; // ยังอยู่ในชุดของ client → เก็บไว้
        try { fs.default.unlinkSync(pathMod.default.join(subFolderPath, f)); } catch { /* skip */ }
      }
    } catch { /* folder may not exist */ }

    // ใส่รูปใหม่จากมือถือ
    const movedFiles: string[] = [];
    for (const file of files) {
      const safeName = file.originalname.replace(/[/\\?%*:|"<>]/g, '_');
      const destPath = pathMod.default.join(subFolderPath, safeName);
      try {
        fs.default.renameSync(file.path, destPath);
        movedFiles.push(`${claimNo}/${surveyJobNo}/${safeName}`);
      } catch { movedFiles.push(safeName); }
    }

    return { folder: `${claimNo}/${surveyJobNo}`, files: movedFiles };
  },

  // รายชื่อไฟล์ที่อยู่ในโฟลเดอร์เคสบน server แล้ว — แอปใช้ข้ามไฟล์ที่อัปโหลดสำเร็จไปก่อนหน้า
  // (per-file upload: เน็ตหลุดกลางทางแล้ว retry ไม่ต้องเริ่มจากศูนย์)
  async listCaseFolder(caseId: number, user?: CaseUser) {
    const own = await db.query('SELECT assigned_to FROM cases WHERE id = $1', [caseId]);
    if (own.rows.length === 0) throw new NotFoundError('Case not found');
    assertCaseAccess(own.rows[0], user);

    const fs = await import('fs');
    const pathMod = await import('path');
    const folderPath = pathMod.default.resolve(env.UPLOAD_DIR, `case_${caseId}`, `job_${caseId}`);
    let files: string[] = [];
    try { files = fs.default.readdirSync(folderPath); } catch { /* ยังไม่มีโฟลเดอร์ = ยังไม่มีไฟล์ */ }
    return { files };
  },

  async createCaseFolder(caseId: number, user?: CaseUser) {
    const own = await db.query('SELECT assigned_to FROM cases WHERE id = $1', [caseId]);
    if (own.rows.length === 0) throw new NotFoundError('Case not found');
    assertCaseAccess(own.rows[0], user);

    // โฟลเดอร์ผูกกับ case id (immutable) — สอดคล้องกับ uploadCaseFolder/submitSurvey
    const folderName = `case_${caseId}`;

    const fs = await import('fs');
    const path = await import('path');
    const folderPath = path.default.resolve(env.UPLOAD_DIR, folderName);
    if (!fs.default.existsSync(folderPath)) {
      fs.default.mkdirSync(folderPath, { recursive: true });
    }
    return { folder: folderName, path: folderPath };
  },

  async confirmArrival(caseId: number, surveyorId: number, photoPath: string) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');
    const caseData = caseResult.rows[0];
    if (caseData.assigned_to !== surveyorId) throw new ForbiddenError('Case is not assigned to you');

    // ถ้ามี arrival อยู่แล้ว → อัพเดท, ถ้าไม่มี → insert ใหม่
    const existing = await db.query(
      "SELECT id FROM case_images WHERE case_id = $1 AND image_type = 'arrival'", [caseId]
    );
    if (existing.rows.length > 0) {
      await db.query(
        'UPDATE case_images SET file_path = $1, uploaded_at = NOW() WHERE id = $2',
        [photoPath, existing.rows[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO case_images (case_id, file_path, image_type) VALUES ($1, $2, $3)',
        [caseId, photoPath, 'arrival']
      );
    }

    // บันทึกเวลาถึงที่เกิดเหตุใน survey_reports — ต้องเป็นเวลาไทย (Asia/Bangkok) ไม่ใช่เวลา server (prod = UTC)
    // รูปแบบ: D/M/พ.ศ.|HH:MM (วัน/เดือนไม่เติม 0 นำ, ปี พ.ศ. = ค.ศ.+543, เวลาเติม 0 นำ) — ตรงกับที่มือถืออ่าน (splitDT)
    const tRes = await db.query(
      `SELECT to_char(n, 'FMDD/FMMM/') || (EXTRACT(YEAR FROM n)::int + 543) || '|' || to_char(n, 'HH24:MI') AS ts
         FROM (SELECT NOW() AT TIME ZONE 'Asia/Bangkok' AS n) s`
    );
    const arrivalTime = tRes.rows[0].ts as string;
    const existingReport = await db.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
    if (existingReport.rows.length > 0) {
      await db.query('UPDATE survey_reports SET acc_survey_arrive_date = $1 WHERE case_id = $2', [arrivalTime, caseId]);
    }

    return { success: true, arrival_time: arrivalTime };
  },

  async getArrivalPhotos(caseId: number, user?: CaseUser) {
    if (user?.role === 'surveyor') {
      const c = await db.query('SELECT assigned_to FROM cases WHERE id = $1', [caseId]);
      if (c.rows.length === 0) throw new NotFoundError('Case not found');
      assertCaseAccess(c.rows[0], user);
    }
    const result = await db.query(
      "SELECT * FROM case_images WHERE case_id = $1 AND image_type = 'arrival' ORDER BY uploaded_at",
      [caseId]
    );
    return result.rows;
  },

  async submitSurvey(caseId: number, surveyorId: number, data: Record<string, unknown> & { photo_paths: string[] }) {
    const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');

    const caseData = caseResult.rows[0];
    if (caseData.status !== 'assigned') throw new ForbiddenError('Case is not in assigned status');
    if (caseData.assigned_to !== surveyorId) throw new ForbiddenError('Case is not assigned to you');

    // เลขเซอร์เวย์ห้ามซ้ำข้ามเคส (อ้างอิงเบิกเงิน) — เช็คก่อนเขียน กันแก้เลขในฟอร์มไปชนเคสอื่น
    await assertSurveyJobNoUnique([data.survey_job_no, data.survey_job_no_2], caseId);

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
        'car_reg_year','ev_type','ev_battery_no','ev_battery_start','ev_charger_no','model_no',
        'driver_gender','driver_title','driver_name','driver_first_name','driver_last_name',
        'driver_age','driver_birthdate',
        'driver_phone','driver_address','driver_province','driver_district',
        'driver_id_card','driver_license_no',
        'driver_license_type','driver_license_place','driver_license_start','driver_license_end',
        'driver_relation','driver_ticket','damage_description','estimated_cost','insured_damage',
        'acc_date','acc_time','acc_place','acc_subdistrict','acc_province','acc_district',
        'acc_cause','acc_damage_type','acc_detail','acc_fault','acc_fault_opponent_no',
        'acc_reporter','reporter_phone','acc_surveyor','acc_surveyor_branch','acc_surveyor_phone',
        'acc_customer_report_date','customer_reported_at','acc_insurance_notify_date',
        'acc_survey_arrive_date','acc_survey_complete_date',
        'acc_claim_opponent','acc_claim_amount','acc_claim_total_amount','opposing_parties',
        'injured_persons','damaged_property','has_opponents','has_injured','has_property',
        'acc_police_name','acc_police_station','acc_police_comment','acc_police_date','acc_police_book_no',
        'acc_alcohol_test','acc_alcohol_result',
        'acc_followup','acc_followup_count','acc_followup_detail','acc_followup_date',
        'survey_result','review_comment','surveyor_comment',
      ];
      // ส่งเฉพาะคอลัมน์ที่แอปส่งมาจริง (data[f] !== undefined) — กันการเขียนทับข้อมูล intake จาก callcenter
      // (เดิม map ทุกฟิลด์ → คอลัมน์ที่แอปไม่ส่ง เช่น acc_subdistrict/reporter_phone ถูกทับเป็น NULL)
      const provided = fields.filter(f => data[f] !== undefined);
      const values = provided.map(f => bindVal(f, data[f]));

      // ตรวจสอบว่ามี report อยู่แล้วหรือไม่ (สร้างจาก callcenter)
      // เก็บเลขเคลม/เลขเซอร์เวย์ "ก่อน UPDATE" ไว้ด้วย — ใช้ตามหาโฟลเดอร์รูประบบเก่า (legacy) ตอน re-link
      const existingReport = await client.query(
        'SELECT id, claim_no, survey_job_no FROM survey_reports WHERE case_id = $1', [caseId]
      );
      const oldClaimNo = existingReport.rows[0]?.claim_no as string | undefined;
      const oldSurveyJobNo = existingReport.rows[0]?.survey_job_no as string | undefined;
      let report;
      if (existingReport.rows.length > 0) {
        if (provided.length > 0) {
          const setClauses = provided.map((f, i) => `${f} = $${i + 1}`);
          const updateResult = await client.query(
            `UPDATE survey_reports SET ${setClauses.join(', ')} WHERE case_id = $${provided.length + 1} RETURNING *`,
            [...values, caseId]
          );
          report = updateResult.rows[0];
        } else {
          report = existingReport.rows[0];
        }
      } else {
        // INSERT report ใหม่ (เฉพาะคอลัมน์ที่ส่งมา)
        const placeholders = provided.map((_, i) => `$${i + 2}`).join(',');
        const insertResult = await client.query(
          `INSERT INTO survey_reports (case_id${provided.length ? ', ' + provided.join(',') : ''})
           VALUES ($1${placeholders ? ', ' + placeholders : ''}) RETURNING *`,
          [caseId, ...values]
        );
        report = insertResult.rows[0];
      }

      // บันทึก survey_photos จากโฟลเดอร์ที่อัปโหลดมาจากมือถือ (ข้ามรูป OCR)
      // โฟลเดอร์หลักผูกกับ case id (immutable) — เดิมใช้เลขเคลมจาก payload ซึ่งอาจไม่ตรงกับโฟลเดอร์
      // ที่ upload เขียนไว้ (เลขถูกแก้ระหว่างทาง) → รูปหลุดจากรายงานทั้งชุดแบบเงียบ
      // ยังกวาดโฟลเดอร์ระบบเก่า (ตามเลขเคลม payload/DB ก่อน UPDATE) เผื่อไฟล์จากแอป/การอัปโหลดรุ่นเก่า
      const san = (s: unknown) => {
        const v = String(s ?? '').replace(/[/\\?%*:|"<>]/g, '_');
        return (v === '.' || v === '..') ? '_' : v; // กัน path traversal ('..' หลุด resolve ออกนอก uploads)
      };
      const candidateFolders = [...new Set([
        `case_${caseId}/job_${caseId}`,
        `${san(data.claim_no) || `case_${caseId}`}/${san(data.survey_job_no) || `job_${caseId}`}`,
        `${san(oldClaimNo) || `case_${caseId}`}/${san(oldSurveyJobNo) || `job_${caseId}`}`,
      ])];
      const fs = await import('fs');
      const pathMod = await import('path');

      // ลบ survey_photos เดิมของ report ก่อน re-insert — กันรูปซ้ำเมื่อ submit ซ้ำ (idempotent)
      await client.query('DELETE FROM survey_photos WHERE report_id = $1', [report.id]);

      // ดึงชื่อไฟล์ OCR เพื่อข้าม
      const ocrResult = await client.query(
        "SELECT file_path FROM case_images WHERE case_id = $1 AND image_type = 'ocr'", [caseId]
      );
      const ocrFileNames = new Set(ocrResult.rows.map((r: any) => pathMod.default.basename(r.file_path)));

      // หมวดของรูป — มือถือส่ง photo_categories (local-path → หมวด); จับคู่ด้วย basename
      const catByName: Record<string, string> = {};
      const rawCats = data.photo_categories;
      if (rawCats && typeof rawCats === 'object') {
        for (const [k, v] of Object.entries(rawCats as Record<string, unknown>)) {
          if (typeof v === 'string' && v) catByName[pathMod.default.basename(k)] = v;
        }
      }

      // ใช้ "โฟลเดอร์แรกที่มีอยู่จริง" เพียงโฟลเดอร์เดียว — ห้าม merge ข้ามโฟลเดอร์ และห้าม
      // fall-through เมื่อโฟลเดอร์มีอยู่แต่ว่าง: โฟลเดอร์ที่มีอยู่ = upload ระบบใหม่เขียน/prune แล้ว
      // เนื้อในคือชุดปัจจุบันของผู้ใช้ (0 รูป = ตั้งใจลบทั้งหมด) — ถ้าไปสแกนโฟลเดอร์เก่าต่อ
      // รูป stale ก่อน migrate จะฟื้นคืนเข้ารายงาน
      const uploadRoot = pathMod.default.resolve(env.UPLOAD_DIR);
      for (const rel of candidateFolders) {
        const folderPath = pathMod.default.resolve(env.UPLOAD_DIR, rel);
        // containment: เลขเคลมมาจาก payload/DB — ห้ามชี้ออกนอก uploads
        if (folderPath !== uploadRoot && !folderPath.startsWith(uploadRoot + pathMod.default.sep)) continue;
        if (!fs.default.existsSync(folderPath)) continue; // ไม่เคยสร้าง → ลองโฟลเดอร์ระบบเก่า
        const photoFiles = fs.default.readdirSync(folderPath).filter((f) => !ocrFileNames.has(f));
        for (const fileName of photoFiles) {
          await client.query(
            'INSERT INTO survey_photos (report_id, file_path, category) VALUES ($1, $2, $3)',
            [report.id, `${rel}/${fileName}`, catByName[fileName] || arrivalCategory(fileName)]
          );
        }
        break; // โฟลเดอร์แรกที่มีอยู่จริง = แหล่งความจริง แม้ว่าง
      }

      // guard status ใน UPDATE (idempotent) — ถ้าถูก submit คู่ขนานจน status เปลี่ยนไปแล้ว → 0 rows → rollback
      const st = await client.query(
        `UPDATE cases SET status = 'surveyed' WHERE id = $1 AND status = 'assigned' RETURNING id`,
        [caseId]
      );
      if (st.rowCount === 0) throw new ForbiddenError('Case is not in assigned status');

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
      `SELECT c.*, u.first_name AS surveyor_first_name, u.last_name AS surveyor_last_name,
              sr.claim_no, sr.survey_job_no, sr.claim_ref_no,
              ROW_NUMBER() OVER (PARTITION BY sr.claim_no ORDER BY c.created_at) AS visit_count
       FROM cases c
       LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN survey_reports sr ON sr.case_id = c.id
       WHERE c.status IN ('surveyed', 'reviewed')
       ORDER BY c.created_at DESC`
    );
    return result.rows;
  },

  async getDetail(caseId: number, user?: CaseUser) {
    const caseResult = await db.query(
      `SELECT c.*, u.first_name AS surveyor_first_name, u.last_name AS surveyor_last_name
       FROM cases c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = $1`,
      [caseId]
    );
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');
    assertCaseAccess(caseResult.rows[0], user);

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

    // รูป OCR/capture จาก call center
    const caseImagesResult = await db.query(
      'SELECT * FROM case_images WHERE case_id = $1 ORDER BY uploaded_at',
      [caseId]
    );

    // คำนวณ visit_count จาก claim_no เดียวกัน
    let visitCount = 1;
    const report = reportResult.rows[0] || null;
    if (report?.claim_no) {
      const vcResult = await db.query(
        `SELECT COUNT(*) AS cnt FROM survey_reports sr
         JOIN cases c ON c.id = sr.case_id
         WHERE sr.claim_no = $1 AND c.created_at <= (SELECT created_at FROM cases WHERE id = $2)`,
        [report.claim_no, caseId]
      );
      visitCount = parseInt(vcResult.rows[0]?.cnt || '1', 10);
    }

    // ค่าใช้จ่าย
    let expenses = null;
    if (report) {
      const expResult = await db.query(
        'SELECT * FROM survey_expenses WHERE report_id = $1',
        [report.id]
      );
      expenses = expResult.rows[0] || null;
    }

    // เคลมคู่ (อุบัติเหตุเดียวกัน คนละกรมธรรม์/คนละมุมมอง) — ให้แอปโชว์คำเตือน กันข้อมูลสองเคลมปนกัน:
    // (1) เคสที่เลขเคลม = เลขเคลมคู่กรณีของเรา (2) เคสอื่นที่อ้างเลขเคลมเราเป็นคู่กรณี
    let linkedCases: Array<Record<string, unknown>> = [];
    if (report) {
      const oppClaims = new Set<string>();
      const addClaims = (s: unknown): void => {
        for (const t of String(s ?? '').split(/[\s,]+/)) {
          if (/^[0-9A-Za-z-]{10,}$/.test(t)) oppClaims.add(t);
        }
      };
      addClaims(report.acc_claim_opponent);
      if (Array.isArray(report.opposing_parties)) {
        for (const p of report.opposing_parties) {
          if (p && typeof p === 'object') addClaims((p as Record<string, unknown>).claim_no);
        }
      }
      const conds: string[] = [];
      const params: unknown[] = [caseId];
      // ⚠️ เงื่อนไขล่างเป็น "ค้นข้อความในก้อน JSON ของคู่กรณี" → เลขสั้นจับมั่วได้ทันที
      // (เคสจริง 2026-08-01: เลขเคลมทดสอบ '11' ไปแมตช์เลขบัตร ปชช. '1139800001520'
      //  ของอีกเคส แล้วขึ้นแบนเนอร์ "เคลมคู่" ผิด ๆ บนมือถือ)
      // ใช้เกณฑ์เดียวกับ addClaims: ต้องยาวพอที่จะเป็นเลขเคลมจริง (จริง ๆ 21 ตัว เช่น
      // 21BR10AVD-6906-001619) — สั้นกว่านั้นถือว่าเป็นข้อมูลทดสอบ/ยังไม่ได้เลขจริง ข้ามไป
      if (report.claim_no && /^[0-9A-Za-z-]{10,}$/.test(String(report.claim_no).trim())) {
        params.push(String(report.claim_no).trim());
        conds.push(`sr.acc_claim_opponent ILIKE '%' || $${params.length} || '%'`);
        conds.push(`sr.opposing_parties::text ILIKE '%' || $${params.length} || '%'`);
      }
      if (oppClaims.size > 0) {
        params.push([...oppClaims]);
        conds.push(`sr.claim_no = ANY($${params.length}::text[])`);
      }
      if (conds.length > 0) {
        const lr = await db.query(
          `SELECT c.id, sr.claim_no, c.status FROM cases c JOIN survey_reports sr ON sr.case_id = c.id
            WHERE c.id != $1 AND (${conds.join(' OR ')}) ORDER BY c.id DESC LIMIT 5`, params);
        linkedCases = lr.rows;
      }
    }

    return {
      case: caseResult.rows[0],
      report,
      photos,
      review: reviewResult.rows[0] || null,
      case_images: caseImagesResult.rows,
      visit_count: visitCount,
      expenses,
      linked_cases: linkedCases,
      // ชื่อคนที่มีอักขระซึ่ง EMCS จะล้างค่าทั้งช่องทิ้ง — เตือนคนตรวจก่อนส่งเข้า EMCS
      emcs_name_warnings: report ? emcsNameWarnings(report) : [],
    };
  },

  // สร้าง INSERT_SURV_REPORT_XML (สัญญาข้อมูลพอร์ทัลประกัน) จาก survey_report ของเคส
  async getSurveyXml(caseId: number, user?: CaseUser): Promise<string> {
    const caseResult = await db.query('SELECT id, assigned_to FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) throw new NotFoundError('Case not found');
    assertCaseAccess(caseResult.rows[0], user);
    const reportResult = await db.query('SELECT * FROM survey_reports WHERE case_id = $1', [caseId]);
    if (reportResult.rows.length === 0) throw new NotFoundError('ยังไม่มีข้อมูลรายงานสำรวจของเคสนี้');
    const row = await withBillIfImported(caseId, reportResult.rows[0]);
    // เตือนซ้ำในล็อกฝั่งเซิร์ฟเวอร์ด้วย เพราะบอทดึง XML ผ่านทางนี้ ไม่ได้เห็นแบนเนอร์บนเว็บ
    for (const w of emcsNameWarnings(row)) {
      console.warn(`[EMCS] เคส ${caseId}: ${w.label} มีอักขระ ${w.bad} ที่ EMCS จะล้างค่าทิ้ง — ${w.value}`);
    }
    return generateSurveyXml(row);
  },

  /**
   * แตก zip รูปของ ISURVEY/EMCS ("ดาวน์โหลดรูปภาพ") ลงโฟลเดอร์เคส + ลง survey_photos
   * โครงสร้างใน zip: PICTURES/<หมวด>/... — หมวดตรงกับที่ se-autokey ใช้ (autokey/images.py)
   * เก็บลง path เดียวกับรูปจากมือถือ (uploads/case_<id>/job_<id>/) บอทจึงดึงผ่าน API เดิมได้
   */
  async importPhotoZip(caseId: number, zipBuffer: Buffer) {
    const AdmZip = (await import('adm-zip')).default;
    const fs = await import('fs');
    const pathMod = await import('path');
    const rid = await db.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
    if (rid.rows.length === 0) throw new NotFoundError('Report not found');
    const reportId = rid.rows[0].id;

    // หมวดใน zip → ป้ายประเภทรูปของ EMCS (ชุดเดียวกับ autokey/images.py ZIP_CAT_TO_EMCS)
    const CAT: Record<string, string> = {
      INS: 'รูปรถประกัน', ACC_MAP: 'รูปแผนที่เกิดเหตุ',
      OTHERS: 'รูปประกอบ', REPORTS: 'รูปประกอบ',
      TP_VEH: 'รูปรถคู่กรณี', TP_PERSON: 'รูปผู้บาดเจ็บ', TP_PROP: 'รูปทรัพย์สิน',
    };
    const IMG = /\.(jpe?g|png|webp|gif|bmp)$/i;
    const dir = pathMod.default.resolve(env.UPLOAD_DIR, `case_${caseId}`, `job_${caseId}`);
    fs.default.mkdirSync(dir, { recursive: true });

    let added = 0;
    const perCat: Record<string, number> = {};
    for (const e of new AdmZip(zipBuffer).getEntries()) {
      if (e.isDirectory) continue;
      const parts = e.entryName.split('/');
      const base = parts[parts.length - 1];
      if (!base || !IMG.test(base)) continue;             // ข้าม PDF/ไฟล์อื่น
      const cat = CAT[(parts[1] || '').toUpperCase()] ?? 'รูปประกอบ';
      // กันชื่อชนกันข้ามหมวด (zip ของพอร์ทัลตั้งชื่อซ้ำได้) — ไม่ทับไฟล์เดิม
      let name = base;
      for (let i = 2; fs.default.existsSync(pathMod.default.join(dir, name)); i++) {
        const dot = base.lastIndexOf('.');
        name = `${base.slice(0, dot)}_${i}${base.slice(dot)}`;
      }
      fs.default.writeFileSync(pathMod.default.join(dir, name), e.getData());
      await db.query(
        'INSERT INTO survey_photos (report_id, file_path, category) VALUES ($1, $2, $3)',
        [reportId, `case_${caseId}/job_${caseId}/${name}`, cat]);
      added++;
      perCat[cat] = (perCat[cat] ?? 0) + 1;
    }
    return { added, perCat };
  },

  /**
   * สร้างเคสจากไฟล์ XML ของ ISURVEY (flow ระบบเก่าที่กำลังเลิกใช้)
   *
   * ต่างจาก create(): รับได้ทุกคอลัมน์รวม JSONB (คู่กรณี/ผู้บาดเจ็บ/ทรัพย์สิน)
   * และตั้ง status='surveyed' ทันที เพราะงานสำรวจ "ทำเสร็จบน ISURVEY แล้ว" —
   * เว็บนี้เป็นแค่จุดตรวจก่อนส่งบอทเข้า EMCS (ผู้ตรวจกด "ปิดงาน" → review → 'reviewed')
   *
   * กันอัปไฟล์เดิมซ้ำด้วย assertSurveyJobNoUnique (เลขเซอร์เวย์ห้ามซ้ำอยู่แล้ว → 409)
   */
  // ใช้ type กลางจาก xmlImport.service — เดิมประกาศโครงซ้ำไว้ตรงนี้แบบ inline
  // พอฝั่งโน้นเพิ่มฟิลด์ (source/warnings) ตรงนี้ไม่รู้เรื่อง แล้วหลุดเงียบ
  async importFromXml(
    parsed: XmlImportResult,
    opts: { insuranceCompany: string; createdBy: number },
  ) {
    const report: Record<string, unknown> = { ...parsed.report, insurance_company: opts.insuranceCompany };
    await assertSurveyJobNoUnique([report.survey_job_no]);

    // ผู้สำรวจ: จับจากรหัสใน ACC_SURV ('SE272 นาย ...') — หาไม่เจอก็ปล่อยว่าง ไม่ล้มทั้งงาน
    let assignedTo: number | null = null;
    if (parsed.surveyorCode) {
      const u = await db.query('SELECT id FROM users WHERE UPPER(code) = $1 LIMIT 1',
        [parsed.surveyorCode.toUpperCase()]);
      if (u.rows.length > 0) assignedTo = u.rows[0].id;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const c = await client.query(
        // ที่มาต้องมาจากไฟล์ ห้าม hardcode — ไฟล์ที่สกัดกลับจากหน้าเว็บ EMCS
        // (source='emcs_extract') เป็นข้อมูลทดสอบ กติกาต่างกับงานจริงจากระบบเก่า
        // โดยเฉพาะเรื่องยอดเงิน: withBillIfImported ส่งบิลต่อเข้า EMCS เฉพาะ 'isurvey_xml'
        // เท่านั้น เคสทดสอบจึงไม่ดันยอดเงินเข้าระบบประกันโดยไม่ตั้งใจ
        `INSERT INTO cases (customer_name, incident_location, created_by, assigned_to, status, source)
         VALUES ($1, $2, $3, $4, 'surveyed', $5) RETURNING *`,
        [parsed.caseFields.customer_name || '(ไม่ระบุชื่อผู้เอาประกัน)',
         parsed.caseFields.incident_location || '(ไม่ระบุสถานที่)',
         opts.createdBy, assignedTo, parsed.source]);
      const caseId = c.rows[0].id;

      // เขียนเฉพาะคอลัมน์ที่มีจริง (ใช้ allowlist ชุดเดียวกับ updateReport) — กัน SQL พัง
      // เมื่อ mapper ผลิตคีย์ที่ยังไม่มีคอลัมน์รองรับ
      const cols = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_name = 'survey_reports'`);
      const valid = new Set<string>(cols.rows.map((r: { column_name: string }) => r.column_name));
      // คอลัมน์ตัวเลข/วันที่/บูลีน รับสตริงว่างไม่ได้ (Postgres: invalid input syntax for type numeric)
      // XML ให้ค่าว่างมาเยอะ (OPO_PAY, COST_DAMAGE ฯลฯ) → บังคับเป็น NULL
      const nonText = new Set<string>(
        cols.rows
          .filter((r: { data_type: string }) => !/char|text|json/.test(r.data_type))
          .map((r: { column_name: string }) => r.column_name));
      const fields = Object.keys(report).filter((f) => valid.has(f) && report[f] !== undefined);
      const values = fields.map((f) => {
        const v = bindVal(f, report[f]);
        return nonText.has(f) && (v === '' || v === undefined) ? null : v;
      });
      await client.query(
        `INSERT INTO survey_reports (case_id${fields.length ? ', ' + fields.join(', ') : ''})
         VALUES ($1${fields.map((_, i) => `, $${i + 2}`).join('')})`,
        [caseId, ...values]);

      // ยอดเงินจาก ISURVEY — เก็บไว้ให้หัวหน้าดูอ้างอิงบนเว็บ (ไม่ส่งเข้า EMCS ตามกติกา)
      if (parsed.expenses) {
        const rid = await client.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
        const exp = parsed.expenses;
        const ef = Object.keys(exp);
        await client.query(
          `INSERT INTO survey_expenses (report_id, ${ef.join(', ')})
           VALUES ($1${ef.map((_, i) => `, $${i + 2}`).join('')})`,
          [rid.rows[0].id, ...ef.map((k) => exp[k])]);
      }

      await client.query('COMMIT');
      return { caseId, assignedTo, surveyorCode: parsed.surveyorCode };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async updateReport(caseId: number, data: Record<string, unknown>) {
    const reportResult = await db.query('SELECT id FROM survey_reports WHERE case_id = $1', [caseId]);
    if (reportResult.rows.length === 0) throw new NotFoundError('Report not found');
    const reportId = reportResult.rows[0].id;

    const rd = (data.report_data || data) as Record<string, string>;

    // === 1. Combine time fields ===
    const g = (k: string) => rd[k] || '';
    // acc_time = hour:minute
    if (g('acc_time_hour') || g('acc_time_minute')) {
      rd.acc_time = `${g('acc_time_hour')}:${g('acc_time_minute')}`;
    }
    // Date|HH:MM fields
    const dateTimeFields = [
      { dateKey: 'acc_customer_report_date_val', hourKey: 'acc_customer_report_hour', minKey: 'acc_customer_report_minute', dbCol: 'acc_customer_report_date' },
      { dateKey: 'acc_insurance_notify_date_val', hourKey: 'acc_insurance_notify_hour', minKey: 'acc_insurance_notify_minute', dbCol: 'acc_insurance_notify_date' },
      { dateKey: 'acc_survey_arrive_date_val', hourKey: 'acc_survey_arrive_hour', minKey: 'acc_survey_arrive_minute', dbCol: 'acc_survey_arrive_date' },
      { dateKey: 'acc_survey_complete_date_val', hourKey: 'acc_survey_complete_hour', minKey: 'acc_survey_complete_minute', dbCol: 'acc_survey_complete_date' },
    ];
    for (const f of dateTimeFields) {
      const d = g(f.dateKey), h = g(f.hourKey), m = g(f.minKey);
      if (d) rd[f.dbCol] = h || m ? `${d}|${h}:${m}` : d;
    }
    // Police date + time
    if (g('acc_police_date') || g('acc_police_hour')) {
      const pd = g('acc_police_date'), ph = g('acc_police_hour'), pm = g('acc_police_minute');
      if (pd && (ph || pm)) rd.acc_police_date = `${pd}|${ph}:${pm}`;
    }
    // Followup date + time
    if (g('acc_followup_date') || g('acc_followup_hour')) {
      const fd = g('acc_followup_date'), fh = g('acc_followup_hour'), fm = g('acc_followup_minute');
      if (fd && (fh || fm)) rd.acc_followup_date = `${fd}|${fh}:${fm}`;
    }

    // === 2. Update survey_reports ===
    const colResult = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'survey_reports' AND table_schema = 'public' AND column_name NOT IN ('id', 'case_id', 'created_at')"
    );
    const validCols = new Set(colResult.rows.map((r: { column_name: string }) => r.column_name));

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(rd)) {
      if (validCols.has(key) && val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        // กัน placeholder "-- ระบุ --" จากฟอร์มเว็บ inspector (select ที่ยังไม่เลือก ส่ง label มาเป็นค่า)
        const sv = stripSentinel(val);
        // JSONB คอลัมน์ต้อง stringify (และถือ '' เป็น null) กัน error type mismatch
        params.push(JSONB_FIELDS.has(key) ? (sv === '' ? null : bindVal(key, sv)) : (sv === '' ? null : sv));
      }
    }

    // === 3. Update survey_expenses ===
    const expenseFields = ['service_fee_count','service_fee_price','travel_fee_count','travel_fee_price','photo_fee_count','photo_fee_price','phone_fee','bail_fee','claim_fee_percent','claim_fee_price','daily_record_fee','other_fee_detail','other_fee_price'];
    const hasExpense = expenseFields.some(f => rd[f] !== undefined && rd[f] !== '');

    // ห่อ UPDATE report + DELETE/INSERT expenses ไว้ใน transaction เดียว —
    // เดิมถ้า INSERT expense พัง (เช่นพิมพ์ '1,200' มี comma ลงคอลัมน์ numeric) DELETE จะ commit ไปแล้ว = ข้อมูลค่าบริการหายถาวร
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      let reportUpdated = 0;
      if (fields.length > 0) {
        params.push(reportId);
        await client.query(`UPDATE survey_reports SET ${fields.join(', ')} WHERE id = $${idx}`, params);
        reportUpdated = fields.length;
      }

      if (hasExpense) {
        await client.query('DELETE FROM survey_expenses WHERE report_id = $1', [reportId]);
        const eCols: string[] = ['report_id'];
        const eVals: unknown[] = [reportId];
        for (const f of expenseFields) {
          if (rd[f] !== undefined) {
            eCols.push(f);
            // ตัด comma ออกจากคอลัมน์ตัวเลข (other_fee_detail เป็น text — เว้นไว้) กัน '1,200' ทำ INSERT พัง
            const raw = rd[f];
            const clean = raw === '' ? null : (f === 'other_fee_detail' ? raw : String(raw).replace(/,/g, ''));
            eVals.push(clean);
          }
        }
        const ePlaceholders = eVals.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`INSERT INTO survey_expenses (${eCols.join(', ')}) VALUES (${ePlaceholders})`, eVals);
      }

      await client.query('COMMIT');
      return { message: 'Report updated', report_fields: reportUpdated, expense_saved: hasExpense };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // จำนวนงานที่ "ถืออยู่" ของแต่ละพนักงานสำรวจ (assigned/surveyed = ยังไม่ปิด) — ใช้เรียงคิวบอร์ดเข้างาน
  async activeWorkload() {
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.code, COUNT(c.id)::int AS active
         FROM users u
         LEFT JOIN cases c ON c.assigned_to = u.id AND c.status IN ('assigned','surveyed')
        WHERE u.role = 'surveyor'
        GROUP BY u.id, u.code`
    );
    return rows;
  },

  async getStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'assigned') AS assigned,
        COUNT(*) FILTER (WHERE status = 'surveyed') AS surveyed,
        COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed,
        COUNT(*) AS total
      FROM cases
    `);
    const recentResult = await db.query(
      `SELECT c.*, u.first_name AS surveyor_first_name, u.last_name AS surveyor_last_name,
              sr.claim_no, sr.survey_job_no, sr.claim_ref_no,
              ROW_NUMBER() OVER (PARTITION BY sr.claim_no ORDER BY c.created_at) AS visit_count
       FROM cases c LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN survey_reports sr ON sr.case_id = c.id
       ORDER BY c.created_at DESC LIMIT 10`
    );
    return { counts: result.rows[0], recent: recentResult.rows };
  },

  // รายการเคสทั้งหมด (callcenter) — มี filter สถานะ + ค้นหา + แบ่งหน้า
  async list(filters: { status?: string; search?: string; page?: number; limit?: number } = {}) {
    const { status, search, page = 1, limit = 20 } = filters;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`c.status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(c.customer_name ILIKE $${idx} OR c.incident_location ILIKE $${idx} OR sr.claim_no ILIKE $${idx} OR sr.survey_job_no ILIKE $${idx} OR sr.claim_ref_no ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT c.*, u.first_name AS surveyor_first_name, u.last_name AS surveyor_last_name,
                sr.claim_no, sr.survey_job_no, sr.claim_ref_no,
                ROW_NUMBER() OVER (PARTITION BY sr.claim_no ORDER BY c.created_at) AS visit_count
         FROM cases c
         LEFT JOIN users u ON c.assigned_to = u.id
         LEFT JOIN survey_reports sr ON sr.case_id = c.id
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM cases c LEFT JOIN survey_reports sr ON sr.case_id = c.id ${where}`,
        params
      ),
    ]);

    return {
      cases: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    };
  },
};
