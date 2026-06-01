import { Router } from 'express';
import { z } from 'zod';
import { consultController } from '../controllers/consult.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const syncSchema = z.object({
  items: z
    .array(
      z.object({
        device_call_id: z.string(),
        number: z.string(),
        started_at: z.union([z.number(), z.string()]),
        duration_sec: z.number().int().nonnegative().default(0),
        status: z.string(),
      })
    )
    .max(1000),
});

router.get('/supervisors', auth, requireRole('surveyor'), consultController.supervisors);
router.post('/sync', auth, requireRole('surveyor'), validate(syncSchema), consultController.sync);
router.get('/report', auth, requireRole('admin', 'callcenter'), consultController.report);

export default router;
