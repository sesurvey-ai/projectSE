import { Request, Response } from 'express';
import { leaveService } from '../services/leave.service';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const leaveController = {
  // พนักงานยื่นใบลา
  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await leaveService.create(req.user!.id, req.body);
    sendSuccess(res, row, 201);
  }),

  // ใบลาของฉัน
  mine: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { requests: await leaveService.listMine(req.user!.id) });
  }),

  // ทั้งหมด (admin/callcenter)
  list: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { requests: await leaveService.listAll(req.query as Record<string, unknown>) });
  }),

  // ใบลาอนุมัติแล้วที่ครอบคลุมวันที่ระบุ (บอร์ดเข้างาน) — admin + callcenter, เผยแค่ code/ประเภท/วัน
  active: asyncHandler(async (req: Request, res: Response) => {
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendError(res, 'ต้องระบุ date=YYYY-MM-DD', 400);
      return;
    }
    sendSuccess(res, { requests: await leaveService.activeOn(date) });
  }),

  // อนุมัติ/ไม่อนุมัติ
  review: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 'invalid id', 400);
      return;
    }
    const updated = await leaveService.review(id, req.user!.id, req.body.status, req.body.review_note);
    if (!updated) {
      sendError(res, 'ไม่พบใบลานี้', 404);
      return;
    }
    sendSuccess(res, updated);
  }),
};
