import { Router } from 'express';
import { z } from 'zod';
import { locationController } from '../controllers/location.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const respondSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  request_id: z.string().optional(),
});

router.post('/respond', auth, requireRole('surveyor'), validate(respondSchema), locationController.respond);
router.get('/latest', auth, requireRole('callcenter'), locationController.getLatest);

export default router;
