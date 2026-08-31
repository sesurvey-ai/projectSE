import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { locationService } from '../services/location.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { getIO } from '../socket';
import { db } from '../config/database';
import { clearSurveyorLocation } from '../utils/clearSurveyorLocation';
import { provinceOf } from '../services/geoProvince';

export const userController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.user!.id);
    sendSuccess(res, user);
  }),

  updateFcmToken: asyncHandler(async (req: Request, res: Response) => {
    const { fcm_token } = req.body;
    await userService.updateFcmToken(req.user!.id, fcm_token);
    sendSuccess(res, { message: 'FCM token updated' });
  }),

  /** ใครรับแจ้งเตือนงานใหม่ได้บ้าง — ออฟฟิศใช้ไล่ตามคนที่ยังไม่พร้อม */
  notificationReadiness: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await userService.notificationReadiness());
  }),

  updateLocation: asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude, request_id } = req.body;
    const userId = req.user!.id;

    // บันทึกลง DB
    await locationService.saveLocation(userId, latitude, longitude, request_id);

    // ดึงชื่อ user
    const userResult = await db.query('SELECT username, first_name, last_name, code FROM users WHERE id = $1', [userId]);
    const userInfo = userResult.rows[0] || {};

    // ส่ง location_update ไปหา Call Center ผ่าน Socket.IO
    const io = getIO();
    if (io) {
      io.to('role:callcenter').emit('location_update', {
        user_id: String(userId),
        username: userInfo.username,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
        // รหัสพนักงาน — คนจ่ายงานใช้ระบุตัวคนได้แน่กว่าชื่อ (ชื่อซ้ำกันได้)
        code: userInfo.code ?? null,
        // จังหวัดที่พิกัดนี้อยู่ — ต้องส่งมาด้วย ไม่งั้นคนที่เพิ่งรายงานสด
        // จะหลุดจากกลุ่ม "อยู่ในจังหวัดที่เกิดเหตุ" บนหน้าจ่ายงาน
        province: provinceOf(latitude, longitude),
        latitude,
        longitude,
        request_id: request_id || null,
      });
    }

    sendSuccess(res, { message: 'Location updated' });
  }),

  // เคลียร์พิกัดของตัวเอง (เรียกตอนออกจากระบบ) → หมุดหายจากแผนที่ Call Center
  clearLocation: asyncHandler(async (req: Request, res: Response) => {
    await clearSurveyorLocation(req.user!.id);
    sendSuccess(res, { message: 'Location cleared' });
  }),
};
