'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const SectionHeader = ({ title, isOpen, onToggle }: { title: string; isOpen: boolean; onToggle: () => void }) => (
  <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
    <span className="text-sm font-semibold text-gray-700">{title}</span>
    <svg className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  </button>
);

const Field = ({ label, value, onChange, placeholder, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-red-500"> *</span>}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm" placeholder={placeholder} required={required} />
  </div>
);

export default function NewCasePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ข้อมูลหลัก (required)
  const [customerName, setCustomerName] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');

  // ข้อมูลเบื้องต้นจากใบเคลม
  const [form, setForm] = useState<Record<string, string>>({});
  const f = (key: string) => form[key] || '';
  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // ควบคุม section เปิด/ปิด
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));

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
      // เพิ่มข้อมูลเบื้องต้น (เฉพาะ field ที่มีค่า)
      for (const [key, val] of Object.entries(form)) {
        if (val.trim()) {
          if (key === 'deductible') {
            payload[key] = parseFloat(val) || 0;
          } else {
            payload[key] = val.trim();
          }
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">สร้างเคสใหม่</h1>
        <p className="text-gray-500 mt-1">กรอกข้อมูลผู้แจ้งเหตุและข้อมูลเบื้องต้นจากใบเคลม</p>
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* ข้อมูลหลัก */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">ข้อมูลหลัก</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="ชื่อลูกค้า / ผู้เอาประกัน" value={customerName} onChange={setCustomerName} placeholder="กรอกชื่อ-นามสกุล หรือ ชื่อบริษัท" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">บริษัทประกัน</label>
              <select value={insuranceCompany} onChange={(e) => setInsuranceCompany(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white text-sm">
                <option value="">เลือกบริษัทประกัน</option>
                <option value="ไอโออิกรุงเทพประกันภัย">ไอโออิกรุงเทพประกันภัย</option>
                <option value="บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)">บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)</option>
              </select>
            </div>
            <div>
              <Field label="สถานที่เกิดเหตุ" value={incidentLocation} onChange={setIncidentLocation} placeholder="กรอกสถานที่เกิดเหตุ" required />
            </div>
          </div>
        </div>

        {/* ข้อมูลเคลม */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <SectionHeader title="ข้อมูลเคลม" isOpen={!!openSections.claim} onToggle={() => toggle('claim')} />
          </div>
          {openSections.claim && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="เลขที่เคลม" value={f('claim_no')} onChange={v => set('claim_no', v)} placeholder="2026013124026" />
              <Field label="เลขรับแจ้ง" value={f('claim_ref_no')} onChange={v => set('claim_ref_no', v)} placeholder="2026051556" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ประเภทเคลม</label>
                <select value={f('claim_type')} onChange={(e) => set('claim_type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white text-sm">
                  <option value="">-- เลือก --</option>
                  <option value="F">เคลมสด (Fresh)</option>
                  <option value="D">เคลมแห้ง (Dry)</option>
                  <option value="A">นัดหมาย (Appointment)</option>
                  <option value="C">ติดตาม (Follow-up)</option>
                </select>
              </div>
              <Field label="สาขาประกัน" value={f('insurance_branch')} onChange={v => set('insurance_branch', v)} placeholder="กรุงเทพ" />
              <Field label="เลขที่งานสำรวจ" value={f('survey_job_no')} onChange={v => set('survey_job_no', v)} placeholder="SEABI-210260302833" />
              <Field label="บริษัทสำรวจ" value={f('survey_company')} onChange={v => set('survey_company', v)} placeholder="ชื่อบริษัทสำรวจ" />
              <div className="md:col-span-3">
                <Field label="ที่อยู่บริษัทสำรวจ" value={f('survey_company_address')} onChange={v => set('survey_company_address', v)} placeholder="ที่อยู่" />
              </div>
            </div>
          )}
        </div>

        {/* ข้อมูลรถ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <SectionHeader title="ข้อมูลรถ" isOpen={!!openSections.car} onToggle={() => toggle('car')} />
          </div>
          {openSections.car && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="ยี่ห้อ" value={f('car_brand')} onChange={v => set('car_brand', v)} placeholder="TOYOTA" />
              <Field label="รุ่น" value={f('car_model')} onChange={v => set('car_model', v)} placeholder="COMMUTER 2.8" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ประเภทรถ</label>
                <select value={f('car_type')} onChange={(e) => set('car_type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white text-sm">
                  <option value="">-- เลือก --</option>
                  <option value="A">เก๋งเอเชีย</option>
                  <option value="E">เก๋งยุโรป</option>
                  <option value="V">ตู้/แวน</option>
                  <option value="T">กระบะ</option>
                  <option value="W">รถบรรทุก</option>
                  <option value="M">จักรยานยนต์</option>
                  <option value="O">อื่นๆ</option>
                </select>
              </div>
              <Field label="สี" value={f('car_color')} onChange={v => set('car_color', v)} placeholder="ขาว" />
              <Field label="ทะเบียนรถ" value={f('license_plate')} onChange={v => set('license_plate', v)} placeholder="1นจ2922" />
              <Field label="จังหวัด" value={f('car_province')} onChange={v => set('car_province', v)} placeholder="กรุงเทพ ฯ" />
              <Field label="เลขตัวถัง" value={f('chassis_no')} onChange={v => set('chassis_no', v)} placeholder="MMKBBHCPX06523611" />
              <Field label="เลขเครื่องยนต์" value={f('engine_no')} onChange={v => set('engine_no', v)} placeholder="1GD5396358" />
              <Field label="ปีรถ" value={f('car_reg_year')} onChange={v => set('car_reg_year', v)} placeholder="2023" />
            </div>
          )}
        </div>

        {/* ข้อมูลกรมธรรม์ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <SectionHeader title="ข้อมูลกรมธรรม์" isOpen={!!openSections.policy} onToggle={() => toggle('policy')} />
          </div>
          {openSections.policy && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="เลขกรมธรรม์ (ภาคสมัครใจ)" value={f('policy_no')} onChange={v => set('policy_no', v)} placeholder="125013115911" />
              <Field label="ประเภทกรมธรรม์" value={f('policy_type')} onChange={v => set('policy_type', v)} placeholder="1" />
              <Field label="เลขกรมธรรม์ (พ.ร.บ.)" value={f('prb_number')} onChange={v => set('prb_number', v)} placeholder="125013326605" />
              <Field label="เริ่มต้นคุ้มครอง" value={f('policy_start')} onChange={v => set('policy_start', v)} placeholder="30/03/2568" />
              <Field label="สิ้นสุดคุ้มครอง" value={f('policy_end')} onChange={v => set('policy_end', v)} placeholder="30/03/2569" />
              <Field label="ค่าเสียหายส่วนแรก (Deductible)" value={f('deductible')} onChange={v => set('deductible', v)} placeholder="0" type="number" />
              <div className="md:col-span-3">
                <Field label="ชื่อผู้เอาประกัน" value={f('assured_name')} onChange={v => set('assured_name', v)} placeholder="บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง จำกัด" />
              </div>
            </div>
          )}
        </div>

        {/* ข้อมูลผู้ขับขี่ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <SectionHeader title="ข้อมูลผู้ขับขี่" isOpen={!!openSections.driver} onToggle={() => toggle('driver')} />
          </div>
          {openSections.driver && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="ชื่อ" value={f('driver_first_name')} onChange={v => set('driver_first_name', v)} placeholder="สรธัทร" />
              <Field label="นามสกุล" value={f('driver_last_name')} onChange={v => set('driver_last_name', v)} placeholder="พูนสวัสดิ์" />
              <Field label="เบอร์โทร" value={f('driver_phone')} onChange={v => set('driver_phone', v)} placeholder="0993166888" />
            </div>
          )}
        </div>

        {/* ข้อมูลอุบัติเหตุ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <SectionHeader title="ข้อมูลอุบัติเหตุ" isOpen={!!openSections.accident} onToggle={() => toggle('accident')} />
          </div>
          {openSections.accident && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="วันที่เกิดเหตุ" value={f('acc_date')} onChange={v => set('acc_date', v)} placeholder="23/03/2569" />
              <Field label="เวลา" value={f('acc_time')} onChange={v => set('acc_time', v)} placeholder="13:30" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ฝ่ายถูก/ผิด</label>
                <select value={f('acc_fault')} onChange={(e) => set('acc_fault', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white text-sm">
                  <option value="">-- เลือก --</option>
                  <option value="รถประกันผิด">รถประกันผิด</option>
                  <option value="คู่กรณีผิด">คู่กรณีผิด</option>
                  <option value="ประมาทร่วม">ประมาทร่วม</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <Field label="สถานที่เกิดเหตุ" value={f('acc_place')} onChange={v => set('acc_place', v)} placeholder="บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง ซ.ศูนย์วิจัย 8" />
              </div>
              <Field label="จังหวัด" value={f('acc_province')} onChange={v => set('acc_province', v)} placeholder="กรุงเทพฯ" />
              <Field label="เขต/อำเภอ" value={f('acc_district')} onChange={v => set('acc_district', v)} placeholder="เขตห้วยขวาง" />
              <Field label="สาเหตุ" value={f('acc_cause')} onChange={v => set('acc_cause', v)} placeholder="ชนวัสดุ/สิ่งของ" />
              <Field label="ลักษณะความเสียหาย" value={f('acc_damage_type')} onChange={v => set('acc_damage_type', v)} placeholder="เฉี่ยวชนวัสดุ" />
              <Field label="ผู้รับแจ้ง" value={f('acc_reporter')} onChange={v => set('acc_reporter', v)} placeholder="จินดา ชูศิลปกิจเจริญ (ABI)" />
              <Field label="วันเวลาที่รับแจ้ง" value={f('acc_insurance_notify_date')} onChange={v => set('acc_insurance_notify_date', v)} placeholder="24/03/2569|11:32" />
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">รายละเอียดเหตุการณ์</label>
                <textarea value={f('acc_detail')} onChange={(e) => set('acc_detail', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm" rows={3} placeholder="ป.เปิดประตูฝาท้ายไว้แล้วถอยชนเสา..." />
              </div>
            </div>
          )}
        </div>

        {/* หมายเหตุ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <SectionHeader title="หมายเหตุ" isOpen={!!openSections.notes} onToggle={() => toggle('notes')} />
          </div>
          {openSections.notes && (
            <div className="px-6 pb-6">
              <textarea value={f('notes')} onChange={(e) => set('notes', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm" rows={3} placeholder="หมายเหตุเพิ่มเติม..." />
            </div>
          )}
        </div>

        {/* ปุ่มส่ง */}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={submitting} className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'กำลังสร้างเคส...' : 'สร้างเคสและมอบหมายช่างสำรวจ'}
          </button>
        </div>
      </form>
    </div>
  );
}
