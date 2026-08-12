import { db } from '../config/database';
import { TH_AMPHURS, TH_PROVINCES, TH_TUMBONS } from '../data/thaiAreaCodes';

/**
 * แก้เรทค่าตอบแทน/เรียกเก็บ ผ่านหน้าเว็บผู้ดูแลระบบ
 *
 * ⚠️ **นี่คือ CRUD ของตารางเรทเท่านั้น ไม่ใช่ตัวคิดเงิน** — สูตรอยู่ใน `pay.service.ts`
 *    และห้ามย้ายมาที่นี่ (มี `pay.replay.test.ts` เฝ้าอยู่)
 *
 * ⚠️ เรทชุดนี้เป็น**สำเนาแยกจาก se-billing** ตามที่ user กำหนด — แก้ที่นี่แล้ว
 *    ระบบเก่า (ISURVEY + extension) **ไม่ตาม** และกลับกันด้วย
 *    ใครแก้ต้องรู้ตัวว่ากำลังแก้เฉพาะฝั่ง se-survey · ใช้ `tools/compare_billing_rates.py` เทียบ
 *
 * ทุกการแก้ลง `billing_rate_changes` — เรทคือเงินของพนักงาน ต้องรู้ว่าใครเปลี่ยนอะไร
 */

/** ช่องที่แก้ได้จริง — กันไม่ให้ชื่อคอลัมน์หลุดจาก body เข้าไปใน SQL */
const AMPHUR_NUM = ['sur_invest', 'ins_invest_12', 'ins_invest_34', 'ins_trans', 'ins_photo_12'] as const;
const AMPHUR_JSON = ['sur_invest_by_team', 'ins_trans_by_team'] as const;
const TUMBON_NUM = ['ins_invest_12', 'ins_invest_34', 'ins_trans', 'ins_photo_12'] as const;
const TUMBON_JSON = AMPHUR_JSON;

export const FIELD_LABELS: Record<string, string> = {
  sur_invest: 'จ่ายพนักงาน',
  sur_invest_by_team: 'จ่ายพนักงาน (รายทีม)',
  ins_invest_12: 'เรียกเก็บ เคลมสด/แห้ง',
  ins_invest_34: 'เรียกเก็บ ติดตาม/อื่นๆ',
  ins_trans: 'ค่าเดินทาง (เรียกเก็บ)',
  ins_trans_by_team: 'ค่าเดินทาง (รายทีม)',
  ins_photo_12: 'ค่ารูป (เรียกเก็บ)',
  enabled: 'เปิดใช้งาน',
  team: 'ทีม',
  label: 'ชื่อตำบล',
  parent_amphur: 'อำเภอแม่',
  value: 'ค่า',
};

const provinceOf = (amphurId: string) => amphurId.slice(0, 2);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * เรทรายทีมเก็บเป็น {"ชื่อทีม": เรท} — หน้าเว็บส่งมาเป็นออบเจ็กต์เดียวกัน
 * ทีมที่ปล่อยยอดว่างไว้ = ตั้งใจลบทิ้ง ไม่ใช่ยอด 0 (0 กับ "ไม่มีเรทรายทีม" ให้ผลต่างกัน)
 */
function cleanTeamMap(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const team = String(k).trim();
    const n = num(raw);
    if (team && n !== null) out[team] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** เทียบค่าเก่า/ใหม่แบบข้อความ — JSONB ที่คีย์สลับตำแหน่งต้องไม่นับว่าเปลี่ยน */
function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
  }
  return String(v);
}

interface ChangeRow { field: string; old: unknown; next: unknown }

async function logChanges(
  scope: string, refId: string, label: string | null, rows: ChangeRow[], userId?: number,
) {
  const real = rows.filter((r) => asText(r.old) !== asText(r.next));
  if (!real.length) return 0;
  const values: unknown[] = [];
  const tuples = real.map((r) => {
    values.push(scope, refId, label, r.field, asText(r.old), asText(r.next), userId ?? null);
    const i = values.length;
    return `($${i - 6},$${i - 5},$${i - 4},$${i - 3},$${i - 2},$${i - 1},$${i})`;
  });
  await db.query(
    `INSERT INTO billing_rate_changes (scope, ref_id, label, field, old_value, new_value, changed_by)
     VALUES ${tuples.join(',')}`, values);
  return real.length;
}

// ────────────────── อ่าน ──────────────────

export interface AmphurRateRow {
  amphur_id: string;
  amphur_name: string;
  province_id: string;
  province_name: string;
  has_rate: boolean;
  [k: string]: unknown;
}

/**
 * เรทรายอำเภอ
 *
 * ส่งอำเภอที่**ยังไม่มีเรท**มาด้วย (has_rate=false) เมื่อผู้ใช้เจาะจงว่าอยากดูที่ไหน —
 * เลือกจังหวัด หรือพิมพ์ค้นหา · เปิดพื้นที่ให้บริการใหม่แล้วต้องมาเพิ่มแถวเองผ่าน SQL
 * คือสิ่งที่หน้านี้ตั้งใจกำจัด และการค้นหาแล้ว "ไม่เจอ" ทั้งที่อำเภอนั้นมีอยู่จริงคือทางตัน
 *
 * เปิดหน้ามาเฉย ๆ (ไม่เลือกไม่ค้น) = เฉพาะอำเภอที่มีเรทแล้ว ไม่งั้นได้ 1,004 แถวรวด
 */
export async function listAmphurRates(opts: { province?: string; q?: string } = {}) {
  const saved = new Map<string, Record<string, unknown>>();
  for (const r of (await db.query('SELECT * FROM billing_amphur_rates')).rows as Record<string, unknown>[]) {
    saved.set(String(r.amphur_id), r);
  }

  const q = (opts.q || '').trim();
  const out: AmphurRateRow[] = [];
  for (const [code, name] of Object.entries(TH_AMPHURS)) {
    const pid = provinceOf(code);
    if (opts.province && pid !== opts.province) continue;
    if (q && !name.includes(q) && !code.startsWith(q)) continue;
    const row = saved.get(code);
    if (!opts.province && !q && !row) continue;
    out.push({
      ...(row ?? {}),
      amphur_id: code,
      amphur_name: name,
      province_id: pid,
      province_name: TH_PROVINCES[pid] ?? pid,
      has_rate: Boolean(row),
    });
  }
  out.sort((a, b) => a.amphur_id.localeCompare(b.amphur_id));
  return out;
}

export async function listProvinceRates() {
  const r = await db.query('SELECT * FROM billing_province_rates ORDER BY province_id');
  return (r.rows as Record<string, unknown>[]).map((x) => ({
    ...x, province_name: TH_PROVINCES[String(x.province_id)] ?? String(x.province_id),
  }));
}

export async function listTumbonRates() {
  const r = await db.query('SELECT * FROM billing_tumbon_rates ORDER BY tumbon_id');
  return (r.rows as Record<string, unknown>[]).map((x) => ({
    ...x,
    tumbon_name: TH_TUMBONS[String(x.tumbon_id)] ?? String(x.label ?? ''),
    parent_name: TH_AMPHURS[String(x.parent_amphur)] ?? String(x.parent_amphur),
  }));
}

/**
 * รหัสผู้สำรวจ → ทีม
 *
 * แนบ `in_use` มาด้วยว่ารหัสนั้นมีคนใช้อยู่จริงไหม — ตารางนี้มี 13 รหัสจากผู้สำรวจ 140+ คน
 * (ช่องโหว่ที่ติดมาจากระบบเดิม) คนที่ไม่มีในนี้จะไม่ได้เรทรายทีม หน้าเว็บต้องเตือนให้เห็น
 */
export async function listTeams() {
  const r = await db.query(
    `SELECT t.*, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name
       FROM billing_surveyor_teams t
       LEFT JOIN users u ON UPPER(u.code) = t.sec_code
      ORDER BY t.sec_code`);
  return r.rows;
}

/**
 * ผู้สำรวจที่ยังไม่มีทีม — ต้นเหตุ "คิดเรทรายทีมไม่ได้" ที่หาสาเหตุยากถ้าไม่บอก
 *
 * เฉพาะรหัส **SEC** เท่านั้น: `teamOfSurveyor()` จับด้วย /\bSEC\d+\b/ ดังนั้นรหัส SE (กทม.)
 * จะไม่มีวันแม็ปทีมได้อยู่แล้ว — และก็ไม่ต้อง เพราะอำเภอในกรุงเทพฯ ใช้เรทกลางเท่ากันหมด
 * เอา SE มารวมด้วยจะได้ตัวเลขเตือน 129 คนที่ไม่มีอะไรให้ทำ = คนอ่านเลิกสนใจคำเตือนไปเลย
 */
export async function listSurveyorsWithoutTeam() {
  const r = await db.query(
    `SELECT u.code, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS name
       FROM users u
      WHERE u.role = 'surveyor' AND u.is_active = TRUE
        AND u.code ILIKE 'SEC%'
        AND NOT EXISTS (SELECT 1 FROM billing_surveyor_teams t WHERE t.sec_code = UPPER(u.code))
      ORDER BY u.code`);
  return r.rows;
}

export async function listSettings() {
  const r = await db.query('SELECT * FROM billing_settings ORDER BY key');
  return r.rows;
}

export async function listChanges(limit = 100) {
  const r = await db.query(
    `SELECT c.*, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS changed_by_name
       FROM billing_rate_changes c
       LEFT JOIN users u ON u.id = c.changed_by
      ORDER BY c.changed_at DESC, c.id DESC
      LIMIT $1`, [Math.min(Math.max(limit, 1), 500)]);
  return r.rows;
}

// ────────────────── แก้ ──────────────────

export async function saveAmphurRate(
  amphurId: string, patch: Record<string, unknown>, userId?: number,
) {
  const name = TH_AMPHURS[amphurId];
  if (!name) throw Object.assign(new Error('ไม่พบรหัสอำเภอนี้'), { statusCode: 400 });

  const old = (await db.query(
    'SELECT * FROM billing_amphur_rates WHERE amphur_id = $1', [amphurId])).rows[0] ?? {};

  const next: Record<string, unknown> = {};
  for (const f of AMPHUR_NUM) if (f in patch) next[f] = num(patch[f]);
  for (const f of AMPHUR_JSON) if (f in patch) next[f] = cleanTeamMap(patch[f]);
  if (!Object.keys(next).length) return old;

  const cols = Object.keys(next);
  const vals = cols.map((c) => (AMPHUR_JSON.includes(c as never)
    ? (next[c] === null ? null : JSON.stringify(next[c]))
    : next[c]));
  const r = await db.query(
    `INSERT INTO billing_amphur_rates (amphur_id, ${cols.join(', ')}, updated_at)
     VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}, NOW())
     ON CONFLICT (amphur_id) DO UPDATE SET
       ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()
     RETURNING *`, [amphurId, ...vals]);

  await logChanges('amphur', amphurId, `${name} (${TH_PROVINCES[provinceOf(amphurId)] ?? ''})`,
    cols.map((f) => ({ field: f, old: (old as Record<string, unknown>)[f], next: next[f] })), userId);
  return r.rows[0];
}

export async function saveProvinceRate(
  provinceId: string, patch: Record<string, unknown>, userId?: number,
) {
  const name = TH_PROVINCES[provinceId];
  if (!name) throw Object.assign(new Error('ไม่พบรหัสจังหวัดนี้'), { statusCode: 400 });

  const old = (await db.query(
    'SELECT * FROM billing_province_rates WHERE province_id = $1', [provinceId])).rows[0] ?? {};

  // sur_invest เป็น NOT NULL ในตาราง — ว่างแปลว่า "ไม่มีเรทระดับจังหวัด" ซึ่งที่นี่คือ 0
  const sur = 'sur_invest' in patch ? (num(patch.sur_invest) ?? 0) : (old.sur_invest ?? 0);
  const enabled = 'enabled' in patch ? Boolean(patch.enabled) : (old.enabled ?? true);

  const r = await db.query(
    `INSERT INTO billing_province_rates (province_id, sur_invest, enabled, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (province_id) DO UPDATE SET
       sur_invest = EXCLUDED.sur_invest, enabled = EXCLUDED.enabled, updated_at = NOW()
     RETURNING *`, [provinceId, sur, enabled]);

  await logChanges('province', provinceId, name, [
    { field: 'sur_invest', old: old.sur_invest, next: sur },
    { field: 'enabled', old: old.enabled, next: enabled },
  ], userId);
  return r.rows[0];
}

export async function saveTumbonRate(
  tumbonId: string, patch: Record<string, unknown>, userId?: number,
) {
  const old = (await db.query(
    'SELECT * FROM billing_tumbon_rates WHERE tumbon_id = $1', [tumbonId])).rows[0];
  if (!old) throw Object.assign(new Error('ไม่พบตำบลพิเศษนี้'), { statusCode: 404 });

  const next: Record<string, unknown> = {};
  for (const f of TUMBON_NUM) if (f in patch) next[f] = num(patch[f]);
  for (const f of TUMBON_JSON) if (f in patch) next[f] = cleanTeamMap(patch[f]);
  if (!Object.keys(next).length) return old;

  const cols = Object.keys(next);
  const vals = cols.map((c) => (TUMBON_JSON.includes(c as never)
    ? (next[c] === null ? null : JSON.stringify(next[c]))
    : next[c]));
  const r = await db.query(
    `UPDATE billing_tumbon_rates
        SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW()
      WHERE tumbon_id = $1 RETURNING *`, [tumbonId, ...vals]);

  await logChanges('tumbon', tumbonId, String(old.label ?? tumbonId),
    cols.map((f) => ({ field: f, old: old[f], next: next[f] })), userId);
  return r.rows[0];
}

export async function saveTeam(secCode: string, team: string, userId?: number) {
  const code = String(secCode || '').trim().toUpperCase();
  if (!/^SEC\d+$/.test(code)) {
    throw Object.assign(new Error('รหัสผู้สำรวจต้องอยู่ในรูป SEC ตามด้วยตัวเลข'), { statusCode: 400 });
  }
  const name = String(team || '').trim();
  if (!name) throw Object.assign(new Error('ต้องระบุชื่อทีม'), { statusCode: 400 });

  const old = (await db.query(
    'SELECT team FROM billing_surveyor_teams WHERE sec_code = $1', [code])).rows[0];
  const r = await db.query(
    `INSERT INTO billing_surveyor_teams (sec_code, team) VALUES ($1, $2)
     ON CONFLICT (sec_code) DO UPDATE SET team = EXCLUDED.team RETURNING *`, [code, name]);

  await logChanges('team', code, code, [{ field: 'team', old: old?.team, next: name }], userId);
  return r.rows[0];
}

export async function deleteTeam(secCode: string, userId?: number) {
  const code = String(secCode || '').trim().toUpperCase();
  const r = await db.query(
    'DELETE FROM billing_surveyor_teams WHERE sec_code = $1 RETURNING team', [code]);
  if (!r.rows.length) throw Object.assign(new Error('ไม่พบรหัสนี้'), { statusCode: 404 });
  await logChanges('team', code, code, [{ field: 'team', old: r.rows[0].team, next: null }], userId);
  return { sec_code: code };
}

/**
 * ค่าคงที่เรื่องเงิน — value เป็น JSONB เพราะแต่ละคีย์โครงไม่เหมือนกัน
 * หน้าเว็บส่ง JSON ที่แปลงแล้วมา · ห้ามเพิ่มคีย์ใหม่จากหน้าเว็บ (ต้องมีโค้ดรองรับก่อน)
 */
export async function saveSetting(key: string, value: unknown, userId?: number) {
  const old = (await db.query(
    'SELECT value FROM billing_settings WHERE key = $1', [key])).rows[0];
  if (!old) throw Object.assign(new Error('ไม่พบคีย์ตั้งค่านี้'), { statusCode: 404 });
  if (value === null || typeof value !== 'object') {
    throw Object.assign(new Error('ค่าต้องเป็น JSON object'), { statusCode: 400 });
  }
  const r = await db.query(
    `UPDATE billing_settings SET value = $2::jsonb, updated_at = NOW()
      WHERE key = $1 RETURNING *`, [key, JSON.stringify(value)]);
  await logChanges('setting', key, key,
    [{ field: 'value', old: old.value, next: value }], userId);
  return r.rows[0];
}

/** จังหวัดทั้งหมด — หน้าเว็บใช้ทำตัวกรอง */
export const provinceOptions = () =>
  Object.entries(TH_PROVINCES).map(([id, name]) => ({ id, name }));
