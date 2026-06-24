import { Router } from 'express';
import { z } from 'zod';
import { leaveController } from '../controllers/leave.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ต้องเป็นรูปแบบ YYYY-MM-DD');

const createSchema = z
  .object({
    leave_type: z.enum(['sick', 'personal', 'vacation', 'other']),
    start_date: dateStr,
    end_date: dateStr,
    reason: z.string().max(1000).optional(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม',
    path: ['end_date'],
  });

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  review_note: z.string().max(1000).optional(),
});

// พนักงาน (ทุก role ที่ล็อกอิน) ยื่น/ดูใบลาของตนเอง
router.post('/', auth, validate(createSchema), leaveController.create);
router.get('/mine', auth, leaveController.mine);

// อนุมัติใบลา = admin เท่านั้น (ตัดสินใจ 2026-06-24) — callcenter ไม่มีสิทธิ์ดู/อนุมัติ
router.get('/', auth, requireRole('admin'), leaveController.list);
router.patch('/:id/review', auth, requireRole('admin'), validate(reviewSchema), leaveController.review);

export default router;
