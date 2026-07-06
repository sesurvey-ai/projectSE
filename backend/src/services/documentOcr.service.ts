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
  '- "address": ที่อยู่ (full Thai address text on the card); "" if absent\n\n' +
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
  },
  required: ['prefix', 'first_name', 'last_name', 'cid', 'birthdate', 'address'],
};

// ── ใบขับขี่ ──
const LICENSE_PROMPT =
  'This is an IMAGE of a Thai driver license (ใบอนุญาตขับขี่รถยนต์). Extract:\n' +
  '- "license_no": เลขที่ใบอนุญาต (the license number)\n' +
  '- "license_type": ชนิด/ประเภทใบขับขี่ (e.g. ส่วนบุคคลชั่วคราว, ส่วนบุคคล 5 ปี, ตลอดชีพ); "" if unclear\n' +
  '- "issue_date": วันออกบัตร/วันเริ่มต้น as dd/mm/yyyy EXACTLY as printed; "" if absent\n' +
  '- "expiry_date": วันสิ้นอายุ as dd/mm/yyyy EXACTLY as printed; "" if absent\n' +
  '- "first_name": ชื่อ (Thai given name, no prefix, no surname)\n' +
  '- "last_name": นามสกุล (Thai surname)\n\n' +
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
  },
  required: ['license_no', 'license_type', 'issue_date', 'expiry_date', 'first_name', 'last_name'],
};

type Conf = 'high' | 'medium' | 'low' | '';

// grounded = ค่า (แบบตัดช่องว่าง) โผล่ในข้อความที่ Vision อ่านได้ → high, ไม่โผล่ → medium, ว่าง → ''
function ground(value: string, visionNorm: string): Conf {
  if (!value.trim()) return '';
  return visionNorm.includes(norm(value)) ? 'high' : 'medium';
}

export type DocResult = {
  fields: Record<string, string>;
  confidence: Record<string, Conf>;
  review_needed: boolean;
};

export async function extractDocument(imagePath: string, kind: DocKind): Promise<DocResult> {
  const buf = fs.readFileSync(imagePath);
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
    } else {
      confidence[k] = ground(v, vNorm);
    }
  }

  const review_needed = Object.values(confidence).some((c) => c === 'medium' || c === 'low');
  return { fields, confidence, review_needed };
}
