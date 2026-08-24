import { db } from '../config/database';

/**
 * ประวัติการแก้ยอดเงิน (ตาราง `money_audit` — migration 043)
 *
 * เก็บเฉพาะ 2 ตารางเงิน: ยอดจ่ายพนักงาน (`survey_pay`) และยอดเรียกเก็บประกัน (`survey_expenses`)
 *
 * ⛔ **ทำในโค้ด ไม่ใช่ trigger** — ต่างจากที่ทำกับ `survey_reports.rev` โดยตั้งใจ เพราะ
 *    `survey_expenses` เขียนด้วยท่า DELETE-แล้ว-INSERT ทุกครั้ง trigger จะเห็นเป็น
 *    "ลบทุกช่องแล้วใส่ใหม่ทุกช่อง" ทุกครั้งที่กดบันทึก = ประวัติเต็มไปด้วยรายการปลอม
 *    จนอ่านไม่รู้เรื่อง · เทียบค่าก่อน-หลังในโค้ดได้ประวัติที่ตรงกับสิ่งที่คนทำจริง
 *
 *    ราคาที่จ่าย: ถ้าวันหลังมีคนเพิ่มทางเขียนใหม่แล้วลืมเรียก จะไม่มีประวัติแบบเงียบ ๆ
 *    → มีการ์ดเทสไล่ว่าทุกที่ที่เขียน 2 ตารางนี้เรียก recordMoneyChanges แล้ว
 */

export type MoneyKind = 'pay' | 'expense';

/** ป้ายชื่อช่องภาษาไทย — ช่องไหนไม่มีในนี้ = ไม่ต้องเก็บประวัติ (เช่น snapshot, เวลา) */
export const MONEY_LABELS: Record<MoneyKind, Record<string, string>> = {
  // ยอดจ่ายพนักงาน — ตรงกับคอลัมน์ "ราคาพนักงาน" บนหน้าตรวจ
  pay: {
    service_fee: 'ค่าบริการ', travel_fee: 'ค่าเดินทาง', photo_fee: 'ค่ารูปถ่าย',
    phone_fee: 'ค่าโทรศัพท์', bail_fee: 'ค่าประกันตัว', claim_fee: 'ค่าเรียกร้อง',
    daily_fee: 'ค่าคัดประจำวัน', other_fee: 'ค่าใช้จ่ายอื่นๆ', other_reason: 'เหตุผลค่าอื่นๆ',
    out_of_area: 'นอกพื้นที่', out_of_area_amt: 'ยอดนอกพื้นที่',
    out_of_hours: 'นอกเวลา', out_of_hours_amt: 'ยอดนอกเวลา',
    special_tumbon: 'ตำบลพิเศษ', daily_check: 'ผลคัดประจำวัน',
    deduct_fee: 'หักเงิน', deduct_late: 'หัก-ส่งช้า', deduct_docs: 'หัก-เอกสารไม่ครบ',
    deduct_reason: 'เหตุผลหักเงิน', total: 'รวมจ่ายพนักงาน',
  },
  // ยอดเรียกเก็บประกัน — คอลัมน์ "ราคาประกัน"
  expense: {
    service_fee_count: 'ค่าบริการ (จำนวน)', service_fee_price: 'ค่าบริการ',
    travel_fee_count: 'ค่าเดินทาง (จำนวน)', travel_fee_price: 'ค่าเดินทาง',
    photo_fee_count: 'ค่ารูปถ่าย (จำนวน)', photo_fee_price: 'ค่ารูปถ่าย',
    phone_fee: 'ค่าโทรศัพท์', bail_fee: 'ค่าประกันตัว',
    claim_fee_percent: 'ค่าเรียกร้อง (%)', claim_fee_price: 'ค่าเรียกร้อง',
    daily_record_fee: 'ค่าคัดประจำวัน',
    other_fee_detail: 'รายละเอียดค่าอื่นๆ', other_fee_price: 'ค่าใช้จ่ายอื่นๆ',
  },
};

interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * เทียบตัวเลขแบบ "ค่าเท่ากันไหม" ไม่ใช่ "ข้อความเหมือนกันไหม"
 * ⛔ ไม่ทำแบบนี้ = `"400"` กับ `"400.00"` (numeric จาก DB) นับเป็นการเปลี่ยนแปลงทุกครั้งที่กดบันทึก
 *    ประวัติจะเต็มไปด้วยรายการที่ไม่มีอะไรเปลี่ยนจริง
 */
function same(a: unknown, b: unknown): boolean {
  const na = a === null || a === undefined || a === '' ? null : a;
  const nb = b === null || b === undefined || b === '' ? null : b;
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  const fa = Number(na), fb = Number(nb);
  if (Number.isFinite(fa) && Number.isFinite(fb)) return fa === fb;
  return String(na) === String(nb);
}

const text = (v: unknown): string | null =>
  v === null || v === undefined ? null
    : typeof v === 'boolean' ? (v ? 'ใช่' : 'ไม่')
      : String(v);

/**
 * เทียบค่าก่อน-หลัง แล้วบันทึกเฉพาะช่องที่เปลี่ยนจริง
 *
 * @param client ต้องเป็น client ของ transaction เดียวกับที่เขียนยอดเงิน — ไม่งั้นเขียนสำเร็จ
 *               แต่ประวัติหาย (หรือกลับกัน) เวลา transaction ถูก rollback
 * @param userId คนที่กด · null = ระบบทำเอง (นำเข้าจากไฟล์/บอท) ไม่ใช่คนกด
 */
export async function recordMoneyChanges(
  client: Queryable,
  opts: {
    caseId: number; kind: MoneyKind; userId?: number | null;
    before: Record<string, unknown> | null | undefined;
    after: Record<string, unknown> | null | undefined;
  },
): Promise<number> {
  const labels = MONEY_LABELS[opts.kind];
  const before = opts.before ?? {};
  const after = opts.after ?? {};
  const rows: [string, string | null, string | null][] = [];

  for (const field of Object.keys(labels)) {
    const a = before[field];
    const b = after[field];
    if (same(a, b)) continue;
    rows.push([field, text(a), text(b)]);
  }
  if (rows.length === 0) return 0;

  // ยิงทีเดียวหลายแถว — กดบันทึกครั้งเดียวอาจเปลี่ยน 10 ช่อง ไม่ควรวิ่ง 10 รอบ
  const vals: unknown[] = [];
  const tuples = rows.map(([f, o, n], i) => {
    vals.push(opts.caseId, opts.kind, f, o, n, opts.userId ?? null);
    const p = i * 6;
    return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6})`;
  });
  await client.query(
    `INSERT INTO money_audit (case_id, kind, field, old_value, new_value, changed_by)
     VALUES ${tuples.join(', ')}`, vals);
  return rows.length;
}

/** ประวัติของเคส ใหม่→เก่า (ป้ายไทยคำนวณตอนอ่าน จะได้แก้ป้ายทีหลังแล้วของเก่าเปลี่ยนตาม) */
export async function getMoneyAudit(caseId: number) {
  const { rows } = await db.query(
    `SELECT a.kind, a.field, a.old_value, a.new_value,
            to_char(a.changed_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') AS at,
            (u.first_name || ' ' || COALESCE(u.last_name, '')) AS by_name
       FROM money_audit a LEFT JOIN users u ON u.id = a.changed_by
      WHERE a.case_id = $1
      ORDER BY a.changed_at DESC, a.id DESC
      LIMIT 500`, [caseId]);
  return rows.map((r) => ({
    ...r,
    label: MONEY_LABELS[r.kind as MoneyKind]?.[r.field as string] ?? r.field,
    side: r.kind === 'pay' ? 'ราคาพนักงาน' : 'ราคาประกัน',
    by_name: String(r.by_name ?? '').trim() || 'ระบบ',
  }));
}
