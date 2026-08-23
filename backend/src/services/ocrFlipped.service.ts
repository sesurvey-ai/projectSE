/**
 * FLIPPED OCR extractor — พอร์ตจาก aiocr (flipped_extract.py + hybrid_extract.py) เป็น TypeScript.
 *
 * สถาปัตยกรรม: Gemini อ่านรูปเป็นหลัก (ABSTAIN prompt — ไม่ชัดให้เว้น) + Google Vision OCR = ตัวตรวจอิสระ
 * confidence ตามการที่ Vision ยืนยันค่าของ Gemini:
 *   high   = ทั้งโค้ด (ตัวอักษร+ตัวเลข) โผล่ใน Vision OCR
 *   medium = เฉพาะเลขท้ายตรง (ตัวอักษรยังยืนยันไม่ได้) → flag
 *   low    = ไม่ ground เลย / ว่าง → review
 * ค่าของ Gemini "เก็บเสมอ" (ให้คนเห็นค่าที่เสนอ) เพียงแต่ flag เมื่อ Vision ยืนยันไม่ได้
 *
 * ดึง 5 ฟิลด์: claim_received, claim_no, prb_no, survey_no, survey_no_2
 */
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { env } from '../config/env';
import { withTimeout, OCR_CALL_TIMEOUT_MS } from './ocrClients';

const GEMINI_MODEL = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

/**
 * บริษัทประกันที่การ์ด/ใบรับแจ้งหน้าตาต่างกัน — เลขคนละรูปแบบกันคนละเรื่อง
 * ⛔ อย่าเอา validator ของฝั่งหนึ่งไปใช้กับอีกฝั่ง: ของไทยไพบูลย์มีตัวอักษรคั่น
 *    (BR10/6906/13144) ส่วนไอโออิเป็นตัวเลขล้วน (2026143607) เอาไปตรวจข้ามกันตกหมด
 */
export type Insurer = 'TPB' | 'AIOI';

// anchored validators (Python re.fullmatch → JS ^...$ + .test)
const FULL_RECV = /^[A-Z]{2}\d{2}\/\d{3,5}\/\d{3,6}$/;
const FULL_CLAIMNO = /^\d{2}[A-Z]{2}\d{2}[A-Z]{2,4}-\d{3,5}-\d{4,6}$/;
const SURVEY_GRAB = /SETP-?\d{6,9}/;

/**
 * ไอโออิ — ทุกเลขเป็นตัวเลขล้วน ความยาวเอาจากการ์ดจริง 6 ใบ (ส.ค. 69)
 * ผ่อนความยาว ±1-2 หลักเผื่อรูปแบบต่างปี ไม่ได้ล็อกเป๊ะ เพราะตกแล้วคนต้องพิมพ์เองทั้งเลข
 * (ตัวคุมคุณภาพจริงคือ grounding กับ Vision ไม่ใช่ความยาว)
 */
const AIOI_RECV = /^\d{9,11}$/;        // เลขรับแจ้ง  2026143607
const AIOI_CLAIM = /^\d{12,14}$/;      // เลขที่เคลม  2026013165416
const AIOI_PRB = /^\d{12,14}$/;        // พ.ร.บ.      2026013303934
const AIOI_POLICY = /^\d{9,14}$/;      // กรมธรรม์    126013134144 / 6252031583
// เลขเรื่องเซอร์เวย์ของไอโออิ — **มีบางใบเท่านั้น** (3 ใน 6 ใบตัวอย่าง) ไม่มีก็ปล่อยว่าง
const SEABI_GRAB = /SEABI-?\d{9,15}/;

// OCR character-confusion tables (ใช้เฉพาะตำแหน่งที่รู้ class จาก template)
const TO_DIGIT: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', A: '4', S: '5', G: '6', T: '7', B: '8' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '7': 'T', '8': 'B', '9': 'P' };

const PROMPT_TPB =
  'This is an IMAGE of a Thai motor-insurance claim form (ใบรับแจ้งเคลม). Extract:\n' +
  '- "claim_received": the เลขรับแจ้ง code (like BR10/6906/13144); "" if absent\n' +
  '- "claim_codes": array of every claim code (like 21BR10AVD-6906-000098; the 3 letters are AVD or ACD)\n' +
  '- "survey_codes": array of every survey number (starts SETP-). If the survey field shows only a placeholder "-" or "รอแจ้ง", return ["-"] or ["รอแจ้ง"].\n' +
  '- "policy_no": the เลขกรมธรรม์ (policy number, e.g. VM3-3100352649-26N10); "" if absent\n' +
  '- "chassis_no": the เลขตัวถัง / VIN of the insured car (17 chars, letters+digits, e.g. MR0FZ29G901234567); "" if absent\n' +
  '- "incident_location": the สถานที่เกิดเหตุ (accident/incident location as free Thai text, e.g. ถนน/แยก/ตำบล/จังหวัด); "" if absent\n' +
  '- "report_date": the วันที่รับแจ้ง (claim-received date) exactly as printed, Thai Buddhist year (e.g. 02/06/2569); "" if absent\n' +
  '- "report_time": the เวลา (time of the วันที่รับแจ้ง) in 24-hour HH:mm (e.g. 13:21); "" if absent\n\n' +
  'CRITICAL: Read ONLY characters that are clearly and unambiguously printed. If ANY character in a code is blurry, faded, hidden, cut off, or you are not fully certain of it, OMIT that code entirely (do not include it). Do NOT guess, complete, or reconstruct missing characters. Returning fewer/blank is better than returning a wrong code.';

const SCHEMA_TPB = {
  type: Type.OBJECT,
  properties: {
    claim_received: { type: Type.STRING },
    claim_codes: { type: Type.ARRAY, items: { type: Type.STRING } },
    survey_codes: { type: Type.ARRAY, items: { type: Type.STRING } },
    policy_no: { type: Type.STRING },
    chassis_no: { type: Type.STRING },
    incident_location: { type: Type.STRING },
    report_date: { type: Type.STRING },
    report_time: { type: Type.STRING },
  },
  required: ['claim_received', 'claim_codes', 'survey_codes', 'policy_no', 'chassis_no', 'incident_location', 'report_date', 'report_time'],
};

/**
 * ไอโออิ — "แบบรับแจ้งอุบัติเหตุยานยนต์" เป็น**ตารางที่มีป้ายชื่อช่องกำกับทุกช่อง**
 * ต่างจากใบไทยไพบูลย์ที่ต้องเดาจากตำแหน่ง → สั่งให้อ่านตามป้ายตรง ๆ แม่นกว่ามาก
 *
 * ⚠️ กับดักที่ต้องบอกให้ชัดในคำสั่ง (เจอจากการ์ดจริง 6 ใบ):
 *   · "พ.ร.บ." ที่เราต้องการคือ**เลขเคลม พ.ร.บ.** (13 หลัก อยู่ในเนื้อความ)
 *     ไม่ใช่ "เลขที่กรมธรรม์ภาคบังคับ" ซึ่งเป็นคนละเลขและอยู่ในตารางกรมธรรม์ท้ายใบ
 *   · กรมธรรม์ที่ต้องการคือ "เลขที่กรมธรรม์คุ้มครองรถ" (ภาคสมัครใจ) ไม่ใช่ภาคบังคับ
 *   · วันที่บนการ์ดเป็น **ค.ศ.** (22/08/2026) — flipReportDate แปลงเป็น พ.ศ. ให้เอง
 *   · เลข SEABI มีบางใบเท่านั้น ไม่มีให้เว้น ห้ามเดา
 */
const PROMPT_AIOI =
  'This is an IMAGE of a Thai motor-insurance accident report card from Aioi Bangkok Insurance ' +
  '(แบบรับแจ้งอุบัติเหตุยานยนต์). It is a table where every value has a Thai label in the cell to its left. ' +
  'Read values BY THEIR LABEL. Extract:\n' +
  '- "claim_received": the number labelled เลขรับแจ้ง (all digits, about 10, e.g. 2026143607); "" if absent\n' +
  '- "claim_codes": array with the single number labelled เลขที่เคลม (all digits, about 13, e.g. 2026013165416)\n' +
  '- "prb_no": the พ.ร.บ. / พรบ. claim number written in the free-text area (all digits, about 13, e.g. 2026013303934). ' +
  'This is NOT the เลขที่กรมธรรม์ภาคบังคับ in the policy table at the bottom — if you only see that one, return ""\n' +
  '- "policy_no": the number labelled เลขที่กรมธรรม์คุ้มครองรถ (the voluntary policy, all digits). ' +
  'Do NOT return เลขที่กรมธรรม์ภาคบังคับ here; "" if absent\n' +
  '- "survey_codes": array of any code starting with SEABI (e.g. SEABI-114260800144). Most cards have none — return [] then\n' +
  '- "chassis_no": the value labelled เลขตัวถัง (letters+digits VIN); "" if absent\n' +
  '- "incident_location": the value labelled สถานที่เกิดเหตุ (free Thai text); "" if absent\n' +
  '- "report_date": the DATE part of วันที่รับแจ้ง exactly as printed (e.g. 22/08/2026 — note this card prints the Christian year); "" if absent\n' +
  '- "report_time": the TIME part of วันที่รับแจ้ง in 24-hour HH:mm (e.g. 12:40); "" if absent\n\n' +
  'CRITICAL: Read ONLY characters that are clearly printed. If ANY character is blurry, cut off, or uncertain, ' +
  'return "" for that field. Do NOT guess or reconstruct. Returning blank is better than returning a wrong number.';

const SCHEMA_AIOI = {
  type: Type.OBJECT,
  properties: {
    claim_received: { type: Type.STRING },
    claim_codes: { type: Type.ARRAY, items: { type: Type.STRING } },
    prb_no: { type: Type.STRING },
    policy_no: { type: Type.STRING },
    survey_codes: { type: Type.ARRAY, items: { type: Type.STRING } },
    chassis_no: { type: Type.STRING },
    incident_location: { type: Type.STRING },
    report_date: { type: Type.STRING },
    report_time: { type: Type.STRING },
  },
  required: ['claim_received', 'claim_codes', 'prb_no', 'policy_no', 'survey_codes', 'chassis_no', 'incident_location', 'report_date', 'report_time'],
};

export type OcrField = {
  value: string;
  raw: string;
  auto_corrected: boolean;
  grounded: boolean;
  format_ok: boolean;
  confidence: 'high' | 'medium' | 'low' | 'pending' | '';
};
export type FlippedResult = {
  image: string;
  review_needed: boolean;
  fields: {
    claim_received: OcrField;
    claim_no: OcrField;
    prb_no: OcrField;
    survey_no: OcrField;
    survey_no_2: OcrField;
    policy_no: OcrField;
    chassis_no: OcrField;
    incident_location: OcrField;
    customer_report: OcrField; // "ลูกค้าแจ้ง" — วันที่+เวลารับแจ้ง รวมเป็น "dd/mm/พ.ศ.|HH:mm"
  };
};

// ── clients (lazy singleton) ──
let _genai: GoogleGenAI | null = null;
let _vision: ImageAnnotatorClient | null = null;

// Firebase service account (จาก FIREBASE_* ที่มีอยู่แล้ว) — ใช้ร่วมทั้ง Vision + Vertex Gemini
// ไม่ต้องมี Gemini API key หรือ cloudVision.json แยกบน prod
function firebaseCreds(): { projectId: string; credentials: { client_email: string; private_key: string } } | null {
  const projectId = env.FIREBASE_PROJECT_ID;
  const client_email = env.FIREBASE_CLIENT_EMAIL;
  const pk = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !client_email || !pk) return null;
  return { projectId, credentials: { client_email, private_key: pk.replace(/\\n/g, '\n') } };
}

function genaiClient(): GoogleGenAI {
  if (_genai) return _genai;
  const fb = firebaseCreds();
  if (env.GEMINI_VERTEX === '1' && fb) {
    // Gemini ผ่าน Vertex AI ด้วย Firebase SA (ต้องเปิด "Vertex AI API" ใน GCP project)
    _genai = new GoogleGenAI({
      vertexai: true,
      project: fb.projectId,
      location: env.GEMINI_LOCATION || 'us-central1',
      googleAuthOptions: { credentials: fb.credentials },
    });
  } else if (env.GEMINI_API_KEY) {
    _genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }); // AI Studio (fallback / local dev)
  } else {
    throw new Error('OCR Gemini: ตั้ง GEMINI_VERTEX=1 (+FIREBASE_*) หรือ GEMINI_API_KEY');
  }
  return _genai;
}
function visionClient(): ImageAnnotatorClient {
  if (_vision) return _vision;
  const fb = firebaseCreds();
  // ใช้ Firebase SA ถ้ามี (prod) ไม่งั้น fallback GOOGLE_APPLICATION_CREDENTIALS (cloudVision.json)
  _vision = fb ? new ImageAnnotatorClient({ projectId: fb.projectId, credentials: fb.credentials }) : new ImageAnnotatorClient();
  return _vision;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Vision OCR (ตัวตรวจ) ──
async function visionText(buf: Buffer): Promise<string> {
  const [resp] = await withTimeout(
    visionClient().documentTextDetection({
      image: { content: buf },
      imageContext: { languageHints: ['th', 'en'] },
    }),
    OCR_CALL_TIMEOUT_MS,
    'Vision documentTextDetection'
  );
  if (resp.error?.message) throw new Error(`Vision error: ${resp.error.message}`);
  return resp.fullTextAnnotation?.text ?? '';
}

type GeminiMap = { claim_received?: string; claim_codes?: string[]; survey_codes?: string[]; prb_no?: string; policy_no?: string; chassis_no?: string; incident_location?: string; report_date?: string; report_time?: string };

// ── Gemini อ่านรูป (หลัก) + retry 429/5xx ──
async function geminiImageMap(buf: Buffer, insurer: Insurer, tries = 6): Promise<GeminiMap> {
  const base64 = buf.toString('base64');
  let delay = 5000;
  for (let a = 1; a <= tries; a++) {
    try {
      const resp = await withTimeout(
        genaiClient().models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: insurer === 'AIOI' ? PROMPT_AIOI : PROMPT_TPB }] }],
          config: { responseMimeType: 'application/json', responseSchema: insurer === 'AIOI' ? SCHEMA_AIOI : SCHEMA_TPB, temperature: 0 },
        }),
        OCR_CALL_TIMEOUT_MS,
        'Gemini generateContent'
      );
      const text = resp.text ?? '{}';
      return JSON.parse(text) as GeminiMap;
    } catch (e: unknown) {
      const err = e as { status?: number; code?: number; message?: string };
      const status = err.status ?? err.code;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500) || /\b(429|50\d|overloaded|unavailable|rate)/i.test(err.message || '');
      if (!retryable || a === tries) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 60000);
    }
  }
  throw new Error('gemini_image_map: exhausted retries');
}

// ── helpers (พอร์ตจาก hybrid_extract.py) ──
const norm = (s: string | undefined | null): string => (s || '').replace(/\s+/g, '');
const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlpha = (c: string) => /[A-Za-z]/.test(c);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function fixChar(ch: string, want: string): string {
  if (want === 'D') return isDigit(ch) ? ch : (TO_DIGIT[ch.toUpperCase()] ?? ch);
  return isAlpha(ch) ? ch : (TO_LETTER[ch] ?? ch);
}
function fixSeg(seg: string, pattern: string): [string, boolean] {
  if (seg.length !== pattern.length) return [seg, false]; // length mismatch → เสี่ยง ไม่แตะ
  const out = seg.split('').map((c, i) => fixChar(c, pattern[i])).join('');
  return [out, out !== seg];
}
function correctClaimCode(v: string): [string, boolean] {
  const parts = v.split('-');
  if (parts.length !== 3 || parts[0].length !== 9) return [v, false];
  const [s0, c0] = fixSeg(parts[0], 'DDLLDDLLL');
  const [s1, c1] = fixSeg(parts[1], 'D'.repeat(parts[1].length));
  const [s2, c2] = fixSeg(parts[2], 'D'.repeat(parts[2].length));
  return [[s0, s1, s2].join('-'), c0 || c1 || c2];
}
function correctClaimReceived(v: string): [string, boolean] {
  const parts = v.split('/');
  if (parts.length !== 3 || parts[0].length !== 4) return [v, false];
  const [s0, c0] = fixSeg(parts[0], 'LLDD');
  const [s1, c1] = fixSeg(parts[1], 'D'.repeat(parts[1].length));
  const [s2, c2] = fixSeg(parts[2], 'D'.repeat(parts[2].length));
  return [[s0, s1, s2].join('/'), c0 || c1 || c2];
}
function correctSurvey(v: string): [string, boolean] {
  if (!v) return [v, false];
  const s = v.replace(/:/g, '-').replace(/ /g, '');
  const m = SURVEY_GRAB.exec(s);
  if (m) {
    let out = m[0];
    if (!out.includes('-')) out = out.replace('SETP', 'SETP-');
    return [out, out !== v];
  }
  return [v, false]; // เช่น "รอแจ้ง" → คงไว้
}
function codeType(code: string): string {
  const m = /^\d{2}[A-Z]{2}\d{2}([A-Z]{2,4})-/.exec(code);
  return m ? m[1] : '';
}
function claimKey(value: string): string {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[1]}|${parts[2]}` : value;
}
function surveyNum(s: string): number | null {
  const m = /(\d{6,9})/.exec(s || '');
  return m ? parseInt(m[1], 10) : null;
}
const PENDING_WORDS = new Set(['ไม่มี', 'n/a', 'na', 'none', 'nil']);
function isPending(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  if (s.split('').every((c) => '-–—'.includes(c))) return true;
  if (s.includes('รอแจ้ง') || s.startsWith('รอ')) return true;
  return PENDING_WORDS.has(s.toLowerCase());
}
function blankField(required: boolean): OcrField {
  return { value: '', raw: '', auto_corrected: false, grounded: false, format_ok: false, confidence: required ? 'low' : '' };
}

type Level = 'full' | 'tail' | 'none';
const LVL_CONF: Record<Level, 'high' | 'medium' | 'low'> = { full: 'high', tail: 'medium', none: 'low' };
function level(value: string, raw: string, flat: string, tail: string): Level {
  if (value && (flat.includes(norm(value)) || flat.includes(norm(raw)))) return 'full';
  if (tail && flat.includes(tail)) return 'tail';
  return 'none';
}
const strict = () => process.env.FLIPPED_STRICT === '1';

function typeRegion(code: string, flat: string): string {
  const tail = code.split('-').pop() || '';
  const m = new RegExp(`(.{0,18})${escapeRe(tail)}`).exec(flat);
  return m ? m[1] : '';
}
function typeConflict(code: string, flat: string): boolean {
  const m = /^\d{2}[A-Z]{2}\d{2}([A-Z]{2,4})/.exec(code);
  const opp = ({ AVD: 'ACD', ACD: 'AVD' } as Record<string, string>)[m ? m[1] : ''];
  return !!opp && typeRegion(code, flat).includes(opp);
}
function typeConfirmed(code: string, flat: string): boolean {
  const m = /^\d{2}[A-Z]{2}\d{2}([A-Z]{2,4})/.exec(code);
  if (!m) return false;
  const g = m[1];
  const region = typeRegion(code, flat);
  const cands = new Set<string>([g, g.replace(/A/g, '4')]);
  for (let i = 0; i < g.length; i++) cands.add(g.slice(0, i) + g.slice(i + 1));
  return [...cands].some((c) => c && region.includes(c));
}

function fieldFromLevel(value: string, raw: string, autoCorrected: boolean, lvl: Level): OcrField {
  return { value, raw, auto_corrected: autoCorrected, grounded: lvl !== 'none', format_ok: true, confidence: LVL_CONF[lvl] };
}

type ClaimC = { raw: string; value: string; auto_corrected: boolean; type: string; level: Level };
function flipClaim(rawCodes: string[] | undefined, flat: string): [OcrField, OcrField] {
  const groups: Record<string, ClaimC> = {};
  const order: string[] = [];
  const lvlNum = (l: Level) => ({ full: 2, tail: 1, none: 0 }[l]);
  const rankGt = (a: ClaimC, b: ClaimC) => {
    const ra: [number, number] = [lvlNum(a.level), a.type === 'AVD' || a.type === 'ACD' ? 1 : 0];
    const rb: [number, number] = [lvlNum(b.level), b.type === 'AVD' || b.type === 'ACD' ? 1 : 0];
    return ra[0] !== rb[0] ? ra[0] > rb[0] : ra[1] > rb[1];
  };
  for (let raw of rawCodes || []) {
    raw = (raw || '').trim();
    if (!raw || !raw.includes('-')) continue;
    const [corrected, changed] = correctClaimCode(raw);
    if (!FULL_CLAIMNO.test(corrected)) continue;
    let lvl = level(corrected, raw, flat, corrected.split('-').pop() || '');
    if (lvl === 'tail' && !typeConflict(corrected, flat)) {
      if (!strict() || typeConfirmed(corrected, flat)) lvl = 'full';
    }
    const c: ClaimC = { raw, value: corrected, auto_corrected: changed && corrected !== raw, type: codeType(corrected), level: lvl };
    const key = claimKey(corrected);
    if (!(key in groups)) { groups[key] = c; order.push(key); }
    else if (rankGt(c, groups[key])) groups[key] = c;
  }
  const codes = order.map((k) => groups[k]);
  const field = (c: ClaimC | null, required: boolean): OcrField =>
    c === null ? blankField(required) : fieldFromLevel(c.value, c.raw, c.auto_corrected, c.level);

  if (!codes.length) return [field(null, true), field(null, false)];
  if (codes.length === 1) return [field(codes[0], true), field(null, false)];
  const avd = codes.find((c) => c.type === 'AVD') || null;
  const acd = codes.find((c) => c.type === 'ACD') || null;
  const claim = avd || codes[0];
  const prb = acd && acd !== claim ? acd : (codes[1] !== claim ? codes[1] : null);
  return [field(claim, true), field(prb, false)];
}

type SurveyC = { value: string; raw: string; num: number; auto_corrected: boolean; level: Level };
function flipSurvey(rawCodes: string[] | undefined, flat: string): [OcrField, OcrField] {
  const reals: SurveyC[] = [];
  let marker = '';
  const seen = new Set<number>();
  for (let raw of rawCodes || []) {
    raw = (raw || '').trim();
    if (!raw) continue;
    if (isPending(raw)) { marker = marker || raw; continue; }
    const [corrected, changed] = correctSurvey(raw);
    const num = surveyNum(corrected);
    if (num === null || seen.has(num)) continue;
    seen.add(num);
    const lvl = level(corrected, raw, flat, String(num));
    reals.push({ value: corrected, raw, num, auto_corrected: changed && corrected !== raw, level: lvl });
  }
  reals.sort((a, b) => a.num - b.num);
  const field = (c: SurveyC | null, required: boolean): OcrField =>
    c === null ? blankField(required) : fieldFromLevel(c.value, c.raw, c.auto_corrected, c.level);

  if (reals.length) return [field(reals[0], true), field(reals.length > 1 ? reals[1] : null, false)];
  if (marker) return [{ value: marker, raw: marker, auto_corrected: false, grounded: true, format_ok: false, confidence: 'pending' }, blankField(false)];
  return [blankField(true), blankField(false)];
}

function flipSimple(rawIn: string | undefined, flat: string, corrector: (v: string) => [string, boolean], fullPat: RegExp, required = true): OcrField {
  const raw = (rawIn || '').trim();
  if (!raw) return blankField(required);
  const [corrected, changed] = corrector(raw);
  const autoCorrected = changed && corrected !== raw;
  if (!fullPat.test(corrected)) {
    return { value: corrected, raw, auto_corrected: autoCorrected, grounded: false, format_ok: false, confidence: 'low' };
  }
  const tail = corrected.includes('/') ? (corrected.split('/').pop() || '') : corrected;
  const lvl = level(corrected, raw, flat, tail);
  return { value: corrected, raw, auto_corrected: autoCorrected, grounded: lvl !== 'none', format_ok: true, confidence: LVL_CONF[lvl] };
}

// เลขกรมธรรม์ (descriptive) — ไม่บังคับ, ไม่มี regex ตายตัว; grounded ด้วย Vision → high, ไม่งั้น low (flag)
function flipPolicy(rawIn: string | undefined, flat: string): OcrField {
  const raw = (rawIn || '').trim();
  if (!raw) return blankField(false);
  const grounded = flat.includes(norm(raw));
  return { value: raw, raw, auto_corrected: false, grounded, format_ok: true, confidence: grounded ? 'high' : 'low' };
}

// ข้อความอิสระ (เช่น สถานที่เกิดเหตุ) — ไม่มี regex; grounded ด้วย Vision → high, ไม่งั้น medium (ข้อความยาวอาจไม่ตรงเป๊ะ)
function flipText(rawIn: string | undefined, flat: string): OcrField {
  const raw = (rawIn || '').trim();
  if (!raw) return blankField(false);
  const grounded = flat.includes(norm(raw));
  return { value: raw, raw, auto_corrected: false, grounded, format_ok: true, confidence: grounded ? 'high' : 'medium' };
}

// "วันที่รับแจ้ง" (+เวลา) → "dd/mm/พ.ศ.|HH:mm" ตรงกับที่มือถืออ่าน (splitDT/_combineDT)
// - ปี: 2 หลัก → +2500 (พ.ศ. ย่อ), ค.ศ. (<2500) → +543; วัน/เดือนเติม 0 นำ
// - เวลา: รับ 13:21, 13.21, 13:21:00, "13:21 น." → HH:mm; ไม่มีเวลา = ส่งวันที่อย่างเดียว
// วันที่มักอ่านพลาดง่าย → confidence medium/low ให้ callcenter ตรวจก่อนสร้างเคสเสมอ
function flipReportDate(dateRaw: string | undefined, timeRaw: string | undefined, flat: string): OcrField {
  const draw = (dateRaw || '').trim();
  if (!draw) return blankField(false);
  const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(draw);
  if (!dm) return { value: '', raw: draw, auto_corrected: false, grounded: false, format_ok: false, confidence: 'low' };
  let yr = parseInt(dm[3], 10);
  if (yr < 100) yr += 2500;        // พ.ศ. ย่อ 2 หลัก (69 → 2569)
  else if (yr < 2500) yr += 543;   // ค.ศ. → พ.ศ. (2026 → 2569)
  const date = `${dm[1].padStart(2, '0')}/${dm[2].padStart(2, '0')}/${yr}`;
  let time = '';
  const tm = /(\d{1,2})[:.](\d{2})/.exec((timeRaw || '').trim());
  if (tm) time = `${tm[1].padStart(2, '0')}:${tm[2]}`;
  const value = time ? `${date}|${time}` : date;
  const grounded = flat.includes(norm(`${dm[1].padStart(2, '0')}${dm[2].padStart(2, '0')}`)) || flat.includes(norm(draw));
  return { value, raw: (timeRaw || '').trim() ? `${draw} ${(timeRaw || '').trim()}` : draw, auto_corrected: value.split('|')[0] !== draw, grounded, format_ok: true, confidence: grounded ? 'medium' : 'low' };
}

/**
 * เลขตัวเลขล้วน (ไอโออิ) — แก้ตัวอักษรที่ OCR สับสนให้เป็นเลขทั้งสตริง แล้วตรวจความยาว
 *
 * ปลอดภัยกว่าฝั่งไทยไพบูลย์ตรงที่ **รู้ว่าทุกตำแหน่งต้องเป็นตัวเลข** จึงไม่ต้องมี template
 * ต่อความยาว (ที่ฝั่งนู้นถ้าความยาวไม่ตรงจะไม่กล้าแตะเลย)
 */
function flipDigits(rawIn: string | undefined, flat: string, pat: RegExp, required: boolean): OcrField {
  const raw = (rawIn || '').trim();
  if (!raw) return blankField(required);
  // ตัดตัวคั่นที่คนใส่มาเอง (เว้นวรรค/ขีด) ก่อน แล้วค่อยแก้ตัวอักษร→ตัวเลข
  const stripped = raw.replace(/[\s-]/g, '');
  const fixed = stripped.split('').map((c) => (isDigit(c) ? c : (TO_DIGIT[c.toUpperCase()] ?? c))).join('');
  const autoCorrected = fixed !== raw;
  if (!pat.test(fixed)) {
    // ความยาวไม่เข้าเกณฑ์ = อ่านไม่ครบ/อ่านเกิน → ส่งค่าให้คนเห็นแต่ตีธง low
    return { value: fixed, raw, auto_corrected: autoCorrected, grounded: false, format_ok: false, confidence: 'low' };
  }
  const lvl = level(fixed, raw, flat, fixed.slice(-6));
  return { value: fixed, raw, auto_corrected: autoCorrected, grounded: lvl !== 'none', format_ok: true, confidence: LVL_CONF[lvl] };
}

/** เลขเรื่องเซอร์เวย์ของไอโออิ (SEABI-…) — มีบางใบ ไม่มีก็ไม่ใช่ปัญหา จึง required=false */
function flipSeabi(rawCodes: string[] | undefined, flat: string): OcrField {
  for (const rawIn of rawCodes || []) {
    const raw = (rawIn || '').trim();
    if (!raw) continue;
    const m = SEABI_GRAB.exec(raw.replace(/\s/g, '').toUpperCase());
    if (!m) continue;
    let value = m[0];
    if (!value.includes('-')) value = value.replace('SEABI', 'SEABI-');
    const digits = value.split('-')[1] || '';
    const lvl = level(value, raw, flat, digits.slice(-6));
    return { value, raw, auto_corrected: value !== raw, grounded: lvl !== 'none', format_ok: true, confidence: LVL_CONF[lvl] };
  }
  return blankField(false);
}

/** ไอโออิ: ทุกเลขเป็นตัวเลขล้วนและมีป้ายชื่อช่องกำกับ → ไม่ต้องเดาว่าโค้ดไหนคืออะไร */
function extractAioi(mapped: GeminiMap, flat: string): FlippedResult['fields'] {
  return {
    claim_received: flipDigits(mapped.claim_received, flat, AIOI_RECV, true),
    claim_no: flipDigits((mapped.claim_codes || [])[0], flat, AIOI_CLAIM, true),
    prb_no: flipDigits(mapped.prb_no, flat, AIOI_PRB, false),
    survey_no: flipSeabi(mapped.survey_codes, flat),
    survey_no_2: blankField(false),   // ไอโออิไม่มีงานที่ 2 บนการ์ด
    policy_no: flipDigits(mapped.policy_no, flat, AIOI_POLICY, false),
    chassis_no: flipPolicy(mapped.chassis_no, flat),
    incident_location: flipText(mapped.incident_location, flat),
    customer_report: flipReportDate(mapped.report_date, mapped.report_time, flat),
  };
}

export async function flippedExtract(imagePath: string, insurer: Insurer = 'TPB'): Promise<FlippedResult> {
  const buf = await fs.promises.readFile(imagePath);
  const [mapped, flatRaw] = await Promise.all([geminiImageMap(buf, insurer), visionText(buf)]);
  const flat = norm(flatRaw);

  if (insurer === 'AIOI') {
    const fields = extractAioi(mapped, flat);
    return {
      image: imagePath.split(/[\\/]/).pop() || imagePath,
      // เลขเซอร์เวย์ไม่นับ — ไอโออิไม่มีบนการ์ดเป็นเรื่องปกติ ไม่ใช่สัญญาณว่าอ่านพลาด
      review_needed: fields.claim_no.confidence !== 'high' || fields.claim_received.confidence !== 'high',
      fields,
    };
  }

  const claim_received = flipSimple(mapped.claim_received, flat, correctClaimReceived, FULL_RECV);
  const [claim_no, prb_no] = flipClaim(mapped.claim_codes, flat);
  const [survey_no, survey_no_2] = flipSurvey(mapped.survey_codes, flat);
  const policy_no = flipPolicy(mapped.policy_no, flat);
  // เลขตัวถัง (VIN) — user ระบุว่าเป็น 1 ใน 5 เลขที่ต้องอ่านจริง (2026-08-13)
  // ใช้ flipPolicy ตัวเดียวกัน: ไม่มี regex บังคับรูปแบบ (VIN ของบางค่ายไม่ครบ 17 ตัว)
  // แต่ยัง grounded กับข้อความที่ Vision อ่านได้ → อ่านมั่วแล้วได้ confidence low ให้คนตรวจ
  const chassis_no = flipPolicy(mapped.chassis_no, flat);
  const incident_location = flipText(mapped.incident_location, flat);
  const customer_report = flipReportDate(mapped.report_date, mapped.report_time, flat);

  const review_needed =
    claim_no.confidence === 'medium' || claim_no.confidence === 'low' ||
    claim_received.confidence === 'low' || survey_no.confidence === 'low';

  return {
    image: imagePath.split(/[\\/]/).pop() || imagePath,
    review_needed,
    fields: { claim_received, claim_no, prb_no, survey_no, survey_no_2, policy_no, chassis_no, incident_location, customer_report },
  };
}
