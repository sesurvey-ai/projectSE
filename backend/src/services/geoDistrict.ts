import centroids from '../data/thaiDistrictCentroids.json';
import { amphurCode } from './areaCode.service';

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
