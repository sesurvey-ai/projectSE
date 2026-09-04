/* eslint-disable no-console */
/**
 * นำเข้าทีมของหัวหน้าผู้ตรวจจากไฟล์ mapping ของ se-billing → staff_groups / staff_group_members (migration 051)
 *
 *   node scripts/import_staff_groups.js <path/to/mapping_supervisor_staff_.json>
 *
 * ไฟล์ = { "นาย ศุภชัย เศรษฐชัยชาญ": ["SEC343 นาย มี วงษ์สุวรรณ", "หจก ศรีราชาเคลม เซอร์วิส", ...], ... }
 * - ทีม: upsert ด้วยชื่อ · ผูก checker_id อัตโนมัติถ้าชื่อ (ตัดคำนำหน้า/ช่องว่าง) ตรงกับบัญชีผู้ตรวจที่มีอยู่
 * - สมาชิก: upsert ด้วย (ทีม, ข้อความ) · รหัสแยกจากข้อความ · surveyor_id จับคู่ด้วย users.code
 * รันซ้ำได้ (ไม่ซ้ำ ไม่ลบของที่แอดมินเพิ่มเองบนเว็บ)
 */
require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/import_staff_groups.js <mapping.json>'); process.exit(2); }
const mapping = JSON.parse(fs.readFileSync(file, 'utf8'));

const codeOf = (s) => { const m = /^\s*(SE[A-Z]*\d+)\b/i.exec(String(s || '')); return m ? m[1].toUpperCase() : null; };
const normPerson = (s) => String(s || '').replace(/^(นาย|นาง|นางสาว|น\.ส\.|คุณ)\s*/u, '').replace(/\s+/g, '').trim();

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await c.connect();
  try {
    const checkers = (await c.query("SELECT id, username, first_name, last_name FROM users WHERE role IN ('checker','admin') AND is_active")).rows;
    const surveyors = new Map((await c.query("SELECT id, UPPER(code) AS code FROM users WHERE role = 'surveyor' AND code IS NOT NULL")).rows.map((r) => [r.code, r.id]));
    let groups = 0, members = 0, linked = 0, matched = 0, unmatched = [];
    for (const [supName, staff] of Object.entries(mapping)) {
      const key = normPerson(supName);
      const checker = checkers.find((u) => normPerson(`${u.first_name} ${u.last_name}`) === key) || null;
      const g = await c.query(
        `INSERT INTO staff_groups (name, checker_id) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET checker_id = COALESCE(staff_groups.checker_id, EXCLUDED.checker_id), updated_at = now()
         RETURNING id`, [supName.replace(/\s+/g, ' ').trim(), checker ? checker.id : null]);
      const gid = g.rows[0].id; groups++; if (checker) linked++;
      for (const raw of staff || []) {
        const name = String(raw).replace(/\s+/g, ' ').trim(); if (!name) continue;
        const code = codeOf(name); const sid = code ? surveyors.get(code) ?? null : null;
        if (code && !sid) unmatched.push(`${supName}: ${name}`);
        const r = await c.query(
          `INSERT INTO staff_group_members (group_id, staff_name, staff_code, surveyor_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (group_id, staff_name) DO UPDATE SET staff_code = EXCLUDED.staff_code, surveyor_id = COALESCE(EXCLUDED.surveyor_id, staff_group_members.surveyor_id)
           RETURNING (xmax = 0) AS inserted`, [gid, name, code, sid]);
        if (r.rows[0].inserted) members++; if (sid) matched++;
      }
      console.log(`ทีม ${supName} → ${checker ? `ผูกบัญชี ${checker.username}` : 'ยังไม่มีบัญชีผู้ตรวจ'} · สมาชิก ${(staff || []).length}`);
    }
    console.log(`\nสรุป: ทีม ${groups} (ผูกบัญชีแล้ว ${linked}) · สมาชิกใหม่ ${members} · จับคู่ทะเบียนช่างได้ ${matched}`);
    if (unmatched.length) console.log(`รหัสที่ไม่มีในทะเบียนพนักงาน ${unmatched.length}:\n  ` + unmatched.join('\n  '));
  } finally { await c.end(); }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
