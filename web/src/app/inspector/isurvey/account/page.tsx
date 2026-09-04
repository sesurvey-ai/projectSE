'use client';

/**
 * บัญชี ISURVEY ของฉัน — ให้เซิร์ฟเวอร์ใช้ดึงงาน "รอตรวจข้อมูล" เข้าเว็บด้วยบัญชีของคนที่กด (04/09/69)
 *
 * รหัสผ่านส่งขึ้นเซิร์ฟเวอร์ครั้งเดียวตอนบันทึก (เก็บเข้ารหัส) ไม่มีทางอ่านกลับจากหน้านี้
 * บันทึกแล้วระบบลองล็อกอินให้ทันที — ผิดรหัสจะรู้ตรงนี้ ไม่ใช่ตอนกดดึงงาน
 */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Cred = {
  username: string; display_name: string | null; updated_at: string;
  last_ok_at: string | null; last_error: string | null;
};

const stamp = (v: string | null) => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '');
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || 'เกิดข้อผิดพลาด';

export default function IsurveyAccountPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [cred, setCred] = useState<Cred | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/isurvey/credentials');
      setEnabled(Boolean(r.data?.data?.enabled));
      const c = (r.data?.data?.credentials ?? null) as Cred | null;
      setCred(c);
      if (c) setUsername(c.username);
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.put('/api/isurvey/credentials', { username, password }, { timeout: 60000 });
      const t = r.data?.data?.test as { ok: boolean; name?: string; error?: string };
      setPassword('');
      setMsg(t?.ok
        ? { ok: true, text: `บันทึกแล้ว · ล็อกอิน ISURVEY สำเร็จ${t.name ? ` (${t.name})` : ''}` }
        : { ok: false, text: `บันทึกแล้ว แต่ล็อกอิน ISURVEY ไม่ผ่าน: ${t?.error || 'ไม่ทราบสาเหตุ'}` });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.post('/api/isurvey/credentials/test', {}, { timeout: 60000 });
      const t = r.data?.data?.test as { ok: boolean; name?: string };
      setMsg({ ok: true, text: `ล็อกอิน ISURVEY สำเร็จ${t?.name ? ` (${t.name})` : ''}` });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
      await load();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('ลบบัญชี ISURVEY ที่เก็บไว้? (ดึงงานจาก ISURVEY ไม่ได้จนกว่าจะกรอกใหม่)')) return;
    setBusy(true); setMsg(null);
    try {
      await api.delete('/api/isurvey/credentials');
      setCred(null); setUsername(''); setPassword('');
      setMsg({ ok: true, text: 'ลบแล้ว' });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">บัญชี ISURVEY ของฉัน</h1>
      <p className="text-sm text-gray-600 mb-4">
        ใช้สำหรับให้ระบบดึงงาน &quot;รอตรวจข้อมูล&quot; ของคุณจาก ISURVEY เข้ามาตรวจที่นี่ (เมนู{' '}
        <Link href="/inspector/isurvey" className="text-blue-700 hover:underline">งานรอตรวจ (ISURVEY)</Link>) —
        รหัสผ่านถูกเก็บแบบเข้ารหัสบนเซิร์ฟเวอร์ และใช้เฉพาะตอนคุณกดดึงงานเท่านั้น
      </p>

      {enabled === false && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
          เซิร์ฟเวอร์ยังไม่ได้เปิดฟีเจอร์นี้ (ต้องตั้ง ISURVEY_SERVICE_URL / CRED_KEY) — บันทึกไว้ก่อนได้ แต่ยังดึงงานไม่ได้
        </div>
      )}

      <div className="bg-white border border-gray-200 p-4 space-y-3">
        {cred && (
          <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 px-3 py-2">
            <div>บัญชีที่เก็บไว้: <span className="font-semibold">{cred.username}</span>
              {cred.display_name ? <span className="text-gray-500"> · {cred.display_name}</span> : null}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              บันทึกเมื่อ {stamp(cred.updated_at)}
              {cred.last_ok_at ? ` · ล็อกอินสำเร็จล่าสุด ${stamp(cred.last_ok_at)}` : ' · ยังไม่เคยล็อกอินสำเร็จ'}
            </div>
            {cred.last_error && <div className="text-xs text-red-700 mt-0.5">ครั้งล่าสุดไม่ผ่าน: {cred.last_error}</div>}
          </div>
        )}

        <label className="block text-sm">
          <span className="text-gray-700">Username (ISURVEY)</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off"
            className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Password (ISURVEY){cred ? ' — กรอกใหม่เฉพาะตอนจะเปลี่ยน' : ''}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
            className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm" />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" disabled={busy || !username.trim() || !password} onClick={save}
            className="px-4 py-2 bg-[var(--md-blue)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'กำลังทำงาน…' : 'บันทึกและทดสอบล็อกอิน'}
          </button>
          {cred && (
            <button type="button" disabled={busy} onClick={test}
              className="px-4 py-2 border border-gray-300 bg-white text-sm disabled:opacity-50">ทดสอบล็อกอินอีกครั้ง</button>
          )}
          {cred && (
            <button type="button" disabled={busy} onClick={remove}
              className="ml-auto px-3 py-2 text-sm text-red-700 hover:underline disabled:opacity-50">ลบบัญชีที่เก็บไว้</button>
          )}
        </div>

        {msg && (
          <div className={`text-sm px-3 py-2 border ${msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {msg.text}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        ข้อควรรู้: ISURVEY จำกัด 1 การใช้งานต่อบัญชี — ระหว่างที่ระบบดึงงานด้วยบัญชีของคุณ หน้า ISURVEY ที่เปิดค้างไว้ในเบราว์เซอร์อาจหลุดชั่วคราว
      </p>
    </div>
  );
}
