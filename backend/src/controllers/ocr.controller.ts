import { Request, Response } from 'express';
import fs from 'fs';
import { extractClaimData } from '../services/ocr.service';
import { flippedExtract, OcrField, Insurer } from '../services/ocrFlipped.service';
import { extractDocument, DocKind } from '../services/documentOcr.service';
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
      /**
       * บริษัทประกันมาจากปุ่มที่คนรับแจ้งเลือกบนฟอร์ม — การ์ด/ใบรับแจ้งคนละแบบกัน
       * ค่าเริ่มต้น TPB เพื่อให้หน้าเว็บรุ่นเก่า (ที่ยังไม่ส่ง insurer) ทำงานเหมือนเดิม
       */
      const insurer: Insurer = String(req.body?.insurer || '').toUpperCase() === 'AIOI' ? 'AIOI' : 'TPB';
      console.log(`[OCR flipped:${insurer}] ${file.originalname} (${(file.size / 1024).toFixed(0)} KB, ${file.mimetype})`);
      const t0 = Date.now();
      const result = await flippedExtract(file.path, insurer);
      console.log(`[OCR flipped:${insurer}] done in ${Date.now() - t0}ms · review=${result.review_needed}`);

      // map 5 ฟิลด์ → ชื่อฟิลด์ในฟอร์มสร้างเคส (survey_no_2 ยังไม่มีคอลัมน์ → ส่งแยก)
      const byForm: Record<string, OcrField> = {
        claim_ref_no: result.fields.claim_received,
        claim_no: result.fields.claim_no,
        prb_number: result.fields.prb_no,       // เลขพรบ (โค้ดที่ 2 = ACD) — โชว์เมื่อมีค่า
        survey_job_no: result.fields.survey_no,
        survey_job_no_2: result.fields.survey_no_2,   // เลขเซอร์เวย์ งาน 2 — โชว์เมื่อมีค่า
        policy_no: result.fields.policy_no,           // เลขกรมธรรม์
        chassis_no: result.fields.chassis_no,         // เลขตัวถัง (user ระบุเป็น 1 ใน 5 เลขที่ต้องอ่าน)
        incident_location: result.fields.incident_location, // สถานที่เกิดเหตุ (โชว์บนการ์ดงานมือถือ)
        acc_customer_report_date: result.fields.customer_report, // "ลูกค้าแจ้ง" — วันที่+เวลารับแจ้ง (dd/mm/พ.ศ.|HH:mm) → ไทม์ไลน์งานมือถือ
        reporter_phone: result.fields.reporter_phone,   // เบอร์ผู้แจ้งเหตุ — คนจ่ายงาน/ช่างใช้โทรกลับ
        driver_phone: result.fields.driver_phone,       // เบอร์ผู้ขับขี่ (การ์ดไอโออิเท่านั้น)
        acc_province: result.fields.acc_province,      // จังหวัดที่เกิดเหตุ — หน้าจ่ายงานใช้จัดกลุ่มช่าง
        acc_district: result.fields.acc_district,      // อำเภอ/เขตที่เกิดเหตุ
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
        savedImage: file.filename,
      });
    } catch (error) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error('[OCR flipped Error]', error);
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      sendError(res, message, 500);
    }
  }),

  // บัตรประชาชน / ใบขับขี่ — Gemini อ่าน + Vision ตรวจ (kind มาจาก route param)
  extractDocument: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const kind = req.params.kind as DocKind;
    if (!file) {
      sendError(res, 'กรุณาอัปโหลดรูปภาพ', 400);
      return;
    }
    if (kind !== 'idcard' && kind !== 'license') {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      sendError(res, 'kind ต้องเป็น idcard หรือ license', 400);
      return;
    }
    try {
      console.log(`[OCR doc:${kind}] ${file.originalname} (${(file.size / 1024).toFixed(0)} KB, ${file.mimetype})`);
      const t0 = Date.now();
      const result = await extractDocument(file.path, kind);
      console.log(`[OCR doc:${kind}] done in ${Date.now() - t0}ms · review=${result.review_needed}`);
      // มือถือเก็บสำเนารูปเข้าโฟลเดอร์เคสเองแล้ว → ลบ temp ฝั่ง server กัน orphan
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      sendSuccess(res, { ...result });
    } catch (error) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error('[OCR doc Error]', error);
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      sendError(res, message, 500);
    }
  }),
};
