'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Case {
  id: number;
  customer_name: string;
  status: string;
  claim_no?: string;
  survey_job_no?: string;
  claim_ref_no?: string;
  surveyor_first_name?: string;
  surveyor_last_name?: string;
  visit_count?: number;
  created_at: string;
}
interface CaseListProps { cases: Case[]; basePath?: string; }

// ตัวรับงานคือโปรแกรม SE-AutoKey ที่รันบนเครื่องผู้ตรวจ (webui, พอร์ต 8765)
// — หน้าเว็บสั่ง EMCS ตรงไม่ได้ (คนละ origin) จึงส่งงานให้โปรแกรมบนเครื่องเป็นคนขับ EMCS แทน
// (เรียก http://127.0.0.1 จากหน้า https ได้ — เบราว์เซอร์ยกเว้น mixed-content ให้ loopback)
const AUTOKEY_URL = 'http://127.0.0.1:8765';

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
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขเคลม</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขเซอร์เวย์</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขรับแจ้ง</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ช่างสำรวจ</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ครั้งที่</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">EMCS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {cases.map((c) => (
            <tr key={c.id} onClick={() => router.push(`${basePath}/cases/${c.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
              <td className="px-5 py-4">{getStatusBadge(c.status)}</td>
              <td className="px-5 py-4 text-sm text-gray-700">{c.claim_no || '-'}</td>
              <td className="px-5 py-4 text-sm text-gray-700">{c.survey_job_no || '-'}</td>
              <td className="px-5 py-4 text-sm text-gray-700">{c.claim_ref_no || '-'}</td>
              <td className="px-5 py-4 text-sm text-gray-700">
                {c.surveyor_first_name ? `${c.surveyor_first_name} ${c.surveyor_last_name || ''}` : '-'}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{c.visit_count || 1}</td>
              <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                {(c.status === 'surveyed' || c.status === 'reviewed') ? (
                  sentIds.has(c.id) ? (
                    <span className="text-xs font-medium text-emerald-700">✓ ส่งเข้า AutoKey แล้ว</span>
                  ) : (
                    <button
                      onClick={() => sendToAutokey(c)}
                      disabled={busyId !== null}
                      title="ส่งให้โปรแกรม SE-AutoKey นำ XML เข้า EMCS (ต้องเปิดโปรแกรมบนเครื่องนี้ก่อน)"
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {busyId === c.id ? 'กำลังส่ง...' : '⚡ นำเข้า EMCS'}
                    </button>
                  )
                ) : (
                  <span className="text-gray-300 text-xs">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
