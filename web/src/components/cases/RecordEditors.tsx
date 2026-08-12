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

export type RecordItem = Record<string, string>;

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

const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 bg-white';

type FieldDef = {
  k: string;
  label: string;
  /** ไม่ใส่ = ช่องข้อความ */
  options?: string[];
  /** กว้างเต็มแถว (ที่อยู่/รายละเอียด) */
  wide?: boolean;
  placeholder?: string;
};

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className={def.wide ? 'col-span-2 md:col-span-4' : ''}>
      <label className="block text-xs text-gray-500 mb-0.5">{def.label}</label>
      {def.options ? (
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">-- ระบุ --</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type="text" className={inputCls} value={value} placeholder={def.placeholder}
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
