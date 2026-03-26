'use client';

import React, { useState, useRef, FormEvent } from 'react';
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

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrRaw, setOcrRaw] = useState('');
  const [showOcrRaw, setShowOcrRaw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOcrUpload = async (file: File) => {
    setError('');
    setOcrLoading(true);
    setOcrPreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/api/ocr/typhoon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 200000,
      });
      if (res.data.success && res.data.data) {
        const { fields, ocrRaw: rawText } = res.data.data as { fields: Record<string, string>; ocrRaw: string };
        if (rawText) setOcrRaw(rawText);
        const newForm: Record<string, string> = {};
        for (const [key, val] of Object.entries(fields || {})) {
          if (val && typeof val === 'string' && val.trim()) {
            newForm[key] = val.trim();
          }
        }
        setForm(prev => ({ ...prev, ...newForm }));
        if (newForm.assured_name) setCustomerName(newForm.assured_name);
        if (newForm.acc_place) setIncidentLocation(newForm.acc_place);
        setOcrDone(true);
      } else {
        setError(res.data.message || 'ไม่สามารถอ่านข้อมูลจากรูปได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการอ่าน OCR กรุณาลองใหม่');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleOcrUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleOcrUpload(file);
  };

  const resetOcr = () => {
    setOcrDone(false);
    setOcrPreview(null);
    setForm({});
    setCustomerName('');
    setIncidentLocation('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
                  <td className={V}><input value={f('claim_ref_no')} onChange={e => s('claim_ref_no', e.target.value)} className={I} /></td>
                  <td className={L}>เลขที่เคลม</td>
                  <td className={V} colSpan={3}><input value={f('claim_no')} onChange={e => s('claim_no', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>ผู้รับแจ้ง</td>
                  <td className={V}><input value={f('acc_reporter')} onChange={e => s('acc_reporter', e.target.value)} className={I} /></td>
                  <td className={L}>วันที่รับแจ้ง</td>
                  <td className={V}><input value={f('acc_insurance_notify_date')} onChange={e => s('acc_insurance_notify_date', e.target.value)} className={I} /></td>
                  <td className={L}>วันที่เกิดเหตุ</td>
                  <td className={V}><input value={f('acc_date')} onChange={e => s('acc_date', e.target.value)} className={I} /></td>
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
                  <td className={V}><input value={f('acc_time')} onChange={e => s('acc_time', e.target.value)} className={I} /></td>
                  <td className={L}>เบอร์โทรผู้แจ้ง</td>
                  <td className={V}><input value={f('reporter_phone')} onChange={e => s('reporter_phone', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>สาขาประกัน</td>
                  <td className={V} colSpan={5}><input value={f('insurance_branch')} onChange={e => s('insurance_branch', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>บริษัทสำรวจ</td>
                  <td className={V} colSpan={3}><input value={f('survey_company')} onChange={e => s('survey_company', e.target.value)} className={I} /></td>
                  <td className={L}>เลขที่งาน</td>
                  <td className={V}><input value={f('survey_job_no')} onChange={e => s('survey_job_no', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>ทะเบียนรถ</td>
                  <td className={V}><input value={f('license_plate')} onChange={e => s('license_plate', e.target.value)} className={I} /></td>
                  <td className={L}>ยี่ห้อ</td>
                  <td className={V}><input value={f('car_brand')} onChange={e => s('car_brand', e.target.value)} className={I} /></td>
                  <td className={L}>รุ่น</td>
                  <td className={V}><input value={f('car_model')} onChange={e => s('car_model', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>เลขตัวถัง</td>
                  <td className={V} colSpan={2}><input value={f('chassis_no')} onChange={e => s('chassis_no', e.target.value)} className={I} /></td>
                  <td className={L}>เลขเครื่องยนต์</td>
                  <td className={V}><input value={f('engine_no')} onChange={e => s('engine_no', e.target.value)} className={I} /></td>
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
                  <td className={V}><input value={f('car_color')} onChange={e => s('car_color', e.target.value)} className={I} /></td>
                  <td className={L}>ปีรถ</td>
                  <td className={V}><input value={f('car_reg_year')} onChange={e => s('car_reg_year', e.target.value)} className={I} /></td>
                  <td className={L}>จังหวัด</td>
                  <td className={V}><input value={f('car_province')} onChange={e => s('car_province', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>ชื่อผู้ขับขี่</td>
                  <td className={V} colSpan={2}>
                    <div className="flex gap-1">
                      <input value={f('driver_first_name')} onChange={e => s('driver_first_name', e.target.value)} className={I} />
                      <input value={f('driver_last_name')} onChange={e => s('driver_last_name', e.target.value)} className={I} />
                    </div>
                  </td>
                  <td className={L}>เบอร์โทรผู้ขับขี่</td>
                  <td className={V} colSpan={2}><input value={f('driver_phone')} onChange={e => s('driver_phone', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>สถานที่เกิดเหตุ *</td>
                  <td className={V} colSpan={5}><input value={incidentLocation} onChange={e => { setIncidentLocation(e.target.value); s('acc_place', e.target.value); }} className={`${I} font-medium`} required /></td>
                </tr>
                <tr>
                  <td className={L}>ตำบล</td>
                  <td className={V}><input value={f('acc_subdistrict')} onChange={e => s('acc_subdistrict', e.target.value)} className={I} /></td>
                  <td className={L}>อำเภอ</td>
                  <td className={V}><input value={f('acc_district')} onChange={e => s('acc_district', e.target.value)} className={I} /></td>
                  <td className={L}>จังหวัด</td>
                  <td className={V}><input value={f('acc_province')} onChange={e => s('acc_province', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>ลักษณะการเกิดเหตุ</td>
                  <td className={V} colSpan={3}><input value={f('acc_cause')} onChange={e => s('acc_cause', e.target.value)} className={I} /></td>
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
                  <td className={V}><input value={f('policy_no')} onChange={e => s('policy_no', e.target.value)} className={I} /></td>
                  <td className={L}>ประเภท</td>
                  <td className={V}><input value={f('policy_type')} onChange={e => s('policy_type', e.target.value)} className={I} /></td>
                  <td className={L}>ผู้เอาประกัน *</td>
                  <td className={V}><input value={customerName} onChange={e => { setCustomerName(e.target.value); s('assured_name', e.target.value); }} className={`${I} font-medium`} required /></td>
                </tr>
                <tr>
                  <td className={L}>เริ่มคุ้มครอง</td>
                  <td className={V}><input value={f('policy_start')} onChange={e => s('policy_start', e.target.value)} className={I} /></td>
                  <td className={L}>สิ้นสุด</td>
                  <td className={V}><input value={f('policy_end')} onChange={e => s('policy_end', e.target.value)} className={I} /></td>
                  <td className={L}>พ.ร.บ.</td>
                  <td className={V}><input value={f('prb_number')} onChange={e => s('prb_number', e.target.value)} className={I} /></td>
                </tr>
                <tr>
                  <td className={L}>หมายเหตุ</td>
                  <td className={V} colSpan={5}>
                    <textarea value={f('acc_detail')} onChange={e => s('acc_detail', e.target.value)} className={`${I} resize-none`} rows={2} />
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

        {/* ไทยไพบูลย์ → OCR upload + ตาราง */}
        {insuranceCompany === 'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)' && (
          <>
            {/* Upload zone */}
            {!ocrDone && (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => !ocrLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${ocrLoading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                {ocrLoading ? (
                  <div className="space-y-3">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-sm text-blue-600 font-medium">กำลังอ่านข้อมูลจากรูป...</p>
                    <p className="text-xs text-gray-400">Typhoon OCR กำลังประมวลผล อาจใช้เวลาสักครู่</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-4xl text-gray-300">&#128247;</div>
                    <p className="text-sm font-medium text-gray-600">อัปโหลดรูปใบรับแจ้งเคลม</p>
                    <p className="text-xs text-gray-400">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกรูป (JPEG, PNG, WebP)</p>
                  </div>
                )}
                {ocrPreview && ocrLoading && (
                  <img src={ocrPreview} alt="preview" className="mt-4 max-h-40 mx-auto rounded-lg opacity-50" />
                )}
              </div>
            )}

            {/* OCR result table */}
            {ocrDone && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-sm font-medium">&#10003; อ่านข้อมูลสำเร็จ</span>
                    <span className="text-xs text-gray-400">ตรวจสอบและแก้ไขข้อมูลได้ก่อนสร้างเคส</span>
                  </div>
                  <div className="flex gap-3">
                    {ocrRaw && <button type="button" onClick={() => setShowOcrRaw(!showOcrRaw)} className="text-xs text-gray-500 hover:underline">{showOcrRaw ? 'ซ่อน' : 'ดู'} OCR Raw</button>}
                    <button type="button" onClick={resetOcr} className="text-xs text-blue-600 hover:underline">อัปโหลดรูปใหม่</button>
                  </div>
                </div>

                {showOcrRaw && (
                  <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-[11px] text-gray-600 mb-3 max-h-60 overflow-auto whitespace-pre-wrap">{ocrRaw}</pre>
                )}

                <table className="w-full border-collapse border border-gray-200 bg-white text-[12px] mb-4">
                  <tbody>
                    <tr>
                      <td className={L}>เลขรับแจ้ง</td>
                      <td className={V}><input value={f('claim_ref_no')} onChange={e => s('claim_ref_no', e.target.value)} className={I} /></td>
                      <td className={L}>เลขที่เคลม</td>
                      <td className={V} colSpan={3}><input value={f('claim_no')} onChange={e => s('claim_no', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>วันที่รับแจ้ง</td>
                      <td className={V}><input value={f('acc_insurance_notify_date')} onChange={e => s('acc_insurance_notify_date', e.target.value)} className={I} /></td>
                      <td className={L}>เวลารับแจ้ง</td>
                      <td className={V}><input value={f('acc_insurance_notify_time')} onChange={e => s('acc_insurance_notify_time', e.target.value)} className={I} /></td>
                      <td className={L}>ผู้รับแจ้ง</td>
                      <td className={V}><input value={f('receiver_name')} onChange={e => s('receiver_name', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>วันที่เกิดเหตุ</td>
                      <td className={V}><input value={f('acc_date')} onChange={e => s('acc_date', e.target.value)} className={I} /></td>
                      <td className={L}>เวลาเกิดเหตุ</td>
                      <td className={V}><input value={f('acc_time')} onChange={e => s('acc_time', e.target.value)} className={I} /></td>
                      <td className={L}>การเกิดเหตุ</td>
                      <td className={V}><input value={f('acc_cause')} onChange={e => s('acc_cause', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>สถานที่เกิดเหตุ *</td>
                      <td className={V} colSpan={5}><input value={incidentLocation} onChange={e => { setIncidentLocation(e.target.value); s('acc_place', e.target.value); }} className={`${I} font-medium`} required /></td>
                    </tr>
                    <tr>
                      <td className={L}>ตำบล/แขวง</td>
                      <td className={V}><input value={f('acc_subdistrict')} onChange={e => s('acc_subdistrict', e.target.value)} className={I} /></td>
                      <td className={L}>อำเภอ/เขต</td>
                      <td className={V}><input value={f('acc_district')} onChange={e => s('acc_district', e.target.value)} className={I} /></td>
                      <td className={L}>จังหวัด</td>
                      <td className={V}><input value={f('acc_province')} onChange={e => s('acc_province', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>ทะเบียนรถ</td>
                      <td className={V}><input value={f('license_plate')} onChange={e => s('license_plate', e.target.value)} className={I} /></td>
                      <td className={L}>ยี่ห้อ</td>
                      <td className={V}><input value={f('car_brand')} onChange={e => s('car_brand', e.target.value)} className={I} /></td>
                      <td className={L}>รุ่น</td>
                      <td className={V}><input value={f('car_model')} onChange={e => s('car_model', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>เลขตัวถัง</td>
                      <td className={V} colSpan={2}><input value={f('chassis_no')} onChange={e => s('chassis_no', e.target.value)} className={I} /></td>
                      <td className={L}>เลขเครื่องยนต์</td>
                      <td className={V} colSpan={2}><input value={f('engine_no')} onChange={e => s('engine_no', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>สี</td>
                      <td className={V}><input value={f('car_color')} onChange={e => s('car_color', e.target.value)} className={I} /></td>
                      <td className={L}>ประเภทรถ</td>
                      <td className={V}><input value={f('car_type')} onChange={e => s('car_type', e.target.value)} className={I} /></td>
                      <td className={L}>กรมธรรม์</td>
                      <td className={V}><input value={f('policy_no')} onChange={e => s('policy_no', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>ประเภทประกัน</td>
                      <td className={V}><input value={f('policy_type')} onChange={e => s('policy_type', e.target.value)} className={I} /></td>
                      <td className={L}>เริ่มคุ้มครอง</td>
                      <td className={V}><input value={f('policy_start')} onChange={e => s('policy_start', e.target.value)} className={I} /></td>
                      <td className={L}>สิ้นสุด</td>
                      <td className={V}><input value={f('policy_end')} onChange={e => s('policy_end', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>พ.ร.บ.</td>
                      <td className={V} colSpan={2}><input value={f('prb_number')} onChange={e => s('prb_number', e.target.value)} className={I} /></td>
                      <td className={L}>Deduct</td>
                      <td className={V} colSpan={2}><input value={f('deductible')} onChange={e => s('deductible', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>ผู้เอาประกัน *</td>
                      <td className={V} colSpan={2}><input value={customerName} onChange={e => { setCustomerName(e.target.value); s('assured_name', e.target.value); }} className={`${I} font-medium`} required /></td>
                      <td className={L}>ผู้ขับขี่</td>
                      <td className={V} colSpan={2}>
                        <div className="flex gap-1">
                          <input value={f('driver_first_name')} onChange={e => s('driver_first_name', e.target.value)} className={I} placeholder="ชื่อ" />
                          <input value={f('driver_last_name')} onChange={e => s('driver_last_name', e.target.value)} className={I} placeholder="นามสกุล" />
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className={L}>เบอร์โทรผู้ขับขี่</td>
                      <td className={V}><input value={f('driver_phone')} onChange={e => s('driver_phone', e.target.value)} className={I} /></td>
                      <td className={L}>ผู้แจ้งเหตุ</td>
                      <td className={V}><input value={f('acc_reporter')} onChange={e => s('acc_reporter', e.target.value)} className={I} /></td>
                      <td className={L}>เบอร์โทรผู้แจ้ง</td>
                      <td className={V}><input value={f('reporter_phone')} onChange={e => s('reporter_phone', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>บริษัทสำรวจ</td>
                      <td className={V} colSpan={2}><input value={f('survey_company')} onChange={e => s('survey_company', e.target.value)} className={I} /></td>
                      <td className={L}>เลขที่งาน</td>
                      <td className={V} colSpan={2}><input value={f('survey_job_no')} onChange={e => s('survey_job_no', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>ผู้สำรวจ</td>
                      <td className={V} colSpan={2}><input value={f('surveyor_name')} onChange={e => s('surveyor_name', e.target.value)} className={I} /></td>
                      <td className={L}>เบอร์โทรผู้สำรวจ</td>
                      <td className={V} colSpan={2}><input value={f('surveyor_phone')} onChange={e => s('surveyor_phone', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>รถคู่กรณี</td>
                      <td className={V}><input value={f('counterparty_plate')} onChange={e => s('counterparty_plate', e.target.value)} className={I} /></td>
                      <td className={L}>ยี่ห้อคู่กรณี</td>
                      <td className={V}><input value={f('counterparty_brand')} onChange={e => s('counterparty_brand', e.target.value)} className={I} /></td>
                      <td className={L}>ประกันคู่กรณี</td>
                      <td className={V}><input value={f('counterparty_insurance')} onChange={e => s('counterparty_insurance', e.target.value)} className={I} /></td>
                    </tr>
                    <tr>
                      <td className={L}>หมายเหตุ</td>
                      <td className={V} colSpan={5}>
                        <textarea value={f('acc_detail')} onChange={e => s('acc_detail', e.target.value)} className={`${I} resize-none`} rows={2} />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {submitting ? 'กำลังสร้าง...' : 'สร้างเคสและมอบหมาย'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </form>
    </div>
  );
}
