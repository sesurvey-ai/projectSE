/**
 * การ์ดของ "จัดกลุ่มช่างสำรวจตามจังหวัดที่เกิดเหตุ"
 *
 * ครึ่งแรกเรียกฟังก์ชันจริง (ไม่แตะฐานข้อมูล/เน็ต) ครึ่งหลังตรวจการต่อสาย
 *
 * โจทย์: หน้าจ่ายงานเคยเรียงรายชื่อช่างตาม user id = ไม่มีความหมายกับคนจ่ายงาน
 * ตอนนี้ดันคนที่อยู่จังหวัดเดียวกับที่เกิดเหตุขึ้นก่อน
 */
import * as fs from 'fs';
import * as path from 'path';
import { provinceOf, normalizeProvince, normalizeDistrict, PROVINCE_NAMES } from '../src/services/geoProvince';
import { numericOrBlank } from '../src/utils/numericField';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

console.log('\n── พิกัด → จังหวัด ──');
check('มีขอบเขตครบ 77 จังหวัด', PROVINCE_NAMES.length === 77, String(PROVINCE_NAMES.length));
/** ชื่อต้องตรงกับรายชื่อที่ฟอร์มใช้เป๊ะ ไม่งั้นจับคู่กับ acc_province ไม่ติด */
const webProvinces = Object.keys(JSON.parse(read('..', 'web', 'src', 'data', 'thai_provinces.json')));
check('ชื่อจังหวัดตรงกับที่ฟอร์มใช้ทุกชื่อ',
      PROVINCE_NAMES.every((p) => webProvinces.includes(p)));

const POINTS: [string, number, number, string | null][] = [
  ['อนุสาวรีย์ชัย', 13.7650, 100.5380, 'กรุงเทพ ฯ'],
  ['เมืองสมุทรปราการ', 13.5991, 100.5998, 'สมุทรปราการ'],
  // ⛔ จุดชี้ขาด: บางนาห่างเขตสมุทรปราการ ~5 กม. — วิธี "ใกล้จุดกลางจังหวัดไหนสุด" จะตอบผิด
  //    และ 26 จาก 35 คนอยู่โซนนี้ = พังตรงที่มีคนเยอะที่สุด ต้องเช็คว่าจุดอยู่ในรูปจริง
  ['บางนา (ติดชายแดน กทม./สป.)', 13.6680, 100.6050, 'กรุงเทพ ฯ'],
  ['ปากเกร็ด', 13.9130, 100.4980, 'นนทบุรี'],
  ['รังสิต', 14.0208, 100.7250, 'ปทุมธานี'],
  ['เชียงใหม่', 18.7883, 98.9853, 'เชียงใหม่'],
  ['ภูเก็ต', 7.8804, 98.3923, 'ภูเก็ต'],
  // พิกัดจริงจากการ์ดไอโออิ
  ['ชลบุรี (การ์ดจริง)', 13.3690725, 101.0404487, 'ชลบุรี'],
  ['อยุธยา (การ์ดจริง)', 14.330435, 100.5296115, 'พระนครศรีอยุธยา'],
  ['กลางอ่าวไทย', 11.0, 100.5, null],
];
for (const [label, lat, lng, want] of POINTS) {
  const got = provinceOf(lat, lng);
  check(`${label} → ${want ?? 'ไม่อยู่ในจังหวัดใด'}`, got === want, got ?? 'null');
}
check('พิกัดเพี้ยน/ว่าง ไม่ล้ม', provinceOf(null, undefined) === null && provinceOf('abc', 'x') === null);

console.log('\n── ปรับชื่อจากเอกสารให้ตรงกับระบบ ──');
for (const [raw, want] of [
  ['สมุทรปราการ', 'สมุทรปราการ'],
  ['จังหวัดสมุทรปราการ', 'สมุทรปราการ'],
  ['จ.ชลบุรี', 'ชลบุรี'],
  // การ์ดแต่ละเจ้าเขียนกรุงเทพคนละแบบ แต่ระบบเก็บแบบเดียว
  ['กรุงเทพฯ', 'กรุงเทพ ฯ'],
  ['กรุงเทพมหานคร', 'กรุงเทพ ฯ'],
  ['กรุงเทพ ฯ', 'กรุงเทพ ฯ'],
] as [string, string][]) {
  check(`จังหวัด "${raw}" → ${want}`, normalizeProvince(raw) === want, String(normalizeProvince(raw)));
}
/** ⛔ ไม่ใช่จังหวัดที่รู้จัก = ว่าง ห้ามเดา — เดาผิดแล้วเคสไปกองผิดกลุ่ม */
check('ชื่อมั่ว → ว่าง ไม่เดา', normalizeProvince('ทุกตำบล') === null && normalizeProvince('') === null);

/** ⚠️ ใบไทยไพบูลย์เขียน "อำเภอเมืองสมุทรปราการ" ระบบเก็บ "อำเภอเมือง" */
check('อำเภอเมือง<ชื่อจังหวัด> → อำเภอเมือง',
      normalizeDistrict('อำเภอเมืองสมุทรปราการ', 'สมุทรปราการ') === 'อำเภอเมือง');
check('กรุงเทพใช้คำว่า "เขต" ไม่ใช่ "อำเภอ"',
      normalizeDistrict('ดอนเมือง', 'กรุงเทพ ฯ') === 'เขตดอนเมือง');
check('ต่างจังหวัดใช้คำว่า "อำเภอ"', normalizeDistrict('ค่ายบางระจัน', 'สิงห์บุรี') === 'อำเภอค่ายบางระจัน');
check('ขีดกลาง/ว่าง → ว่าง', normalizeDistrict('-', 'ชลบุรี') === null && normalizeDistrict('', null) === null);

console.log('\n── การต่อสาย ──');
const loc = read('src', 'services', 'location.service.ts');
check('รายชื่อช่างติดจังหวัดมาด้วยทั้ง 2 คิวรี',
      (loc.match(/return withProvince\(result\.rows\)/g) ?? []).length === 2);
for (const [where, file] of [
  ['API', ['src', 'controllers', 'user.controller.ts']],
  ['socket', ['src', 'socket', 'locationHandler.ts']],
] as [string, string[]][]) {
  check(`ช่างรายงานพิกัดสดผ่าน ${where} ก็ได้จังหวัดด้วย`, /province: provinceOf\(/.test(read(...file)));
}
const cs = read('src', 'services', 'case.service.ts');
check('เคสคืนจังหวัดที่เกิดเหตุมาให้หน้าจ่ายงาน', /sr\.acc_province, sr\.acc_district/.test(cs));
/** การ์ดไอโออิบางใบมีพิกัดแต่ไม่มีชื่อจังหวัด — แปลงจากพิกัดได้ ไม่ใช่การเดา */
check('ไม่มีชื่อจังหวัดแต่มีพิกัด → แปลงจากพิกัด',
      /row\.acc_province = provinceOf\(row\.incident_lat, row\.incident_lng\)/.test(cs));

const assign = read('..', 'web', 'src', 'components', 'cases', 'AssignSurveyor.tsx');
check('แยกกลุ่ม "อยู่ในจังหวัดที่เกิดเหตุ"', /const inProvince =/.test(assign));
/**
 * ⛔ กฎที่สำคัญที่สุดของหน้านี้: **ห้ามกรองคนออก ให้แค่แยกกลุ่ม**
 *    พิกัดช่างมากกว่าครึ่งเก่ากว่า 7 วัน — วันไหนไม่มีใครรายงานจากจังหวัดนั้น
 *    คนจ่ายงานจะเห็นรายชื่อว่างเปล่าแล้วจ่ายงานไม่ได้ ทั้งที่จริง ๆ มีคนอยู่แถวนั้น
 */
check('คนที่ไม่ตรงจังหวัดยังกดดูได้ ไม่ถูกซ่อนหาย',
      /const others =/.test(assign) && assign.includes('ช่างคนอื่น'));
check('บอกด้วยว่าไม่มีใครอยู่จังหวัดนั้น แทนที่จะโชว์ว่าง ๆ',
      assign.includes('ไม่มีใครรายงานพิกัดจากจังหวัดนี้'));
/** ตำแหน่งเมื่อ 10 วันก่อนกับเมื่อ 10 นาทีก่อน เชื่อได้ไม่เท่ากัน */
check('โชว์ว่าพิกัดอัปเดตเมื่อไหร่', /const freshness =/.test(assign) && assign.includes('อัปเดต '));

console.log('\n── มีพิกัดบนการ์ด → เรียงตามระยะทางจริง ──');
const ocr = read('src', 'services', 'ocrFlipped.service.ts');
check('อ่าน LatLng จากการ์ดไอโออิ', ocr.includes('"latlng": the value labelled LatLng'));
/** การ์ดมี 2 บล็อกสถานที่ (ที่เกิดเหตุ / ที่ตรวจสอบ) — หยิบผิดบล็อกได้ระยะทางผิด */
check('บอกให้หยิบพิกัดของบล็อก "ที่เกิดเหตุ"', ocr.includes('not the green สถานที่ตรวจสอบ block'));
/** ⛔ พิกัดมั่ว = ระยะทางเพี้ยนทั้งรายการ แล้วคนจ่ายงานเลือกคนผิด — แย่กว่าไม่มีพิกัด */
check('พิกัดที่ไม่ตกในไทย = ทิ้ง ไม่เอาไปใช้', /if \(!provinceOf\(lat, lng\)\) return bad/.test(ocr));
check('ใบไทยไพบูลย์ไม่มีพิกัด = ว่าง (ตกไปใช้การจัดกลุ่มตามจังหวัด)',
      /const incident_lat = blankField\(false\)/.test(ocr));

const ctl2 = read('src', 'controllers', 'ocr.controller.ts');
check('ส่งพิกัดกลับไปให้ฟอร์มสร้างเคส',
      ctl2.includes('incident_lat: result.fields.incident_lat')
      && ctl2.includes('incident_lng: result.fields.incident_lng'));

/**
 * ⛔ มีพิกัดแล้วต้อง **ไม่** แบ่งกลุ่มจังหวัดซ้อนอีก — คนที่ห่างแค่ 3 กม. แต่คนละฝั่ง
 *    เส้นแบ่งจังหวัดจะถูกพับไปอยู่ใน "ช่างคนอื่น" ซึ่งกลับหัวกลับหางกับที่ต้องการ
 */
check('มีพิกัด → เรียงระยะทางล้วน ไม่แบ่งจังหวัดซ้อน',
      /const byDistance = incidentLat !== undefined && incidentLng !== undefined/.test(assign)
      && /!byDistance && incidentProvince \? sorted\.filter/.test(assign));
check('ไม่มีพิกัด → กลับไปจัดกลุ่มตามจังหวัดเหมือนเดิม',
      /\{!byDistance && incidentProvince && others\.length > 0 && \(/.test(assign));

console.log('\n── พิกัดที่ส่งมาเป็นข้อความ ──');
/**
 * ฟอร์มเว็บเก็บทุกช่องเป็นข้อความ · ค่าที่อ่านจากการ์ดก็เป็นข้อความ
 * เจอจริง 24/08/69: สร้างเคสไอโออิไม่ได้เลย "incident_lat: Expected number, received string"
 */
for (const [label, input, want] of [
  ['ข้อความตัวเลขจากการ์ด', '13.7541973', 13.7541973],
  ['ตัวเลขจริง', 13.7541973, 13.7541973],
  ['มีช่องว่างหน้าหลัง', ' 100.51 ', 100.51],
  // ⛔ สำคัญสุด — ว่างต้องเป็น "ไม่ส่งค่า" ไม่ใช่ 0 · พิกัด (0,0) = กลางอ่าวกินี
  //    ระยะทางจะเพี้ยนทั้งรายการโดยไม่มีอะไรฟ้อง (นี่คือเหตุผลที่ห้ามใช้ z.coerce.number())
  ['ค่าว่าง → ไม่ส่งค่า ไม่ใช่ 0', '', undefined],
  ['อ่านไม่ออก → ไม่ส่งค่า', 'abc', undefined],
] as [string, unknown, unknown][]) {
  const r = numericOrBlank.safeParse(input);
  check(`${label}`, r.success && r.data === want, String(r.success ? r.data : 'ERROR'));
}

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด\n' : `\n❌ ไม่ผ่าน ${failed} ข้อ\n`);
process.exit(failed === 0 ? 0 : 1);
