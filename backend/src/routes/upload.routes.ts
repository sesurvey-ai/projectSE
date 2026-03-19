import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { upload } from '../config/multer';

const router = Router();

router.post('/', auth, requireRole('surveyor'), upload.array('photos', 5), uploadController.upload);

export default router;
