/**
 * การ์ดของ "รับงานไอโออิเข้าระบบ"
 *
 * ไอโออิเป็นบริษัทที่ 2 ที่รับงานผ่านหน้าสร้างเคส — ก่อนหน้านี้ปุ่มถูกปิดไว้ว่า "เร็วๆ นี้"
 * ทั้งที่เป็นครึ่งหนึ่งของงานจริง
 *
 * จุดที่พังได้เงียบ ๆ และเทสนี้กันไว้:
 *   1. เอาชุดตรวจเลขของไทยไพบูลย์ไปใช้กับไอโออิ → ตกทุกเลข (คนละรูปแบบกันคนละเรื่อง)
 *   2. ลืมส่ง insurer ไปกับรูป → ฝั่งเซิร์ฟเวอร์ตกกลับไปใช้ prompt ไทยไพบูลย์
 *   3. บังคับให้มีเลขเรื่องเซอร์เวย์ → ไอโออิไม่มีบนการ์ด สร้างเคสไม่ได้เลย
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

console.log('\n── รับงานไอโออิเข้าระบบ ──');

// ── หน้าสร้างเคส ──────────────────────────────────────────────────────────
const page = read('..', 'web', 'src', 'app', 'callcenter', 'cases', 'new', 'page.tsx');
check('ปุ่มไอโออิเปิดใช้งานแล้ว',
      /code: 'AIOI'(?!.*disabled)/.test(page) && !/code: 'AIOI', disabled: true/.test(page));
/** ฟอร์มเดียวใช้ 2 บริษัท — แยกฟอร์มเมื่อไหร่ แก้ที่หนึ่งลืมอีกที่ทันที */
check('ใช้ฟอร์มเดียวกันทั้ง 2 บริษัท', page.includes("insuranceCompany !== '' && ("));
check('ไม่เหลือตารางเฉพาะไอโออิของเดิม', !page.includes('{/* ไอโออิ → ตาราง */}'));
/** ⛔ ไอโออิไม่มีเลขเรื่องเซอร์เวย์บนการ์ด — โชว์ช่องนี้ให้ = ชวนคนกรอกมั่ว */
check('ช่องเลขเรื่องเซอร์เวย์โชว์เฉพาะไทยไพบูลย์',
      /\{isTPB && \([\s\S]{0,400}เลขเรื่องเซอร์เวย์/.test(page));
check('ส่งบริษัทประกันไปกับรูปด้วย', /formData\.append\('insurer'/.test(page));

// ── ฝั่งเซิร์ฟเวอร์ ────────────────────────────────────────────────────────
const svc = read('src', 'services', 'ocrFlipped.service.ts');
check('มีคำสั่งอ่านแยกของไอโออิ', svc.includes('PROMPT_AIOI') && svc.includes('SCHEMA_AIOI'));
check('เส้นไทยไพบูลย์ยังอยู่ครบ', svc.includes('PROMPT_TPB') && svc.includes('SCHEMA_TPB'));
check('เลือกคำสั่งตามบริษัท', /insurer === 'AIOI' \? PROMPT_AIOI : PROMPT_TPB/.test(svc));

/**
 * ⛔ หัวใจของเรื่อง: เลขไอโออิเป็น**ตัวเลขล้วน** ส่วนไทยไพบูลย์มีตัวอักษรคั่น
 *    (BR10/6906/13144 · 21BR10AVD-6906-000098) เอาชุดตรวจข้ามกันตกทุกเลข
 */
for (const [name, re] of [
  ['เลขรับแจ้ง', /const AIOI_RECV = \/\^\\d\{9,11\}\$\//],
  ['เลขที่เคลม', /const AIOI_CLAIM = \/\^\\d\{12,14\}\$\//],
  ['พ.ร.บ.', /const AIOI_PRB = \/\^\\d\{12,14\}\$\//],
  ['กรมธรรม์', /const AIOI_POLICY = \/\^\\d\{9,14\}\$\//],
] as [string, RegExp][]) {
  check(`ชุดตรวจ${name}ของไอโออิเป็นตัวเลขล้วน`, re.test(svc));
}
check('รู้จักเลขเซอร์เวย์แบบ SEABI', /const SEABI_GRAB = /.test(svc));
/** การ์ดไอโออิพิมพ์ปี ค.ศ. (22/08/2026) แต่ทั้งระบบเก็บ พ.ศ. — ไม่แปลง = เพี้ยน 543 ปี */
check('แปลงปี ค.ศ. บนการ์ดเป็น พ.ศ.', /yr < 2500\) yr \+= 543/.test(svc));
/** ไม่มีเลขเซอร์เวย์เป็นเรื่องปกติของไอโออิ — เอาไปนับว่า "ต้องตรวจ" = ธงแดงทุกใบจนคนเลิกสนใจ */
check('ไม่มีเลขเซอร์เวย์ ไม่ถือเป็นสัญญาณว่าอ่านพลาด',
      /review_needed: fields\.claim_no\.confidence !== 'high' \|\| fields\.claim_received\.confidence !== 'high'/.test(svc));

const ctl = read('src', 'controllers', 'ocr.controller.ts');
check('อ่านค่า insurer จากคำขอ', /req\.body\?\.insurer/.test(ctl));
/** หน้าเว็บที่เบราว์เซอร์แคชไว้ยังไม่ส่ง insurer — ต้องทำงานเหมือนเดิม ไม่ใช่ล้ม */
check('ไม่ส่งมา = ใช้ไทยไพบูลย์เหมือนเดิม', /\? 'AIOI' : 'TPB'/.test(ctl));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด\n' : `\n❌ ไม่ผ่าน ${failed} ข้อ\n`);
process.exit(failed === 0 ? 0 : 1);
