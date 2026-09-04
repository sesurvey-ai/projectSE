import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import caseRoutes from './case.routes';
import locationRoutes from './location.routes';
import uploadRoutes from './upload.routes';
import adminRoutes from './admin.routes';
import ocrRoutes from './ocr.routes';
import consultRoutes from './consult.routes';
import leaveRoutes from './leave.routes';
import attendanceRoutes from './attendance.routes';
import dutyRoutes from './duty.routes';
import integrationRoutes from './integration.routes';
import isurveyRoutes from './isurvey.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/cases', caseRoutes);
router.use('/locations', locationRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/ocr', ocrRoutes);
router.use('/consult', consultRoutes);
router.use('/leave', leaveRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/duty', dutyRoutes);
router.use('/isurvey', isurveyRoutes);
router.use('/integrations', integrationRoutes); // เครื่องมือภายใน (se-autokey) — service token

export default router;
