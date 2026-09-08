import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { sendCapture } from '../services/sebilling.service';
import { isurveyPullService } from '../services/isurveyPull.service';
import { db } from '../config/database';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const reviewController = {
  submitReview: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await reviewService.submitReview(caseId, req.user!.id, req.body);
    sendSuccess(res, result);
  }),

  // ปลดล็อกเคสที่อนุมัติแล้ว — แอดมินเท่านั้น (บังคับที่ route) · ปลดแล้วต้องอนุมัติใหม่
  /** ส่ง/ส่งซ้ำเข้า se-billing — เฉพาะเคสที่อนุมัติแล้ว (ยอดล็อก) ใช้กับงานที่อนุมัติก่อนมีท่อ
   *  หรือรอบที่ส่งไม่สำเร็จ · ผลคืนเป็น BillingResult ไม่ใช่ error (หน้าจอโชว์ข้อความเอง) */
  /** ปิดงานบน ISURVEY (ยืนยันการตรวจสอบ) เอง/ลองใหม่ — เคสจาก ISURVEY ที่อนุมัติแล้ว · body.dry_run = ทดลองไม่ยิง (08/09/69) */
  closeIsurvey: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const dryRun = Boolean(req.body?.dry_run);
    sendSuccess(res, await isurveyPullService.closeCase(caseId, req.user!.id, { dryRun, force: true }));
  }),

  resendBilling: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const c = await db.query('SELECT status FROM cases WHERE id = $1', [caseId]);
    if (c.rows.length === 0) throw new NotFoundError('Case not found');
    if (c.rows[0].status !== 'reviewed') throw new ForbiddenError('ส่งเข้า se-billing ได้เฉพาะเคสที่อนุมัติแล้ว');
    sendSuccess(res, await sendCapture(caseId));
  }),

  unlock: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const result = await reviewService.unlock(caseId, req.user!.id, reason);
    sendSuccess(res, result);
  }),
};
