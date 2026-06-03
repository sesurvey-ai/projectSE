'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';

interface Station { id: number; name: string; region: 'bkk' | 'upc'; }
interface Surveyor { id: number; username: string; first_name?: string; last_name?: string; phone?: string; }
interface Slot {
  id: number; station_id: number; station_name: string; region: string;
  kind: 'rotate' | 'fix'; rotate_offset: number | null; fixed_shift: string | null;
  user_id: number | null; first_name?: string; last_name?: string;
  weekly_off: number | null; note: string | null;
}

// 5 เวร: เวร1-3 = หมุน (rotate_offset 0-2 ของเดือนตั้งต้น), Fix1-2 = คงที่
const SHIFT_OPTS = [
  { val: 'shift1', label: 'เวร 1 (07-15)' },
  { val: 'shift2', label: 'เวร 2 (15-23)' },
  { val: 'shift3', label: 'เวร 3 (23-07)' },
  { val: 'fix1', label: 'Fix 1 (07-16)' },
  { val: 'fix2', label: 'Fix 2 (14-23)' },
];
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const slotToShiftVal = (s: Slot) =>
  s.kind === 'fix' ? (s.fixed_shift || '') : ['shift1', 'shift2', 'shift3'][s.rotate_offset ?? 0];

const shiftValToFields = (val: string): Pick<Slot, 'kind' | 'rotate_offset' | 'fixed_shift'> => {
  const idx = ['shift1', 'shift2', 'shift3'].indexOf(val);
  return idx >= 0
    ? { kind: 'rotate', rotate_offset: idx, fixed_shift: null }
    : { kind: 'fix', rotate_offset: null, fixed_shift: val };
};

const slotBody = (s: Slot) => ({
  station_id: s.station_id, kind: s.kind,
  rotate_offset: s.kind === 'rotate' ? s.rotate_offset : null,
  fixed_shift: s.kind === 'fix' ? s.fixed_shift : null,
  user_id: s.user_id, weekly_off: s.weekly_off, note: s.note,
});

export default function AdminDutyRosterPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [stationId, setStationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSlot, setNewSlot] = useState({ shiftVal: 'shift1', user_id: '', weekly_off: '', note: '' });

  const load = useCallback(async () => {
    const [st, sv, sl] = await Promise.all([
      api.get('/api/duty/stations'), api.get('/api/duty/surveyors'), api.get('/api/duty/slots'),
    ]);
    setStations(st.data.data); setSurveyors(sv.data.data); setSlots(sl.data.data);
    setStationId((prev) => prev ?? (st.data.data[0]?.id ?? null));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stationSlots = useMemo(() => slots.filter((s) => s.station_id === stationId), [slots, stationId]);
  const station = stations.find((s) => s.id === stationId);

  const svName = (sv: Surveyor) => (sv.first_name ? `${sv.first_name} ${sv.last_name || ''}`.trim() : sv.username);

  const patchSlot = async (id: number, changes: Partial<Slot>) => {
    const next = { ...slots.find((s) => s.id === id)!, ...changes };
    setSlots((prev) => prev.map((s) => (s.id === id ? next : s)));
    try { await api.put(`/api/duty/slots/${id}`, slotBody(next)); } catch { load(); }
  };

  const addSlot = async () => {
    if (!stationId) return;
    const f = shiftValToFields(newSlot.shiftVal);
    await api.post('/api/duty/slots', {
      station_id: stationId, ...f,
      user_id: newSlot.user_id ? Number(newSlot.user_id) : null,
      weekly_off: newSlot.weekly_off === '' ? null : Number(newSlot.weekly_off),
      note: newSlot.note || null,
    });
    setNewSlot({ shiftVal: 'shift1', user_id: '', weekly_off: '', note: '' });
    load();
  };

  const removeSlot = async (id: number) => {
    if (!confirm('ลบสล๊อตนี้?')) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
    try { await api.delete(`/api/duty/slots/${id}`); } catch { load(); }
  };

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none';

  if (loading) return <div className="text-gray-500">กำลังโหลด…</div>;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">จัดตารางเวรประจำจุด</h1>
        <p className="text-gray-500 text-sm mt-1">
          กำหนด “สล๊อต” ต่อจุด → ใส่พนักงาน + เวร + วันหยุด · เวร1-3 หมุนอัตโนมัติทุกเดือน (เดือนตั้งต้น <b>มิ.ย. 2569</b>) · Fix คงที่
        </p>
      </div>

      {/* เลือกจุด */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-700">จุดประจำ</label>
        <select className={sel} value={stationId ?? ''} onChange={(e) => setStationId(Number(e.target.value))}>
          <optgroup label="กรุงเทพฯ–ปริมณฑล">
            {stations.filter((s) => s.region === 'bkk').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
          <optgroup label="ต่างจังหวัด">
            {stations.filter((s) => s.region === 'upc').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        </select>
        <span className="text-sm text-gray-400">{stationSlots.length} สล๊อต</span>
      </div>

      {/* สล๊อตของจุดนี้ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">เวร</th>
              <th className="px-4 py-2.5 font-medium">พนักงาน</th>
              <th className="px-4 py-2.5 font-medium">วันหยุดประจำ</th>
              <th className="px-4 py-2.5 font-medium">หมายเหตุ</th>
              <th className="px-4 py-2.5 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stationSlots.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <select className={sel} value={slotToShiftVal(s)} onChange={(e) => patchSlot(s.id, shiftValToFields(e.target.value))}>
                    {SHIFT_OPTS.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select className={sel} value={s.user_id ?? ''} onChange={(e) => patchSlot(s.id, { user_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— ว่าง —</option>
                    {surveyors.map((sv) => <option key={sv.id} value={sv.id}>{svName(sv)}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select className={sel} value={s.weekly_off ?? ''} onChange={(e) => patchSlot(s.id, { weekly_off: e.target.value === '' ? null : Number(e.target.value) })}>
                    <option value="">— ไม่ระบุ —</option>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input className={`${sel} w-full`} defaultValue={s.note ?? ''} placeholder="—" onBlur={(e) => { if (e.target.value !== (s.note ?? '')) patchSlot(s.id, { note: e.target.value || null }); }} />
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => removeSlot(s.id)} className="text-red-500 hover:text-red-700 text-lg leading-none" title="ลบ">✕</button>
                </td>
              </tr>
            ))}
            {stationSlots.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">ยังไม่มีสล๊อตในจุดนี้ — เพิ่มด้านล่าง</td></tr>
            )}
          </tbody>
          {/* เพิ่มสล๊อต */}
          <tfoot className="bg-gray-50/60 border-t border-gray-200">
            <tr>
              <td className="px-4 py-2.5">
                <select className={sel} value={newSlot.shiftVal} onChange={(e) => setNewSlot({ ...newSlot, shiftVal: e.target.value })}>
                  {SHIFT_OPTS.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <select className={sel} value={newSlot.user_id} onChange={(e) => setNewSlot({ ...newSlot, user_id: e.target.value })}>
                  <option value="">— ว่าง —</option>
                  {surveyors.map((sv) => <option key={sv.id} value={sv.id}>{svName(sv)}</option>)}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <select className={sel} value={newSlot.weekly_off} onChange={(e) => setNewSlot({ ...newSlot, weekly_off: e.target.value })}>
                  <option value="">— ไม่ระบุ —</option>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <input className={`${sel} w-full`} value={newSlot.note} placeholder="หมายเหตุ" onChange={(e) => setNewSlot({ ...newSlot, note: e.target.value })} />
              </td>
              <td className="px-4 py-2.5 text-center">
                <button onClick={addSlot} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap">+ เพิ่ม</button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        เปลี่ยนพนักงานในสล๊อต = แก้ช่อง “พนักงาน” (สล๊อตยังหมุนเวรตามเดิม) · การแก้ไขบันทึกอัตโนมัติ
      </p>
    </div>
  );
}
