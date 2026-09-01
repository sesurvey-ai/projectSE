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

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
