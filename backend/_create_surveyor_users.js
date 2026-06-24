// TEMP: สร้าง/อัปเดตบัญชีพนักงานสำรวจจากตารางเวร (roster-jun.ts)
//   รูปแบบตามที่ user กำหนด: username = se<เลข> (ตัวเล็ก), password = <เลข>, code = SE<เลข>
//   - คนที่มีบัญชีอยู่แล้ว (เทียบเลขรหัสจาก code/username) → UPDATE ให้เข้าฟอร์แมต + ใส่ชื่อจริง
//   - คนที่ยังไม่มี → INSERT (role surveyor)
//   node _create_surveyor_users.js          → dry-run
//   node _create_surveyor_users.js apply    → เขียนจริง
const fs = require('fs');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const APPLY = process.argv[2] === 'apply';
const onlyDigits = (s) => (s || '').replace(/\D/g, '');
// ชื่อจากตาราง: ตัดวงเล็บกำกับ เช่น "วัลลภ (เมืองปทุม)" → "วัลลภ"
const cleanName = (s) => (s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  try {
    const txt = fs.readFileSync('C:\\Users\\i9\\Desktop\\se-survey\\web\\src\\app\\duty-demo2\\roster-jun.ts', 'utf8');
    const roster = JSON.parse(txt.slice(txt.indexOf('=', txt.indexOf('ROSTER_JUN')) + 1, txt.lastIndexOf(';')).trim());

    // รวมคนทุกศูนย์ ไม่ซ้ำเลขรหัส (SE436 อยู่ 2 จุด → บัญชีเดียว)
    const people = new Map(); // digits -> {name, center}
    for (const cid of Object.keys(roster))
      for (const p of roster[cid].people) {
        const d = onlyDigits(p.code);
        if (d && !people.has(d)) people.set(d, { name: cleanName(p.name), center: cid });
      }

    // บัญชี surveyor เดิม: digits -> row
    const u = await pool.query(`SELECT id, username, code FROM users WHERE role = 'surveyor'`);
    const byDigits = new Map();
    u.rows.forEach((r) => { const d = onlyDigits(r.code || r.username); if (d) byDigits.set(d, r); });

    let ins = 0, upd = 0;
    for (const [d, p] of [...people.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const username = `se${d}`, password = d, code = `SE${d}`;
      const parts = p.name.split(' ');
      const first = parts[0] || code, last = parts.slice(1).join(' ');
      const ex = byDigits.get(d);
      if (ex) {
        console.log(`UPDATE id=${ex.id} ${ex.username} → ${username}/${password} · ${first} ${last}`);
        upd++;
        if (APPLY) {
          const hash = await bcrypt.hash(password, 10);
          await pool.query(
            `UPDATE users SET username=$1, password_hash=$2, first_name=$3, last_name=$4, code=$5, is_active=true WHERE id=$6`,
            [username, hash, first, last, code, ex.id]);
        }
      } else {
        console.log(`INSERT ${username}/${password} · ${first} ${last} (${p.center})`);
        ins++;
        if (APPLY) {
          const hash = await bcrypt.hash(password, 10);
          await pool.query(
            `INSERT INTO users (username, password_hash, first_name, last_name, role, code)
             VALUES ($1, $2, $3, $4, 'surveyor', $5)`,
            [username, hash, first, last, code]);
        }
      }
    }
    console.log(`\nรวม: insert ${ins} · update ${upd} · ทั้งหมด ${people.size} คน`);
    if (APPLY) {
      const c = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE role='surveyor'`);
      console.log(`✔ APPLIED — surveyor ใน DB ตอนนี้ ${c.rows[0].n} บัญชี (รวม survey01/02)`);
    } else {
      console.log('(dry-run — รัน `node _create_surveyor_users.js apply` เพื่อเขียนจริง)');
    }
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
})();
