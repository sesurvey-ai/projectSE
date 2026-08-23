import { AppError } from '../middleware/errorHandler';

/**
 * กติกาความแข็งแรงของรหัสผ่าน — ที่เดียวสำหรับทุกทางที่ตั้งรหัส
 * (เปลี่ยนรหัสเอง · แอดมินสร้างผู้ใช้ · แอดมินรีเซ็ตรหัสให้คนอื่น)
 *
 * ตั้งใจไม่บังคับ "ต้องมีตัวใหญ่ ตัวเล็ก ตัวเลข อักขระพิเศษ" — คนใช้งานจริงคือช่างสำรวจ
 * ที่พิมพ์บนมือถือกลางแดด กฎแบบนั้นได้รหัสอย่าง `Abc123!@` ที่จำยากแต่เดาง่าย
 * และลงเอยด้วยการจดใส่กระดาษแปะไว้ · ความยาวกับการไม่ใช้คำที่เดาได้มีผลจริงมากกว่า
 *
 * ⚠️ ไม่ได้บังคับย้อนหลัง — บัญชีที่มีรหัสอ่อนอยู่แล้วยังเข้าได้ตามปกติ
 *    กติกานี้มีผลตอน "ตั้งรหัสใหม่" เท่านั้น
 */

export const PASSWORD_MIN = 8;

/** ข้อความอธิบายกติกา — ใช้ทั้งฝั่ง API และให้หน้าเว็บลอกไปแสดงใต้ช่องกรอก */
export const PASSWORD_RULE_TEXT =
  `อย่างน้อย ${PASSWORD_MIN} ตัวอักษร · ห้ามเป็นชื่อผู้ใช้ · ห้ามเป็นคำที่เดาง่าย`;

/** รหัสที่เจอบ่อยจนเดาได้ในไม่กี่ครั้ง — เทียบแบบตัวพิมพ์เล็กทั้งหมด */
const BLOCKLIST = new Set([
  '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123',
  'abcd1234', 'a1234567', 'admin123', 'sesurvey', 'survey123',
  'iloveyou', 'welcome1', 'letmein1',
]);

/** เลขเรียงขึ้น/ลงทั้งสตริง เช่น 12345678 / 87654321 */
function isRun(s: string): boolean {
  if (!/^\d+$/.test(s) || s.length < 4) return false;
  const step = Number(s[1]) - Number(s[0]);
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < s.length; i++) {
    if (Number(s[i]) - Number(s[i - 1]) !== step) return false;
  }
  return true;
}

/**
 * โยน 400 พร้อมเหตุผลภาษาไทยที่บอกว่า "ต้องแก้อะไร" ไม่ใช่แค่ "รหัสไม่ผ่าน"
 * @param username ชื่อผู้ใช้ของบัญชีที่กำลังตั้งรหัส (ถ้ามี) — ใช้กันตั้งรหัส = ชื่อผู้ใช้
 */
export function assertStrongPassword(password: unknown, username?: string): string {
  if (typeof password !== 'string' || password.trim() === '') {
    throw new AppError(400, 'ยังไม่ได้กรอกรหัสผ่านใหม่');
  }
  // ไม่ trim ตัวรหัสจริง (ช่องว่างเป็นส่วนหนึ่งของรหัสได้) แต่ห้ามเป็นช่องว่างล้วน
  const pw = password;

  if (pw.length < PASSWORD_MIN) {
    throw new AppError(400, `รหัสผ่านสั้นเกินไป — ต้องอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`);
  }
  const low = pw.toLowerCase();

  if (username && username.trim()) {
    const u = username.trim().toLowerCase();
    // ทั้ง 2 ทาง — `se408` ตั้งรหัส `se408se408` ก็ยังเดาจากชื่อผู้ใช้ได้อยู่ดี
    if (low === u || low.includes(u) || u.includes(low)) {
      throw new AppError(400, 'รหัสผ่านห้ามเป็นชื่อผู้ใช้ (หรือมีชื่อผู้ใช้อยู่ในนั้น)');
    }
  }

  if (low.includes('password') || pw.includes('รหัสผ่าน')) {
    throw new AppError(400, 'รหัสผ่านห้ามมีคำว่า "password" — เป็นคำแรก ๆ ที่คนเดา');
  }
  if (BLOCKLIST.has(low)) {
    throw new AppError(400, 'รหัสผ่านนี้อยู่ในรายการที่ถูกเดาบ่อยที่สุด — เปลี่ยนเป็นอย่างอื่น');
  }
  if (isRun(low)) {
    throw new AppError(400, 'รหัสผ่านห้ามเป็นตัวเลขเรียงกัน (เช่น 12345678)');
  }
  if (new Set(pw).size === 1) {
    throw new AppError(400, 'รหัสผ่านห้ามเป็นตัวอักษรเดียวซ้ำกันทั้งหมด');
  }
  return pw;
}
