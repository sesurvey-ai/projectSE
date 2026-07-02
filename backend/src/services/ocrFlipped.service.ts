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

const GEMINI_MODEL = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// anchored validators (Python re.fullmatch → JS ^...$ + .test)
const FULL_RECV = /^[A-Z]{2}\d{2}\/\d{3,5}\/\d{3,6}$/;
const FULL_CLAIMNO = /^\d{2}[A-Z]{2}\d{2}[A-Z]{2,4}-\d{3,5}-\d{4,6}$/;
const SURVEY_GRAB = /SETP-?\d{6,9}/;

// OCR character-confusion tables (ใช้เฉพาะตำแหน่งที่รู้ class จาก template)
const TO_DIGIT: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', A: '4', S: '5', G: '6', T: '7', B: '8' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '7': 'T', '8': 'B', '9': 'P' };

const PROMPT =
  'This is an IMAGE of a Thai motor-insurance claim form (ใบรับแจ้งเคลม). Extract:\n' +
  '- "claim_received": the เลขรับแจ้ง code (like BR10/6906/13144); "" if absent\n' +
  '- "claim_codes": array of every claim code (like 21BR10AVD-6906-000098; the 3 letters are AVD or ACD)\n' +
  '- "survey_codes": array of every survey number (starts SETP-). If the survey field shows only a placeholder "-" or "รอแจ้ง", return ["-"] or ["รอแจ้ง"].\n\n' +
  'CRITICAL: Read ONLY characters that are clearly and unambiguously printed. If ANY character in a code is blurry, faded, hidden, cut off, or you are not fully certain of it, OMIT that code entirely (do not include it). Do NOT guess, complete, or reconstruct missing characters. Returning fewer/blank is better than returning a wrong code.';

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    claim_received: { type: Type.STRING },
    claim_codes: { type: Type.ARRAY, items: { type: Type.STRING } },
    survey_codes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['claim_received', 'claim_codes', 'survey_codes'],
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
  const [resp] = await visionClient().documentTextDetection({
    image: { content: buf },
    imageContext: { languageHints: ['th', 'en'] },
  });
  if (resp.error?.message) throw new Error(`Vision error: ${resp.error.message}`);
  return resp.fullTextAnnotation?.text ?? '';
}

type GeminiMap = { claim_received?: string; claim_codes?: string[]; survey_codes?: string[] };

// ── Gemini อ่านรูป (หลัก) + retry 429/5xx ──
async function geminiImageMap(buf: Buffer, tries = 6): Promise<GeminiMap> {
  const base64 = buf.toString('base64');
  let delay = 5000;
  for (let a = 1; a <= tries; a++) {
    try {
      const resp = await genaiClient().models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: PROMPT }] }],
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
      });
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

export async function flippedExtract(imagePath: string): Promise<FlippedResult> {
  const buf = fs.readFileSync(imagePath);
  const [mapped, flatRaw] = await Promise.all([geminiImageMap(buf), visionText(buf)]);
  const flat = norm(flatRaw);

  const claim_received = flipSimple(mapped.claim_received, flat, correctClaimReceived, FULL_RECV);
  const [claim_no, prb_no] = flipClaim(mapped.claim_codes, flat);
  const [survey_no, survey_no_2] = flipSurvey(mapped.survey_codes, flat);

  const review_needed =
    claim_no.confidence === 'medium' || claim_no.confidence === 'low' ||
    claim_received.confidence === 'low' || survey_no.confidence === 'low';

  return {
    image: imagePath.split(/[\\/]/).pop() || imagePath,
    review_needed,
    fields: { claim_received, claim_no, prb_no, survey_no, survey_no_2 },
  };
}
