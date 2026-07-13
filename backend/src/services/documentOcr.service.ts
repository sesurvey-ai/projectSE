/**
 * OCR บัตรประชาชน + ใบขับขี่ — ใช้ "เครื่องยนต์" เดียวกับใบเคลม (Gemini อ่าน + Vision ตรวจ)
 * flipped philosophy: อ่านเฉพาะที่ชัด (ABSTAIN) + คืน confidence ตามการ ground ด้วย Vision
 * เลขบัตร ปชช. ตรวจ checksum mod 11 เพิ่ม (fail → flag medium)
 */
import fs from 'fs';
import { Type } from '@google/genai';
import { visionText, geminiJson } from './ocrClients';

export type DocKind = 'idcard' | 'license';

const norm = (s: string) => (s || '').replace(/\s+/g, '');
const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');

function cidChecksum(raw: string): boolean {
  const d = digitsOnly(raw);
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i], 10) * (13 - i);
  return ((11 - (sum % 11)) % 10) === parseInt(d[12], 10);
}

// ── บัตรประชาชน ──
const IDCARD_PROMPT =
  'This is an IMAGE of a Thai national ID card (บัตรประชาชน). Extract:\n' +
  '- "prefix": คำนำหน้า from the Thai name (one of นาย/นาง/นางสาว/ด.ช./ด.ญ.); "" if absent\n' +
  '- "first_name": ชื่อ (Thai given name only, no prefix, no surname)\n' +
  '- "last_name": นามสกุล (Thai surname only)\n' +
  '- "cid": the 13-digit เลขประจำตัวประชาชน (digits, spaces ok)\n' +
  '- "birthdate": วันเดือนปีเกิด as dd/mm/yyyy EXACTLY as printed (Buddhist year, e.g. 15/03/2530); "" if absent\n' +
  '- "address": ที่อยู่ (full Thai address text on the card); "" if absent\n' +
  '- "province": ชื่อจังหวัด from the address, name ONLY without the word "จังหวัด"/"จ." (for Bangkok return "กรุงเทพมหานคร"); "" if absent\n' +
  '- "district": ชื่ออำเภอ/เขต from the address, name ONLY without the word "อำเภอ"/"เขต"/"อ." (e.g. "คลองหลวง", "บางรัก"); "" if absent\n\n' +
  'Read ONLY characters that are clearly and unambiguously printed. If any part is blurry/covered/uncertain, leave that field "" — do NOT guess or reconstruct.';

const IDCARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    prefix: { type: Type.STRING },
    first_name: { type: Type.STRING },
    last_name: { type: Type.STRING },
    cid: { type: Type.STRING },
    birthdate: { type: Type.STRING },
    address: { type: Type.STRING },
    province: { type: Type.STRING },
    district: { type: Type.STRING },
  },
  required: ['prefix', 'first_name', 'last_name', 'cid', 'birthdate', 'address', 'province', 'district'],
};

// ── ใบขับขี่ ──
const LICENSE_PROMPT =
  'This is an IMAGE of a Thai driver license (ใบอนุญาตขับขี่รถยนต์). Extract:\n' +
  '- "license_no": เลขที่ใบอนุญาต (the license number)\n' +
  '- "license_type": ชนิด/ประเภทใบขับขี่ IN THAI as printed — รวมชนิดรถ (รถยนต์/รถจักรยานยนต์) + ประเภทย่อยถ้ามี (ส่วนบุคคลชั่วคราว, ส่วนบุคคล, ส่วนบุคคล 5 ปี, ตลอดชีพ, สาธารณะ); prefer Thai text over English (e.g. "Private Car Driving Licence" → "รถยนต์ส่วนบุคคล"); "" if unclear\n' +
  '- "issue_date": วันออกบัตร/วันเริ่มต้น as dd/mm/yyyy EXACTLY as printed; "" if absent\n' +
  '- "expiry_date": วันสิ้นอายุ as dd/mm/yyyy EXACTLY as printed; "" if absent\n' +
  '- "first_name": ชื่อ (Thai given name, no prefix, no surname)\n' +
  '- "last_name": นามสกุล (Thai surname)\n' +
  '- "prefix": คำนำหน้า from the Thai name (one of นาย/นาง/นางสาว/ด.ช./ด.ญ.); "" if absent\n' +
  '- "birthdate": วันเกิด/เกิดวันที่ as dd/mm/yyyy (Buddhist year, e.g. 15/03/2530); "" if absent\n\n' +
  'Read ONLY characters clearly printed. If uncertain, leave "". Do NOT guess.';

const LICENSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    license_no: { type: Type.STRING },
    license_type: { type: Type.STRING },
    issue_date: { type: Type.STRING },
    expiry_date: { type: Type.STRING },
    first_name: { type: Type.STRING },
    last_name: { type: Type.STRING },
    prefix: { type: Type.STRING },
    birthdate: { type: Type.STRING },
  },
  required: ['license_no', 'license_type', 'issue_date', 'expiry_date', 'first_name', 'last_name', 'prefix', 'birthdate'],
};

type Conf = 'high' | 'medium' | 'low' | '';

// grounded = ค่า (แบบตัดช่องว่าง) โผล่ในข้อความที่ Vision อ่านได้ → high, ไม่โผล่ → medium, ว่าง → ''
function ground(value: string, visionNorm: string): Conf {
  if (!value.trim()) return '';
  return visionNorm.includes(norm(value)) ? 'high' : 'medium';
}

// ── grounding สำหรับวันที่ ──
// Gemini คืน dd/mm/yyyy (พ.ศ.) แต่บัตรพิมพ์เป็น "5 ม.ค. 2515" / "5 Jan. 1972" → substring ตรงๆ ไม่เจอ
// (เลยติด medium ทั้งที่ค่าถูก). แก้: เทียบ วัน+เดือน+ปี ต่อกัน โดย map เดือนไทย/อังกฤษ + ตัดตัวคั่น + รับทั้ง พ.ศ./ค.ศ.
// ต้องเจอทั้ง 3 ส่วนต่อเนื่องกัน จึงเจาะจงพอ — วันที่ผิดจะไม่ผ่าน (ตกเป็น medium ตามเดิม)
const _thMonthsFull = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const _thMonthsAbbr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const _enMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const _enMonthsFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// ตัดช่องว่าง/จุด/ทับ/ขีด + เป็นตัวเล็ก (ไม่กระทบตัวอักษรไทย)
const normD = (s: string) => (s || '').replace(/[\s.\/-]/g, '').toLowerCase();

function groundDate(value: string, vTextRaw: string): Conf {
  if (!value.trim()) return '';
  const parts = value.split('/');
  if (parts.length !== 3) return ground(value, norm(vTextRaw)); // ไม่ใช่รูปแบบวันที่ → fallback
  const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
  if (!d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31) return ground(value, norm(vTextRaw));
  const V = normD(vTextRaw);
  const days = [String(d), String(d).padStart(2, '0')];
  const yBE = y > 2400 ? y : y + 543;
  const yCE = y > 2400 ? y - 543 : y;
  const years = [String(yBE), String(yCE)];
  const months = [
    String(m), String(m).padStart(2, '0'),
    normD(_thMonthsFull[m - 1]), normD(_thMonthsAbbr[m - 1]), _enMonths[m - 1], _enMonthsFull[m - 1],
  ];
  for (const dd of days) for (const mm of months) for (const yy of years) {
    if (V.includes(dd + mm + yy)) return 'high';
  }
  return 'medium';
}

export type DocResult = {
  fields: Record<string, string>;
  confidence: Record<string, Conf>;
  review_needed: boolean;
};

export async function extractDocument(imagePath: string, kind: DocKind): Promise<DocResult> {
  const buf = await fs.promises.readFile(imagePath);
  const [prompt, schema] = kind === 'idcard' ? [IDCARD_PROMPT, IDCARD_SCHEMA] : [LICENSE_PROMPT, LICENSE_SCHEMA];

  // Gemini อ่าน (หลัก) + Vision ตรวจ (ขนานกัน)
  const [raw, vText] = await Promise.all([
    geminiJson<Record<string, string>>(buf, prompt, schema),
    visionText(buf).catch(() => ''), // Vision ล้ม → ยังคืนค่า Gemini ได้ (confidence ตกเป็น medium)
  ]);
  const vNorm = norm(vText);

  const fields: Record<string, string> = {};
  const confidence: Record<string, Conf> = {};
  const keys = Object.keys(schema.properties);
  for (const k of keys) {
    let v = (raw[k] ?? '').trim();
    if (k === 'cid') v = digitsOnly(v);
    if (!v) { confidence[k] = ''; continue; }
    fields[k] = v;
    // cid: ต้องผ่าน checksum ด้วย ไม่งั้น flag medium (แม้ Vision จะ ground ได้)
    if (k === 'cid') {
      confidence[k] = cidChecksum(v) ? ground(v, vNorm) : 'medium';
    } else if (k === 'birthdate' || k === 'issue_date' || k === 'expiry_date') {
      confidence[k] = groundDate(v, vText); // วันที่: Gemini แปลงรูปแบบ → ต้องเทียบแบบรู้จักวันที่ (ไม่งั้นติด medium เสมอ)
    } else {
      confidence[k] = ground(v, vNorm);
    }
  }

  const review_needed = Object.values(confidence).some((c) => c === 'medium' || c === 'low');
  return { fields, confidence, review_needed };
}
