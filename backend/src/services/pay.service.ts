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

/** ช่องรายรับฝั่งพนักงาน (บวกเข้ายอดรวม) — ชื่อคีย์ตรงกับคอลัมน์ใน survey_pay */
export const PAY_MONEY_FIELDS = [
  'service_fee', 'travel_fee', 'photo_fee', 'phone_fee',
  'bail_fee', 'claim_fee', 'daily_fee', 'other_fee',
] as const;

/**
 * หักเงิน — **แยกช่องกับ "ค่าใช้จ่ายอื่นๆ" แล้ว**
 *
 * ระบบเดิมยัดสองเรื่องนี้ไว้ช่องเดียวเพราะส่วนขยายแทรกช่องใหม่ลงฟอร์มระบบเก่าไม่ได้
 * ผลคือกรอกรายจ่ายอื่นจริง ๆ ไม่ได้เลย · เว็บนี้เราคุมเอง จึงแยกให้ถูกความหมาย
 * เก็บเป็นค่าบวก แล้วลบตอนรวมยอด
 */
export const PAY_DEDUCT_FIELD = 'deduct_fee';

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
    outOfArea: saved?.out_of_area ? Number(saved.out_of_area_amt ?? 50) : null,
    outOfHours: saved?.out_of_hours ? Number(saved.out_of_hours_amt ?? 100) : null,
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
  deduct_late?: boolean; deduct_docs?: boolean; deduct_reason?: string | null;
  other_reason?: string | null;
  [k: string]: unknown;
}

/**
 * บันทึกยอดจ่ายพนักงาน — 1 เคส 1 แถว
 *
 * ยอดรวม = รายรับทั้งหมด − หักเงิน
 */
export async function saveCasePay(caseId: number, input: SavePayInput, userId?: number) {
  const money: Record<string, number | null> = {};
  for (const f of PAY_MONEY_FIELDS) money[f] = num(input[f]);
  // หักเงินเก็บเป็นค่าบวกเสมอ — กรอกติดลบมาก็แปลงให้ ไม่งั้นลบซ้อนลบกลายเป็นบวก
  const deduct = num(input[PAY_DEDUCT_FIELD]);
  money[PAY_DEDUCT_FIELD] = deduct === null ? null : Math.abs(deduct);
  // ยอดตัวปรับ — เก็บแยกเพื่อให้ใบเบิกเงินแยกออกว่าจ่ายค่าอะไรไปเท่าไหร่
  // ติ๊กแต่ไม่ใส่เลข = ใช้ค่าตั้งต้น (นอกพื้นที่ 50 · นอกเวลา 100) ตามระบบเดิม
  const areaAmt = input.out_of_area ? (num(input.out_of_area_amt) ?? 50) : null;
  const hoursAmt = input.out_of_hours ? (num(input.out_of_hours_amt) ?? 100) : null;
  const total = round2(
    PAY_MONEY_FIELDS.reduce((s, f) => s + (money[f] ?? 0), 0)
    + (areaAmt ?? 0) + (hoursAmt ?? 0) - (money[PAY_DEDUCT_FIELD] ?? 0));

  // snapshot ต้องสะท้อน "สิ่งที่กรอกรอบนี้" ไม่ใช่แถวเก่าที่ยังไม่ทันอัปเดต —
  // getCasePay อ่านตัวปรับจากแถวที่บันทึกไว้ก่อนหน้า จึงได้ค่าเก่า/ว่างเสมอในครั้งแรก
  // ตัว snapshot มีหน้าที่อธิบายว่ายอดนี้มาจากอะไร ถ้าบอกตัวปรับผิดก็หมดประโยชน์
  const { suggest } = await getCasePay(caseId);
  const snapshot = {
    ...(suggest?.snapshot ?? {}),
    out_of_area: areaAmt,
    out_of_hours: hoursAmt,
    special_tumbon: input.special_tumbon ? true : null,
    daily_check: input.daily_check ?? null,
    deduct: money[PAY_DEDUCT_FIELD],
    deduct_reasons: [
      input.deduct_late ? 'ส่งช้า' : null,
      input.deduct_docs ? 'เอกสารไม่ครบ' : null,
      input.deduct_reason || null,
    ].filter(Boolean),
  };

  const r = await db.query(
    `INSERT INTO survey_pay (case_id, service_fee, travel_fee, photo_fee, phone_fee, bail_fee,
        claim_fee, daily_fee, other_fee, other_reason, out_of_area, out_of_hours,
        special_tumbon, daily_check, total, rate_snapshot, priced_by,
        deduct_fee, deduct_late, deduct_docs, deduct_reason,
        out_of_area_amt, out_of_hours_amt, priced_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
     ON CONFLICT (case_id) DO UPDATE SET
       service_fee=EXCLUDED.service_fee, travel_fee=EXCLUDED.travel_fee, photo_fee=EXCLUDED.photo_fee,
       phone_fee=EXCLUDED.phone_fee, bail_fee=EXCLUDED.bail_fee, claim_fee=EXCLUDED.claim_fee,
       daily_fee=EXCLUDED.daily_fee, other_fee=EXCLUDED.other_fee, other_reason=EXCLUDED.other_reason,
       out_of_area=EXCLUDED.out_of_area, out_of_hours=EXCLUDED.out_of_hours,
       special_tumbon=EXCLUDED.special_tumbon, daily_check=EXCLUDED.daily_check,
       total=EXCLUDED.total, rate_snapshot=EXCLUDED.rate_snapshot,
       deduct_fee=EXCLUDED.deduct_fee, deduct_late=EXCLUDED.deduct_late,
       deduct_docs=EXCLUDED.deduct_docs, deduct_reason=EXCLUDED.deduct_reason,
       out_of_area_amt=EXCLUDED.out_of_area_amt, out_of_hours_amt=EXCLUDED.out_of_hours_amt,
       priced_by=EXCLUDED.priced_by, priced_at=NOW(), updated_at=NOW()
     RETURNING *`,
    [caseId, money.service_fee, money.travel_fee, money.photo_fee, money.phone_fee,
     money.bail_fee, money.claim_fee, money.daily_fee, money.other_fee,
     input.other_reason ?? null, Boolean(input.out_of_area), Boolean(input.out_of_hours),
     Boolean(input.special_tumbon), input.daily_check ?? null, total,
     JSON.stringify(snapshot), userId ?? null,
     money[PAY_DEDUCT_FIELD], Boolean(input.deduct_late), Boolean(input.deduct_docs),
     input.deduct_reason ?? null, areaAmt, hoursAmt]);
  return r.rows[0];
}
