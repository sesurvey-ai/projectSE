import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from './env';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(env.UPLOAD_DIR));
  },
  filename: (_req, file, cb) => {
    // ชื่อไฟล์ที่เซฟต้องไม่ซ้ำ — กันไฟล์ทับกันข้ามเคสเมื่อ client ส่งชื่อคงที่
    // (เช่น 'arrival.jpg' จากมือถือ, 'capture.png' จากเว็บ) ที่อัปโหลดพร้อมกัน
    // ปลายทาง (โฟลเดอร์เคส) ยังตั้งชื่อจาก file.originalname ตามเดิม — ไม่กระทบ logic
    const ext = (path.extname(file.originalname || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
    cb(null, `up_${Date.now()}_${randomUUID().slice(0, 8)}${ext || '.jpg'}`);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter,
});

// ชื่อไฟล์ไม่ซ้ำ (ใช้กับรูปลงเวลาเข้างาน ฯลฯ ที่ผู้ใช้หลายคนถ่ายพร้อมกัน) — กันไฟล์ทับกัน
const uniqueStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(env.UPLOAD_DIR));
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
    cb(null, `att_${Date.now()}_${randomUUID().slice(0, 8)}${ext || '.jpg'}`);
  },
});

export const uploadUnique = multer({
  storage: uniqueStorage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter,
});
