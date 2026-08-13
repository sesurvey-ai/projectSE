'use client';

import { useState, useRef, useEffect } from 'react';
import PhotoGallery from './PhotoGallery';
import ReviewForm from '@/components/review/ReviewForm';
import { PROVINCE_OPTIONS, carBrandOptions, CAR_COLOR_OPTIONS, EV_TYPE_OPTIONS, ACC_CAUSE_OPTIONS, ACC_DAMAGE_TYPE_OPTIONS } from './caseOptions';
import { districtOptions } from './districtOptions';
import api from '@/lib/api';
import DamageEditor, { DamageItem } from './DamageEditor';
import { InjuredEditor, PropertyEditor, OpponentEditor, dropEmptyRecords, dropEmptyOpponents, RecordItem, LooseRecord } from './RecordEditors';

/** ค่าตอบแทนผู้สำรวจของเคส — `suggest` คือยอดที่ระบบคิดจากตารางเรท `saved` คือที่ผู้ตรวจบันทึกจริง
 *  แยกกันเพื่อให้เห็นว่าผู้ตรวจปรับจากยอดที่ระบบแนะนำไปเท่าไหร่ */
interface PayData {
  saved: Record<string, number | string | boolean | null> | null;
  suggest: { service_fee: number | null; snapshot: Record<string, unknown> } | null;
  area: {
    province_code: string | null; amphur_code: string | null; team: string | null;
    province_name: string | null; district_name: string | null;
    resolved: boolean; photo_count: number;
  } | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CaseDetailProps {
  caseData: any;
  report: any;
  photos: any[];
  review: any;
  visitCount?: number;
  expenses?: any;
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

// ===== Phase 3: multi-record display helpers (opposing_parties / injured_persons / damaged_property / insured_damage) =====
const DAMAGE_POS_LABELS: Record<string, string> = { L: 'ซ้าย', R: 'ขวา', A: 'ทั้งหมด' };
const DAMAGE_SEV_LABELS: Record<string, string> = { L: 'ต่ำ', M: 'กลาง', H: 'สูง', X: 'สูงมาก' };
const WOUND_LEVEL_COLORS: Record<string, string> = {
  'เล็กน้อย': 'bg-green-100 text-green-800',
  'ปานกลาง': 'bg-yellow-100 text-yellow-800',
  'สาหัส': 'bg-orange-100 text-orange-800',
  'ทุพพลภาพ': 'bg-red-100 text-red-800',
  'เสียชีวิต': 'bg-red-100 text-red-800',
};
function toArray(x: unknown): any[] { return Array.isArray(x) ? x : []; }
function currencyFromString(v: unknown): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : formatCurrency(n);
}
function formatDamageChip(dmg: any): string {
  const part = (dmg?.part ?? '').toString().trim();
  const pos = DAMAGE_POS_LABELS[dmg?.pos] || '';
  const sev = DAMAGE_SEV_LABELS[dmg?.level] || (dmg?.level ?? '');
  const left = [part, pos].filter(Boolean).join(' ');
  return sev ? `${left || '-'} · ${sev}` : (left || '-');
}
function ReadItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className="text-sm font-medium text-gray-800 break-words">{value === 0 ? '0' : (value || '-')}</p>
    </div>
  );
}
function DamageChips({ items }: { items: any[] }) {
  if (!items.length) return <span className="text-sm text-gray-400">-</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((dmg, i) => (
        <span key={i} className="inline-block bg-gray-100 border border-gray-200 text-gray-700 rounded px-2 py-0.5 text-xs">{formatDamageChip(dmg)}</span>
      ))}
    </div>
  );
}

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

/**
 * ดอกจันช่องบังคับ
 *
 * ⚠️ **ลิสต์ต้องตรงกับ `_sectionMissing()` ในแอปมือถือ** (`survey_form_screen.dart`)
 * ซึ่ง sync กับ validator จริงของ EMCS (`vlidSurvey` / `vlidInjPerson` / `vlidAsset`) อยู่แล้ว
 * — ว่างแล้วกดบันทึกบน EMCS ไม่ผ่าน หัวหน้าต้องมานั่งไล่เติมเองทีละช่อง
 *
 * ผู้สำรวจเห็นจุดแดงพวกนี้บนมือถืออยู่แล้ว แต่หน้าตรวจงานไม่เคยมี → ผู้ตรวจแก้ข้อมูลแล้ว
 * เผลอลบช่องบังคับทิ้งโดยไม่มีอะไรเตือน
 *
 * `when` = เงื่อนไขที่ทำให้ช่องนี้บังคับ (ไม่ได้บังคับตลอด) — ฟอร์มนี้เป็น uncontrolled
 * จึงไม่ไล่ตามค่าที่พิมพ์แบบ real-time แต่บอกเงื่อนไขไว้ให้อ่านแทน
 */
const Req = ({ when }: { when?: string }) => (
  <span
    className={when ? 'text-amber-500 ml-0.5' : 'text-red-500 ml-0.5'}
    title={when
      ? `บังคับเมื่อ ${when} — ระบบประกันไม่รับถ้าเว้นว่างในกรณีนี้`
      : 'ช่องบังคับของระบบประกัน — เว้นว่างแล้วบันทึกเข้าระบบประกันไม่ผ่าน'}
  >*</span>
);

export default function CaseDetail({ caseData, report, photos, review, visitCount = 1, expenses, onReviewSubmitted }: CaseDetailProps) {
  const ex = expenses || {};
  // ประเภทรถ → ตัวเลือกยี่ห้อ (EMCS กรองลิสต์ยี่ห้อตามประเภทรถ; เดิมโชว์ชุดของ
  // 'เก๋งเอเชีย' ชุดเดียวกับทุกประเภท → กระบะ/มอเตอร์ไซค์เลือกยี่ห้อที่ EMCS ไม่รับ)
  const [carType, setCarType] = useState<string>(report.car_type || '0');
  // จังหวัด → เขต/อำเภอ cascade (เดิมโชว์ 51 เขต กทม. กับทุกจังหวัด)
  const [accProv, setAccProv] = useState<string>(report.acc_province || '0');
  const [accDist, setAccDist] = useState<string>(report.acc_district || '-- เขต --');
  const [driverProv, setDriverProv] = useState<string>(report.driver_province || '0');
  const [driverDist, setDriverDist] = useState<string>(report.driver_district || '-- เขต --');
  const [isEditing, setIsEditing] = useState(false);
  // ความเสียหายรถประกันเป็น JSONB — แก้ผ่าน FormData ไม่ได้ ต้องถือ state เอง
  // (เคสที่นำเข้าจากไฟล์ XML ของ ISURVEY จะว่างเสมอ ผู้ตรวจต้องกรอกก่อนส่งเข้า EMCS)
  const [damage, setDamage] = useState<DamageItem[]>(() =>
    (Array.isArray(report?.insured_damage) ? report.insured_damage : []).map((x: Record<string, unknown>) => ({
      part: String(x?.part ?? ''), pos: String(x?.pos ?? 'A'), level: String(x?.level ?? ''),
    })));
  // ผู้บาดเจ็บ/ทรัพย์สิน เป็น JSONB เหมือนกัน — ค่าใน object เป็นสตริงทั้งหมด (แอปมือถือเก็บแบบนี้)
  const toRecords = (v: unknown): RecordItem[] =>
    (Array.isArray(v) ? v : []).map((x: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(x ?? {}).map(([k, val]) => [k, val == null ? '' : String(val)])));
  const [injured, setInjured] = useState<RecordItem[]>(() => toRecords(report?.injured_persons));
  const [property, setProperty] = useState<RecordItem[]>(() => toRecords(report?.damaged_property));
  // คู่กรณีเก็บดิบ ไม่ผ่าน toRecords — มี `damage` (อาเรย์) กับ `kfk` (บูลีน) ที่แปลงเป็นสตริงแล้วพัง
  const [opponents, setOpponents] = useState<LooseRecord[]>(
    () => (Array.isArray(report?.opposing_parties) ? report.opposing_parties as LooseRecord[] : []));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  // ค่าตอบแทนผู้สำรวจ (ฝั่งจ่ายพนักงาน) — คนละฝั่งเงินกับตาราง survey_expenses ข้างบน
  const [pay, setPay] = useState<PayData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const d = !isEditing;

  useEffect(() => {
    let alive = true;
    api.get(`/api/cases/${caseData.id}/pay`)
      .then((r) => { if (alive && r.data?.success) setPay(r.data.data as PayData); })
      .catch(() => {});   // ยังไม่มีสิทธิ์/ยังไม่มีข้อมูล → ซ่อนบล็อกไปเลย ไม่ต้องรบกวนผู้ตรวจ
    return () => { alive = false; };
  }, [caseData.id]);

  const handleSave = async (): Promise<boolean> => {
    if (!formRef.current) return false;
    setSaving(true); setSaveMsg('');
    try {
      const fd = new FormData(formRef.current);
      const data: Record<string, string> = {};
      fd.forEach((val, key) => { data[key] = val as string; });
      // ป้าย placeholder ของ <select> ที่ยังไม่เลือก (เช่น acc_surveyor_branch/car_color/acc_province)
      // ห้ามบันทึกเป็นค่าจริง — เคยหลุดเข้า DB → รหัสจังหวัดใน XML ที่ส่ง EMCS ว่าง
      const SENTINELS = new Set(['-- ระบุ --', '-- เลือก --', '-- เขต --']);
      for (const k of Object.keys(data)) if (SENTINELS.has((data[k] ?? '').trim())) data[k] = '';
      // acc_claim_opponent + car_lost อยู่ในส่วนที่ disabled ตอน read-only → ไม่อยู่ใน FormData
      // เขียนเฉพาะตอนกดแก้ไขจริง ไม่งั้นบันทึก (หรืออนุมัติ) จะทับเป็น ''/false = ข้อมูลหายเงียบ
      if (isEditing) {
        const opponents = fd.getAll('acc_claim_opponent').map(v => String(v));
        data['acc_claim_opponent'] = opponents.join(',');
        data['car_lost'] = fd.has('car_lost') ? 'true' : 'false';
      }
      // ตัด comma ออกจากคอลัมน์ตัวเลข (เช่น mileage แสดงแบบ 12,345) กัน 500 invalid input for integer
      const numericCols = ['mileage', 'estimated_cost', 'deductible', 'acc_claim_amount', 'acc_claim_total_amount', 'driver_age'];
      for (const k of numericCols) if (typeof data[k] === 'string') data[k] = data[k].replace(/,/g, '');
      const payload: Record<string, unknown> = { ...data };
      if (isEditing) {
        // ทิ้งแถวที่ยังกรอกไม่ครบ — ส่งไปก็ตกที่ EMCS อยู่ดี และทำให้บอทนับรายการเพี้ยน
        payload.insured_damage = damage.filter((x) => x.part && x.level);
        payload.injured_persons = dropEmptyRecords(injured);
        payload.damaged_property = dropEmptyRecords(property);
        payload.opposing_parties = dropEmptyOpponents(opponents);
      }
      // ยอดจ่ายพนักงานอยู่คนละตาราง (survey_pay) → ส่งแยก
      // ยิงก่อนบันทึกรายงาน เพื่อให้ถ้าพังจะพังทั้งคู่ ไม่เหลือสถานะครึ่ง ๆ
      if (isEditing) {
        const payBody: Record<string, unknown> = { other_reason: data['other_fee_detail'] ?? null };
        for (const k of Object.keys(data)) {
          if (k.startsWith('pay_')) payBody[k.slice(4)] = data[k].replace(/,/g, '') || null;
        }
        for (const f of ['out_of_area', 'out_of_hours', 'special_tumbon', 'deduct_late', 'deduct_docs']) {
          payBody[f] = fd.has(f);
        }
        payBody.deduct_reason = data['deduct_reason'] || null;
        // หักเงินโดยไม่บอกเหตุผล = พนักงานถามแล้วไม่มีใครตอบได้ — กันไว้ตั้งแต่ตอนบันทึก
        if (Number(payBody.deduct_fee ?? 0) > 0 && !payBody.deduct_late && !payBody.deduct_docs && !payBody.deduct_reason) {
          setSaveMsg('มีการหักเงินแต่ยังไม่ได้ระบุเหตุผล');
          return false;
        }
        payBody.daily_check = (data['daily_check'] || '') || null;
        const pr = await api.put(`/api/cases/${caseData.id}/pay`, payBody);
        if (pr.data?.success) setPay((prev: PayData | null) => (prev ? { ...prev, saved: pr.data.data } : prev));
      }
      const res = await api.put(`/api/cases/${caseData.id}/report`, { report_data: payload });
      if (res.data.success) { setSaveMsg('บันทึกสำเร็จ'); setIsEditing(false); onReviewSubmitted(); setTimeout(() => setSaveMsg(''), 3000); return true; }
      setSaveMsg('บันทึกไม่สำเร็จ: ' + (res.data.message || '')); return false;
    } catch { setSaveMsg('เกิดข้อผิดพลาดในการบันทึก'); return false; }
    finally { setSaving(false); }
  };

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {report && (
        <>
          {/* คำอธิบายดอกจัน — จุดแดงชุดเดียวกับที่ผู้สำรวจเห็นบนแอป (อิงตัวตรวจของระบบประกัน) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span><span className="text-red-500">*</span> ช่องบังคับของระบบประกัน — เว้นว่างแล้วส่งงานเข้าระบบประกันไม่ผ่าน</span>
            <span><span className="text-amber-500">*</span> บังคับเฉพาะบางกรณี (ชี้เมาส์ที่ดอกจันเพื่อดูเงื่อนไข)</span>
          </div>

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
              <span className="text-red-400">*</span>
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
                    <td className="px-4 py-2 text-gray-500">กรมธรรม์เลขที่ <Req /> :</td>
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
                    <td className="px-4 py-2 text-gray-500">ผู้เอาประกันภัย <Req /> :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="assured_name" defaultValue={report.assured_name || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">ประกันประเภท <Req /> :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="policy_type" defaultValue={report.policy_type || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">อีเมลผู้เอาประกัน :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="assured_email" defaultValue={report.assured_email || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2 text-gray-500">รหัสภัยยานยนต์ :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="risk_code" defaultValue={report.risk_code || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ค่าเสียหายส่วนแรก :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="deductible" defaultValue={report.deductible != null ? Number(report.deductible).toFixed(2) : '0.00'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  {/* ชื่ออู่/ศูนย์ซ่อม เป็นข้อความล้วน — ห้ามใส่ใน numericCols (ตัด comma จะกินชื่ออู่ที่มีลูกน้ำ) */}
                  <tr>
                    <td className="px-4 py-2 text-gray-500">ซ่อมที่ :</td>
                    <td className="px-4 py-2">{/* maxLength ตรงกับ VARCHAR(200) — ยาวเกินแล้ว Postgres ไม่ตัดปลายให้ แต่ error จนบันทึกไม่ผ่านทั้งใบ */}<input type="text" disabled={d} maxLength={200} name="repair_shop" defaultValue={report.repair_shop || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
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
                  <td className="px-4 py-2 text-gray-500">หมายเลขทะเบียน <Req /> :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="license_plate" defaultValue={report.license_plate || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">จังหวัด <Req /> :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_province" defaultValue={report.car_province || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ประเภทรถ <Req /> :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_type" value={carType} onChange={e => setCarType(e.target.value)} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      <option value="0">-- ระบุ --</option>
                      <option value="A">เก๋งเอเชีย</option>
                      <option value="E">เก๋งยุโรป</option>
                      <option value="M">รถจักรยานยนต์</option>
                      <option value="T">กระบะ</option>
                      <option value="V">รถตู้</option>
                      <option value="W">รถบรรทุก</option>
                      <option value="O">รถอื่นๆ</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-500">ยี่ห้อ :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="car_brand" defaultValue={report.car_brand || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {carBrandOptions(carType, report.car_brand).map(b => <option key={b} value={b}>{b}</option>)}
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
                {/* 3 ช่องรถไฟฟ้า — แอปมือถือเก็บมาให้อยู่แล้ว แต่หน้านี้ไม่เคยมีที่แสดง/แก้
                    (ผู้ตรวจจึงมองไม่เห็นและแก้ไม่ได้ ทั้งที่ข้อมูลมีอยู่ในระบบ) */}
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">หมายเลขแบตเตอรี่ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="ev_battery_no" defaultValue={report.ev_battery_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันเริ่มใช้แบตเตอรี่ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="ev_battery_start" defaultValue={report.ev_battery_start || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">หมายเลขเครื่องชาร์จ :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="ev_charger_no" defaultValue={report.ev_charger_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2" colSpan={2}></td>
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
                    {/* แถวนี้รวม 4 ช่องบังคับ: เพศ · คำนำหน้า · ชื่อ · นามสกุล (EMCS บล็อกทั้งชุด) */}
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ผู้ขับขี่รถประกันภัย <Req /> :</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-gray-500 shrink-0"><input type="radio" name="driver_gender" value="M" disabled={d} defaultChecked={report.driver_gender === 'M'} className="w-3.5 h-3.5" /> ชาย</label>
                        <label className="flex items-center gap-1 text-gray-500 shrink-0"><input type="radio" name="driver_gender" value="F" disabled={d} defaultChecked={report.driver_gender === 'F'} className="w-3.5 h-3.5" /> หญิง</label>
                        <select disabled={d} name="driver_title" defaultValue={report.driver_title || '0'} className={`w-auto shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          <option value="0">- คำนำหน้า -</option>
                          <option value="นาย">นาย</option>
                          <option value="นาง">นาง</option>
                          <option value="นางสาว">นางสาว</option>
                          <option value="ด.ช.">ด.ช.</option>
                          <option value="ด.ญ.">ด.ญ.</option>
                          <option value="คุณ">คุณ</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 shrink-0">ชื่อ</span>
                        <input type="text" disabled={d} name="driver_first_name" defaultValue={report.driver_first_name || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        <span className="text-gray-500 shrink-0">นามสกุล</span>
                        <input type="text" disabled={d} name="driver_last_name" defaultValue={report.driver_last_name || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">วันเกิด <Req /> :</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input type="text" disabled={d} name="driver_birthdate" defaultValue={report.driver_birthdate || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        <span className="text-gray-500 shrink-0">อายุ <Req /></span>
                        <input type="text" disabled={d} name="driver_age" defaultValue={report.driver_age != null ? report.driver_age : ''} className={`w-[60px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความสัมพันธ์กับเจ้าของรถ <Req /> :</td>
                    <td className="px-4 py-2">
                      <select disabled={d} name="driver_relation" defaultValue={report.driver_relation || '0'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option value="0">-- ระบุ --</option>
                        <option value="สามี">สามี</option>
                        <option value="ภรรยา">ภรรยา</option>
                        <option value="บุตร">บุตร</option>
                        <option value="บิดา">บิดา</option>
                        <option value="มารดา">มารดา</option>
                        <option value="นายจ้าง">นายจ้าง</option>
                        <option value="ลูกจ้าง">ลูกจ้าง</option>
                        <option value="ผู้เช่า">ผู้เช่า</option>
                        <option value="พี่ชาย">พี่ชาย</option>
                        <option value="พี่สาว">พี่สาว</option>
                        <option value="น้องชาย">น้องชาย</option>
                        <option value="น้องสาว">น้องสาว</option>
                        <option value="เจ้าของรถ">เจ้าของรถ</option>
                        <option value="หลาน">หลาน</option>
                        <option value="อา">อา</option>
                        <option value="น้า">น้า</option>
                        <option value="ลุง">ลุง</option>
                        <option value="ป้า">ป้า</option>
                        <option value="ญาติ">ญาติ</option>
                        <option value="เพื่อน">เพื่อน</option>
                        <option value="แฟน">แฟน</option>
                        <option value="พนักงาน">พนักงาน</option>
                        <option value="พี่เขย">พี่เขย</option>
                        <option value="น้องเขย">น้องเขย</option>
                        <option value="พี่สะใภ้">พี่สะใภ้</option>
                        <option value="น้องสะใภ้">น้องสะใภ้</option>
                        <option value="พนักงานผู้เช่า">พนักงานผู้เช่า</option>
                        <option value="ลุงเขย">ลุงเขย</option>
                        <option value="น้าเขย">น้าเขย</option>
                        <option value="น้าสะใภ้">น้าสะใภ้</option>
                        <option value="อาเขย">อาเขย</option>
                        <option value="อาสะใภ้">อาสะใภ้</option>
                        <option value="หุ้นส่วน">หุ้นส่วน</option>
                        <option value="บุตรหุ้นส่วน">บุตรหุ้นส่วน</option>
                        <option value="เจ้าของบริษัท">เจ้าของบริษัท</option>
                        <option value="เพื่อนบุตรเจ้าของรถ">เพื่อนบุตรเจ้าของรถ</option>
                        <option value="บุตรเขย">บุตรเขย</option>
                        <option value="หลานเขย">หลานเขย</option>
                        <option value="บุตรสะใภ้">บุตรสะใภ้</option>
                      </select>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    {/* ที่อยู่ + จังหวัด + เขต/อำเภอ บังคับทั้ง 3 ช่อง (เจอสดตอนเทส 2026-08-01) */}
                    <td className="px-4 py-2 text-gray-500">ที่อยู่ปัจจุบัน <Req /> :</td>
                    <td className="px-4 py-2" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <input type="text" disabled={d} name="driver_address" defaultValue={report.driver_address || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        <select disabled={d} name="driver_province" value={driverProv} onChange={e => { setDriverProv(e.target.value); setDriverDist('-- เขต --'); }} className={`w-[100px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select disabled={d} name="driver_district" value={driverDist} onChange={e => setDriverDist(e.target.value)} className={`w-[100px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          {districtOptions(driverProv, driverProv === report.driver_province ? report.driver_district : '').map(dt => <option key={dt} value={dt}>{dt}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">โทรศัพท์ <Req /> :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_phone" defaultValue={report.driver_phone || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">บัตรประชาชนเลขที่ <Req /> :</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input type="text" disabled={d} name="driver_id_card" defaultValue={report.driver_id_card || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                        {/* คนไทยต้องผ่าน checksum 13 หลัก · ต่างชาติขอแค่ไม่ว่าง (บัตรต่างด้าว/พาสปอร์ต
                            ไม่มีสูตรตรวจ) — แอปเก็บค่านี้อยู่แล้ว แต่หน้านี้ไม่เคยมีให้เลือก */}
                        <select disabled={d} name="driver_id_type" defaultValue={report.driver_id_type || 'thai'} className={`w-[92px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                          <option value="thai">คนไทย</option>
                          <option value="foreign">ต่างชาติ</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ใบอนุญาตขับขี่เลขที่ <Req when="ผู้ขับขี่มีใบขับขี่" /> :</td>
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_license_no" defaultValue={report.driver_license_no || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ประเภท :</td>
                    <td className="px-4 py-2">
                      <select disabled={d} name="driver_license_type" defaultValue={report.driver_license_type || '0'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option value="0">-- ระบุ --</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ">ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ</option>
                        <option value="ใบขับขี่รถจักรยานยนต์ส่วนบุคคลตลอดชีพ">ใบขับขี่รถจักรยานยนต์ส่วนบุคคลตลอดชีพ</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคลชั่วคราว">ใบขับขี่รถยนต์ส่วนบุคคลชั่วคราว</option>
                        <option value="ใบขับขี่รถจักรยานยนต์ส่วนบุคคลชั่วคราว">ใบขับขี่รถจักรยานยนต์ส่วนบุคคลชั่วคราว</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคล 5 ปีต่ออายุ">ใบขับขี่รถยนต์ส่วนบุคคล 5 ปีต่ออายุ</option>
                        <option value="ใบขับขี่รถยนต์สาธารณะ">ใบขับขี่รถยนต์สาธารณะ</option>
                        <option value="ใบขับขี่สากล">ใบขับขี่สากล</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคลหนึ่งปีต่ออายุ">ใบขับขี่รถยนต์ส่วนบุคคลหนึ่งปีต่ออายุ</option>
                        <option value="ใบขับขี่รถจักรยานยนต์ส่วนบุคคลหนึ่งปี">ใบขับขี่รถจักรยานยนต์ส่วนบุคคลหนึ่งปี</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคล 7 ปีต่ออายุ">ใบขับขี่รถยนต์ส่วนบุคคล 7 ปีต่ออายุ</option>
                        <option value="ใบขับขี่รถยนต์ส่วนบุคคล">ใบขับขี่รถยนต์ส่วนบุคคล</option>
                        <option value="ใบขับขี่รถจักรยานยนต์ส่วนบุคคล">ใบขับขี่รถจักรยานยนต์ส่วนบุคคล</option>
                        <option value="ใบขับขี่ขนส่งชนิดที่1">ใบขับขี่ขนส่งชนิดที่1</option>
                        <option value="ใบขับขี่ขนส่งชนิดที่2">ใบขับขี่ขนส่งชนิดที่2</option>
                        <option value="ใบขับขี่ขนส่งชนิดที่3">ใบขับขี่ขนส่งชนิดที่3</option>
                        <option value="ใบอนุญาติขับขี่ชนิดที่4">ใบอนุญาติขับขี่ชนิดที่4</option>
                        <option value="ไม่มีใบขับขี่">ไม่มีใบขับขี่</option>
                        <option value="ใบขับขี่รถยนต์สามล้อส่วนบุคคลสาธารณะ">ใบขับขี่รถยนต์สามล้อส่วนบุคคลสาธารณะ</option>
                        <option value="ใบขับขี่รถยนต์สามล้อส่วนบุคคลชั่วคราว">ใบขับขี่รถยนต์สามล้อส่วนบุคคลชั่วคราว</option>
                        <option value="ใบอนุญาตเป็นผู้ขับรถทุกประเภท">ใบอนุญาตเป็นผู้ขับรถทุกประเภท</option>
                        <option value="อื่นๆ">อื่นๆ</option>
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
                    <td className="px-4 py-2"><input type="text" disabled={d} name="driver_ticket" defaultValue={report.driver_ticket || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    {/* ต้องมีรายการความเสียหายอย่างน้อย 1 รายการ (ผู้สำรวจเลือกจากแอป) */}
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความเสียหายรถประกันภัย <Req /> :</td>
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
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่เกิดเหตุและเวลาประมาณ <Req /> :</td>
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
                  {/* สถานที่ + จังหวัด + เขต/อำเภอ บังคับทั้ง 3 (จังหวัด/อำเภอ = ตัวที่บอทใช้หาเรทด้วย) */}
                  <td className="px-4 py-2 text-gray-500">สถานที่เกิดเหตุ <Req /> :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_place" defaultValue={report.acc_place || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2" colSpan={2}>
                    <div className="flex items-center gap-1">
                      <select disabled={d} name="acc_province" value={accProv} onChange={e => { setAccProv(e.target.value); setAccDist('-- เขต --'); }} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select disabled={d} name="acc_district" value={accDist} onChange={e => setAccDist(e.target.value)} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        {districtOptions(accProv, accProv === report.acc_province ? report.acc_district : '').map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ลักษณะการเกิดเหตุ <Req /> :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_cause" defaultValue={report.acc_cause || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {ACC_CAUSE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ลักษณะความเสียหาย <Req /> :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_damage_type" defaultValue={report.acc_damage_type || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {ACC_DAMAGE_TYPE_OPTIONS.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {/* ตรงกับช่อง "รายละเอียดการเกิดเหตุ" แท็บข้อมูลทั่วไปของ EMCS (ACC_DETAIL) */}
                  <td className="px-4 py-2 text-gray-500 align-top">รายละเอียดการเกิดเหตุ <Req /> :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <textarea disabled={d} name="acc_detail" defaultValue={report.acc_detail || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm min-h-[80px]`} rows={4} />
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ฝ่ายประมาท <Req /> :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รถประกันเป็นฝ่ายผิด" disabled={d} defaultChecked={report.acc_fault === 'รถประกันเป็นฝ่ายผิด'} className="w-3.5 h-3.5" /> รถประกันเป็นฝ่ายผิด</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รถประกันเป็นฝ่ายถูกและผิด" disabled={d} defaultChecked={report.acc_fault === 'รถประกันเป็นฝ่ายถูกและผิด'} className="w-3.5 h-3.5" /> รถประกันเป็นฝ่ายถูกและผิด</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รถคู่กรณีเป็นฝ่ายผิด" disabled={d} defaultChecked={report.acc_fault === 'รถคู่กรณีเป็นฝ่ายผิด'} className="w-3.5 h-3.5" /> รถคู่กรณีเป็นฝ่ายผิด</label>
                      <span className="text-gray-500">คู่กรณีคันที่ <Req when="เลือก &quot;รถคู่กรณีเป็นฝ่ายผิด&quot; (ต้องติ๊กการเรียกร้องอย่างน้อย 1 ข้อด้วย)" /></span>
                      <input type="text" disabled={d} name="acc_fault_opponent_no" defaultValue={report.acc_fault_opponent_no ?? ''} className={`w-[40px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ประมาทร่วม" disabled={d} defaultChecked={report.acc_fault === 'ประมาทร่วม'} className="w-3.5 h-3.5" /> ประมาทร่วม</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="รอสรุปผลคดี" disabled={d} defaultChecked={report.acc_fault === 'รอสรุปผลคดี'} className="w-3.5 h-3.5" /> รอสรุปผลคดี</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ยกเลิกการเคลม" disabled={d} defaultChecked={report.acc_fault === 'ยกเลิกการเคลม'} className="w-3.5 h-3.5" /> ยกเลิกการเคลม</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ไปถึงแล้วไม่พบ" disabled={d} defaultChecked={report.acc_fault === 'ไปถึงแล้วไม่พบ' || report.acc_fault === 'ไปถึง แล้วไม่พบ'} className="w-3.5 h-3.5" /> ไปถึงแล้วไม่พบ</label>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ผู้แจ้ง :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_reporter" defaultValue={report.acc_reporter || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">ผู้สำรวจภัย <Req /> :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_surveyor" defaultValue={report.acc_surveyor || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <select disabled={d} name="acc_surveyor_branch" className={`w-[70px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                        <option>-- ระบุ --</option>
                      </select>
                      <span className="text-gray-500 shrink-0">โทรศัพท์ <Req /> :</span>
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
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">การเรียกร้องค่าเสียหายจากคู่กรณี <Req when="เลือก &quot;รถคู่กรณีเป็นฝ่ายผิด&quot; — ต้องติ๊กอย่างน้อย 1 ข้อ" /> :</td>
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
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ชื่อพนักงานสอบสวน <Req when="ฝ่ายประมาท = &quot;รอสรุปผลคดี&quot; หรือมีการแจ้งความ" /> :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_police_name" defaultValue={report.acc_police_name || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">สถานีตำรวจ <Req when="ฝ่ายประมาท = &quot;รอสรุปผลคดี&quot; หรือมีการแจ้งความ" /> :</td>
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

          {/* ===== Phase 3: คู่กรณี / ผู้บาดเจ็บ / ทรัพย์สินเสียหาย / แผนภาพความเสียหายรถประกัน (read-only) ===== */}
          {(() => {
            const opposingParties = toArray(report.opposing_parties);
            const injuredPersons = toArray(report.injured_persons);
            const damagedProperty = toArray(report.damaged_property);
            const insuredDamage = toArray(report.insured_damage);
            return (
              <>
                {/* คู่กรณี — โชว์เสมอตอนกด "แก้ไข" (ไม่งั้นเคสที่ยังไม่มีคู่กรณีก็เพิ่มไม่ได้) */}
                {(opposingParties.length > 0 || isEditing) && (
                  <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
                    <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
                      <span className="font-bold">::: คู่กรณี ({isEditing ? opponents.length : opposingParties.length} คัน)</span>
                    </div>
                    {isEditing ? (
                      <div className="p-4"><OpponentEditor items={opponents} onChange={setOpponents} /></div>
                    ) : (
                    <div className="p-4 space-y-4">
                      {opposingParties.map((op: any, idx: number) => {
                        const dmg = toArray(op?.damage);
                        const driverName = [op?.title, op?.first_name, op?.last_name].filter(Boolean).join(' ');
                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-700">คู่กรณีคันที่ {idx + 1}</span>
                              {op?.kfk === true && (
                                <span className="inline-block bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-xs font-medium">KFK</span>
                              )}
                              {/* 8 ช่องบังคับรายคัน — สกัดจาก validator จริง vlidOpoCar (ส่วน base
                                  ก่อน switch = บังคับทุกบริษัท) · ครึ่งหนึ่งเป็น dropdown/วันที่/ตัวเลข
                                  ที่ใส่ "-" แทนไม่ได้ ขาดแล้วบอทค้างกลางทางที่หน้าคู่กรณี
                                  ⚠️ ต้องตรงกับ OPPONENT_REQUIRED ใน RecordEditors.tsx */}
                              {(() => {
                                const need: [string, string][] = [
                                  ['owner_name', 'เจ้าของรถ'], ['plate', 'ทะเบียน'], ['province', 'จังหวัด'],
                                  ['insurer', 'มีประกันภัยที่'], ['policy_no', 'กรมธรรม์'],
                                  ['birthdate', 'วันเกิด'], ['age', 'อายุ'], ['car_type', 'ประเภทรถ'],
                                ];
                                const missing = need.filter(([k]) => !String(op?.[k] ?? '').trim()).map(([, l]) => l);
                                return missing.length > 0 ? (
                                  <span className="text-xs text-red-600" title="ระบบประกันบังคับช่องเหล่านี้รายคัน — ขาดแล้วนำเข้าไม่ผ่าน · กด &quot;แก้ไขทั้งหมด&quot; เพื่อเติม">
                                    ⚠ ขาดช่องบังคับ: {missing.join(' · ')}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <div className="p-3 space-y-3">
                              {/* เจ้าของ/รถ */}
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1.5">เจ้าของ / รถ</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                                  <ReadItem label="เจ้าของรถ" value={op?.owner_name} />
                                  <ReadItem label="ทะเบียน" value={[op?.plate, op?.province].filter(Boolean).join(' ')} />
                                  <ReadItem label="ประเภทรถ" value={op?.car_type} />
                                  <ReadItem label="ยี่ห้อ / รุ่น" value={[op?.car_brand, op?.car_model].filter(Boolean).join(' ')} />
                                  <ReadItem label="สีรถ" value={op?.car_color} />
                                  <ReadItem label="ที่อยู่เจ้าของ" value={op?.owner_address} />
                                </div>
                              </div>
                              {/* ผู้ขับ */}
                              <div className="border-t border-gray-100 pt-2">
                                <p className="text-xs font-semibold text-gray-500 mb-1.5">ผู้ขับ</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                                  <ReadItem label="ชื่อผู้ขับ" value={driverName} />
                                  <ReadItem label="ความสัมพันธ์" value={op?.relation} />
                                  <ReadItem label="อายุ" value={op?.age} />
                                  <ReadItem label="โทรศัพท์" value={op?.phone} />
                                  <ReadItem label="เลขบัตรประชาชน" value={op?.cid} />
                                  <ReadItem label="ใบขับขี่เลขที่" value={op?.license_no} />
                                </div>
                              </div>
                              {/* ประกัน */}
                              <div className="border-t border-gray-100 pt-2">
                                <p className="text-xs font-semibold text-gray-500 mb-1.5">ประกัน</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                                  <ReadItem label="บริษัทประกัน" value={op?.insurer} />
                                  <ReadItem label="กรมธรรม์เลขที่" value={op?.policy_no} />
                                  <ReadItem label="เลขที่เคลม" value={op?.claim_no} />
                                  <ReadItem label="ประเภทประกัน" value={op?.policy_type} />
                                </div>
                              </div>
                              {/* ความเสียหาย */}
                              <div className="border-t border-gray-100 pt-2">
                                <p className="text-xs font-semibold text-gray-500 mb-1.5">ความเสียหาย</p>
                                <DamageChips items={dmg} />
                                <div className="mt-2">
                                  <ReadItem label="ค่าเสียหายประมาณ" value={currencyFromString(op?.estimated_cost)} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {/* ผู้บาดเจ็บ — แก้ได้ตอนกด "แก้ไข" (โชว์เสมอตอนแก้ ไม่งั้นเคสที่ว่างจะเพิ่มไม่ได้) */}
                {(injuredPersons.length > 0 || isEditing) && (
                  <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
                    <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
                      <span className="font-bold">::: ผู้บาดเจ็บ ({isEditing ? injured.length : injuredPersons.length} คน)</span>
                    </div>
                    {isEditing ? (
                      <div className="p-4"><InjuredEditor items={injured} onChange={setInjured} /></div>
                    ) : (
                    <div className="p-4 space-y-4">
                      {injuredPersons.map((p: any, idx: number) => {
                        const genderLabel = p?.gender === 'M' ? 'ชาย' : p?.gender === 'F' ? 'หญิง' : (p?.gender || '');
                        const nameWithGender = [p?.name, genderLabel ? `(${genderLabel})` : ''].filter(Boolean).join(' ');
                        const treatRange = [p?.treat_from, p?.treat_to].filter(Boolean).join(' – ');
                        const woundColor = WOUND_LEVEL_COLORS[p?.wound_level] || 'bg-gray-100 text-gray-700';
                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-700">ผู้บาดเจ็บคนที่ {idx + 1}</span>
                              {p?.person_type && (
                                <span className="text-xs text-gray-500">{p.person_type}</span>
                              )}
                              {p?.wound_level && (
                                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${woundColor}`}>{p.wound_level}</span>
                              )}
                            </div>
                            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                              <ReadItem label="ชื่อ" value={nameWithGender} />
                              <ReadItem label="ความสัมพันธ์" value={p?.relation} />
                              <ReadItem label="อายุ" value={p?.age} />
                              <ReadItem label="เลขบัตรประชาชน" value={p?.cid} />
                              <ReadItem label="เลขทะเบียนรถ" value={p?.car_reg} />
                              <ReadItem label="อาชีพ" value={p?.occupation} />
                              <ReadItem label="ทำงานที่" value={p?.work_place} />
                              <ReadItem label="ตำแหน่ง" value={p?.position} />
                              <ReadItem label="รายได้" value={p?.income} />
                              <ReadItem label="โทรศัพท์" value={p?.phone} />
                              <ReadItem label="โรงพยาบาล" value={p?.hospital} />
                              <ReadItem label="ระยะเวลารักษา" value={treatRange} />
                              <ReadItem label="ค่ารักษา" value={currencyFromString(p?.treat_cost)} />
                              <div className="col-span-2 md:col-span-4">
                                <ReadItem label="อาการ" value={p?.symptom} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {/* ทรัพย์สินเสียหาย — แก้ได้ตอนกด "แก้ไข" */}
                {(damagedProperty.length > 0 || isEditing) && (
                  <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
                    <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
                      <span className="font-bold">::: ทรัพย์สินเสียหาย ({isEditing ? property.length : damagedProperty.length} ชิ้น)</span>
                    </div>
                    {isEditing ? (
                      <div className="p-4"><PropertyEditor items={property} onChange={setProperty} /></div>
                    ) : (
                    <div className="p-4 space-y-4">
                      {damagedProperty.map((item: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200">
                            <span className="text-sm font-semibold text-gray-700">รายการที่ {idx + 1}</span>
                          </div>
                          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                            <ReadItem label="ทรัพย์สิน" value={item?.item} />
                            <ReadItem label="เจ้าของ" value={item?.owner_name} />
                            <ReadItem label="โทรศัพท์เจ้าของ" value={item?.owner_phone} />
                            <ReadItem label="ค่าเสียหายประมาณ" value={currencyFromString(item?.estimated_cost)} />
                            <div className="col-span-2 md:col-span-4">
                              <ReadItem label="ที่อยู่เจ้าของ" value={item?.owner_address} />
                            </div>
                            <div className="col-span-2 md:col-span-2">
                              <ReadItem label="สาเหตุ" value={item?.cause} />
                            </div>
                            <div className="col-span-2 md:col-span-2">
                              <ReadItem label="รายละเอียด" value={item?.detail} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                )}

                {/* ความเสียหายรถประกัน — แก้ได้ตอนกด "แก้ไข" (โชว์เสมอ ไม่งั้นเคสที่ว่างจะเพิ่มไม่ได้) */}
                {(insuredDamage.length > 0 || isEditing) && (
                  <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
                    <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
                      <span className="font-bold">::: ความเสียหายรถประกัน</span>
                    </div>
                    <div className="p-4">
                      {isEditing
                        ? <DamageEditor items={damage} onChange={setDamage} />
                        : <DamageChips items={insuredDamage} />}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

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

      {/* การตรวจสอบ — กรอกได้เลยไม่ต้องกดแก้ไข */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
          <span className="font-bold">::: การตรวจสอบ</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">ผลการดำเนินงาน</label>
              <textarea name="survey_result" defaultValue={report?.survey_result || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm min-h-[150px]" rows={6} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">ความเห็นของผู้ตรวจสอบ</label>
              <textarea name="review_comment" defaultValue={report?.review_comment || review?.comment || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm min-h-[150px]" rows={6} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">ความเห็นของเซอร์เวย์</label>
              <textarea name="surveyor_comment" defaultValue={report?.surveyor_comment || review?.surveyor_comment || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm min-h-[150px]" rows={6} />
            </div>
          </div>

          {/* หมายเหตุของผู้สำรวจ — แอปเก็บมาให้ตั้งแต่หน้างาน แต่หน้านี้ไม่เคยแสดง
              ผู้ตรวจจึงไม่เห็นสิ่งที่ช่างจดไว้เลย · **คนละช่องกับ 3 ช่องข้างบน**
              ช่องนี้เป็นโน้ตภายใน ไม่ถูกส่งเข้าระบบประกัน (จงใจ) */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              หมายเหตุเพิ่มเติม <span className="text-xs text-gray-400">(ผู้สำรวจจดจากหน้างาน · ไม่ส่งเข้าระบบประกัน)</span>
            </label>
            <textarea name="notes" defaultValue={report?.notes || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm" rows={2} />
          </div>
        </div>
      </div>

      {/* ค่าใช้จ่าย + ปุ่มอนุมัติ — กรอกได้เลยไม่ต้องกดแก้ไข */}
      <div className="flex gap-6">
        <div className="w-1/2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm flex items-center justify-between">
              <span className="font-bold">::: ค่าใช้จ่าย</span>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">ครั้งที่</span>
                <span className="bg-white text-gray-800 rounded px-2.5 py-0.5 text-sm font-bold">{visitCount}</span>
                <input type="hidden" name="expense_count" value={visitCount} />
              </div>
            </div>
          <div className="p-4">
            <div>
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-gray-600 font-semibold">รายละเอียด</th>
                    <th className="px-3 py-2 text-center text-gray-600 font-semibold">จำนวน</th>
                    <th className="px-3 py-2 text-center text-gray-600 font-semibold">ราคา/หน่วย<div className="text-[10px] font-normal text-gray-400">เรียกเก็บประกัน</div></th>
                    {/* ฝั่งจ่ายพนักงาน — ระบบประกันไม่มีช่องนี้ ต้องเก็บที่ระบบเราเท่านั้น */}
                    <th className="px-3 py-2 text-center text-blue-700 font-semibold">ราคาพนักงาน<div className="text-[10px] font-normal text-blue-400">จ่ายผู้สำรวจ</div></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าบริการ</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="service_fee_count" defaultValue={ex.service_fee_count || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">ครั้ง</span></div></td>
                    <td className="px-3 py-2"><input type="text" name="service_fee_price" defaultValue={ex.service_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_service_fee" defaultValue={String(pay?.saved?.service_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าเดินทาง/ค่าพาหนะ</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="travel_fee_count" defaultValue={ex.travel_fee_count || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">ครั้ง</span></div></td>
                    <td className="px-3 py-2"><input type="text" name="travel_fee_price" defaultValue={ex.travel_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_travel_fee" defaultValue={String(pay?.saved?.travel_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่ารูปถ่าย</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="photo_fee_count" defaultValue={ex.photo_fee_count || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">รูป</span></div></td>
                    <td className="px-3 py-2"><input type="text" name="photo_fee_price" defaultValue={ex.photo_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_photo_fee" defaultValue={String(pay?.saved?.photo_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าโทรศัพท์</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" name="phone_fee" defaultValue={ex.phone_fee || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_phone_fee" defaultValue={String(pay?.saved?.phone_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าประกันตัว</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" name="bail_fee" defaultValue={ex.bail_fee || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_bail_fee" defaultValue={String(pay?.saved?.bail_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าเรียกร้อง</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="claim_fee_percent" defaultValue={ex.claim_fee_percent || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">%</span></div></td>
                    <td className="px-3 py-2"><input type="text" name="claim_fee_price" defaultValue={ex.claim_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_claim_fee" defaultValue={String(pay?.saved?.claim_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าคัดประจำวัน</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" name="daily_record_fee" defaultValue={ex.daily_record_fee || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_daily_fee" defaultValue={String(pay?.saved?.daily_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าใช้จ่ายอื่นๆ</td>
                    <td className="px-3 py-2"><input type="text" name="other_fee_detail" defaultValue={ex.other_fee_detail || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm" /></td>
                    <td className="px-3 py-2"><input type="text" name="other_fee_price" defaultValue={ex.other_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td><td className="px-3 py-2"><input type="text" disabled={d} name="pay_other_fee" defaultValue={String(pay?.saved?.other_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td>
                  </tr>
                  {/* หักเงิน — ระบบเดิมไม่มีแถวนี้ ต้องยืมช่อง "ค่าใช้จ่ายอื่นๆ" มาใช้
                      เพราะแทรกช่องใหม่ลงฟอร์มระบบเก่าไม่ได้ · เว็บนี้เราคุมเอง จึงแยกให้ถูกความหมาย */}
                  <tr className="border-b border-gray-100 bg-rose-50/40">
                    <td className="px-3 py-2 text-rose-800 font-medium">หักเงิน</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={d} name="deduct_late" defaultChecked={Boolean(pay?.saved?.deduct_late)} />ส่งช้า
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={d} name="deduct_docs" defaultChecked={Boolean(pay?.saved?.deduct_docs)} />เอกสารไม่ครบ
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" disabled={d} name="deduct_reason" placeholder="เหตุผลอื่น"
                        defaultValue={String(pay?.saved?.deduct_reason ?? '')}
                        className={`w-full border rounded px-2 py-1 text-sm ${d ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" disabled={d} name="pay_deduct_fee" defaultValue={String(pay?.saved?.deduct_fee ?? '')}
                        className={`w-full border rounded px-2 py-1 text-sm text-right ${d ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-rose-50 border-rose-300 text-rose-900'}`} />
                    </td>
                  </tr>
                </tbody>
              </table>
              {/* ── ตัวปรับเรทฝั่งพนักงาน ── ของเดิมอยู่ในส่วนขยายเบราว์เซอร์บนหน้าระบบเก่า */}
              <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={d} name="out_of_area" defaultChecked={Boolean(pay?.saved?.out_of_area)} />
                    <span className="text-gray-700">นอกพื้นที่</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={d} name="out_of_hours" defaultChecked={Boolean(pay?.saved?.out_of_hours)} />
                    <span className="text-gray-700">นอกเวลา</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={d} name="special_tumbon" defaultChecked={Boolean(pay?.saved?.special_tumbon)} />
                    <span className="text-gray-700">ตำบลพิเศษ</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-gray-700">ค่าคัดประจำวัน</span>
                    <select disabled={d} name="daily_check" defaultValue={String(pay?.saved?.daily_check ?? '')}
                      className={`border rounded px-2 py-1 text-sm ${d ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`}>
                      <option value="">— ไม่มี —</option>
                      <option value="ถูก">ถูก</option>
                      <option value="ผิด">ผิด</option>
                      <option value="รอผล">รอผล</option>
                    </select>
                  </label>
                </div>
                {pay?.area && (pay.area.resolved ? (
                  <div className="mt-2 text-xs text-gray-500">
                    เรทของ {pay.area.province_name} / {pay.area.district_name}
                    {pay.area.team ? ` · ทีม${pay.area.team}` : ''}
                    {pay.suggest?.service_fee != null ? ` · ระบบแนะนำค่าบริการ ${pay.suggest.service_fee} บาท` : ''}
                    {pay.saved?.total != null ? ` · รวมที่บันทึกไว้ ${pay.saved.total} บาท` : ''}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    แปลงจังหวัด/อำเภอของเคสนี้เป็นรหัสพื้นที่ไม่ได้ — หาเรทอัตโนมัติไม่ได้ กรอกยอดเองได้ตามปกติ
                  </div>
                ))}
              </div>

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
            {!isEditing && (
              <button type="button" onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">แก้ไขทั้งหมด</button>
            )}
            {isEditing && (
              <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-gray-400 text-white rounded-lg font-medium hover:bg-gray-500 transition">ยกเลิก</button>
            )}
            <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            {!review && (
              <button type="button" onClick={async () => {
                const ok = await handleSave();
                if (!ok) return; // บันทึกไม่ผ่าน → อย่าอนุมัติทับด้วยข้อมูลเก่า
                try {
                  await api.post(`/api/cases/${caseData.id}/review`, {});
                  setSaveMsg('อนุมัติสำเร็จ');
                  onReviewSubmitted();
                } catch (e) {
                  const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                  setSaveMsg('อนุมัติไม่สำเร็จ: ' + (msg || 'เกิดข้อผิดพลาด'));
                }
              }} disabled={saving} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition">
                อนุมัติ
              </button>
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
