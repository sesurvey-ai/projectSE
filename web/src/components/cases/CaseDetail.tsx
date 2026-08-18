'use client';

import { useState, useRef, useEffect } from 'react';
import PhotoGallery from './PhotoGallery';
import ReviewForm from '@/components/review/ReviewForm';
import { PROVINCE_OPTIONS, carBrandOptions, CAR_COLOR_OPTIONS, EV_TYPE_OPTIONS, ACC_CAUSE_OPTIONS, ACC_DAMAGE_TYPE_OPTIONS } from './caseOptions';
import { districtOptions } from './districtOptions';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import DamageEditor, { DamageItem } from './DamageEditor';
import { InjuredEditor, PropertyEditor, OpponentEditor, dropEmptyRecords, dropEmptyOpponents, emcsBadChars, RecordItem, LooseRecord } from './RecordEditors';

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

/**
 * บริษัทประกันที่รับงานจริง — value ต้องตรงกับที่ `resolve_insurer_code` ของบอทรู้จัก
 * (se-autokey/autokey/insurer_map.py) ไม่งั้นบอทหยุดและฟ้อง ไม่นำเข้ามั่ว
 * เพิ่มบริษัทใหม่: เติมที่นี่ + หน้า "นำเข้าจากไฟล์ XML" + เช็ครหัสใน insurer_map.py
 */
const INSURER_OPTIONS = [
  'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)',
  'ไอโออิกรุงเทพประกันภัย',
];

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
const Req = ({ when, of }: { when?: string; of?: string }) => (
  <span
    // `of` = ชื่อช่อง (name=) ที่ดอกจันตัวนี้คุม — คั่นด้วย , ถ้าคุมหลายช่อง
    // ⛔ ต้องใส่ทุกตัว: ไม่ใส่แล้วจะตกไปใช้วิธีเดาจากตำแหน่ง DOM ซึ่งพังทันทีที่เปลี่ยนเลย์เอาต์
    data-req-of={of}
    className={when ? 'text-amber-500 ml-0.5 req-mark-when' : 'text-red-500 ml-0.5 req-mark'}
    title={when
      ? `บังคับเมื่อ ${when} — ระบบประกันไม่รับถ้าเว้นว่างในกรณีนี้`
      : 'ช่องบังคับของระบบประกัน — เว้นว่างแล้วบันทึกเข้าระบบประกันไม่ผ่าน'}
  >*</span>
);

/**
 * ไฮไลต์ "ช่องบังคับที่ยังว่าง" ด้วยกรอบแดง + นับจำนวนไว้โชว์หัวหน้า
 *
 * ทำเป็น pass เดียวหลัง render แทนการไปแก้ className ทีละช่อง เพราะหน้านี้มีช่องบังคับ
 * ~49 ช่องกระจายอยู่ทั่วฟอร์ม และเพิ่มขึ้นเรื่อย ๆ — ผูกกับดอกจันที่มีอยู่แล้วทำให้
 * ช่องบังคับที่เพิ่มวันหลังได้กรอบแดงเองโดยไม่ต้องมาแก้ที่นี่ซ้ำ
 *
 * นับเฉพาะดอกจัน**แดง** (บังคับเสมอ) — ดอกจันเหลืองเป็นแบบมีเงื่อนไข ไฮไลต์แล้วจะหลอก
 */
const RING = ['border-red-400', 'ring-1', 'ring-red-300', 'bg-red-50'];
// พื้นหลังเดิมของช่อง (bg-white ตอนแก้ได้ / bg-gray-100 ตอนล็อก) — ต้องถอดออกตอนทาแดง
// ไม่งั้นชนกันเองแล้วแล้วแต่ลำดับใน CSS ว่าใครชนะ (ไม่ใช่ลำดับใน class attribute)
const BG_ORIG = ['bg-white', 'bg-gray-100'];
/**
 * className มาตรฐานของช่องกรอก
 * ⚠️ ต้องมี `border-gray-300` + `bg-white`/`bg-gray-100` เสมอ — ตัวทากรอบแดงสลับคลาส
 *    ชุดนี้ (ดู RING / BG_ORIG) เปลี่ยนชื่อคลาสเมื่อไหร่ กรอบแดงจะทาไม่ติดเงียบ ๆ
 */
const CTL = (locked: boolean) =>
  `w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${locked ? 'bg-gray-100' : 'bg-white'} text-sm`;
/**
 * ช่อง "ชื่อคน" ในฟอร์มหลักที่ EMCS มีตัวกรองอักขระติดอยู่
 * ต้องตรงกับ `emcsNameWarnings()` ฝั่ง backend (xmlExport.service.ts)
 * ⚠️ "ผู้เอาประกัน" (assured_name) **ไม่มี** ตัวกรองนี้ — ตรวจแล้ว ไม่ต้องใส่
 */
/**
 * แถบหัวหมวด — ชื่อหมวดตามที่ดีไซน์ใหม่จัดไว้ + ป้ายบอกว่าหมวดนี้ยังกรอกไม่ครบ
 *
 * ⛔ **ห้ามใส่ปุ่มยุบ/ซ่อนหมวดกลับเข้ามา** (user เคาะ 18/08/69)
 *    เคยทำเป็นโหมดสรุป (ยุบหมวดที่กรอกครบ) แล้วถอดออก — เหตุผล: หมวดที่ถูกยุบไว้
 *    คือหมวดที่ผู้ตรวจจะไม่เปิดดู แล้วปล่อยข้อมูลผิดผ่านไปได้
 *    หน้านี้เป็นหน้า "ตรวจ" ต้องเห็นทุกช่องเสมอ · แถบนี้มีไว้ช่วยหาที่ ไม่ได้ซ่อนอะไร
 */
/**
 * ช่องกรอกแบบการ์ด — ป้ายเล็กด้านบน ช่องด้านล่าง (เลย์เอาต์ตามดีไซน์ใหม่)
 *
 * แทนตาราง 4 คอลัมน์แบบเดิมที่เป็น `ป้าย : [ช่อง]` เรียงข้างกัน
 * ⚠️ className ของตัวช่องต้องเหมือนเดิมเป๊ะ (`border-gray-300` + `bg-white`/`bg-gray-100`)
 *    ตัวทากรอบแดงสลับคลาสพวกนี้อยู่ — เปลี่ยนแล้วกรอบแดงจะทาไม่ติด
 */
function F({ label, req, span, children }: {
  label: string; req?: React.ReactNode; span?: 2 | 4; children: React.ReactNode;
}) {
  // เขียนคลาสเต็มทั้งชุด ห้ามต่อสตริง — Tailwind อ่านซอร์สแบบข้อความ ต่อเองแล้วไม่ผลิต class ให้
  const w = span === 4 ? 'col-span-2 md:col-span-4' : span === 2 ? 'col-span-2 md:col-span-2 min-w-0' : 'min-w-0';
  return (
    <div className={w}>
      <label className="block text-xs text-gray-500 mb-1">{label}{req ? <> {req}</> : null}</label>
      {children}
    </div>
  );
}

function SectionBar({ title, gap }: { title: string; gap: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-1.5 ${
      gap ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-gray-50'}`}>
      <span className="text-sm font-semibold text-gray-700">{title}</span>
      {gap && (
        <span className="text-[11px] font-medium text-red-700 bg-white border border-red-200 rounded px-1.5">
          ยังกรอกไม่ครบ
        </span>
      )}
    </div>
  );
}

/** ชื่อจังหวะในลำดับเวลา — ใช้ทั้งการ์ดลำดับเวลาและข้อความ "ยังอนุมัติไม่ได้" */
const TL_LABEL: Record<string, string> = {
  acc_date: 'เกิดเหตุ',
  acc_customer_report_date_val: 'ลูกค้าแจ้ง บ.ประกัน',
  acc_insurance_notify_date_val: 'บ.ประกันแจ้งสำรวจภัย',
  acc_survey_arrive_date_val: 'ถึงที่เกิดเหตุ',
  acc_survey_complete_date_val: 'สำรวจภัยเสร็จ',
};
const EMCS_NAME_FIELDS = [
  'acc_reporter', 'acc_surveyor', 'acc_police_name',
  'driver_name', 'driver_first_name', 'driver_last_name',
];
// สีเตือนของช่องบังคับ**แบบมีเงื่อนไข** — แดง = บังคับตอนนี้ · เหลือง = ยังไม่บังคับแต่ยังว่าง
// เขียนเป็นสตริงเต็มทั้งชุด (ห้ามต่อสตริงเอง) ไม่งั้น Tailwind ไม่ผลิต class ให้ตอน build
const HL_CLS = {
  red: 'border-red-400 ring-1 ring-red-300 bg-red-50',
  amber: 'border-amber-400 ring-1 ring-amber-200 bg-amber-50',
} as const;

/**
 * ดอกจัน 1 ตัว คุม "ช่องของมันเอง" เท่านั้น
 *
 * ⛔ เดิมถอยขึ้นไปจนถึง <tr> แล้วคว้าทุก input ในแถว — แต่เลย์เอาต์หน้านี้ยัด 2-3 คู่
 *    ป้าย/ช่อง ไว้ในแถวเดียว เช่น
 *      <td>ผู้แจ้ง</td><td>[ช่อง]</td><td>ผู้สำรวจภัย *</td><td>[ช่อง]</td>
 *    ดอกจันของ "ผู้สำรวจภัย" จึงไปทาแดงให้ "ผู้แจ้ง" ที่ไม่ได้บังคับด้วย
 *    ตอนเป็นแค่กรอบแดงก็แค่เตือนหลอก · พอเอาไปบล็อกปุ่มอนุมัติ = อนุมัติไม่ได้
 *    ทั้งที่ข้อมูลครบ (เจอจริง 15/08/69 เคส #141 ขึ้นแดง 2 ช่อง ทั้งที่ไม่ขาดอะไร)
 */
function fieldsOfMark(mark: Element, form?: HTMLFormElement | null): HTMLElement[] {
  const q = (el: Element): HTMLElement[] =>
    Array.prototype.slice.call(el.querySelectorAll('input,select,textarea')) as HTMLElement[];

  // ── ทางหลัก: ดอกจันบอกเองว่าคุมช่องไหน ──
  // ผูกด้วยชื่อช่องแทนตำแหน่งใน DOM — ย้ายเลย์เอาต์/เปลี่ยนตารางเป็นการ์ดแล้วยังถูกเสมอ
  // (วิธีเดาจากตำแหน่งข้างล่างเคยทำให้ดอกจันไปทาแดงช่องข้าง ๆ จนกดอนุมัติไม่ได้ — เคส #141)
  const of = mark.getAttribute('data-req-of');
  if (of && form) {
    const out: HTMLElement[] = [];
    for (const name of of.split(',').map((s) => s.trim()).filter(Boolean)) {
      const els = form.querySelectorAll(`[name="${name}"]`);
      for (const el of Array.prototype.slice.call(els) as HTMLElement[]) out.push(el);
    }
    return out;
  }

  const cell = mark.closest('td');
  if (cell) {
    const own = q(cell);          // ป้ายกับช่องอยู่ช่องตารางเดียวกัน
    if (own.length) return own;
    let sib = cell.nextElementSibling;   // เลย์เอาต์ปกติ: ป้ายอยู่ td ก่อนหน้าช่อง
    for (let i = 0; sib && i < 2; i++) {
      const f = q(sib);
      if (f.length) return f;
      sib = sib.nextElementSibling;
    }
    return [];                    // อยู่ในตารางแต่หาช่องไม่เจอ — อย่าเดาไปทั้งแถว
  }
  // บล็อกที่ไม่ได้ใช้ตาราง — ถอยขึ้นหาแถบที่ครอบใกล้สุดที่มีช่อง (พฤติกรรมเดิม)
  let n: Element | null = mark;
  for (let hop = 0; n && hop < 5; hop++) {
    const row: Element | null = n.parentElement;
    if (row) {
      const f = q(row);
      if (f.length) return f;
    }
    n = n.parentElement;
  }
  return [];
}

const isBlank = (el: HTMLElement) => {
  const v = (el as HTMLInputElement).value ?? '';
  if (el instanceof HTMLSelectElement) {
    return !v || v === '0' || /^--/.test(el.options[el.selectedIndex]?.text ?? '');
  }
  if ((el as HTMLInputElement).type === 'radio' || (el as HTMLInputElement).type === 'checkbox') return false;
  return !v.trim();
};

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
  /**
   * ทุกช่องพิมพ์ได้ทันที ไม่ต้องกด "แก้ไขทั้งหมด" ก่อน (user เคาะ 17/08/69)
   *
   * เดิมหน้าเปิดมาเป็นโหมดอ่าน ต้องกดปุ่มก่อนถึงจะพิมพ์ได้ — ผู้ตรวจเห็นช่องแดง
   * แต่แก้ไม่ได้จนกว่าจะรู้ว่าต้องกดปุ่มก่อน
   *
   * ⚠️ ตัวแปรนี้ยังอยู่เพราะ `handleSave` ใช้มันคุมว่า "จะส่ง JSONB กับยอดเงินไปด้วยไหม"
   *    ตอนเป็นโหมดอ่านมันจงใจไม่ส่ง เพื่อไม่ให้เขียนทับของเดิมด้วยค่าว่าง
   *    ตอนนี้พิมพ์ได้ตลอด จึงต้องส่งตลอด — ปล่อยเป็น true คงที่ ห้ามเปลี่ยนกลับเป็น state
   *    ถ้าไม่ได้แก้ handleSave ให้ปลอดภัยก่อน
   */
  const isEditing = true;
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
  const { user } = useAuth();
  /**
   * ประตูอนุมัติ (user เคาะ 15/08/69) — อนุมัติแล้ว = ล็อกทั้งหน้า แก้ต่อไม่ได้
   * เพราะบอทหยิบเฉพาะเคสที่อนุมัติแล้วไปเข้า EMCS และจะกดส่งงานเองในเฟสถัดไป
   * ถ้าแก้ได้หลังอนุมัติ สิ่งที่บอทส่งจะไม่ใช่สิ่งที่หัวหน้ารับรอง
   */
  // ⛔ ห้ามใช้ "มีใบอนุมัติอยู่" เป็นตัวชี้ขาด — ตอนปลดล็อก ใบยังอยู่ แค่เปลี่ยนเป็น 'pending'
  //    (reviews มี 1 แถวต่อเคส ใช้ซ้ำเมื่ออนุมัติใหม่) เช็คแบบเดิมทำให้ปลดล็อกแล้วหน้ายังล็อกอยู่
  //    แก้อะไรไม่ได้เลย — เจอจริง 15/08/69 เคส #141
  const approved = caseData?.status === 'reviewed' || review?.status === 'approved';
  const isAdmin = user?.role === 'admin';
  /**
   * ยอดจ่ายพนักงานกรอกได้เฉพาะ "งานที่เกิดในระบบ se-survey"
   * (source='mobile' ซึ่งเป็นค่าเริ่มต้น — ครอบทั้งงานจากแอปและงานที่ callcenter สร้างบนเว็บ)
   *
   * งานจากระบบเดิม หัวหน้ากรอกยอดไปแล้วที่ ISURVEY และยอดถูกเก็บที่ se-billing → ที่นี่ดูอย่างเดียว
   * (backend บังคับซ้ำอีกชั้นที่ pay.service.ts — ที่นี่แค่ไม่ให้กรอกลม ๆ แล้วเซฟไม่ผ่าน)
   *
   * `isurvey_live` = ดึงจาก ISURVEY ตอนยังเป็น "รอตรวจข้อมูล" คือก่อนหัวหน้ากรอกยอด
   * → ยอดยังไม่มีที่ไหนเลย ต้องกรอกที่นี่ · ลิสต์นี้ต้องตรงกับ PAY_EDITABLE_SOURCES ฝั่ง backend
   */
  const payEditable = ['mobile', 'isurvey_live'].includes(String(caseData?.source ?? 'mobile'));
  /**
   * ⚠️ `d` เคยเป็น "ล็อกทั้งฟอร์ม" — ผูกอยู่กับ 116 ช่องที่ไม่เกี่ยวกับเงินเลย
   *
   * สูตรเดิม `!isEditing || !payEditable` ทำให้**งานจากระบบเก่า (payEditable=false)
   * แก้อะไรไม่ได้เลยทั้งหน้า** แม้แต่ชื่อ ที่อยู่ สถานที่เกิดเหตุ — ตอนที่ยังต้องกด
   * "แก้ไขทั้งหมด" ก่อนไม่มีใครสังเกต เพราะดูเหมือนยังไม่ได้เข้าโหมดแก้
   * (user เจอจริง 17/08/69 เคส #149: 6 ช่องพิมพ์ไม่ได้)
   *
   * แยกเป็น 2 ตัว: ช่องทั่วไปแก้ได้เสมอ (การล็อกตอนอนุมัติทำที่ <fieldset disabled>)
   * ส่วนช่อง**ยอดจ่ายพนักงาน** 16 ช่องยังล็อกตามที่มาของงานเหมือนเดิม
   */
  const d = false;
  const dPay = !payEditable;
  /**
   * "หักเงิน" กรอกได้ทุกที่มาของงาน — ต่างจากยอดรายรับ (user เคาะ 17/08/69)
   *
   * เหตุผล: หักเงินเป็นกติกาของ **เราเอง** ไม่ได้มาจากระบบเดิมและไม่มีที่เก็บใน se-billing
   * (ระบบเดิมไม่มีแถวนี้ด้วยซ้ำ — ต้องยืมช่อง "ค่าใช้จ่ายอื่นๆ" ดูคอมเมนต์ตรงตารางข้างล่าง)
   * ล็อกตาม `payEditable` จึงเป็นการล็อกผิดฝั่ง หัวหน้าหักเงินงานระบบเดิมไม่ได้เลย
   *
   * ยอด**รายรับ** 16 ช่องยังล็อกเหมือนเดิม — ยอดพวกนั้นมีเจ้าของอยู่ที่ se-billing แล้ว
   */
  const dDeduct = false;
  // จำนวนช่องบังคับที่ยังว่าง — โชว์เป็นแถบสรุปหัวหน้า (กรอบแดงรายช่องดูใน effect ด้านล่าง)
  const [missing, setMissing] = useState<string[]>([]);
  /**
   * หมวดไหนยังมีช่องแดง — ใช้ติดป้าย "ยังกรอกไม่ครบ" ที่หัวหมวดเท่านั้น
   *
   * ⛔ **ห้ามเอาไปใช้ยุบ/ซ่อนหมวด** (user เคาะ 18/08/69) — เคยทำแล้วถอดออก
   *    หมวดที่ถูกยุบไว้คือหมวดที่ผู้ตรวจจะไม่เปิดดู แล้วปล่อยข้อมูลผิดผ่านไป
   *    หน้านี้เป็นหน้า "ตรวจ" ต้องเห็นทุกช่องเสมอ · มีการ์ดเทสกันไว้
   */
  const [gapSec, setGapSec] = useState<string[] | null>(null);
  /**
   * "การเรียกร้องค่าเสียหายจากคู่กรณี" — ช่องเดียวในฟอร์มที่ **บังคับแบบมีเงื่อนไข**
   *
   * กติกาของ EMCS เอง (สกัดจาก vlidSurvey ของเขา):
   *   if (rdoAcc_Cause01.checked)  → ต้องติ๊กอย่างน้อย 1 ใน 5 ข้อ
   *   rdoAcc_Cause01 = "รถคู่กรณีเป็นฝ่ายผิด" · ผลคดีอีก 6 ตัวไม่บังคับ · ไม่แยกตามบริษัท
   *
   * ตัวไฮไลต์ทั่วไปทำช่องแบบนี้ไม่ได้ (มันดูดอกจันแดง = บังคับเสมอ และ isBlank มองข้าม
   * checkbox เพราะเป็นกลุ่ม ไม่ใช่ช่องเดี่ยว) จึงคุมสีของทั้งกลุ่มแยกตรงนี้
   *   แดง  = บังคับตอนนี้และยังไม่ติ๊ก  ·  เหลือง = ยังไม่บังคับแต่ยังว่าง  ·  ติ๊กแล้ว = ปกติ
   */
  const [claimHl, setClaimHl] = useState<'red' | 'amber' | 'none'>('none');
  /**
   * อีก 2 กติกาที่ EMCS ผูกไว้กับบล็อกเดียวกัน (สกัดจาก vlidSurvey ของเขา)
   *   1. ผลคดี = คู่กรณีผิด → บังคับ "คู่กรณีคันที่" (txtAcc_Cause_No) ด้วย
   *   2. ติ๊ก "รับเงินจำนวน" (chkOpo_Result_4) → บังคับช่องเงินทั้งคู่ และ
   *      "รับเงินจำนวน" ต้อง ≤ "จากจำนวนเงินเรียกร้องทั้งหมด" ไม่งั้น EMCS เด้ง alert
   */
  const [oppNoHl, setOppNoHl] = useState<'red' | 'amber' | 'none'>('none');
  const [payHl, setPayHl] = useState<'red' | 'none'>('none');
  const [payOver, setPayOver] = useState(false);
  /**
   * ลำดับเวลา — กฎอีกชนิดที่ระบบประกันตรวจ และเราไม่เคยตรวจเลย
   *
   * เจอจริง 15/08/69 เคส #141 (มาจากแอปมือถือ ผ่านการอนุมัติมาแล้ว):
   *   เกิดเหตุ 16:00 · ถึงที่เกิดเหตุ 15:50  → ไปถึงก่อนเกิดเหตุ 10 นาที
   * ระบบประกันตีกลับ 3 ข้อรวด ทั้งที่ช่องบังคับครบหมด — ตรวจ "ช่องว่าง" อย่างเดียวไม่พอ
   */
  const [timeErrs, setTimeErrs] = useState<{ at: string; msg: string }[]>([]);
  /**
   * งานจากแอปมือถือไม่มียอดเงินติดมา — หัวหน้าต้องกรอกบนเว็บก่อนอนุมัติ
   * (งานจากระบบเดิมมียอดมาแล้ว ไม่ต้องเช็ค) · user ย้ำ 15/08/69
   */
  const [moneyMissing, setMoneyMissing] = useState<string[]>([]);
  /**
   * เหตุผลที่ยังกดอนุมัติไม่ได้
   *
   * อนุมัติ = ล็อกเคส + บอทหยิบไปเข้า EMCS ทันที · ปล่อยให้อนุมัติทั้งที่ช่องบังคับยังว่าง
   * แปลว่าบอทจะไปตายที่หน้า EMCS แล้วเสียเที่ยว (เจอจริง 15/08/69 เคลม -001860:
   * บันทึกหน้าหลักไม่ผ่านเพราะไม่ได้ติ๊ก "การเรียกร้องค่าเสียหายจากคู่กรณี")
   * ดักที่นี่ถูกกว่า — ผู้ตรวจยังเปิดหน้าอยู่ แก้ได้เลย
   *
   * นับเฉพาะ "แดง" (บังคับจริงตอนนี้) — เหลืองคือยังไม่บังคับ ไม่บล็อก
   */
  const approvalBlockers = [
    ...(missing.length > 0 ? [`ช่องบังคับยังว่าง ${missing.length} ช่อง`] : []),
    ...(claimHl === 'red' ? ['ยังไม่ได้ติ๊ก "การเรียกร้องค่าเสียหายจากคู่กรณี"'] : []),
    ...(oppNoHl === 'red' ? ['ยังไม่ได้กรอก "คู่กรณีคันที่"'] : []),
    ...(payHl === 'red' ? ['ติ๊ก "รับเงินจำนวน" แล้วแต่ยังไม่กรอกยอด'] : []),
    ...(payOver ? ['"รับเงินจำนวน" มากกว่ายอดเรียกร้องทั้งหมด'] : []),
    ...timeErrs.map((e) => `"${TL_LABEL[e.at] ?? e.at}" ${e.msg}`),
    ...moneyMissing,
  ];

  /**
   * 5 จังหวะของงาน เรียงตามลำดับที่ต้องเป็นจริง — ใช้วาดการ์ด "ลำดับเวลา"
   * ชื่อช่องต้องตรงกับที่ `updateReport` ฝั่ง backend ประกอบกลับเป็น "วันที่|ชม:นาที"
   * และตรงกับชื่อที่ตัวตรวจลำดับเวลา (stamp() ใน paint) อ่าน — แก้ที่นี่ต้องแก้ทั้ง 3 ที่
   */
  const tl = (date: string, hour: string, min: string,
              v: { date: string; hour: string; minute: string }) =>
    ({ date, hour, min, label: TL_LABEL[date], v, keys: [date, hour, min] });
  const accT = String(report?.acc_time ?? '').split(':');
  const TIMELINE = report ? [
    tl('acc_date', 'acc_time_hour', 'acc_time_minute',
       { date: report.acc_date || '', hour: accT[0] || '', minute: accT[1] || '' }),
    tl('acc_customer_report_date_val', 'acc_customer_report_hour', 'acc_customer_report_minute',
       parseDatetime(report.acc_customer_report_date)),
    tl('acc_insurance_notify_date_val', 'acc_insurance_notify_hour', 'acc_insurance_notify_minute',
       parseDatetime(report.acc_insurance_notify_date)),
    tl('acc_survey_arrive_date_val', 'acc_survey_arrive_hour', 'acc_survey_arrive_minute',
       parseDatetime(report.acc_survey_arrive_date)),
    tl('acc_survey_complete_date_val', 'acc_survey_complete_hour', 'acc_survey_complete_minute',
       parseDatetime(report.acc_survey_complete_date)),
  ] : [];

  // ทาสีกรอบแดงให้ช่องบังคับที่ยังว่าง + นับจำนวน
  // ทำหลัง render เพราะช่องบังคับกระจายอยู่ ~49 จุด ผูกกับดอกจันที่มีอยู่แล้วดีกว่าไล่แก้ทีละช่อง
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // อาเรย์ใหม่ทุกครั้ง = re-render ทุกครั้งแม้เนื้อหาเท่าเดิม (หน้านี้มี ~200 ช่อง)
    const setList = <T,>(set: (u: (prev: T[]) => T[]) => void, next: T[]) =>
      set((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    const paint = () => {
      const names: string[] = [];
      form.querySelectorAll('.req-mark').forEach((mark) => {
        fieldsOfMark(mark, form).forEach((el) => {
          const blank = isBlank(el);
          // จำพื้นหลังเดิมไว้ครั้งแรก แล้วสลับไปมาระหว่างเดิม ↔ แดง
          if (!el.dataset.bg0) el.dataset.bg0 = BG_ORIG.find((c) => el.classList.contains(c)) || 'bg-white';
          el.classList.toggle('border-gray-300', !blank);
          el.classList.toggle(el.dataset.bg0, !blank);
          RING.forEach((c) => el.classList.toggle(c, blank));
          const nm = (el as HTMLInputElement).name;
          if (blank && nm && !names.includes(nm)) names.push(nm);
        });
      });
      /**
       * ── ชื่อที่มีอักขระ EMCS ไม่รับ (วงเล็บ ทับ ฯลฯ) → ทาแดงที่ช่องเลย ──
       * เดิมเตือนเป็นแถบเหลืองบนหัวหน้าอย่างเดียว ซึ่งคำนวณตอนโหลดหน้า แก้แล้วไม่หาย
       * และไม่บอกว่าอยู่ช่องไหนในบรรดา ~200 ช่อง (user เคาะ 17/08/69 ให้มาโชว์ที่ช่อง)
       * EMCS ไม่ได้แค่ตัดอักขระ — มัน **ล้างชื่อทั้งช่องทิ้ง** ตอนคนคลิกเข้า-ออก
       */
      for (const nm of EMCS_NAME_FIELDS) {
        const el = form.querySelector(`[name="${nm}"]`) as HTMLInputElement | null;
        if (!el) continue;
        const bad = emcsBadChars(el.value ?? '');
        el.title = bad ? `EMCS จะล้างชื่อทั้งช่องทิ้งเพราะมีอักขระ: ${bad}` : '';
        // ช่องที่ทาแดงเพราะ "ว่าง" อยู่แล้ว ปล่อยให้ตัวเดิมคุมไป อย่าทับกัน
        if (names.includes(nm)) continue;
        if (!el.dataset.bg0) el.dataset.bg0 = BG_ORIG.find((c) => el.classList.contains(c)) || 'bg-white';
        el.classList.toggle('border-gray-300', !bad);
        el.classList.toggle(el.dataset.bg0, !bad);
        RING.forEach((c) => el.classList.toggle(c, Boolean(bad)));
      }

      setList(setMissing, names);
      // หมวดไหนยังมีช่องแดงอยู่ — ใช้ตัดสินว่าจะกางหรือยุบหมวดนั้น
      const gs: string[] = [];
      form.querySelectorAll('[data-section]').forEach((s) => {
        if (s.querySelector('.' + RING[0])) gs.push(s.getAttribute('data-section') || '');
      });
      setList(setGapSec as (u: (p: string[]) => string[]) => void, gs);

      // ── บล็อก "การเรียกร้องค่าเสียหายจากคู่กรณี" (บังคับแบบมีเงื่อนไข) ──
      // ค่า radio "คู่กรณีผิด" ตรงกับ rdoAcc_Cause01 ของ EMCS ที่เป็นตัวเปิดเงื่อนไข
      const val = (sel: string) =>
        String((form.querySelector(sel) as HTMLInputElement | null)?.value ?? '').trim();
      const fault = val('input[name="acc_fault"]:checked');
      const oppFault = fault === 'คู่กรณีผิด';

      const ticks = Array.prototype.map.call(
        form.querySelectorAll('input[name="acc_claim_opponent"]:checked'),
        (el) => (el as HTMLInputElement).value) as string[];
      setClaimHl(ticks.length > 0 ? 'none' : oppFault ? 'red' : 'amber');

      // "คู่กรณีคันที่" — EMCS บังคับในเงื่อนไขเดียวกันเป๊ะ ใช้สีชุดเดียวกัน
      const oppNoBlank = !val('input[name="acc_fault_opponent_no"]');
      setOppNoHl(!oppNoBlank ? 'none' : oppFault ? 'red' : 'amber');

      // ช่องเงิน — บังคับเมื่อ "ติ๊กรับเงินจำนวน" เท่านั้น (ไม่เกี่ยวกับผลคดี)
      // ไม่ทาเหลืองตอนไม่บังคับ เพราะเคสส่วนใหญ่ไม่มีการรับเงิน จะกลายเป็นเตือนหลอกทุกใบ
      const moneyTick = ticks.some((v) => v.includes('รับเงิน'));
      const amt = val('input[name="acc_claim_amount"]').replace(/,/g, '');
      const total = val('input[name="acc_claim_total_amount"]').replace(/,/g, '');
      setPayHl(moneyTick && (!amt || !total) ? 'red' : 'none');
      setPayOver(Boolean(moneyTick && amt && total && Number(amt) > Number(total)));

      // ── ลำดับเวลา (กติกาของระบบประกัน) ──
      // วันที่บนฟอร์มเป็น พ.ศ. รูปแบบ วว/ดด/ปปปป — อ่านไม่ออกก็ข้าม ไม่เดา
      const stamp = (dn: string, hn: string, mn: string): number | null => {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val(`input[name="${dn}"]`));
        if (!m) return null;
        const h = Number(val(`input[name="${hn}"]`) || 0);
        const mi = Number(val(`input[name="${mn}"]`) || 0);
        return new Date(Number(m[3]) - 543, Number(m[2]) - 1, Number(m[1]), h, mi).getTime();
      };
      const tAcc = stamp('acc_date', 'acc_time_hour', 'acc_time_minute');
      const tCus = stamp('acc_customer_report_date_val', 'acc_customer_report_hour', 'acc_customer_report_minute');
      const tIns = stamp('acc_insurance_notify_date_val', 'acc_insurance_notify_hour', 'acc_insurance_notify_minute');
      const tArr = stamp('acc_survey_arrive_date_val', 'acc_survey_arrive_hour', 'acc_survey_arrive_minute');
      const tFin = stamp('acc_survey_complete_date_val', 'acc_survey_complete_hour', 'acc_survey_complete_minute');
      const before = (a: number | null, b: number | null) => a !== null && b !== null && a < b;
      // `at` = ช่องที่ผิด — เอาไว้แปะข้อความเตือนใต้จังหวะนั้นในการ์ดลำดับเวลา
      // (เดิมมีแต่ข้อความรวมบนหัวหน้า ตัวช่องได้แค่กรอบแดง ไม่บอกว่าผิดยังไง
      //  ต้องเลื่อนขึ้นไปอ่านแล้วเลื่อนกลับลงมาแก้ — user เคาะ 17/08/69 ให้ย้ายมาไว้ที่จุด)
      const te: { at: string; msg: string }[] = [];
      const ARR = 'acc_survey_arrive_date_val';
      if (before(tArr, tAcc)) te.push({ at: ARR, msg: 'ย้อนหลังกว่าเวลาเกิดเหตุ' });
      if (before(tArr, tCus)) te.push({ at: ARR, msg: 'ย้อนหลังกว่าเวลาที่ลูกค้าแจ้ง บ.ประกัน' });
      if (before(tArr, tIns)) te.push({ at: ARR, msg: 'ย้อนหลังกว่าเวลาที่ บ.ประกันแจ้งสำรวจภัย' });
      // ข้อนี้ยังไม่เคยเห็นระบบประกันฟ้อง แต่เป็นไปไม่ได้ทางตรรกะ — ปล่อยผ่านก็เสียเที่ยวอยู่ดี
      if (before(tFin, tArr)) te.push({ at: 'acc_survey_complete_date_val', msg: 'ย้อนหลังกว่าเวลาที่ถึงที่เกิดเหตุ' });
      setList(setTimeErrs, te);

      // ── ยอดเงินของงานจากแอปมือถือ ──
      const mm: string[] = [];
      if (payEditable) {
        if (pay && !(Number(pay.saved?.total ?? 0) > 0)) mm.push('ยังไม่ได้กรอก "ราคาพนักงาน"');
        if (!val('input[name="service_fee_price"]')) mm.push('ยังไม่ได้กรอก "ราคาประกัน" (ค่าบริการ)');
      }
      setList(setMoneyMissing, mm);
    };
    paint();
    /**
     * ⛔ ห้ามผูก `paint` กับ event ตรง ๆ — ต้องหน่วงออกไปนอกจังหวะที่ event กำลังไหล
     *
     * `<form>` เป็น ancestor ของทุกช่อง ส่วน React (Next.js App Router) ดัก event ไว้ที่
     * `document` ซึ่งอยู่ **เหนือ** form ขึ้นไป → ลำดับจริงคือ  ช่อง → form(paint) → document(React)
     *
     * paint เรียก setState ที่ทำให้ re-render ทันทีกลางคัน · ตอน re-render React เขียนค่า
     * `value` ของช่อง **controlled** กลับเป็นค่าใน state ซึ่งยังเป็นค่าเก่า (onChange ยังไม่ทำงาน
     * เพราะ event ยังไปไม่ถึง React!) → พอ event ไหลถึง React ค่ากับตัวจำเท่ากันพอดี
     * → React สรุปว่า "ไม่มีอะไรเปลี่ยน" **ไม่ยิง onChange เลย** = พิมพ์/เลือกไม่เข้าถาวร
     *
     * กระทบเฉพาะช่อง controlled: คู่กรณี · ผู้บาดเจ็บ · ทรัพย์สิน · ความเสียหาย และ 5 dropdown
     * cascade (ประเภทรถ · จังหวัด-เขต ที่เกิดเหตุ · จังหวัด-เขต ผู้ขับขี่)
     * ช่องทั่วไปเป็น uncontrolled จึงรอด — เลยดูเหมือน "บางช่องพิมพ์ไม่ได้" (เจอจริง 17/08/69 เคส #149)
     *
     * rAF = รอให้ event ไหลจบก่อนค่อย setState · กรอบแดงยังอัปเดตทันตาเหมือนเดิม
     */
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); };
    form.addEventListener('input', schedule);
    form.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(raf);
      form.removeEventListener('input', schedule);
      form.removeEventListener('change', schedule);
    };
    // pay โหลดทีหลัง (async) — ไม่ใส่ไว้ ตัวเช็ค "ยังไม่กรอกราคาพนักงาน" จะค้างที่ผลก่อนโหลด
  }, [report, isEditing, saveMsg, pay, payEditable]);

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
      // งานจากระบบเดิมส่งได้เฉพาะ "หักเงิน" — ยอดรายรับเป็นของ se-billing ไม่ใช่ของเรา
      // (backend บังคับกติกาเดียวกันอีกชั้นที่ pay.service.ts และจะเขียนแค่ 4 คอลัมน์หักเงิน)
      if (isEditing) {
        const payBody: Record<string, unknown> = {
          deduct_fee: String(data['pay_deduct_fee'] ?? '').replace(/,/g, '') || null,
          deduct_late: fd.has('deduct_late'),
          deduct_docs: fd.has('deduct_docs'),
          deduct_reason: data['deduct_reason'] || null,
        };
        if (payEditable) {
          payBody.other_reason = data['other_fee_detail'] ?? null;
          for (const k of Object.keys(data)) {
            if (k.startsWith('pay_')) payBody[k.slice(4)] = data[k].replace(/,/g, '') || null;
          }
          for (const f of ['out_of_area', 'out_of_hours', 'special_tumbon']) payBody[f] = fd.has(f);
          payBody.daily_check = (data['daily_check'] || '') || null;
        }
        // ⛔ ไม่บังคับให้ระบุเหตุผลตอนหักเงิน (user เคาะ 17/08/69) — เดิมบล็อกการบันทึกทั้งหน้า
        // งานระบบเดิมที่ไม่มีการหักเงินเลย ไม่ต้องยิง — กันไม่ให้เกิดแถว survey_pay เปล่า ๆ
        const anyDeduct = (o: Record<string, unknown> | null | undefined) =>
          Boolean(o?.deduct_fee) || Boolean(o?.deduct_late) || Boolean(o?.deduct_docs) || Boolean(o?.deduct_reason);
        if (payEditable || anyDeduct(payBody) || anyDeduct(pay?.saved)) {
          const pr = await api.put(`/api/cases/${caseData.id}/pay`, payBody);
          if (pr.data?.success) setPay((prev: PayData | null) => (prev ? { ...prev, saved: pr.data.data } : prev));
        }
      }
      const res = await api.put(`/api/cases/${caseData.id}/report`, { report_data: payload });
      if (res.data.success) { setSaveMsg('บันทึกสำเร็จ'); onReviewSubmitted(); setTimeout(() => setSaveMsg(''), 3000); return true; }
      setSaveMsg('บันทึกไม่สำเร็จ: ' + (res.data.message || '')); return false;
    } catch { setSaveMsg('เกิดข้อผิดพลาดในการบันทึก'); return false; }
    finally { setSaving(false); }
  };

  /**
   * แถบปุ่ม — เดิมอยู่ท้ายหน้า ต้องเลื่อนผ่าน ~200 ช่องกว่าจะถึง
   * ตอนนี้ย้ายไปอยู่ในแถบหัวเคสที่ติดขอบบน กดบันทึกได้จากทุกจุดของหน้า
   * ⛔ ต้องอยู่ **นอก** <fieldset disabled> ไม่งั้นตอนล็อกจะกดปลดล็อกไม่ได้
   */
  const actionBar = approved ? (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">อนุมัติแล้ว · ล็อก</span>
      <span className="text-xs text-gray-600 hidden lg:inline">
        {review?.checker_name ? `โดย ${review.checker_name}` : ''}
        {review?.reviewed_at ? ` · ${String(review.reviewed_at).slice(0, 16).replace('T', ' ')}` : ''}
      </span>
      {isAdmin ? (
        <button type="button" disabled={saving} onClick={async () => {
          // ปลดล็อกแล้วต้องอนุมัติใหม่ — ถามก่อนเพราะเป็นการถอนลายเซ็นของคนอื่น
          if (!window.confirm('ปลดล็อกเคสนี้ให้กลับไปแก้ได้?\nผู้ตรวจจะต้องกดอนุมัติใหม่อีกครั้ง')) return;
          setSaving(true); setSaveMsg('');
          try {
            await api.post(`/api/cases/${caseData.id}/unlock`, {});
            setSaveMsg('ปลดล็อกสำเร็จ');
            onReviewSubmitted();
          } catch (e) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setSaveMsg('ปลดล็อกไม่สำเร็จ: ' + (msg || 'เกิดข้อผิดพลาด'));
          } finally { setSaving(false); }
        }} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed transition">
          ปลดล็อก
        </button>
      ) : (
        <span className="text-xs text-gray-500">ต้องให้แอดมินปลดล็อกก่อน</span>
      )}
    </div>
  ) : (
    // ทุกช่องพิมพ์ได้ตลอด จึงไม่มีปุ่ม "แก้ไขทั้งหมด" / "ยกเลิก" อีกแล้ว
    <div className="flex items-center gap-2">
      {approvalBlockers.length > 0 && (
        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 whitespace-nowrap">
          ยังอนุมัติไม่ได้ {approvalBlockers.length} ข้อ
        </span>
      )}
      {/* "บันทึกร่าง" ตามดีไซน์ — ตรงความจริงด้วย: บันทึกแล้วเคสยังไม่ถูกส่งไปไหน */}
      <button type="button" onClick={handleSave} disabled={saving} className="px-5 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition">
        {saving ? 'กำลังบันทึก...' : 'บันทึกร่าง'}
      </button>
      <button type="button" onClick={async () => {
        // กันไว้อีกชั้นเผื่อสถานะยังไม่ทันอัปเดต (ปุ่มถูก disable อยู่แล้วตามปกติ)
        if (approvalBlockers.length > 0) {
          setSaveMsg('อนุมัติไม่ได้ — ' + approvalBlockers.join(' · '));
          return;
        }
        // อนุมัติ = ล็อกเคส ถอยเองไม่ได้ ต้องให้แอดมินปลด — ถามก่อนเสมอ
        if (!window.confirm('อนุมัติเคสนี้?\nอนุมัติแล้วจะล็อก แก้เองไม่ได้ ต้องให้แอดมินปลดล็อก\nและบอทจะยกเคสนี้เข้า EMCS')) return;
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
      }} disabled={saving || approvalBlockers.length > 0}
        title={approvalBlockers.length > 0 ? 'อนุมัติไม่ได้ — ' + approvalBlockers.join(' · ') : ''}
        className="px-5 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition">
        อนุมัติ
      </button>
    </div>
  );

  /** นับรูปแยกหมวด — ป้ายเดียวกับที่ PhotoGallery จัดกลุ่ม (ไม่ระบุหมวด = โหลดมาจากภายนอก) */
  const photoCats = (() => {
    const m = new Map<string, number>();
    for (const p of photos ?? []) {
      const c = (p as { category?: string | null })?.category?.trim() || 'ไม่ระบุหมวด';
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return Array.from(m, ([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  })();

  /** ป้ายบอกที่มาของงาน — ชุดเดียวกับหน้ารายการงาน กติกาเงินต่างกันตามที่มา */
  const SRC_BADGE: Record<string, { t: string; c: string }> = {
    mobile: { t: 'แอปมือถือ', c: 'bg-emerald-100 text-emerald-800' },
    isurvey_live: { t: 'ระบบเก่า (สด)', c: 'bg-sky-100 text-sky-800' },
    isurvey_xml: { t: 'ไฟล์ XML', c: 'bg-violet-100 text-violet-800' },
    emcs_extract: { t: 'ดึงจาก EMCS', c: 'bg-slate-200 text-slate-700' },
  };
  const src = SRC_BADGE[String(caseData?.source ?? 'mobile')]
    ?? { t: String(caseData?.source ?? '-'), c: 'bg-gray-100 text-gray-700' };

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {/* ── แถบหัวเคส (ติดขอบบน) ── ตัวระบุเคส + สถานะ + ปุ่ม อยู่ครบในบรรทัดเดียว
          หน้านี้ยาวมาก เลื่อนไปไหนก็ยังเห็นว่ากำลังตรวจเคลมไหน และกดบันทึกได้ทันที */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-2 bg-gray-50/95 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow border border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">เคลม</span>
            <span className="font-bold text-gray-900 truncate">{report?.claim_no || '—'}</span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">เซอร์เวย์</span>
            <span className="font-medium text-gray-700 truncate">{report?.survey_job_no || '—'}</span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">ทะเบียน</span>
            <span className="font-medium text-gray-700 truncate">{report?.license_plate || '—'}</span>
          </div>
          <span className="text-sm text-gray-500 truncate hidden md:inline">{report?.insurance_company || '—'}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${src.c}`}>{src.t}</span>
          <div className="ml-auto flex items-center gap-3">
            {saveMsg && (
              <span className={`px-3 py-1 rounded text-xs ${saveMsg.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{saveMsg}</span>
            )}
            {actionBar}
          </div>
        </div>
      </div>

      {/* อนุมัติแล้ว = ปิดทั้งชุดด้วย <fieldset disabled> — ครอบทุกช่องในหน้าทีเดียว
          ไม่ต้องไล่ใส่ disabled ทีละช่อง (มี ~200 ช่อง พลาดช่องเดียวก็รั่ว)
          แถบปุ่มอยู่ *นอก* fieldset เพื่อให้แอดมินยังกด "ปลดล็อก" ได้ตอนถูกล็อก */}
      <fieldset disabled={approved} className="min-w-0 border-0 p-0 m-0 space-y-6">
      {report && (
        <>
          {/* คำอธิบายดอกจัน — จุดแดงชุดเดียวกับที่ผู้สำรวจเห็นบนแอป (อิงตัวตรวจของระบบประกัน) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span><span className="text-red-500">*</span> ช่องบังคับของระบบประกัน — เว้นว่างแล้วส่งงานเข้าระบบประกันไม่ผ่าน</span>
            <span><span className="text-amber-500">*</span> บังคับเฉพาะบางกรณี (ชี้เมาส์ที่ดอกจันเพื่อดูเงื่อนไข)</span>
            <span className="text-gray-400">ช่องบังคับที่ยังว่างจะขึ้นกรอบแดง</span>
          </div>

          {/* สรุปจำนวนช่องที่ยังขาด — กรอบแดงรายช่องอาจอยู่คนละหมวดห่างกันคนละหน้าจอ
              ถ้าไม่สรุปไว้บนสุด ผู้ตรวจต้องเลื่อนหาเอง แล้วไปเจอตอนบอทนำเข้าไม่ผ่าน */}
          {/* ลำดับเวลาผิด — ต่างจากช่องว่างตรงที่ "มองด้วยตาไม่เห็น" แต่ละช่องดูปกติหมด
              ต้องเอามาเทียบกันถึงจะรู้ ถ้าไม่สรุปไว้บนสุดก็ไม่มีทางสังเกตเจอ */}
          {/* สรุปสั้น ๆ พอให้รู้ว่ามีปัญหา — รายละเอียดไปอ่านที่จังหวะนั้นในการ์ดลำดับเวลา */}
          {timeErrs.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded px-4 py-2 text-sm text-red-800">
              <span className="font-semibold">ลำดับเวลาไม่ถูกต้อง {timeErrs.length} จุด</span>
              <span className="text-red-600"> — ระบบประกันไม่รับ ดูรายละเอียดที่การ์ด "ลำดับเวลา" ด้านล่าง</span>
            </div>
          )}
          {moneyMissing.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded px-4 py-2 text-sm text-amber-900">
              <span className="font-semibold">งานจากแอปมือถือ — ยังไม่ได้กรอกยอดเงิน</span>
              <span className="text-amber-700"> · {moneyMissing.join(' · ')}</span>
            </div>
          )}
          {missing.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded px-4 py-2.5 text-sm text-red-800 flex items-center gap-2">
              <span className="font-semibold">ยังขาดช่องบังคับ {missing.length} ช่อง</span>
              <span className="text-red-600">— ดูช่องที่มีกรอบแดง เว้นว่างไว้แล้วนำเข้าระบบประกันไม่ผ่าน</span>
              <button
                type="button"
                onClick={() => formRef.current?.querySelector('.' + RING[0])
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="ml-auto shrink-0 px-3 py-1 text-xs border border-red-300 rounded hover:bg-red-100"
              >
                ไปช่องแรกที่ขาด
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-sm text-green-800">
              ช่องบังคับครบแล้ว
            </div>
          )}
          <div className="hidden">
          </div>

          {/* รายละเอียดรถยนต์ — header + ข้อมูลบริษัท/เคลม (แบบตาราง) */}
          <div data-section="biz" className="space-y-2">
          <SectionBar title="บริษัท · เคลม" gap={(gapSec ?? []).includes('biz')} />
          <div>
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
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 text-sm">
              <F label="บริษัทประกัน">
                <div className="flex items-center gap-1">
                  <select disabled={d} name="insurance_company" defaultValue={report.insurance_company || '0'} className={`min-w-0 flex-1 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                    {/* เหลือ 2 บริษัทตามงานที่รับจริง (กติกา user 13/08/69) — เดิมลอกมาทั้ง
                        dropdown ของ EMCS 7 ตัว · เลือกผิดที = เคสไปโผล่ผิดบริษัทในระบบประกัน
                        ซึ่ง draft ของ EMCS ลบไม่ได้ · เคสเก่าที่ค่าไม่อยู่ใน 2 ตัวนี้ยังเก็บค่าเดิมไว้
                        (เช่นแบบเขียนสั้น 'ไทยไพบูลย์ประกันภัย' ที่มีอยู่จริงใน DB) ไม่ให้หายตอนกดบันทึก */}
                    <option value="0">-- ระบุ --</option>
                    {INSURER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    {report.insurance_company && !INSURER_OPTIONS.includes(report.insurance_company) && (
                      <option value={report.insurance_company}>{report.insurance_company} (ค่าเดิม)</option>
                    )}
                  </select>
                  <select disabled={d} name="insurance_branch" defaultValue={report.insurance_branch || 'กรุงเทพ'} className={`w-[90px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                    <option value="0">-- ระบุ --</option>
                    <option value="กรุงเทพ">กรุงเทพ</option>
                  </select>
                </div>
              </F>
              <F label="เลขเรื่องเซอร์เวย์">
                <input type="text" disabled={d} name="survey_job_no" defaultValue={report.survey_job_no || ''} placeholder="SEABI-110260301037" className={CTL(d)} />
              </F>
              <F label="เลขที่รับแจ้ง">
                <input type="text" disabled={d} name="claim_ref_no" defaultValue={report.claim_ref_no || ''} className={CTL(d)} />
              </F>
              <F label="เลขที่เคลม">
                <input type="text" disabled={d} name="claim_no" defaultValue={report.claim_no || ''} className={CTL(d)} />
              </F>

              {/* 4 ช่องนี้เป็นข้อมูลบริษัทเรา ไม่ได้แก้ที่นี่ (มาจากตั้งค่าระบบ) — แสดงอย่างเดียว */}
              <F label="บริษัทผู้จัดเรื่อง">
                <p className="text-gray-800 py-1">{report.survey_company || '-'}</p>
              </F>
              <F label="เบอร์โทรศัพท์ / Fax">
                <p className="text-gray-800 py-1">{report.survey_company_phone || '-'}</p>
              </F>
              <F label="วันที่">
                <p className="text-gray-800 py-1">{report.acc_date || '-'}</p>
              </F>
              <F label="ที่อยู่">
                <p className="text-gray-800 py-1 truncate" title={report.survey_company_address || ''}>{report.survey_company_address || '-'}</p>
              </F>
            </div>
          </div>

          </div>
          </div>

          {/* กรมธรรม์ — แบบตาราง */}
          <div data-section="policy" className="space-y-2">
          <SectionBar title="กรมธรรม์" gap={(gapSec ?? []).includes('policy')} />
          <div>
            <div className="bg-white rounded-lg shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 text-sm">
              <F label="กรมธรรม์เลขที่" req={<Req of="policy_no" />}>
                <input type="text" disabled={d} name="policy_no" defaultValue={report.policy_no || ''} className={CTL(d)} />
              </F>
              {/* ช่องพิมพ์ ไม่ใช่ dropdown — EMCS เองก็ไม่มีรายการให้เลือก และของจริง
                  มีมากกว่าที่ลิสต์ไว้ (ใบจริงเขียน "ประเภท 2+ ซ่อมอู่" = รหัส 52)
                  ตอนส่งออก policyTypeCode แปลงป้ายไทยที่รู้จัก ที่เหลือส่งตามที่กรอก */}
              <F label="ประกันประเภท" req={<Req of="policy_type" />}>
                <input type="text" disabled={d} name="policy_type" defaultValue={report.policy_type || ''}
                  placeholder="เช่น ชั้น 1 หรือ 52" className={CTL(d)} />
              </F>
              <F label="วันที่เริ่มต้น">
                <input type="text" disabled={d} name="policy_start" defaultValue={report.policy_start || ''} className={CTL(d)} />
              </F>
              <F label="วันที่สิ้นสุด">
                <input type="text" disabled={d} name="policy_end" defaultValue={report.policy_end || ''} className={CTL(d)} />
              </F>

              <F label="ผู้เอาประกันภัย" req={<Req of="assured_name" />}>
                <input type="text" disabled={d} name="assured_name" defaultValue={report.assured_name || ''} className={CTL(d)} />
              </F>
              <F label="ชื่อผู้ขับขี่ตามกรมธรรม์">
                <input type="text" disabled={d} name="driver_by_policy" defaultValue={report.driver_by_policy || ''} className={CTL(d)} />
              </F>
              <F label="อีเมลผู้เอาประกัน">
                <input type="text" disabled={d} name="assured_email" defaultValue={report.assured_email || ''} className={CTL(d)} />
              </F>
              <F label="รหัสภัยยานยนต์">
                <input type="text" disabled={d} name="risk_code" defaultValue={report.risk_code || ''} className={CTL(d)} />
              </F>

              <F label="กรมธรรม์ (พรบ.)">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-gray-500 shrink-0 text-xs">
                    <input type="checkbox" disabled={d} checked={!!report.prb_number} className="w-3.5 h-3.5" /> มี
                  </label>
                  <input type="text" disabled={d} name="prb_number" defaultValue={report.prb_number || ''}
                    className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                </div>
              </F>
              <F label="ค่าเสียหายส่วนแรก">
                <input type="text" disabled={d} name="deductible" defaultValue={report.deductible != null ? Number(report.deductible).toFixed(2) : '0.00'} className={CTL(d)} />
              </F>
              {/* ชื่ออู่/ศูนย์ซ่อม เป็นข้อความล้วน — ห้ามใส่ใน numericCols (ตัด comma จะกินชื่ออู่ที่มีลูกน้ำ)
                  maxLength ตรงกับ VARCHAR(200) — ยาวเกินแล้ว Postgres ไม่ตัดปลายให้ แต่ error จนบันทึกไม่ผ่านทั้งใบ */}
              <F label="ซ่อมที่" span={4}>
                <input type="text" disabled={d} maxLength={200} name="repair_shop" defaultValue={report.repair_shop || ''} className={CTL(d)} />
              </F>
            </div>

          </div>
          </div>

          {/* รายละเอียดรถยนต์ — แบบตาราง */}
          <div data-section="car" className="space-y-2">
          <SectionBar title="รถประกัน" gap={(gapSec ?? []).includes('car')} />
          <div>
          <div className="bg-white rounded-lg shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 text-sm">
            <F label="หมายเลขทะเบียน" req={<Req of="license_plate" />}>
              <input type="text" disabled={d} name="license_plate" defaultValue={report.license_plate || ''} className={CTL(d)} />
            </F>
            <F label="จังหวัด" req={<Req of="car_province" />}>
              <select disabled={d} name="car_province" defaultValue={report.car_province || '-- ระบุ --'} className={CTL(d)}>
                {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>
            <F label="ประเภทรถ" req={<Req of="car_type" />}>
              <select disabled={d} name="car_type" value={carType} onChange={e => setCarType(e.target.value)} className={CTL(d)}>
                <option value="0">-- ระบุ --</option>
                <option value="A">เก๋งเอเชีย</option>
                <option value="E">เก๋งยุโรป</option>
                <option value="M">รถจักรยานยนต์</option>
                <option value="T">กระบะ</option>
                <option value="V">รถตู้</option>
                <option value="W">รถบรรทุก</option>
                <option value="O">รถอื่นๆ</option>
              </select>
            </F>
            <F label="ยี่ห้อ">
              <select disabled={d} name="car_brand" defaultValue={report.car_brand || '-- ระบุ --'} className={CTL(d)}>
                {carBrandOptions(carType, report.car_brand).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </F>

            <F label="รุ่น">
              <input type="text" disabled={d} name="car_model" defaultValue={report.car_model || ''} className={CTL(d)} />
            </F>
            <F label="สีรถ">
              <select disabled={d} name="car_color" defaultValue={report.car_color || '-- ระบุ --'} className={CTL(d)}>
                {CAR_COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="ปีจดทะเบียนรถ">
              <input type="text" disabled={d} name="car_reg_year" defaultValue={report.car_reg_year || ''} className={CTL(d)} />
            </F>
            <F label="หมายเลขตัวถัง">
              <input type="text" disabled={d} name="chassis_no" defaultValue={report.chassis_no || ''} className={CTL(d)} />
            </F>

            <F label="หมายเลขเครื่อง">
              <input type="text" disabled={d} name="engine_no" defaultValue={report.engine_no || ''} className={CTL(d)} />
            </F>
            <F label="หมายเลข Model">
              <input type="text" disabled={d} name="model_no" defaultValue={report.model_no || ''} className={CTL(d)} />
            </F>
            <F label="หมายเลข กม.">
              <input type="text" disabled={d} name="mileage" defaultValue={report.mileage != null ? Number(report.mileage).toLocaleString() : ''} className={CTL(d)} />
            </F>
            <div className="min-w-0" />

            {/* 3 ช่องรถไฟฟ้า — แอปมือถือเก็บมาให้อยู่แล้ว แต่หน้านี้ไม่เคยมีที่แสดง/แก้
                (ผู้ตรวจจึงมองไม่เห็นและแก้ไม่ได้ ทั้งที่ข้อมูลมีอยู่ในระบบ) */}
            <F label="ประเภทรถยนต์ไฟฟ้า">
              <select disabled={d} name="ev_type" defaultValue={report.ev_type || '0'} className={CTL(d)}>
                {EV_TYPE_OPTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </F>
            <F label="หมายเลขแบตเตอรี่">
              <input type="text" disabled={d} name="ev_battery_no" defaultValue={report.ev_battery_no || ''} className={CTL(d)} />
            </F>
            <F label="วันเริ่มใช้แบตเตอรี่">
              <input type="text" disabled={d} name="ev_battery_start" defaultValue={report.ev_battery_start || ''} className={CTL(d)} />
            </F>
            <F label="หมายเลขเครื่องชาร์จ">
              <input type="text" disabled={d} name="ev_charger_no" defaultValue={report.ev_charger_no || ''} className={CTL(d)} />
            </F>
          </div>

          </div>
          </div>

          {/* ข้อมูลผู้ขับขี่ — แบบตาราง */}
          <div data-section="driver" className="space-y-2">
          <SectionBar title="ผู้ขับขี่รถประกัน" gap={(gapSec ?? []).includes('driver')} />
          <div>
            <div className="bg-white rounded-lg shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 text-sm">
              {/* 4 ช่องบังคับชุดเดียวกัน: เพศ · คำนำหน้า · ชื่อ · นามสกุล (EMCS บล็อกทั้งชุด) */}
              <F label="ผู้ขับขี่รถประกันภัย" req={<Req of="driver_gender,driver_title,driver_first_name,driver_last_name" />}>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-gray-500 shrink-0 text-xs"><input type="radio" name="driver_gender" value="M" disabled={d} defaultChecked={report.driver_gender === 'M'} className="w-3.5 h-3.5" /> ชาย</label>
                  <label className="flex items-center gap-1 text-gray-500 shrink-0 text-xs"><input type="radio" name="driver_gender" value="F" disabled={d} defaultChecked={report.driver_gender === 'F'} className="w-3.5 h-3.5" /> หญิง</label>
                  <select disabled={d} name="driver_title" defaultValue={report.driver_title || '0'} className={`min-w-0 flex-1 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                    <option value="0">- คำนำหน้า -</option>
                    <option value="นาย">นาย</option>
                    <option value="นาง">นาง</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.ญ.">ด.ญ.</option>
                    <option value="คุณ">คุณ</option>
                  </select>
                </div>
              </F>
              <F label="ชื่อ">
                <input type="text" disabled={d} name="driver_first_name" defaultValue={report.driver_first_name || ''} className={CTL(d)} />
              </F>
              <F label="นามสกุล">
                <input type="text" disabled={d} name="driver_last_name" defaultValue={report.driver_last_name || ''} className={CTL(d)} />
              </F>
              <F label="ความสัมพันธ์กับเจ้าของรถ" req={<Req of="driver_relation" />}>
                <select disabled={d} name="driver_relation" defaultValue={report.driver_relation || '0'} className={CTL(d)}>
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
              </F>

              <F label="วันเกิด" req={<Req of="driver_birthdate" />}>
                <input type="text" disabled={d} name="driver_birthdate" defaultValue={report.driver_birthdate || ''} className={CTL(d)} />
              </F>
              <F label="อายุ" req={<Req of="driver_age" />}>
                <input type="text" disabled={d} name="driver_age" defaultValue={report.driver_age != null ? report.driver_age : ''} className={CTL(d)} />
              </F>
              <F label="โทรศัพท์" req={<Req of="driver_phone" />}>
                <input type="text" disabled={d} name="driver_phone" defaultValue={report.driver_phone || ''} className={CTL(d)} />
              </F>
              <F label="บัตรประชาชนเลขที่" req={<Req of="driver_id_card" />}>
                <div className="flex items-center gap-1">
                  <input type="text" disabled={d} name="driver_id_card" defaultValue={report.driver_id_card || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                  {/* คนไทยต้องผ่าน checksum 13 หลัก · ต่างชาติขอแค่ไม่ว่าง (บัตรต่างด้าว/พาสปอร์ต
                      ไม่มีสูตรตรวจ) — แอปเก็บค่านี้อยู่แล้ว แต่หน้านี้ไม่เคยมีให้เลือก */}
                  <select disabled={d} name="driver_id_type" defaultValue={report.driver_id_type || 'thai'} className={`w-[84px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                    <option value="thai">คนไทย</option>
                    <option value="foreign">ต่างชาติ</option>
                  </select>
                </div>
              </F>

              {/* ที่อยู่ + จังหวัด + เขต/อำเภอ บังคับทั้ง 3 ช่อง (เจอสดตอนเทส 2026-08-01) */}
              <F label="ที่อยู่ปัจจุบัน" req={<Req of="driver_address,driver_province,driver_district" />} span={2}>
                <input type="text" disabled={d} name="driver_address" defaultValue={report.driver_address || ''} className={CTL(d)} />
              </F>
              <F label="จังหวัด">
                <select disabled={d} name="driver_province" value={driverProv} onChange={e => { setDriverProv(e.target.value); setDriverDist('-- เขต --'); }} className={CTL(d)}>
                  {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </F>
              <F label="เขต / อำเภอ">
                <select disabled={d} name="driver_district" value={driverDist} onChange={e => setDriverDist(e.target.value)} className={CTL(d)}>
                  {districtOptions(driverProv, driverProv === report.driver_province ? report.driver_district : '').map(dt => <option key={dt} value={dt}>{dt}</option>)}
                </select>
              </F>

              <F label="ใบอนุญาตขับขี่เลขที่" req={<Req of="driver_license_no" when="ผู้ขับขี่มีใบขับขี่" />}>
                <input type="text" disabled={d} name="driver_license_no" defaultValue={report.driver_license_no || ''} className={CTL(d)} />
              </F>
              <F label="ประเภทใบขับขี่">
                <select disabled={d} name="driver_license_type" defaultValue={report.driver_license_type || '0'} className={CTL(d)}>
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
              </F>
              <F label="ออกให้ที่">
                <input type="text" disabled={d} name="driver_license_place" defaultValue={report.driver_license_place || ''} className={CTL(d)} />
              </F>
              <F label="ใบสั่ง">
                <input type="text" disabled={d} name="driver_ticket" defaultValue={report.driver_ticket || ''} className={CTL(d)} />
              </F>

              <F label="ใบขับขี่ ออกให้วันที่">
                <input type="text" disabled={d} name="driver_license_start" defaultValue={report.driver_license_start || ''} className={CTL(d)} />
              </F>
              <F label="ใบขับขี่ หมดอายุวันที่">
                <input type="text" disabled={d} name="driver_license_end" defaultValue={report.driver_license_end || ''} className={CTL(d)} />
              </F>
              <F label="ความเสียหายประมาณ (บาท)">
                <input type="text" disabled={d} name="estimated_cost" defaultValue={report.estimated_cost != null ? Number(report.estimated_cost).toFixed(2) : ''} className={CTL(d)} />
              </F>
              <div className="min-w-0" />

              {/* ต้องมีรายการความเสียหายอย่างน้อย 1 รายการ (ผู้สำรวจเลือกจากแอป) */}
              <F label="ความเสียหายรถประกันภัย" req={<Req of="damage_description" />} span={4}>
                <textarea disabled={d} name="damage_description" defaultValue={report.damage_description || ''} rows={2} className={CTL(d)} />
                <div className="flex items-center gap-2 mt-1.5">
                  <button disabled={d} className="px-3 py-1 border border-gray-400 rounded bg-gray-200 text-gray-700 text-xs whitespace-nowrap">ข้อมูลความเสียหาย</button>
                  <button disabled={d} className="px-3 py-1 border border-gray-400 rounded bg-gray-200 text-gray-700 text-xs whitespace-nowrap">พิมพ์ข้อมูลความเสียหาย</button>
                </div>
              </F>
            </div>

          </div>
          </div>

          {/* ===== ลำดับเวลา — 5 จังหวะของงาน เรียงซ้าย→ขวา =====
              เดิม 5 จังหวะนี้กระจายอยู่ 3 แถวคนละที่ในตาราง ทำให้ "ผิดลำดับ" มองด้วยตาไม่เห็น
              (เจอจริงเคส #141: ถึงที่เกิดเหตุก่อนเกิดเหตุ 10 นาที ผ่านการอนุมัติมาแล้ว)
              ชื่อช่องเหมือนเดิมทุกตัว — ตัวบันทึกและดอกจันไม่ต้องแก้ */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">::: ลำดับเวลา</span>
              <span className="text-xs text-white/75">ระบบประกันตรวจว่าเรียงถูกลำดับ · วันที่เป็น พ.ศ. (วว/ดด/ปปปป)</span>
              {timeErrs.length > 0 && (
                <span className="ml-auto text-xs font-semibold bg-red-500 rounded px-2 py-0.5">ผิดลำดับ {timeErrs.length} จุด</span>
              )}
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-x-3 gap-y-4">
              {TIMELINE.map((n, i) => {
                const gap = n.keys.some((k) => missing.includes(k));
                const errs = timeErrs.filter((e) => e.at === n.date);
                return (
                  <div key={n.date} className="relative min-w-0">
                    {/* เส้นเชื่อมระหว่างจังหวะ — โชว์เฉพาะจอกว้างที่วางเรียงกัน 5 ช่อง */}
                    {i > 0 && <div className="hidden xl:block absolute -left-[14px] top-[11px] w-[14px] border-t-2 border-gray-200" />}
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <span className={`mt-[1px] w-[20px] h-[20px] shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center ${
                        gap ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-blue-100 text-blue-700'}`}>{i + 1}</span>
                      <span className="text-xs text-gray-600 leading-tight">{n.label} <Req of={n.keys.join(',')} /></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name={n.date} defaultValue={n.v.date} placeholder="วว/ดด/ปปปป"
                        className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name={n.hour} defaultValue={n.v.hour} placeholder="ชม"
                        className={`w-[34px] shrink-0 border border-gray-300 rounded px-1 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-400 shrink-0">:</span>
                      <input type="text" disabled={d} name={n.min} defaultValue={n.v.minute} placeholder="นาที"
                        className={`w-[34px] shrink-0 border border-gray-300 rounded px-1 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                    </div>
                    {/* เตือนตรงจุดที่ผิด — ไม่ต้องเลื่อนขึ้นไปอ่านข้างบนแล้วเลื่อนกลับลงมาแก้ */}
                    {errs.map((e) => (
                      <div key={e.msg} className="mt-1 text-[11px] leading-tight text-red-600">⚠ {e.msg}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== รายละเอียดอุบัติเหตุ — แบบตาราง ===== */}
          <div data-section="acc" className="space-y-2">
          <SectionBar title="อุบัติเหตุ" gap={(gapSec ?? []).includes('acc')} />
          <div>
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            {/* Header bar */}
            <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm">
              <span className="font-bold">::: รายละเอียดอุบัติเหตุ</span>
            </div>
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {/* สถานที่ + จังหวัด + เขต/อำเภอ บังคับทั้ง 3 (จังหวัด/อำเภอ = ตัวที่บอทใช้หาเรทด้วย) */}
                  <td className="px-4 py-2 text-gray-500">สถานที่เกิดเหตุ <Req of="acc_place,acc_province,acc_district" /> :</td>
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
                  <td className="px-4 py-2 text-gray-500">ลักษณะการเกิดเหตุ <Req of="acc_cause" /> :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_cause" defaultValue={report.acc_cause || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {ACC_CAUSE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ลักษณะความเสียหาย <Req of="acc_damage_type" /> :</td>
                  <td className="px-4 py-2">
                    <select disabled={d} name="acc_damage_type" defaultValue={report.acc_damage_type || '-- ระบุ --'} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`}>
                      {ACC_DAMAGE_TYPE_OPTIONS.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                    </select>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {/* ตรงกับช่อง "รายละเอียดการเกิดเหตุ" แท็บข้อมูลทั่วไปของ EMCS (ACC_DETAIL) */}
                  <td className="px-4 py-2 text-gray-500 align-top">รายละเอียดการเกิดเหตุ <Req of="acc_detail" /> :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <textarea disabled={d} name="acc_detail" defaultValue={report.acc_detail || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm min-h-[80px]`} rows={4} />
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ฝ่ายประมาท <Req of="acc_fault" /> :</td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {/* ⚠️ `value` ต้องเป็น **ค่าสั้นชุดเดียวกับแอปมือถือ** (_faultDropdown ที่
                          survey_form_screen.dart) — ไม่ใช่ป้ายเต็มที่โชว์
                          เดิมเว็บเขียนป้ายเต็มลง DB ทับค่าของแอป แล้วตรรกะในแอปที่เทียบตรง ๆ
                          (`_accFault == 'คู่กรณีผิด'`) เลิกทำงาน → แอปไม่บังคับ "คู่กรณีคันที่ +
                          การเรียกร้อง ≥1" ทั้งที่ EMCS ยังบังคับ · XML แมปได้ทั้ง 2 สำเนียงอยู่แล้ว
                          จึงไม่กระทบไฟล์ที่ส่งออก แต่ต้องเลิกทำให้ DB มีหลายสำเนียง */}
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ฝ่ายผิด" disabled={d} defaultChecked={report.acc_fault === 'ฝ่ายผิด' || report.acc_fault === 'รถประกันฝ่ายผิด' || report.acc_fault === 'รถประกันเป็นฝ่ายผิด'} className="w-3.5 h-3.5" /> รถประกันเป็นฝ่ายผิด</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="ฝ่ายถูกและผิด" disabled={d} defaultChecked={report.acc_fault === 'ฝ่ายถูกและผิด' || report.acc_fault === 'รถประกันเป็นฝ่ายถูกและผิด' || report.acc_fault === 'ถูกและผิด'} className="w-3.5 h-3.5" /> รถประกันเป็นฝ่ายถูกและผิด</label>
                      <label className="flex items-center gap-1"><input type="radio" name="acc_fault" value="คู่กรณีผิด" disabled={d} defaultChecked={report.acc_fault === 'คู่กรณีผิด' || report.acc_fault === 'รถคู่กรณีเป็นฝ่ายผิด'} className="w-3.5 h-3.5" /> รถคู่กรณีเป็นฝ่ายผิด</label>
                      <span className="text-gray-500">คู่กรณีคันที่{' '}
                        <span className={`ml-0.5 ${oppNoHl === 'red' ? 'text-red-600 font-bold' : 'text-amber-500'}`}
                          title={oppNoHl === 'red'
                            ? 'ผลคดี = รถคู่กรณีเป็นฝ่ายผิด → ระบบประกันบังคับช่องนี้ (และต้องติ๊กการเรียกร้องอย่างน้อย 1 ข้อด้วย)'
                            : 'บังคับเมื่อผลคดี = รถคู่กรณีเป็นฝ่ายผิด'}>*</span></span>
                      <input type="text" disabled={d} name="acc_fault_opponent_no" defaultValue={report.acc_fault_opponent_no ?? ''}
                        className={`w-[40px] border rounded px-2 py-1 text-gray-800 text-sm text-center ${
                          oppNoHl === 'none' ? `border-gray-300 ${d ? 'bg-gray-100' : 'bg-white'}` : HL_CLS[oppNoHl]}`} />
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
                  <td className="px-4 py-2 text-gray-500">ผู้สำรวจภัย <Req of="acc_surveyor" /> :</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_surveyor" defaultValue={report.acc_surveyor || ''} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      {/* ถอด <select> "สาขาผู้สำรวจ" ออก — มีตัวเลือกเดียวคือ placeholder
                          จึงเขียนค่าว่างทับทุกครั้งที่บันทึก · แอปมือถือถอด UI นี้ไปแล้ว
                          และ XML ใช้ SURVEYBRID จาก env ไม่ได้อ่านคอลัมน์นี้เลย */}
                      <span className="text-gray-500 shrink-0">โทรศัพท์ <Req of="acc_surveyor_phone" /> :</span>
                      <input type="text" disabled={d} name="acc_surveyor_phone" defaultValue={report.acc_surveyor_phone || ''} className={`w-[80px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                    </div>
                  </td>
                </tr>
                {/* 4 จังหวะเวลาที่เคยอยู่ตรงนี้ ย้ายขึ้นไปการ์ด "ลำดับเวลา" ด้านบนแล้ว */}
              </tbody>
            </table>
          </div>

          </div>
          </div>

          {/* คู่กรณี + ตำรวจ + ติดตามงาน — แบบตาราง */}
          <div data-section="claim" className="space-y-2">
          <SectionBar title="การเรียกร้องค่าเสียหายจากคู่กรณี" gap={(gapSec ?? []).includes('claim')} />
          <div>
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">การเรียกร้องค่าเสียหายจากคู่กรณี{' '}
                    <span
                      className={`ml-0.5 ${claimHl === 'red' ? 'text-red-600 font-bold' : 'text-amber-500'}`}
                      title={claimHl === 'red'
                        ? 'ผลคดี = รถคู่กรณีเป็นฝ่ายผิด → ระบบประกันบังคับให้ติ๊กอย่างน้อย 1 ข้อ เว้นว่างแล้วบันทึกไม่ผ่าน'
                        : 'บังคับเมื่อผลคดี = รถคู่กรณีเป็นฝ่ายผิด — ผลคดีอื่นไม่บังคับ'}
                    >*</span> :</td>
                  <td className="px-4 py-2 text-gray-800" colSpan={3}>
                    {/* กรอบ+พื้นหลังคุมทั้งกลุ่ม ไม่ใช่รายช่อง — checkbox เดี่ยว ๆ เล็กเกินกว่าจะเห็นสี
                        border ใสตอนปกติ เพื่อไม่ให้ layout ขยับตอนเปลี่ยนสี */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded px-2 py-1 border ${
                      claimHl === 'none' ? 'border-transparent' : HL_CLS[claimHl]}`}>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="คัดประจำวัน" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('คัดประจำวัน')} className="w-3.5 h-3.5" /> คัดประจำวัน</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="รับหลักฐานจากคู่กรณีผิด" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('รับหลักฐานจากคู่')} className="w-3.5 h-3.5" /> รับหลักฐานจากคู่กรณีผิด</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="บันทึกยอมรับผิด" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('บันทึกยอมรับ')} className="w-3.5 h-3.5" /> บันทึกยอมรับผิด</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="บัตรติดต่อ" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('บัตรติดต่อ')} className="w-3.5 h-3.5" /> บัตรติดต่อ</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="acc_claim_opponent" value="รับเงิน" disabled={d} defaultChecked={report.acc_claim_opponent?.includes('รับเงิน')} className="w-3.5 h-3.5" /> รับเงินจำนวน</label>
                      {/* ติ๊ก "รับเงินจำนวน" เมื่อไหร่ ช่องเงินคู่นี้บังคับทันที (กติกา EMCS) */}
                      <input type="text" name="acc_claim_amount" disabled={d} defaultValue={report.acc_claim_amount != null ? Number(report.acc_claim_amount).toFixed(2) : ''}
                        className={`w-[100px] ml-1 border rounded px-2 py-1 text-gray-800 text-sm ${
                          payHl === 'none' ? `border-gray-300 ${d ? 'bg-gray-100' : 'bg-white'}` : HL_CLS.red}`} />
                      <span className="text-gray-500">บาท</span>
                      <span className="ml-2 text-gray-500">จากจำนวนเงินเรียกร้องทั้งหมด :</span>
                      <input type="text" name="acc_claim_total_amount" disabled={d} defaultValue={report.acc_claim_total_amount != null ? Number(report.acc_claim_total_amount).toFixed(2) : ''}
                        className={`w-[100px] border rounded px-2 py-1 text-gray-800 text-sm ${
                          payHl === 'none' ? `border-gray-300 ${d ? 'bg-gray-100' : 'bg-white'}` : HL_CLS.red}`} />
                      <span className="text-gray-500">บาท</span>
                      {payOver && (
                        <span className="w-full text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                          ⚠ &quot;รับเงินจำนวน&quot; มากกว่า &quot;จากจำนวนเงินเรียกร้องทั้งหมด&quot; — ระบบประกันจะไม่ยอมให้บันทึก
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          </div>
          </div>

          {/* พนักงานสอบสวน + แอลกอฮอล์ — แบบตาราง */}
          <div data-section="police" className="space-y-2">
          <SectionBar title="คดี · ตำรวจ · ติดตามงาน" gap={(gapSec ?? []).includes('police')} />
          <div>
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ชื่อพนักงานสอบสวน <Req of="acc_police_name" when="ฝ่ายประมาท = &quot;รอสรุปผลคดี&quot; หรือมีการแจ้งความ" /> :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_police_name" defaultValue={report.acc_police_name || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                  <td className="px-4 py-2 text-gray-500">สถานีตำรวจ <Req of="acc_police_station" when="ฝ่ายประมาท = &quot;รอสรุปผลคดี&quot; หรือมีการแจ้งความ" /> :</td>
                  <td className="px-4 py-2"><input type="text" disabled={d} name="acc_police_station" defaultValue={report.acc_police_station || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความเห็นพนักงานสอบสวน :</td>
                  <td className="px-4 py-2" colSpan={3}><input type="text" disabled={d} name="acc_police_comment" defaultValue={report.acc_police_comment || ''} className={`w-full border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} /></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
                  <td className="px-4 py-2">
                    {/* วัน+เวลาเก็บรวมกันเป็น "วันที่|HH:mm" — ต้องแตกกลับมาใส่ช่องชั่วโมง/นาที
                        เดิม hardcode '' ทั้งคู่ → กดบันทึกทีเดียวเวลาที่ช่างกรอกมาหายทันที
                        (backend เขียนทับ acc_police_date ด้วยวันที่เปล่าเมื่อชั่วโมง/นาทีว่าง) */}
                    {(() => { const pol = parseDatetime(report.acc_police_date); return (
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_police_date" defaultValue={pol.date} className={`flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_police_hour" defaultValue={pol.hour} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_police_minute" defaultValue={pol.minute} className={`w-[35px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                    ); })()}
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

          {/* การติดตามงาน — รวมอยู่ในหมวด "คดี · ตำรวจ · ติดตามงาน" เดียวกันตามดีไซน์ใหม่ */}
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
                    {/* เช่นเดียวกับบล็อกตำรวจ — เดิมล้างเวลานัดหมายทิ้งทุกครั้งที่กดบันทึก */}
                    {(() => { const flu = parseDatetime(report.acc_followup_date); return (
                    <div className="flex items-center gap-1">
                      <input type="text" disabled={d} name="acc_followup_date" defaultValue={flu.date} className={`w-[130px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm`} />
                      <input type="text" disabled={d} name="acc_followup_hour" defaultValue={flu.hour} className={`w-[35px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาฬิกา :</span>
                      <input type="text" disabled={d} name="acc_followup_minute" defaultValue={flu.minute} className={`w-[35px] border border-gray-300 rounded px-2 py-1 text-gray-800 ${d ? 'bg-gray-100' : 'bg-white'} text-sm text-center`} />
                      <span className="text-gray-500 shrink-0">นาที</span>
                    </div>
                    ); })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          </div>
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
                <div data-section="opp" className="space-y-2">
                <SectionBar title={`คู่กรณี · ${opponents.length} คัน`} gap={(gapSec ?? []).includes('opp')} />
                <div>
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
                                {/* เพศ + วันเกิด: วันเกิดเป็นช่องบังคับของระบบประกัน แต่เดิมวิวนี้
                                    ไม่แสดงเลย ผู้ตรวจจึงไม่เห็นว่าขาดจนบอทไปติดที่ปลายทาง
                                    (แอปเก็บเพศเป็น 'ชาย'/'หญิง' ส่วนรถประกันเก็บ M/F — รองรับทั้งคู่) */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                                  <ReadItem label="ชื่อผู้ขับ" value={driverName} />
                                  <ReadItem label="เพศ" value={op?.gender === 'M' ? 'ชาย' : op?.gender === 'F' ? 'หญิง' : op?.gender} />
                                  <ReadItem label="วันเกิด" value={op?.birthdate} />
                                  <ReadItem label="ความสัมพันธ์" value={op?.relation} />
                                  <ReadItem label="อายุ" value={op?.age} />
                                  <ReadItem label="โทรศัพท์" value={op?.phone} />
                                  <ReadItem label="เลขบัตรประชาชน" value={op?.cid} />
                                  <ReadItem label="ใบขับขี่เลขที่" value={op?.license_no} />
                                  <ReadItem label="ประเภทใบขับขี่" value={op?.license_type} />
                                  <ReadItem label="เลขตัวถัง" value={op?.vin} />
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

                </div>
                </div>

                {/* ผู้บาดเจ็บ — แก้ได้ตอนกด "แก้ไข" (โชว์เสมอตอนแก้ ไม่งั้นเคสที่ว่างจะเพิ่มไม่ได้) */}
                <div data-section="inj" className="space-y-2">
                <SectionBar title={`ผู้บาดเจ็บ · ${injured.length} คน`} gap={(gapSec ?? []).includes('inj')} />
                <div>
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

                </div>
                </div>

                {/* ทรัพย์สินเสียหาย — แก้ได้ตอนกด "แก้ไข" */}
                <div data-section="prop" className="space-y-2">
                <SectionBar title={`ทรัพย์สินเสียหาย · ${property.length} ชิ้น`} gap={(gapSec ?? []).includes('prop')} />
                <div>
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
                </div>
                </div>

                <div data-section="dmg" className="space-y-2">
                <SectionBar title="ความเสียหายรถประกัน" gap={(gapSec ?? []).includes('dmg')} />
                <div>
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
                </div>
                </div>
              </>
            );
          })()}

        </>
      )}

      {/* ── การ์ดรูปหลักฐาน ── จำนวนรูปบอกอะไรได้เยอะ เอามาไว้บนหัวการ์ดเลย
          งานที่ดึงจากระบบเก่าตอน "รอตรวจข้อมูล" รูปยังทยอยขึ้น (วัดจริง: 1–5 ใบ
          ตอนนั้น เทียบกับ 22–41 ใบตอนจบงาน) → ต้องเห็นตัวเลขก่อนกดอนุมัติ
          ไม่งั้นบอทยกเข้า EMCS ด้วยรูป 3 ใบแล้วต้องตามแก้ทีหลัง */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gradient-to-r from-[#0174BE] to-[#4988C4] text-white px-4 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">::: รูปหลักฐาน</span>
          <span className="bg-white/20 rounded px-2 py-0.5 text-xs font-semibold">{photos?.length ?? 0} ใบ</span>
          {photoCats.length > 0 && (
            <span className="text-xs text-white/75 truncate">
              {photoCats.map((c) => `${c.name} ${c.n}`).join(' · ')}
            </span>
          )}
          {(photos?.length ?? 0) < 8 && (
            <span className="ml-auto text-xs font-semibold bg-amber-400 text-amber-950 rounded px-2 py-0.5">
              รูปน้อยผิดปกติ — เช็กว่าช่างส่งครบหรือยัง
            </span>
          )}
        </div>
        <div className="p-4">
          {/* onReviewSubmitted = โหลดเคสใหม่ทั้งก้อน — ใช้ซ้ำเพื่อให้รูปที่เพิ่งอัปโผล่ทันที
              (อนุมัติแล้วซ่อนแถบอัป — backend กันซ้ำอีกชั้นด้วย 423) */}
          <PhotoGallery photos={photos} caseId={approved ? undefined : caseData?.id}
                        onUploaded={onReviewSubmitted} />
        </div>
      </div>

      {/* การตรวจสอบ — กรอกได้เลยไม่ต้องกดแก้ไข */}
      <div data-section="review" className="space-y-2">
      <SectionBar title="การตรวจสอบ" gap={(gapSec ?? []).includes('review')} />
      <div>
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
            {/* "ความเห็นของผู้ตรวจสอบ" อยู่ตรงกลางระหว่างผลการดำเนินงานกับความเห็นเซอร์เวย์
                (user เคาะ 18/08/69) — เคยย้ายไปการ์ดตัดสินใจท้ายหน้าตามดีไซน์ แล้วย้ายกลับ
                ⛔ มีที่เดียวเท่านั้น: 2 ช่องชื่อเดียวกันเมื่อไหร่ ตัวบันทึกหยิบไปแค่ช่องเดียว
                   แล้วอีกช่องหายเงียบ ๆ (มีการ์ดเทสจับชื่อช่องซ้ำทั้งไฟล์) */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">ความเห็นของผู้ตรวจสอบ</label>
              <textarea name="review_comment" defaultValue={report?.review_comment || review?.comment || ''}
                placeholder="บันทึกสิ่งที่ตรวจพบ / สิ่งที่แก้ให้ / เหตุผลที่อนุมัติ"
                className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm min-h-[150px]" rows={6} />
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
                    {/* ฝั่งจ่ายพนักงาน — ระบบประกันไม่มีช่องนี้ ต้องเก็บที่ระบบเราเท่านั้น */}
                    <th className="px-3 py-2 text-center text-blue-700 font-semibold">ราคาพนักงาน<div className={`text-[10px] font-normal ${payEditable ? 'text-blue-400' : 'text-gray-400'}`}>
                      {payEditable ? 'จ่ายผู้สำรวจ' : 'งานระบบเดิม — ยอดอยู่ที่ se-billing'}
                    </div></th>
                    <th className="px-3 py-2 text-center text-gray-600 font-semibold">ราคาประกัน<div className="text-[10px] font-normal text-gray-400">เรียกเก็บประกัน</div></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าบริการ</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="service_fee_count" defaultValue={ex.service_fee_count || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">ครั้ง</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_service_fee" defaultValue={String(pay?.saved?.service_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="service_fee_price" defaultValue={ex.service_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าเดินทาง/ค่าพาหนะ</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="travel_fee_count" defaultValue={ex.travel_fee_count || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">ครั้ง</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_travel_fee" defaultValue={String(pay?.saved?.travel_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="travel_fee_price" defaultValue={ex.travel_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่ารูปถ่าย</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="photo_fee_count" defaultValue={ex.photo_fee_count || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">รูป</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_photo_fee" defaultValue={String(pay?.saved?.photo_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="photo_fee_price" defaultValue={ex.photo_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าโทรศัพท์</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_phone_fee" defaultValue={String(pay?.saved?.phone_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="phone_fee" defaultValue={ex.phone_fee || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าประกันตัว</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_bail_fee" defaultValue={String(pay?.saved?.bail_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="bail_fee" defaultValue={ex.bail_fee || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าเรียกร้อง</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="text" name="claim_fee_percent" defaultValue={ex.claim_fee_percent || ''} className="w-[50px] border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-center" /><span className="text-gray-500 w-[30px]">%</span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_claim_fee" defaultValue={String(pay?.saved?.claim_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="claim_fee_price" defaultValue={ex.claim_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">ค่าคัดประจำวัน</td>
                    <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><span className="w-[50px]"></span><span className="w-[30px]"></span></div></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_daily_fee" defaultValue={String(pay?.saved?.daily_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="daily_record_fee" defaultValue={ex.daily_record_fee || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">ค่าใช้จ่ายอื่นๆ</td>
                    <td className="px-3 py-2"><input type="text" name="other_fee_detail" defaultValue={ex.other_fee_detail || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm" /></td>
                    <td className="px-3 py-2"><input type="text" disabled={dPay} name="pay_other_fee" defaultValue={String(pay?.saved?.other_fee ?? '')} className={`w-full border rounded px-2 py-1 text-sm text-right ${dPay ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-blue-50 border-blue-300 text-blue-900'}`} /></td><td className="px-3 py-2"><input type="text" name="other_fee_price" defaultValue={ex.other_fee_price || ''} className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-white text-sm text-right" /></td>
                  </tr>
                  {/* หักเงิน — ระบบเดิมไม่มีแถวนี้ ต้องยืมช่อง "ค่าใช้จ่ายอื่นๆ" มาใช้
                      เพราะแทรกช่องใหม่ลงฟอร์มระบบเก่าไม่ได้ · เว็บนี้เราคุมเอง จึงแยกให้ถูกความหมาย */}
                  {/* สีกลาง ๆ ไม่ใช่สีเตือน — หักเงินไม่ใช่ช่องบังคับ (user เคาะ 17/08/69)
                      สีแดงบนหน้านี้สงวนไว้ให้ "ยังกรอกไม่ครบ" อย่างเดียว จะได้ไม่เตือนหลอก */}
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">หักเงิน</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={dDeduct} name="deduct_late" defaultChecked={Boolean(pay?.saved?.deduct_late)} />ส่งช้า
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={dDeduct} name="deduct_docs" defaultChecked={Boolean(pay?.saved?.deduct_docs)} />เอกสารไม่ครบ
                        </label>
                      </div>
                    </td>
                    {/* สลับให้ตรงกับแถวอื่น: คอลัมน์ 3 = ฝั่งพนักงาน · คอลัมน์ 4 = ฝั่งเรียกเก็บประกัน */}
                    <td className="px-3 py-2">
                      <input type="text" disabled={dDeduct} name="pay_deduct_fee" defaultValue={String(pay?.saved?.deduct_fee ?? '')}
                        className={`w-full border rounded px-2 py-1 text-sm text-right ${dDeduct ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-white border-gray-300 text-gray-800'}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" disabled={dDeduct} name="deduct_reason" placeholder="เหตุผลอื่น"
                        defaultValue={String(pay?.saved?.deduct_reason ?? '')}
                        className={`w-full border rounded px-2 py-1 text-sm ${dDeduct ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`} />
                    </td>
                  </tr>
                </tbody>
              </table>
              {/* ── ตัวปรับเรทฝั่งพนักงาน ── ของเดิมอยู่ในส่วนขยายเบราว์เซอร์บนหน้าระบบเก่า */}
              <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={dPay} name="out_of_area" defaultChecked={Boolean(pay?.saved?.out_of_area)} />
                    <span className="text-gray-700">นอกพื้นที่</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={dPay} name="out_of_hours" defaultChecked={Boolean(pay?.saved?.out_of_hours)} />
                    <span className="text-gray-700">นอกเวลา</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={dPay} name="special_tumbon" defaultChecked={Boolean(pay?.saved?.special_tumbon)} />
                    <span className="text-gray-700">ตำบลพิเศษ</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-gray-700">ค่าคัดประจำวัน</span>
                    <select disabled={dPay} name="daily_check" defaultValue={String(pay?.saved?.daily_check ?? '')}
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
      </div>
      </fieldset>

      {/* ── การ์ดตัดสินใจท้ายหน้า ──
          ปุ่ม + เหตุผลที่ยังกดไม่ได้ · ปุ่มชุดเดียวกันนี้อยู่บนแถบหัวเคสด้วย
          ("ความเห็นผู้ตรวจสอบ" อยู่ในหมวดการตรวจสอบ ไม่ใช่ที่นี่ — user เคาะ 18/08/69) */}
      <div className={`rounded-lg border ${approved ? 'border-green-200 bg-green-50' : approvalBlockers.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'} p-4 space-y-3`}>
        {approved ? (
          <div className="text-sm text-green-800">
            อนุมัติแล้ว — บอทจะนำเข้าระบบประกันให้ · แก้ต่อไม่ได้จนกว่าแอดมินจะปลดล็อก
          </div>
        ) : approvalBlockers.length > 0 ? (
          <div className="text-sm text-amber-900">
            <span className="font-semibold">ยังอนุมัติไม่ได้</span> — {approvalBlockers.join(' · ')}
            <div className="text-xs text-amber-700 mt-0.5">
              อนุมัติแล้วบอทจะยกเข้าระบบประกันทันที ถ้าช่องบังคับยังว่างจะไปตกที่นั่นแล้วเสียเที่ยว
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            ช่องบังคับครบแล้ว — อนุมัติได้
            {/* ⛔ ไม่เขียนว่า "ส่งเข้าระบบประกัน" เพราะบอทสร้างเป็น draft ให้เท่านั้น
                คนยังต้องกด "ส่งงานใหม่" เองอีกครั้ง (เฟส 3 ยังไม่เปิด) เขียนเกินจริงคือหลอกผู้ตรวจ */}
            <span className="text-gray-400"> · บอทจะนำเข้าเป็นร่างในระบบประกัน แล้วยังต้องมีคนกดส่งอีกครั้ง</span>
          </div>
        )}

        <div className="flex justify-end">{actionBar}</div>
      </div>
    </form>
  );
}
