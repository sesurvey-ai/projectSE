'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Row {
  id: number;
  username: string;
  code: string | null;
  first_name: string;
  last_name: string;
  has_token: boolean;
  /** ครั้งล่าสุดที่แจ้งเตือน "ถึงเครื่องจริง" (เครื่องตอบรับกลับมา) — null = ยังไม่เคย */
  last_push_ok: string | null;
}

interface Readiness {
  total: number;
  ready: number;
  not_ready: number;
  surveyors: Row[];
}

const fullName = (r: Row) =>
  `${r.code ? `${r.code} ` : ''}${r.first_name || ''} ${r.last_name || ''}`.trim() || r.username;

/** วันเวลาไทยแบบสั้น — ค่าที่ได้เป็น TIMESTAMPTZ จึงแปลงโซนได้ถูกต้อง */
const thaiDateTime = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  });
};

export default function NotificationReadinessPage() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/api/users/notification-readiness')
      .then((res) => { if (res.data.success) setData(res.data.data); else setError(res.data.message || 'โหลดข้อมูลไม่สำเร็จ'); })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const notReady = data?.surveyors.filter((s) => !s.has_token) ?? [];
  const ready = data?.surveyors.filter((s) => s.has_token) ?? [];

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ความพร้อมรับแจ้งเตือน</h1>
          <p className="text-gray-500 text-sm mt-1">
            ใครรับแจ้งเตือนงานใหม่บนมือถือได้บ้าง — คนที่ยังไม่พร้อม <strong>จ่ายงานไปก็ไม่มีอะไรขึ้นบนเครื่องเลย</strong>
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">ผู้สำรวจที่ใช้งานอยู่</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{data.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <p className="text-xs text-gray-500">พร้อมรับแจ้งเตือน</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{data.ready}</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${data.not_ready > 0 ? 'border-amber-300' : 'border-gray-200'}`}>
              <p className="text-xs text-gray-500">ยังไม่พร้อม</p>
              <p className={`text-2xl font-bold mt-1 ${data.not_ready > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{data.not_ready}</p>
            </div>
          </div>

          {notReady.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
              <h2 className="font-semibold text-amber-900 mb-1">
                ⚠️ {notReady.length} คนยังไม่ลงทะเบียนรับแจ้งเตือน
              </h2>
              <p className="text-sm text-amber-800 mb-3">
                เครื่องจะลงทะเบียนให้เองทุกครั้งที่เปิดแอป — ที่ยังไม่มีมักแปลว่า
                <strong> ยังไม่เคยเปิดแอปเวอร์ชันใหม่บนเครื่องนั้น</strong> ให้ติดต่อไปขอให้ติดตั้งและเปิดแอปหนึ่งครั้ง
              </p>
              <div className="bg-white rounded-lg border border-amber-200 divide-y divide-amber-100 max-h-[420px] overflow-y-auto">
                {notReady.map((s) => (
                  <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{fullName(s)}</span>
                    <span className="text-xs text-gray-400">{s.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h2 className="px-4 py-3 font-semibold text-gray-800 text-sm border-b border-gray-200">
              พร้อมรับแจ้งเตือน ({ready.length})
            </h2>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {ready.map((s) => {
                const last = thaiDateTime(s.last_push_ok);
                return (
                  <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{fullName(s)}</span>
                      <span className="text-xs text-gray-400 ml-2">{s.username}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {last ? `แจ้งเตือนถึงเครื่องล่าสุด ${last}` : 'ยังไม่เคยมีงานที่ยืนยันว่าถึงเครื่อง'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            &ldquo;แจ้งเตือนถึงเครื่องล่าสุด&rdquo; นับจากงานที่เครื่องช่างตอบรับกลับมาจริง ไม่ใช่แค่ส่งออกจากระบบ ·
            งานที่จ่ายก่อนเปิดใช้ระบบตอบรับจะยังไม่มีค่านี้
          </p>
        </>
      )}
    </div>
  );
}
