/**
 * Shared OCR clients (Gemini via Vertex + Google Vision) — Firebase SA ตัวเดียว
 * แยกออกมาให้ documentOcr (บัตร/ใบขับขี่) ใช้ร่วมได้ โดยไม่แตะ ocrFlipped (ใบเคลม) ที่ทำงานอยู่
 */
import { GoogleGenAI } from '@google/genai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { env } from '../config/env';

export const GEMINI_MODEL = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

let _genai: GoogleGenAI | null = null;
let _vision: ImageAnnotatorClient | null = null;

function firebaseCreds(): { projectId: string; credentials: { client_email: string; private_key: string } } | null {
  const projectId = env.FIREBASE_PROJECT_ID;
  const client_email = env.FIREBASE_CLIENT_EMAIL;
  const pk = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !client_email || !pk) return null;
  return { projectId, credentials: { client_email, private_key: pk.replace(/\\n/g, '\n') } };
}

export function genaiClient(): GoogleGenAI {
  if (_genai) return _genai;
  const fb = firebaseCreds();
  if (env.GEMINI_VERTEX === '1' && fb) {
    _genai = new GoogleGenAI({
      vertexai: true,
      project: fb.projectId,
      location: env.GEMINI_LOCATION || 'us-central1',
      googleAuthOptions: { credentials: fb.credentials },
    });
  } else if (env.GEMINI_API_KEY) {
    _genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  } else {
    throw new Error('OCR Gemini: ตั้ง GEMINI_VERTEX=1 (+FIREBASE_*) หรือ GEMINI_API_KEY');
  }
  return _genai;
}

export function visionClient(): ImageAnnotatorClient {
  if (_vision) return _vision;
  const fb = firebaseCreds();
  _vision = fb ? new ImageAnnotatorClient({ projectId: fb.projectId, credentials: fb.credentials }) : new ImageAnnotatorClient();
  return _vision;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// timeout ต่อการเรียก external API (Gemini/Vision) — ให้ fail fast ไม่ค้าง request ยาว
// (undici default ~300s, gRPC ~600s นานเกินไป; มือถือ abort ที่ 30s อยู่แล้ว)
export const OCR_CALL_TIMEOUT_MS = 45000;
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// Vision OCR — คืนข้อความทั้งหน้า (ตัวตรวจอิสระ)
export async function visionText(buf: Buffer): Promise<string> {
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

// Gemini อ่านรูป → JSON ตาม schema (temperature 0) + retry 429/5xx
export async function geminiJson<T>(buf: Buffer, prompt: string, schema: object, tries = 6): Promise<T> {
  const base64 = buf.toString('base64');
  let delay = 5000;
  for (let a = 1; a <= tries; a++) {
    try {
      const resp = await withTimeout(
        genaiClient().models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: prompt }] }],
          config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 },
        }),
        OCR_CALL_TIMEOUT_MS,
        'Gemini generateContent'
      );
      return JSON.parse(resp.text ?? '{}') as T;
    } catch (e: unknown) {
      const err = e as { status?: number; code?: number; message?: string };
      const status = err.status ?? err.code;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500) || /\b(429|50\d|overloaded|unavailable|rate)/i.test(err.message || '');
      if (!retryable || a === tries) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 60000);
    }
  }
  throw new Error('geminiJson: exhausted retries');
}
