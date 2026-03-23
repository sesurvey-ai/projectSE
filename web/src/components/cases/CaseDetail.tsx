'use client';

import { useState, useRef } from 'react';
import PhotoGallery from './PhotoGallery';
import ReviewForm from '@/components/review/ReviewForm';
import { PROVINCE_OPTIONS, CAR_BRAND_OPTIONS, CAR_COLOR_OPTIONS, EV_TYPE_OPTIONS, BANGKOK_DISTRICT_OPTIONS, ACC_CAUSE_OPTIONS, ACC_DAMAGE_TYPE_OPTIONS } from './caseOptions';
import api from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CaseDetailProps {
  caseData: any;
  report: any;
  photos: any[];
  review: any;
  onReviewSubmitted: () => void;
}

function formatDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function parseDatetime(val: string | null) {
  if (!val) return { date: '', hour: '', minute: '' };
  const parts = val.split('|');
  const date = parts[0] || '';
  const time = parts[1] || '';
  const [hour, minute] = time.split(':');
  return { date, hour: hour || '', minute: minute || '' };
}
function formatCurrency(v: number | null | undefined) { if (v == null) return '-'; return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(v); }

const CLAIM_TYPE_LABELS: Record<string, string> = { F: 'เคลมสด', D: 'เคลมแห้ง', A: 'งานนัดหมาย', C: 'งานติดตาม' };
const DAMAGE_LEVEL_COLORS: Record<string, string> = { 'หนัก': 'bg-red-100 text-red-800', 'เบา': 'bg-green-100 text-green-800' };

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <p className="font-medium text-gray-800">{value || '-'}</p>
    </div>
  );
}

const ColGroup = () => (
  <colgroup>
    <col style={{ width: '16%' }} />
    <col style={{ width: '34%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '34%' }} />
  </colgroup>
);

export default function CaseDetail({ caseData, report, photos, review, onReviewSubmitted }: CaseDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const d = !isEditing;

  const handleSave = async () => {
    if (!formRef.current) return;
    setSaving(true); setSaveMsg('');
    try {
      const fd = new FormData(formRef.current);
      const data: Record<string, string> = {};
      fd.forEach((val, key) => { data[key] = val as string; });
      // Handle checkbox group: acc_claim_opponent (multiple values → comma-separated)
      const opponents = fd.getAll('acc_claim_opponent').map(v => String(v));
      data['acc_claim_opponent'] = opponents.join(',');
      // Handle checkbox: car_lost (unchecked = not in FormData)
      data['car_lost'] = fd.has('car_lost') ? 'true' : 'false';
      const res = await api.put(`/api/cases/${caseData.id}/report`, { report_data: data });
      if (res.data.success) { setSaveMsg('บันทึกสำเร็จ'); setIsEditing(false); onReviewSubmitted(); setTimeout(() => setSaveMsg(''), 3000); }
      else setSaveMsg('บันทึกไม่สำเร็จ: ' + (res.data.message || ''));
    } catch { setSaveMsg('เกิดข้อผิดพลาดในการบันทึก'); }
    finally { setSaving(false); }
  };

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {report && (
        <>
          {/* รายละเอียดรถยนต์ — header + ข้อมูลบริษัท/เคลม (แบบตาราง) */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            {/* Header bar with claim type & damage level */}
            <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-bold">::: รายละเอียดรถยนต์</span>
              <span className="ml-auto font-bold">ประเภทเคลม :</span>
              <span className="text-red-400">*</span>
              {['F','D','A','C'].map(v => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="claim_type" value={v} disabled={d} defaultChecked={report.claim_type === v} className="peer sr-only" />
                  <span className="w-4 h-4 rounded-full border-2 border-white/50 peer-checked:border-white peer-checked:bg-white peer-checked:shadow-[inset_0_0_0_2px_#0174BE] shrink-0"></span>
                  <span className="opacity-70 peer-checked:opacity-100 peer-checked:font-semibold">{CLAIM_TYPE_LABELS[v]}</span>
                </label>
              ))}
              <span className="font-bold ml-4">รถเสียหาย :</span>
              {['หนัก','เบา'].map(v => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="damage_level" value={v} disabled={d} defaultChecked={report.damage_level === v} className="peer sr-only" />
                  <span className="w-4 h-4 rounded-full border-2 border-white/50 peer-checked:border-white peer-checked:bg-white peer-checked:shadow-[inset_0_0_0_2px_#0174BE] shrink-0"></span>
                  <span className="opacity-70 peer-checked:opacity-100 peer-checked:font-semibold">{v}</span>
                </label>
              ))}
              <label className="flex items-center gap-1.5 ml-2 cursor-pointer relative">
                <input type="checkbox" name="car_lost" value="true" disabled={d} defaultChecked={!!report.car_lost} className="peer sr-only" />
                <span className="w-4 h-4 rounded border-2 border-white/50 peer-checked:border-white peer-checked:bg-white shrink-0"></span>
                <svg className="absolute left-[3px] w-2.5 h-2.5 text-blue-700 hidden peer-checked:block pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span className="opacity-70 peer-checked:opacity-100 peer-checked:font-semibold">รถหาย</span>
              </label>
            </div>
            {/* Table rows */}
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">บริษัทผู้จัดเรื่อง :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.survey_company || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_date || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ที่อยู่ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.survey_company_address || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">เบอร์โทรศัพท์/เบอร์ Fax</td>
                  <td className="px-4 py-2 text-gray-800">{report.survey_company_phone || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">บริษัทประกัน :</td>
                  <td className="px-4 py-2 overflow-hidden">
                    <div className="flex items-center gap-1">
                      <select disabled={d} name="insurance_company" defaultValue={report.insurance_company || '0'} className={`min-w-0 flex-1 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option value="0">-- ระบุ --</option>
                        <option value="ประกันภัยทดสอบ">ประกันภัยทดสอบ</option>
                        <option value="บริษัท เดอะ วัน ประกันภัย จำกัด (มหาชน)">บริษัท เดอะ วัน ประกันภัย จำกัด (มหาชน)</option>
                        <option value="ไอโออิกรุงเทพประกันภัย">ไอโออิกรุงเทพประกันภัย</option>
                        <option value="ฟอลคอนประกันภัย จำกัด (มหาชน)">ฟอลคอนประกันภัย จำกัด (มหาชน)</option>
                        <option value="บริษัท อลิอันซ์ อยุธยา ประกันภัย จำกัด (มหาชน)">บริษัท อลิอันซ์ อยุธยา ประกันภัย จำกัด (มหาชน)</option>
                        <option value="บริษัท เจมาร์ท ประกันภัย จํากัด (มหาชน)">บริษัท เจมาร์ท ประกันภัย จํากัด (มหาชน)</option>
                        <option value="บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)">บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)</option>
                      </select>
                      <select disabled={d} name="insurance_branch" defaultValue={report.insurance_branch || 'กรุงเทพ'} className={`w-[90px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option value="0">-- ระบุ --</option>
                        <option value="กรุงเทพ">กรุงเทพ</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">เลขเรื่องเซอร์เวย์ :</td>
                  <td className="px-4 py-2">
                    <input type="text" disabled={d} name="survey_job_no" defaultValue={report.survey_job_no || ''} placeholder="SEABI-110260301037" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">เลขที่รับแจ้ง :</td>
                  <td className="px-4 py-2">
                    <input type="text" disabled={d} name="claim_ref_no" defaultValue={report.claim_ref_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                  </td>
                  <td className="px-4 py-2 text-gray-500">เลขที่เคลม :</td>
                  <td className="px-4 py-2">
                    <input type="text" disabled={d} name="claim_no" defaultValue={report.claim_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* กรมธรรม์ — แบบตาราง */}
          {(
            <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
              <table className="w-full table-fixed">
                <ColGroup />
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">กรมธรรม์(พรบ.) :</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-gray-500 shrink-0"><input type="checkbox" disabled={d} checked={!!report.prb_number} className="w-3.5 h-3.5" /> มี (พรบ.)</label>
                        <input type="text" disabled={d} name="prb_number" defaultValue={report.prb_number || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500">กรมธรรม์เลขที่ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="policy_no" defaultValue={report.policy_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ชื่อผู้ขับขี่ตามกรมธรรม์ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_by_policy" defaultValue={report.driver_by_policy || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">วันที่เริ่มต้น :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="policy_start" defaultValue={report.policy_start || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">วันที่สิ้นสุด :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="policy_end" defaultValue={report.policy_end || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ผู้เอาประกันภัย :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="assured_name" defaultValue={report.assured_name || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">ประกันประเภท :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="policy_type" defaultValue={report.policy_type || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">อีเมลผู้เอาประกัน :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="assured_email" defaultValue={report.assured_email || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">รหัสภัยยานยนต์ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="risk_code" defaultValue={report.risk_code || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ค่าเสียหายส่วนแรก :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="deductible" defaultValue={report.deductible != null ? Number(report.deductible).toFixed(2) : '0.00'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* รายละเอียดรถยนต์ — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">หมายเลขทะเบียน :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="license_plate" defaultValue={report.license_plate || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">จังหวัด :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_province" defaultValue={report.car_province || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ประเภทรถ :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_type" defaultValue={report.car_type || '0'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      <option value="0">-- ระบุ --</option>
                      <option value="เก็งเอเชีย">เก๋งเอเชีย</option>
                      <option value="เก๋งยุโรป">เก๋งยุโรป</option>
                      <option value="รถจักรยานยนต์">รถจักรยานยนต์</option>
                      <option value="รถอื่นๆ">รถอื่นๆ</option>
                      <option value="กระบะ">กระบะ</option>
                      <option value="รถตู้">รถตู้</option>
                      <option value="รถบรรทุก">รถบรรทุก</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-500">ยี่ห้อ :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_brand" defaultValue={report.car_brand || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {CAR_BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">รุ่น :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="car_model" defaultValue={report.car_model || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">สีรถ :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_color" defaultValue={report.car_color || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {CAR_COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ปีจดทะเบียนรถ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="car_reg_year" defaultValue={report.car_reg_year || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ประเภทรถยนต์ไฟฟ้า :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="ev_type" defaultValue={report.ev_type || '0'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {EV_TYPE_OPTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">หมายเลขตัวถัง :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="chassis_no" defaultValue={report.chassis_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">หมายเลข Model :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="model_no" defaultValue={report.model_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">หมายเลขเครื่อง :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="engine_no" defaultValue={report.engine_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">หมายเลข กม. :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="mileage" defaultValue={report.mileage != null ? Number(report.mileage).toLocaleString() : ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ข้อมูลผู้ขับขี่ — แบบตาราง */}
          {(
            <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
              <table className="w-full table-fixed">
                <ColGroup />
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ผู้ขับขี่รถประกันภัย :</td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-gray-500 shrink-0"><input type="radio" name="driver_gender" value="M" disabled={d} defaultChecked={report.driver_gender === 'M'} className="w-3.5 h-3.5" /> ชาย</label>
                        <label className="flex items-center gap-1 text-gray-500 shrink-0"><input type="radio" name="driver_gender" value="F" disabled={d} defaultChecked={report.driver_gender === 'F'} className="w-3.5 h-3.5" /> หญิง</label>
                        <select disabled={d} name="driver_title" defaultValue={report.driver_title || '0'} className={`w-[80px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          <option value="0">--</option>
                          <option value="นางสาว">นางสาว</option>
                          <option value="นาง">นาง</option>
                          <option value="นาย">นาย</option>
                        </select>
                        <span className="text-gray-500 shrink-0">ชื่อ</span>
                        <input type="text" disabled={d} name="driver_first_name" defaultValue={report.driver_first_name || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        <span className="text-gray-500 shrink-0">นามสกุล</span>
                        <input type="text" disabled={d} name="driver_last_name" defaultValue={report.driver_last_name || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความสัมพันธ์กับเจ้าของรถ :</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                    <td className="px-4 py-2">
                      <select disabled={d} name="driver_relation" defaultValue={report.driver_relation || '0'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option value="0">-- ระบุ --</option>
                        <option value="เจ้าของรถ">เจ้าของรถ</option>
                        <option value="ญาติ">ญาติ</option>
                        <option value="ลูกจ้าง">ลูกจ้าง</option>
                        <option value="ผู้ยืม">ผู้ยืม</option>
                        <option value="อื่นๆ">อื่นๆ</option>
                      </select>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">อายุ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_age" defaultValue={report.driver_age != null ? report.driver_age : ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">วันเกิด :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_birthdate" defaultValue={report.driver_birthdate || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">ที่อยู่ปัจจุบัน :</td>
                    <td className="px-4 py-2" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <input type="text" disabled={d} name="driver_address" defaultValue={report.driver_address || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        <select disabled={d} name="driver_province" defaultValue={report.driver_province || '0'} className={`w-[100px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select disabled={d} name="driver_district" defaultValue={report.driver_district || '0'} className={`w-[100px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          <option value="0">เขต/อำเภอ</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">โทรศัพท์ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_phone" defaultValue={report.driver_phone || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">บัตรประชาชนเลขที่ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_id_card" defaultValue={report.driver_id_card || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ใบอนุญาตขับขี่เลขที่ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_license_no" defaultValue={report.driver_license_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ประเภท :</td>
                    <td className="px-4 py-2">
                      <select disabled={d} name="driver_license_type" defaultValue={report.driver_license_type || '0'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option value="0">-- ระบุ --</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ">ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคล">ใบขับขี่รถยนต์ส่วนบุคคล</option>
                        <option value="ใบขับขี่รถจักรยานยนต์">ใบขับขี่รถจักรยานยนต์</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-gray-500">ออกให้ที่ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_license_place" defaultValue={report.driver_license_place || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">ออกให้วันที่ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_license_start" defaultValue={report.driver_license_start || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">หมดอายุวันที่ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_license_end" defaultValue={report.driver_license_end || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ใบสั่ง :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_ticket" defaultValue={''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความเสียหายรถประกันภัย :</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button disabled={d} className="px-3 py-1 border border-gray-400 rounded bg-gray-200 text-gray-700 text-sm whitespace-nowrap">ข้อมูลความเสียหาย</button>
                        <button disabled={d} className="px-3 py-1 border border-gray-400 rounded bg-gray-200 text-gray-700 text-sm whitespace-nowrap">พิมพ์ข้อมูลความเสียหาย</button>
                      </div>
                    </td>
                    <td className="px-4 py-2" colSpan={2}><textarea disabled={d} name="damage_description" defaultValue={report.damage_description || ''} rows={2} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ความเสียหายประมาณ :</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input type="text" disabled={d} name="estimated_cost" defaultValue={report.estimated_cost != null ? Number(report.estimated_cost).toFixed(2) : ''} className={`w-[150px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        <span className="text-gray-500">บาท</span>
                      </div>
                    </td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ===== รายละเอียดอุบัติเหตุ — แบบตาราง ===== */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            {/* Header bar */}
            <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
              <span className="font-bold">::: รายละเอียดอุบัติเหตุ</span>
            </div>
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่เกิดเหตุและเวลาประมาณ :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex items-center gap-2">
                      <input type="text" disabled={d} name="acc_date" defaultValue={report.acc_date || ''} className={`w-[130px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_time_hour" defaultValue={report.acc_time ? report.acc_time.split(':')[0] : ''} className={`w-[40px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_time_minute" defaultValue={report.acc_time ? report.acc_time.split(':')[1] : ''} className={`w-[40px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">สถานที่เกิดเหตุ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_place" defaultValue={report.acc_place || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2" colSpan={2}>
                    <div className="flex items-center gap-1">
                      <select disabled={d} name="acc_province" defaultValue={report.acc_province || '0'} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select disabled={d} name="acc_district" defaultValue={report.acc_district || '-- เขต --'} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        {BANGKOK_DISTRICT_OPTIONS.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ลักษณะการเกิดเหตุ :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_cause" defaultValue={report.acc_cause || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {ACC_CAUSE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ลักษณะความเสียหาย :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_damage_type" defaultValue={report.acc_damage_type || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {ACC_DAMAGE_TYPE_OPTIONS.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 align-top">รายละเอียดการเกิดเหตุ :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <textarea disabled={d} name="acc_detail" defaultValue={report.acc_detail || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm min-h-[80px]`} rows={4} />
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ฝ่ายประมาท :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รถประกันเป็นฝ่ายผิด" disabled={d} defaultChecked={report.acc_fault === 'รถประกันเป็นฝ่ายผิด'} className="w-3.5 h-3.5" /> รถประกันเป็นฝ่ายผิด</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รถประกันเป็นฝ่ายถูกและผิด" disabled={d} defaultChecked={report.acc_fault === 'รถประกันเป็นฝ่ายถูกและผิด'} className="w-3.5 h-3.5" /> รถประกันเป็นฝ่ายถูกและผิด</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รถคู่กรณีเป็นฝ่ายผิด" disabled={d} defaultChecked={report.acc_fault === 'รถคู่กรณีเป็นฝ่ายผิด'} className="w-3.5 h-3.5" /> รถคู่กรณีเป็นฝ่ายผิด</label>
                      <span className="text-gray-500">คู่กรณีคันที่</span>
                      <input type="text" disabled={d} name="acc_fault_opponent_no" defaultValue={''} className={`w-[40px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ประมาทร่วม" disabled={d} defaultChecked={report.acc_fault === 'ประมาทร่วม'} className="w-3.5 h-3.5" /> ประมาทร่วม</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รอสรุปผลคดี" disabled={d} defaultChecked={report.acc_fault === 'รอสรุปผลคดี'} className="w-3.5 h-3.5" /> รอสรุปผลคดี</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ยกเลิกการเคลม" disabled={d} defaultChecked={report.acc_fault === 'ยกเลิกการเคลม'} className="w-3.5 h-3.5" /> ยกเลิกการเคลม</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ไปถึง แล้วไม่พบ" disabled={d} defaultChecked={report.acc_fault === 'ไปถึง แล้วไม่พบ'} className="w-3.5 h-3.5" /> ไปถึง แล้วไม่พบ</label>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ผู้แจ้ง :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_reporter" defaultValue={report.acc_reporter || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">ผู้สำรวจภัย :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_surveyor" defaultValue={report.acc_surveyor || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <select disabled={d} name="acc_surveyor_branch" className={`w-[70px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option>-- ระบุ --</option>
                      </select>
                      <span className="text-gray-500 shrink-0">โทรศัพท์ :</span>
                      <input type="text" disabled={d} name="acc_surveyor_phone" defaultValue={report.acc_surveyor_phone || ''} className={`w-[80px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                    </div>
                  </td>
                </tr>
                {(() => { const cr = parseDatetime(report.acc_customer_report_date); const ins = parseDatetime(report.acc_insurance_notify_date); return (
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่ลูกค้าแจ้ง บ.ประกัน :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_customer_report_date_val" defaultValue={cr.date} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_customer_report_hour" defaultValue={cr.hour} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_customer_report_minute" defaultValue={cr.minute} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่ บ.ประกันแจ้งสำรวจภัย :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_insurance_notify_date_val" defaultValue={ins.date} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_insurance_notify_hour" defaultValue={ins.hour} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_insurance_notify_minute" defaultValue={ins.minute} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                </tr>
                ); })()}
                {(() => { const arr = parseDatetime(report.acc_survey_arrive_date); const comp = parseDatetime(report.acc_survey_complete_date); return (
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่สำรวจภัย(ถึงที่เกิดเหตุเวลา) :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_survey_arrive_date_val" defaultValue={arr.date} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_survey_arrive_hour" defaultValue={arr.hour} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_survey_arrive_minute" defaultValue={arr.minute} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">วันที่สำรวจภัยเสร็จ :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_survey_complete_date_val" defaultValue={comp.date} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_survey_complete_hour" defaultValue={comp.hour} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_survey_complete_minute" defaultValue={comp.minute} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                </tr>
                ); })()}
              </tbody>
            </table>
          </div>

          {/* คู่กรณี + ตำรวจ + ติดตามงาน — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">การเรียกร้องค่าเสียหายจากคู่กรณี :</td>
                  <td className="px-4 py-2 text-gray-800" colSpan={3}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="คัดประจำวัน" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('คัดประจำวัน')} className="w-3.5 h-3.5" /> คัดประจำวัน</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="รับหลักฐานจากคู่กรณีผิด" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('รับหลักฐานจากคู่')} className="w-3.5 h-3.5" /> รับหลักฐานจากคู่กรณีผิด</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="บันทึกยอมรับผิด" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('บันทึกยอมรับ')} className="w-3.5 h-3.5" /> บันทึกยอมรับผิด</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="บัตรติดต่อ" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('บัตรติดต่อ')} className="w-3.5 h-3.5" /> บัตรติดต่อ</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="รับเงิน" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('รับเงิน')} className="w-3.5 h-3.5" /> รับเงินจำนวน</label>
                      <input type="text" name="acc_claim_amount" disabled={d} defaultValue={report.acc_claim_amount != null ? Number(report.acc_claim_amount).toFixed(2) : ''} className={`w-[100px] ml-1 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <span className="text-gray-500">บาท</span>
                      <span className="ml-2 text-gray-500">จากจำนวนเงินเรียกร้องทั้งหมด :</span>
                      <input type="text" name="acc_claim_total_amount" disabled={d} defaultValue={report.acc_claim_total_amount != null ? Number(report.acc_claim_total_amount).toFixed(2) : ''} className={`w-[100px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <span className="text-gray-500">บาท</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* พนักงานสอบสวน + แอลกอฮอล์ — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ชื่อพนักงานสอบสวน :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_police_name" defaultValue={report.acc_police_name || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">สถานีตำรวจ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_police_station" defaultValue={report.acc_police_station || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความเห็นพนักงานสอบสวน :</td>
                  <td className="px-4 py-2" colSpan={3}><input type="text" disabled={d} name="acc_police_comment" defaultValue={report.acc_police_comment || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_police_date" defaultValue={report.acc_police_date || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_police_hour" defaultValue={''} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_police_minute" defaultValue={''} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">ประจำวันข้อที่ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_police_book_no" defaultValue={report.acc_police_book_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ผลการตรวจแอลกอฮอล์ :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1"><input type="radio" name="acc_alcohol_test" value="ไม่มีการตรวจแอลกอฮอล์" disabled={d} defaultChecked={!report.acc_alcohol_test || report.acc_alcohol_test === 'ไม่มีการตรวจแอลกอฮอล์'} className="w-3.5 h-3.5" /> ไม่มีการตรวจแอลกอฮอล์</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_alcohol_test" value="มีการตรวจแอลกอฮอล์" disabled={d} defaultChecked={report.acc_alcohol_test === 'มีการตรวจแอลกอฮอล์'} className="w-3.5 h-3.5" /> มีการตรวจแอลกอฮอล์</label>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">ระบุผล :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_alcohol_result" defaultValue={report.acc_alcohol_result || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* การติดตามงาน — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">การติดตามงาน :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1"><input type="radio" name="acc_followup" value="ไม่มีการนัดหมาย" disabled={d} defaultChecked={!report.acc_followup || report.acc_followup === 'ไม่มีการนัดหมาย'} className="w-3.5 h-3.5" /> ไม่มีการนัดหมาย</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_followup" value="รอการนัดหมาย" disabled={d} defaultChecked={report.acc_followup === 'รอการนัดหมาย'} className="w-3.5 h-3.5" /> รอการนัดหมาย</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_followup" value="มีการนัดหมาย" disabled={d} defaultChecked={report.acc_followup === 'มีการนัดหมาย'} className="w-3.5 h-3.5" /> มีการนัดหมาย</label>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">ครั้งที่นัดหมาย :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_followup_count" defaultValue={report.acc_followup_count || '1'} className={`w-[60px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">รายละเอียดการนัดหมาย :</td>
                  <td className="px-4 py-2" colSpan={3}><input type="text" disabled={d} name="acc_followup_detail" defaultValue={report.acc_followup_detail || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_followup_date" defaultValue={report.acc_followup_date || ''} className={`w-[130px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_followup_hour" defaultValue={''} className={`w-[35px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_followup_minute" defaultValue={''} className={`w-[35px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </>
      )}

      {/* รูปภาพ */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
          <span className="font-bold">::: รูปภาพ</span>
        </div>
        <div className="p-4">
          <PhotoGallery photos={photos} />
        </div>
      </div>

      {/* การตรวจสอบ */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
          <span className="font-bold">::: การตรวจสอบ</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">ผลการดำเนินงาน</label>
              <textarea disabled={d} name="survey_result" defaultValue={report?.survey_result || 'เรียน ผู้ช่วยผู้จัดการฝ่ายสินไหมทราบ\nรถประกันประมาท เบียดฟุตบาตยางฉีก\nรถประกันประเภท 1 ซ่อมอู่\nออกหลักฐานให้รถประกันระบุเงื่อนไข รับผิดชอบยาง 50 เปอร์เซ็นต์\nความสัมพันธ์ผู้เอาประกันภัยเป็น มารดา\n ภูริ'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm min-h-[150px]`} rows={6} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">ความเห็นของผู้ตรวจสอบ</label>
              <textarea disabled={d} name="review_comment" defaultValue={report?.review_comment || review?.comment || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm min-h-[150px]`} rows={6} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">ความเห็นของเซอร์เวย์</label>
              <textarea disabled={d} name="surveyor_comment" defaultValue={report?.surveyor_comment || review?.surveyor_comment || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm min-h-[150px]`} rows={6} />
            </div>
          </div>
        </div>
      </div>

      {/* ค่าใช้จ่าย + ปุ่มอนุมัติ */}
      <div className="flex gap-6">
        <div className="w-1/2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
              <span className="font-bold">::: ค่าใช้จ่าย</span>
            </div>
          <div className="p-4">
            <div>
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-gray-600 font-semibold">รายละเอียด</th>
                    <th className="px-3 py-2 text-center text-gray-600 font-semibold">จำนวน</th>
                    <th className="px-3 py-2 text-center text-gray-600 font-semibold">ราคา/หน่วย</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าบริการ</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" disabled={d} name="service_fee_count" defaultValue="1" className={`w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} /><span className="text-gray-500 w-[30px]">ครั้ง</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="service_fee_price" defaultValue="700.00" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าเดินทาง/ค่าพาหนะ</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" disabled={d} name="travel_fee_count" defaultValue="" className={`w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} /><span className="text-gray-500 w-[30px]">ครั้ง</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="travel_fee_price" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่ารูปถ่าย</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" disabled={d} name="photo_fee_count" defaultValue="" className={`w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} /><span className="text-gray-500 w-[30px]">รูป</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="photo_fee_price" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าโทรศัพท์</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="phone_fee" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าประกันตัว</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="bail_fee" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าเรียกร้อง</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" disabled={d} name="claim_fee_percent" defaultValue="" className={`w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} /><span className="text-gray-500 w-[30px]">%</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="claim_fee_price" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าคัดประจำวัน</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="daily_record_fee" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าใช้จ่ายอื่นๆ</td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="other_fee_detail" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-3 py-2"><input type="text" disabled={d} name="other_fee_price" defaultValue="" className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-right`} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
        {/* คอลัมน์ขวา — ปุ่มแก้ไข + อนุมัติ */}
        <div className="w-1/2 flex flex-col items-end justify-end gap-3">
          {saveMsg && (
            <div className={`px-4 py-2 rounded text-sm ${saveMsg.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{saveMsg}</div>
          )}
          <div className="flex gap-3">
            {!isEditing ? (
              <button type="button" onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">แก้ไข</button>
            ) : (
              <>
                <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-gray-400 text-white rounded-lg font-medium hover:bg-gray-500 transition">ยกเลิก</button>
                <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition">
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </>
            )}
            {!review && !isEditing && (
              <ReviewForm caseId={caseData.id} onReviewSubmitted={onReviewSubmitted} />
            )}
          </div>
          {review && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">ตรวจสอบแล้ว</span>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
