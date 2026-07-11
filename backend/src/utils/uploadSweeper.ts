import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

// กวาดไฟล์ OCR temp ที่ค้างใน uploads root แล้วไม่ถูกย้ายเข้าเคส (orphan)
// - รูป OCR ตั้งชื่อ prefix 'up_' (multer.ts) — ถ้าถูกใช้จริงจะถูก renameSync เข้า subfolder {claim}/{job}/
//   ไฟล์ที่ยังอยู่ root เกิน TTL = orphan (เช่น มือถือสแกนใบเคลมแล้วไม่เคยส่ง ocr_image_paths)
// - รูปลงเวลา (prefix 'att_') และรูปที่ย้ายเข้าเคส (อยู่ใน subfolder) ไม่ถูกแตะ
const TTL_MS = 12 * 60 * 60 * 1000;        // 12 ชม. (เผื่อ web กรอกฟอร์มสร้างเคสนาน)
const SWEEP_EVERY_MS = 60 * 60 * 1000;     // ทุก 1 ชม.

function sweepOnce(): void {
  const root = path.resolve(env.UPLOAD_DIR);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return; // โฟลเดอร์ยังไม่มี — ข้าม
  }
  const now = Date.now();
  for (const e of entries) {
    if (!e.isFile() || !e.name.startsWith('up_')) continue;
    const fp = path.join(root, e.name);
    try {
      const st = fs.statSync(fp);
      if (now - st.mtimeMs > TTL_MS) fs.unlinkSync(fp);
    } catch { /* skip */ }
  }
}

export function startUploadSweeper(): void {
  sweepOnce();
  const t = setInterval(sweepOnce, SWEEP_EVERY_MS);
  t.unref?.(); // ไม่กันโปรเซสปิด
}
