'use client';

/**
 * ลูกทีมของฉัน — รายชื่อช่าง/บริษัท OSS ในสังกัดของหัวหน้าผู้ตรวจที่ล็อกอินอยู่ (อ่านอย่างเดียว, 04/09/69)
 * แก้ไขได้เฉพาะแอดมินที่ /admin/staff-groups · รายชื่อชุดนี้ใช้กรองหน้า "งานรอตรวจ (ISURVEY)"
 */
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';

type Member = { id: number; staff_name: string; staff_code: string | null; surveyor_id: number | null; surveyor_name?: string | null; surveyor_active?: boolean | null };
type Group = { id: number; name: string; members: Member[] };

export default function MyTeamPage() {
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/staff-groups/mine')
      .then((r) => setGroup((r.data?.data ?? null) as Group | null))
      .catch((e) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'โหลดไม่ได้'));
  }, []);

  const staff = (group?.members ?? []).filter((m) => m.staff_code);
  const oss = (group?.members ?? []).filter((m) => !m.staff_code);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">ลูกทีมของฉัน</h1>
      <p className="text-sm text-gray-600 mb-4">
        รายชื่อในสังกัดของคุณ — หน้า &quot;งานรอตรวจ (ISURVEY)&quot; จะแสดงเฉพาะงานของคนเหล่านี้ · แก้ไขรายชื่อได้เฉพาะแอดมิน
      </p>
      {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2">{error}</div>}
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
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="px-3 py-2 text-left">รหัส</th><th className="px-3 py-2 text-left">ชื่อ (ตามทะเบียน ISURVEY)</th><th className="px-3 py-2 text-left">ในทะเบียนพนักงาน se-survey</th></tr>
              </thead>
              <tbody>
                {staff.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap">{m.staff_code}</td>
                    <td className="px-3 py-1.5">{m.staff_name.replace(/^\S+\s*/, '')}</td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {m.surveyor_id ? <span className={m.surveyor_active === false ? 'text-gray-400' : ''}>{m.surveyor_name}{m.surveyor_active === false ? ' (ปิดใช้งาน)' : ''}</span> : <span className="text-amber-700">ไม่พบรหัสนี้ในทะเบียน</span>}
                    </td>
                  </tr>
                ))}
                {oss.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-400">OSS</td>
                    <td className="px-3 py-1.5" colSpan={2}>{m.staff_name}</td>
                  </tr>
                ))}
                {group.members.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">ยังไม่มีสมาชิกในทีม</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
