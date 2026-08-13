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

/**
 * เดาบริษัทประกันจากคำนำหน้าเลขเซอร์เวย์ (SURV_JOBNO) ในไฟล์
 *
 * เลขเซอร์เวย์เป็นเลขที่ **เราออกเอง** จึงคุมรูปแบบได้ — ต่างจาก INSURERBRID ที่ไฟล์
 * ของไทยไพบูลย์ปล่อยว่างทุกใบ · ตรวจไฟล์จริง 8 ใบ: SETP 6 ใบ / SEABI 2 ใบ
 * ไม่มีใบไหนขัดกับเลขเคลม (21BR10A… คู่กับ SETP · ตัวเลขล้วนคู่กับ SEABI) เลยสักใบ
 * user ยืนยันกติกานี้ 13/08/69
 *
 * ⛔ เจอคำนำหน้าที่ไม่รู้จัก = คืน null แล้วปล่อยให้คนเลือกเอง — ห้ามเดา
 *    เลือกผิด = เคสไปโผล่ผิดบริษัทใน EMCS ซึ่ง draft ลบไม่ได้
 */
const INSURER_BY_JOB_PREFIX: Record<string, string> = {
  SETP: 'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)',   // TP = ไทยไพบูลย์
  SEABI: 'ไอโออิกรุงเทพประกันภัย',                      // ABI = Aioi Bangkok Insurance
};

function detectInsurer(xmlText: string): { value: string; jobNo: string; prefix: string } | null {
  const m = /<SURV_JOBNO>\s*([^<\s]+)\s*<\/SURV_JOBNO>/i.exec(xmlText);
  if (!m) return null;
  const jobNo = m[1];
  const prefix = (jobNo.split('-')[0] || '').toUpperCase();
  const value = INSURER_BY_JOB_PREFIX[prefix];
  return value ? { value, jobNo, prefix } : null;
}

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
  // ผลตรวจจับจากไฟล์ — null = ไฟล์ยังไม่ถูกเลือก หรือคำนำหน้าไม่รู้จัก (ต้องเลือกเอง)
  const [detected, setDetected] = useState<{ value: string; jobNo: string; prefix: string } | null>(null);
  const [detectFailed, setDetectFailed] = useState(false);
  // ความคืบหน้าอัปโหลด: null = ยังไม่เริ่ม · 0-100 = กำลังส่งไฟล์ · 'server' = ส่งครบแล้ว รอเซิร์ฟเวอร์
  // zip รูปทั้งเคสหลายสิบ MB ระหว่างส่งหน้าจะนิ่งสนิท ผู้ใช้นึกว่าเบราว์เซอร์ค้างแล้วกดซ้ำ/ปิดหน้า
  const [progress, setProgress] = useState<number | 'server' | null>(null);

  // เลือกไฟล์ XML → อ่านในเบราว์เซอร์เลย (ไม่ต้องส่งขึ้น server ก่อน) แล้วเติมบริษัทให้
  const onPickXml = async (file: File | null) => {
    // ⚠️ ค่าที่ "ระบบเติมให้" จากไฟล์ก่อนหน้าต้องล้างทิ้งก่อนเสมอ — ไม่งั้นเปลี่ยนไฟล์
    // โดยไม่รีโหลดหน้า แล้วไฟล์ใหม่อ่านบริษัทไม่ออก ช่องจะยังค้างบริษัทของไฟล์เก่า
    // ทั้งที่ข้อความใต้ช่องบอกว่า "ต้องเลือกเอง" → นำเข้าผิดบริษัทโดยไม่รู้ตัว (เจอตอนเทสจริง)
    // ค่าที่ "คนเลือกเอง" ไม่ล้าง — เป็นเจตนาของคน ไม่ใช่ของที่ระบบเดาไว้
    if (detected && insurer === detected.value) setInsurer('');
    setXmlFile(file); setError(''); setDetected(null); setDetectFailed(false);
    if (!file) return;
    try {
      const hit = detectInsurer(await file.text());
      if (hit) { setDetected(hit); setInsurer(hit.value); }
      else { setDetectFailed(true); }
    } catch {
      setDetectFailed(true);   // อ่านไฟล์ไม่ได้ = ให้เลือกเอง ไม่ใช่เรื่องคอขาดบาดตาย
    }
  };

  const submit = async () => {
    if (!xmlFile) { setError('กรุณาเลือกไฟล์ XML ของรายงานสำรวจ'); return; }
    if (!insurer) { setError('กรุณาเลือกบริษัทประกัน — ไฟล์ XML ไม่มีข้อมูลนี้ แต่บอทต้องใช้ตอนนำเข้า EMCS'); return; }
    // เลือกสวนกับที่ตรวจจับได้ → ถามยืนยันอีกรอบ (ไม่บล็อก เผื่อระบบตรวจผิด)
    // เคสที่เข้าผิดบริษัทใน EMCS ลบไม่ได้ จังหวะนี้คือจังหวะสุดท้ายที่ทักได้
    if (detected && insurer !== detected.value) {
      const เดา = INSURANCE_COMPANIES.find((c) => c.value === detected.value)?.name ?? detected.value;
      const เลือก = INSURANCE_COMPANIES.find((c) => c.value === insurer)?.name ?? insurer;
      if (!window.confirm(
        `เลขเซอร์เวย์ ${detected.jobNo} ขึ้นต้นด้วย ${detected.prefix} ซึ่งเป็นงานของ "${เดา}"\n` +
        `แต่คุณเลือก "${เลือก}"\n\nยืนยันใช้ "${เลือก}" ต่อหรือไม่?\n` +
        `(เคสที่เข้าผิดบริษัทในระบบประกันลบไม่ได้)`)) return;
    }
    setBusy(true); setError(''); setResult(null); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('xml', xmlFile);
      if (zipFile) fd.append('zip', zipFile);
      fd.append('insurance_company', insurer);
      const res = await api.post('/api/cases/import-xml', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,   // zip รูปทั้งเคสอาจใหญ่
        onUploadProgress: (e) => {
          // e.total ไม่มีค่าเมื่อเซิร์ฟเวอร์/พร็อกซีไม่บอกขนาด → ไม่โชว์ % มั่ว ให้ไปโหมด "รอเซิร์ฟเวอร์"
          if (!e.total) { setProgress('server'); return; }
          const pct = Math.round((e.loaded * 100) / e.total);
          // ครบ 100% = ไฟล์ออกจากเครื่องหมดแล้ว แต่ยังต้องรอ backend แตก zip + เขียน DB
          // ค้างที่ 100% เฉย ๆ ดูเหมือนแฮงก์ จึงเปลี่ยนข้อความเป็น "กำลังประมวลผล"
          setProgress(pct >= 100 ? 'server' : pct);
        },
      });
      setResult(res.data.data as ImportResult);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const totalBytes = (xmlFile?.size ?? 0) + (zipFile?.size ?? 0);
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

  const reset = () => {
    setXmlFile(null); setZipFile(null); setResult(null); setError('');
    // ล้างผลตรวจจับด้วย ไม่งั้นเคสถัดไปจะเห็นข้อความของไฟล์เก่าค้างอยู่
    setDetected(null); setDetectFailed(false); setInsurer(''); setProgress(null);
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
              onChange={(e) => { void onPickXml(e.target.files?.[0] ?? null); }}
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
            {detected && insurer === detected.value ? (
              <p className="text-xs text-green-700 mt-1">
                เลือกให้อัตโนมัติจากเลขเซอร์เวย์ <span className="font-mono">{detected.jobNo}</span>{' '}
                (ขึ้นต้น <span className="font-mono">{detected.prefix}</span>) — เปลี่ยนเองได้ถ้าไม่ถูก
              </p>
            ) : detected ? (
              <p className="text-xs text-red-600 mt-1">
                ไม่ตรงกับที่ตรวจจับได้จากเลขเซอร์เวย์ <span className="font-mono">{detected.jobNo}</span>{' '}
                — ระบบจะถามยืนยันอีกครั้งก่อนนำเข้า
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">
                {detectFailed
                  ? 'อ่านบริษัทจากเลขเซอร์เวย์ในไฟล์ไม่ได้ (คำนำหน้าไม่รู้จัก) — ต้องเลือกเอง'
                  : 'ไฟล์ XML ไม่มีชื่อบริษัทประกัน — เลือกไฟล์แล้วระบบจะเติมให้จากเลขเซอร์เวย์'}
              </p>
            )}
          </div>

          {/* ความคืบหน้า — zip รูปทั้งเคสหลายสิบ MB ถ้าไม่มีอะไรขยับ ผู้ใช้จะนึกว่าเบราว์เซอร์ค้าง
              แล้วกดซ้ำหรือปิดหน้าไปกลางคัน (กดซ้ำ = เคสซ้ำ เพราะเลขเซอร์เวย์ยังไม่ถูกบันทึกจนกว่าจะจบ) */}
          {progress !== null && (
            <div aria-live="polite">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-700 font-medium">
                  {progress === 'server'
                    ? 'ส่งไฟล์ครบแล้ว — กำลังแตกไฟล์รูปและสร้างเคส'
                    : `กำลังอัปโหลด ${progress}%`}
                </span>
                <span className="text-gray-500">
                  {progress === 'server'
                    ? 'อย่าปิดหน้านี้'
                    : `${mb(totalBytes * (progress as number) / 100)} / ${mb(totalBytes)} MB`}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                {progress === 'server' ? (
                  // ไม่รู้ว่าเซิร์ฟเวอร์จะเสร็จเมื่อไหร่ → แถบวิ่งไปมา บอกแค่ว่า "ยังทำงานอยู่"
                  <div className="h-full w-1/3 bg-blue-600 rounded-full animate-[imp-slide_1.1s_ease-in-out_infinite]" />
                ) : (
                  <div className="h-full bg-blue-600 rounded-full transition-[width] duration-200"
                       style={{ width: `${progress}%` }} />
                )}
              </div>
              <style>{'@keyframes imp-slide{0%{margin-left:0}50%{margin-left:66%}100%{margin-left:0}}'}</style>
            </div>
          )}

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
