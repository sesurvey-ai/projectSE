'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function EditReviewPage() {
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id;

  const [form, setForm] = useState({
    comment: '',
    proposed_fee: '',
    approved_fee: '',
    status: '',
  });
  const [caseInfo, setCaseInfo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/reviews?limit=100`)
      .then((res) => {
        if (res.data.success) {
          const review = res.data.data.reviews.find((r: { id: number }) => r.id === Number(reviewId));
          if (review) {
            setForm({
              comment: review.comment || '',
              proposed_fee: review.proposed_fee != null ? String(review.proposed_fee) : '',
              approved_fee: review.approved_fee != null ? String(review.approved_fee) : '',
              status: review.status,
            });
            setCaseInfo(`เคส #${review.case_id} - ${review.customer_name}`);
          } else {
            setError('ไม่พบรีวิว');
          }
        }
      })
      .catch(() => setError('ไม่พบรีวิว'))
      .finally(() => setLoading(false));
  }, [reviewId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        comment: form.comment,
        status: form.status,
      };
      if (form.proposed_fee) payload.proposed_fee = Number(form.proposed_fee);
      if (form.approved_fee) payload.approved_fee = Number(form.approved_fee);

      const res = await api.put(`/api/admin/reviews/${reviewId}`, payload);
      if (res.data.success) {
        router.push('/admin/reviews');
      } else {
        setError(res.data.message || 'ไม่สามารถอัพเดทได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/reviews" className="text-blue-600 hover:underline text-sm">&larr; กลับไปรายการรีวิว</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">แก้ไขรีวิว #{reviewId}</h1>
        {caseInfo && <p className="text-gray-500 text-sm mt-1">{caseInfo}</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ความคิดเห็น</label>
            <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ค่าบริการเสนอ (บาท)</label>
              <input type="number" value={form.proposed_fee} onChange={(e) => setForm({ ...form, proposed_fee: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ค่าบริการอนุมัติ (บาท)</label>
              <input type="number" value={form.approved_fee} onChange={(e) => setForm({ ...form, approved_fee: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900">
              <option value="pending">รอตรวจสอบ</option>
              <option value="approved">อนุมัติแล้ว</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/reviews" className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium">ยกเลิก</Link>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
              {submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
