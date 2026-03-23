'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface ReviewFormProps { caseId: number; onReviewSubmitted: () => void; }

export default function ReviewForm({ caseId, onReviewSubmitted }: ReviewFormProps) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [proposedFee, setProposedFee] = useState('');
  const [approvedFee, setApprovedFee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const res = await api.post(`/api/cases/${caseId}/review`, {
        comment, proposed_fee: proposedFee ? Number(proposedFee) : undefined, approved_fee: approvedFee ? Number(approvedFee) : undefined,
      });
      if (res.data.success) {
        setSuccess(true);
        onReviewSubmitted();
        setTimeout(() => { router.push('/inspector'); }, 2000);
      }
      else setError(res.data.message || 'ส่งการตรวจสอบไม่สำเร็จ');
    } catch { setError('เกิดข้อผิดพลาดในการส่งการตรวจสอบ'); }
    finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-6 rounded-lg text-center">
        <p className="text-lg font-medium">บันทึกเรียบร้อยแล้ว</p>
        <p className="text-sm mt-1 text-green-600">กำลังกลับไปหน้ารายการงาน...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition">
          {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}
