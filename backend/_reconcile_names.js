// ปรับ "ทุกชื่อ" ในตารางเวรให้ตรงกับ mapping (จับคู่ด้วยรหัส SE) — แก้ทั้ง DB duty_schedules(2026/6) + seed roster-jun.ts
// mapping = แหล่งความจริง; ถ้าชื่อปัจจุบัน != ชื่อใน mapping (ของรหัสเดียวกัน) -> เปลี่ยนเป็นของ mapping
const fs = require('fs');
require('dotenv').config();
const { Pool } = require('pg');

const MAP_PATH = 'C:\\Users\\i9\\Desktop\\se-dashboard\\mapping_supervisor_staff_.json';
const ROSTER_PATH = 'C:\\Users\\i9\\Desktop\\se-survey\\web\\src\\app\\duty-demo2\\roster-jun.ts';
const onlyDigits = (s) => (s || '').replace(/\D/g, '');
const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');

// 1) mapping → codeNum -> full name
const mapping = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const byCode = {};
const TITLES = ['นางสาว', 'น.ส.', 'นาง', 'นาย', 'คุณ'];
for (const sup of Object.keys(mapping)) for (const s of mapping[sup]) {
  const m = /^SE\s*(\d+)\s*(.*)$/.exec(s.trim()); if (!m) continue;
  let rest = m[2].trim();
  for (const t of TITLES) if (rest.startsWith(t)) { rest = rest.slice(t.length).trim(); break; }
  byCode[String(parseInt(m[1], 10))] = norm(rest.split(/\s+/).join(' '));
}

// 2) roster
const tsTxt = fs.readFileSync(ROSTER_PATH, 'utf8');
const eqPos = tsTxt.indexOf('=', tsTxt.indexOf('ROSTER_JUN'));
const jStart = tsTxt.indexOf('{', eqPos), jEnd = tsTxt.lastIndexOf('}');
const ROSTER = JSON.parse(tsTxt.slice(jStart, jEnd + 1));

const firstWord = (s) => norm(s).split(' ')[0];
const APPLY = process.argv[2] === 'apply';

function planChange(cur, code) {
  const want = byCode[onlyDigits(code)];
  if (!want) return { type: 'unmatched' };
  if (norm(cur) === want) return { type: 'same' };
  return { type: firstWord(cur) !== firstWord(want) ? 'firstdiff' : 'fix', want };
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // collect plan from roster (covers all people; DB has same set)
    const fixes = [], firstdiffs = [], unmatched = [];
    for (const c of Object.keys(ROSTER)) for (const p of ROSTER[c].people) {
      const r = planChange(p.name, p.code);
      if (r.type === 'fix') fixes.push({ c, code: p.code, from: p.name, to: r.want });
      else if (r.type === 'firstdiff') firstdiffs.push({ c, code: p.code, from: p.name, to: r.want });
      else if (r.type === 'unmatched') unmatched.push({ c, code: p.code, name: p.name });
    }
    console.log('=== ปรับสะกด/นามสกุล (ชื่อต้นเหมือนเดิม) ' + fixes.length + ' ===');
    fixes.forEach(r => console.log(`  ${r.c} ${r.code}: "${r.from}" -> "${r.to}"`));
    console.log('\n=== ⚠️ ชื่อต้นต่างกัน (ตรวจให้ดี) ' + firstdiffs.length + ' ===');
    firstdiffs.forEach(r => console.log(`  ${r.c} ${r.code}: "${r.from}" -> "${r.to}"`));
    console.log('\n=== ไม่มีในmapping (ไม่แตะ) ' + unmatched.length + ' ===');
    unmatched.forEach(r => console.log(`  ${r.c} ${r.code} "${r.name}"`));

    if (!APPLY) { console.log('\n(dry-run — ใส่ "apply" เพื่อเขียนจริง)'); return; }

    // apply DB
    const { rows } = await pool.query(`SELECT id, center_id, data FROM duty_schedules WHERE year=2026 AND month=6`);
    let dbN = 0;
    for (const row of rows) {
      let changed = false;
      for (const s of (row.data.staff || [])) {
        const want = byCode[onlyDigits(s.code)];
        if (want && norm(s.name) !== want) { s.name = want; changed = true; dbN++; }
      }
      if (changed) await pool.query(`UPDATE duty_schedules SET data=$1, updated_at=NOW() WHERE id=$2`, [row.data, row.id]);
    }
    // apply roster
    let rN = 0;
    for (const c of Object.keys(ROSTER)) for (const p of ROSTER[c].people) {
      const want = byCode[onlyDigits(p.code)];
      if (want && norm(p.name) !== want) { p.name = want; rN++; }
    }
    fs.writeFileSync(ROSTER_PATH, tsTxt.slice(0, jStart) + JSON.stringify(ROSTER) + tsTxt.slice(jEnd + 1), 'utf8');
    console.log(`\n*** APPLIED *** DB:${dbN}  roster-jun.ts:${rN}`);
  } catch (e) { console.error('ERR:', e.message); }
  finally { await pool.end(); }
})();
