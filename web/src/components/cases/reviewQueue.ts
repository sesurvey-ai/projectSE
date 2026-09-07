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
 *   ตีกลับแล้ว    = status 'assigned' + มี sent_back_at (งานอยู่กับช่าง)
 *   เสร็จงานแล้ว  = status 'finished' (เสร็จหน้างาน รอช่างส่งรายงาน — งานอยู่กับช่างเช่นกัน, 07/09/69)
 *   รอตรวจ        = ที่เหลือ
 *   ติดปัญหา      = รอตรวจ ที่มีคำเตือนตอนนำเข้า หรือยอดเงินยังไม่ครบ
 */
export interface QueueStats {
  pending: number;
  /** ตีกลับให้ช่างแล้ว รอส่งกลับมา — ไม่ใช่คิวที่หัวหน้าต้องลงมือ */
  sentBack: number;
  /** เสร็จงานหน้างานแล้ว รอช่างส่งรายงาน — ไม่ใช่คิวที่หัวหน้าต้องลงมือเช่นกัน */
  finished: number;
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
  let pending = 0, incomplete = 0, approved = 0, approvedToday = 0, sent = 0, sentBack = 0, finished = 0;
  for (const c of cases) {
    if (c.emcs_submitted_at) { sent++; continue; }
    if (c.status === 'reviewed') {
      approved++;
      if (bkkDay(c.approved_at) === today) approvedToday++;
      continue;
    }
    // ตีกลับไปแล้ว = งานอยู่กับช่าง ไม่ใช่คิวที่หัวหน้าต้องตรวจ — นับแยก
    // (ยังอยู่ในลิสต์เพราะหัวหน้ายังแก้เองได้ แต่เอาไปปนกับ "รอตรวจ" ตัวเลขจะหลอก)
    if (c.status === 'assigned' && c.sent_back_at) { sentBack++; continue; }
    // เสร็จงานหน้างานแล้วแต่ยังไม่ส่งรายงาน = ยังอยู่กับช่าง — นับแยก ไม่ปนกับ "รอตรวจ"
    if (c.status === 'finished') { finished++; continue; }
    pending++;
    if ((c.import_warnings?.length ?? 0) > 0 || moneyGaps(c).length > 0) incomplete++;
  }
  return { pending, incomplete, approved, approvedToday, sent, sentBack, finished };
}
