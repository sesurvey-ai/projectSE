'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import CaseDetail from '@/components/cases/CaseDetail';
import { type Case } from '@/components/cases/CaseList';
import { queueStats, type QueueStats } from '@/components/cases/reviewQueue';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState(null);
  const [report, setReport] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [review, setReview] = useState(null);
  const [visitCount, setVisitCount] = useState(1);
  const [expenses, setExpenses] = useState(null);
  // ชื่อคนที่มีอักขระซึ่ง EMCS จะล้างค่าทั้งช่องทิ้งตอนหัวหน้าคลิกโดน (backend คำนวณให้)
  const [nameWarnings, setNameWarnings] = useState<
    { tag: string; label: string; value: string; bad: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/cases/${caseId}/detail`);
      if (res.data.success) {
        setCaseData(res.data.data.case);
        setReport(res.data.data.report || null);
        setPhotos(res.data.data.photos || []);
        setReview(res.data.data.review || null);
        setVisitCount(res.data.data.visit_count || 1);
        setExpenses(res.data.data.expenses || null);
        setNameWarnings(res.data.data.emcs_name_warnings || []);
      }
    } catch { setError('ไม่สามารถโหลดข้อมูลเคสได้'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { if (caseId) fetchDetail(); }, [caseId, fetchDetail]);

  /**
   * แถบ "คิวตรวจวันนี้" — ผู้ตรวจเปิดเคสทีละใบทั้งวัน ถ้าไม่บอกตรงนี้
   * ต้องกดกลับไปหน้ารายการเพื่อดูว่าเหลือเท่าไหร่ (ดีไซน์ใหม่ให้เห็นตลอด)
   * พังก็ไม่เป็นไร — เป็นข้อมูลประกอบ ไม่ใช่ของที่ต้องมีถึงจะตรวจเคสได้
   */
  const [queue, setQueue] = useState<QueueStats | null>(null);
  useEffect(() => {
    api.get('/api/cases/review')
      .then((res) => { if (res.data?.success) setQueue(queueStats(res.data.data as Case[])); })
      .catch(() => {});
  }, []);

  // ดาวน์โหลด INSERT_SURV_REPORT_XML เพื่อ import เข้าพอร์ทัลประกัน
  const [xmlBusy, setXmlBusy] = useState(false);
  const downloadXml = async () => {
    try {
      setXmlBusy(true);
      const res = await api.get(`/api/cases/${caseId}/export-xml`, { responseType: 'blob' });
      const claim = (report as { claim_no?: string } | null)?.claim_no || caseId;
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `survey_${claim}.xml`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setError('สร้างไฟล์ XML ไม่สำเร็จ (เคสนี้อาจยังไม่มีข้อมูลรายงาน)'); }
    finally { setXmlBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">กำลังโหลดข้อมูลเคส...</div></div>;
  if (error || !caseData) return (
    <div>
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error || 'ไม่พบข้อมูลเคส'}</div>
      <button onClick={() => router.push('/inspector')} className="text-blue-600 hover:text-blue-800 text-sm">กลับไปรายการงาน</button>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => router.push('/inspector')} className="text-gray-500 hover:text-gray-700">&larr; กลับ</button>
        <h2 className="text-2xl font-bold text-gray-800">รายละเอียดเคส #{(caseData as { id: number }).id}</h2>
        {report && (
          <button onClick={downloadXml} disabled={xmlBusy}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            title="สร้างไฟล์ XML สำหรับ import เข้าพอร์ทัลประกัน">
            {xmlBusy ? 'กำลังสร้าง...' : '⬇ ดาวน์โหลด XML (นำเข้าประกัน)'}
          </button>
        )}
      </div>
      {queue && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <span className="text-xs font-semibold tracking-wide text-gray-400">คิวตรวจวันนี้</span>
          <button type="button" onClick={() => router.push('/inspector')}
            className="flex items-baseline gap-2 hover:underline">
            <span className="text-xs text-gray-500">รอตรวจ</span>
            <span className="text-lg font-semibold text-gray-800">{queue.pending}</span>
          </button>
          <button type="button" onClick={() => router.push('/inspector')}
            className="flex items-baseline gap-2 hover:underline">
            <span className={`text-xs ${queue.incomplete > 0 ? 'text-amber-700' : 'text-gray-500'}`}>ติดปัญหา</span>
            <span className={`text-lg font-semibold ${queue.incomplete > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{queue.incomplete}</span>
          </button>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-gray-500">อนุมัติแล้ววันนี้</span>
            <span className="text-lg font-semibold text-gray-800">{queue.approvedToday}</span>
          </div>
        </div>
      )}
      {nameWarnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            ⚠️ ชื่อ {nameWarnings.length} รายการมีอักขระที่ EMCS ไม่รับ
          </p>
          <p className="mt-1 text-xs text-amber-800">
            EMCS จะ<strong>ลบข้อความทั้งช่องทิ้ง</strong>ทันทีที่มีคนคลิกเข้า-ออกช่องนั้น
            (ไม่ใช่แค่ตัดอักขระ) แก้ที่นี่ก่อนส่งเข้า EMCS — ใช้ได้เฉพาะตัวอักษร ตัวเลข เว้นวรรค จุด และขีดกลาง
          </p>
          <ul className="mt-2 space-y-1">
            {nameWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-900">
                <span className="font-medium">{w.label}</span>
                <span className="mx-1 text-amber-700">—</span>
                <span className="rounded bg-white px-1 py-0.5 font-mono">{w.value}</span>
                <span className="ml-1 text-amber-700">(อักขระที่มีปัญหา: <strong>{w.bad}</strong>)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CaseDetail caseData={caseData} report={report} photos={photos} review={review} visitCount={visitCount} expenses={expenses} onReviewSubmitted={fetchDetail} />
    </div>
  );
}
