import { Router } from 'express';
import { z } from 'zod';
import { adminController } from '../controllers/admin.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

// All admin routes require admin role
router.use(auth, requireRole('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Users CRUD
const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.enum(['admin', 'surveyor', 'callcenter', 'checker']),
  supervisor_id: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: z.enum(['admin', 'surveyor', 'callcenter', 'checker']).optional(),
  supervisor_id: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.post('/users', validate(createUserSchema), adminController.createUser);
router.put('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Cases CRUD
const updateCaseSchema = z.object({
  customer_name: z.string().min(1).optional(),
  incident_location: z.string().min(1).optional(),
  status: z.enum(['pending', 'assigned', 'surveyed', 'reviewed']).optional(),
  assigned_to: z.number().int().positive().nullable().optional(),
});

router.get('/cases', adminController.getCases);
router.get('/cases/:id', adminController.getCaseById);
router.put('/cases/:id', validate(updateCaseSchema), adminController.updateCase);
router.delete('/cases/:id', adminController.deleteCase);

// Reviews CRUD
const updateReviewSchema = z.object({
  comment: z.string().optional(),
  proposed_fee: z.number().optional(),
  approved_fee: z.number().optional(),
  status: z.enum(['pending', 'approved']).optional(),
});

router.get('/reviews', adminController.getReviews);
router.put('/reviews/:id', validate(updateReviewSchema), adminController.updateReview);
router.delete('/reviews/:id', adminController.deleteReview);

export default router;
