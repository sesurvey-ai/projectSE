/**
 * การ์ด "รหัสพนักงานต้องติดไปกับรายชื่อช่างสำรวจ"
 *
 * คนจ่ายงานเลือกช่างจากรายชื่อบนหน้าสร้างเคส — **ชื่อซ้ำกันได้ รหัสไม่ซ้ำ**
 * และรหัส (SE###/SEC###) คือตัวที่ใช้เรียกกันในงานจริง ทั้งบนการ์ดของบริษัทประกัน
 * และในไฟล์รายชื่อพนักงาน
 *
 * รหัสไหลมา 2 ทางที่ต้องตรงกัน — ตกทางใดทางหนึ่ง = ป้ายรหัสหายไปเงียบ ๆ
 * แบบที่ยัง compile ผ่านและหน้าไม่พัง:
 *   · ตอนกด "เรียกพิกัด"  → GET /api/locations/latest
 *   · ตอนช่างส่งพิกัดกลับ → socket 'location_update' (2 จุดที่ยิง)
 */
import * as fs from 'fs';
import * as path from 'path';

let failed = 0;
const check = (label: string, ok: boolean, note = '') => {
  if (!ok) failed++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${note ? `  (${note})` : ''}`);
};
const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

console.log('\n── รหัสพนักงานในรายชื่อช่างสำรวจ ──');

const loc = read('src', 'services', 'location.service.ts');
/** ทั้ง getLatest และ getLatestNearest — หน้าเว็บใช้ตัวไหนขึ้นกับว่าเคสมีพิกัดไหม */
check('คิวรีรายชื่อดึง code มาด้วยครบทั้ง 2 ตัว',
      (loc.match(/u\.first_name, u\.last_name, u\.username, u\.code/g) ?? []).length === 2);

for (const [where, file] of [
  ['ตอนช่างส่งพิกัดผ่าน API', ['src', 'controllers', 'user.controller.ts']],
  ['ตอนช่างส่งพิกัดผ่าน socket', ['src', 'socket', 'locationHandler.ts']],
] as [string, string[]][]) {
  const src = read(...file);
  check(`${where}: query ดึง code`, /SELECT[^']*\bcode\b[^']*FROM users WHERE id = \$1/.test(src));
  check(`${where}: ส่ง code ไปกับ location_update`, /code: userInfo\.code \?\? null/.test(src));
}

const assign = read('..', 'web', 'src', 'components', 'cases', 'AssignSurveyor.tsx');
check('รายชื่อบนหน้าสร้างเคสโชว์รหัส', /\{s\.code && \(/.test(assign) && assign.includes('{s.code}'));
/** ไม่มีรหัส (บัญชีทดสอบ/คนใหม่ที่ยังไม่ได้ใส่) ต้องไม่ขึ้นป้ายเปล่า ๆ หรือคำว่า null */
check('ไม่มีรหัสก็ไม่ขึ้นป้ายเปล่า', /code\?: string \| null;/.test(assign));

const map = read('..', 'web', 'src', 'components', 'map', 'SurveyorMap.tsx');
check('หมุดบนแผนที่โชว์รหัสด้วย (ให้ตรงกับรายชื่อข้างล่าง)', /s\.code \? `\$\{s\.code\} ` : ''/.test(map));

console.log(failed === 0 ? '\n✅ ผ่านทั้งหมด\n' : `\n❌ ไม่ผ่าน ${failed} ข้อ\n`);
process.exit(failed === 0 ? 0 : 1);
