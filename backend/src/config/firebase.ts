import admin from 'firebase-admin';
import { env } from './env';

let firebaseInitialized = false;

/** Firebase พร้อมใช้ไหม — ใช้ตอบ /health และตัดสินใจว่าจะยิง push ได้หรือเปล่า */
export function isFirebaseReady(): boolean {
  return firebaseInitialized;
}

// ⚠️ **ห้าม throw จากที่นี่** — index.ts เรียกเป็น top-level ไม่มี try/catch และ
// container ตั้ง restart: unless-stopped → คีย์ผิดตัวเดียวจะกลายเป็น crash loop
// ที่ทำให้ทั้ง API ล่ม (รวม OCR ที่ไม่ได้ใช้ firebase-admin เลย)
// อยาก fail-fast จริง ๆ ให้ตั้ง FCM_REQUIRED=1 แล้ว index.ts เป็นคนตัดสินใจปิดตัวเอง
export function initFirebase(): boolean {
  if (firebaseInitialized) return true;

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized');
    return true;
  }
  // เดิมเป็น console.warn บรรทัดเดียว — ไม่มีใครเห็น แล้วช่างก็ไม่ได้รับแจ้งงาน
  // โดยไม่มี error ที่ไหนเลย ต้องดังพอที่จะสะดุดตาใน log
  const bar = '='.repeat(70);
  console.error([
    '', bar,
    '[FCM] ❌ Firebase ไม่ได้ตั้งค่า — แจ้งเตือนงานใหม่ไปไม่ถึงเครื่องช่างเลย',
    '[FCM]    ต้องตั้ง FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL',
    '[FCM]    ตรวจสถานะได้ที่ GET /health (firebase: false)',
    bar, '',
  ].join('\n'));
  return false;
}

export { admin };
