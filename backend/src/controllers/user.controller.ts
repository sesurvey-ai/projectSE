import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const userController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.user!.id);
    sendSuccess(res, user);
  }),

  updateFcmToken: asyncHandler(async (req: Request, res: Response) => {
    const { fcm_token } = req.body;
    await userService.updateFcmToken(req.user!.id, fcm_token);
    sendSuccess(res, { message: 'FCM token updated' });
  }),
};
