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

// ── ไม่มีช่องไหนถูกล็อกด้วย "ที่มาของงาน" อีกแล้ว ──
// เดิม `d = !isEditing || !payEditable` ผูกอยู่กับ 116 ช่องที่ไม่เกี่ยวกับเงิน
// ผลคือ **งานจากระบบเก่าแก้อะไรไม่ได้เลยทั้งหน้า** (เจอจริง 17/08/69 เคส #149)
console.log('\n── หน้าตรวจเคส: ล็อกเฉพาะช่องยอดเงิน ไม่ใช่ทั้งฟอร์ม ──');
check('ช่องทั่วไปไม่ถูกล็อกด้วยกติกาเรื่องเงิน', /const d = false;/.test(src));
check('ยอดจ่ายพนักงานกรอกได้ทุกที่มาของงาน', /const dPay = false;/.test(src));
// แก้มา 3 จังหวะ: ช่องทั่วไป (17/08) -> หักเงิน (17/08) -> ยอดรายรับ (18/08)
// ทุกครั้งคือ **ล็อกผิดแกน** — การล็อกที่ถูกมีอันเดียวคือ "อนุมัติแล้ว" ซึ่งทำที่ <fieldset disabled>
check('ไม่มีธงล็อกช่องตัวไหนผูกกับที่มาของงานอีก',
      !/const d[A-Za-z]* = !/.test(src));

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
 * ── หน้าตรวจต้องกางทุกหมวดเสมอ ห้ามยุบ/ซ่อน ──
 *
 * เคยทำเป็น "โหมดสรุป" (หมวดที่กรอกครบยุบเหลือสรุป) แล้ว **ถอดออก 18/08/69**
 * เหตุผลของ user: หมวดที่ถูกยุบไว้คือหมวดที่ผู้ตรวจจะไม่เปิดดู แล้วปล่อยข้อมูลผิดผ่านไป
 * หน้านี้มีหน้าที่ "ตรวจ" ไม่ใช่ "อ่านสรุป" — เห็นน้อยลง = พลาดง่ายขึ้น
 *
 * และถ้าใครจะเอากลับมาจริง ๆ ห้ามถอด input ออกจาก DOM เด็ดขาด:
 * หน้านี้บันทึกด้วย `new FormData(form)` และ **survey_pay เป็น upsert ทั้งแถว**
 * ยอดที่ไม่ได้ส่งจะกลายเป็น NULL เงียบ ๆ
 */
console.log('\n── หน้าตรวจเคส: กางทุกหมวดเสมอ ──');
const secIds = Array.from(src.matchAll(/data-section="([a-z_]+)"/g), (m) => m[1]);
check('ยังมีหัวหมวดครบ (ไว้หาที่ + ติดป้ายยังกรอกไม่ครบ)', secIds.length >= 10, `${secIds.length} หมวด`);
check('ไม่มีสวิตช์ยุบหมวดหลงเหลือ', !/secOpen|secToggle|openSec/.test(src));
check('ไม่มีหมวดไหนถูกซ่อนด้วย class hidden', !/\? '' : 'hidden'/.test(src));
check('ไม่มีหมวดไหนถูกถอดออกจาก DOM ตามเงื่อนไข',
      !/data-section[\s\S]{0,400}?\{\s*\w+\s*&&\s*\(\s*<div className="bg-white rounded-lg shadow/.test(src));

// ชื่อช่องซ้ำ = FormData หยิบไปแค่ตัวเดียว อีกตัวหายเงียบ ๆ ตอนบันทึก
// (เจอตอนย้าย "ความเห็นผู้ตรวจสอบ" ไปการ์ดตัดสินใจท้ายหน้า — ต้องย้าย ไม่ใช่ก๊อป)
// `(?<!\[)` ตัดสตริง selector ทิ้ง — `querySelector('input[name="x"]')` ไม่ใช่ช่องในฟอร์ม
// (ไม่ตัดแล้วจะฟ้องผิด 4 ชื่อที่ paint() ใช้อ่านค่า ทั้งที่ในฟอร์มมีช่องเดียว)
const RADIO_GROUPS =
  /^(acc_fault|acc_claim_opponent|claim_type|damage_level|acc_alcohol_test|acc_followup|driver_gender)$/;
const dupNames = Array.from(
  Array.from(src.matchAll(/(?<!\[)name="([a-zA-Z_0-9]+)"/g), (m) => m[1])
    .filter((n) => !RADIO_GROUPS.test(n))
    .reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<string, number>()))
  .filter(([, n]) => n > 1);
check('ไม่มีช่องชื่อซ้ำ (ยกเว้นกลุ่ม radio/checkbox ที่ต้องชื่อเดียวกัน)',
      dupNames.length === 0, dupNames.map(([k, n]) => `${k}×${n}`).join(', '));

/**
 * ── ป้าย "ยังกรอกไม่ครบ" ต้องอ่าน DOM หลัง React วาดเสร็จ ──
 *
 * ไฮไลต์แบบมีเงื่อนไข (claimHl / oppNoHl / payHl) เป็นคลาสที่ **React** คุม ไม่ใช่ paint()
 * ถ้านับป้ายอยู่ใน paint() จะอ่านคลาสของรอบก่อน → ป้ายช้าไป 1 จังหวะ:
 * ติ๊ก "การเรียกร้องค่าเสียหายจากคู่กรณี" แล้วกรอบแดงหายทันที แต่ป้ายยังค้างว่ายังไม่ครบ
 * (เจอจริง 18/08/69 ตอน user ทดลองใช้)
 */
console.log('\n── หน้าตรวจเคส: ป้าย "ยังกรอกไม่ครบ" ต้องไม่ช้าไป 1 จังหวะ ──');
const gapBlock = /useEffect\(\(\) => \{[\s\S]*?setGapSec\([\s\S]*?\}, \[([^\]]*)\]\);/.exec(src);
// เทียบด้วย "ตำแหน่ง" ไม่ใช่ regex คร่อม — `[\s\S]*?` ลากข้ามขอบเขตฟังก์ชันได้
// (เขียนแบบ regex ครั้งแรกแล้วมันไปเจอ setGapSec ของ effect ตัวถัดไป = ฟ้องผิด)
const paintEnd = src.indexOf('}, [report, isEditing, saveMsg, pay, payRequired]);');
check('นับป้ายอยู่นอก effect ของ paint',
      paintEnd > 0 && src.indexOf('setGapSec(') > paintEnd
      && src.split('setGapSec(').length - 1 === 1);
const gapDeps = gapBlock ? gapBlock[1].replace(/\s+/g, ' ') : '';
check('deps ครบทุกสถานะไฮไลต์ที่ React คุม',
      ['missing', 'claimHl', 'oppNoHl', 'payHl'].every((k) => gapDeps.includes(k)),
      gapDeps.slice(0, 80));

/**
 * ── แผงแก้ของแอดมินต้องไม่มี name ──
 *
 * แผงนี้อยู่ใน <form> เดียวกับฟอร์มหลัก ถ้าช่องในแผงมี name จะโดน `new FormData(form)`
 * เก็บไปด้วยตอนกดบันทึก → เขียนทับตัวระบุตัวเคสที่ตั้งใจล็อกไว้ (และซ้ำชื่อกับที่อื่นด้วย)
 */
console.log('\n── หน้าตรวจเคส: แผงแก้ของแอดมินต้องไม่หลุดเข้าฟอร์มหลัก ──');
const panel = /\{keyEdit && \(([\s\S]*?)\n              \)\}/.exec(src);
check('มีแผงแก้ของแอดมิน', Boolean(panel));
check('ช่องในแผงไม่มี name เลย', Boolean(panel) && !/\bname=/.test(panel![1]));
check('ปุ่มเปิดแผงขึ้นเฉพาะแอดมิน และเฉพาะตอนยังไม่อนุมัติ',
      /isAdmin && !approved && !keyEdit \? \(/.test(src));

/**
 * -- ค่าใช้จ่ายย้ายไปคอลัมน์ขวา (เฉพาะจอกว้าง) --
 *
 * `survey_pay` บันทึกแบบ "ทั้งแถว" — ช่องไหนไม่ถูกส่งไปด้วยจะกลายเป็น NULL
 * ห้ามซ่อน/ถอดช่องยอดเงินตามขนาดจอเด็ดขาด ต้องอยู่ครบใน DOM ทุกความกว้าง
 * แล้วค่อยใช้ CSS จัดตำแหน่งเอา · และต้องยังอยู่ใน <fieldset disabled> ตัวเดิม
 * ไม่งั้นเคสที่อนุมัติแล้วจะกลับมากรอกยอดทับได้
 */
console.log('\n-- หน้าตรวจเคส: ค่าใช้จ่ายอยู่คอลัมน์ขวาเฉพาะจอกว้าง --');
const payStart = src.indexOf('{/* ── ค่าใช้จ่าย (คอลัมน์ขวาบนจอกว้าง) ──');
const fsEnd = src.indexOf('</fieldset>');
const payBlock = payStart > 0 && fsEnd > payStart ? src.slice(payStart, fsEnd) : '';
check('ค่าใช้จ่ายยังอยู่ใน fieldset ที่ล็อกตอนอนุมัติแล้ว', payBlock.length > 0);
check('จอแคบกลับไปเรียงลงล่างเอง (คอลัมน์เดียว)',
      /className="grid grid-cols-1 min-\[1500px\]:grid-cols-\[/.test(src));
const payFields = Array.from(
  src.matchAll(/name="(pay_[a-z_]+|deduct_[a-z]+|out_of_[a-z]+|special_tumbon|daily_check)"/g),
  (m) => m[1]);
check('ช่องยอดเงินอยู่ครบ (ขาดช่องเดียว = ยอดช่องนั้นถูกล้างตอนบันทึก)',
      payFields.length === 16, `${payFields.length} ช่อง`);
check('ไม่มีช่องยอดเงินช่องไหนถูกซ่อนตามขนาดจอ',
      payBlock.length > 0 && !/:hidden|className="hidden/.test(payBlock));

/**
 * -- ตีกลับให้ผู้สำรวจ --
 *
 * กติกาที่ user เคาะ 18/08/69: สถานะกลับเป็น "กำลังสำรวจ" · ไม่มีแจ้งเตือนเข้าเครื่อง ·
 * หัวหน้ายังแก้เองได้ · เหตุผลบังคับกรอก (ไม่บอกว่าให้แก้อะไร ช่างก็ส่งของเดิมกลับมา)
 *
 * 2 กับดักที่เทสนี้กันไว้:
 *   1. ช่องเหตุผลอยู่ใน <form> เดียวกับฟอร์มหลัก — มี name เมื่อไหร่โดน FormData เก็บไปด้วย
 *   2. ต้องบันทึกก่อนตีกลับ ไม่งั้นสิ่งที่หัวหน้าเพิ่งแก้ไม่ไปถึงเครื่องช่าง
 *      แล้วช่างส่งข้อมูลชุดเก่ากลับมาทับ
 */
console.log('\n-- หน้าตรวจเคส: ตีกลับให้ผู้สำรวจ --');
const sbStart = src.indexOf('const doSendBack');
const sbEnd = src.indexOf('const [keyEdit', sbStart);
const sbFn = sbStart > 0 && sbEnd > sbStart ? src.slice(sbStart, sbEnd) : '';
check('มีปุ่มตีกลับให้ผู้สำรวจ', /ตีกลับให้ผู้สำรวจไปแก้ในแอป/.test(src));
check('บันทึกก่อนตีกลับเสมอ', /if \(!\(await handleSave\(\)\)\) return;/.test(sbFn));
check('ยิงไปที่ /send-back พร้อมเหตุผล', /send-back`, \{ reason \}/.test(sbFn));
const sbPanel = src.slice(src.indexOf('{!approved && !waitingSurveyor && (sbOpen ?'),
                          src.indexOf('<div className="flex justify-end">{actionBar}</div>'));
check('ช่องเหตุผลไม่มี name', sbPanel.length > 0 && !/\bname=/.test(sbPanel));
check('ตีกลับแล้วซ่อนปุ่ม (กันตีกลับซ้ำระหว่างรอช่าง)', /!approved && !waitingSurveyor/.test(src));

const svc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'case.service.ts'), 'utf8');
const sbSvcStart = svc.indexOf('async sendBackToSurveyor');
const sbSvc = sbSvcStart > 0 ? svc.slice(sbSvcStart, svc.indexOf('\n  },', sbSvcStart)) : '';
check('เซอร์วิสตีกลับมีอยู่จริง', sbSvc.length > 0);
check('เหตุผลบังคับกรอก', /if \(!text\) throw new AppError\(400/.test(sbSvc));
check('อนุมัติแล้วตีกลับไม่ได้ (ต้องปลดล็อกก่อน)', /status === 'reviewed'/.test(sbSvc));
check('เคสที่ไม่มีผู้สำรวจตีกลับไม่ได้ (ไม่งั้นเคสหายเงียบ)', /if \(!assigned_to\)/.test(sbSvc));
check('เปลี่ยนสถานะแบบมี guard กันชนกับการอนุมัติ/ส่งซ้ำ',
      /WHERE id = \$1 AND status = 'surveyed'/.test(sbSvc));
check('หน้าตรวจสอบยังเห็นเคสที่ตีกลับแล้ว (หัวหน้าแก้เองได้)',
      /OR \(c\.status = 'assigned' AND c\.sent_back_at IS NOT NULL\)/.test(svc));
check('ส่งงานใหม่แล้วหมวดรูปที่ผู้ตรวจตั้งไว้ไม่หาย', /prevCats\.get\(/.test(svc));

console.log(`\n${failed === 0 ? '✅ ผ่านทั้งหมด' : `❌ ล้มเหลว ${failed} รายการ`}`);
process.exit(failed ? 1 : 0);
