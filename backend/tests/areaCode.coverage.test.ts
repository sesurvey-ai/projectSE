/**
 * ตรวจว่า **ทุกจังหวัด/อำเภอที่พนักงานเลือกได้ในแอป** แปลงเป็นรหัสมาตรฐานได้
 *
 * ทำไมสำคัญ: แปลงไม่ได้แม้คู่เดียว = งานในพื้นที่นั้นหาเรทไม่เจอ = คิดค่าตอบแทนไม่ได้
 * และจะรู้ตัวตอนผู้ตรวจเปิดเคสจริงเท่านั้น
 *
 * ใช้ `mobile/assets/thai_provinces.json` เป็นแหล่งอ้างอิงเพราะเป็นชุดคำที่ dropdown
 * ในแอปสร้างได้จริงทั้งหมด — ครอบคลุมกว่าการเทียบกับเคสที่มีอยู่ไม่กี่เคส
 *
 * รัน:  npx ts-node --transpile-only tests/areaCode.coverage.test.ts
 */
import { amphurCode, provinceCode } from '../src/services/areaCode.service';

/* eslint-disable @typescript-eslint/no-var-requires */
const appAreas = require('../../mobile/assets/thai_provinces.json') as Record<string, string[]>;

let okProv = 0;
let okAmp = 0;
let total = 0;
const missProv: string[] = [];
const missAmp: string[] = [];

// 'อื่นๆ' เป็นตัวเลือกสำรองในแอป ไม่ใช่พื้นที่จริง — ไม่มีรหัสโดยธรรมชาติ
const NO_CODE = new Set(['อื่นๆ']);

for (const [province, districts] of Object.entries(appAreas)) {
  if (NO_CODE.has(province)) continue;
  const pc = provinceCode(province);
  if (pc) okProv++;
  else missProv.push(province);

  for (const d of districts) {
    total++;
    if (amphurCode(province, d)) okAmp++;
    else missAmp.push(`${province} / ${d}`);
  }
}

const provTotal = Object.keys(appAreas).filter((p) => !NO_CODE.has(p)).length;
console.log('\nแปลงชื่อพื้นที่ในแอป → รหัสมาตรฐาน');
console.log(`  จังหวัด  ${okProv}/${provTotal}`);
console.log(`  อำเภอ    ${okAmp}/${total}`);

if (missProv.length) {
  console.log(`\n❌ จังหวัดที่แปลงไม่ได้ (${missProv.length}):`);
  missProv.forEach((p) => console.log(`     ${p}`));
}
if (missAmp.length) {
  console.log(`\n❌ อำเภอที่แปลงไม่ได้ (${missAmp.length}):`);
  missAmp.slice(0, 40).forEach((a) => console.log(`     ${a}`));
  if (missAmp.length > 40) console.log(`     … อีก ${missAmp.length - 40} รายการ`);
}

// ── ตรวจกันสลับชุดรหัส: ค่าที่รู้คำตอบแน่ ๆ ──
// ถ้าเผลอไปใช้ emcsDistricts.ts จะได้ '9'/'0904' แทน '20'/'2004' — ดักไว้ตรงนี้
const spot: [string, string, string][] = [
  ['ชลบุรี', 'อำเภอบางละมุง', '2004'],
  ['ชลบุรี', 'อำเภอเมือง', '2001'],
  ['กรุงเทพ ฯ', 'เขตบางกะปิ', '1006'],
  ['ปทุมธานี', 'อำเภอธัญบุรี', '1303'],   // 1302 คือคลองหลวง — เคยใส่ผิดตอนเขียนเทสรอบแรก
  ['บึงกาฬ', 'อำเภอบึงกาฬ', '3801'],      // แอปเขียนอำเภอเมืองด้วยชื่อจังหวัด
];
let spotBad = 0;
console.log('\nตรวจค่าที่รู้คำตอบ (กันสลับกับรหัสของพอร์ทัลประกัน)');
for (const [p, d, want] of spot) {
  const got = amphurCode(p, d);
  const ok = got === want;
  if (!ok) spotBad++;
  console.log(`  ${ok ? '✅' : '❌'} ${p} / ${d} → ${got ?? 'ไม่พบ'}${ok ? '' : `  (ควรเป็น ${want})`}`);
}

if (missProv.length || missAmp.length || spotBad) {
  console.log('\n❌ ไม่ผ่าน');
  process.exit(1);
}
console.log('\n✅ แปลงได้ครบทุกพื้นที่');
