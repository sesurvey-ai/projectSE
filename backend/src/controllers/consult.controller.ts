import { Request, Response } from 'express';
import { consultService } from '../services/consult.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const consultController = {
  // หัวหน้าของพนักงานคนนี้ + เบอร์ (ให้แอปใช้เป็น whitelist)
  supervisors: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { supervisors: await consultService.supervisorsFor(req.user!.id) });
  }),

  // อัปโหลด call log ที่กรองเบอร์หัวหน้าแล้ว
  sync: asyncHandler(async (req: Request, res: Response) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    sendSuccess(res, await consultService.sync(req.user!.id, items));
  }),

  // รีพอร์ตสำหรับหัวหน้า/แอดมิน (group_by = supervisor | staff | day | week)
  report: asyncHandler(async (req: Request, res: Response) => {
    const g = String(req.query.group_by || 'supervisor');
    sendSuccess(res, await consultService.report(g, req.query as Record<string, unknown>));
  }),
};
