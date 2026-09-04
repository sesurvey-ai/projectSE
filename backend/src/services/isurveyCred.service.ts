/**
 * บัญชี ISURVEY รายคน (user_isurvey_credentials) — เก็บรหัสผ่านเข้ารหัส ให้เซิร์ฟเวอร์ใช้ดึงงาน
 * "รอตรวจข้อมูล" เข้าเว็บด้วยบัญชีของคนที่กด (user ตัดสิน 04/09/69 · migration 050)
 *
 * กติกา
 *  - รหัสผ่านไม่เคยส่งกลับให้เบราว์เซอร์ ไม่ลง log · ถอดรหัสเฉพาะตอนจะส่งให้ service ดึงงานต่อคำขอ
 *  - AES-256-GCM ด้วย CRED_KEY (32 ไบต์ hex/base64) ใน env ของ backend — ไม่มี key = ฟีเจอร์ปิด (503 บอกชัด)
 *  - iv สุ่มใหม่ทุกครั้ง · รูปแบบเก็บ base64(iv|tag|ciphertext) — ดูคอมเมนต์ใน migration
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { db } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

function key(): Buffer {
  const k = String(env.CRED_KEY ?? '').trim();
  if (!k) throw new AppError(503, 'เซิร์ฟเวอร์ยังไม่ได้ตั้ง CRED_KEY — เก็บบัญชี ISURVEY ไม่ได้');
  const buf = /^[0-9a-fA-F]{64}$/.test(k) ? Buffer.from(k, 'hex') : Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new AppError(503, 'CRED_KEY ต้องเป็นกุญแจ 32 ไบต์ (hex 64 ตัว หรือ base64)');
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decryptSecret(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 29) throw new AppError(500, 'รหัสผ่านที่เก็บไว้เสียหาย — ให้ผู้ใช้กรอกใหม่');
  const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  try {
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch {
    // key เปลี่ยน / ข้อมูลเสีย — บอกให้กรอกใหม่ ไม่ใช่ 500 ลอย ๆ
    throw new AppError(409, 'ถอดรหัสผ่านที่เก็บไว้ไม่ได้ (กุญแจเซิร์ฟเวอร์เปลี่ยน?) — กรอกบัญชี ISURVEY ใหม่');
  }
}

export interface CredStatus {
  username: string;
  display_name: string | null;
  updated_at: string;
  last_ok_at: string | null;
  last_error: string | null;
}

export const isurveyCredService = {
  enabled(): boolean {
    return Boolean(String(env.CRED_KEY ?? '').trim());
  },

  async getStatus(userId: number): Promise<CredStatus | null> {
    const r = await db.query(
      `SELECT username, display_name, updated_at, last_ok_at, last_error
         FROM user_isurvey_credentials WHERE user_id = $1`, [userId]);
    return (r.rows[0] as CredStatus | undefined) ?? null;
  },

  async save(userId: number, username: string, password: string): Promise<void> {
    const u = String(username ?? '').trim();
    const p = String(password ?? '');
    if (!u || !p) throw new AppError(400, 'ต้องกรอกทั้ง username และ password ของ ISURVEY');
    await db.query(
      `INSERT INTO user_isurvey_credentials (user_id, username, password_enc, updated_at, last_ok_at, last_error)
       VALUES ($1, $2, $3, now(), NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE
         SET username = EXCLUDED.username, password_enc = EXCLUDED.password_enc,
             updated_at = now(), last_ok_at = NULL, last_error = NULL, display_name = NULL`,
      [userId, u, encryptSecret(p)]);
  },

  async remove(userId: number): Promise<void> {
    await db.query('DELETE FROM user_isurvey_credentials WHERE user_id = $1', [userId]);
  },

  /** ใช้เฉพาะตอนจะเรียก service ดึงงาน — ห้ามส่งค่านี้ออกทาง HTTP */
  async getPlain(userId: number): Promise<{ username: string; password: string }> {
    const r = await db.query(
      'SELECT username, password_enc FROM user_isurvey_credentials WHERE user_id = $1', [userId]);
    if (r.rows.length === 0) {
      throw new AppError(412, 'ยังไม่ได้ตั้งบัญชี ISURVEY — ไปที่เมนู "บัญชี ISURVEY" ก่อน');
    }
    return { username: r.rows[0].username, password: decryptSecret(r.rows[0].password_enc) };
  },

  async markResult(userId: number, ok: boolean, error?: string, displayName?: string): Promise<void> {
    if (ok) {
      await db.query(
        `UPDATE user_isurvey_credentials
            SET last_ok_at = now(), last_error = NULL, display_name = COALESCE(NULLIF($2, ''), display_name)
          WHERE user_id = $1`, [userId, displayName ?? '']);
    } else {
      await db.query(
        'UPDATE user_isurvey_credentials SET last_error = $2 WHERE user_id = $1',
        [userId, String(error ?? 'ล็อกอินไม่สำเร็จ').slice(0, 500)]);
    }
  },
};
