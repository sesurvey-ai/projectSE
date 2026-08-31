import centroids from '../data/thaiDistrictCentroids.json';
import { amphurCode, provinceCode } from './areaCode.service';
import { TH_AMPHURS } from '../data/thaiAreaCodes';

/**
 * ชื่อจังหวัด+อำเภอ → **จุดกลางของอำเภอนั้น**
 *
 * ทำไมต้องมี: หน้าจ่ายงานเรียงช่างตามระยะทางได้เฉพาะเคสที่มีพิกัด ซึ่งเดิมมีแต่
 * งานไอโออิที่การ์ดพิมพ์ `LatLng` มาให้ — ไทยไพบูลย์ไม่มีเลยสักใบ
 *
 * จุดพลิก (user ยืนยัน 24/08/69): **`LatLng` บนการ์ดไอโออิไม่ใช่จุดเกิดเหตุจริง —
 * มันคือจุดกลางของอำเภอนั้นอยู่แล้ว** พอรู้แบบนี้เราสร้างเองได้จากชื่ออำเภอ
 * แล้วครอบคลุมทั้ง 2 บริษัท (+ ไอโออิใบที่ไม่ได้พิมพ์พิกัดมา)
 *
 * ⚠️ **ความละเอียดแค่ระดับอำเภอ ห้ามเรียกว่า "ระยะทางจริง" บนหน้าจอ** — อำเภอในไทย
 *    กว้างได้หลายสิบกิโลเมตร คนจ่ายงานที่เชื่อตัวเลขเกินจริงจะเลือกคนผิด
 *    ใช้ตอบได้แค่ "ใครน่าจะอยู่ใกล้กว่ากัน" ไม่ใช่ "ห่างกี่กิโล"
 *
 * ⛔ ชื่ออำเภอไม่ได้อยู่ในไฟล์พิกัด — ตั้งใจให้ชื่อมาจาก `thaiAreaCodes.ts` ที่เดียว
 *    ผ่าน `amphurCode()` ซึ่ง normalize 'อำเภอเมือง'/'เขตบางกะปิ'/'กรุงเทพ ฯ' ไว้ครบแล้ว
 *    (ไฟล์ต้นทางของ OCHA ตัดชื่อที่ 16 ตัวอักษร — 'ป้อมปราบศัตรูพ่า' — ใช้ตรง ๆ ไม่ได้)
 *
 * ข้อมูล: `data/thaiDistrictCentroids.json` (928 อำเภอ) สร้างด้วย
 * `backend/scripts/gen_district_centroids.py` จากขอบเขตอำเภอของ UN OCHA (CC BY-IGO)
 */

const DATA = centroids as unknown as Record<string, [number, number]>;

export interface Centroid { lat: number; lng: number }

/** จุดกลางจากรหัสอำเภอมาตรฐาน 4 หลัก (เช่น '1001' = เขตพระนคร) */
export function districtCentroidByCode(code?: string | null): Centroid | null {
  if (!code) return null;
  const p = DATA[code];
  return p ? { lat: p[0], lng: p[1] } : null;
}

/**
 * @param province ชื่อจังหวัดอย่างที่ระบบเก็บ ('กรุงเทพ ฯ', 'สมุทรปราการ')
 * @param district ชื่ออำเภอ/เขตอย่างที่ระบบเก็บ ('อำเภอเมือง', 'เขตบางนา')
 * @returns null เมื่อจับคู่ชื่อไม่ได้ หรืออำเภอนั้นไม่มีในขอบเขตปี 2019
 *          (76 รายการใน `TH_AMPHURS` เป็นสาขา/เทศบาล/ของเลิกใช้ที่ไม่ใช่อำเภอจริง)
 *          ผู้เรียกต้องรับมือกับ null เสมอ — ห้ามเดาเป็นจุดกลางจังหวัดแทน
 */
export function districtCentroid(
  province?: string | null, district?: string | null,
): Centroid | null {
  return districtCentroidByCode(amphurCode(province, district));
}

/** มีพิกัดของอำเภอกี่แห่ง — ไว้ให้เทสยืนยันว่าไฟล์ข้อมูลไม่ได้หายไปตอน build */
export const DISTRICT_COUNT = Object.keys(DATA).length;

/**
 * พิกัด → **อำเภอที่ใกล้ที่สุดภายในจังหวัดนั้น** (ใช้เป็น "ข้อเสนอ" ให้คนยืนยัน)
 *
 * ⚠️ **นี่คือการเดาจากจุดกลางอำเภอ ไม่ใช่การหาว่าพิกัดตกในขอบเขตอำเภอไหนจริง ๆ**
 *    เรามีแค่จุดกลาง ไม่มีรูปร่างขอบเขตรายอำเภอ — อำเภอรูปยาว/พิกัดใกล้รอยต่อ
 *    ตอบผิดได้ · จึงห้ามเอาไปตัดสินใจอะไรเองเด็ดขาด ต้องให้คนยืนยันเสมอ
 *    (จังหวัดต่างกัน — `provinceOf()` ใช้ขอบเขตจริง เชื่อได้)
 *
 * คืน null เมื่อไม่รู้จังหวัด หรือจังหวัดนั้นไม่มีข้อมูลอำเภอ — ผู้เรียกต้องให้คนเลือกเอง
 */
export function nearestDistrict(
  lat: number, lng: number, province?: string | null,
): string | null {
  const pcode = provinceCode(province);
  if (!pcode) return null;
  let best: { code: string; d2: number } | null = null;
  for (const [code, [dlat, dlng]] of Object.entries(DATA)) {
    if (!code.startsWith(pcode)) continue;
    // ระยะกำลังสองแบบหยาบ ๆ พอ — เทียบกันเองในจังหวัดเดียว ไม่ได้เอาไปโชว์เป็นกิโลเมตร
    const dy = dlat - lat;
    const dx = (dlng - lng) * Math.cos((lat * Math.PI) / 180);
    const d2 = dy * dy + dx * dx;
    if (!best || d2 < best.d2) best = { code, d2 };
  }
  return best ? (TH_AMPHURS[best.code] ?? null) : null;
}
