/**
 * การ์ดของ "จุดกลางอำเภอ"
 *
 * โจทย์: หน้าจ่ายงานเรียงช่างตามระยะทางได้เฉพาะเคสที่มีพิกัด ซึ่งเดิมมีแต่งานไอโออิ
 * ที่การ์ดพิมพ์ LatLng มาให้ · user ยืนยัน 24/08/69 ว่า **LatLng บนการ์ดคือจุดกลาง
 * อำเภออยู่แล้ว ไม่ใช่จุดเกิดเหตุจริง** → สร้างเองได้ ครอบคลุมไทยไพบูลย์ด้วย
 *
 * ครึ่งแรกเรียกฟังก์ชันจริง (ไม่แตะฐานข้อมูล/เน็ต) ครึ่งหลังตรวจการต่อสาย
 */
import * as fs from 'fs';
import * as path from 'path';
import { districtCentroid, districtCentroidByCode, DISTRICT_COUNT } from '../src/services/geoDistrict';
import { provinceOf, normalizeProvince } from '../src/services/geoProvince';
import { TH_AMPHURS, TH_PROVINCES } from '../src/data/thaiAreaCodes';
import centroids from '../src/data/thaiDistrictCentroids.json';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

console.log('\n── จุดกลางอำเภอ ──');
check('มีพิกัดครบ 928 อำเภอ', DISTRICT_COUNT === 928, String(DISTRICT_COUNT));
/** รหัสในไฟล์พิกัดต้องเป็นรหัสมาตรฐานชุดเดียวกับตารางชื่อ ไม่งั้นจับคู่ชื่อไม่ติดทั้งไฟล์ */
const codes = Object.keys(centroids as Record<string, [number, number]>);
check('ทุกรหัสมีชื่ออยู่ใน TH_AMPHURS', codes.every((c) => TH_AMPHURS[c] !== undefined));

/**
 * จุดที่ไล่เทียบกับของจริงด้วยตา — ผิดจังหวัดคือพังหนัก เพราะรายชื่อช่างจะกลับหัวทั้งหน้า
 * เขียนชื่ออำเภอแบบที่ระบบเก็บจริง (มีคำนำหน้า 'เขต'/'อำเภอ') เพื่อทดสอบตัว normalize ไปด้วย
 */
const SPOTS: [string, string, number, number][] = [
  ['กรุงเทพ ฯ', 'เขตพระนคร', 13.755, 100.498],
  ['กรุงเทพ ฯ', 'เขตหนองจอก', 13.853, 100.857],
  ['สมุทรปราการ', 'อำเภอเมือง', 13.60, 100.60],
  ['นนทบุรี', 'อำเภอปากเกร็ด', 13.93, 100.50],
  ['ชลบุรี', 'อำเภอบางละมุง', 12.92, 100.94],
];
for (const [prov, dist, lat, lng] of SPOTS) {
  const c = districtCentroid(prov, dist);
  const near = !!c && Math.abs(c.lat - lat) < 0.15 && Math.abs(c.lng - lng) < 0.15;
  check(`${dist} ${prov}`, near, c ? `${c.lat}, ${c.lng}` : 'ไม่เจอ');
}

/**
 * ⛔ กับดักที่เสียเวลาหาแน่ถ้าไม่ดัก: ไฟล์ต้นทางของ OCHA **ตัดชื่ออำเภอที่ 16 ตัวอักษร**
 *    ('ป้อมปราบศัตรูพ่า' ขาด 'ย' · 'เมืองประจวบคีรีข' · 'เมืองสุราษฎร์ธาน')
 *    ถ้าวันหลังมีคนเปลี่ยนไปคีย์ด้วยชื่อจากไฟล์นั้นแทนรหัส อำเภอพวกนี้จะหายเงียบ ๆ
 */
for (const [prov, dist] of [
  ['กรุงเทพ ฯ', 'เขตป้อมปราบศัตรูพ่าย'],
  ['ประจวบคีรีขันธ์', 'อำเภอเมือง'],
  ['สุราษฎร์ธานี', 'อำเภอเมือง'],
  ['นครศรีธรรมราช', 'อำเภอเมือง'],
]) check(`ชื่อยาวไม่โดนตัด: ${dist} ${prov}`, districtCentroid(prov, dist) !== null);

/** ไม่รู้ = คืน null · ⛔ ห้ามเดาเป็นจุดกลางจังหวัดหรืออำเภอชื่อใกล้เคียง */
check('อำเภอที่ไม่มีจริง → null', districtCentroid('ชลบุรี', 'อำเภอไม่มีอยู่จริง') === null);
check('ไม่ส่งชื่อมา → null', districtCentroid(null, null) === null);
check('อำเภอเมืองของจังหวัดที่ไม่มี → null', districtCentroid('จังหวัดสมมติ', 'อำเภอเมือง') === null);
check('รหัสมั่ว → null', districtCentroidByCode('9999') === null);

/**
 * ทุกจุดต้องอยู่ในจังหวัดของตัวเอง — ตรวจไขว้กับขอบเขตจังหวัดที่มาจาก**คนละแหล่ง**
 * (จังหวัด = apisit/thailand.json · อำเภอ = UN OCHA) จึงยอมให้ต่างกันได้บ้างตรงชายแดน
 * ที่รูปสองชุดวาดไม่ตรงกัน และเกาะ/ทะเลสาบที่ไฟล์จังหวัดไม่ได้ครอบคลุม
 */
let right = 0; const wrong: string[] = [];
for (const code of codes) {
  const c = districtCentroidByCode(code)!;
  const want = normalizeProvince(TH_PROVINCES[code.slice(0, 2)]);   // 2 หลักแรก = รหัสจังหวัด
  const got = normalizeProvince(provinceOf(c.lat, c.lng));
  if (want && got === want) right++;
  else wrong.push(`${TH_AMPHURS[code]} → ${got ?? 'นอกขอบเขต'}`);
}
check('จุดกลางตกในจังหวัดของตัวเอง ≥ 915/928', right >= 915, `${right}/928`);
check('ที่ไม่ตรงมีไม่เกิน 15 แห่ง (ชายแดน/เกาะ)', wrong.length <= 15, `${wrong.length} แห่ง`);

/** พิกัดต้องอยู่ในกรอบประเทศไทย — หลุดกรอบแปลว่าถอด TopoJSON ผิดตั้งแต่ต้น */
const outside = codes.filter((code) => {
  const c = districtCentroidByCode(code)!;
  return c.lat < 5.5 || c.lat > 20.5 || c.lng < 97.3 || c.lng > 105.7;
});
check('ทุกจุดอยู่ในกรอบประเทศไทย', outside.length === 0, `หลุด ${outside.length}`);

// ── การต่อสาย ────────────────────────────────────────────────────────────
const cs = read('src', 'services', 'case.service.ts');
/** ไม่ต่อสายตรงนี้ = ไทยไพบูลย์ยังเรียงตามระยะทางไม่ได้เหมือนเดิม แต่เทสข้างบนยังเขียว */
check('getById เติมจุดกลางอำเภอเมื่อไม่มีพิกัด', /districtCentroid\(row\.acc_province, row\.acc_district\)/.test(cs));
check('บอกแหล่งที่มาของพิกัดไปด้วย', /incident_coord_source/.test(cs));
/** ⛔ เป็นค่าที่คำนวณใหม่ได้เสมอ เขียนลง DB แล้วจะแยกไม่ออกว่าอันไหนของจริง */
check('ไม่เขียนพิกัดที่เดาลงฐานข้อมูล',
      !/UPDATE cases[\s\S]{0,200}incident_lat/.test(cs));

const web = read('..', 'web', 'src', 'components', 'cases', 'AssignSurveyor.tsx');
/**
 * ⛔ ความละเอียดแค่ระดับอำเภอ — โชว์ '12.3 กม.' คนจ่ายงานจะเชื่อว่าวัดมาเป๊ะ
 *    แล้วเลือกคนผิดโดยที่หน้าจอไม่เคยเตือน
 */
check('หน้าจ่ายงานบอกว่าเป็นค่าโดยประมาณ', web.includes('โดยประมาณ'));
/**
 * ⛔ ระยะทางต้องปัดเป็นจำนวนเต็ม**ทุกกรณี** — ฝั่งที่เกิดเหตุหยาบระดับอำเภอเสมอ
 *    ไม่ว่ามาจากจุดกลางที่เราคำนวณ หรือพิกัดที่ติดมากับเคส (**พิกัดบนการ์ดของ
 *    บริษัทประกันก็เป็นค่าสมมติจากอำเภออยู่แล้ว** user ยืนยัน 25/08/69)
 *    โชว์ '12.3 กม.' คนจ่ายงานจะเชื่อว่าวัดมาเป๊ะแล้วเลือกคนผิด
 */
check('ระยะทางปัดเป็นจำนวนเต็ม ไม่มีทางไหนโชว์ทศนิยม',
      /~\{Math\.round\(Number\(s\.distance\)\)\} กม\./.test(web) && !/toFixed\(1\)\} กม\./.test(web));
check('บอกว่าวัดจากจุดกลางอำเภอ ไม่ใช่จุดเกิดเหตุ', web.includes('ไม่ใช่จุดเกิดเหตุจริง'));
check('กรณีจับคู่อำเภอไม่ได้ ก็ยังบอกว่าเป็นค่าประมาณ',
      web.includes('ไม่ใช่ตำแหน่งที่วัดมาจริง'));

/**
 * ⛔ **รู้อำเภอเมื่อไหร่ จุดกลางอำเภอต้องชนะพิกัดที่เก็บไว้ในเคส** — พิกัดที่เก็บไว้มี
 *    2 พันธุ์ปนกัน (สมมติจากการ์ด กับที่คนกรอกเอง) แยกกันไม่ได้หลังบันทึกแล้ว
 *    ถ้าปล่อยให้ของในเคสชนะ จะเขียนป้ายบอกความแม่นยำบนหน้าจอให้ตรงไม่ได้เลยสักแบบ
 */
const gi = cs.indexOf('const centroid = districtCentroid');
check('จุดกลางอำเภอชนะพิกัดที่เก็บไว้ในเคส',
      gi > 0 && cs.indexOf("incident_coord_source = row.incident_lat", gi) > cs.indexOf("= 'district'", gi));

const gen = read('scripts', 'gen_district_centroids.py');
/** ไฟล์ข้อมูลสร้างจากสคริปต์ ไม่ใช่ของที่ใครก็ไม่รู้วางไว้ — ต้องสร้างใหม่ได้เมื่อขอบเขตเปลี่ยน */
check('มีสคริปต์สร้างไฟล์พิกัด + บอกที่มา', gen.includes('prasertcbs/thailand_gis') && gen.includes('CC BY-IGO'));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด\n' : `\n❌ ไม่ผ่าน ${failed} ข้อ\n`);
process.exit(failed === 0 ? 0 : 1);
