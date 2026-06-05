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

  // ── อาสา (surveyor) ──
  submitVolunteer: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dutyService.submitVolunteer(req.user!.id, req.body.start_time, req.body.end_time, req.body.date));
  }),

  myVolunteers: asyncHandler(async (req: Request, res: Response) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    sendSuccess(res, await dutyService.myVolunteers(req.user!.id, date));
  }),

  cancelVolunteer: asyncHandler(async (req: Request, res: Response) => {
    const ok = await dutyService.cancelVolunteer(req.user!.id, Number(req.params.id));
    if (!ok) { sendError(res, 'ไม่พบรายการอาสา', 404); return; }
    sendSuccess(res, { message: 'ยกเลิกอาสาแล้ว' });
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

  // ── ตารางเวรราย เดือน/ศูนย์ (กริด JSONB) ──
  schedules: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dutyService.getSchedules(Number(req.query.y), Number(req.query.m)));
  }),

  saveSchedule: asyncHandler(async (req: Request, res: Response) => {
    const { center_id, year, month, data } = req.body;
    sendSuccess(res, await dutyService.saveSchedule(center_id, year, month, data, req.user!.id));
  }),
};
