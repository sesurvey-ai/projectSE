'use client';

import PhotoGallery from './PhotoGallery';
import ReviewForm from '@/components/review/ReviewForm';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CaseDetailProps {
  caseData: any;
  report: any;
  photos: any[];
  review: any;
  onReviewSubmitted: () => void;
}

function formatDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatCurrency(v: number | null | undefined) { if (v == null) return '-'; return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(v); }

export default function CaseDetail({ caseData, report, photos, review, onReviewSubmitted }: CaseDetailProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">ข้อมูลเคส</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><span className="text-sm text-gray-500">รหัสเคส</span><p className="font-medium text-gray-800">#{caseData.id}</p></div>
          <div><span className="text-sm text-gray-500">ชื่อลูกค้า</span><p className="font-medium text-gray-800">{caseData.customer_name}</p></div>
          <div><span className="text-sm text-gray-500">สถานที่</span><p className="font-medium text-gray-800">{caseData.incident_location || caseData.location}</p></div>
          <div><span className="text-sm text-gray-500">วันที่สร้าง</span><p className="font-medium text-gray-800">{formatDate(caseData.created_at)}</p></div>
        </div>
      </div>

      {report && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">รายงานการสำรวจ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><span className="text-sm text-gray-500">รุ่นรถ</span><p className="font-medium text-gray-800">{report.car_model || '-'}</p></div>
            <div><span className="text-sm text-gray-500">สีรถ</span><p className="font-medium text-gray-800">{report.car_color || '-'}</p></div>
            <div><span className="text-sm text-gray-500">ทะเบียนรถ</span><p className="font-medium text-gray-800">{report.license_plate || '-'}</p></div>
          </div>
          {report.notes && <div className="mt-4"><span className="text-sm text-gray-500">หมายเหตุ</span><p className="font-medium text-gray-800 whitespace-pre-wrap mt-1">{report.notes}</p></div>}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">รูปภาพ</h3>
        <PhotoGallery photos={photos} />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">การตรวจสอบ</h3>
        {review ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">ตรวจสอบแล้ว</span>
            {review.comment && <div className="mt-3"><span className="text-sm text-gray-500">ความคิดเห็น</span><p className="text-gray-800 mt-1">{review.comment}</p></div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div><span className="text-sm text-gray-500">เสนอค่าบริการ</span><p className="font-medium text-gray-800">{formatCurrency(review.proposed_fee)}</p></div>
              <div><span className="text-sm text-gray-500">อนุมัติค่าบริการ</span><p className="font-medium text-gray-800">{formatCurrency(review.approved_fee)}</p></div>
            </div>
            {review.reviewed_at && <div className="mt-3 text-sm text-gray-400">ตรวจสอบเมื่อ {formatDate(review.reviewed_at)}</div>}
          </div>
        ) : (
          <ReviewForm caseId={caseData.id} onReviewSubmitted={onReviewSubmitted} />
        )}
      </div>
    </div>
  );
}
