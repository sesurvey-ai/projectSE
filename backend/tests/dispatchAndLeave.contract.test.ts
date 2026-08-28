/**
 * การ์ดของ 2 เรื่องที่ทำพร้อมกัน 28/08/69
 *
 *   1. หน้าจ่ายงาน "แสดงเฉพาะช่างที่ว่าง"
 *   2. แจ้งเตือนเรื่องลา (ผลอนุมัติ → เครื่องพนักงาน · ใบลาใหม่ → หน้าแอดมิน)
 *
 * ทั้งคู่เป็น **การต่อสายข้ามไฟล์** ที่พังแบบเงียบได้: ลืมต่อสายแล้วหน้าจอยังทำงานปกติ
 * แค่ไม่มีใครได้รับแจ้งเตือน / รายชื่อกรองผิดคน — ไม่มี error ให้เห็นเลย
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const caseSvc = read('src', 'services', 'case.service.ts');
const assign = read('..', 'web', 'src', 'components', 'cases', 'AssignSurveyor.tsx');
const board = read('..', 'web', 'src', 'app', 'callcenter', 'checkin-board', 'page.tsx');

console.log('\n── งานในมือ: 2 นิยาม 2 ที่ใช้ ──');
/**
 * ⛔ `active` (assigned+surveyed) เป็นของ **บอร์ดเข้างาน** ห้ามเปลี่ยนความหมาย
 *    ถ้าเผลอแก้ให้เหลือ assigned อย่างเดียว ป้าย "N งาน" บนบอร์ดจะลดลงเงียบ ๆ
 *    โดยไม่มีอะไรฟ้อง — คนดูบอร์ดจะเข้าใจว่าคนว่างกว่าความจริง
 */
check('ยังคืน active = assigned + surveyed ไว้ให้บอร์ดเข้างาน',
      /COUNT\(c\.id\)\)?::int\s+AS active/.test(caseSvc)
      && /c\.status IN \('assigned','surveyed'\)/.test(caseSvc));
check('บอร์ดเข้างานยังอ่าน active ตัวเดิม', board.includes('Number(w.active)'));
/** นิยาม "ว่าง" ที่ user เคาะ = ยังไม่ได้รับมอบหมาย → ต้องแยก assigned ออกมาต่างหาก */
check('แยก assigned (ยังไม่ส่งงาน) ออกมาให้หน้าจ่ายงาน',
      /FILTER \(WHERE c\.status = 'assigned'\)::int\s+AS assigned/.test(caseSvc));
check('แยก surveyed (ส่งแล้วรอตรวจ) ออกมาเป็นข้อมูล',
      /FILTER \(WHERE c\.status = 'surveyed'\)::int\s+AS surveyed/.test(caseSvc));

console.log('\n── หน้าจ่ายงาน: ว่าง / ถืองาน ──');
check('ดึงงานในมือมาใช้จริง', assign.includes("api.get('/api/cases/workload')"));
/** ⛔ "ว่าง" ต้องดูเฉพาะ assigned — ถ้าเผลอเอา active มาใช้ คนที่ส่งงานแล้วจะถูกซ่อนผิด */
check('ว่าง = assigned เป็น 0 (ไม่นับงานที่ส่งแล้ว)',
      /const isFree = .*assigned \?\? 0\) === 0/.test(assign));
check('งานที่ส่งแล้วโชว์เป็นข้อมูล ไม่ใช่เหตุผลที่ซ่อน', assign.includes('ส่งแล้วรอตรวจ'));
/**
 * ⛔ **ห้ามตัดคนที่ถืองานทิ้งจากรายการ** — บางวันช่างในพื้นที่ถืองานกันหมด
 *    ตัดออกจริง = รายชื่อว่างเปล่า จ่ายงานไม่ได้เลยทั้งที่ยังมีคน (เหตุผลเดียวกับที่
 *    ห้ามกรองด้วยพิกัด) · ต้องยุบเก็บให้กดดูได้เท่านั้น
 */
check('คนที่ถืองานยังกดดูและมอบหมายได้ ไม่ได้หายไป',
      /const busy = sorted\.filter\(\(s\) => !isFree\(s\)\)/.test(assign)
      && /showBusy && busy\.map\(row\)/.test(assign));
check('ไม่มีใครว่างเลย → บอกทางออก ไม่ปล่อยหน้าว่าง', assign.includes('ตอนนี้ไม่มีช่างที่ว่างเลย'));
/** โหลด workload ไม่สำเร็จ = ไม่รู้ว่าใครถืองาน → ต้องโชว์ทุกคน ไม่ใช่ซ่อนทุกคน */
check('ยังไม่รู้งานในมือ = ถือว่าว่างไว้ก่อน',
      /workload\?\.\[String\(s\.user_id\)\] \?\? null/.test(assign)
      && /\.catch\(\(\) => setWorkload\(null\)\)/.test(assign));
check('มอบหมายเสร็จแล้วรายชื่อ "ว่าง" อัปเดตตาม', /loadWorkload\(\);\s+\/\//.test(assign));

console.log('\n── แจ้งเตือนใบลา ──');
const leaveSvc = read('src', 'services', 'leave.service.ts');
const leaveEvents = read('src', 'services', 'leaveEvents.ts');
const leavePage = read('..', 'web', 'src', 'app', 'admin', 'leave', 'page.tsx');

check('อนุมัติ/ไม่อนุมัติแล้วส่งแจ้งเตือนเข้าเครื่องพนักงาน',
      /await fcmService\.sendNotification\(/.test(leaveSvc));
/**
 * ⛔ ใช้ `notification` (ไม่ใช่ data-only) — แอนดรอยด์แสดงเองตอนแอปอยู่เบื้องหลัง
 *    จึงไม่ต้องแก้แอปมือถือ/แจก APK ใหม่ · ถ้าเปลี่ยนเป็น sendSilentPush เมื่อไหร่
 *    แจ้งเตือนจะเงียบสนิทบนทุกเครื่องที่ยังไม่ได้อัปแอป
 */
check('ใช้แบบที่มือถือเดิมแสดงได้เอง ไม่ต้องแจก APK ใหม่',
      !/sendSilentPush/.test(leaveSvc));
/** ⛔ ส่งแจ้งเตือนล้ม ≠ อนุมัติล้ม — ใบลาบันทึกไปแล้ว ห้ามโยน error ทับ */
check('ส่งแจ้งเตือนล้มแล้วยังอนุมัติสำเร็จ',
      /return \{ status: 'failed'/.test(leaveSvc) && /return \{ \.\.\.row, push: await pushLeaveResult\(row\) \}/.test(leaveSvc));
/** เงียบแบบจ่ายงานเคยเป็น = หัวหน้าคิดว่าพนักงานรู้แล้ว ทั้งที่ไม่มีอะไรไปถึงเลย */
check('ผลการส่งไหลกลับไปถึงคนกดอนุมัติ',
      /push\.status !== 'sent'/.test(leavePage) && leavePage.includes('โทรแจ้งพนักงานด้วย'));
check('token ตายแล้วล้างทิ้ง ไม่ค้างหลอกว่ามี',
      /registration-token-not-registered/.test(leaveSvc));
check('ไม่ได้ตั้งค่า Firebase = บอกเหตุผล ไม่ใช่ล้มเงียบ',
      /isFirebaseReady\(\)/.test(leaveSvc));

check('ยื่นใบลาใหม่แล้วหน้าแอดมินรู้เอง', /notifyLeaveChanged\('created'/.test(leaveSvc));
check('อนุมัติแล้วแท็บแอดมินอื่นรู้ด้วย', /notifyLeaveChanged\('reviewed'/.test(leaveSvc));
/** ⛔ สัญญาณ commit แล้วค่อยส่ง — ไม่งั้นเตือนเรื่องที่ rollback ทิ้งไปแล้ว */
check('ส่งสัญญาณหลัง COMMIT เท่านั้น',
      /await client\.query\('COMMIT'\);[\s\S]{0,200}notifyLeaveChanged\('created'/.test(leaveSvc));
/** เหตุผลการลาเป็นเรื่องส่วนตัว — สัญญาณห้ามพ่วงข้อมูลใบลาไปด้วย */
check('สัญญาณไม่พ่วงข้อมูลใบลา (เหตุผลการลาเป็นเรื่องส่วนตัว)',
      !/reason: row/.test(leaveEvents) && /emit\('leave_changed', \{ reason, by/.test(leaveEvents));
check('ส่งเฉพาะห้องแอดมิน (คนอื่นไม่มีสิทธิ์ดูใบลา)',
      /io\.to\('role:admin'\)\.emit/.test(leaveEvents));
check('หน้าแอดมินฟังสัญญาณแล้วโหลดใหม่',
      /socket\.on\('leave_changed'/.test(leavePage) && /socket\.off\('leave_changed'/.test(leavePage));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด\n' : `\n❌ ไม่ผ่าน ${failed} ข้อ\n`);
process.exit(failed === 0 ? 0 : 1);
