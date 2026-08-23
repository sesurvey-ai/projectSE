'use client';

import { useState } from 'react';
import api from '@/lib/api';

/** ต้องตรงกับ PASSWORD_MIN / PASSWORD_RULE_TEXT ฝั่ง backend (services/password.ts) */
const MIN = 8;
const RULE = `อย่างน้อย ${MIN} ตัวอักษร · ห้ามเป็นชื่อผู้ใช้ · ห้ามเป็นคำที่เดาง่าย`;

interface Props {
  user: { id: number; username: string; first_name: string; last_name: string };
  onClose: () => void;
}

/**
 * แอดมินตั้งรหัสใหม่ให้คนอื่น (คนลืมรหัส / รับเครื่องต่อจากคนเก่า)
 *
 * ยิงไปที่ `PUT /api/admin/users/:id` ตัวเดิมที่รับ `password` อยู่แล้ว — ความสามารถนี้
 * มีมาตั้งแต่แรกแต่ซ่อนอยู่ในหน้าแก้ไขผู้ใช้ ต้องกดเข้าไปแล้วเลื่อนหา
 * ปุ่มในตารางทำให้เป็น 1 คลิก ซึ่งเป็นท่าที่จะใช้บ่อยตอนแจกบัญชีให้หัวหน้าหลายคน
 *
 * ⛔ ไม่ generate รหัสสุ่มให้ — แอดมินต้องอ่านรหัสให้เจ้าตัวทางโทรศัพท์/แชท
 *    รหัสสุ่มยาว ๆ จะถูกจดใส่กระดาษหรือส่งผิดห้องแชท ให้แอดมินตั้งเองแล้วบอกปากเปล่าดีกว่า
 */
export default function ResetPasswordDialog({ user, onClose }: Props) {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr('');
    if (pw !== again) { setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setBusy(true);
    try {
      await api.put(`/api/admin/users/${user.id}`, { password: pw });
      setDone(true);
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } } };
      setErr(ax.response?.data?.message || 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-800">ตั้งรหัสผ่านใหม่</h3>
        <p className="text-sm text-gray-600 mt-0.5 mb-4">
          {user.first_name} {user.last_name} <span className="text-gray-400">({user.username})</span>
        </p>

        {done ? (
          <>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
              ตั้งรหัสผ่านใหม่ให้ {user.username} แล้ว
            </p>
            <p className="text-xs text-gray-500 mb-4">
              บอกรหัสใหม่ให้เจ้าตัว แล้วให้เขาเปลี่ยนเป็นรหัสของตัวเองจากปุ่ม
              &quot;เปลี่ยนรหัสผ่าน&quot; มุมขวาบน — ระบบไม่ได้บังคับให้เปลี่ยน จึงต้องกำชับเอง
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900">ปิด</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">{RULE}</p>

            <label className="block text-sm text-gray-700 mb-1">รหัสผ่านใหม่</label>
            {/** ไม่ใช่ type="password" — แอดมินต้องอ่านรหัสไปบอกเจ้าตัว ปิดดาวไว้ยิ่งพิมพ์ผิด */}
            <input type="text" value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete="off" minLength={MIN}
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />

            <label className="block text-sm text-gray-700 mb-1">พิมพ์อีกครั้ง</label>
            <input type="text" value={again} onChange={(e) => setAgain(e.target.value)}
              autoComplete="off" minLength={MIN}
              onKeyDown={(e) => { if (e.key === 'Enter' && pw && again) submit(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />

            {err && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">ยกเลิก</button>
              <button type="button" onClick={submit} disabled={busy || !pw || !again}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {busy ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
