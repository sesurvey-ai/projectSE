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
};
