/**
 * /api/staff-groups — ทีมของหัวหน้าผู้ตรวจ (04/09/69)
 *
 *   GET    /mine                      ทีมของฉัน (checker/admin) — อ่านอย่างเดียว
 *   GET    /                          ทุกทีม (admin)
 *   POST   /                          {name, checker_id?} สร้างทีม (admin)
 *   PUT    /:id                       {name?, checker_id?} แก้ชื่อ/ผูกบัญชีผู้ตรวจ (admin)
 *   DELETE /:id                       ลบทีม (admin)
 *   POST   /:id/members               {staff_name} เพิ่มสมาชิก (admin)
 *   DELETE /:id/members/:memberId     ลบสมาชิก (admin)
 */
import { Router, Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { staffGroupService } from '../services/staffGroup.service';

const router = Router();
const num = (v: unknown) => parseInt(String(v), 10);

router.get('/mine', auth, requireRole('checker', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await staffGroupService.mine(req.user!.id));
}));

router.use(auth, requireRole('admin'));

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await staffGroupService.list());
}));
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as { name?: string; checker_id?: number | null };
  sendSuccess(res, await staffGroupService.create(String(b.name ?? ''), b.checker_id ? num(b.checker_id) : null), 201);
}));
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await staffGroupService.get(num(req.params.id)));
}));
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as { name?: string; checker_id?: number | null };
  const patch: { name?: string; checker_id?: number | null } = {};
  if (b.name !== undefined) patch.name = String(b.name);
  if (b.checker_id !== undefined) patch.checker_id = b.checker_id === null || b.checker_id === 0 ? null : num(b.checker_id);
  sendSuccess(res, await staffGroupService.update(num(req.params.id), patch));
}));
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await staffGroupService.remove(num(req.params.id));
  sendSuccess(res, { removed: true });
}));
router.post('/:id/members', asyncHandler(async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as { staff_name?: string };
  sendSuccess(res, await staffGroupService.addMember(num(req.params.id), String(b.staff_name ?? '')), 201);
}));
router.delete('/:id/members/:memberId', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await staffGroupService.removeMember(num(req.params.id), num(req.params.memberId)));
}));

export default router;
