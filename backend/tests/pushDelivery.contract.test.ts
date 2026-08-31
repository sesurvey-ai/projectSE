/**
 * การ์ดของ "แจ้งเตือนงานใหม่ต้องรู้ว่าถึงเครื่องหรือไม่" (31/08/69)
 *
 * ⛔ ปัญหาที่แก้: FCM ตอบ success = **Google รับเรื่องไว้** ไม่ได้แปลว่าเครื่องได้รับ
 *    ถ้า push หายกลางทาง ไม่มีใครในระบบรู้เลย ทั้งช่างและคนจ่ายงาน กว่าจะรู้คือลูกค้าโทรมาถาม
 *
 * สายนี้พาดข้าม 4 ชั้น (Kotlin → API → DB → เว็บ) และ **พังแบบเงียบได้ทุกข้อต่อ**:
 * ลืมต่อสายตรงไหนก็ตาม หน้าจอยังทำงานปกติทุกอย่าง แค่กลับไปเป็น "ยิงแล้วไม่รู้ว่าถึงไหม"
 * เหมือนเดิมโดยไม่มี error ให้เห็น — จึงต้องมีการ์ดไล่ทีละข้อต่อ
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
const caseRoutes = read('src', 'routes', 'case.routes.ts');
const userSvc = read('src', 'services', 'user.service.ts');
const userRoutes = read('src', 'routes', 'user.routes.ts');
const migration = read('src', 'db', 'migrations', '046_push_delivery.sql');
const assignUi = read('..', 'web', 'src', 'components', 'cases', 'AssignSurveyor.tsx');
const readyUi = read('..', 'web', 'src', 'app', 'callcenter', 'notification-readiness', 'page.tsx');
const kt = (f: string) => read('..', 'mobile', 'android', 'app', 'src', 'main', 'kotlin', 'com', 'sesurvey', 'se_survey', f);
const locHelper = kt('LocationHelper.kt');
const fcmSvc = kt('MyFirebaseMessagingService.kt');
const mainAct = kt('MainActivity.kt');
const manifest = read('..', 'mobile', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const notifDart = read('..', 'mobile', 'lib', 'services', 'notification_service.dart');
const homeDart = read('..', 'mobile', 'lib', 'screens', 'home_screen.dart');

console.log('\n── ที่เก็บข้อมูล ──');
/**
 * ⛔ TIMESTAMPTZ เท่านั้น — prod เป็น UTC เครื่องพัฒนาเป็นเวลาไทย
 *    node-postgres อ่าน TIMESTAMP (ไม่มีโซน) เป็นเวลาท้องถิ่นของ process → เพี้ยน 7 ชม.
 *    เคยโดนมาแล้วตอนทำ assigned_at (migration 044)
 */
check('push_sent_at / push_delivered_at เป็น TIMESTAMPTZ',
      /push_sent_at\s+TIMESTAMPTZ/.test(migration) && /push_delivered_at\s+TIMESTAMPTZ/.test(migration));

console.log('\n── ฝั่งเซิร์ฟเวอร์: บันทึกผลตอนจ่ายงาน ──');
check('จ่ายงานแล้วบันทึกสถานะ push ลงเคส',
      /UPDATE cases SET push_sent_at = \$1, push_delivered_at = NULL/.test(caseSvc));
/**
 * ⛔ ต้องล้าง push_delivered_at ทุกครั้งที่จ่ายงาน — reassign หลังช่างคนก่อนปฏิเสธ
 *    ถ้าไม่ล้าง เวลาตอบรับของคนเก่าจะค้างมาหลอกว่างานรอบใหม่ถึงเครื่องคนใหม่แล้ว
 */
check('ล้าง push_delivered_at เสมอ (กัน reassign เห็นค่าค้างของคนก่อน)',
      caseSvc.includes('push_delivered_at = NULL'));
/** ส่งไม่ออก (no_token/failed/no_fcm) ต้องไม่ตั้ง push_sent_at ไม่งั้นดูเหมือนส่งแล้ว */
check('ตั้ง push_sent_at เฉพาะตอนส่งออกจริง',
      /push\.status === 'sent' \? new Date\(\) : null/.test(caseSvc));

console.log('\n── ฝั่งเซิร์ฟเวอร์: รับคำตอบรับจากเครื่อง ──');
check('มี ackPush ในเซอร์วิส', caseSvc.includes('async ackPush('));
/** ⛔ ช่างคนอื่นตอบรับแทนกันไม่ได้ — ไม่มี guard นี้ = ใครก็ปิดสัญญาณเตือนของงานคนอื่นได้ */
check('ตอบรับได้เฉพาะเจ้าของงาน (assigned_to)',
      /UPDATE cases SET push_delivered_at = NOW\(\)[\s\S]{0,120}assigned_to = \$2/.test(caseSvc));
/** FCM ส่งซ้ำเองได้ + native retry 3 ครั้ง → ยิงซ้ำต้องไม่ทับเวลาที่บันทึกครั้งแรก */
check('ยิงซ้ำไม่ทับเวลาเดิม (idempotent)',
      /push_delivered_at IS NULL/.test(caseSvc));
check('มี getPushStatus ให้หน้าจ่ายงานถาม', caseSvc.includes('async getPushStatus('));

console.log('\n── เส้นทาง API + สิทธิ์ ──');
check('POST /:id/push-ack เป็นของ surveyor',
      /push-ack.*requireRole\('surveyor'\)/.test(caseRoutes));
/** ⛔ สถานะแจ้งเตือนคือข้อมูลภายใน ห้ามเปิดให้ surveyor ดูของคนอื่น */
check('GET /:id/push-status จำกัด callcenter/admin',
      /push-status.*requireRole\('callcenter', 'admin'\)/.test(caseRoutes));
check('GET /notification-readiness จำกัด callcenter/admin',
      /notification-readiness.*requireRole\('callcenter', 'admin'\)/.test(userRoutes));

console.log('\n── ฝั่งเครื่อง (Kotlin) ──');
check('มีตัวยิงคำตอบรับกลับ', locHelper.includes('fun postPushAck('));
check('ยิงไปที่ /push-ack', locHelper.includes('/push-ack'));
check('ยิงตอนได้รับงานใหม่', fcmSvc.includes('LocationHelper.postPushAck('));
/**
 * ⛔ ต้องมี wakelock คร่อม: onMessageReceived คืนแล้ว process โดน freeze ใน Doze
 *    ก่อน POST เสร็จ = ออฟฟิศเห็น "ยังไม่ถึง" ทั้งที่ถึงแล้ว (false alarm ที่ทำให้คนเลิกเชื่อ)
 */
check('ถือ wakelock คร่อมการยิง', fcmSvc.includes('se_survey:push_ack'));
/** caseId ที่ generate จากนาฬิกา (push ไม่มี case_id) ไม่มีอยู่บนเซิร์ฟเวอร์ — ยิงไปก็ 404 เปล่า ๆ */
check('ยิงเฉพาะเคสจริง ไม่ยิงด้วย id ที่ generate เอง',
      /caseIdStr\.toIntOrNull\(\) != null\) LocationHelper\.postPushAck/.test(fcmSvc));

console.log('\n── หน้าจ่ายงาน: รอคำตอบรับ ──');
check('poll ถามสถานะจริง', assignUi.includes('/push-status'));
check('รอตอบรับก่อนเด้งออกจากหน้า', /await waitForAck\(/.test(assignUi));
check('มีสถานะครบ 3 แบบ (รอ/ถึงแล้ว/ไม่ตอบ)',
      /'waiting' \| 'ok' \| 'timeout'/.test(assignUi));
/**
 * ⛔ poll ล้ม (เน็ตออฟฟิศสะดุด) ห้ามสรุปว่า "ไม่ถึง" — เตือนผิดบ่อย ๆ คนจะเลิกเชื่อคำเตือน
 *    แล้วคำเตือนก็หมดค่า ตอนที่มันถูกจริงก็ไม่มีใครสนใจ
 */
check('poll ล้มแล้วข้ามรอบ ไม่ตีเป็น "ไม่ถึง"',
      /catch \{ \/\* อ่านสถานะไม่ได้รอบนี้/.test(assignUi));
check('ไม่ตอบรับ → บอกให้โทรตาม', assignUi.includes('โทรแจ้งช่างด้วย'));
/** ออกจากหน้าไปแล้วต้องหยุด poll ไม่งั้น setState หลัง unmount + เด้งหน้าทับสิ่งที่ผู้ใช้ทำอยู่ */
check('ออกจากหน้าแล้วหยุด poll', /return \(\) => \{ ackAbort\.current = true; \};/.test(assignUi));
/**
 * ⛔ ต้องรีเซ็ตธงเป็น false ตอน mount ด้วย — StrictMode (dev) รัน effect สองรอบ
 *    mount → unmount → mount ทำให้ cleanup ตั้งธงค้างตั้งแต่ยังไม่ได้ใช้ แล้ว poll
 *    return ทิ้งทุกครั้ง = แบนเนอร์ค้าง "กำลังรอ" ตลอดกาล ไม่ขึ้นทั้งเขียวและเหลือง
 *    (เจอจากการเทสจริง 31/08/69 — ไม่มี error ที่ไหนเลย)
 */
check('รีเซ็ตธงตอน mount (กัน StrictMode/รีมาวต์ทำ poll ตายค้าง)',
      /ackAbort\.current = false;/.test(assignUi));

console.log('\n── ตัวประหยัดแบต (สาเหตุอันดับ 1 ที่ push ไม่เข้า) ──');
check('ประกาศ permission ขอยกเว้น',
      manifest.includes('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'));
check('native เช็ค + ขอยกเว้นได้',
      mainAct.includes('"isIgnoringBatteryOptimizations"') && mainAct.includes('"requestIgnoreBatteryOptimizations"'));
check('Dart เรียกผ่าน channel ได้',
      notifDart.includes('isBatteryOptimizationIgnored') && notifDart.includes('requestIgnoreBatteryOptimization'));
check('หน้าหลักเตือนช่างเมื่อยังไม่ยกเว้น', homeDart.includes('_BatteryWarningBanner'));
/** อ่านค่าไม่ได้ = อย่าเดาว่าแย่ ไม่งั้นแบนเนอร์ขึ้นค้างบนเครื่องที่ปกติดี แล้วคนจะเมิน */
check('อ่านสถานะไม่ได้ → ถือว่าปกติ (ไม่เตือนมั่ว)',
      /catch \(e\) \{[\s\S]{0,120}return true;/.test(notifDart));
/** กลับจากหน้าตั้งค่าระบบต้องเช็คใหม่ ไม่งั้นแบนเนอร์ค้างทั้งที่ผู้ใช้กดยกเว้นให้แล้ว */
check('กลับเข้าแอปแล้วเช็คใหม่',
      /AppLifecycleState\.resumed\) _check\(\)/.test(homeDart));

console.log('\n── รายชื่อคนที่ยังรับแจ้งเตือนไม่ได้ ──');
check('มี notificationReadiness ในเซอร์วิส', userSvc.includes('async notificationReadiness('));
check('นับเฉพาะผู้สำรวจที่ยังใช้งานอยู่',
      /role = 'surveyor' AND u\.is_active = true/.test(userSvc));
/**
 * ⛔ อย่าใช้ surveyor_locations.recorded_at เป็น "เห็นล่าสุด": เป็น TIMESTAMP ไม่มีโซน
 *    (เพี้ยน 7 ชม.) และถูกบันทึกเฉพาะตอนแอดมินกดขอพิกัด ไม่ใช่สัญญาณว่าเครื่องตื่น
 */
check('ใช้ push_delivered_at เป็นสัญญาณ "ถึงเครื่องล่าสุด"',
      /max\(push_delivered_at\) AS last_push_ok/.test(userSvc));
// เช็คที่ตัวคิวรี ไม่ใช่ทั้งไฟล์ — ในคอมเมนต์เตือนมีชื่อตารางนี้อยู่โดยตั้งใจ
check('ไม่ดึงเวลาจาก surveyor_locations', !/FROM surveyor_locations/.test(userSvc));
check('หน้าเว็บบอกว่าคนที่ไม่พร้อมคือ "จ่ายงานไปก็ไม่ขึ้นบนเครื่อง"',
      readyUi.includes('จ่ายงานไปก็ไม่มีอะไรขึ้นบนเครื่องเลย'));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
