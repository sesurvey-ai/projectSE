/**
 * ตรวจตัวอ่านไฟล์ทะเบียนพนักงาน (Excel ของฝ่ายบุคคล)
 *
 * ทำไมสำคัญ: ไฟล์นี้เป็นทางเดียวที่บัญชีพนักงานใหม่เข้าระบบ อ่านชื่อพลาด =
 * สร้างบัญชีที่ชื่อ-นามสกุลสลับ/มีขยะติด แล้วไม่มีใครรู้จนกว่าจะไปโผล่ในรายงาน
 *
 * เคสที่ดักไว้เป็นของจริงจากไฟล์ 1-8-69 ทั้งหมด:
 *   - ZWSP (U+200B) หน้าคำว่า "นาย"  → ตัดคำนำหน้าไม่ออก ชื่อเพี้ยนทั้งคน (SEC232)
 *   - NBSP (U+00A0) หลังคำว่า "นาย"  → เว้นวรรคที่ไม่ใช่ช่องว่าง (SEC343, SEC373, SEC372)
 *   - รหัสมีเว้นวรรคคั่น "SEC 481"    → regex เดิมจับไม่ได้ คนหายไปเงียบ ๆ
 *   - คอลัมน์ 3-4 = เซอร์เวย์นอก      → ห้ามนับเป็นพนักงานเรา
 *
 * รัน:  npx ts-node --transpile-only tests/staffImport.roster.test.ts
 */
import ExcelJS from 'exceljs';
import { parseRoster } from '../src/services/staffImport.service';

const ZWSP = '\u200b';
const NBSP = '\u00a0';
const INVISIBLE = /[\u00a0\u200b-\u200d\u2060\ufeff\u180e]/;

const FAILS: string[] = [];
const check = (name: string, cond: boolean) => {
  console.log((cond ? '  OK   ' : ' FAIL  ') + name);
  if (!cond) FAILS.push(name);
};

/** สร้างไฟล์จำลองที่หน้าตาเหมือนของฝ่ายบุคคล (บล็อกหัวหน้า + 4 คอลัมน์) */
async function buildWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  const rows: (string | null)[][] = [
    ['นาย หัวหน้า ทดสอบ', '081-111-2222', 'ควบคุมพนักงาน 4 คน', 'เซอร์เวย์นอก 1 จังหวัด'],
    ['พื้นที่', 'โทรศัพท์', 'เซอร์เวย์นอก', 'โทรศัพท์'],
    ['กรุงเทพ ฯ', null, null, null],                                  // ชื่อพื้นที่ ไม่มีรหัส → ข้าม
    [`SEC232 ${ZWSP}นาย ธนิศ ชูระเชตุ`, '084-058-0201', 'หจก ทดสอบเคลม', '02-222-3333'],
    [`SEC343 นาย${NBSP}มี วงษ์สุวรรณ`, '085-000-1111', null, null],
    ['SEC 481 นาย เว้นวรรค รหัส', '086-000-2222', null, null],
    ['SE483 นางสาว นันทนา หมู่คำ', '097-108-2125', null, null],
  ];
  rows.forEach((r) => ws.addRow(r));
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

(async () => {
  const { staff, supervisors } = await parseRoster(await buildWorkbook());
  const byCode = new Map(staff.map((s) => [s.code, s]));

  check('อ่านหัวหน้าได้ 1 คน พร้อมเบอร์', supervisors.size === 1 && supervisors.get('นาย หัวหน้า ทดสอบ') === '0811112222');
  check('ได้พนักงาน 4 คน (ไม่นับเซอร์เวย์นอก/ชื่อพื้นที่)', staff.length === 4);
  check('รหัสครบทั้ง 4', ['SEC232', 'SEC343', 'SEC481', 'SE483'].every((c) => byCode.has(c)));
  check('"SEC 481" (มีเว้นวรรค) → SEC481', byCode.get('SEC481')?.name === 'นาย เว้นวรรค รหัส');

  // ── อักขระล่องหน ── ถ้าหลุดเข้าไป TITLE_RE จะตัด "นาย" ไม่ออก ชื่อ-นามสกุลเลยเลื่อนไปหมด
  check('ไม่มีอักขระล่องหนหลงเหลือในชื่อ', staff.every((s) => !INVISIBLE.test(s.name)));
  check('ZWSP หน้า "นาย" — SEC232 ชื่อถูก', byCode.get('SEC232')?.name === 'นาย ธนิศ ชูระเชตุ');
  check('NBSP หลัง "นาย" — SEC343 ชื่อถูก', byCode.get('SEC343')?.name === 'นาย มี วงษ์สุวรรณ');

  // จำลองการแยกชื่อ-นามสกุลตอนสร้างบัญชี (ตรรกะเดียวกับ applyImport)
  const split = (n: string) => n.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ)\s*/, '').trim().split(/\s+/);
  check('SEC232 แยกเป็น ธนิศ / ชูระเชตุ',
    JSON.stringify(split(byCode.get('SEC232')!.name)) === JSON.stringify(['ธนิศ', 'ชูระเชตุ']));
  check('SE483 คำนำหน้า นางสาว ก็ตัดออก',
    JSON.stringify(split(byCode.get('SE483')!.name)) === JSON.stringify(['นันทนา', 'หมู่คำ']));

  check('เบอร์โทรถูกล้างเหลือแต่ตัวเลข', byCode.get('SE483')?.phone === '0971082125');
  check('ไม่มี "หจก ทดสอบเคลม" (คอลัมน์เซอร์เวย์นอก) ปนเข้ามา',
    !staff.some((s) => s.name.includes('หจก')));

  console.log('\n' + (FAILS.length === 0 ? 'ALL PASS ✅' : `FAILED ${FAILS.length}: ${FAILS.join('; ')}`));
  process.exit(FAILS.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
