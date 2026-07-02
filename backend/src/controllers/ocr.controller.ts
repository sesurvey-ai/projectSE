import { Request, Response } from 'express';
import fs from 'fs';
import { extractClaimData } from '../services/ocr.service';
import { flippedExtract, OcrField } from '../services/ocrFlipped.service';
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

  // flipped pipeline (Gemini อ่านรูป + Vision ตรวจ) — เร็ว/แม่น ดึง 5 เลขสำคัญ + confidence
  extractClaimFlipped: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      sendError(res, 'กรุณาอัปโหลดรูปภาพ', 400);
      return;
    }
    try {
      console.log(`[OCR flipped] ${file.originalname} (${(file.size / 1024).toFixed(0)} KB, ${file.mimetype})`);
      const t0 = Date.now();
      const result = await flippedExtract(file.path);
      console.log(`[OCR flipped] done in ${Date.now() - t0}ms · review=${result.review_needed}`);

      // map 5 ฟิลด์ → ชื่อฟิลด์ในฟอร์มสร้างเคส (survey_no_2 ยังไม่มีคอลัมน์ → ส่งแยก)
      const byForm: Record<string, OcrField> = {
        claim_ref_no: result.fields.claim_received,
        claim_no: result.fields.claim_no,
        prb_number: result.fields.prb_no,
        survey_job_no: result.fields.survey_no,
      };
      const fields: Record<string, string> = {};
      const confidence: Record<string, string> = {};
      for (const [key, fd] of Object.entries(byForm)) {
        if (fd.value && fd.value.trim()) fields[key] = fd.value.trim();
        confidence[key] = fd.confidence;
      }

      sendSuccess(res, {
        fields,
        confidence,
        review_needed: result.review_needed,
        survey_no_2: result.fields.survey_no_2.value,
        savedImage: file.filename,
      });
    } catch (error) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error('[OCR flipped Error]', error);
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      sendError(res, message, 500);
    }
  }),
};
