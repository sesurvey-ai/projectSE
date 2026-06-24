// TEMP: sync ตารางเวรจากไฟล์ roster (extract ล่าสุด) → DB duty_schedules(YEAR/MONTH)
//   + merge ชื่อเต็มจาก DB เดิม (ที่ reconcile นามสกุลแล้ว) กลับเข้า seed และ DB
//   node _update_roster_db.js                  → dry-run มิ.ย. (โชว์ความต่าง + ตรวจไฟล์ ไม่เขียน)
//   node _update_roster_db.js apply            → เขียนจริง มิ.ย. — บล็อกถ้าเจอรหัสซ้ำ/ผิด
//   node _update_roster_db.js apply --month=7  → เขียนจริง ก.ค. (อ่าน roster-jul.ts → DB 2026/7)
//   node _update_roster_db.js apply force      → เขียนแม้เจอรหัสซ้ำ (ไม่แนะนำ)
//   เดือนที่รองรับอยู่ใน MONTH_FILE (เพิ่มไฟล์เดือนใหม่ที่นั่น)
// GUARD: ก่อน apply จะตรวจ (1) รหัสซ้ำในเวร (digit เดียวอยู่หลายจุด — แบบ SE436 ที่ลืมแก้ไฟล์),
//        (2) รหัสไม่ตรงพนักงานในระบบ. เจอ (1) → ไม่ apply (กันข้อมูลผิดเข้า DB เงียบ ๆ)
const fs = require('fs');
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// เดือนจาก arg: --month=7 (ดีฟอลต์ 6 = มิ.ย.) → เลือกไฟล์ roster + ตัวแปร + จำนวนวันอัตโนมัติ
const YEAR = 2026;
const MONTH = parseInt((process.argv.find((a) => a.startsWith('--month=')) || '--month=6').split('=')[1], 10);
const DAYS = new Date(YEAR, MONTH, 0).getDate();
const MONTH_FILE = { 6: ['roster-jun.ts', 'ROSTER_JUN'], 7: ['roster-jul.ts', 'ROSTER_JUL'], 8: ['roster-aug.ts', 'ROSTER_AUG'] };
if (!MONTH_FILE[MONTH]) { console.error('❌ ไม่รองรับเดือน', MONTH, '— เพิ่มใน MONTH_FILE ก่อน'); process.exit(1); }
const [ROSTER_FILE, ROSTER_VAR] = MONTH_FILE[MONTH];
const ROSTER_PATH = 'C:\\Users\\i9\\Desktop\\se-survey\\web\\src\\app\\duty-demo2\\' + ROSTER_FILE;
const onlyDigits = (s) => (s || '').replace(/\D/g, '');
const APPLY = process.argv[2] === 'apply';
const FORCE = process.argv.includes('force') || process.argv.includes('--force');

(async () => {
  try {
    // 1) อ่าน roster ใหม่จากไฟล์ seed
    const txt = fs.readFileSync(ROSTER_PATH, 'utf8');
    const eqPos = txt.indexOf('=', txt.indexOf(ROSTER_VAR));
    const json = txt.slice(eqPos + 1, txt.lastIndexOf(';')).trim();
    const roster = JSON.parse(json);

    // 2) ข้อมูลเดิมใน DB
    const dbRows = (await pool.query(
      `SELECT center_id, data FROM duty_schedules WHERE year=$1 AND month=$2`, [YEAR, MONTH])).rows;
    const oldBy = {}; dbRows.forEach((r) => { oldBy[r.center_id] = r.data; });
    const admin = (await pool.query(`SELECT id FROM users WHERE username='admin01'`)).rows[0];

    // รหัสพนักงานที่มีบัญชีในระบบ (digit) — ใช้ตรวจรหัสในเวรว่าตรงคนจริงไหม
    const userDigits = new Set(
      (await pool.query(`SELECT code, username FROM users WHERE role='surveyor'`)).rows
        .map((u) => onlyDigits(u.code || u.username)).filter(Boolean)
    );

    // ── GUARD: ตรวจไฟล์เวรก่อน apply (กัน entry ซ้ำ/รหัสผิด แบบ SE436 ที่ลืมแก้ไฟล์) ──
    const occ = {}; // digit -> [{cid, code, name}]
    for (const cid of Object.keys(roster)) {
      for (const p of roster[cid].people) {
        const d = onlyDigits(p.code) || '∅';
        (occ[d] ||= []).push({ cid, code: p.code, name: p.name });
      }
    }
    const dupCodes = Object.entries(occ).filter(([d, a]) => d !== '∅' && a.length > 1);
    const noDigit = occ['∅'] || [];
    const unresolved = Object.entries(occ)
      .filter(([d]) => d !== '∅' && !userDigits.has(d))
      .map(([d, a]) => ({ digit: d, name: a[0].name, where: a.map((x) => x.cid).join(',') }));

    console.log('\n══════ ตรวจไฟล์เวร (guard) ══════');
    if (dupCodes.length) {
      console.log(`🔴 รหัสซ้ำ ${dupCodes.length} รหัส (รหัสเดียวอยู่หลายจุด/แถว — แบบ SE436):`);
      for (const [d, a] of dupCodes) console.log(`   SE${d}: ` + a.map((x) => `${x.name || '?'}@${x.cid}`).join('  ||  '));
    } else console.log('✓ ไม่มีรหัสซ้ำ');
    if (noDigit.length) console.log(`🔴 รหัสไม่มีตัวเลข ${noDigit.length}:`, noDigit.map((x) => `"${x.code}"@${x.cid}`).join(', '));
    if (unresolved.length) {
      console.log(`🟠 รหัสไม่ตรงพนักงานในระบบ ${unresolved.length} (พิมพ์ผิด? หรือยังไม่สร้างบัญชี?):`);
      for (const u of unresolved) console.log(`   SE${u.digit} ${u.name || ''} @${u.where}`);
    } else console.log('✓ ทุกรหัสตรงพนักงานในระบบ');

    if (APPLY && (dupCodes.length || noDigit.length) && !FORCE) {
      console.log('\n⛔ ไม่ apply: พบรหัสซ้ำ/ผิดในไฟล์เวร — แก้ไฟล์ก่อน หรือใส่ `force` เพื่อข้าม (ไม่แนะนำ)');
      return; // finally จะปิด pool ให้
    }

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
      // เขียนชื่อที่ merge แล้วกลับลงไฟล์ roster (กริดคงตาม xls ใหม่)
      const head = txt.slice(0, eqPos + 1);
      fs.writeFileSync(ROSTER_PATH, head + ' ' + JSON.stringify(roster) + ';\n', 'utf8');
      console.log(`\n✔ APPLIED: DB ${Object.keys(roster).length} ศูนย์ (${YEAR}/${MONTH}) + ${ROSTER_FILE} (ชื่อเต็ม)`);
    } else {
      console.log('\n(dry-run — ยังไม่เขียน รัน `node _update_roster_db.js apply` เพื่อเขียนจริง)');
    }
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
})();
