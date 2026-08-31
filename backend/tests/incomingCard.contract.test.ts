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
check('ไม่มีเลขเคลม → ซ่อนทั้งแถว',
      /row_claim\)\.visibility = if \(hasClaim\) View\.VISIBLE else View\.GONE/.test(activity));
/** เส้นคั่นเหนือ "สถานที่เกิดเหตุ" ต้องหายไปด้วย ไม่งั้นเหลือเส้นลอยไม่มีอะไรอยู่ข้างบน */
check('ซ่อนเส้นคั่นตามไปด้วยเมื่อไม่มีเลขเคลม',
      /div_incident\)\.visibility = if \(hasClaim\) View\.VISIBLE else View\.GONE/.test(activity));
check('แถวเริ่มต้นซ่อนไว้ใน layout',
      /android:id="@\+id\/row_claim"[\s\S]{0,400}android:visibility="gone"/.test(layout));

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

console.log('\n── ปฏิเสธงานพร้อมเหตุผล ──');
const svc = read('src', 'services', 'case.service.ts');
const migration = read('src', 'db', 'migrations', '047_decline_reason.sql');
const dash = read('..', 'web', 'src', 'app', 'callcenter', 'page.tsx');
const notifDart = read('..', 'mobile', 'lib', 'services', 'notification_service.dart');
const caseList = read('..', 'mobile', 'lib', 'screens', 'case_list_screen.dart');
check('มีที่เก็บครบ 3 ช่อง (เหตุผล/ใคร/เมื่อไหร่)',
      /declined_reason TEXT/.test(migration) && /declined_by\s+INTEGER/.test(migration)
      && /declined_at\s+TIMESTAMPTZ/.test(migration));
/**
 * ⛔ declined_by ต้องเก็บแยก — คำสั่งเดียวกันล้าง assigned_to เป็น NULL
 *    ไม่เก็บ = ผู้จ่ายงานไม่มีทางรู้ว่าใครไม่รับ แล้วจ่ายให้คนเดิมซ้ำโดยไม่รู้ตัว
 */
check('บันทึกทั้งเหตุผลและคนที่ปฏิเสธตอนล้าง assigned_to',
      /assigned_to = NULL,[\s\S]{0,80}declined_reason = \$2, declined_by = \$3, declined_at = NOW\(\)/.test(svc));
/** APK เก่าไม่ส่ง reason มา ต้องปฏิเสธได้ตามปกติ ไม่ใช่ 400 */
check('ไม่มีเหตุผลก็ยังปฏิเสธได้ (APK เก่า)', /reason\?: string/.test(svc));
/**
 * ⛔ มี **2 คิวรี** ที่ป้อนหน้าจอฝั่ง callcenter: getStats (การ์ด "เคสล่าสุด" บนแดชบอร์ด)
 *    กับ list (หน้ารายการเคสทั้งหมด) — แก้ตัวเดียวอีกหน้าจะโชว์ "-" ต่อไปโดยไม่มีอะไรฟ้อง
 *    (เจอจากการเปิดหน้าจริงบน prod ดู ไม่ใช่จากอ่านโค้ด)
 */
check('ทั้ง 2 คิวรีของ callcenter join ชื่อคนที่ปฏิเสธ',
      (svc.match(/LEFT JOIN users d ON c\.declined_by = d\.id/g) || []).length === 2);
check('หน้าจ่ายงานแสดงว่าใครไม่รับ + เพราะอะไร',
      dash.includes('declined_first_name') && dash.includes('ไม่รับงาน'));
check('มี 4 เหตุผลบนแอป',
      activity.includes('"อยู่ระหว่างปฏิบัติงานอื่น"') && activity.includes('"ติดภารกิจ ไม่สะดวกรับงาน"'));
/** ยังไม่เลือกเหตุผล = กดยืนยันไม่ทำอะไร — ไม่งั้นได้เหตุผลเปล่าซึ่งคือปัญหาเดิมที่กำลังแก้ */
check('ยังไม่เลือกเหตุผล → ยืนยันไม่ได้', /if \(reasonIdx < 0\) return/.test(activity));
/** ยิงจาก native เพราะหน้าเต็มจอเด้งได้แม้แอปตายสนิท — Flutter isolate อาจไม่มีชีวิตอยู่ */
check('ยิงปฏิเสธจาก native เอง', /LocationHelper\.postDecline\(this, caseId, reason\)/.test(activity));
check('Flutter รับ declined_done แล้วแค่รีเฟรช ไม่ยิงซ้ำ',
      /action == 'declined_done'/.test(notifDart) && /_onRefreshOnly\?\.call/.test(notifDart));

console.log('\n── หน้าจอตามแบบใหม่ ──');
check('นับถอยหลังเท่ากับเพดานเสียง',
      /COUNTDOWN_SEC = 60/.test(activity) && /ALARM_MAX_MS = 60_000L/.test(helper));
check('มีปุ่มปิดเสียงบนหัวจอ', /R\.id\.btn_mute/.test(activity));
/**
 * ⛔ หน้านี้วาดเต็มจอทับ lock screen — ไม่เว้น inset = หัวจอโดนนาฬิกาทับ
 *    และ **ปุ่มรับงานโดนแถบนำทางกินครึ่งปุ่ม** (เจอจากการเทสจริง 31/08/69)
 */
check('เว้นที่ให้แถบสถานะ/แถบนำทาง',
      /applySystemBarInsets\(\)/.test(activity)
      && /content\.setPadding\(0, bars\.top, 0, bars\.bottom\)/.test(activity));
check('ชื่ออังกฤษเทียบจากชื่อไทย ไม่เก็บใน DB', /fun insurerEnglish\(/.test(helper));

console.log('\n── หน้าสรุปหลังกดรับ/ปฏิเสธ ──');
check('มีทั้งหน้ารับงานและหน้าปฏิเสธ',
      /android:id="@\+id\/accepted_screen"/.test(layout) && /android:id="@\+id\/declined_screen"/.test(layout));
check('โชว์เลขเคลมบนหน้าสรุปทั้งคู่',
      /txt_accepted_claim\)\.text/.test(activity) && /txt_declined_claim\)\.text/.test(activity));
check('หน้าปฏิเสธบอกเหตุผลที่ส่งขึ้นระบบจริง', /txt_declined_reason\)\.text = "เหตุผล: \$reason"/.test(activity));
/** รับงาน: โชว์สรุปก่อน แล้วค่อยเปิดแอป — กดแล้วกระโดดเข้าฟอร์มทันทีจะไม่ทันเห็นว่าใบไหน */
const acceptFn = activity.slice(activity.indexOf('private fun handleAction'));
const acceptBody = acceptFn.slice(0, acceptFn.indexOf('\n    @Deprecated'));
check('รับงาน = โชว์สรุปก่อนแล้วค่อยเปิดแอป',
      acceptBody.includes('accepted_screen).visibility = View.VISIBLE')
      && acceptBody.includes('startActivity(launchIntent)')
      && acceptBody.indexOf('accepted_screen') < acceptBody.indexOf('startActivity'));
/**
 * ⛔ ปฏิเสธแล้ว **ห้ามเปิดแอป** — ช่างเพิ่งบอกว่าไม่รับงาน การเด้งแอปขึ้นมาสวนความตั้งใจ
 *    (รายการงานรีเฟรชเองตอนกลับเข้าแอปแทน — didChangeAppLifecycleState ที่หน้ารายการ)
 */
const declineFn = activity.slice(activity.indexOf('private fun confirmDecline'));
const declineBody = declineFn.slice(0, declineFn.indexOf('\n    private fun', 10));
check('ปฏิเสธแล้วไม่เปิดแอป', !declineBody.includes('startActivity'));
check('รายการงานรีเฟรชเองตอนกลับเข้าแอป',
      /didChangeAppLifecycleState[\s\S]{0,260}fetchMyCases\(\)/.test(caseList));
/** user 31/08/69: หน้าปฏิเสธแดงเต็มจอให้คู่กับหน้ารับงานที่เขียวเต็มจอ */
check('หน้าปฏิเสธแดงเต็มจอ ตัวหนังสือขาว',
      /declined_screen"[\s\S]{0,200}android:background="#EC3013"/.test(layout)
      && /android:text="ปฏิเสธงานแล้ว"[\s\S]{0,200}android:textColor="#FFFFFF"/.test(layout));
/** ปุ่มทั้งชุดโค้งเท่ากัน — โค้งไม่เท่ากันจะดูเหมือนคนละระบบ */
const btnGreen = read('..', 'mobile', 'android', 'app', 'src', 'main', 'res', 'drawable', 'btn_accept_green.xml');
const btnRed = read('..', 'mobile', 'android', 'app', 'src', 'main', 'res', 'drawable', 'btn_confirm_red.xml');
const btnOutline = read('..', 'mobile', 'android', 'app', 'src', 'main', 'res', 'drawable', 'border_dark_2dp.xml');
check('ปุ่มรับงาน/ยืนยันปฏิเสธ/ยกเลิก โค้งเท่ากันทั้ง 3',
      [btnGreen, btnRed, btnOutline].every((f) => /android:radius="12dp"/.test(f)));
check('ปุ่มในหน้าจอใช้พื้นโค้งจริง',
      layout.includes('@drawable/btn_accept_green') && layout.includes('@drawable/btn_confirm_red'));
check('หน้าสรุปเว้นที่ให้แถบระบบด้วย',
      /accepted\.setPadding\(dp\(24\), bars\.top/.test(activity)
      && /declinedBody\.setPadding\(dp\(24\), 0, dp\(24\), dp\(28\) \+ bars\.bottom\)/.test(activity));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
