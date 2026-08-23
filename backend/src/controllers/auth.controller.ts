import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    sendSuccess(res, result);
  }),

  /** เปลี่ยนรหัสผ่านของตัวเอง (ทุก role) — ต้องยืนยันด้วยรหัสเดิม */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { current_password, new_password } = req.body;
    const result = await authService.changePassword(
      req.user!.id, current_password, new_password);
    sendSuccess(res, result);
  }),
};
