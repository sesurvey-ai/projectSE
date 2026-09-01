/**
 * การ์ดของ "ช่องที่การ์ดค่าใช้จ่ายเติมให้เอง" — user เคาะ 01/09/69
 *
 * ทำไมต้องมี: ทุกช่องในการ์ดนี้เป็นตัวเงินจริง (ฝั่งจ่ายพนักงาน + ฝั่งเรียกเก็บประกัน)
 * "เติมให้" ผิดจะไม่มีอะไรฟ้อง — หัวหน้าเห็นเลขในช่องก็เชื่อว่าถูกแล้วกดบันทึกต่อ
 *
 * 2 กติกาที่คุมไว้ที่นี่
 *   1. ค่าบริการเติม "1 ครั้ง" ให้เลย — เรทที่ระบบเสนอคือเรทของ 1 ครั้งอยู่แล้ว
 *   2. ข้อเสนอค่ารูปที่เป็น 0 ห้ามเขียนเลข 0 ลงช่อง — ปล่อยว่าง
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const ui = read('..', 'web', 'src', 'components', 'cases', 'CaseDetail.tsx');

console.log('\n── ค่าบริการ: เติมจำนวนครั้งให้เลย ──');
check('ยังไม่เคยกรอก → เติม 1 ครั้ง',
      ui.includes(`name="service_fee_count" defaultValue={exV.service_fee_count || (previewing ? '' : '1')}`));
/**
 * ⛔ ต้องเป็น `||` ไม่ใช่เติมทับ — หัวหน้าที่แก้เป็น 2 ครั้ง (ไปซ้ำรอบ) แล้วบันทึก
 *    ถ้าเติมทับตอนเปิดหน้าใหม่ ยอดจะเด้งกลับเป็น 1 เงียบ ๆ
 */
check('ไม่ทับค่าที่บันทึกไว้แล้ว', /exV\.service_fee_count \|\|/.test(ui));
/**
 * ⛔ ดูครั้งอื่นอยู่ = อ่านอย่างเดียว ห้ามเติม — ครั้งที่ยังไม่ได้กรอกจะดูเหมือน
 *    กรอกไว้แล้ว 1 ครั้ง ทั้งที่ในฐานข้อมูลว่าง (ยอดสะสมทั้งเคลมจะอ่านผิดตาม)
 */
check('ดูครั้งอื่นอยู่ → ไม่เติม', ui.includes(`(previewing ? '' : '1')`));

console.log('\n── ค่ารูปถ่าย: ข้อเสนอ 0 = ปล่อยว่าง ──');
/**
 * งานกรุงเทพ / ไทยไพบูลย์ / ไปถึงแล้วไม่พบ → กติกาเหมาตอบ 0 (ดู photoFee.contract.test.ts)
 * String(0) = "0" ทำให้ช่องขึ้นเลข 0 ทั้งที่ความหมายคือ "ไม่มีค่ารูป" (user แจ้ง 01/09/69)
 */
check('จำนวนรูป: 0 → ไม่เขียนลงช่อง',
      ui.includes(`(photoFee?.count ? String(photoFee.count) : '')`)
      && !ui.includes(`(photoFee ? String(photoFee.count) : '')`));
check('ราคาประกัน: 0 → ไม่เขียนลงช่อง',
      ui.includes(`(photoFee?.price ? String(photoFee.price) : '')`)
      && !ui.includes(`(photoFee ? String(photoFee.price) : '')`));
/** หมายเหตุยังต้องขึ้น — ช่องว่างเฉย ๆ ไม่บอกว่าว่างเพราะกติกาหรือเพราะยังไม่ได้กรอก */
check('ยังบอกเหตุผลว่าทำไมไม่มีค่ารูป', ui.includes('ค่ารูปตามกติกาเหมา: ${photoFee.reason}'));
check('เติมจริงเมื่อไหร่ยังใช้คำว่า "เติมให้"', ui.includes('ค่ารูปเติมให้ตามกติกาเหมา'));

console.log('\n── รวมยอดของแต่ละฝั่ง (แสดงสด) ──');
/**
 * user ขอ 01/09/69: กรอกไปแล้วต้องเห็นยอดรวมของทั้ง 2 ฝั่งเลย ไม่ต้องกดบันทึกก่อน
 *
 * ⛔ **ยอดรวมนี้ห้ามหลุดออกจากหน้าเว็บ** — EMCS คิดยอดรวมเอง (บอทกรอกแต่ช่องรายแถว
 *    ฝั่งเสนอ แล้วกด Tab ให้ EMCS รวมให้ ดู fill_fee_table ใน se-autokey) ถ้าเราส่ง
 *    ยอดรวมไปด้วยจะกลายเป็นเลข 2 ชุดที่ไม่มีอะไรรับประกันว่าตรงกัน
 */
check('มีแถวรวมยอดท้ายตาราง', ui.includes('<tfoot>') && ui.includes('>รวมยอด</td>'));
check('แสดงยอดทั้ง 2 ฝั่ง', ui.includes('{baht(liveSum.pay)}') && ui.includes('{baht(liveSum.ins)}'));
/**
 * ⛔ การ์ดนี้อยู่ใน <form> เดียวกับฟอร์มหลัก — ช่องที่มี name จะถูก FormData เก็บไปด้วย
 *    ยอดรวมมี name เมื่อไหร่ = ยอดที่ "คำนวณให้ดู" กลายเป็นยอดที่ถูกบันทึก แล้วไหลต่อ
 *    ไปถึง XML และหน้าค่าใช้จ่าย EMCS
 */
const tfoot = (ui.match(/<tfoot>[\s\S]*?<\/tfoot>/) ?? [''])[0];
check('⛔ ยอดรวมเป็นตัวอ่านอย่างเดียว ไม่มี name (ไม่ถูกบันทึก / ไม่ไป EMCS)',
      tfoot.length > 0 && !/<input/.test(tfoot) && !/\bname=/.test(tfoot));

console.log('\n── สูตรยอดรวมต้องตรงกับ backend ──');
const paySvc = read('src', 'services', 'pay.service.ts');
const names = (t: string) => (t.match(/'([a-z_]+)'/g) ?? []).map((x) => x.replace(/'/g, ''));
const backPay = names((paySvc.match(/PAY_MONEY_FIELDS = \[([^\]]+)\]/) ?? [])[1] ?? '');
const frontPay = names((ui.match(/PAY_MONEY_INPUTS = \[([\s\S]*?)\];/) ?? [])[1] ?? '')
  .map((x) => x.replace(/^pay_/, ''));
check('ช่องเงินฝั่งพนักงานตรงกับ backend ครบ 8 ช่อง',
      backPay.length === 8 && backPay.join(',') === frontPay.join(','),
      `${backPay.join(',')} | ${frontPay.join(',')}`);
/** ยอดนอกพื้นที่/นอกเวลาเป็นค่าคงที่ฝั่ง backend — หน้าเว็บส่งแค่ติ๊ก/ไม่ติ๊ก */
check('นอกพื้นที่ +50 ตรงกับ backend',
      /out_of_area_amt\) \?\? 50/.test(paySvc) && ui.includes('OUT_OF_AREA_AMT = 50;'));
check('นอกเวลา +100 ตรงกับ backend',
      /out_of_hours_amt\) \?\? 100/.test(paySvc) && ui.includes('OUT_OF_HOURS_AMT = 100;'));
check('หักเงินเป็นลบออกจากยอด', ui.includes('+ area + hours - deduct'));
check('ฝั่งประกันใช้ชุดช่องเดียวกับยอดสะสมทั้งเคลม', ui.includes('const INS = INS_MONEY_INPUTS;'));
/**
 * ⛔ รางขวามี key={viewVisit} = สลับ "ครั้งที่" แล้ว DOM ถูกสร้างใหม่ทั้งราง
 *    ตัวฟัง input ต้องผูกใหม่ ไม่งั้นค้างอยู่กับ node เก่าที่หลุดจากจอ → ยอดค้างเลขครั้งก่อน
 */
check('สลับครั้งที่แล้วผูกตัวฟังใหม่', ui.includes('}, [recalcSums, viewVisit]);'));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
