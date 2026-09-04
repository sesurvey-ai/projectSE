/**
 * ดึงงาน "รอตรวจข้อมูล" จาก ISURVEY เข้าเว็บ — ผ่าน service `pull_service.py` ของ se-autokey ที่รันบนเซิร์ฟเวอร์
 *
 * backend ไม่คุยกับ ISURVEY เอง (ตัวแปลง ISURVEY→se-survey เป็น Python ตัวเดียวกับบอท ดู
 * se-autokey/autokey/isurvey_to_sesurvey.py + audit 03/09/69) — ส่งบัญชีของ "คนที่กด" ไปต่อคำขอ
 * service ไม่เก็บอะไร · ISURVEY ถูกอ่านอย่างเดียว · EMCS ไม่ถูกแตะ
 *
 * env: ISURVEY_SERVICE_URL (ไม่ตั้ง = ฟีเจอร์ปิด 503) · ISURVEY_SERVICE_TOKEN (= PULL_SERVICE_TOKEN ของ service)
 */
import { db } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { isurveyCredService } from './isurveyCred.service';
import { staffGroupService } from './staffGroup.service';

export interface PendingRow {
  claim_no: string; survey_no: string; surveyor_name: string; acc_province: string;
  plate_no: string; finish_dt: string; status: string; emcs_sent: boolean;
  /** เคสที่มีอยู่แล้วในระบบเรา (เลขเคลม+เซอร์เวย์เดียวกัน) — กันดึงซ้ำ */
  imported_case_id?: number | null; imported_status?: string | null;
}

async function callService<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const base = String(env.ISURVEY_SERVICE_URL ?? '').replace(/\/+$/, '');
  if (!base) throw new AppError(503, 'เซิร์ฟเวอร์ยังไม่ได้ตั้ง ISURVEY_SERVICE_URL — ดึงงานจาก ISURVEY ยังใช้ไม่ได้');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Token': String(env.ISURVEY_SERVICE_TOKEN ?? '') },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError'
      ? `service ดึงงานไม่ตอบใน ${Math.round(timeoutMs / 1000)} วินาที` : `ติดต่อ service ดึงงานไม่ได้: ${String(e)}`;
    throw new AppError(502, msg);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let j: { ok?: boolean; error?: string } & Record<string, unknown> = {};
  try { j = JSON.parse(text); } catch { /* ไม่ใช่ JSON — ใช้ text ล่าง */ }
  if (!res.ok || !j.ok) {
    throw new AppError(res.status === 401 ? 502 : 502, String(j.error || `service ตอบ ${res.status}: ${text.slice(0, 200)}`));
  }
  return j as T;
}

export const isurveyPullService = {
  enabled(): boolean {
    return Boolean(String(env.ISURVEY_SERVICE_URL ?? '').trim()) && isurveyCredService.enabled();
  },

  /** ลองล็อกอิน ISURVEY ด้วยบัญชีที่เก็บไว้ — จดผลลง last_ok_at/last_error */
  async testLogin(userId: number): Promise<{ ok: true; name: string }> {
    const creds = await isurveyCredService.getPlain(userId);
    try {
      const r = await callService<{ name?: string }>('/login-test', creds, 30000);
      await isurveyCredService.markResult(userId, true, undefined, String(r.name ?? ''));
      return { ok: true, name: String(r.name ?? '') };
    } catch (e) {
      await isurveyCredService.markResult(userId, false, e instanceof Error ? e.message : String(e));
      throw e;
    }
  },

  /**
   * งานสถานะ "รอตรวจข้อมูล" ในช่วงวันที่ + ธงว่าดึงเข้าระบบแล้วหรือยัง
   * รายงานของ ISURVEY ให้งานทั้งบริษัท → กรองให้เหลือเฉพาะลูกทีมของหัวหน้าคนนี้ (staff_groups)
   * แอดมิน / บัญชีที่ยังไม่ผูกทีม = เห็นทั้งหมด (บอกไว้ใน filter เพื่อให้หน้าจอแจ้งผู้ใช้)
   */
  async listPending(userId: number, role: string, dateFrom?: string, dateTo?: string):
    Promise<{ cases: PendingRow[]; filter: { applied: boolean; group_name: string | null; members: number; hidden: number } }> {
    const creds = await isurveyCredService.getPlain(userId);
    let rows: PendingRow[];
    try {
      // status '' = ขอทุกสถานะ — หน้าเว็บให้ผู้ใช้เลือกสถานะเอง (ค่าเริ่มต้นบนหน้า = รอตรวจข้อมูล) user ขอ 04/09/69
      const r = await callService<{ cases: PendingRow[] }>('/pending',
        { ...creds, date_from: dateFrom ?? '', date_to: dateTo ?? '', status: '' }, 150000);
      rows = r.cases ?? [];
      // รายงาน ISURVEY บางทีคืนงานเดียวกันซ้ำ 2 แถว (ทุกช่องเหมือนกัน) → ตัดเหลือแถวเดียว
      // ไม่งั้นหน้าเว็บได้ key ซ้ำ แถวค้างในตารางตอนเปลี่ยนตัวกรองสถานะ (เจอจริง 04/09/69)
      const seen = new Set<string>();
      rows = rows.filter((x) => {
        const k = [x.claim_no, x.survey_no, x.finish_dt, x.status, x.surveyor_name].map((v) => String(v ?? '')).join('|');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      await isurveyCredService.markResult(userId, true);
    } catch (e) {
      await isurveyCredService.markResult(userId, false, e instanceof Error ? e.message : String(e));
      throw e;
    }
    const team = await staffGroupService.filterFor(userId, role);
    const before = rows.length;
    if (team) rows = rows.filter((r) => team.match(String(r.surveyor_name ?? '')));
    const filter = { applied: Boolean(team), group_name: team?.group.name ?? null,
                     members: team?.group.members?.length ?? 0, hidden: before - rows.length };
    if (rows.length === 0) return { cases: rows, filter };
    // เคสที่มีในระบบแล้ว — จับด้วยเลขเคลม + เลขเซอร์เวย์ (เลขเคลมซ้ำได้ข้ามครั้ง แต่คู่กับเซอร์เวย์ไม่ซ้ำ)
    const claims = [...new Set(rows.map((r) => r.claim_no).filter(Boolean))];
    const ex = await db.query(
      `SELECT sr.claim_no, sr.survey_job_no, c.id, c.status
         FROM survey_reports sr JOIN cases c ON c.id = sr.case_id
        WHERE sr.claim_no = ANY($1)`, [claims]);
    const byKey = new Map<string, { id: number; status: string }>();
    for (const x of ex.rows as { claim_no: string; survey_job_no: string | null; id: number; status: string }[]) {
      byKey.set(`${x.claim_no}|${x.survey_job_no ?? ''}`, { id: x.id, status: x.status });
      if (!byKey.has(`${x.claim_no}|`)) byKey.set(`${x.claim_no}|`, { id: x.id, status: x.status });
    }
    const cases = rows.map((r) => {
      const hit = byKey.get(`${r.claim_no}|${r.survey_no}`) ?? byKey.get(`${r.claim_no}|`);
      return { ...r, imported_case_id: hit?.id ?? null, imported_status: hit?.status ?? null };
    });
    return { cases, filter };
  },

  /** ดึง 1 งานเข้าเป็นเคส (+รูป) — เจ้าของเคส = คนที่กด */
  async pull(userId: number, claim: string, surveyNo: string): Promise<Record<string, unknown>> {
    const c = String(claim ?? '').trim();
    if (!c) throw new AppError(400, 'ต้องมีเลขเคลม');
    const creds = await isurveyCredService.getPlain(userId);
    const r = await callService<{ result: Record<string, unknown> }>('/pull',
      { ...creds, claim: c, survey_no: String(surveyNo ?? '').trim(), created_by: userId, with_photos: true }, 300000);
    await isurveyCredService.markResult(userId, true);
    return r.result ?? {};
  },
};
