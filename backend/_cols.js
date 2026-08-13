const { Pool } = require('pg'); require('dotenv').config();
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  const q = await p.query(`SELECT role,
      count(*)::int AS total,
      count(*) FILTER (WHERE coalesce(trim(phone),'') <> '')::int AS with_phone
    FROM public.users WHERE is_active GROUP BY role ORDER BY role`);
  console.table(q.rows);
  await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });
