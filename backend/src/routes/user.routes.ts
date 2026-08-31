import { Router } from 'express';
import { z } from 'zod';
import { userController } from '../controllers/user.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const fcmTokenSchema = z.object({
  fcm_token: z.string().min(1, 'FCM token is required'),
});

const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  request_id: z.string().optional(),
});

// ต้องอยู่ก่อน '/me' ไม่จำเป็น (คนละ path) แต่วางคู่กันให้อ่านง่าย
// ความพร้อมรับแจ้งเตือนของผู้สำรวจทั้งทีม — ออฟฟิศเท่านั้น
router.get('/notification-readiness', auth, requireRole('callcenter', 'admin'), userController.notificationReadiness);
router.get('/me', auth, userController.getMe);
router.put('/me/fcm-token', auth, validate(fcmTokenSchema), userController.updateFcmToken);
router.post('/me/location', auth, validate(locationSchema), userController.updateLocation);
router.delete('/me/location', auth, userController.clearLocation);

export default router;
