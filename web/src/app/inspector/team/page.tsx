'use client';

/**
 * ลูกทีมของฉัน — รายชื่อช่าง/บริษัท OSS ในสังกัดของหัวหน้าผู้ตรวจที่ล็อกอินอยู่ (04/09/69)
 * 09/09/69: หัวหน้าเพิ่ม/เอาออกเองได้ (เดิมอ่านอย่างเดียว แก้ได้แค่แอดมิน) ผ่าน /api/staff-groups/mine/members
 * ผูกบัญชีกับทีม/สร้างทีม ยังเป็นของแอดมินที่ /admin/staff-groups · รายชื่อชุดนี้ใช้กรองหน้า "งานรอตรวจ (ISURVEY)" + "รายการงาน"
 */
import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

const errMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

type Member = { id: number; staff_name: string; staff_code: string | null; surveyor_id: number | null; surveyor_name?: string | null; surveyor_active?: boolean | null };
type Group = { id: number; name: string; members: Member[] };

export default function MyTeamPage() {
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [newMember, setNewMember] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => api.get('/api/staff-groups/mine')
    .then((r) => setGroup((r.data?.data ?? null) as Group | null))
    .catch((e) => setError(errMsg(e, 'โหลดไม่ได้'))), []);
  useEffect(() => { void load(); }, [load]);

  /** เพิ่มด้วยข้อความเต็มแบบเดียวกับ ISURVEY ("SEC343 นาย มี …") หรือชื่อบริษัท OSS — backend แยกรหัส/จับคู่ทะเบียนให้ */
  const addMember = async () => {
    const name = newMember.trim();
    if (!name || busy) return;
    setBusy(true); setNote(''); setError('');
    try {
      const r = await api.post('/api/staff-groups/mine/members', { staff_name: name });
      setGroup((r.data?.data ?? null) as Group | null);
      setNewMember('');
      setNote(`เพิ่ม "${name}" แล้ว`);
    } catch (e) { setError(errMsg(e, 'เพิ่มไม่สำเร็จ')); }
    finally { setBusy(false); }
  };
  const removeMember = async (m: Member) => {
    if (busy || !window.confirm(`เอา "${m.staff_name}" ออกจากทีม? งานของคนนี้จะไม่แสดงในรายการของคุณอีก`)) return;
    setBusy(true); setNote(''); setError('');
    try {
      const r = await api.delete(`/api/staff-groups/mine/members/${m.id}`);
      setGroup((r.data?.data ?? null) as Group | null);
      setNote(`เอา "${m.staff_name}" ออกแล้ว`);
    } catch (e) { setError(errMsg(e, 'เอาออกไม่สำเร็จ')); }
    finally { setBusy(false); }
  };

  const staff = (group?.members ?? []).filter((m) => m.staff_code);
  const oss = (group?.members ?? []).filter((m) => !m.staff_code);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">ลูกทีมของฉัน</h1>
      <p className="text-sm text-gray-600 mb-4">
        รายชื่อในสังกัดของคุณ — หน้า &quot;งานรอตรวจ (ISURVEY)&quot; และ &quot;รายการงาน&quot; จะแสดงเฉพาะงานของคนเหล่านี้ · เพิ่ม/เอาออกได้เองที่นี่
      </p>
      {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2">{error}</div>}
      {note && <div className="mb-3 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2">{note}</div>}
      {group === undefined && !error && <div className="text-sm text-gray-500">กำลังโหลด…</div>}
      {group === null && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
          บัญชีของคุณยังไม่ได้ผูกกับทีมใด — หน้า &quot;งานรอตรวจ (ISURVEY)&quot; จึงแสดงงานทั้งหมด · แจ้งแอดมินให้ผูกทีมที่ &quot;จัดการทีมผู้ตรวจ&quot;
        </div>
      )}
      {group && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 p-4">
            <div className="text-sm text-gray-500">ทีม</div>
            <div className="text-lg font-semibold text-gray-800">{group.name}</div>
            <div className="text-xs text-gray-500 mt-1">ช่าง {staff.length} คน · บริษัท OSS {oss.length}</div>
          </div>
          <div className="bg-white border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">เพิ่มลูกทีม</div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addMember(); }}>
              <input value={newMember} onChange={(e) => setNewMember(e.target.value)} disabled={busy}
                placeholder='พิมพ์แบบเดียวกับ ISURVEY: "SEC343 นาย มี วงษ์สุวรรณ" หรือชื่อบริษัท OSS'
                className="flex-1 border border-gray-300 rounded-none px-3 py-1.5 text-sm" />
              <button type="submit" disabled={busy || !newMember.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-none disabled:opacity-50">เพิ่ม</button>
            </form>
            <div className="text-xs text-gray-500 mt-1">
              รหัสนำหน้าชื่อ (SE/SEC…) ใช้จับคู่งานของช่าง · ชื่อบริษัทใช้จับคู่งานของช่างนอก (OSS) · รายชื่อที่อยู่ทีมอื่นอยู่แล้วต้องให้ทีมเดิมหรือแอดมินเอาออกก่อน
            </div>
          </div>
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="px-3 py-2 text-left">รหัส</th><th className="px-3 py-2 text-left">ชื่อ (ตามทะเบียน ISURVEY)</th><th className="px-3 py-2 text-left">ในทะเบียนพนักงาน se-survey</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {staff.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap">{m.staff_code}</td>
                    <td className="px-3 py-1.5">{m.staff_name.replace(/^\S+\s*/, '')}</td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {m.surveyor_id ? <span className={m.surveyor_active === false ? 'text-gray-400' : ''}>{m.surveyor_name}{m.surveyor_active === false ? ' (ปิดใช้งาน)' : ''}</span> : <span className="text-amber-700">ไม่พบรหัสนี้ในทะเบียน</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <button type="button" onClick={() => void removeMember(m)} disabled={busy}
                        className="text-xs text-red-700 border border-red-200 rounded-none px-2 py-0.5 hover:bg-red-50 disabled:opacity-50">เอาออก</button>
                    </td>
                  </tr>
                ))}
                {oss.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-400">OSS</td>
                    <td className="px-3 py-1.5" colSpan={2}>{m.staff_name}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <button type="button" onClick={() => void removeMember(m)} disabled={busy}
                        className="text-xs text-red-700 border border-red-200 rounded-none px-2 py-0.5 hover:bg-red-50 disabled:opacity-50">เอาออก</button>
                    </td>
                  </tr>
                ))}
                {group.members.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">ยังไม่มีสมาชิกในทีม</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
