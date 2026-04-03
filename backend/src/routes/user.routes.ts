import { Router } from 'express';
import { z } from 'zod';
import { userController } from '../controllers/user.controller';
import { auth } from '../middleware/auth';
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

router.get('/me', auth, userController.getMe);
router.put('/me/fcm-token', auth, validate(fcmTokenSchema), userController.updateFcmToken);
router.post('/me/location', auth, validate(locationSchema), userController.updateLocation);

export default router;
