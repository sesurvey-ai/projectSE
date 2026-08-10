import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../middleware/errorHandler';
import { env } from '../config/env';
import { caseService } from '../services/case.service';

// ── routes สำหรับเครื่องมือภายใน (se-autokey) — auth ด้วย service token ไม่ผูกบัญชีพนักงาน ──
// เปิดใช้โดยตั้ง env INTEGRATION_TOKEN (ยาว ≥24 ตัว); ไม่ตั้ง = ทุก route ตอบ 401
// ขอบเขตจงใจให้แคบ: อ่าน XML ของเคสอย่างเดียว (ไว้ import เข้า EMCS) — ห้ามเอา token นี้ไป
// เปิด route เขียนข้อมูล

const router = Router();

const integrationAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const expected = env.INTEGRATION_TOKEN;
  if (!expected) throw new UnauthorizedError('Integration disabled (INTEGRATION_TOKEN not set)');
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  // timingSafeEqual ต้อง length เท่ากัน — เทียบ length ก่อน (length ไม่ใช่ความลับ)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError('Invalid integration token');
  }
  next();
};

// XML สำหรับ import เข้า EMCS — เนื้อหาเดียวกับ GET /api/cases/:id/export-xml (ฝั่ง user)
router.get('/cases/:id/export-xml', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id as string);
  const xml = await caseService.getSurveyXml(caseId); // ไม่ส่ง user = ไม่จำกัดเจ้าของ (เทียบเท่า admin)
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="survey_${caseId}.xml"`);
  res.send(xml);
}));

// รายการเคสที่พร้อมนำเข้า EMCS (สำรวจแล้ว/ตรวจสอบแล้ว) — webui ของ SE-AutoKey ใช้โชว์ลิสต์ให้เลือก
router.get('/cases', integrationAuth, asyncHandler(async (_req: Request, res: Response) => {
  const { db } = await import('../config/database');
  const r = await db.query(
    `SELECT c.id, c.status, sr.claim_no, sr.survey_job_no, sr.insurance_company,
            (u.first_name || ' ' || u.last_name) AS surveyor_name,
            to_char(c.emcs_imported_at, 'YYYY-MM-DD HH24:MI') AS emcs_imported_at,
            c.created_at
       FROM cases c
       LEFT JOIN survey_reports sr ON sr.case_id = c.id
       LEFT JOIN users u ON u.id = c.assigned_to
      WHERE c.status IN ('surveyed', 'reviewed')
      ORDER BY c.created_at DESC
      LIMIT 100`
  );
  res.json({ success: true, data: { cases: r.rows } });
}));

// meta ของเคสเดียว (บริษัทประกัน/เลขต่าง ๆ + สถานะนำเข้า) — SE-AutoKey ใช้ resolve รหัสบริษัท
// และ "เช็คกันซ้ำก่อนเริ่ม" (emcs_imported_at ไม่ null = ห้าม import อีก — EMCS สร้างเรื่องซ้ำ)
router.get('/cases/:id', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id as string);
  const { db } = await import('../config/database');
  const r = await db.query(
    `SELECT c.id, c.status, sr.claim_no, sr.survey_job_no, sr.insurance_company, sr.insurance_branch,
            to_char(c.emcs_imported_at, 'YYYY-MM-DD HH24:MI') AS emcs_imported_at, c.emcs_esurvey_no
       FROM cases c LEFT JOIN survey_reports sr ON sr.case_id = c.id
      WHERE c.id = $1`, [caseId]
  );
  if (r.rows.length === 0) { res.status(404).json({ success: false, message: 'case not found' }); return; }
  res.json({ success: true, data: r.rows[0] });
}));

// SE-AutoKey แจ้งว่า import เข้า EMCS สำเร็จแล้ว → mark ถาวร (กันกดซ้ำทุกช่องทาง)
// atomic: WHERE emcs_imported_at IS NULL — สองงานแข่งกัน คนที่สองได้ already=true
router.post('/cases/:id/emcs-imported', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id as string);
  const esurveyNo = String((req.body?.esurvey_no ?? '')).slice(0, 50) || null;
  const { db } = await import('../config/database');
  const r = await db.query(
    `UPDATE cases SET emcs_imported_at = NOW() AT TIME ZONE 'Asia/Bangkok', emcs_esurvey_no = COALESCE($2, emcs_esurvey_no)
      WHERE id = $1 AND emcs_imported_at IS NULL
      RETURNING id`, [caseId, esurveyNo]
  );
  if (r.rowCount === 0) {
    const cur = await db.query(
      `SELECT to_char(emcs_imported_at, 'YYYY-MM-DD HH24:MI') AS at, emcs_esurvey_no FROM cases WHERE id = $1`, [caseId]);
    if (cur.rows.length === 0) { res.status(404).json({ success: false, message: 'case not found' }); return; }
    res.json({ success: true, data: { already: true, ...cur.rows[0] } });
    return;
  }
  res.json({ success: true, data: { already: false } });
}));

// SE-AutoKey รายงานสถานะที่อ่านได้จากหน้ารายการ EMCS กลับมา
// แยกจาก emcs-imported โดยตั้งใจ: "สร้าง draft แล้ว" ≠ "ส่งงานให้ประกันแล้ว"
// (บอทไม่กดปุ่มส่งเอง คนกด แล้วค่อยสั่งบอทมาตรวจสถานะ)
//
// body: { status_text: string, submitted: boolean|null, esurvey_no?: string }
//   submitted=true  → บันทึกเวลาส่ง (ครั้งแรกเท่านั้น ไม่ทับของเดิม)
//   submitted=false → ยังเป็น draft
//   submitted=null  → อ่านสถานะไม่ได้/แยกเรื่องไม่ออก → เก็บแค่ข้อความ ไม่สรุปอะไร
router.post('/cases/:id/emcs-status', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id as string);
  const statusText = String(req.body?.status_text ?? '').slice(0, 100) || null;
  const submitted = req.body?.submitted === true ? true : req.body?.submitted === false ? false : null;
  const esurveyNo = String(req.body?.esurvey_no ?? '').slice(0, 50) || null;
  const { db } = await import('../config/database');
  const r = await db.query(
    `UPDATE cases
        SET emcs_status_text = COALESCE($2, emcs_status_text),
            emcs_status_checked_at = NOW() AT TIME ZONE 'Asia/Bangkok',
            emcs_esurvey_no = COALESCE($4, emcs_esurvey_no),
            -- ครั้งแรกที่ยืนยันว่าส่งแล้วเท่านั้น — ตรวจซ้ำทีหลังห้ามเลื่อนเวลา
            emcs_submitted_at = CASE WHEN $3::boolean IS TRUE AND emcs_submitted_at IS NULL
                                     THEN NOW() AT TIME ZONE 'Asia/Bangkok'
                                     ELSE emcs_submitted_at END
      WHERE id = $1
      RETURNING to_char(emcs_submitted_at, 'YYYY-MM-DD HH24:MI') AS submitted_at, emcs_status_text`,
    [caseId, statusText, submitted, esurveyNo]
  );
  if (r.rowCount === 0) { res.status(404).json({ success: false, message: 'case not found' }); return; }
  res.json({ success: true, data: r.rows[0] });
}));

// ข้อมูลรายงานสำรวจ (ค่าไทย) ของเคส — SE-AutoKey ใช้เติม ClaimData ให้ fill_* กรอกหน้าหลัก EMCS
// (fuzzy_select ต้องการชื่อไทย เช่น จังหวัด/ยี่ห้อ/ประเภทรถ — ต่างจาก XML ที่เป็นรหัส EMCS)
router.get('/cases/:id/report', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id as string);
  const { db } = await import('../config/database');
  const r = await db.query('SELECT * FROM survey_reports WHERE case_id = $1', [caseId]);
  if (r.rows.length === 0) { res.status(404).json({ success: false, message: 'report not found' }); return; }
  res.json({ success: true, data: r.rows[0] });
}));

// รายการรูปของเคส (survey_photos ที่ผูกกับ report) — SE-AutoKey ใช้โหลดไปอัปเข้า EMCS
router.get('/cases/:id/photos', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id as string);
  const { db } = await import('../config/database');
  const r = await db.query(
    `SELECT sp.file_path, sp.category FROM survey_photos sp
       JOIN survey_reports sr ON sp.report_id = sr.id
      WHERE sr.case_id = $1 ORDER BY sp.id`, [caseId]
  );
  res.json({ success: true, data: { photos: r.rows } });
}));

// stream ไฟล์รูปตาม file_path จากรายการข้างบน — containment ใน UPLOAD_DIR เท่านั้น
router.get('/files', integrationAuth, asyncHandler(async (req: Request, res: Response) => {
  const rel = String(req.query.path ?? '');
  const pathMod = await import('path');
  const fs = await import('fs');
  const uploadRoot = pathMod.default.resolve(env.UPLOAD_DIR);
  const full = pathMod.default.resolve(uploadRoot, rel);
  // กัน path traversal — path จาก query ต้องอยู่ใต้ uploads เสมอ
  if (full !== uploadRoot && !full.startsWith(uploadRoot + pathMod.default.sep)) {
    res.status(400).json({ success: false, message: 'invalid path' });
    return;
  }
  if (!fs.default.existsSync(full) || !fs.default.statSync(full).isFile()) {
    res.status(404).json({ success: false, message: 'file not found' });
    return;
  }
  res.sendFile(full);
}));

export default router;
