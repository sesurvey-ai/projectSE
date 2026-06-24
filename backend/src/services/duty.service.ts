import { db } from '../config/database';

export const dutyService = {
  // ── ตารางเวรราย เดือน/ศูนย์ (กริด JSONB จากหน้า duty-demo2) ──────────
  // โหลดทุกศูนย์ของเดือนหนึ่งทีเดียว → { centerId: data } (ศูนย์ที่ยังไม่เคยเซฟจะไม่มี key)
  // เดือนที่ยังไม่มีข้อมูลเลย → หมุนเวรต่อจากเดือนก่อนหน้าแล้วบันทึกให้อัตโนมัติ (updated_by = NULL = ระบบ)
  getSchedules: async (year: number, month: number) => {
    const fetchRows = async () =>
      (await db.query(
        'SELECT center_id, data FROM duty_schedules WHERE year = $1 AND month = $2',
        [year, month]
      )).rows;
    let rows = await fetchRows();
    if (rows.length === 0 && (await autoRollMonth(year, month))) rows = await fetchRows();
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.center_id] = r.data;
    return out;
  },

  // บันทึก/ทับ กริดของ 1 ศูนย์ ต่อ 1 เดือน (upsert ด้วย unique center_id+year+month)
  saveSchedule: async (centerId: string, year: number, month: number, data: unknown, userId: number) =>
    (await db.query(
      `INSERT INTO duty_schedules (center_id, year, month, data, updated_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (center_id, year, month)
       DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING center_id, year, month,
                 to_char(updated_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') AS updated_at`,
      [centerId, year, month, JSON.stringify(data), userId]
    )).rows[0],
};

// ── หมุนเวรอัตโนมัติข้ามเดือน (เรียกจาก getSchedules เมื่อเดือนนั้นยังว่าง) ──
// วงรอบมาตรฐาน 6 วัน: เช้า เช้า บ่าย บ่าย ดึก หยุด — จับเฟสของแต่ละคนจาก 12 วันท้ายเดือนก่อน แล้ววนต่อ
// คนนอกวงรอบ (FIX/รูปแบบเฉพาะ) ทำซ้ำรายสัปดาห์ตามวันในสัปดาห์เดิม · เดินหาเดือนฐานย้อนได้ไม่เกิน 3 เดือน
type ZoneGrid = { staff: { id: string; code: string; name: string }[]; schedule: Record<string, Record<number, string>> };
const ROLL_CYCLE = ['s1', 's1', 's2', 's2', 's3', 'off'];
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();

function rollZone(prev: ZoneGrid, py: number, pm: number, y: number, m: number): ZoneGrid {
  const prevDays = daysIn(py, pm);
  const nDays = daysIn(y, m);
  const schedule: Record<string, Record<number, string>> = {};
  for (const s of prev.staff ?? []) {
    const pv = (prev.schedule ?? {})[s.id] ?? {};
    const out: Record<number, string> = {};
    let total = 0;
    for (let d = Math.max(1, prevDays - 11); d <= prevDays; d++) {
      const v = pv[d];
      if (v && v !== 'none') total++;
    }
    let bestR = -1, bestRatio = 0;
    for (let r = 0; r < 6; r++) {
      let hit = 0;
      for (let d = Math.max(1, prevDays - 11); d <= prevDays; d++) {
        const v = pv[d];
        if (!v || v === 'none') continue;
        if (ROLL_CYCLE[(r + d) % 6] === v) hit++;
      }
      if (total > 0 && hit / total > bestRatio) { bestRatio = hit / total; bestR = r; }
    }
    const inCycle = bestR >= 0 && bestRatio >= 0.75 && total >= 6
      && pv[prevDays] === ROLL_CYCLE[(bestR + prevDays) % 6];
    for (let d = 1; d <= nDays; d++) {
      if (inCycle) { out[d] = ROLL_CYCLE[(bestR + prevDays + d) % 6]; continue; }
      const dow = new Date(y, m - 1, d).getDay();
      let v = 'none';
      for (let pd = prevDays; pd >= 1; pd--) {
        if (new Date(py, pm - 1, pd).getDay() === dow) { v = pv[pd] ?? 'none'; break; }
      }
      out[d] = v;
    }
    schedule[s.id] = out;
  }
  return { staff: (prev.staff ?? []).map((s) => ({ ...s })), schedule };
}

// สร้างตารางเดือน (y,m) จากเดือนก่อนหน้า — คืน true เมื่อมีการสร้าง; ไม่ทับศูนย์ที่มีอยู่แล้ว (ON CONFLICT DO NOTHING)
async function autoRollMonth(y: number, m: number, depth = 0): Promise<boolean> {
  if (depth >= 3) return false; // กันไล่สร้างย้อนหลังลึกเกิน (ใช้งานจริงเลื่อนทีละเดือน)
  const p = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const sel = 'SELECT center_id, data FROM duty_schedules WHERE year = $1 AND month = $2';
  let prevRows = (await db.query(sel, [p.y, p.m])).rows;
  if (prevRows.length === 0) {
    if (!(await autoRollMonth(p.y, p.m, depth + 1))) return false;
    prevRows = (await db.query(sel, [p.y, p.m])).rows;
  }
  for (const r of prevRows) {
    const gen = rollZone(r.data as ZoneGrid, p.y, p.m, y, m);
    if (!gen.staff.length) continue;
    await db.query(
      `INSERT INTO duty_schedules (center_id, year, month, data, updated_by)
       VALUES ($1,$2,$3,$4::jsonb,NULL)
       ON CONFLICT (center_id, year, month) DO NOTHING`,
      [r.center_id, y, m, JSON.stringify(gen)]
    );
  }
  return prevRows.length > 0;
}
