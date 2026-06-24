import { Router } from 'express';
import { z } from 'zod';
import { dutyController } from '../controllers/duty.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

// ── ตารางเวรราย เดือน/ศูนย์ (กริด JSONB จากหน้าจัดเวร duty-demo2) ──
// data = { staff:[{id,code,name}], schedule:{ staffId:{ day:shiftKey } } }
const scheduleSchema = z.object({
  center_id: z.string().min(1).max(40),
  year: z.number().int().min(2000).max(3000),
  month: z.number().int().min(1).max(12),
  data: z.object({
    staff: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
    schedule: z.record(z.record(z.string())),
  }),
});
router.get('/schedules', auth, requireRole('admin', 'callcenter'), dutyController.schedules);
router.put('/schedule', auth, requireRole('admin', 'callcenter'), validate(scheduleSchema), dutyController.saveSchedule);

export default router;
