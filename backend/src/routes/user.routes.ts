import { Router } from 'express';
import { z } from 'zod';
import { userController } from '../controllers/user.controller';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const fcmTokenSchema = z.object({
  fcm_token: z.string().min(1, 'FCM token is required'),
});

router.get('/me', auth, userController.getMe);
router.put('/me/fcm-token', auth, validate(fcmTokenSchema), userController.updateFcmToken);

export default router;
