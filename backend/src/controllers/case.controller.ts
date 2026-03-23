import { Request, Response } from 'express';
import { caseService } from '../services/case.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const caseController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const result = await caseService.create(req.body, req.user!.id);
    sendSuccess(res, result, 201);
  }),

  getMyCases: asyncHandler(async (req: Request, res: Response) => {
    const cases = await caseService.getMyCases(req.user!.id);
    sendSuccess(res, cases);
  }),

  assign: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const { surveyor_id } = req.body;
    const result = await caseService.assign(caseId, surveyor_id);
    sendSuccess(res, result);
  }),

  submitSurvey: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.submitSurvey(caseId, req.user!.id, req.body);
    sendSuccess(res, result);
  }),

  getCase: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.getById(caseId);
    sendSuccess(res, result);
  }),

  getForReview: asyncHandler(async (_req: Request, res: Response) => {
    const cases = await caseService.getForReview();
    sendSuccess(res, cases);
  }),

  getDetail: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const detail = await caseService.getDetail(caseId);
    sendSuccess(res, detail);
  }),

  updateReport: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.updateReport(caseId, req.body);
    sendSuccess(res, result);
  }),

  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await caseService.getStats();
    sendSuccess(res, stats);
  }),
};
