import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import caseRoutes from './case.routes';
import locationRoutes from './location.routes';
import uploadRoutes from './upload.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/cases', caseRoutes);
router.use('/locations', locationRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);

export default router;
