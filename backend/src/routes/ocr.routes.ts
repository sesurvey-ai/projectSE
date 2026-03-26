import { Router } from 'express';
import { ocrController } from '../controllers/ocr.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { upload } from '../config/multer';

const router = Router();

router.post('/typhoon', auth, requireRole('callcenter', 'admin'), upload.single('image'), ocrController.extractClaim);

export default router;
