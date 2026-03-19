'use client';

import { useState, FormEvent } from 'react';
import api from '@/lib/api';

interface ReviewFormProps { caseId: number; onReviewSubmitted: () => void; }

export default function ReviewForm({ caseId, onReviewSubmitted }: ReviewFormProps) {
  const [comment, setComment] = useState('');
  const [proposedFee, setProposedFee] = useState('');
  const [approvedFee, setApprovedFee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const res = await api.post(`/api/cases/${caseId}/review`, {
        comment, proposed_fee: proposedFee ? Number(proposedFee) : undefined, approved_fee: approvedFee ? Number(approvedFee) : undefined,
      });
      if (res.data.success) onReviewSubmitted();
      else setError(res.data.message || 'ส่งการตรวจสอบไม่สำเร็จ');
    } catch { setError('เกิดข้อผิดพลาดในการส่งการตรวจสอบ'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ความคิดเห็น</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-vertical" placeholder="กรอกความคิดเห็น..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เสนอค่าบริการ (บาท)</label>
          <input type="number" value={proposedFee} onChange={(e) => setProposedFee(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" min="0" step="0.01" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">อนุมัติค่าบริการ (บาท)</label>
          <input type="number" value={approvedFee} onChange={(e) => setApprovedFee(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" min="0" step="0.01" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition">
          {submitting ? 'กำลังส่ง...' : 'อนุมัติ'}
        </button>
      </div>
    </form>
  );
}
