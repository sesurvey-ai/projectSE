import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

const TYPHOON_API_URL = 'https://api.opentyphoon.ai/v1/chat/completions';
const OCR_MODEL = 'typhoon-ocr';
const API_TIMEOUT = 180000; // 3 นาที

// prompt OCR (typhoon-ocr v1.5, figure_language=Thai) — คัดลอกตรงจากแพ็กเกจ typhoon_ocr
const OCR_PROMPT = `Extract all text from the image.


Instructions:
- Only return the clean Markdown.
- Do not include any explanation or extra text.
- You must include all information on the page.


Formatting Rules:
- Tables: Render tables using <table>...</table> in clean HTML format.
- Equations: Render equations using LaTeX syntax with inline ($...$) and block ($$...$$).
- Images/Charts/Diagrams: Wrap any clearly defined visual areas (e.g. charts, diagrams, pictures) in:


<figure>
Describe the image's main elements (people, objects, text), note any contextual clues (place, event, culture), mention visible text and its meaning, provide deeper analysis when relevant (especially for financial charts, graphs, or documents), comment on style or architecture if relevant, then give a concise overall summary. Describe in Thai.
</figure>


- Page Numbers: Wrap page numbers in <page_number>...</page_number> (e.g., <page_number>14</page_number>).
- Checkboxes: Use ☐ for unchecked and ☑ for checked boxes.`;

// เดา mime จากนามสกุลไฟล์ (multer อนุญาต jpeg/png/webp อยู่แล้ว)
const mimeFromPath = (p: string): string => {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
};

// Parse prompt สำหรับแปลง OCR text → structured JSON
const PARSE_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้านการอ่านใบรับแจ้งเคลมประกันภัยไทย
จากข้อมูล OCR ด้านล่าง ให้ดึงข้อมูลออกมาเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบาย

กฎสำคัญ:
- ถ้าไม่มีข้อมูลให้ใส่ "" (string ว่าง)
- วันที่ format dd/mm/yyyy เช่น "31/01/2569"
- เวลา format HH:mm เช่น "07:45"
- เบอร์โทร 10 หลัก เช่น "0829957079"
- ชื่อ: ไม่ต้องใส่คำนำหน้า (นาย/นาง/คุณ)

ตอบ JSON นี้เท่านั้น:
{
  "claim_ref_no": "เลขรับแจ้ง",
  "claim_no": "เลขที่เคลม",
  "acc_insurance_notify_date": "วันที่รับแจ้ง",
  "acc_insurance_notify_time": "เวลารับแจ้ง",
  "acc_date": "วันที่เกิดเหตุ",
  "acc_time": "เวลาเกิดเหตุ",
  "acc_cause": "การเกิดเหตุ",
  "acc_place": "สถานที่เกิดเหตุ ที่อยู่เต็ม",
  "acc_subdistrict": "ตำบล/แขวง",
  "acc_district": "อำเภอ/เขต",
  "acc_province": "จังหวัด",
  "license_plate": "ทะเบียนรถ",
  "car_brand": "ยี่ห้อรถ",
  "car_model": "รุ่นรถ",
  "chassis_no": "เลขตัวถัง",
  "engine_no": "เลขเครื่องยนต์",
  "car_color": "สีรถ",
  "car_type": "ประเภทรถ",
  "policy_no": "เลขกรมธรรม์",
  "policy_start": "วันเริ่มคุ้มครอง",
  "policy_end": "วันสิ้นสุด",
  "policy_type": "ประเภทกรมธรรม์",
  "prb_number": "เลข พ.ร.บ.",
  "assured_name": "ชื่อผู้เอาประกัน",
  "driver_first_name": "ชื่อจริงผู้ขับขี่",
  "driver_last_name": "นามสกุลผู้ขับขี่",
  "driver_phone": "เบอร์โทรผู้ขับขี่",
  "acc_reporter": "ชื่อผู้แจ้งเหตุ",
  "reporter_phone": "เบอร์โทรผู้แจ้ง",
  "insurance_branch": "สาขาประกัน",
  "survey_company": "บริษัทสำรวจ",
  "survey_job_no": "เลขที่งานเซอร์เวย์",
  "surveyor_name": "ชื่อผู้สำรวจ",
  "surveyor_phone": "เบอร์โทรผู้สำรวจ",
  "receiver_name": "ผู้รับแจ้ง",
  "acc_detail": "หมายเหตุ",
  "deductible": "Deduct",
  "counterparty_plate": "ทะเบียนรถคู่กรณี",
  "counterparty_brand": "ยี่ห้อรถคู่กรณี",
  "counterparty_detail": "รายละเอียดคู่กรณี",
  "counterparty_insurance": "คู่กรณีมีประกัน/ไม่มีประกัน"
}

ข้อมูล OCR:
`;

// fetch พร้อม timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API timeout after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Step 1: OCR รูป → markdown ด้วยโมเดล typhoon-ocr (เรียก API ตรงแบบ Node — ไม่พึ่ง Python)
async function ocrImage(imagePath: string): Promise<string> {
  const buf = await fs.promises.readFile(imagePath);
  const dataUrl = `data:${mimeFromPath(imagePath)};base64,${buf.toString('base64')}`;
  const response = await fetchWithTimeout(TYPHOON_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TYPHOON_API_KEY}`,
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 16384,
      temperature: 0.1,
      top_p: 0.6,
      repetition_penalty: 1.1,
    }),
  }, API_TIMEOUT);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Typhoon OCR error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}

// Step 2: Typhoon LLM แปลง text → structured JSON
async function parseToStructured(ocrText: string): Promise<Record<string, string>> {
  const response = await fetchWithTimeout(TYPHOON_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TYPHOON_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'typhoon-v2.5-30b-a3b-instruct',
      messages: [
        {
          role: 'system',
          content: 'คุณเป็น JSON extractor ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบายใดๆ',
        },
        {
          role: 'user',
          content: PARSE_PROMPT + ocrText,
        },
      ],
      max_tokens: 4096,
      temperature: 0,
    }),
  }, API_TIMEOUT);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Typhoon parse error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content: string = data.choices?.[0]?.message?.content || '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('ไม่สามารถแปลงข้อมูลเป็น JSON ได้');
  }

  return JSON.parse(jsonMatch[0]);
}

// Main: Python OCR → LLM Parse → return
export async function extractClaimData(imagePath: string): Promise<{ fields: Record<string, string>; ocrRaw: string }> {
  if (!env.TYPHOON_API_KEY) {
    throw new Error('TYPHOON_API_KEY is not configured');
  }

  // Step 1: OCR รูป → markdown ด้วย typhoon-ocr API (Node ตรง ๆ ไม่ใช้ Python)
  console.log('[OCR] Step 1: Reading image with typhoon-ocr API...');
  const ocrText = await ocrImage(imagePath);
  console.log('[OCR] Step 1 done, text length:', ocrText.length);

  if (!ocrText || ocrText.trim().length < 10) {
    throw new Error('ไม่สามารถอ่านข้อมูลจากรูปได้ กรุณาลองรูปที่ชัดกว่านี้');
  }

  // Step 2: Parse ด้วย LLM
  console.log('[OCR] Step 2: Parsing to JSON...');
  const fields = await parseToStructured(ocrText);
  console.log('[OCR] Step 2 done');

  return { fields, ocrRaw: ocrText };
}
