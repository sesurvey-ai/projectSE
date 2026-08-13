'use client';

/**
 * นำเข้าเคสจากไฟล์ XML ของ ISURVEY (flow ระบบเก่าที่กำลังเลิกใช้)
 *
 *   พนักงานทำงานบน ISURVEY → หัวหน้าปิดงานได้ไฟล์ XML (+ zip รูป จากปุ่ม "ดาวน์โหลดรูปภาพ")
 *   → อัปโหลดที่หน้านี้ → ได้เคสจริงในระบบ → ตรวจ/แก้ที่หน้ารายละเอียดเคส → ปิดงาน
 *   → บอทนำเข้า EMCS ตาม flow เดิม
 *
 * หน้านี้ "สร้างเคส" อย่างเดียว — การแก้ข้อมูลทำที่หน้ารายละเอียดเคส
 */
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// ต้องตรงกับ value ที่ resolve_insurer_code ของบอทรู้จัก (autokey/insurer_map.py)
//
// เหลือ 2 บริษัทตามงานที่รับจริง (กติกา user 13/08/69) — เดิมมี 6 ตัวเลือก
// อีก 4 (เมืองไทย · กรุงเทพ · วิริยะ · ทิพย) ยังไม่เคยมีงานเข้าสักเคส และเลือกผิดที
// = เคสไปโผล่ผิดบริษัทในระบบประกัน ต้องตามลบซึ่ง draft ของ EMCS ลบไม่ได้
// จะเปิดเพิ่มเมื่อไหร่ ใส่กลับเข้ามาที่นี่ + เช็คว่า insurer_map.py มีรหัสของบริษัทนั้น
const INSURANCE_COMPANIES = [
  { value: 'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)', name: 'ไทยไพบูลย์ประกันภัย' },
  { value: 'ไอโออิกรุงเทพประกันภัย', name: 'ไอโออิ กรุงเทพประกันภัย' },
];

type ImportResult = {
  caseId: number;
  assignedTo: number | null;
  surveyorCode: string;
  photos: { added: number; perCat: Record<string, number> };
  warnings: string[];
  hasMoney: boolean;
};

export default function ImportXmlPage() {
  const router = useRouter();
  const xmlRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [insurer, setInsurer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const submit = async () => {
    if (!xmlFile) { setError('กรุณาเลือกไฟล์ XML ของรายงานสำรวจ'); return; }
    if (!insurer) { setError('กรุณาเลือกบริษัทประกัน — ไฟล์ XML ไม่มีข้อมูลนี้ แต่บอทต้องใช้ตอนนำเข้า EMCS'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('xml', xmlFile);
      if (zipFile) fd.append('zip', zipFile);
      fd.append('insurance_company', insurer);
      const res = await api.post('/api/cases/import-xml', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,   // zip รูปทั้งเคสอาจใหญ่
      });
      setResult(res.data.data as ImportResult);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setXmlFile(null); setZipFile(null); setResult(null); setError('');
    if (xmlRef.current) xmlRef.current.value = '';
    if (zipRef.current) zipRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">นำเข้าเคสจากไฟล์ XML (ISURVEY)</h1>
        <p className="text-sm text-gray-500 mt-1">
          สำหรับงานที่ทำบนระบบ ISURVEY เดิม — อัปโหลดไฟล์ที่ได้หลังหัวหน้าปิดงาน
          ระบบจะสร้างเคสให้ตรวจและแก้ไขก่อนส่งเข้า EMCS
        </p>
      </div>

      {!result && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {/* ไฟล์ XML */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ไฟล์รายงานสำรวจ (XML) <span className="text-red-500">*</span>
            </label>
            <input
              ref={xmlRef} type="file" accept=".xml,.txt"
              onChange={(e) => { setXmlFile(e.target.files?.[0] ?? null); setError(''); }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">ไฟล์ชื่อประมาณ SURV_REPORT_xxxxxxxx.txt</p>
          </div>

          {/* zip รูป */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ไฟล์รูปภาพ (ZIP) <span className="text-gray-400">— ไม่บังคับ</span>
            </label>
            <input
              ref={zipRef} type="file" accept=".zip"
              onChange={(e) => { setZipFile(e.target.files?.[0] ?? null); setError(''); }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              ไฟล์จากปุ่ม &quot;ดาวน์โหลดรูปภาพ&quot; ของพอร์ทัล — ระบบจะแยกหมวดรูปให้อัตโนมัติ
            </p>
          </div>

          {/* บริษัทประกัน */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              บริษัทประกัน <span className="text-red-500">*</span>
            </label>
            <select
              value={insurer}
              onChange={(e) => { setInsurer(e.target.value); setError(''); }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-white"
            >
              <option value="">-- เลือกบริษัทประกัน --</option>
              {INSURANCE_COMPANIES.map((c) => (
                <option key={c.value} value={c.value}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-amber-600 mt-1">
              ไฟล์ XML ไม่มีชื่อบริษัทประกัน — ต้องเลือกเอง ไม่งั้นบอทนำเข้า EMCS ไม่ได้
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={submit} disabled={busy}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
            >
              {busy ? 'กำลังนำเข้า...' : 'นำเข้าและสร้างเคส'}
            </button>
            <button onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-2xl">✓</span>
            <span className="text-lg font-semibold">สร้างเคส #{result.caseId} แล้ว</span>
          </div>

          <dl className="text-sm text-gray-700 space-y-1">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">ผู้สำรวจ</dt>
              <dd>
                {result.surveyorCode || '(ไม่ระบุ)'}
                {result.surveyorCode && !result.assignedTo &&
                  <span className="text-amber-600"> — ไม่พบรหัสนี้ในระบบ ยังไม่ได้มอบหมาย</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">รูปภาพ</dt>
              <dd>
                {result.photos.added > 0
                  ? `${result.photos.added} รูป — ` +
                    Object.entries(result.photos.perCat).map(([k, v]) => `${k} ${v}`).join(' · ')
                  : 'ไม่ได้แนบ zip รูป'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">ยอดเงินจาก ISURVEY</dt>
              <dd>{result.hasMoney ? 'มี — เก็บไว้ให้ดูอ้างอิง (ไม่ส่งเข้า EMCS)' : 'ไม่มี'}</dd>
            </div>
          </dl>

          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3">
              <p className="text-sm font-medium text-amber-800 mb-1">ต้องตรวจ/เติมก่อนส่งเข้า EMCS</p>
              <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => router.push(`/inspector/cases/${result.caseId}`)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              เปิดเคสเพื่อตรวจ/แก้ไข
            </button>
            <button onClick={reset} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
              นำเข้าไฟล์ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
