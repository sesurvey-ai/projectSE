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
};
