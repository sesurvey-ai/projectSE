/**
 * การ์ดของหน้าตรวจเคส — ตรวจ "ดอกจันต้องผูกกับช่องของตัวเอง"
 *
 * ทำไมต้องมี: กติกากดอนุมัติทั้งหมดถูกคำนวณจากดอกจัน (`.req-mark`) → ช่องที่มันคุม
 * ถ้าผูกผิด ผลคือ **กดอนุมัติไม่ได้ทั้งที่ข้อมูลครบ** (เจอจริง 15/08/69 เคส #141)
 *
 * เดิมหาช่องด้วยการเดาจากตำแหน่งใน DOM (ไต่ td ข้าง ๆ / ไต่ parent ขึ้นไป 5 ชั้น)
 * ซึ่งใช้ได้เฉพาะกับเลย์เอาต์ตาราง 4 คอลัมน์แบบเดิม — วินาทีที่เปลี่ยนเป็นการ์ด
 * ดอกจันจะคว้า input **ทุกช่องในการ์ด** แล้วทาแดง+นับช่องที่ไม่บังคับเข้าไปด้วย
 *
 * ตอนนี้ผูกด้วยชื่อช่อง (`<Req of="..." />`) เทสนี้กันไม่ให้มีดอกจันที่ลืมผูก
 * และกันชื่อช่องพิมพ์ผิด (ผูกไปยังช่องที่ไม่มีอยู่จริง = ดอกจันนั้นไม่คุมอะไรเลยแบบเงียบ ๆ)
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};

console.log('\n── หน้าตรวจเคส: ดอกจันต้องผูกกับช่องของตัวเอง ──');

const src = fs.readFileSync(
  path.join(__dirname, '..', '..', 'web', 'src', 'components', 'cases', 'CaseDetail.tsx'), 'utf8');

const reqs = src.match(/<Req\b[^/>]*/g) ?? [];
check('พบดอกจันในฟอร์ม', reqs.length > 0, `${reqs.length} ตัว`);

/**
 * การ์ด "ลำดับเวลา" วาด 5 จังหวะจากตาราง `tl(...)` แทนที่จะเขียน JSX ซ้ำ 5 ชุด
 * ดอกจันของมันจึงเป็น `of={n.keys.join(',')}` ไม่ใช่สตริงตรง ๆ — ตรวจแยกตรงนี้
 * เพื่อไม่ต้องผ่อนกฎ "ดอกจันต้องผูกช่อง" ให้หลวมลงทั้งไฟล์
 */
const tlRows = Array.from(src.matchAll(/\btl\('([a-z_0-9]+)',\s*'([a-z_0-9]+)',\s*'([a-z_0-9]+)'/g));
const tlNames = tlRows.flatMap((m) => [m[1], m[2], m[3]]);
check('การ์ดลำดับเวลามีครบ 5 จังหวะ', tlRows.length === 5, `${tlRows.length} จังหวะ · ${tlNames.length} ช่อง`);
check('ช่องในการ์ดลำดับเวลาผูกชื่อจากตารางเดียวกัน',
      /name=\{n\.date\}/.test(src) && /name=\{n\.hour\}/.test(src) && /name=\{n\.min\}/.test(src));
check('ดอกจันของลำดับเวลาคุมทั้ง 3 ช่องของจังหวะนั้น', /<Req of=\{n\.keys\.join\(','\)\} \/>/.test(src));

// ผ่อนให้เฉพาะดอกจันของลำดับเวลาเท่านั้น — ตัวอื่นยังต้องเป็นสตริงตรง ๆ
const TL_REQ = /\bof=\{n\.keys\.join\(','\)\}/;
const unbound = reqs.filter((r) => !/\bof="/.test(r) && !TL_REQ.test(r));
check('ดอกจันทุกตัวประกาศช่องที่ตัวเองคุม (of=)',
      unbound.length === 0,
      unbound.length ? `ยังไม่ผูก ${unbound.length} ตัว` : `${reqs.length} ตัว`);

const namesInFile = new Set([
  ...Array.from(src.matchAll(/name="([a-zA-Z_0-9]+)"/g), (m) => m[1]),
  ...tlNames,
]);
const targets = new Set<string>();
for (const r of reqs) {
  const m = /\bof="([^"]+)"/.exec(r);
  if (m) for (const n of m[1].split(',')) targets.add(n.trim());
}
const ghost = Array.from(targets).filter((n) => n && !namesInFile.has(n));
check('ไม่มีดอกจันชี้ไปช่องที่ไม่มีอยู่จริง (พิมพ์ผิด = ไม่คุมอะไรเลย)',
      ghost.length === 0, ghost.length ? ghost.join(', ') : `คุม ${targets.size} ช่อง`);

// ตัว resolve ต้องอ่าน data-req-of เป็นทางหลัก ไม่ใช่เดาตำแหน่ง
check('ตัวหาช่องอ่าน data-req-of เป็นทางหลัก',
      /data-req-of/.test(src) && /getAttribute\('data-req-of'\)/.test(src));
check('ตัวหาช่องรับ form เข้ามาเพื่อค้นด้วยชื่อช่อง',
      /function fieldsOfMark\(mark: Element, form\?: HTMLFormElement \| null\)/.test(src));

// ── การล็อกช่อง: "ยอดจ่ายพนักงาน" เท่านั้นที่ล็อกตามที่มาของงาน ──
// เดิม `d = !isEditing || !payEditable` ผูกอยู่กับ 116 ช่องที่ไม่เกี่ยวกับเงิน
// ผลคือ **งานจากระบบเก่าแก้อะไรไม่ได้เลยทั้งหน้า** (เจอจริง 17/08/69 เคส #149)
console.log('\n── หน้าตรวจเคส: ล็อกเฉพาะช่องยอดเงิน ไม่ใช่ทั้งฟอร์ม ──');
check('ช่องทั่วไปไม่ถูกล็อกด้วยกติกาเรื่องเงิน', /const d = false;/.test(src));
check('มีธงแยกสำหรับช่องยอดจ่ายพนักงาน', /const dPay = !payEditable;/.test(src));

// หักเงินแยกออกจากยอดรายรับ: เป็นกติกาของ se-survey เอง ระบบเดิมไม่มีช่องนี้และ
// se-billing ไม่มีที่เก็บ → ล็อกตามที่มาของงานคือล็อกผิดฝั่ง (user เคาะ 17/08/69 เคส #149)
const DEDUCT_NAME = /name="(?:pay_deduct_fee|deduct_late|deduct_docs|deduct_reason)"/;
const PAY_NAME = /name="(?:pay_[a-z_]+|out_of_area|out_of_hours|special_tumbon|daily_check|other_reason)"/;

const payLines = src.split('\n')
  .filter((l) => PAY_NAME.test(l) && !DEDUCT_NAME.test(l) && /disabled=\{/.test(l));
const payWrong = payLines.filter((l) => !/disabled=\{dPay\}/.test(l));
check('ช่องยอดรายรับทุกช่องใช้ธง dPay',
      payLines.length >= 10 && payWrong.length === 0,
      `${payLines.length} ช่อง${payWrong.length ? ` · ผิด ${payWrong.length}` : ''}`);

const deductLines = src.split('\n').filter((l) => DEDUCT_NAME.test(l) && /disabled=\{/.test(l));
const deductWrong = deductLines.filter((l) => !/disabled=\{dDeduct\}/.test(l));
check('ช่องหักเงินกรอกได้ทุกที่มาของงาน (ใช้ธง dDeduct)',
      deductLines.length === 4 && deductWrong.length === 0,
      `${deductLines.length} ช่อง${deductWrong.length ? ` · ยังล็อกอยู่ ${deductWrong.length}` : ''}`);

const generalWrong = src.split('\n')
  .filter((l) => /disabled=\{dPay\}/.test(l) && !PAY_NAME.test(l));
check('ไม่มีช่องทั่วไปหลุดไปใช้ธงเงิน', generalWrong.length === 0,
      generalWrong.length ? `${generalWrong.length} บรรทัด` : '');

/**
 * ── ตัวทาสีกรอบแดงต้องไม่ setState กลางทางที่ event กำลังไหล ──
 *
 * `<form>` เป็น ancestor ของทุกช่อง ส่วน React ดัก event ไว้ที่ `document` (เหนือ form)
 * ผูก paint กับ 'input' ตรง ๆ = re-render ก่อน React ได้เห็น event → React เขียนค่าเดิม
 * ทับช่อง controlled → พอถึงคิว React ค่าไม่เปลี่ยน จึง**ไม่ยิง onChange เลย**
 * ผลคือคู่กรณี/ผู้บาดเจ็บ/ทรัพย์สิน/ความเสียหาย + 5 dropdown cascade พิมพ์ไม่เข้าถาวร
 * (เจอจริง 17/08/69 เคส #149 — ช่อง uncontrolled ไม่โดน เลยดูเหมือนพังแค่บางช่อง)
 */
console.log('\n── หน้าตรวจเคส: ตัวทาสีกรอบแดงต้องไม่ทับค่าที่กำลังพิมพ์ ──');
check('ไม่ผูก paint กับ event ตรง ๆ',
      !/addEventListener\('(?:input|change)',\s*paint\)/.test(src));
check('หน่วง paint ออกไปหลัง event ไหลจบ (requestAnimationFrame)',
      /requestAnimationFrame\(paint\)/.test(src) && /cancelAnimationFrame\(raf\)/.test(src));
check('เลิก re-render ทิ้งเปล่าเมื่อรายการเท่าเดิม', /const setList = /.test(src));

/**
 * ── โหมดสรุป: ยุบหมวดต้องซ่อนด้วย CSS ห้ามถอดออกจาก DOM ──
 *
 * หน้านี้บันทึกด้วย `new FormData(form)` — ช่องที่ไม่อยู่ใน DOM จะไม่ถูกส่งไป
 * ฝั่ง survey_reports ไม่เป็นไร (updateReport อัปเดตเฉพาะคีย์ที่ส่งมา) แต่
 * **survey_pay เป็น upsert ทั้งแถว** ยอดที่ไม่ได้ส่งจะกลายเป็น NULL เงียบ ๆ
 * ยุบหมวดค่าใช้จ่ายด้วยการ unmount = ยอดจ่ายพนักงานหายทั้งแถวตอนกดบันทึก
 */
console.log('\n── หน้าตรวจเคส: ยุบหมวดต้องไม่ทำให้ค่าหายตอนบันทึก ──');
const secIds = Array.from(src.matchAll(/data-section="([a-z_]+)"/g), (m) => m[1]);
const secHides = src.match(/secOpen\('[a-z_]+'\) \? '' : 'hidden'/g) ?? [];
check('ทุกหมวดที่ยุบได้ ซ่อนด้วย class ไม่ใช่ถอดออกจาก DOM',
      secIds.length > 0 && secIds.length === secHides.length,
      `${secIds.length} หมวด · ซ่อนแบบ CSS ${secHides.length}`);
check('ไม่มีหมวดไหนใช้ && เรนเดอร์ตามเงื่อนไข (= ถอดออกจาก DOM)',
      !/secOpen\([^)]*\)\s*&&/.test(src));
check('หมวดยอดเงินไม่ถูกทำให้ยุบได้', !secIds.includes('money') && !secIds.includes('pay'));

console.log(`\n${failed === 0 ? '✅ ผ่านทั้งหมด' : `❌ ล้มเหลว ${failed} รายการ`}`);
process.exit(failed ? 1 : 0);
