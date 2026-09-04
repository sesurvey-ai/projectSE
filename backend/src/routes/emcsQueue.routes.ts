/**
 * /api/emcs-queue — คิวนำเข้า EMCS สำหรับสถานีนำเข้า (checker/admin)
 *
 *   GET    /                    ภาพรวมคิว (รอ/กำลังทำ/พังวันนี้ + สถานีที่เห็นล่าสุด)
 *   POST   /cases/:id           ส่งเคสเข้าคิว {dry_run?} (เคสต้องอนุมัติแล้ว + ยังไม่เคยนำเข้า)
 *   DELETE /cases/:id           ยกเลิกงานที่ยังรอในคิวของเคส
 *   GET    /cases/:id           งานล่าสุดของเคส
 *
 * ฝั่งสถานี (บอท) อยู่ที่ /api/integrations/emcs-queue/* (service token)
 */
import { Router, Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import { emcsQueueService } from '../services/emcsQueue.service';

const router = Router();
router.use(auth, requireRole('checker', 'admin'));

const caseIdOf = (req: Request): number => {
  const id = parseInt(req.params.id as string);
  if (!Number.isFinite(id)) throw new AppError(400, 'case id ไม่ถูกต้อง');
  return id;
};

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await emcsQueueService.summary());
}));

router.post('/cases/:id', asyncHandler(async (req: Request, res: Response) => {
  const job = await emcsQueueService.enqueue(caseIdOf(req), req.user?.id ?? null,
    { dryRun: req.body?.dry_run === true });
  sendSuccess(res, job, job.existing ? 200 : 201);
}));

router.delete('/cases/:id', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await emcsQueueService.cancel(caseIdOf(req), req.user?.id ?? null));
}));

router.get('/cases/:id', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await emcsQueueService.latestForCase(caseIdOf(req)));
}));

export default router;
