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

  updateSurvey: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.updateSurvey(caseId, req.user!.id, req.body);
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

  uploadCaseFolder: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const folder = req.body?.folder || '';
    const files = req.files as Express.Multer.File[];
    const result = await caseService.uploadCaseFolder(caseId, folder, files || []);
    sendSuccess(res, result);
  }),

  createCaseFolder: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.createCaseFolder(caseId);
    sendSuccess(res, result);
  }),

  declineCase: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.declineCase(caseId, req.user!.id);
    sendSuccess(res, result);
  }),

  confirmArrival: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const { photo_path } = req.body;
    const result = await caseService.confirmArrival(caseId, req.user!.id, photo_path);
    sendSuccess(res, result);
  }),

  getArrivalPhotos: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const photos = await caseService.getArrivalPhotos(caseId);
    sendSuccess(res, photos);
  }),

  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await caseService.getStats();
    sendSuccess(res, stats);
  }),
};
