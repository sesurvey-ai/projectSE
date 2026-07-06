import { Router } from 'express';
import { ocrController } from '../controllers/ocr.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { upload } from '../config/multer';

const router = Router();

router.post('/typhoon', auth, requireRole('callcenter', 'admin'), upload.single('image'), ocrController.extractClaim);
// flipped pipeline (Gemini + Vision) — เร็ว/แม่น ดึง 5 เลขสำคัญ; แทน /typhoon (คง /typhoon เป็น fallback)
// surveyor เรียกได้ด้วย (สแกนใบเคลมบนมือถือ หน้ากรอกรายละเอียดอุบัติเหตุ)
router.post('/claim', auth, requireRole('callcenter', 'admin', 'surveyor'), upload.single('image'), ocrController.extractClaimFlipped);
// บัตรประชาชน / ใบขับขี่ — /api/ocr/document/idcard | /api/ocr/document/license
router.post('/document/:kind', auth, requireRole('callcenter', 'admin', 'surveyor'), upload.single('image'), ocrController.extractDocument);

export default router;
