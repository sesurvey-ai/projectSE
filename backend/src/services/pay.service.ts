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
