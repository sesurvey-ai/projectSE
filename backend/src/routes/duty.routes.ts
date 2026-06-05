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

// อาสา (surveyor แจ้งเอง) — แจ้งช่วงเวลา ที่จุดตัวเอง ขึ้นตารางทันที
const volunteerSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'เวลาเริ่มต้องเป็น HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'เวลาสิ้นสุดต้องเป็น HH:MM'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
router.post('/volunteer', auth, requireRole('surveyor'), validate(volunteerSchema), dutyController.submitVolunteer);
router.get('/volunteer/mine', auth, requireRole('surveyor'), dutyController.myVolunteers);
router.delete('/volunteer/:id', auth, requireRole('surveyor'), dutyController.cancelVolunteer);
router.post('/slots', auth, requireRole('admin'), validate(slotSchema), dutyController.createSlot);
router.put('/slots/:id', auth, requireRole('admin'), validate(slotSchema), dutyController.updateSlot);
router.delete('/slots/:id', auth, requireRole('admin'), dutyController.deleteSlot);

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
