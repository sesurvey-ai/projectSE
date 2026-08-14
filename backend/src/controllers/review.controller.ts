import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const reviewController = {
  submitReview: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await reviewService.submitReview(caseId, req.user!.id, req.body);
    sendSuccess(res, result);
  }),

  // ปลดล็อกเคสที่อนุมัติแล้ว — แอดมินเท่านั้น (บังคับที่ route) · ปลดแล้วต้องอนุมัติใหม่
  unlock: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const result = await reviewService.unlock(caseId, req.user!.id, reason);
    sendSuccess(res, result);
  }),
};
