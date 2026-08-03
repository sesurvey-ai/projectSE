// สร้างอัตโนมัติจาก se-autokey/tools/emcs_spec.py --emit-ts — **อย่าแก้ด้วยมือ**
// ที่มา: ฟังก์ชัน vlid* ในหน้า EMCS จริง (อ่าน Check*Valid ไม่ใช่ดอกจัน)
// รันใหม่เมื่อ EMCS เปลี่ยนฟอร์ม แล้ว commit ไฟล์นี้
//
// เฉพาะช่องที่ **บังคับทุกบริษัทโดยไม่มีเงื่อนไข** เท่านั้น — ช่องที่บังคับเฉพาะ
// บางบริษัท/บางเงื่อนไข ไม่ใส่ไว้ เพราะตอน parse ยังไม่รู้ว่าเป็นบริษัทไหน
// (เตือนไปก็อาจเตือนผิด)

export interface EmcsRequiredField {
  /** tag ใน INSERT_SURV_REPORT_XML */
  tag: string;
  /** บล็อกที่ tag อยู่ */
  block: 'REPORT' | 'CAR';
  /** ป้ายบนหน้าจอ EMCS — ใช้เป็นข้อความเตือน */
  label: string;
  /** id ของช่องบนหน้า EMCS (ไว้ไล่ย้อน) */
  emcsId: string;
}

export const EMCS_REQUIRED: EmcsRequiredField[] = [
  { tag: 'HEV_CAR', block: 'REPORT', label: 'รถเสียหาย', emcsId: 'rdoHev_Car_' },
  { tag: 'INSURERBRID', block: 'REPORT', label: 'สาขาบริษัทประกัน', emcsId: 'ddlInsurer_Name' },
  { tag: 'CAR_REGNO', block: 'CAR', label: 'หมายเลขทะเบียน', emcsId: 'txtCar_RegNo' },
  { tag: 'CAR_PROVINCE', block: 'CAR', label: 'จังหวัด', emcsId: 'ddlCar_Province' },
  { tag: 'CTYPECODE', block: 'CAR', label: 'ประเภทรถ', emcsId: 'ddlCType' },
  { tag: 'DRI_GENDER', block: 'CAR', label: 'เพศผู้ขับขี่รถประกันภัย', emcsId: 'rdoGender_' },
  { tag: 'DRI_NAME', block: 'CAR', label: 'ชื่อผู้ขับขี่รถประกันภัย', emcsId: 'txtDri_Name01' },
];
