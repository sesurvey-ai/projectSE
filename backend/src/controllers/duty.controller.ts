import { Request, Response } from 'express';
import { dutyService } from '../services/duty.service';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const dutyController = {
  stations: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await dutyService.listStations());
  }),

  shifts: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await dutyService.listShifts());
  }),

  surveyors: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await dutyService.listSurveyors());
  }),

  slots: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await dutyService.listSlots());
  }),

  // ตารางเวร live ของวันหนึ่ง (?date=YYYY-MM-DD, ดีฟอลต์ = วันนี้ เวลาไทย)
  roster: asyncHandler(async (req: Request, res: Response) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    sendSuccess(res, await dutyService.roster(date));
  }),

  createSlot: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dutyService.createSlot(req.body));
  }),

  updateSlot: asyncHandler(async (req: Request, res: Response) => {
    const row = await dutyService.updateSlot(Number(req.params.id), req.body);
    if (!row) {
      sendError(res, 'ไม่พบสล๊อตนี้', 404);
      return;
    }
    sendSuccess(res, row);
  }),

  deleteSlot: asyncHandler(async (req: Request, res: Response) => {
    await dutyService.deleteSlot(Number(req.params.id));
    sendSuccess(res, { message: 'ลบสล๊อตแล้ว' });
  }),
};
