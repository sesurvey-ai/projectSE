import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { auth } from '../middleware/auth';
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

/**
 * เปลี่ยนรหัสผ่านของตัวเอง
 * ตรวจความแข็งแรงที่ service (password.ts) ที่เดียว — zod เช็คแค่ "มีค่าส่งมาไหม"
 * ไม่งั้นกติกาจะกระจาย 2 ที่แล้วเพี้ยนกัน (เช่นแก้ความยาวขั้นต่ำแล้วลืมแก้อีกที่)
 */
const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'กรุณากรอกรหัสผ่านเดิม'),
  new_password: z.string().min(1, 'กรุณากรอกรหัสผ่านใหม่'),
});

/**
 * จำกัดความถี่ด้วย — ช่องนี้เฉลยว่า "รหัสเดิมถูกไหม" คนที่นั่งหน้าจอที่เปิดค้างไว้
 * จึงเดารหัสเดิมรัวได้ถ้าไม่กั้น (คีย์ด้วย user ไม่ใช่ IP เพราะทั้งออฟฟิศออกไอพีเดียวกัน)
 */
const changePwLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'เปลี่ยนรหัสผ่านบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  keyFn: (req) => `chpw|${req.user?.id ?? req.ip ?? 'unknown'}`,
});

router.post('/change-password', auth, changePwLimiter,
  validate(changePasswordSchema), authController.changePassword);

export default router;
