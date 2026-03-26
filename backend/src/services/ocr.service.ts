import { env } from '../config/env';
import { execFile } from 'child_process';
import path from 'path';

const TYPHOON_API_URL = 'https://api.opentyphoon.ai/v1/chat/completions';
const API_TIMEOUT = 180000; // 3 นาที

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

// Step 1: เรียก typhoon_ocr Python package (แม่นยำกว่า API ตรง)
function ocrWithPython(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '../scripts/ocr_extract.py');

    execFile('python3', [scriptPath, imagePath], {
      timeout: API_TIMEOUT,
      env: { ...process.env, TYPHOON_API_KEY: env.TYPHOON_API_KEY || '' },
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('[OCR] Python stderr:', stderr);
        reject(new Error(`OCR script error: ${error.message}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          resolve(result.text);
        } else {
          reject(new Error(result.error || 'OCR failed'));
        }
      } catch {
        reject(new Error(`Invalid OCR output: ${stdout.substring(0, 200)}`));
      }
    });
  });
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

  // Step 1: OCR ด้วย typhoon_ocr package
  console.log('[OCR] Step 1: Reading image with typhoon_ocr...');
  const ocrText = await ocrWithPython(imagePath);
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
