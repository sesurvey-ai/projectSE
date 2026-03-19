import { Request, Response } from 'express';
import { locationService } from '../services/location.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const locationController = {
  respond: asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude, request_id } = req.body;
    const location = await locationService.saveLocation(req.user!.id, latitude, longitude, request_id);
    sendSuccess(res, location);
  }),

  getLatest: asyncHandler(async (_req: Request, res: Response) => {
    const locations = await locationService.getLatest();
    sendSuccess(res, locations);
  }),
};
