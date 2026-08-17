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

const unbound = reqs.filter((r) => !/\bof="/.test(r));
check('ดอกจันทุกตัวประกาศช่องที่ตัวเองคุม (of=)',
      unbound.length === 0,
      unbound.length ? `ยังไม่ผูก ${unbound.length} ตัว` : `${reqs.length} ตัว`);

const namesInFile = new Set(Array.from(src.matchAll(/name="([a-zA-Z_0-9]+)"/g), (m) => m[1]));
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

const PAY_NAME = /name="(?:pay_[a-z_]+|out_of_area|out_of_hours|special_tumbon|daily_check|deduct_late|deduct_docs|deduct_reason|other_reason)"/;
const payLines = src.split('\n').filter((l) => PAY_NAME.test(l) && /disabled=\{/.test(l));
const payWrong = payLines.filter((l) => !/disabled=\{dPay\}/.test(l));
check('ช่องยอดเงินทุกช่องใช้ธง dPay',
      payLines.length >= 16 && payWrong.length === 0,
      `${payLines.length} ช่อง${payWrong.length ? ` · ผิด ${payWrong.length}` : ''}`);

const generalWrong = src.split('\n')
  .filter((l) => /disabled=\{dPay\}/.test(l) && !PAY_NAME.test(l));
check('ไม่มีช่องทั่วไปหลุดไปใช้ธงเงิน', generalWrong.length === 0,
      generalWrong.length ? `${generalWrong.length} บรรทัด` : '');

console.log(`\n${failed === 0 ? '✅ ผ่านทั้งหมด' : `❌ ล้มเหลว ${failed} รายการ`}`);
process.exit(failed ? 1 : 0);
