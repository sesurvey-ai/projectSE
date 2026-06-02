import { Request, Response } from 'express';
import { attendanceService } from '../services/attendance.service';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

// แปลงค่าจาก multipart (เป็น string) -> number | null
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const attendanceController = {
  // ลงเวลาเข้างาน — รับ multipart: photo (ไฟล์) + lat/lng (string)
  // เปิดรอบใหม่ได้ก็ต่อเมื่อไม่มีรอบที่ยังไม่ลงเวลาออกค้างอยู่
  checkIn: asyncHandler(async (req: Request, res: Response) => {
    const lat = toNum(req.body?.lat);
    const lng = toNum(req.body?.lng);
    const photo = (req.file as Express.Multer.File | undefined)?.filename ?? null;
    const row = await attendanceService.checkIn(req.user!.id, lat, lng, photo);
    if (!row) {
      sendError(res, 'คุณยังมีรอบที่ยังไม่ได้ลงเวลาออก กรุณาลงเวลาออกก่อนจึงจะลงเวลาเข้าใหม่ได้', 400);
      return;
    }
    sendSuccess(res, row);
  }),

  // ลงเวลาออกงาน
  checkOut: asyncHandler(async (req: Request, res: Response) => {
    const lat = typeof req.body?.lat === 'number' ? req.body.lat : null;
    const lng = typeof req.body?.lng === 'number' ? req.body.lng : null;
    const row = await attendanceService.checkOut(req.user!.id, lat, lng);
    if (!row) {
      sendError(res, 'ยังไม่มีรอบที่ลงเวลาเข้าค้างอยู่', 400);
      return;
    }
    sendSuccess(res, row);
  }),

  // สถานะวันนี้ — { sessions: [...รอบของวันนี้], open: รอบที่เปิดค้าง|null }
  today: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await attendanceService.today(req.user!.id));
  }),

  // ประวัติของฉัน
  mine: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { records: await attendanceService.listMine(req.user!.id) });
  }),

  // รายงาน (admin/callcenter)
  report: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await attendanceService.report(req.query as Record<string, unknown>));
  }),
};
