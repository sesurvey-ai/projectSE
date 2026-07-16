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
