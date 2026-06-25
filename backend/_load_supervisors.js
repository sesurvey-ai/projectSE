// โหลดเบอร์หัวหน้า (call-consult whitelist) จาก ../_supervisors.json → consult_supervisors(+numbers)
// ใช้คู่กับ _sup_to_json.py (อ่าน เบอร์หัวหน้า.xlsx). idempotent: match by name, replace เบอร์ทั้งชุด.
//   dry-run:  node backend/_load_supervisors.js
//   apply:    node backend/_load_supervisors.js --apply
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // โหลด backend/.env เสมอ (ไม่ขึ้นกับ cwd)
const fs = require('fs');
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ตรงกับ backend/src/utils/phone.ts (ต้อง normalize เหมือนกัน ไม่งั้น match ไม่เจอ)
function normalizePhone(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  const hasPlus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0066')) d = d.slice(4);
  if (hasPlus && d.startsWith('66')) d = d.slice(2);
  else if (!hasPlus && d.startsWith('66') && d.length === 11) d = d.slice(2);
  if ((d.length === 8 || d.length === 9) && !d.startsWith('0')) d = '0' + d;
  return d;
}

(async () => {
  const jsonPath = path.join(__dirname, '..', '_supervisors.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // normalize + validate + dedupe
  const sups = raw.map((s) => ({
    name: String(s.name).trim(),
    numbers: (s.numbers || [])
      .map((n) => ({ number: normalizePhone(n.number), label: n.label || null }))
      .filter((n) => n.number.length >= 9),
  }));

  const seen = new Map();
  let totalNums = 0;
  for (const s of sups) {
    for (const n of s.numbers) {
      totalNums++;
      if (seen.has(n.number)) console.log(`⚠️ เบอร์ซ้ำข้ามคน ${n.number}: ${s.name} & ${seen.get(n.number)}`);
      else seen.set(n.number, s.name);
    }
  }
  console.log(`พบหัวหน้า ${sups.length} คน · เบอร์ ${totalNums} (unique ${seen.size})`);
  sups.forEach((s) => console.log(`  ${s.name}: ${s.numbers.map((n) => `${n.number}(${n.label})`).join(', ') || '— ไม่มีเบอร์'}`));

  if (!APPLY) {
    console.log('\n[DRY-RUN] ตรวจแล้วถูกต้อง? รันซ้ำด้วย --apply เพื่อเขียนจริง');
    await pool.end();
    return;
  }

  // ใช้ pool.query ทีละคำสั่ง (Supavisor pooler ไม่รองรับ held client/transaction ผ่าน connect())
  // idempotent: match by name → replace เบอร์ทั้งชุด ดังนั้นรันซ้ำได้ปลอดภัยแม้ไม่มี transaction
  for (const s of sups) {
    const ex = await pool.query('SELECT id FROM consult_supervisors WHERE name=$1', [s.name]);
    let id;
    if (ex.rows.length) {
      id = ex.rows[0].id;
      await pool.query('UPDATE consult_supervisors SET is_active=true WHERE id=$1', [id]);
    } else {
      id = (await pool.query('INSERT INTO consult_supervisors (name) VALUES ($1) RETURNING id', [s.name])).rows[0].id;
    }
    await pool.query('DELETE FROM consult_supervisor_numbers WHERE supervisor_id=$1', [id]);
    for (const n of s.numbers) {
      await pool.query(
        `INSERT INTO consult_supervisor_numbers (supervisor_id, number, label) VALUES ($1,$2,$3)
         ON CONFLICT (number) DO UPDATE SET supervisor_id=EXCLUDED.supervisor_id, label=EXCLUDED.label`,
        [id, n.number, n.label]
      );
    }
  }
  console.log('\n✔ applied');

  const v = await pool.query(
    `SELECT s.id, s.name, array_agg(n.number ORDER BY n.id) AS nums
       FROM consult_supervisors s LEFT JOIN consult_supervisor_numbers n ON n.supervisor_id=s.id
      WHERE s.is_active=true GROUP BY s.id, s.name ORDER BY s.id`
  );
  console.log('\n=== ใน DB ตอนนี้ ===');
  v.rows.forEach((r) => console.log(`  #${r.id} ${r.name}: ${(r.nums || []).filter(Boolean).join(', ')}`));
  await pool.end();
})().catch((e) => { console.error('ERR:', e && e.stack ? e.stack : e); process.exit(1); });
