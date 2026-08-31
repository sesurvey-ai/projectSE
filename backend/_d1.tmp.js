require('dotenv').config();
const jwt = require('jsonwebtoken');
const API = 'https://api.sesurvey.cloud';
const tok = (id, u, r) => jwt.sign({ id, username: u, role: r }, process.env.JWT_SECRET, { expiresIn: '30m' });
const call = async (m, p, t, b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined });
  const x = await r.text(); let j; try { j = JSON.parse(x); } catch { j = x; }
  return { status: r.status, body: j };
};
(async () => {
  const cc = tok(3, 'callcenter01', 'callcenter');
  const c = await call('POST', '/api/cases', cc, {
    customer_name: 'ทดสอบ หน้าจอใหม่',
    insurance_company: 'ไอโออิกรุงเทพประกันภัย',
    incident_location: 'ถนนศรีนครินทร์ แขวงหนองบอน เขตประเวศ กรุงเทพมหานคร',
    claim_no: '2026013177777',
  });
  const id = c.body?.data?.id;
  const a = await call('POST', `/api/cases/${id}/assign`, cc, { surveyor_id: 8, claim_type: 'F' });
  console.log('เคส', id, '· มอบหมาย', a.status, JSON.stringify(a.body?.data?.push));
  console.log('CASE_ID=' + id);
})();
