import { Router } from 'express';
import { z } from 'zod';
import { caseController } from '../controllers/case.controller';
import { reviewController } from '../controllers/review.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const createCaseSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  incident_location: z.string().min(1, 'Incident location is required'),
  incident_lat: z.number().optional(),
  incident_lng: z.number().optional(),
});

const assignCaseSchema = z.object({
  surveyor_id: z.number().int().positive(),
});

const submitSurveySchema = z.object({
  car_model: z.string().optional(),
  car_color: z.string().optional(),
  license_plate: z.string().optional(),
  notes: z.string().optional(),
  photo_paths: z.array(z.string()).default([]),
});

const submitReviewSchema = z.object({
  comment: z.string().optional(),
  proposed_fee: z.number().optional(),
  approved_fee: z.number().optional(),
});

router.post('/', auth, requireRole('callcenter'), validate(createCaseSchema), caseController.create);
router.get('/my', auth, requireRole('surveyor'), caseController.getMyCases);
router.get('/review', auth, requireRole('checker'), caseController.getForReview);
router.get('/:id', auth, requireRole('callcenter', 'checker'), caseController.getCase);
router.get('/:id/detail', auth, requireRole('checker'), caseController.getDetail);
router.post('/:id/assign', auth, requireRole('callcenter'), validate(assignCaseSchema), caseController.assign);
router.post('/:id/survey', auth, requireRole('surveyor'), validate(submitSurveySchema), caseController.submitSurvey);
router.post('/:id/review', auth, requireRole('checker'), validate(submitReviewSchema), reviewController.submitReview);

export default router;
