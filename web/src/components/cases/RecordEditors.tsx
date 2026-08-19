'use client';

/**
 * แก้ "ผู้บาดเจ็บ" + "ทรัพย์สินเสียหาย" บนหน้าตรวจงาน
 *
 * จำเป็นเพราะ: เคสที่นำเข้าจากไฟล์ XML ของ ISURVEY ได้ข้อมูลสองส่วนนี้มาไม่ครบ —
 * ไฟล์จริง 5 ไฟล์ไม่เคยมี HOS_NAME/INCOME/POSITION/WORK_PLACE/FROM_DATE/TO_DATE/COST เลย
 * และ PERSON_TYPE ฝั่งคู่กรณี (02/04) กู้จาก XML ไม่ได้เพราะ export ยุบเหลือ DV/PV/ON
 * ก่อนหน้านี้เว็บโชว์อย่างเดียว ผู้ตรวจต้องไปเติมใน EMCS เอง
 *
 * key ของ object ตรงกับที่แอปมือถือเก็บ (injured_editor.dart / property_editor.dart)
 * และตัวเลือก dropdown = master ของ EMCS verbatim (survey_master.dart) — ถ้าพิมพ์เพี้ยน
 * lookup ใน xmlExport.service.ts จะ map ไม่เจอ แล้วส่งค่าว่างเข้า EMCS
 *
 * รวมสองตัวไว้ไฟล์เดียวเพราะใช้ layout/primitive ชุดเดียวกัน (การ์ดต่อ 1 ระเบียน + ปุ่มลบ + ปุ่มเพิ่ม)
 */
import React from 'react';
import { PROVINCE_OPTIONS, CAR_COLOR_OPTIONS, EV_TYPE_OPTIONS, carBrandOptions } from './caseOptions';
import { districtOptions } from './districtOptions';
import { insurerOptions, isEmcsInsurer } from './insurerOptions';

export type RecordItem = Record<string, string>;

/**
 * คู่กรณี 1 คัน — **ไม่ใช่ `RecordItem`** เพราะมีคีย์ที่ไม่ใช่ข้อความปนอยู่:
 * `damage` (อาเรย์ความเสียหายรายชิ้น) และ `kfk` (บูลีน)
 * ถ้าแปลงทั้งก้อนเป็นสตริงเหมือนผู้บาดเจ็บ/ทรัพย์สิน ข้อมูลสองตัวนี้จะพัง
 * (`damage` กลายเป็น "[object Object]") → editor นี้จึงแตะเฉพาะคีย์ที่ตัวเองรู้จัก
 * คีย์อื่นส่งผ่านไปเฉย ๆ
 */
export type LooseRecord = Record<string, unknown>;

/** ประเภทผู้บาดเจ็บ — EMCS ddlPerson_Type (01-05) */
const PERSON_TYPES = [
  'ผู้ขับขี่ - รถประกัน', 'ผู้ขับขี่ - รถคู่กรณี', 'ผู้โดยสาร - รถประกัน',
  'ผู้โดยสาร - รถคู่กรณี', 'บุคคลภายนอกรถ',
];
/** ระดับการบาดเจ็บ — EMCS ddlWounded_Type (01-06) */
const WOUND_LEVELS = [
  'บาดเจ็บ - เล็กน้อย', 'บาดเจ็บ - ปานกลาง', 'บาดเจ็บ - สาหัส',
  'ทุพพลภาพ', 'เสียชีวิตก่อนรักษา', 'เสียชีวิตหลังรักษา',
];
/** ความสัมพันธ์ — EMCS ddlDri_Relation_ID (40 รหัส) */
const RELATIONS = [
  'สามี', 'ภรรยา', 'บุตร', 'บิดา', 'มารดา', 'นายจ้าง', 'ลูกจ้าง', 'ผู้เช่า', 'พี่ชาย',
  'พี่สาว', 'น้องชาย', 'น้องสาว', 'เจ้าของรถ', 'หลาน', 'อา', 'น้า', 'ลุง', 'ป้า', 'ญาติ',
  'เพื่อน', 'แฟน', 'พนักงาน', 'พี่เขย', 'น้องเขย', 'พี่สะใภ้', 'น้องสะใภ้',
  'พนักงานผู้เช่า', 'ลุงเขย', 'น้าเขย', 'น้าสะใภ้', 'อาเขย', 'อาสะใภ้', 'หุ้นส่วน',
  'บุตรหุ้นส่วน', 'เจ้าของบริษัท', 'เพื่อนบุตรเจ้าของรถ', 'บุตรเขย', 'หลานเขย',
  'บุตรสะใภ้',
];
const GENDERS = ['ชาย', 'หญิง'];
/** คำนำหน้า — EMCS ddlDri_Title_ID (sync survey_master.dart kTitles) */
const TITLES = ['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.', 'คุณ'];
/** ประเภทรถคู่กรณี — EMCS ddlCType verbatim (sync survey_master.dart kOpoCarTypes) */
const OPO_CAR_TYPES = [
  'เก๋งเอเชีย', 'เก๋งยุโรป', 'รถจักรยานยนต์', 'รถอื่นๆ', 'กระบะ', 'รถตู้', 'รถบรรทุก',
];
/** ประเภทใบขับขี่ — EMCS ddlEmcs_License_Type verbatim (sync survey_master.dart kLicenseTypes) */
const LICENSE_TYPES = [
  'ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ', 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลตลอดชีพ',
  'ใบขับขี่รถยนต์ส่วนบุคคลชั่วคราว', 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลชั่วคราว',
  'ใบขับขี่รถยนต์ส่วนบุคคล 5 ปีต่ออายุ', 'ใบขับขี่รถยนต์สาธารณะ', 'ใบขับขี่สากล',
  'ใบขับขี่รถยนต์ส่วนบุคคลหนึ่งปีต่ออายุ', 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลหนึ่งปี',
  'ใบขับขี่รถยนต์ส่วนบุคคล 7 ปีต่ออายุ', 'ใบขับขี่รถยนต์ส่วนบุคคล',
  'ใบขับขี่รถจักรยานยนต์ส่วนบุคคล', 'ใบขับขี่ขนส่งชนิดที่1', 'ใบขับขี่ขนส่งชนิดที่2',
  'ใบขับขี่ขนส่งชนิดที่3', 'ใบอนุญาติขับขี่ชนิดที่4', 'ไม่มีใบขับขี่',
  'ใบขับขี่รถยนต์สามล้อส่วนบุคคลสาธารณะ', 'ใบขับขี่รถยนต์สามล้อส่วนบุคคลชั่วคราว',
  'ใบอนุญาตเป็นผู้ขับรถทุกประเภท', 'อื่นๆ',
];


/** ข้อความ placeholder ที่ปนอยู่ในลิสต์ตัวเลือก — ต้องไม่กลายเป็นค่าที่เลือกได้จริง */
const PLACEHOLDERS = new Set(['-- ระบุ --', '-- เลือก --', '-- เขต --']);

type FieldDef = {
  k: string;
  label: string;
  /** ไม่ใส่ = ช่องข้อความ */
  options?: string[];
  /** ตัวเลือกที่ขึ้นกับค่าช่องอื่นในระเบียนเดียวกัน (ยี่ห้อ←ประเภทรถ · อำเภอ←จังหวัด) */
  optionsFrom?: (rec: LooseRecord) => string[];
  /** กว้างเต็มแถว (ที่อยู่/รายละเอียด) */
  wide?: boolean;
  placeholder?: string;
};

/**
 * ช่องบังคับที่ยังว่าง = กรอบแดง + พื้นแดง (ชุดเดียวกับฟอร์มหลักในหน้าตรวจงาน)
 *
 * "บังคับ" อ่านจากป้ายที่ลงท้ายด้วย ` *` ซึ่งเป็นเครื่องหมายที่ใช้อยู่แล้วในลิสต์ด้านล่าง
 * → ช่องบังคับที่เพิ่มวันหลังได้สีเองโดยไม่ต้องมาแก้ที่นี่
 * ⛔ ไม่นับ `*(บางบริษัท)` — บังคับเฉพาะบางบริษัท ทาแดงไว้จะกลายเป็นเตือนหลอกทุกเคส
 */
const isRequiredLabel = (label: string) => / \*$/.test(label.trim());
const REQ_CLS = 'border-red-400 ring-1 ring-red-300 bg-red-50';
const OK_CLS = 'border-gray-300 bg-white';

/**
 * ช่อง "ชื่อคน" ของ EMCS มีตัวกรองอักขระติดอยู่ (TextboxValidate.js: `/([ a-zA-Z0-9ก-์.-])/`)
 * เจออักขระนอกลิสต์ — **วงเล็บก็อยู่นอกลิสต์** — EMCS จะ *ล้างค่าทั้งช่องทิ้ง* ตอนคนคลิก
 * เข้า-ออกช่องนั้น ไม่ใช่แค่ตัดตัวอักษร → ชื่อหายไปทั้งชื่อโดยไม่มีใครรู้
 * ต้องตรงกับ EMCS_NAME_OK ใน backend/src/services/xmlExport.service.ts
 */
const EMCS_NAME_OK = /^[ a-zA-Z0-9ก-์.-]*$/;
const NAME_KEYS = new Set(['owner_name', 'first_name', 'last_name', 'name']);

/** อักขระในชื่อที่ EMCS ไม่รับ (คืนค่าว่าง = ไม่มีปัญหา) — ใช้ร่วมกับ CaseDetail */
export const emcsBadChars = (v: string) => {
  const s = String(v ?? '');
  if (!s.trim()) return '';
  const bad = Array.from(new Set(s.split('').filter((c) => !EMCS_NAME_OK.test(c))));
  return bad.join(' ');
};

const badNameChars = (k: string, v: string) => (NAME_KEYS.has(k) ? emcsBadChars(v) : '');

const cls = (def: FieldDef, value: string, warn: string) =>
  `w-full border rounded px-2 py-1 text-sm text-gray-800 ${
    warn || (isRequiredLabel(def.label) && !String(value ?? '').trim()) ? REQ_CLS : OK_CLS}`;

/**
 * เลขบัตรประชาชนไทย 13 หลัก (mod 11) — ลอกจาก `cidChecksum` ของแอปมือถือทีต่อที
 *
 * ⛔ EMCS ตรวจหลักตรวจสอบเอง แล้ว **ปัดตกทั้งบล็อกผู้บาดเจ็บ** ด้วยข้อความ
 *    "กรุณาระบุเลขที่บัตรประชาชน ของ::คนที่ 1 ให้ถูกต้อง" (เจอจากการทดสอบสด 19/08/69)
 *    แอปมือถือกันไว้ตั้งแต่หน้ากรอกแล้ว เว็บเป็นทางเดียวที่ปล่อยเลขมั่วผ่านไปได้
 */
const cidChecksum = (raw: string): boolean => {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
};

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const v = String(value ?? '');
  const badChars = badNameChars(def.k, v);
  const badCid = def.k === 'cid' && v.trim() !== '' && !cidChecksum(v);
  /**
   * ชื่อบริษัทที่ไม่มีในลิสต์ของ EMCS — บอทเลือกไม่ได้
   * เกิดกับงานเก่าที่นำเข้ามาก่อนมีลิสต์นี้ และชื่อฝั่ง ISURVEY ที่แปลงอัตโนมัติไม่ได้
   * (จงใจไม่เดาให้ — ชื่อบริษัทประกันต่างกันแค่คำท้าย เช่น ประกันภัย/ประกันสุขภาพ
   *  เดาผิดทีเดียว = เคลมไปผูกกับบริษัทผิด · ให้คนเลือกปลอดภัยกว่า)
   */
  const offList = def.k === 'insurer' && !isEmcsInsurer(v);
  const warn = badChars ? `EMCS ไม่รับอักขระ ${badChars}`
    : offList ? 'ชื่อนี้ไม่มีใน EMCS — เลือกใหม่จากลิสต์'
      : badCid ? 'เลขบัตรไม่ถูกต้อง — EMCS จะไม่ยอมบันทึกทั้งบล็อก'
        : '';
  const c = cls(def, v, warn);
  return (
    <div className={def.wide ? 'col-span-2 md:col-span-4' : ''}>
      <label className="block text-xs text-gray-500 mb-0.5">
        {def.label}
        {warn && <span className="ml-1 text-red-600 font-medium">· {warn}</span>}
      </label>
      {def.options ? (
        <select className={c} value={value} title={warn || undefined}
                onChange={(e) => onChange(e.target.value)}>
          <option value="">-- ระบุ --</option>
          {/* ⛔ ตัดตัว placeholder ออกจากลิสต์ก่อน — PROVINCE_OPTIONS[0] / CAR_COLOR_OPTIONS[0]
              เป็น '-- ระบุ --' และ districtOptions[0] เป็น '-- เขต --' ซึ่ง**มีค่าเป็นข้อความจริง**
              ถ้าไม่ตัด dropdown จะมี 2 บรรทัดหน้าตาเหมือนกันเป๊ะ ตัวล่างเลือกแล้วเก็บข้อความนั้น
              ลง JSONB → ตัวนับช่องบังคับเห็นว่า "กรอกแล้ว" ป้ายเตือนหาย และรหัสจังหวัดใน XML ว่าง */}
          {def.options.filter((o) => !PLACEHOLDERS.has(o.trim()))
            .map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type="text" className={c} value={value} placeholder={def.placeholder}
          title={badChars ? `EMCS จะล้างชื่อทั้งช่องทิ้งเพราะมีอักขระ: ${badChars}` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/** การ์ด 1 ระเบียน + ปุ่มลบ, และปุ่มเพิ่มท้ายรายการ — ใช้ร่วมกันทั้งผู้บาดเจ็บ/ทรัพย์สิน */
function RecordList({
  items, onChange, fields, cardTitle, addLabel, emptyHint,
}: {
  items: RecordItem[];
  onChange: (next: RecordItem[]) => void;
  fields: FieldDef[];
  cardTitle: (i: number) => string;
  addLabel: string;
  emptyHint: string;
}) {
  const set = (i: number, k: string, v: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{emptyHint}</p>
      )}

      {items.map((it, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{cardTitle(i)}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="ml-auto px-2 py-0.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
            >
              ลบ
            </button>
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
            {fields.map((f) => (
              <Field key={f.k} def={f} value={it[f.k] ?? ''} onChange={(v) => set(i, f.k, v)} />
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, Object.fromEntries(fields.map((f) => [f.k, ''])) as RecordItem])}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
      >
        {addLabel}
      </button>
    </div>
  );
}

// ลำดับช่องตามหน้าผู้บาดเจ็บของแอปมือถือ (person_type → ข้อมูลตัว → ที่ทำงาน → การรักษา)
//
// ⚠️ `*` = ช่องบังคับ **รายคน/รายชิ้น** ของระบบประกัน (vlidInjPerson / vlidAsset)
//    ลิสต์ต้องตรงกับ `checkItems()` ในแอปมือถือ (survey_form_screen.dart)
//    ขาดแม้ช่องเดียว = บันทึก**ทั้งบล็อก**บนระบบประกันไม่ผ่าน และช่องที่ว่างกลายเป็น '-'
//    ให้หัวหน้าไล่แก้เองทีละช่อง — เดิมหน้านี้ติดดาวไว้ช่องเดียว (ประเภทผู้บาดเจ็บ)
const INJURED_FIELDS: FieldDef[] = [
  { k: 'person_type', label: 'ประเภทผู้บาดเจ็บ *', options: PERSON_TYPES },
  { k: 'relation', label: 'ความสัมพันธ์', options: RELATIONS },
  { k: 'gender', label: 'เพศ *', options: GENDERS },
  { k: 'name', label: 'ชื่อ-นามสกุล *' },
  { k: 'age', label: 'อายุ' },
  { k: 'cid', label: 'เลขบัตรประชาชน *' },
  { k: 'car_reg', label: 'เลขทะเบียนรถ' },
  { k: 'phone', label: 'โทรศัพท์' },
  { k: 'occupation', label: 'อาชีพ' },
  { k: 'work_place', label: 'ทำงานที่' },
  { k: 'position', label: 'ตำแหน่ง' },
  { k: 'income', label: 'รายได้' },
  { k: 'hospital', label: 'โรงพยาบาล *' },
  { k: 'treat_from', label: 'รักษาตั้งแต่', placeholder: 'วว/ดด/ปปปป (พ.ศ.)' },
  { k: 'treat_to', label: 'ถึงวันที่', placeholder: 'วว/ดด/ปปปป (พ.ศ.)' },
  { k: 'treat_cost', label: 'ค่ารักษา' },
  { k: 'wound_level', label: 'ระดับการบาดเจ็บ', options: WOUND_LEVELS },
  { k: 'address', label: 'ที่อยู่', wide: true },
  { k: 'symptom', label: 'อาการบาดเจ็บ *', wide: true },
];

const PROPERTY_FIELDS: FieldDef[] = [
  { k: 'item', label: 'รายการทรัพย์สิน *' },
  { k: 'owner_name', label: 'เจ้าของ *' },
  { k: 'owner_phone', label: 'โทรศัพท์เจ้าของ' },
  { k: 'estimated_cost', label: 'ค่าเสียหายประมาณ' },
  { k: 'owner_address', label: 'ที่อยู่เจ้าของ', wide: true },
  { k: 'cause', label: 'สาเหตุที่เสียหาย *', wide: true },
  { k: 'detail', label: 'รายละเอียดความเสียหาย *', wide: true },
];

export function InjuredEditor({ items, onChange }: { items: RecordItem[]; onChange: (n: RecordItem[]) => void }) {
  return (
    <RecordList
      items={items} onChange={onChange} fields={INJURED_FIELDS}
      cardTitle={(i) => `ผู้บาดเจ็บคนที่ ${i + 1}`}
      addLabel="+ เพิ่มผู้บาดเจ็บ"
      emptyHint="ยังไม่มีผู้บาดเจ็บ — เคสที่นำเข้าจากไฟล์ XML อาจได้ข้อมูลส่วนนี้มาไม่ครบ กรอกเพิ่มได้ที่นี่"
    />
  );
}

export function PropertyEditor({ items, onChange }: { items: RecordItem[]; onChange: (n: RecordItem[]) => void }) {
  return (
    <RecordList
      items={items} onChange={onChange} fields={PROPERTY_FIELDS}
      cardTitle={(i) => `รายการที่ ${i + 1}`}
      addLabel="+ เพิ่มทรัพย์สิน"
      emptyHint="ยังไม่มีทรัพย์สินเสียหาย — เคสที่นำเข้าจากไฟล์ XML อาจได้ข้อมูลส่วนนี้มาไม่ครบ กรอกเพิ่มได้ที่นี่"
    />
  );
}

/** ทิ้งแถวที่ว่างทั้งใบ (กดเพิ่มแล้วไม่กรอก) — ส่งไปก็ทำให้บอทนับรายการเพี้ยน */
export const dropEmptyRecords = (items: RecordItem[]): RecordItem[] =>
  items.filter((it) => Object.values(it).some((v) => String(v ?? '').trim() !== ''));

// ───────────────────────── คู่กรณี ─────────────────────────
//
// เดิมหน้าตรวจงาน **แสดงคู่กรณีอย่างเดียว แก้ไม่ได้** ทั้งที่ระบบประกันบังคับ 7 ช่องรายคัน
// และ 4 ใน 7 (ประเภทรถ · เพศ · วันเกิด · อายุ) เป็น dropdown/วันที่/ตัวเลข ที่ใส่ "-" แทนไม่ได้
// → ขาดแล้วบอทค้างกลางทางที่หน้าคู่กรณี ผู้ตรวจต้องโทรตามให้ช่างแก้จากแอปอย่างเดียว
//
// `*` = **สกัดจาก validator จริง `vlidOpoCar`** บนหน้า EMCS ที่เซฟไว้ (เคส 000098)
//   base 8 ช่องบังคับทุกบริษัท: เจ้าของ · ทะเบียน · จังหวัด · มีประกันภัยที่ · กรมธรรม์
//                              · วันเกิด · อายุ · ประเภทรถ
//
// ⚠️ **ต่างจากลิสต์ในแอปมือถือ 3 จุด** (แอปเช็ค 7 ช่อง) — อ้างอิง validator เพราะเป็นตัวที่บล็อกจริง:
//   · แอป**ไม่เช็ค** "เจ้าของคู่กรณี" + "กรมธรรม์" ทั้งที่ EMCS บังคับทุกบริษัท → ที่นี่ติดดาวแดง
//   · แอปเช็ค "เพศ" เสมอ แต่ EMCS บังคับเฉพาะ `case '12'` → ที่นี่เป็นดาวส้ม
//     (แอปเข้มกว่าไม่เสียหาย ข้อมูลมีมาให้อยู่แล้ว — แค่คนละเหตุผล)
//
// ⚠️ `province` ทำ 2 หน้าที่ในสคีมาของแอป: จังหวัดป้ายทะเบียน **และ** จังหวัดที่อยู่ผู้ขับขี่
//    (เป็น parent ของ cascade อำเภอ) — สืบทอดมาจากฝั่งแอป ยังไม่ได้แยก
const OPPONENT_FIELDS: FieldDef[] = [
  { k: 'car_type', label: 'ประเภทรถ *', options: OPO_CAR_TYPES },
  { k: 'plate', label: 'ทะเบียน *' },
  { k: 'province', label: 'จังหวัด *', options: PROVINCE_OPTIONS },
  { k: 'car_brand', label: 'ยี่ห้อ', optionsFrom: (r) => carBrandOptions(String(r.car_type ?? ''), String(r.car_brand ?? '')) },
  { k: 'car_model', label: 'รุ่น' },
  { k: 'reg_year', label: 'ปีจดทะเบียน' },
  { k: 'car_color', label: 'สีรถ', options: CAR_COLOR_OPTIONS },
  { k: 'vin', label: 'เลขตัวถัง' },
  { k: 'mileage', label: 'เลขไมล์' },
  // ต้องเป็นตัวเลือก ไม่ใช่ช่องพิมพ์ — แอปเก็บ "รหัส" (BEV/HEV/…) และบอทเลือกด้วย
  // select_by_value แบบตรงตัว พิมพ์เองเพี้ยนนิดเดียว = บอทข้ามช่องนี้เงียบ ๆ
  { k: 'ev_type', label: 'ประเภทรถไฟฟ้า', options: EV_TYPE_OPTIONS.map((e) => e.value).filter(Boolean) },
  { k: 'estimated_cost', label: 'ค่าเสียหายประมาณ' },
  // dropdown ไม่ใช่ช่องพิมพ์ — บน EMCS ช่องนี้คือ ddlHave_Insurance และบอทเลือกด้วย
  // fuzzy_select · สะกดเองเพี้ยนนิดเดียว บอทข้ามช่องนี้เงียบ ๆ (ดู insurerOptions.ts)
  { k: 'insurer', label: 'มีประกันภัยที่ *', optionsFrom: (r) => insurerOptions(String(r.insurer ?? '')) },
  { k: 'policy_no', label: 'เลขกรมธรรม์ *' },
  // ปลายทางดึงเฉพาะตัวเลขจากข้อความ — พิมพ์ "ชั้นหนึ่ง" ได้ค่าว่าง
  // ช่องพิมพ์ ไม่ใช่ dropdown — บน EMCS ช่องนี้ของคู่กรณีก็เป็นช่องพิมพ์ (txtPolicy_Type)
  // และของจริงมีนอกลิสต์ เช่น "ประเภท 2+ ซ่อมอู่"
  { k: 'policy_type', label: 'ประเภทประกัน' },
  { k: 'claim_no', label: 'เลขเคลมคู่กรณี' },
  { k: 'owner_name', label: 'เจ้าของรถ *' },
  { k: 'owner_address', label: 'ที่อยู่เจ้าของ', wide: true },
  { k: 'title', label: 'คำนำหน้า', options: TITLES },
  { k: 'first_name', label: 'ชื่อผู้ขับขี่' },
  { k: 'last_name', label: 'นามสกุล' },
  { k: 'gender', label: 'เพศ *(บางบริษัท)', options: GENDERS },
  { k: 'birthdate', label: 'วันเกิด *', placeholder: 'วว/ดด/ปปปป (พ.ศ.)' },
  { k: 'age', label: 'อายุ *' },
  { k: 'relation', label: 'ความสัมพันธ์', options: RELATIONS },
  { k: 'phone', label: 'โทรศัพท์' },
  { k: 'cid', label: 'เลขบัตรประชาชน' },
  { k: 'license_no', label: 'เลขใบขับขี่' },
  { k: 'license_type', label: 'ประเภทใบขับขี่', options: LICENSE_TYPES },
  { k: 'license_start', label: 'ใบขับขี่ ออกให้', placeholder: 'วว/ดด/ปปปป (พ.ศ.)' },
  { k: 'license_end', label: 'ใบขับขี่ สิ้นสุด', placeholder: 'วว/ดด/ปปปป (พ.ศ.)' },
  { k: 'district', label: 'เขต/อำเภอ (ที่อยู่)', optionsFrom: (r) => districtOptions(String(r.province ?? ''), String(r.district ?? '')) },
  { k: 'address', label: 'ที่อยู่ผู้ขับขี่', wide: true },
];

/** คีย์ที่ editor นี้ดูแล — ใช้ตัดสินว่าการ์ด "ว่างทั้งใบ" ไหม โดยไม่นับ damage/kfk */
const OPPONENT_KEYS = OPPONENT_FIELDS.map((f) => f.k);

/** 8 ช่องที่ `vlidOpoCar` บล็อกทุกบริษัท — ใช้นับป้าย "ยังขาด N ช่องบังคับ" */
export const OPPONENT_REQUIRED = [
  'owner_name', 'plate', 'province', 'insurer', 'policy_no', 'birthdate', 'age', 'car_type',
];

/**
 * ช่องบังคับของผู้บาดเจ็บ/ทรัพย์สิน — ดึงจากดอกจันท้าย label ของ field def เดียวกับที่วาดฟอร์ม
 * ⛔ ต้อง export ให้หน้าตรวจเคสเอาไปนับเข้าประตูอนุมัติด้วย ไม่งั้นการ์ดขึ้น "ยังขาด N ช่อง"
 *    แต่แถบบนขึ้นเขียว "ครบแล้ว" แล้วอนุมัติผ่าน → บอทไปตายที่หน้าคู่กรณีของ EMCS
 */
const reqKeys = (defs: FieldDef[]) => defs.filter((f) => f.label.trim().endsWith('*')).map((f) => f.k);
export const INJURED_REQUIRED = reqKeys(INJURED_FIELDS);
export const PROPERTY_REQUIRED = reqKeys(PROPERTY_FIELDS);

export function OpponentEditor({ items, onChange }: {
  items: LooseRecord[]; onChange: (next: LooseRecord[]) => void;
}) {
  // spread ของเดิมไว้เสมอ → `damage` / `kfk` / คีย์ที่ยังไม่รู้จัก รอดไปกับการบันทึก
  const set = (i: number, k: string, v: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  return (
    <div className="space-y-4">
      {items.map((it, i) => {
        const missing = OPPONENT_REQUIRED.filter((k) => !String(it[k] ?? '').trim());
        const dmg = Array.isArray(it.damage) ? it.damage.length : 0;
        return (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">คู่กรณีคันที่ {i + 1}</span>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox" className="w-3.5 h-3.5"
                  checked={it.kfk === true || it.kfk === 'true'}
                  onChange={(e) => onChange(items.map((x, idx) => (idx === i ? { ...x, kfk: e.target.checked } : x)))}
                />
                KFK
              </label>
              {dmg > 0 && (
                <span className="text-xs text-gray-500" title="แก้รายการความเสียหายของคู่กรณีได้จากแอปเท่านั้น">
                  ความเสียหาย {dmg} รายการ (แก้ในแอป)
                </span>
              )}
              {missing.length > 0 && (
                <span className="text-xs text-red-600">⚠ ยังขาด {missing.length} ช่องบังคับ</span>
              )}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="ml-auto px-2 py-0.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                ลบ
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
              {OPPONENT_FIELDS.map((f) => (
                <Field
                  key={f.k}
                  def={f.optionsFrom ? { ...f, options: f.optionsFrom(it) } : f}
                  value={String(it[f.k] ?? '')}
                  onChange={(v) => set(i, f.k, v)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...items, Object.fromEntries(OPPONENT_KEYS.map((k) => [k, ''])) as LooseRecord])}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
      >
        + เพิ่มคู่กรณี
      </button>
    </div>
  );
}

/** ทิ้งคันที่ยังไม่กรอกอะไรเลย — ไม่นับ `damage`/`kfk` เพราะการ์ดเปล่าก็มีสองคีย์นี้ติดมาได้ */
export const dropEmptyOpponents = (items: LooseRecord[]): LooseRecord[] =>
  items.filter((it) => OPPONENT_KEYS.some((k) => String(it[k] ?? '').trim() !== ''));
