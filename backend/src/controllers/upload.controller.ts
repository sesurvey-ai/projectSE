import { Request, Response } from 'express';
import { uploadService } from '../services/upload.service';
import { sendSuccess, sendError } from '../utils/response';

export const uploadController = {
  upload(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      sendError(res, 'No files uploaded', 400);
      return;
    }
    const result = uploadService.processFiles(files);
    sendSuccess(res, result, 201);
  },
};
