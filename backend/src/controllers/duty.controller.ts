import { Request, Response } from 'express';
import { dutyService } from '../services/duty.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const dutyController = {
  // ── ตารางเวรราย เดือน/ศูนย์ (กริด JSONB) ──
  schedules: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dutyService.getSchedules(Number(req.query.y), Number(req.query.m)));
  }),

  saveSchedule: asyncHandler(async (req: Request, res: Response) => {
    const { center_id, year, month, data, expected_updated_at } = req.body;
    sendSuccess(res, await dutyService.saveSchedule(center_id, year, month, data, req.user!.id, expected_updated_at));
  }),
};
