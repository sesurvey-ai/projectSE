'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewCasePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');

  const [form, setForm] = useState<Record<string, string>>({});
  const f = (key: string) => form[key] || '';
  const s = (key: string, v: string) => setForm(prev => ({ ...prev, [key]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        customer_name: customerName,
        incident_location: incidentLocation,
      };
      if (insuranceCompany) payload.insurance_company = insuranceCompany;
      for (const [key, val] of Object.entries(form)) {
        if (val.trim()) {
          payload[key] = key === 'deductible' ? (parseFloat(val) || 0) : val.trim();
        }
      }
      const res = await api.post('/api/cases', payload);
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

  const L = 'bg-gray-50 px-2 py-1 text-[11px] text-gray-500 font-medium whitespace-nowrap border border-gray-200';
  const V = 'px-1 py-0.5 border border-gray-200';
  const I = 'w-full text-[12px] text-gray-900 outline-none bg-transparent px-1 py-0.5';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <div className="flex items-center">
          <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">1</div>
          <span className="ml-2 text-sm font-medium text-blue-600">ข้อมูลเคส</span>
        </div>
        <div className="flex-1 mx-4 h-px bg-gray-200"></div>
        <div className="flex items-center">
          <div className="w-7 h-7 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center text-xs font-medium">2</div>
          <span className="ml-2 text-sm text-gray-400">มอบหมาย</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="text-red-600 text-xs mb-3 bg-red-50 px-3 py-2 rounded">{error}</div>}

        {/* บริษัทประกัน — ด้านบนตาราง */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">บริษัทประกัน</label>
          <select value={insuranceCompany} onChange={e => setInsuranceCompany(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white text-sm">
            <option value="">-- เลือกบริษัทประกัน --</option>
            <option value="ไอโออิกรุงเทพประกันภัย">ไอโออิกรุงเทพประกันภัย</option>
            <option value="บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)">บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)</option>
          </select>
        </div>

        {/* ไอโออิ → ตาราง */}
        {insuranceCompany === 'ไอโออิกรุงเทพประกันภัย' && (
          <>
            <table className="w-full border-collapse border border-gray-200 bg-white text-[12px]">
              <tbody>
                <tr>
                  <td className={L}>เลขรับแจ้ง</td>
                  <td className={V}><input value={f('claim_ref_no')} onChange={e => s('claim_ref_no', e.target.value)} className={I} placeholder="2026051556" /></td>
                  <td className={L}>เลขที่เคลม</td>
                  <td className={V} colSpan={3}><input value={f('claim_no')} onChange={e => s('claim_no', e.target.value)} className={I} placeholder="2026013124026" /></td>
                </tr>
                <tr>
                  <td className={L}>ผู้รับแจ้ง</td>
                  <td className={V}><input value={f('acc_reporter')} onChange={e => s('acc_reporter', e.target.value)} className={I} placeholder="จินดา ชูศิลปกิจเจริญ (ABI)" /></td>
                  <td className={L}>วันที่รับแจ้ง</td>
                  <td className={V}><input value={f('acc_insurance_notify_date')} onChange={e => s('acc_insurance_notify_date', e.target.value)} className={I} placeholder="24/03/2569|11:32" /></td>
                  <td className={L}>วันที่เกิดเหตุ</td>
                  <td className={V}><input value={f('acc_date')} onChange={e => s('acc_date', e.target.value)} className={I} placeholder="23/03/2569 13:30" /></td>
                </tr>
                <tr>
                  <td className={L}>ประเภทเคลม</td>
                  <td className={V}>
                    <select value={f('claim_type')} onChange={e => s('claim_type', e.target.value)} className={`${I} bg-transparent`}>
                      <option value="">-</option>
                      <option value="F">สด</option>
                      <option value="D">แห้ง</option>
                      <option value="A">นัดหมาย</option>
                      <option value="C">ติดตาม</option>
                    </select>
                  </td>
                  <td className={L}>เวลาเกิดเหตุ</td>
                  <td className={V}><input value={f('acc_time')} onChange={e => s('acc_time', e.target.value)} className={I} placeholder="13:30" /></td>
                  <td className={L}>เบอร์โทรผู้แจ้ง</td>
                  <td className={V}><input value={f('reporter_phone')} onChange={e => s('reporter_phone', e.target.value)} className={I} placeholder="0993166888" /></td>
                </tr>
                <tr>
                  <td className={L}>สาขาประกัน</td>
                  <td className={V} colSpan={5}><input value={f('insurance_branch')} onChange={e => s('insurance_branch', e.target.value)} className={I} placeholder="กรุงเทพ" /></td>
                </tr>
                <tr>
                  <td className={L}>บริษัทสำรวจ</td>
                  <td className={V} colSpan={3}><input value={f('survey_company')} onChange={e => s('survey_company', e.target.value)} className={I} placeholder="บริษัท เอลอี เซอร์เวย์ แอนด์ คอนซัลแทนท์ จำกัด" /></td>
                  <td className={L}>เลขที่งาน</td>
                  <td className={V}><input value={f('survey_job_no')} onChange={e => s('survey_job_no', e.target.value)} className={I} placeholder="SEABI-xxxx" /></td>
                </tr>
                <tr>
                  <td className={L}>ทะเบียนรถ</td>
                  <td className={V}><input value={f('license_plate')} onChange={e => s('license_plate', e.target.value)} className={I} placeholder="1นจ2922" /></td>
                  <td className={L}>ยี่ห้อ</td>
                  <td className={V}><input value={f('car_brand')} onChange={e => s('car_brand', e.target.value)} className={I} placeholder="TOYOTA" /></td>
                  <td className={L}>รุ่น</td>
                  <td className={V}><input value={f('car_model')} onChange={e => s('car_model', e.target.value)} className={I} placeholder="COMMUTER 2.8" /></td>
                </tr>
                <tr>
                  <td className={L}>เลขตัวถัง</td>
                  <td className={V} colSpan={2}><input value={f('chassis_no')} onChange={e => s('chassis_no', e.target.value)} className={I} placeholder="MMKBBHCPX06523611" /></td>
                  <td className={L}>เลขเครื่องยนต์</td>
                  <td className={V}><input value={f('engine_no')} onChange={e => s('engine_no', e.target.value)} className={I} placeholder="1GD5396358" /></td>
                  <td className={`${L} text-center`}>
                    <select value={f('car_type')} onChange={e => s('car_type', e.target.value)} className={`${I} bg-transparent`}>
                      <option value="">ประเภท</option>
                      <option value="A">เก๋ง</option>
                      <option value="V">ตู้</option>
                      <option value="T">กระบะ</option>
                      <option value="W">บรรทุก</option>
                      <option value="M">จยย.</option>
                      <option value="O">อื่นๆ</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className={L}>สี</td>
                  <td className={V}><input value={f('car_color')} onChange={e => s('car_color', e.target.value)} className={I} placeholder="ขาว" /></td>
                  <td className={L}>ปีรถ</td>
                  <td className={V}><input value={f('car_reg_year')} onChange={e => s('car_reg_year', e.target.value)} className={I} placeholder="2023" /></td>
                  <td className={L}>จังหวัด</td>
                  <td className={V}><input value={f('car_province')} onChange={e => s('car_province', e.target.value)} className={I} placeholder="กรุงเทพ ฯ" /></td>
                </tr>
                <tr>
                  <td className={L}>ชื่อผู้ขับขี่</td>
                  <td className={V} colSpan={2}>
                    <div className="flex gap-1">
                      <input value={f('driver_first_name')} onChange={e => s('driver_first_name', e.target.value)} className={I} placeholder="ชื่อ" />
                      <input value={f('driver_last_name')} onChange={e => s('driver_last_name', e.target.value)} className={I} placeholder="นามสกุล" />
                    </div>
                  </td>
                  <td className={L}>เบอร์โทรผู้ขับขี่</td>
                  <td className={V} colSpan={2}><input value={f('driver_phone')} onChange={e => s('driver_phone', e.target.value)} className={I} placeholder="0993166888" /></td>
                </tr>
                <tr>
                  <td className={L}>สถานที่เกิดเหตุ *</td>
                  <td className={V} colSpan={5}><input value={incidentLocation} onChange={e => { setIncidentLocation(e.target.value); s('acc_place', e.target.value); }} className={`${I} font-medium`} placeholder="บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง ซ.ศูนย์วิจัย 8" required /></td>
                </tr>
                <tr>
                  <td className={L}>ตำบล</td>
                  <td className={V}><input value={f('acc_place')} onChange={e => s('acc_place', e.target.value)} className={I} placeholder="บางกะปิ" /></td>
                  <td className={L}>อำเภอ</td>
                  <td className={V}><input value={f('acc_district')} onChange={e => s('acc_district', e.target.value)} className={I} placeholder="เขตห้วยขวาง" /></td>
                  <td className={L}>จังหวัด</td>
                  <td className={V}><input value={f('acc_province')} onChange={e => s('acc_province', e.target.value)} className={I} placeholder="กรุงเทพฯ" /></td>
                </tr>
                <tr>
                  <td className={L}>ลักษณะการเกิดเหตุ</td>
                  <td className={V} colSpan={3}><input value={f('acc_cause')} onChange={e => s('acc_cause', e.target.value)} className={I} placeholder="ชนวัสดุ/สิ่งของ เช่น เสา,กำแพง,ประตู ฯลฯ" /></td>
                  <td className={L}>ฝ่ายถูก/ผิด</td>
                  <td className={V}>
                    <select value={f('acc_fault')} onChange={e => s('acc_fault', e.target.value)} className={`${I} bg-transparent`}>
                      <option value="">-</option>
                      <option value="รถประกันผิด">รถประกันผิด</option>
                      <option value="คู่กรณีผิด">คู่กรณีผิด</option>
                      <option value="ประมาทร่วม">ประมาทร่วม</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className={L}>เลขกรมธรรม์</td>
                  <td className={V}><input value={f('policy_no')} onChange={e => s('policy_no', e.target.value)} className={I} placeholder="125013115911" /></td>
                  <td className={L}>ประเภท</td>
                  <td className={V}><input value={f('policy_type')} onChange={e => s('policy_type', e.target.value)} className={I} placeholder="1" /></td>
                  <td className={L}>ผู้เอาประกัน *</td>
                  <td className={V}><input value={customerName} onChange={e => { setCustomerName(e.target.value); s('assured_name', e.target.value); }} className={`${I} font-medium`} placeholder="ชื่อ / บริษัท" required /></td>
                </tr>
                <tr>
                  <td className={L}>เริ่มคุ้มครอง</td>
                  <td className={V}><input value={f('policy_start')} onChange={e => s('policy_start', e.target.value)} className={I} placeholder="30/03/2568" /></td>
                  <td className={L}>สิ้นสุด</td>
                  <td className={V}><input value={f('policy_end')} onChange={e => s('policy_end', e.target.value)} className={I} placeholder="30/03/2569" /></td>
                  <td className={L}>พ.ร.บ.</td>
                  <td className={V}><input value={f('prb_number')} onChange={e => s('prb_number', e.target.value)} className={I} placeholder="125013326605" /></td>
                </tr>
                <tr>
                  <td className={L}>หมายเหตุ</td>
                  <td className={V} colSpan={5}>
                    <textarea value={f('acc_detail')} onChange={e => s('acc_detail', e.target.value)} className={`${I} resize-none`} rows={2} placeholder="ป.เปิดประตูฝาท้ายไว้แล้วถอยชนเสา มีแจ้งเพิ่ม..." />
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end mt-4">
              <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? 'กำลังสร้าง...' : 'สร้างเคสและมอบหมาย'}
              </button>
            </div>
          </>
        )}

        {/* ไทยไพบูลย์ → ฟอร์ม 3 field เดิม */}
        {insuranceCompany === 'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อ-นามสกุลผู้เกิดเหตุ <span className="text-red-500">*</span></label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm" placeholder="กรอกชื่อ-นามสกุล" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">สถานที่เกิดเหตุ <span className="text-red-500">*</span></label>
              <input type="text" value={incidentLocation} onChange={e => setIncidentLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm" placeholder="กรอกสถานที่เกิดเหตุ" required />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? 'กำลังสร้างเคส...' : 'สร้างเคสและมอบหมายช่างสำรวจ'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
