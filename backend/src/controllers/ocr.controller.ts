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

      // ส่ง file path ให้อ่าน OCR
      const result = await extractClaimData(file.path);

      // เก็บไฟล์ไว้ → ตอนสร้างเคสจะย้ายเข้าโฟลเดอร์เลขเคลม
      sendSuccess(res, { ...result, savedImage: file.filename });
    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error('[OCR Error]', error);
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      sendError(res, message, 500);
    }
  }),
};
