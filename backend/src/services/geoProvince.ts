import bounds from '../data/thaiProvinceBounds.json';

/**
 * พิกัด → ชื่อจังหวัด (ภาษาไทย)
 *
 * ใช้จัดกลุ่มช่างสำรวจตอนจ่ายงาน: "คนที่อยู่ในจังหวัดที่เกิดเหตุ" ขึ้นก่อน
 *
 * ⛔ **อย่าเปลี่ยนไปใช้วิธี "ใกล้จุดกลางจังหวัดไหนสุด"** — กรุงเทพ/สมุทรปราการ/นนทบุรี/
 *    ปทุมธานี ติดกันหมด คนอยู่บางนาห่างเขตสมุทรปราการแค่ ~5 กม. จะถูกจับผิดจังหวัดเป็นว่าเล่น
 *    และ 26 จาก 35 คนอยู่โซนนี้พอดี = พังตรงที่มีคนเยอะที่สุด · ต้องเช็คว่าจุดอยู่ในรูปจริง
 *
 * ข้อมูลขอบเขต: github.com/apisit/thailand.json (77 จังหวัด) แปลงชื่อเป็นไทยให้ตรงกับ
 * รายชื่อจังหวัดที่ระบบใช้ (`web/src/data/thai_provinces.json`) แล้วลดทศนิยมเหลือ 4 ตำแหน่ง
 * (~11 เมตร) — ละเอียดเกินพอสำหรับการบอกว่าอยู่จังหวัดไหน
 */

type Ring = number[][];                                   // [[lng, lat], ...]
type Entry = { bbox: number[]; rings: Ring[] };           // bbox = [minLng, minLat, maxLng, maxLat]

const DATA = bounds as unknown as Record<string, Entry>;

/**
 * ray casting — นับจำนวนครั้งที่เส้นตรงจากจุดนี้ไปทางขวาตัดขอบรูป
 * จำนวนคี่ = อยู่ข้างใน · ใช้ได้กับรูปเว้าแหว่ง/มีเกาะ ซึ่งจังหวัดไทยเป็นแบบนั้นเยอะ
 */
function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * @returns ชื่อจังหวัดภาษาไทย (เช่น "สมุทรปราการ") หรือ null ถ้าจุดไม่อยู่ในจังหวัดไหนเลย
 *          (นอกประเทศ · กลางทะเล · พิกัดเพี้ยน) — ผู้เรียกต้องรับมือกับ null เสมอ
 */
export function provinceOf(lat: unknown, lng: unknown): string | null {
  const y = typeof lat === 'string' ? parseFloat(lat) : (lat as number);
  const x = typeof lng === 'string' ? parseFloat(lng) : (lng as number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  for (const [name, entry] of Object.entries(DATA)) {
    const [minX, minY, maxX, maxY] = entry.bbox;
    // ตัดทิ้งด้วยกรอบสี่เหลี่ยมก่อน — เร็วกว่าไล่ทุกจุดของทุกจังหวัดมาก
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    for (const ring of entry.rings) {
      if (inRing(x, y, ring)) return name;
    }
  }
  return null;
}

/** ชื่อจังหวัดมาตรฐานที่ระบบใช้ (77 ชื่อ ตรงกับ web/src/data/thai_provinces.json) */
export const PROVINCE_NAMES: string[] = Object.keys(DATA);

const NORM = new Map<string, string>();
for (const name of PROVINCE_NAMES) NORM.set(name.replace(/[\s.ฯ]/g, ''), name);
// กรุงเทพเขียนได้หลายแบบบนเอกสารแต่ละเจ้า — ระบบเก็บเป็น "กรุงเทพ ฯ" แบบเดียว
for (const alias of ['กรุงเทพมหานคร', 'กรุงเทพ', 'กทม', 'Bangkok']) NORM.set(alias.replace(/[\s.ฯ]/g, ''), 'กรุงเทพ ฯ');

/**
 * ชื่อจังหวัดจากเอกสาร → ชื่อมาตรฐานของระบบ
 * รับได้ทั้ง "สมุทรปราการ" · "จ.สมุทรปราการ" · "จังหวัดสมุทรปราการ" · "กรุงเทพฯ"
 * @returns ชื่อมาตรฐาน หรือ null ถ้าไม่ใช่จังหวัดที่รู้จัก (ห้ามเดา — ผิดแล้วเคสไปกองผิดกลุ่ม)
 */
export function normalizeProvince(raw: unknown): string | null {
  const t = String(raw ?? '').trim().replace(/^(จังหวัด|จ\.)\s*/, '').replace(/[\s.ฯ]/g, '');
  if (!t) return null;
  return NORM.get(t) ?? null;
}

/**
 * ชื่ออำเภอ/เขตจากเอกสาร → รูปแบบที่ระบบใช้ ("อำเภอเมือง" / "เขตบางกะปิ")
 *
 * ⚠️ ใบไทยไพบูลย์เขียน "อำเภอเมืองสมุทรปราการ" แต่ระบบเก็บ "อำเภอเมือง" —
 *    ต้องตัดชื่อจังหวัดที่ต่อท้าย "เมือง" ออก ไม่งั้นจับคู่ไม่ติดทุกจังหวัด
 */
export function normalizeDistrict(raw: unknown, province?: string | null): string | null {
  let t = String(raw ?? '').trim();
  if (!t || t === '-') return null;
  const isBkk = province === 'กรุงเทพ ฯ';
  t = t.replace(/^(อำเภอ|อ\.|เขต)\s*/, '');
  if (province) {
    const bare = province.replace(/[\s.ฯ]/g, '');
    if (t.startsWith('เมือง') && t.replace(/[\s.ฯ]/g, '') === 'เมือง' + bare) t = 'เมือง';
  }
  return (isBkk ? 'เขต' : 'อำเภอ') + t;
}
