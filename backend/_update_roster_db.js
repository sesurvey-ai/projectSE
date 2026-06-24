// TEMP: sync ตารางเวรจาก roster-jun.ts (extract ล่าสุด) → DB duty_schedules(2026/6)
//   + merge ชื่อเต็มจาก DB เดิม (ที่ reconcile นามสกุลแล้ว) กลับเข้า seed และ DB
//   node _update_roster_db.js          → dry-run (โชว์ความต่าง ไม่เขียนอะไร)
//   node _update_roster_db.js apply    → เขียนจริง (DB + roster-jun.ts)
const fs = require('fs');
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ROSTER_PATH = 'C:\\Users\\i9\\Desktop\\se-survey\\web\\src\\app\\duty-demo2\\roster-jun.ts';
const YEAR = 2026, MONTH = 6, DAYS = 30; // มิ.ย. 2026
const onlyDigits = (s) => (s || '').replace(/\D/g, '');
const APPLY = process.argv[2] === 'apply';

(async () => {
  try {
    // 1) อ่าน roster ใหม่จากไฟล์ seed
    const txt = fs.readFileSync(ROSTER_PATH, 'utf8');
    const eqPos = txt.indexOf('=', txt.indexOf('ROSTER_JUN'));
    const json = txt.slice(eqPos + 1, txt.lastIndexOf(';')).trim();
    const roster = JSON.parse(json);

    // 2) ข้อมูลเดิมใน DB
    const dbRows = (await pool.query(
      `SELECT center_id, data FROM duty_schedules WHERE year=$1 AND month=$2`, [YEAR, MONTH])).rows;
    const oldBy = {}; dbRows.forEach((r) => { oldBy[r.center_id] = r.data; });
    const admin = (await pool.query(`SELECT id FROM users WHERE username='admin01'`)).rows[0];

    // ชื่อเต็มเดิมจาก DB: codeDigits -> name (ใช้เมื่อชื่อใหม่สั้นกว่าและขึ้นต้นเหมือนกัน)
    const fullName = {};
    for (const r of dbRows) (r.data.staff || []).forEach((s) => {
      const k = onlyDigits(s.code); if (k && s.name) fullName[k] = s.name;
    });

    for (const cid of Object.keys(roster)) {
      const z = roster[cid];
      // merge ชื่อ: ชื่อจาก xls สั้นกว่า + คำแรกตรงกับชื่อเต็มใน DB → ใช้ชื่อเต็ม DB
      const nameFixes = [];
      z.people.forEach((p) => {
        const full = fullName[onlyDigits(p.code)];
        if (full && full !== p.name && full.split(' ')[0] === p.name.split(' ')[0] && full.length > p.name.length) {
          nameFixes.push(`${p.code}: "${p.name}" → "${full}"`);
          p.name = full;
        }
      });

      // shape เดียวกับที่หน้า duty-demo2 เซฟ: staff(id=cid_i) + schedule{id:{day:key}}
      const staff = z.people.map((p, i) => ({ id: `${cid}_${i}`, code: p.code, name: p.name }));
      const schedule = {};
      staff.forEach((s, pi) => {
        schedule[s.id] = {};
        for (let d = 1; d <= DAYS; d++) schedule[s.id][d] = z.grid[d - 1]?.[pi] ?? 'none';
      });

      // เทียบกับของเดิมใน DB (จับคู่คนด้วยรหัส) → นับช่องเวรที่เปลี่ยน
      const old = oldBy[cid];
      const diffs = [];
      let added = [], removed = [];
      if (old) {
        const oldByCode = {}; (old.staff || []).forEach((s) => { oldByCode[onlyDigits(s.code)] = s; });
        const newCodes = new Set(z.people.map((p) => onlyDigits(p.code)));
        added = z.people.filter((p) => !oldByCode[onlyDigits(p.code)]).map((p) => p.code);
        removed = (old.staff || []).filter((s) => !newCodes.has(onlyDigits(s.code))).map((s) => s.code);
        staff.forEach((s) => {
          const o = oldByCode[onlyDigits(s.code)];
          if (!o) return;
          for (let d = 1; d <= DAYS; d++) {
            const ov = old.schedule?.[o.id]?.[d] ?? 'none';
            const nv = schedule[s.id][d];
            if (ov !== nv) diffs.push(`วันที่ ${d} ${s.code}: ${ov} → ${nv}`);
          }
        });
      }

      const tag = !old ? '(ใหม่ ไม่เคยมีใน DB)' : diffs.length || added.length || removed.length || nameFixes.length ? '' : '(ไม่เปลี่ยน)';
      console.log(`\n■ ${cid} ${tag}`);
      if (nameFixes.length) console.log('   ชื่อ (คงนามสกุลเต็มจาก DB):', nameFixes.join(' | '));
      if (added.length) console.log('   + คนใหม่:', added.join(', '));
      if (removed.length) console.log('   - คนหาย:', removed.join(', '));
      if (diffs.length) { console.log(`   เวรเปลี่ยน ${diffs.length} ช่อง:`); diffs.forEach((d) => console.log('     ', d)); }

      if (APPLY) {
        await pool.query(
          `INSERT INTO duty_schedules (center_id, year, month, data, updated_by)
           VALUES ($1,$2,$3,$4::jsonb,$5)
           ON CONFLICT (center_id, year, month)
           DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [cid, YEAR, MONTH, JSON.stringify({ staff, schedule }), admin?.id ?? null]
        );
      }
    }

    if (APPLY) {
      // เขียนชื่อที่ merge แล้วกลับลง roster-jun.ts (กริดคงตาม xls ใหม่)
      const head = txt.slice(0, eqPos + 1);
      fs.writeFileSync(ROSTER_PATH, head + ' ' + JSON.stringify(roster) + ';\n', 'utf8');
      console.log('\n✔ APPLIED: DB 14 ศูนย์ + roster-jun.ts (ชื่อเต็ม)');
    } else {
      console.log('\n(dry-run — ยังไม่เขียน รัน `node _update_roster_db.js apply` เพื่อเขียนจริง)');
    }
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
})();
