import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// กัน brute-force/credential-stuffing — จำกัด 10 ครั้ง/15 นาที ต่อ (IP + username)
// keying ด้วย username ด้วย เพราะหลังพร็อกซี IP อาจซ้ำกันหลายคน (ไม่งั้นคนเดียวล็อกทั้งออฟฟิศ)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  keyFn: (req) => `${req.ip || 'unknown'}|${String(req.body?.username || '').toLowerCase()}`,
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);

export default router;
