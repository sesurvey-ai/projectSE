import { Request, Response } from 'express';
import fs from 'fs';
import { extractClaimData } from '../services/ocr.service';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const ocrController = {
  extractClaim: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      sendError(res, 'กรุณาอัปโหลดรูปภาพ', 400);
      return;
    }

    try {
      console.log(`[OCR] Processing file: ${file.originalname} (${(file.size / 1024).toFixed(0)} KB, ${file.mimetype})`);

      // ส่ง file path ให้ Python script อ่านตรง
      const result = await extractClaimData(file.path);

      // Clean up uploaded file after processing
      fs.unlinkSync(file.path);

      sendSuccess(res, result);
    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      console.error('[OCR Error]', error);
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      sendError(res, message, 500);
    }
  }),
};
