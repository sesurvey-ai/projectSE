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
  { tag: 'CAR_REGNO', block: 'CAR', label: 'หมายเลขทะเบียน', emcsId: 'txtCar_RegNo' },
  { tag: 'CAR_PROVINCE', block: 'CAR', label: 'จังหวัด', emcsId: 'ddlCar_Province' },
  { tag: 'CTYPECODE', block: 'CAR', label: 'ประเภทรถ', emcsId: 'ddlCType' },
  { tag: 'DRI_GENDER', block: 'CAR', label: 'เพศผู้ขับขี่รถประกันภัย', emcsId: 'rdoGender_' },
  { tag: 'DRI_NAME', block: 'CAR', label: 'ชื่อผู้ขับขี่รถประกันภัย', emcsId: 'txtDri_Name01' },
];

/** ชื่อบริษัทตาม dropdown ของ EMCS → รหัส (ddlInsurerNameMajor) */
export const EMCS_INSURER_CODE: Record<string, string> = {
  'บริษัท อลิอันซ์ อยุธยา ประกันภัย จำกัด (มหาชน)': '1723',
  'บริษัท เจมาร์ท ประกันภัย จํากัด (มหาชน)': '2424',
  'บริษัท เดอะ วัน ประกันภัย จำกัด (มหาชน)': '4',
  'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)': '2429',
  'ประกันภัยทดสอบ': '1',
  'ฟอลคอนประกันภัย  จำกัด (มหาชน)': '1232',
  'ไอโออิกรุงเทพประกันภัย': '1059',
};

/** ช่องบังคับ 'เฉพาะบางบริษัท' — ใช้ตอนตรวจงานได้ เพราะรู้บริษัทแล้ว
 *  (ตอนอัปโหลดไฟล์ยังไม่รู้ จึงใช้ไม่ได้) */
export const EMCS_REQUIRED_BY_INSURER: Record<string, EmcsRequiredField[]> = {
  '12': [
    { tag: 'ACC_PROVINCEID', block: 'REPORT', label: 'จังหวัด ที่เกิดเหตุ', emcsId: 'ddlAcc_ProvinceID' },
    { tag: 'DRI_PROVINCEID', block: 'CAR', label: 'จังหวัด', emcsId: 'ddlDri_ProvinceID' }
  ],
  '1232': [
    { tag: 'ACC_CLAIMREF_NO', block: 'REPORT', label: 'เลขที่รับแจ้ง', emcsId: 'txtAcc_ClaimRef_No' }
  ],
  '1518': [
    { tag: 'REF_CLAIM_NO', block: 'REPORT', label: 'เลขที่เคลม', emcsId: 'txtRef_Claim_No' }
  ],
  '17': [
    { tag: 'ACC_CLAIMREF_NO', block: 'REPORT', label: 'เลขที่รับแจ้ง', emcsId: 'txtAcc_ClaimRef_No' },
    { tag: 'DRI_ADDRESS', block: 'CAR', label: 'ที่อยู่ปัจจุบัน', emcsId: 'txtDri_Address' },
    { tag: 'DRI_DISTRICTID', block: 'CAR', label: 'เขต/อำเภอของที่อยู่ปัจจุบัน', emcsId: 'ddlDri_DistrictID' },
    { tag: 'DRI_PROVINCEID', block: 'CAR', label: 'จังหวัดของที่อยู่ปัจจุบัน', emcsId: 'ddlDri_ProvinceID' }
  ],
  '19': [
    { tag: 'ACC_PROVINCEID', block: 'REPORT', label: 'จังหวัด ที่เกิดเหตุ', emcsId: 'ddlAcc_ProvinceID' }
  ],
  '2': [
    { tag: 'CAUSE_CODE', block: 'REPORT', label: 'ลักษณะการเกิดเหตุ', emcsId: 'ddlClm_Cause' },
    { tag: 'KM_NO', block: 'CAR', label: 'หมายเลข กม.', emcsId: 'txtKm_No' }
  ],
  '20': [
    { tag: 'KM_NO', block: 'CAR', label: 'หมายเลข กม.', emcsId: 'txtKm_No' }
  ],
  '2101': [
    { tag: 'ACC_DATE', block: 'REPORT', label: 'วันที่เกิดเหตุและเวลาประมาณ', emcsId: 'wuCale_Acc_Date_txtCalendar' },
    { tag: 'ACC_DETAIL', block: 'REPORT', label: 'รายละเอียดการเกิดเหตุ', emcsId: 'txtAcc_Detail' },
    { tag: 'ACC_FINISH', block: 'REPORT', label: 'วันที่สำรวจภัยเสร็จ', emcsId: 'wuCale_Acc_Finish_txtCalendar' },
    { tag: 'ACC_PLACE', block: 'REPORT', label: 'สถานที่เกิดเหตุ', emcsId: 'txtAcc_Place' },
    { tag: 'ACC_REACH', block: 'REPORT', label: 'วันที่สำรวจภัย(ถึงที่เกิดเหตุเวลา)', emcsId: 'wuCale_Acc_Reach_txtCalendar' },
    { tag: 'CAUSE_CODE', block: 'REPORT', label: 'ลักษณะการเกิดเหตุ', emcsId: 'ddlClm_Cause' },
    { tag: 'DRI_AGE', block: 'CAR', label: 'อายุ', emcsId: 'txtDri_Age' },
    { tag: 'DRI_BIRTHDAY', block: 'CAR', label: 'วันเกิด', emcsId: 'wuCale_Dri_BirthDay_txtCalendar' },
    { tag: 'DRI_CARDID', block: 'CAR', label: 'บัตรประชาชนเลขที่', emcsId: 'txtDri_CardID' },
    { tag: 'DRI_DRVID', block: 'CAR', label: 'ใบอนุญาตขับขี่เลขที่', emcsId: 'txtDri_DrvID' },
    { tag: 'DRI_TELNO', block: 'CAR', label: 'โทรศัพท์ ผู้ขับขี่รถประกันภัย', emcsId: 'txtDri_TelNo' },
    { tag: 'INS_CALLING_SURV_DATE', block: 'REPORT', label: 'วันที่บ.ประกันแจ้งสำรวจภัย', emcsId: 'wuCale_Ins_Calling_Surv_Date_txtCalendar' }
  ],
  '2348': [
    { tag: 'ACC_CLAIMREF_NO', block: 'REPORT', label: 'เลขที่รับแจ้ง', emcsId: 'txtAcc_ClaimRef_No' },
    { tag: 'REF_CLAIM_NO', block: 'REPORT', label: 'เลขที่เคลม', emcsId: 'txtRef_Claim_No' }
  ],
  '821': [
    { tag: 'ACC_CLAIMREF_NO', block: 'REPORT', label: 'กรุณาระบุเลขที่รับแจ้ง ด้วยตัวเลข 8 หลัก เช่น 12345678', emcsId: 'txtAcc_ClaimRef_No' }
  ],
};
