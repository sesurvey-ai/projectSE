import { z } from 'zod';

/**
 * ช่องตัวเลขที่อาจถูกส่งมาเป็นข้อความ
 *
 * ฟอร์มบนเว็บเก็บทุกช่องเป็นข้อความ และค่าที่อ่านจากรูป (เช่นพิกัดบนการ์ดไอโออิ)
 * ก็มาเป็นข้อความ — ส่งดิบ ๆ ไปเจอ `z.number()` แล้วโดนตีกลับ
 * "Expected number, received string" ทั้งฟอร์มโดยที่คนกรอกไม่รู้ว่าผิดตรงไหน
 *
 * ⛔ **ห้ามใช้ `z.coerce.number()` แทน** — ค่าว่างจะกลายเป็น `0` เงียบ ๆ
 *    สำหรับพิกัดแปลว่าเคสไปโผล่ที่ (0,0) กลางอ่าวกินี แล้วระยะทางเพี้ยนทั้งรายการ
 *    ว่าง/อ่านไม่ออก = **ไม่ส่งค่านั้นเลย** ไม่ใช่ส่งศูนย์
 */
export const numericOrBlank = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());
