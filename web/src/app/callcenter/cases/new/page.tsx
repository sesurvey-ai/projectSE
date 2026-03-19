'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewCasePage() {
  const [customerName, setCustomerName] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/cases', {
        customer_name: customerName,
        incident_location: incidentLocation,
      });
      if (res.data.success && res.data.data) {
        router.push(`/callcenter/cases/${res.data.data.id}/assign`);
      } else {
        setError(res.data.message || 'ไม่สามารถสร้างเคสได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">สร้างเคสใหม่</h1>
        <p className="text-gray-500 mt-1">กรอกข้อมูลผู้แจ้งเหตุและสถานที่เกิดเหตุ</p>
      </div>
      <div className="flex items-center mb-8">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
          <span className="ml-2 text-sm font-medium text-blue-600">ข้อมูลเคส</span>
        </div>
        <div className="flex-1 mx-4 h-px bg-gray-300"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">2</div>
          <span className="ml-2 text-sm text-gray-500">มอบหมายช่างสำรวจ</span>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อ-นามสกุลผู้เกิดเหตุ</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" placeholder="กรอกชื่อ-นามสกุล" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">สถานที่เกิดเหตุ</label>
            <input type="text" value={incidentLocation} onChange={(e) => setIncidentLocation(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" placeholder="กรอกสถานที่เกิดเหตุ" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? 'กำลังสร้างเคส...' : 'สร้างเคสและมอบหมายช่างสำรวจ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
