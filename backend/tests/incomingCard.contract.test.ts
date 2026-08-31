/**
 * การ์ดของ "หน้าจอแจ้งเตือนงานใหม่" บนมือถือ — user สั่ง 31/08/69
 *
 *   1. โชว์เลขเคลมบนการ์ด (ส่งมากับ push อยู่แล้ว เดิมรับค่ามาแต่ไม่ได้เอาขึ้นจอ)
 *   4. เสียงเตือนหยุดเองเมื่อครบ 60 วินาที แต่แจ้งเตือนยังค้างให้กดรับได้
 *
 * ทั้งชุดเป็นโค้ด native ที่ **ไม่มีเทสรันได้** (ต้องมีเครื่อง + FCM จริง) และพังแบบเงียบ:
 * รับค่ามาแล้วไม่ได้วางบนจอ / ตั้งนาฬิกาแล้วลืมยกเลิก — ไม่มี error ที่ไหนเลย
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const kt = (f: string) => read('..', 'mobile', 'android', 'app', 'src', 'main', 'kotlin', 'com', 'sesurvey', 'se_survey', f);

const activity = kt('IncomingCallActivity.kt');
const helper = kt('NotificationHelper.kt');
const layout = read('..', 'mobile', 'android', 'app', 'src', 'main', 'res', 'layout', 'activity_incoming_call.xml');

console.log('\n── เลขเคลมบนการ์ด ──');
check('layout มีช่องเลขเคลม', /android:id="@\+id\/txt_claim_no"/.test(layout));
check('มีหัวข้อ "เลขเคลม" ให้อ่านออกว่าเลขอะไร', /android:text="เลขเคลม"/.test(layout));
check('เอาค่าขึ้นจอจริง', /R\.id\.txt_claim_no\)\.text = claimNo/.test(activity));
/**
 * ⛔ ไม่มีเลข = ซ่อนทั้งแถว ห้ามใส่ "-" หรือปล่อยแถวเปล่า
 *    งานที่ยังไม่มีเลขเคลมมีจริง (callcenter เปิดเคสก่อนได้เลขจากบริษัทประกัน)
 *    เส้นคั่นกับหัวข้อลอยอยู่โดยไม่มีค่า = ดูเหมือนจอค้าง/โหลดไม่ขึ้น
 */
check('ไม่มีเลขเคลม → ซ่อนทั้งแถว', /claimRow\.visibility = View\.GONE/.test(activity));
check('แถวเริ่มต้นซ่อนไว้ใน layout', /android:id="@\+id\/row_claim"[\s\S]{0,200}android:visibility="gone"/.test(layout));

console.log('\n── เสียงเตือนหยุดเองเมื่อครบเวลา ──');
check('มีเพดานเวลา 60 วินาที', /ALARM_MAX_MS = 60_000L/.test(helper));
check('ตั้งนาฬิกาตอนเริ่มเสียง', /fun startAlarm[\s\S]{0,400}scheduleAutoStop\(\)/.test(helper));
/**
 * ⛔ ต้องตั้งเวลา "ก่อน" early-return ที่เช็ค isPlaying — งานใบที่ 2 เข้ามาตอนใบแรก
 *    ยังดังอยู่ ถ้าข้ามไป เสียงของใบใหม่จะโดนตัดด้วยนาฬิกาของใบเก่าที่ใกล้หมดแล้ว
 */
const startBody = helper.slice(helper.indexOf('fun startAlarm'));
check('ต่อเวลาให้งานใบใหม่ที่เข้ามาระหว่างเสียงดังอยู่',
      startBody.indexOf('scheduleAutoStop()') < startBody.indexOf('if (mediaPlayer?.isPlaying == true) return'));
/** กดรับ/กดปิดเสียงแล้วนาฬิกาต้องถูกล้าง ไม่งั้นมันไปยิง stopAlarm ทับเสียงของงานใบถัดไป */
check('หยุดเสียงเองแล้วล้างนาฬิกาทิ้ง', /fun stopAlarm\(\) \{\s*\n\s*cancelAutoStop\(\)/.test(helper));
/**
 * ⛔ หมดเวลาแล้วห้ามยกเลิก notification — งานยังไม่ถูกรับ ต้องเหลือร่องรอยไว้เสมอ
 *    (ถ้าเผลอเรียก cancelNotification ตรงนี้ = งานหายเงียบจากทั้งจอและแถบ)
 */
check('หมดเวลาแล้วปิดแค่เสียง ไม่ยกเลิกแจ้งเตือน',
      /Runnable \{[\s\S]{0,160}stopAlarm\(\)\s*\n\s*\}/.test(helper)
      && !/Runnable \{[\s\S]{0,160}cancelNotification/.test(helper));

console.log('\n── โลโก้บริษัทประกัน ──');
const drawables = fs.readdirSync(
  path.join(__dirname, '..', '..', 'mobile', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi'));
check('มีไฟล์โลโก้ไทยไพบูลย์', drawables.includes('logo_tpb.png'));
check('มีไฟล์โลโก้ไอโออิ', drawables.includes('logo_aioi.png'));
check('มีตัวเลือกโลโก้ตัวเดียว ไม่กระจายเงื่อนไข', /fun logoFor\(insuranceCompany: String\): Int\?/.test(helper));
check('หน้าเต็มจอเรียกตัวเลือกนั้น', /NotificationHelper\.logoFor\(insuranceCompany\)/.test(activity));
/**
 * ⛔ ต้องเทียบแบบ contains ห้ามเทียบเป๊ะ — ชื่อบริษัทที่บันทึกจริงมีหลายแบบปนกัน
 *    ('ไอโออิกรุงเทพประกันภัย' · 'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)')
 *    เทียบเป๊ะเมื่อไหร่ = โลโก้หายเงียบโดยไม่มีอะไรฟ้อง
 */
check('จับชื่อไอโออิได้ทั้งไทยและอังกฤษ',
      /contains\("ไอโออิ"\)/.test(helper) && /contains\("AIOI", ignoreCase = true\)/.test(helper));
check('บริษัทที่ไม่มีโลโก้ → ซ่อนรูป ไม่ค้างโลโก้เจ้าอื่น',
      /else -> null/.test(helper) && /logoView\.visibility = View\.GONE/.test(activity));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
