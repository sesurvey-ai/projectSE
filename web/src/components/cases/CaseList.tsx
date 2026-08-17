'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Case {
  id: number;
  customer_name: string;
  status: string;
  source?: string | null;
  claim_no?: string;
  survey_job_no?: string;
  claim_ref_no?: string;
  license_plate?: string;
  surveyor_first_name?: string;
  surveyor_last_name?: string;
  surveyor_code?: string | null;
  /** Postgres คืน ROW_NUMBER/COUNT เป็นสตริง — ประกาศให้ตรงความจริง กัน `"2" > 1` แบบเผลอ */
  visit_count?: number | string;
  created_at: string;
  /** เรื่องที่ต้องเติมก่อนอนุมัติ — เก็บไว้ตั้งแต่ตอนนำเข้า (migration 040) */
  import_warnings?: string[] | null;
  photo_count?: number | string | null;
  pay_total?: number | string | null;
  has_insurer_bill?: boolean | null;
  review_status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  unlocked_count?: number | null;
  emcs_imported_at?: string | null; // สร้าง draft ใน EMCS แล้วเมื่อ (null = ยัง) — กันกดซ้ำถาวรข้ามเครื่อง
  // ⚠️ "นำเข้าแล้ว" ≠ "ส่งงานแล้ว" — บอทสร้าง draft ให้เท่านั้น ปุ่ม "ส่งงานใหม่" คนกดเอง
  emcs_submitted_at?: string | null;  // ยืนยันแล้วว่าประกันรับงาน (null = ยังเป็น draft ค้าง)
  emcs_status_text?: string | null;   // ข้อความสถานะดิบจากหน้ารายการ EMCS
}
interface CaseListProps { cases: Case[]; basePath?: string; }

// ตัวรับงานคือโปรแกรม SE-AutoKey ที่รันบนเครื่องผู้ตรวจ (webui, พอร์ต 8765)
// — หน้าเว็บสั่ง EMCS ตรงไม่ได้ (คนละ origin) จึงส่งงานให้โปรแกรมบนเครื่องเป็นคนขับ EMCS แทน
// (เรียก http://127.0.0.1 จากหน้า https ได้ — เบราว์เซอร์ยกเว้น mixed-content ให้ loopback)
const AUTOKEY_URL = 'http://127.0.0.1:8765';

/**
 * ป้าย "ที่มา" ของงาน — สำคัญเพราะ **กติกาเงินต่างกันตามที่มา**
 * งานที่เกิดในระบบเรา (mobile) กับที่ดึงสดจากระบบเก่า (isurvey_live) หัวหน้ากรอกยอดเองได้
 * ส่วนงานที่ปิดจบบนระบบเก่าแล้ว (isurvey_xml) ยอดอยู่ที่ se-billing → ที่นี่ดูอย่างเดียว
 * ไม่บอกที่มาบนหน้าลิสต์ = หัวหน้างงว่าทำไมบางเคสกรอกยอดได้ บางเคสกรอกไม่ได้
 */
const SOURCE_LABEL: Record<string, { text: string; cls: string }> = {
  mobile: { text: 'แอปมือถือ', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  isurvey_live: { text: 'ระบบเก่า (สด)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  isurvey_xml: { text: 'ไฟล์ XML', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  emcs_extract: { text: 'ข้อมูลทดสอบ', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/** รูปน้อยกว่านี้ = น่าจะยังอัปไม่ครบ (งานจากระบบเก่าทยอยอัปรูปหลังช่างส่งงาน) */
const LOW_PHOTO = 5;

/** ย่อคำเตือนยาว ๆ ให้เป็นป้ายสั้นพอใส่ในตาราง — ข้อความเต็มอยู่ใน title */
function warnChip(w: string): string {
  const m: [RegExp, string][] = [
    [/ประเภทรถ/, 'ประเภทรถ'],
    [/รายการความเสียหาย/, 'ความเสียหาย'],
    [/เลขที่รับแจ้ง/, 'เลขที่รับแจ้ง'],
    [/ผลคดี/, 'ผลคดี'],
    [/ประเภทเคลม/, 'ประเภทเคลม'],
    [/ระดับการบาดเจ็บ/, 'ระดับบาดเจ็บ'],
    [/ประเภทผู้บาดเจ็บ/, 'ประเภทผู้บาดเจ็บ'],
    [/จังหวัด/, 'จังหวัด'],
    [/เลขเคลม/, 'เลขเคลม'],
    [/เลขเซอร์เวย์/, 'เลขเซอร์เวย์'],
  ];
  for (const [re, label] of m) if (re.test(w)) return label;
  return w.length > 18 ? w.slice(0, 18) + '…' : w;
}

/** ยอดเงินที่ยังขาด — กติกาเดียวกับที่หน้ารายละเอียดใช้กันปุ่มอนุมัติ */
export function moneyGaps(c: Case): string[] {
  const gaps: string[] = [];
  const payEditable = ['mobile', 'isurvey_live'].includes(String(c.source ?? 'mobile'));
  if (payEditable && !(Number(c.pay_total ?? 0) > 0)) gaps.push('ยอดพนักงาน');
  if (!c.has_insurer_bill) gaps.push('ยอดประกัน');
  return gaps;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    assigned: 'bg-orange-100 text-orange-700',
    surveyed: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = { pending: 'รอมอบหมาย', assigned: 'มอบหมายแล้ว', surveyed: 'สำรวจแล้ว', reviewed: 'ตรวจสอบแล้ว', declined: 'ปฏิเสธแล้ว' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

export default function CaseList({ cases, basePath = '/inspector' }: CaseListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());

  // ส่งเคสให้ SE-AutoKey นำเข้า EMCS (ตอนนี้ฝั่งโปรแกรมยัง dry-run — หยุดก่อนแตะ EMCS จริง)
  const sendToAutokey = async (c: Case) => {
    if (busyId !== null) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`${AUTOKEY_URL}/api/import-sesurvey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: c.id, claim_no: c.claim_no || '', survey_job_no: c.survey_job_no || '' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`SE-AutoKey ปฏิเสธงาน: ${body.error || res.status}`);
        return;
      }
      setSentIds((prev) => new Set(prev).add(c.id));
    } catch {
      alert('เชื่อมต่อโปรแกรม SE-AutoKey ไม่ได้ — เปิดโปรแกรมก่อน (start-webui.bat) แล้วลองใหม่\n\nหรือใช้ปุ่มดาวน์โหลด XML ในหน้ารายละเอียดเคสแล้วนำเข้า EMCS เอง');
    } finally {
      setBusyId(null);
    }
  };

  if (cases.length === 0) return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">ไม่มีรายการงานในขณะนี้</div>;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขเคลม</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ที่มา</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ช่างสำรวจ</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ต้องเติมก่อนอนุมัติ</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">EMCS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {cases.map((c) => {
            const src = SOURCE_LABEL[String(c.source ?? 'mobile')] ?? SOURCE_LABEL.mobile;
            const warns = Array.isArray(c.import_warnings) ? c.import_warnings : [];
            const photos = Number(c.photo_count ?? 0);
            const gaps = moneyGaps(c);
            const approved = c.status === 'reviewed';
            return (
            <tr key={c.id} onClick={() => router.push(`${basePath}/cases/${c.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
              <td className="px-5 py-4">
                <div className="text-sm text-gray-800">{c.claim_no || '-'}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.survey_job_no || '-'}
                  {/* Postgres คืน COUNT/ROW_NUMBER มาเป็นสตริง — ต้อง Number() ก่อนเทียบ */}
                  {Number(c.visit_count ?? 1) > 1 && <span className="ml-1">· ครั้งที่ {c.visit_count}</span>}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`px-2 py-0.5 rounded text-xs border ${src.cls}`}>{src.text}</span>
              </td>
              <td className="px-5 py-4 text-sm text-gray-600">
                {c.surveyor_first_name
                  ? `${c.surveyor_code ? c.surveyor_code + ' ' : ''}${c.surveyor_first_name}`
                  : <span className="text-amber-600 text-xs">ยังไม่ได้มอบหมาย</span>}
              </td>
              <td className="px-5 py-4">
                {approved ? (
                  <span className="text-xs text-green-700">
                    ✓ อนุมัติแล้ว{c.approved_by ? ` · ${c.approved_by}` : ''}
                  </span>
                ) : (warns.length + gaps.length === 0 && photos > LOW_PHOTO) ? (
                  <span className="text-xs text-green-700">✓ ครบ · {photos} รูป</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {gaps.map((g) => (
                      <span key={g} title={`ยังไม่ได้กรอก${g}`}
                        className="px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200">{g}</span>
                    ))}
                    {warns.map((w, i) => (
                      <span key={i} title={w}
                        className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">{warnChip(w)}</span>
                    ))}
                    {photos <= LOW_PHOTO && (
                      <span title="รูปน้อยผิดปกติ — ต้นทางอาจยังอัปไม่ครบ กด &quot;ดึงรูปใหม่&quot; ที่โปรแกรมผู้ตรวจ หรือเพิ่มรูปเองในหน้าเคส"
                        className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                        รูป {photos} ใบ
                      </span>
                    )}
                  </div>
                )}
                {(c.unlocked_count ?? 0) > 0 && (
                  <div className="text-xs text-gray-400 mt-1" title="เคสนี้เคยถูกปลดล็อกเพื่อแก้ไข">
                    ปลดล็อกมาแล้ว {c.unlocked_count} ครั้ง
                  </div>
                )}
              </td>
              <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                {(c.status === 'surveyed' || c.status === 'reviewed') ? (
                  c.emcs_imported_at ? (
                    // นำเข้า EMCS แล้ว (mark ถาวรใน DB) — ห้าม import ซ้ำ: EMCS จะสร้างเรื่องซ้ำที่เลขเคลมเดิม
                    // แต่ "นำเข้าแล้ว" ยังไม่ใช่ "ประกันได้รับงาน" — บอทสร้างได้แค่ draft
                    // ปุ่ม "ส่งงานใหม่" บน EMCS คนต้องกดเอง ป้ายจึงต้องแยก 2 สถานะ
                    c.emcs_submitted_at ? (
                      <span className="text-xs font-medium text-green-700"
                            title={`ส่งงานเมื่อ ${c.emcs_submitted_at}`}>✓ ส่งงานแล้ว</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700"
                            title={`สร้าง draft เมื่อ ${c.emcs_imported_at}`
                                   + (c.emcs_status_text ? ` · สถานะล่าสุด: ${c.emcs_status_text}` : '')}>
                        ⏳ draft ค้าง — รอกด &quot;ส่งงานใหม่&quot;
                      </span>
                    )
                  ) : sentIds.has(c.id) ? (
                    <span className="text-xs font-medium text-emerald-700">✓ ส่งเข้า AutoKey แล้ว</span>
                  ) : approved ? (
                    <button
                      onClick={() => sendToAutokey(c)}
                      disabled={busyId !== null}
                      title="ส่งให้โปรแกรม SE-AutoKey นำ XML เข้า EMCS (ต้องเปิดโปรแกรมบนเครื่องนี้ก่อน)"
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {busyId === c.id ? 'กำลังส่ง...' : '⚡ นำเข้า EMCS'}
                    </button>
                  ) : (
                    // ⛔ ยังไม่อนุมัติ = บอทดึงข้อมูลไม่ได้อยู่แล้ว (403 NOT_APPROVED)
                    // โชว์ปุ่มไว้เฉย ๆ จะทำให้กดแล้วเจอ error โดยไม่รู้สาเหตุ
                    <span className="text-xs text-gray-400">รออนุมัติก่อน</span>
                  )
                ) : (
                  <span className="text-gray-300 text-xs">-</span>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { getStatusBadge };
