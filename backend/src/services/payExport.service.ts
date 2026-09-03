import ExcelJS from 'exceljs';
import { db } from '../config/database';

/**
 * ใบเบิกเงินค่าตอบแทนผู้สำรวจ (.xlsx)
 *
 * **คอลัมน์เรียงตามใบเดิมของ se-billing** โดยตั้งใจ — คนทำเรื่องเบิกเงินอ่านใบนี้มาตลอด
 * เปลี่ยนลำดับ/ชื่อคอลัมน์แล้วเขาต้องมาไล่หาใหม่ทุกเดือน
 *
 * ครอบคลุมเฉพาะงานที่คิดเงินผ่านระบบนี้ — งานที่ยังทำผ่านระบบเก่ายังออกใบจาก se-billing
 * เหมือนเดิม (สองทางคู่กันจนกว่าจะเลิกใช้ระบบเก่า)
 */

/** F/D/A/C เป็นรหัสของระบบเรา — ใบเบิกเงินต้องอ่านออกโดยไม่ต้องเปิดคู่มือ */
const CLAIM_TYPE_LABEL: Record<string, string> = {
  F: 'เคลมสด', D: 'เคลมแห้ง', A: 'ติดตาม', C: 'อื่นๆ',
};

export interface PayExportFilter {
  /** YYYY-MM-DD (เวลาไทย) — กรองตามวันที่คิดเงิน ไม่ใช่วันที่เกิดเหตุ */
  from?: string;
  to?: string;
}

export async function payRows(f: PayExportFilter = {}) {
  const where: string[] = ['sp.priced_at IS NOT NULL'];
  const params: unknown[] = [];
  // เทียบเป็นวันตามเวลาไทย ไม่ใช่ UTC — ไม่งั้นงานตอนเย็นตกไปอยู่วันถัดไป
  if (f.from) { params.push(f.from); where.push(`(sp.priced_at AT TIME ZONE 'Asia/Bangkok')::date >= $${params.length}::date`); }
  if (f.to) { params.push(f.to); where.push(`(sp.priced_at AT TIME ZONE 'Asia/Bangkok')::date <= $${params.length}::date`); }

  const r = await db.query(
    `SELECT sp.*,
            -- created_at ไม่มีโซนแต่เก็บเวลาไทย — ติด +07:00 ใน SQL ไม่งั้น prod (UTC) โชว์เกินไป 7 ชม.
            -- (กติกาเดียวกับ sebilling.service ดูหมายเหตุที่นั่น)
            to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+07:00' AS dispatch_at,
            sr.claim_no, sr.survey_job_no, sr.acc_province, sr.acc_district, sr.acc_subdistrict,
            sr.claim_type, sr.acc_surveyor,
            se.service_fee_price AS ins_service, se.travel_fee_price AS ins_travel,
            -- photo_fee_price = ราคาต่อรูป → คอลัมน์ค่ารูปในใบเบิกเป็นยอดรวม = × จำนวนรูป
            se.photo_fee_price * COALESCE(NULLIF(se.photo_fee_count, 0), 1) AS ins_photo,
            TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS priced_by_name
       FROM survey_pay sp
       JOIN cases c ON c.id = sp.case_id
       LEFT JOIN survey_reports sr ON sr.case_id = sp.case_id
       LEFT JOIN survey_expenses se ON se.report_id = sr.id
       LEFT JOIN users u ON u.id = sp.priced_by
      WHERE ${where.join(' AND ')}
      ORDER BY sp.priced_at`, params);
  return r.rows as Record<string, unknown>[];
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** "2026-08-12T07:11:00Z" → "12/08/2569 14:11" (เวลาไทย · พ.ศ.) */
function thaiStamp(v: unknown): string {
  if (!v) return '';
  const t = new Date(String(v));
  if (Number.isNaN(t.getTime())) return '';
  const b = new Date(t.getTime() + 7 * 3600 * 1000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(b.getUTCDate())}/${p(b.getUTCMonth() + 1)}/${b.getUTCFullYear() + 543} `
    + `${p(b.getUTCHours())}:${p(b.getUTCMinutes())}`;
}

export async function buildPayWorkbook(f: PayExportFilter = {}): Promise<ExcelJS.Workbook> {
  const rows = await payRows(f);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ค่าตอบแทนผู้สำรวจ');

  ws.columns = [
    { header: 'วันจ่ายงาน', key: 'dispatch', width: 18 },
    { header: 'วัน-เวลาที่คิดเงิน', key: 'priced', width: 20 },
    { header: 'เลขเคลม', key: 'claim_no', width: 22 },
    { header: 'เลขเซอร์เวย์', key: 'survey_no', width: 22 },
    { header: 'จังหวัด', key: 'province', width: 14 },
    { header: 'อำเภอ', key: 'amphur', width: 18 },
    { header: 'ตำบล', key: 'tumbon', width: 18 },
    { header: 'ประเภทเคลม', key: 'mtype', width: 12 },
    { header: 'พนักงานสำรวจ', key: 'surveyor', width: 32 },
    { header: 'เจ้าหน้าที่ตรวจ', key: 'inspector', width: 22 },
    { header: 'ค่าบริการ (ประกัน)', key: 'ins_service', width: 15 },
    { header: 'ค่าพาหนะ (ประกัน)', key: 'ins_travel', width: 15 },
    { header: 'รูป (ประกัน)', key: 'ins_photo', width: 12 },
    { header: 'รวมบริษัท', key: 'sum_company', width: 12 },
    { header: 'ค่าบริการ (พนักงาน)', key: 'service_fee', width: 16 },
    { header: 'ค่าพาหนะ (พนักงาน)', key: 'travel_fee', width: 16 },
    { header: 'ค่ารูป (พนักงาน)', key: 'photo_fee', width: 14 },
    { header: 'นอกพื้นที่', key: 'out_area', width: 11 },
    { header: 'นอกเวลา', key: 'out_hours', width: 10 },
    { header: 'ค่าใช้จ่ายอื่นๆ', key: 'other_fee', width: 13 },
    { header: 'หักเงิน', key: 'deduct', width: 10 },
    { header: 'ส่งช้า', key: 'late', width: 8 },
    { header: 'งานไม่เรียบร้อย', key: 'docs', width: 14 },
    { header: 'เหตุผลหักเงิน', key: 'deduct_reason', width: 24 },
    { header: 'รวมพนักงาน', key: 'total', width: 13 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];   // เลื่อนดูแถวล่าง ๆ แล้วยังเห็นหัวตาราง

  for (const r of rows) {
    const insSum = (n(r.ins_service) ?? 0) + (n(r.ins_travel) ?? 0) + (n(r.ins_photo) ?? 0);
    ws.addRow({
      dispatch: thaiStamp(r.dispatch_at),
      priced: thaiStamp(r.priced_at),
      claim_no: r.claim_no ?? '',
      survey_no: r.survey_job_no ?? '',
      province: r.acc_province ?? '',
      amphur: r.acc_district ?? '',
      tumbon: r.acc_subdistrict ?? '',
      mtype: CLAIM_TYPE_LABEL[String(r.claim_type ?? '')] ?? (r.claim_type ?? ''),
      surveyor: r.acc_surveyor ?? '',
      inspector: r.priced_by_name ?? '',
      ins_service: n(r.ins_service), ins_travel: n(r.ins_travel), ins_photo: n(r.ins_photo),
      sum_company: insSum || null,
      service_fee: n(r.service_fee), travel_fee: n(r.travel_fee), photo_fee: n(r.photo_fee),
      out_area: n(r.out_of_area_amt), out_hours: n(r.out_of_hours_amt),
      other_fee: n(r.other_fee),
      // แสดงหักเงินเป็นเลขติดลบในใบเบิก ให้เห็นทันทีว่าเป็นรายการที่หักออก
      deduct: r.deduct_fee ? -Math.abs(n(r.deduct_fee) ?? 0) : null,
      late: r.deduct_late ? '✓' : '',
      docs: r.deduct_docs ? '✓' : '',
      deduct_reason: r.deduct_reason ?? '',
      total: n(r.total),
    });
  }

  // แถวรวมท้ายตาราง — คนทำเบิกเงินต้องการยอดรวมทันที ไม่ต้องมาลากเลือกเอง
  if (rows.length) {
    const sum = ws.addRow({
      inspector: `รวม ${rows.length} งาน`,
      total: rows.reduce((s, r) => s + (n(r.total) ?? 0), 0),
    });
    sum.font = { bold: true };
  }
  for (const key of ['ins_service', 'ins_travel', 'ins_photo', 'sum_company', 'service_fee',
    'travel_fee', 'photo_fee', 'out_area', 'out_hours', 'other_fee', 'deduct', 'total']) {
    ws.getColumn(key).numFmt = '#,##0.00';
  }
  return wb;
}
