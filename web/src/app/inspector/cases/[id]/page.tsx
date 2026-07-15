'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import CaseDetail from '@/components/cases/CaseDetail';

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
      }
    } catch { setError('ไม่สามารถโหลดข้อมูลเคสได้'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { if (caseId) fetchDetail(); }, [caseId, fetchDetail]);

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
      <CaseDetail caseData={caseData} report={report} photos={photos} review={review} visitCount={visitCount} expenses={expenses} onReviewSubmitted={fetchDetail} />
    </div>
  );
}
