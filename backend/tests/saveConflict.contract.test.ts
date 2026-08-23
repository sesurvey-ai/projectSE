/**
 * การ์ดกัน "หัวหน้า 2 คนบันทึกทับกันเงียบ ๆ"
 *
 * ทำไมต้องมี: หน้าตรวจเคสส่งทุกช่องไปพร้อมกันตอนกดบันทึก ไม่ใช่เฉพาะช่องที่แก้
 * สองคนเปิดเคสเดียวกัน คนที่บันทึกทีหลังจึงทับงานคนแรก**ทั้งหน้า** ด้วยค่าเก่าในจอตัวเอง
 * และทั้งคู่เห็น "บันทึกสำเร็จ" — ไม่มีใครรู้ว่าข้อมูลหาย
 *
 * การกันนี้ประกอบด้วย 4 ชิ้นที่ต้องอยู่ครบพร้อมกัน ขาดชิ้นใดชิ้นหนึ่ง = รูโหว่กลับมาเงียบ ๆ
 * โดยที่ typecheck/build ยังผ่านหมด เทสนี้จึงตรวจว่าทั้ง 4 ชิ้นยังอยู่:
 *   1. คอลัมน์ rev + trigger บวกเองในฐานข้อมูล (migration 042)
 *   2. ด่านตรวจอยู่ **ใน** transaction และล็อกแถว (ไม่งั้นสองคนกดพร้อมกันผ่านทั้งคู่)
 *   3. ฝั่งยอดเงินตรวจแต่ห้ามบวก rev (ปุ่มบันทึก 1 ครั้งยิง 2 คำขอ)
 *   4. หน้าเว็บส่ง base_rev ไปทั้ง 2 คำขอ + เก็บ rev ใหม่กลับมา
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

console.log('\n── กันหัวหน้า 2 คนบันทึกทับกัน ──');

// ── 1. ฐานข้อมูล ──────────────────────────────────────────────────────────
const mig = read('src', 'db', 'migrations', '042_report_rev.sql');
check('migration เพิ่มคอลัมน์ rev', /ADD COLUMN IF NOT EXISTS rev\s+INT NOT NULL DEFAULT 1/.test(mig));
check('เก็บด้วยว่าใครบันทึกล่าสุด (ข้อความตอนชนกันต้องบอกชื่อได้)',
      mig.includes('updated_by') && mig.includes('updated_at'));
/**
 * ⛔ ต้องเป็น trigger ไม่ใช่บวกเลขในโค้ด — survey_reports ถูกเขียนจากหลายทาง
 * (มือถือส่งงาน · ผู้ตรวจแก้บนเว็บ · นำเข้า XML · แอดมินแก้ตัวระบุเคส)
 * บวกทีละที่แล้ววันหลังมีใครเพิ่มทางใหม่โดยลืม = กันไม่ได้จริงแบบไม่มี error ให้เห็น
 */
check('rev บวกเองที่ฐานข้อมูล ครอบคลุมทุกทางที่เขียน',
      /CREATE TRIGGER trg_survey_reports_rev[\s\S]*BEFORE UPDATE ON survey_reports/.test(mig));

// ── 2. ด่านตรวจ ───────────────────────────────────────────────────────────
const guard = read('src', 'services', 'reportRev.ts');
check('ด่านล็อกแถวได้ (FOR UPDATE)', guard.includes('FOR UPDATE'));
check('ไม่ส่ง base_rev มา = ปฏิเสธ ไม่ใช่ปล่อยผ่าน',
      /Number\.isInteger\(asNum\)/.test(guard) && /throw new AppError\(409/.test(guard));
check('ข้อความบอกว่าใครบันทึกคั่น + ต้องทำอะไรต่อ',
      guard.includes('เคสนี้ไปแล้ว') && guard.includes('มีคนอื่นบันทึก')
      && guard.includes('โหลดข้อมูลล่าสุด'));

const svc = read('src', 'services', 'case.service.ts');
const txn = svc.slice(svc.indexOf('async updateReport'));
const beginAt = txn.indexOf("await client.query('BEGIN')");
const guardAt = txn.indexOf('assertReportRev(caseId, opts.baseRev');
const updAt = txn.indexOf('UPDATE survey_reports SET ${fields.join');
check('บันทึกรายงานผ่านด่านก่อนเสมอ', guardAt > 0);
/**
 * ⛔ เช็คนอก transaction = สองคนที่กดพร้อมกันเป๊ะ ๆ อ่าน rev เดิมได้เท่ากันทั้งคู่
 *    แล้วผ่านด่านไปทั้งคู่ — กันไม่ได้ในกรณีที่ควรกันที่สุด
 */
check('ด่านอยู่ใน transaction และมาก่อนการเขียน',
      beginAt > 0 && guardAt > beginAt && updAt > guardAt);
check('ล็อกแถวไว้จนจบ transaction', /assertReportRev\(caseId, opts\.baseRev, \{ client, lock: true \}\)/.test(txn));
/**
 * แก้เฉพาะตารางค่าใช้จ่าย (ไม่มีช่องรายงานเปลี่ยนเลย) ก็ต้องทำให้ rev เดิน
 * ไม่งั้นสองคนที่แก้แต่ค่าใช้จ่ายจะทับกันได้เหมือนเดิม
 */
check('เขียน updated_by เสมอ → rev เดินทุกครั้งที่กดบันทึก',
      /fields\.push\(`updated_by = \$\$\{idx\+\+\}`\)/.test(txn));
check('ส่ง rev ใหม่กลับไปให้หน้าเว็บ', /rev: Number\(after\.rows\[0\]\?\.rev/.test(txn));

// ── 3. ฝั่งยอดเงิน ────────────────────────────────────────────────────────
const pay = read('src', 'services', 'pay.service.ts');
check('บันทึกยอดเงินก็ผ่านด่านเดียวกัน', pay.includes('assertReportRev(caseId, baseRev)'));
/**
 * ⛔ ปุ่มบันทึก 1 ครั้งยิง 2 คำขอ (ยอดเงินก่อน แล้วรายงาน) ทั้งคู่ถือ rev ตัวเดียวกัน
 *    ถ้าฝั่งยอดเงินบวก rev ด้วย คำขอที่สองจะเด้งชนตัวเอง = กดบันทึกไม่ได้เลยสักครั้ง
 */
check('ฝั่งยอดเงินตรวจอย่างเดียว ไม่บวก rev',
      !/UPDATE survey_reports[\s\S]{0,200}rev/.test(pay));

// ── 4. หน้าเว็บ ───────────────────────────────────────────────────────────
const web = read('..', 'web', 'src', 'components', 'cases', 'CaseDetail.tsx');
check('ส่ง base_rev ไปกับการบันทึกรายงาน',
      /report_data: payload, base_rev: rev/.test(web));
check('ส่ง base_rev ไปกับการบันทึกยอดเงินด้วย',
      /\.\.\.payBody, base_rev: rev/.test(web));
/** ไม่เก็บ rev ใหม่ = กดบันทึกสองครั้งติดจะเด้ง "มีคนบันทึกคั่น" ใส่ตัวเอง */
check('เก็บ rev ใหม่หลังบันทึกสำเร็จ',
      /setRev\(res\.data\.data\.rev\)/.test(web));
/** โหลดเคสใหม่แล้วไม่อัปเดต rev = ชนซ้ำวนไปเรื่อย ๆ กดโหลดใหม่กี่ครั้งก็แก้ไม่ได้ */
check('โหลดเคสใหม่แล้ว rev เดินตาม',
      /if \(typeof report\?\.rev === 'number'\) setRev\(report\.rev\)/.test(web));
/** เดิม catch เปล่า ๆ กลืนข้อความจริงจากเซิร์ฟเวอร์ทิ้งทุกกรณี */
check('เอาข้อความจริงจากเซิร์ฟเวอร์มาแสดง ไม่กลืนทิ้ง',
      /err\.response\?\.data\?\.message \|\| 'เกิดข้อผิดพลาดในการบันทึก'/.test(web));
check('ชนกันแล้วขึ้นแถบเตือนค้างไว้ พร้อมปุ่มโหลดข้อมูลล่าสุด',
      /status === 409\) \{ setConflict\(msg\); setSaveMsg\(''\); \}/.test(web)
      && web.includes('โหลดข้อมูลล่าสุด'));
/**
 * ข้อความชนกันยาวหลายบรรทัด — ขึ้น 2 ที่พร้อมกันแล้วแถบหัวเคสถูกดันจนปุ่มเบียดกัน
 * (เห็นจริงตอนทดสอบบนเว็บจริง 23/08/69) ต้องเหลือแถบเต็มความกว้างอย่างเดียว
 */
check('ไม่ขึ้นข้อความซ้ำในแถบปุ่มด้วย', /setConflict\(msg\); setSaveMsg\(''\)/.test(web));
/** ⛔ ห้ามโหลดใหม่ให้เอง — สิ่งที่พิมพ์ค้างอยู่หายหมดโดยไม่ได้ถาม */
check('โหลดข้อมูลล่าสุดต้องถามก่อน (ของที่พิมพ์ค้างจะหาย)',
      /window\.confirm\('โหลดข้อมูลล่าสุด\?/.test(web));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด\n' : `\n❌ ไม่ผ่าน ${failed} ข้อ\n`);
process.exit(failed === 0 ? 0 : 1);
