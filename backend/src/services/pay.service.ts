import { db } from '../config/database';

/**
 * คิดค่าตอบแทนผู้สำรวจ (ฝั่งจ่ายพนักงาน) — พอร์ตจาก se-billing `content.js`
 *
 * ⚠️ **โค้ดคิดเงิน** — แก้แล้วต้องรัน `pay.replay.test.ts` ให้ผ่านทุกแถวก่อนเสมอ
 * เทสนั้นเล่นซ้ำ capture จริง 32 แถวจากระบบเดิม ถ้าผลต่างแม้บาทเดียวคือพอร์ตพลาด
 *
 * กติกาที่ยืนยันจาก capture จริงแล้ว:
 *   sur_invest = เรทฐาน + นอกพื้นที่ + นอกเวลา − หักเงิน
 *   ins_invest = mtype 1,2 → ins_invest_12 · mtype 3,4 → ins_invest_34
 *   ins_photo  = คิดเฉพาะ mtype 1,2 (3,4 ไม่มีค่ารูป)
 *
 * ⚠️ ยอด "นอกพื้นที่/นอกเวลา" **แก้เป็นตัวเลขอื่นได้** ไม่ใช่ค่าคงที่จาก settings เสมอ
 *    (capture id 18 ใส่ 80 แทน default 50) — ค่าใน settings เป็นแค่ค่าตั้งต้นให้ผู้ตรวจ
 */

export type MType = '1' | '2' | '3' | '4';

export interface PayInput {
  provinceId?: string | null;
  amphurId?: string | null;
  /** ตำบล — มีผลเฉพาะ 2 ตำบลที่จ่ายไม่เท่าอำเภอแม่ (บ่อวิน · พลูตาหลวง) */
  tumbonId?: string | null;
  mtypeId?: MType | string | null;
  /** ทีมของผู้สำรวจ (มาจากรหัส SEC) — บางอำเภอจ่ายไม่เท่ากันตามทีม */
  team?: string | null;
  /** false = OSS/outsource → ไม่คิดค่าตอบแทนให้ ปล่อยผู้ตรวจกรอกเอง */
  isSE?: boolean;
  outOfArea?: number | null;
  outOfHours?: number | null;
  /** หักเงิน (ส่งค่าบวก ระบบลบให้เอง) */
  deduct?: number | null;
}

export interface PayResult {
  surInvest: number | null;
  insInvest: number | null;
  insTrans: number | null;
  insPhoto: number | null;
  /** เก็บลง survey_pay.rate_snapshot — ตารางเรทไม่มีประวัติ ตัวนี้คือหลักฐานเดียว */
  snapshot: Record<string, unknown>;
}

export interface RateRow {
  sur_invest?: number | null;
  ins_invest_12?: number | null;
  ins_invest_34?: number | null;
  ins_trans?: number | null;
  ins_photo_12?: number | null;
  sur_invest_by_team?: Record<string, number> | null;
  ins_trans_by_team?: Record<string, number> | null;
}

/** เรทที่หามาแล้ว — แยกจากการ query เพื่อให้ทดสอบส่วนคำนวณได้โดยไม่ต้องต่อฐานข้อมูล */
export interface ResolvedRates {
  amphur?: RateRow | null;
  tumbon?: RateRow | null;
  province?: { sur_invest: number } | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** เรทรายทีมเก็บเป็น JSON {"ชื่อทีม": เรท} — ไม่มีทีม/ทีมไม่อยู่ในนั้น = ใช้ค่า flat แทน */
const byTeam = (map: Record<string, number> | null, team?: string | null): number | null => {
  if (!map || !team) return null;
  return num(map[team]);
};

/** รหัสผู้สำรวจ → ทีม · รับได้ทั้ง "SEC125" และ "SEC125 นายสมภพ ปั้นเปรื่อง" */
export async function teamOfSurveyor(codeOrName: string): Promise<string | null> {
  const m = /\b(SEC\d+)\b/i.exec(codeOrName || '');
  if (!m) return null;
  const r = await db.query(
    'SELECT team FROM billing_surveyor_teams WHERE sec_code = $1', [m[1].toUpperCase()]);
  return (r.rows[0] as { team?: string } | undefined)?.team ?? null;
}

/**
 * คิดยอด — ลำดับการหาเรท: ตำบลพิเศษ → อำเภอ → จังหวัด
 *
 * ตำบลพิเศษไม่มีคอลัมน์ `sur_invest` แบบ flat มีแต่รายทีม — ถ้าทีมไม่ตรงจะตกไปใช้ของอำเภอแม่
 */
export async function calcPay(input: PayInput): Promise<PayResult> {
  return computePay(await loadRates(input), input);
}

/** ดึงเรทที่เกี่ยวข้องกับงานนี้จากฐานข้อมูล */
export async function loadRates(input: PayInput): Promise<ResolvedRates> {
  const [amphur, tumbon, province] = await Promise.all([
    input.amphurId
      ? db.query('SELECT * FROM billing_amphur_rates WHERE amphur_id = $1', [input.amphurId])
      : null,
    input.tumbonId
      ? db.query('SELECT * FROM billing_tumbon_rates WHERE tumbon_id = $1', [input.tumbonId])
      : null,
    input.provinceId
      ? db.query(
          'SELECT sur_invest FROM billing_province_rates WHERE province_id = $1', [input.provinceId])
      : null,
  ]);
  return {
    amphur: (amphur?.rows[0] as RateRow | undefined) ?? null,
    tumbon: (tumbon?.rows[0] as RateRow | undefined) ?? null,
    province: (province?.rows[0] as { sur_invest: number } | undefined) ?? null,
  };
}

/**
 * ส่วนคำนวณล้วน ไม่แตะฐานข้อมูล — `pay.replay.test.ts` เรียกตัวนี้โดยตรง
 * จึงเล่นซ้ำ capture เก่า 32 แถวได้โดยไม่ต้องต่อ production
 */
export function computePay(rates: ResolvedRates, input: PayInput): PayResult {
  const mtype = String(input.mtypeId ?? '');
  const is12 = mtype === '1' || mtype === '2';
  const team = input.team ?? null;
  const { amphur, tumbon, province } = rates;

  // เรทฐานฝั่งพนักงาน — ไล่จากเจาะจงที่สุดไปกว้างที่สุด
  const base =
    byTeam(tumbon?.sur_invest_by_team ?? null, team) ??
    byTeam(amphur?.sur_invest_by_team ?? null, team) ??
    num(amphur?.sur_invest) ??
    num(province?.sur_invest);

  // ฝั่งเรียกเก็บประกัน — ตำบลพิเศษทับของอำเภอแม่ได้ทุกช่อง
  const src = tumbon ?? amphur;
  const insInvest = is12 ? num(src?.ins_invest_12) : num(src?.ins_invest_34);
  const insTrans = byTeam(src?.ins_trans_by_team ?? null, team) ?? num(src?.ins_trans);
  const insPhoto = is12 ? num(src?.ins_photo_12) : null;

  const outArea = num(input.outOfArea) ?? 0;
  const outHours = num(input.outOfHours) ?? 0;
  const deduct = num(input.deduct) ?? 0;

  // OSS/outsource คิดเรทคนละกติกา ระบบไม่รู้ → ไม่เดา ปล่อยผู้ตรวจกรอกเอง
  const surInvest =
    input.isSE === false || base === null ? null : base + outArea + outHours - deduct;

  return {
    surInvest,
    insInvest,
    insTrans,
    insPhoto,
    snapshot: {
      amphur_id: input.amphurId ?? null,
      tumbon_id: input.tumbonId ?? null,
      province_id: input.provinceId ?? null,
      mtype_id: mtype || null,
      team,
      is_se: input.isSE !== false,
      base_rate: base,
      out_of_area: outArea || null,
      out_of_hours: outHours || null,
      deduct: deduct || null,
      // ที่มาของเรทฐาน — ไว้อธิบายตอนถูกถามว่าทำไมได้ยอดนี้
      rate_from: byTeam(tumbon?.sur_invest_by_team ?? null, team) !== null ? 'tumbon_by_team'
        : byTeam(amphur?.sur_invest_by_team ?? null, team) !== null ? 'amphur_by_team'
        : num(amphur?.sur_invest) !== null ? 'amphur_flat'
        : num(province?.sur_invest) !== null ? 'province' : 'ไม่พบเรท',
    },
  };
}

// ────────────────── ผูกกับเคสจริง ──────────────────

import { amphurCode, provinceCode } from './areaCode.service';

/** ช่องเงินฝั่งพนักงานที่ผู้ตรวจกรอกได้ — ชื่อคีย์ตรงกับคอลัมน์ใน survey_pay */
export const PAY_MONEY_FIELDS = [
  'service_fee', 'travel_fee', 'photo_fee', 'phone_fee',
  'bail_fee', 'claim_fee', 'daily_fee', 'other_fee',
] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ยอดที่ระบบแนะนำสำหรับเคสนี้ + ยอดที่บันทึกไว้แล้ว
 *
 * แยก "แนะนำ" ออกจาก "บันทึกแล้ว" เพราะผู้ตรวจต้องเห็นว่าตัวเองแก้จากค่าที่ระบบคิดไปเท่าไหร่
 * — ถ้ากลืนเป็นค่าเดียวกันจะไม่มีใครรู้ว่ายอดถูกปรับมือหรือเปล่า
 */
export async function getCasePay(caseId: number) {
  const saved = (await db.query('SELECT * FROM survey_pay WHERE case_id = $1', [caseId])).rows[0] ?? null;

  const r = (await db.query(
    `SELECT sr.acc_province, sr.acc_district, sr.acc_surveyor, sr.claim_type,
            (SELECT count(*) FROM survey_photos sp WHERE sp.report_id = sr.id) AS photo_count
       FROM survey_reports sr WHERE sr.case_id = $1`, [caseId])).rows[0] as
    | { acc_province?: string; acc_district?: string; acc_surveyor?: string;
        claim_type?: string; photo_count?: string }
    | undefined;

  if (!r) return { saved, suggest: null, area: null };

  const province = provinceCode(r.acc_province);
  const amphur = amphurCode(r.acc_province, r.acc_district);
  const team = r.acc_surveyor ? await teamOfSurveyor(r.acc_surveyor) : null;

  // ประเภทเคลมในระบบเราเป็นตัวอักษร (F/D/A/C) แต่ตารางเรทคิดตามเลข 1-4 ของระบบเดิม
  // F = เคลมสด · D = เคลมแห้ง · ที่เหลือถือเป็นกลุ่มติดตาม/อื่น ๆ
  const mtypeId = ({ F: '1', D: '2', A: '3', C: '4' } as Record<string, string>)[r.claim_type ?? ''] ?? '1';

  const pay = await calcPay({
    provinceId: province, amphurId: amphur, mtypeId, team,
    isSE: true,
    outOfArea: saved?.out_of_area ? Number(saved.out_of_area_amt ?? 0) : null,
    outOfHours: saved?.out_of_hours ? Number(saved.out_of_hours_amt ?? 0) : null,
  });

  return {
    saved,
    suggest: { service_fee: pay.surInvest, snapshot: pay.snapshot },
    area: {
      province_code: province, amphur_code: amphur, team,
      province_name: r.acc_province ?? null, district_name: r.acc_district ?? null,
      // แปลงพื้นที่ไม่ได้ = หาเรทไม่เจอ → หน้าเว็บต้องบอกให้ไปแก้ชื่อจังหวัด/อำเภอก่อน
      resolved: Boolean(amphur || province),
      photo_count: Number(r.photo_count ?? 0),
    },
  };
}

export interface SavePayInput {
  out_of_area?: boolean; out_of_area_amt?: number | null;
  out_of_hours?: boolean; out_of_hours_amt?: number | null;
  special_tumbon?: boolean;
  daily_check?: string | null;
  other_reason?: string | null;
  [k: string]: unknown;
}

/**
 * บันทึกยอดจ่ายพนักงาน — 1 เคส 1 แถว
 *
 * `other_fee` เป็นช่องหักเงิน **บังคับให้ติดลบเสมอ** (กติกาเดียวกับระบบเดิม) —
 * เผลอกรอกเป็นบวกแล้วยอดรวมจะบวกเพิ่มแทนที่จะหัก
 */
export async function saveCasePay(caseId: number, input: SavePayInput, userId?: number) {
  const money: Record<string, number | null> = {};
  for (const f of PAY_MONEY_FIELDS) {
    const v = num(input[f]);
    money[f] = v === null ? null : f === 'other_fee' ? -Math.abs(v) : v;
  }
  const total = round2(PAY_MONEY_FIELDS.reduce((s, f) => s + (money[f] ?? 0), 0));
  const { suggest } = await getCasePay(caseId);

  const r = await db.query(
    `INSERT INTO survey_pay (case_id, service_fee, travel_fee, photo_fee, phone_fee, bail_fee,
        claim_fee, daily_fee, other_fee, other_reason, out_of_area, out_of_hours,
        special_tumbon, daily_check, total, rate_snapshot, priced_by, priced_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
     ON CONFLICT (case_id) DO UPDATE SET
       service_fee=EXCLUDED.service_fee, travel_fee=EXCLUDED.travel_fee, photo_fee=EXCLUDED.photo_fee,
       phone_fee=EXCLUDED.phone_fee, bail_fee=EXCLUDED.bail_fee, claim_fee=EXCLUDED.claim_fee,
       daily_fee=EXCLUDED.daily_fee, other_fee=EXCLUDED.other_fee, other_reason=EXCLUDED.other_reason,
       out_of_area=EXCLUDED.out_of_area, out_of_hours=EXCLUDED.out_of_hours,
       special_tumbon=EXCLUDED.special_tumbon, daily_check=EXCLUDED.daily_check,
       total=EXCLUDED.total, rate_snapshot=EXCLUDED.rate_snapshot,
       priced_by=EXCLUDED.priced_by, priced_at=NOW(), updated_at=NOW()
     RETURNING *`,
    [caseId, money.service_fee, money.travel_fee, money.photo_fee, money.phone_fee,
     money.bail_fee, money.claim_fee, money.daily_fee, money.other_fee,
     input.other_reason ?? null, Boolean(input.out_of_area), Boolean(input.out_of_hours),
     Boolean(input.special_tumbon), input.daily_check ?? null, total,
     JSON.stringify(suggest?.snapshot ?? {}), userId ?? null]);
  return r.rows[0];
}
