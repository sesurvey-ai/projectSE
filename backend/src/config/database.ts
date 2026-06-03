import { Pool } from 'pg';
import { env } from './env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  keepAlive: true,
});

// Supavisor (pooler ของ Supabase บน VPS) ตัดการเชื่อมต่อที่ idle เป็นระยะ
// (FATAL "{:shutdown, :db_termination}") ทำให้ pg ยิง event 'error' ออกมาจาก
// client ที่ค้างอยู่ใน pool — ถ้าไม่มี listener ตัวนี้ Node จะถือเป็น unhandled
// error แล้ว crash ทั้ง process (เป็นเหตุให้ backend ดับเองแล้วล็อกอินไม่ได้).
// ดักไว้ log เฉย ๆ; pool จะทิ้ง client ตัวที่เสียแล้วเปิดใหม่เองตอน query ครั้งถัดไป
pool.on('error', (err) => {
  console.error('[db] idle client error (pool จะ recover เอง):', err.message);
});

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  getClient: () => pool.connect(),
};
