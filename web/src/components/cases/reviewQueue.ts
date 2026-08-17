import { moneyGaps, type Case } from './CaseList';

/**
 * ตัวเลข "คิวตรวจ" — ใช้ร่วมกันระหว่างหน้ารายการงานกับหน้าตรวจเคส
 *
 * แยกออกมาเป็นไฟล์เดียวเพราะสองหน้าคิดเลขชุดเดียวกัน ถ้าปล่อยให้ต่างคนต่างคิด
 * วันหนึ่งจะแสดงตัวเลขไม่ตรงกันแล้วไม่มีใครรู้ว่าหน้าไหนถูก
 *
 * กติกา (ตรงกับ groups/incomplete เดิมของหน้ารายการงาน):
 *   ส่งประกันแล้ว = มี emcs_submitted_at  (นำเข้าแล้วยังไม่นับ — draft ยังค้างอยู่)
 *   อนุมัติแล้ว   = status === 'reviewed'
 *   รอตรวจ        = ที่เหลือ
 *   ติดปัญหา      = รอตรวจ ที่มีคำเตือนตอนนำเข้า หรือยอดเงินยังไม่ครบ
 */
export interface QueueStats {
  pending: number;
  incomplete: number;
  approved: number;
  approvedToday: number;
  sent: number;
}

/** วันที่ตามเวลาไทย (YYYY-MM-DD) — เทียบ "วันนี้" ด้วยเวลา UTC จะเพี้ยนช่วงหัวค่ำ */
const bkkDay = (v?: string | null) => {
  if (!v) return '';
  const t = new Date(v);
  return Number.isNaN(t.getTime())
    ? '' : t.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

export function queueStats(cases: Case[]): QueueStats {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  let pending = 0, incomplete = 0, approved = 0, approvedToday = 0, sent = 0;
  for (const c of cases) {
    if (c.emcs_submitted_at) { sent++; continue; }
    if (c.status === 'reviewed') {
      approved++;
      if (bkkDay(c.approved_at) === today) approvedToday++;
      continue;
    }
    pending++;
    if ((c.import_warnings?.length ?? 0) > 0 || moneyGaps(c).length > 0) incomplete++;
  }
  return { pending, incomplete, approved, approvedToday, sent };
}
