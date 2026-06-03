import { Router } from 'express';
import { z } from 'zod';
import { dutyController } from '../controllers/duty.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

// สล๊อตเวรประจำจุด: kind='rotate' (เวร1-3 หมุน) ต้องมี rotate_offset 0-2;
//                  kind='fix' ต้องมี fixed_shift (fix1|fix2)
const slotSchema = z
  .object({
    station_id: z.number().int(),
    kind: z.enum(['rotate', 'fix']),
    rotate_offset: z.number().int().min(0).max(2).nullable().optional(),
    fixed_shift: z.enum(['fix1', 'fix2']).nullable().optional(),
    user_id: z.number().int().nullable().optional(),
    weekly_off: z.number().int().min(0).max(6).nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((d) => (d.kind === 'rotate' ? d.rotate_offset != null : d.fixed_shift != null), {
    message: 'rotate ต้องระบุ rotate_offset (0-2), fix ต้องระบุ fixed_shift (fix1/fix2)',
  });

// อ่าน: admin + callcenter — เขียน/แก้/ลบ: admin
router.get('/stations', auth, requireRole('admin', 'callcenter'), dutyController.stations);
router.get('/shifts', auth, requireRole('admin', 'callcenter'), dutyController.shifts);
router.get('/surveyors', auth, requireRole('admin'), dutyController.surveyors);
router.get('/slots', auth, requireRole('admin', 'callcenter'), dutyController.slots);
router.get('/roster', auth, requireRole('admin', 'callcenter'), dutyController.roster);
router.post('/slots', auth, requireRole('admin'), validate(slotSchema), dutyController.createSlot);
router.put('/slots/:id', auth, requireRole('admin'), validate(slotSchema), dutyController.updateSlot);
router.delete('/slots/:id', auth, requireRole('admin'), dutyController.deleteSlot);

export default router;
