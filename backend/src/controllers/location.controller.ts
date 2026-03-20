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

  getLatest: asyncHandler(async (req: Request, res: Response) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    let locations;
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      locations = await locationService.getLatestNearest(lat, lng, limit);
    } else {
      locations = await locationService.getLatest();
    }
    sendSuccess(res, locations);
  }),
};
