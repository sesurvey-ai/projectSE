/**
 * การ์ดของ "กดดูรูปแล้วเปิดหน้าต่างแยก" — user สั่ง 01/09/69
 *
 * เหตุผล: ผู้ตรวจต้องอ่านรูปเทียบกับช่องข้อมูลบนหน้าเว็บไปพร้อมกัน กล่องทับกลางจอ
 * บังฟอร์มทั้งหน้า ต้องปิด-เปิดสลับทุกช่องที่ตรวจ
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const gallery = read('..', 'web', 'src', 'components', 'cases', 'PhotoGallery.tsx');
const apiLib = read('..', 'web', 'src', 'lib', 'api.ts');

console.log('\n── เปิดรูปในหน้าต่างแยก ──');
check('กดรูปในตารางแล้วเปิดหน้าต่างแยก', /onClick=\{\(\) => openInWindow\(p\)\}/.test(gallery));
/** ระบุ width/height ถึงจะได้ "หน้าต่าง" จริง — ไม่ระบุ เบราว์เซอร์เปิดเป็นแท็บซึ่งบังหน้าเว็บอยู่ดี */
check('เปิดเป็นหน้าต่างจริง ไม่ใช่แท็บ', /window\.open\('', 'se_photo_viewer', 'width=\d+,height=\d+/.test(gallery));
/**
 * ⛔ ห้าม window.open(url) ตรง ๆ — URL รูปมี token ติดอยู่ (getPhotoUrl ส่งทาง query
 *    เพราะ <img> แนบ header ไม่ได้) เปิดตรง ๆ = token โผล่บน address bar + ค้างในประวัติ
 */
check('ไม่เปิด URL รูปตรง ๆ (token จะโผล่บน address bar)',
      /token=/.test(apiLib) && !/window\.open\(\s*getSrc/.test(gallery) && !/window\.open\(src/.test(gallery));
/** ไม่ตั้งชื่อหน้าต่าง = เคสรูป 40 ใบเปิดหน้าต่างใหม่ 40 บาน */
check('ใช้หน้าต่างเดิมซ้ำ (ตั้งชื่อไว้)', gallery.includes("'se_photo_viewer'"));
/** เบราว์เซอร์บล็อกป๊อปอัป → ต้องมีทางถอย ไม่ใช่กดแล้วเงียบ */
check('ป๊อปอัปถูกบล็อก → ถอยไปใช้กล่องทับจอเดิม', /if \(!w\) \{ setSelected\(p\); return; \}/.test(gallery));
/** ผู้ตรวจไล่ดูรูปทีละใบระหว่างกรอก — ไม่มีปุ่มถัดไปต้องกลับไปกดที่ตารางทุกใบ */
check('ในหน้าต่างมีปุ่มก่อนหน้า/ถัดไป', gallery.includes("id=\"prev\"") && gallery.includes("id=\"next\""));
check('กดรูปเพื่อซูมเต็มขนาดได้', /img\.className=img\.className\?'':'full'/.test(gallery));

console.log('\n── แถบรูปซ้าย · ตัวกรอง · ลบรูป ──');
const winPart = gallery.split('w.document.write')[1] || '';
check('มีแถบรูปด้านซ้าย + ตัวกรองหมวด',
      /id="side"/.test(gallery) && /id="strip"/.test(gallery) && /id="filter"/.test(gallery));
check('ตัวกรองมี "ทั้งหมด" + นับจำนวนต่อหมวด',
      gallery.includes("ทั้งหมด ('+ALL.length+')") && gallery.includes("+' ('+n+')</option>'"));
check('กดรูปในแถบซ้ายแล้วเปลี่ยนรูปตรงกลาง',
      gallery.includes("i=+this.getAttribute('data-k');show();"));
check('มีปุ่มลบรูปที่กำลังดูอยู่', /id="del"/.test(gallery) && gallery.includes('__seDeletePhoto(L[i].id)'));
/**
 * ⛔ ปุ่มลบในหน้าต่างต้องเรียกกลับมาที่หน้าเว็บแม่ ห้ามยิง API เอง —
 *    ไม่งั้นต้องส่ง token เข้าไปเก็บในหน้าต่าง + เขียนตัวจัดการ error/รีเฟรชซ้ำอีกชุด
 */
check('ลบผ่านหน้าเว็บแม่ ไม่ยิง API จากในหน้าต่าง',
      winPart.includes('window.opener.__seDeletePhoto') && !/fetch\([^)]{0,40}\/api\/cases/.test(winPart));
/**
 * ⛔ ลบแล้วต้องดันรายการใหม่เข้าหน้าต่างด้วย — หน้าเว็บแม่รีเฟรชเอง แต่หน้าต่างที่เปิด
 *    ค้างไว้ไม่มีทางรู้ รูปที่ลบไปจะยังค้างในแถบซ้ายและกดดูได้อีก
 */
check('ลบแล้วรายการในหน้าต่างอัปเดตตาม',
      winPart.includes('window.__seSetPhotos=function')
      && /__seSetPhotos\b/.test(gallery.split('w.document.write')[0]));
check('ยืนยันก่อนลบที่ตัวหน้าต่างเอง (confirm ของหน้าแม่จะไปโผล่ข้างหลัง)',
      winPart.includes("confirm('ลบรูปนี้ออกจากเคส"));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
