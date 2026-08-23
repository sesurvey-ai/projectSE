'use client';

import { useState } from 'react';
import api from '@/lib/api';

/** ต้องตรงกับ PASSWORD_MIN / PASSWORD_RULE_TEXT ฝั่ง backend (services/password.ts) */
const MIN = 8;
const RULE = `อย่างน้อย ${MIN} ตัวอักษร · ห้ามเป็นชื่อผู้ใช้ · ห้ามเป็นคำที่เดาง่าย`;

/**
 * เปลี่ยนรหัสผ่านของตัวเอง — ใช้ได้ทุก role ที่เข้าเว็บ (แอดมิน · รับแจ้ง · ผู้ตรวจสอบ)
 *
 * ทำไมเป็นกล่องซ้อนไม่ใช่หน้าใหม่: แต่ละ role มี layout ของตัวเองที่กันคนนอก role ออก
 * ทำเป็นหน้า `/change-password` ต้องไปเพิ่ม route ในทุก layout หรือทำ layout ที่ 4
 * กล่องซ้อนบนแถบหัวที่ทุก role เห็นอยู่แล้วจบในที่เดียว
 */
export default function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr('');
    // ตรวจ "พิมพ์ยืนยันไม่ตรง" ที่นี่ — ไม่ต้องยิงไปให้เซิร์ฟเวอร์ตอบเรื่องที่หน้าเว็บรู้เอง
    if (next !== again) { setErr('รหัสผ่านใหม่กับช่องยืนยันไม่ตรงกัน'); return; }
    setBusy(true);
    try {
      await api.post('/api/auth/change-password', { current_password: cur, new_password: next });
      setDone(true);
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } } };
      setErr(ax.response?.data?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4"
      onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">เปลี่ยนรหัสผ่าน</h3>

        {done ? (
          <>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 my-3">
              เปลี่ยนรหัสผ่านเรียบร้อย — ครั้งต่อไปที่เข้าระบบให้ใช้รหัสใหม่
            </p>
            {/**
              * บอกตรง ๆ ว่าเครื่องอื่นยังไม่ถูกเตะออก — token เป็น JWT ไม่มีทะเบียนเพิกถอน
              * ปิดกล่องแล้วเงียบ ๆ จะทำให้เข้าใจผิดว่าเปลี่ยนรหัสแล้วเครื่องที่หายไปหลุดทันที
              */}
            <p className="text-xs text-gray-500 mb-4">
              เครื่องอื่นที่ล็อกอินค้างไว้จะยังใช้งานต่อได้จนกว่าจะออกจากระบบเอง —
              ถ้าสงสัยว่ามีคนอื่นเข้าถึงบัญชี ให้แจ้งผู้ดูแลระบบปิดบัญชีชั่วคราว
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900">ปิด</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">{RULE}</p>

            <label className="block text-sm text-gray-700 mb-1">รหัสผ่านเดิม</label>
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)}
              autoComplete="current-password"
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />

            <label className="block text-sm text-gray-700 mb-1">รหัสผ่านใหม่</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password" minLength={MIN}
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />

            <label className="block text-sm text-gray-700 mb-1">พิมพ์รหัสผ่านใหม่อีกครั้ง</label>
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)}
              autoComplete="new-password" minLength={MIN}
              onKeyDown={(e) => { if (e.key === 'Enter' && cur && next && again) submit(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />

            {err && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">ยกเลิก</button>
              <button type="button" onClick={submit} disabled={busy || !cur || !next || !again}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {busy ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
