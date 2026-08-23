import { db } from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';

/**
 * เลขรุ่นของข้อมูลเคส (survey_reports.rev) — กันหัวหน้า 2 คนบันทึกทับกันเงียบ ๆ
 *
 * หน้าตรวจเคสส่งทุกช่องไปพร้อมกันตอนกดบันทึก ไม่ใช่เฉพาะช่องที่แก้ ถ้าสองคนเปิด
 * เคสเดียวกัน คนที่บันทึกทีหลังจะทับงานของคนแรก**ทั้งหน้า** ด้วยค่าเก่าที่ค้างอยู่ในจอตัวเอง
 * และทั้งคู่เห็นข้อความ "บันทึกสำเร็จ" เหมือนกัน — ไม่มีใครรู้ว่าข้อมูลหาย
 *
 * วิธีกัน: หน้าเว็บจำ rev ตอนเปิดเคส แล้วส่งกลับมาตอนบันทึก (`base_rev`)
 * ถ้า rev ในฐานข้อมูลเดินไปแล้ว = มีคนบันทึกคั่น → 409 ไม่เขียนอะไรเลยสักช่อง
 *
 * rev บวกเองโดย trigger `trg_survey_reports_rev` (migration 042) ทุกครั้งที่มีการ UPDATE
 * — ครอบคลุมทุกทางที่เขียน survey_reports (แอปมือถือส่งงาน · ผู้ตรวจแก้บนเว็บ · นำเข้า XML ·
 * แอดมินแก้ตัวระบุเคส) ไม่ต้องไปบวกเลขทีละที่แล้วเสี่ยงลืม
 */

/** อินเทอร์เฟซที่ใช้ร่วมกันได้ทั้ง pool กับ client ของ transaction */
interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * ตรวจว่า `base_rev` ที่หน้าเว็บส่งมายังตรงกับของจริงไหม
 *
 * `lock: true` = ล็อกแถวไว้จนจบ transaction (`FOR UPDATE`) — ต้องใช้กับเส้นที่จะเขียนจริง
 * ไม่งั้นสองคนกดพร้อมกันเป๊ะ ๆ ทั้งคู่จะอ่าน rev เดิมได้เท่ากันแล้วผ่านด่านนี้ไปทั้งคู่
 *
 * @returns id ของ report กับ rev ปัจจุบัน (ผู้เรียกไม่ต้อง query ซ้ำ)
 */
export async function assertReportRev(
  caseId: number,
  baseRev: unknown,
  opts: { client?: Queryable; lock?: boolean } = {},
): Promise<{ reportId: number; rev: number }> {
  const q: Queryable = opts.client ?? db;

  const cur = await q.query(
    `SELECT id, rev FROM survey_reports WHERE case_id = $1${opts.lock ? ' FOR UPDATE' : ''}`,
    [caseId],
  );
  if (cur.rows.length === 0) throw new NotFoundError('Report not found');
  const reportId = Number(cur.rows[0].id);
  const rev = Number(cur.rows[0].rev);

  /**
   * ไม่ได้ส่ง base_rev มา = หน้าเว็บที่เบราว์เซอร์แคชไว้เป็นรุ่นก่อนหน้า
   * ⛔ ห้ามปล่อยผ่าน — ปล่อยผ่านคือรูโหว่เดิมที่ยังเปิดอยู่โดยไม่มีอะไรฟ้อง
   *    (2 endpoint ที่ใช้ตัวนี้เรียกจากหน้าเว็บเท่านั้น แอปมือถือกับบอทไม่ได้ใช้)
   */
  const asNum = typeof baseRev === 'string' ? Number(baseRev) : baseRev;
  if (typeof asNum !== 'number' || !Number.isInteger(asNum)) {
    throw new AppError(409, 'หน้านี้เป็นรุ่นเก่า — กด Ctrl+F5 โหลดหน้าใหม่แล้วบันทึกอีกครั้ง');
  }

  if (asNum !== rev) {
    throw new AppError(409, await conflictMessage(caseId, q));
  }
  return { reportId, rev };
}

/**
 * ข้อความบอกว่าใครบันทึกคั่นและเมื่อไหร่ — สร้างเฉพาะตอนชนกันจริง (ไม่ต้อง join ทุกครั้ง)
 * บอกชื่อคนด้วยเพราะสิ่งที่ผู้ตรวจต้องทำต่อคือ**ไปคุยกับคนนั้น** ไม่ใช่แค่กดโหลดใหม่
 */
async function conflictMessage(caseId: number, q: Queryable): Promise<string> {
  let who = '';
  let when = '';
  try {
    const r = await q.query(
      `SELECT (u.first_name || ' ' || COALESCE(u.last_name, '')) AS who,
              to_char(sr.updated_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS when_th
         FROM survey_reports sr
         LEFT JOIN users u ON u.id = sr.updated_by
        WHERE sr.case_id = $1`,
      [caseId],
    );
    who = String(r.rows[0]?.who ?? '').trim();
    when = String(r.rows[0]?.when_th ?? '').trim();
  } catch {
    /* หาชื่อไม่ได้ก็ยังต้องกันการทับอยู่ดี — ใช้ข้อความแบบไม่ระบุชื่อแทน */
  }

  // เว้นวรรคหลังชื่อคนเท่านั้น — "มีคนอื่น บันทึก..." อ่านแล้วสะดุด
  const actor = who ? `${who} บันทึก` : 'มีคนอื่นบันทึก';
  const at = when ? ` เมื่อ ${when} น.` : '';
  return `บันทึกไม่ได้ — ${actor}เคสนี้ไปแล้ว${at} ระหว่างที่คุณกำลังแก้อยู่ `
       + 'ถ้าบันทึกทับตอนนี้ งานของอีกฝ่ายจะหายทั้งหมด — '
       + 'กด "โหลดข้อมูลล่าสุด" แล้วตรวจว่าสิ่งที่คุณแก้ยังอยู่ครบ ก่อนบันทึกอีกครั้ง';
}
