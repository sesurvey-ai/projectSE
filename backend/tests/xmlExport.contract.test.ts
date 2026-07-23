/**
 * Contract test — สัญญา XML ระหว่าง producer (se-survey) กับ consumer (se-autokey)
 *
 * ล็อกไว้ว่า generateSurveyXml() ต้อง emit "ทุก tag ที่ se-autokey/autokey/surv_xml.py
 * (parse_surv_report) อ่าน" — ครบทั้ง 5 บล็อก: REPORT · รถประกัน(TYPE=0) · คู่กรณี(TYPE=20)
 * · ผู้บาดเจ็บ(TXN_SURV_INJ) · ทรัพย์สิน(TXN_SURV_ASSET)
 *
 * ถ้าฝั่งใดแก้ชื่อ tag/format สัญญานี้จะพัง → เทสฟ้อง (แทนที่จะพังเงียบตอน import จริง)
 * ⚠️ ต้อง sync กับ se-autokey/test_surv_contract.py (ใช้ค่าชุดเดียวกัน)
 *
 * รัน: npm test   (backend/)
 */
import { generateSurveyXml } from '../src/services/xmlExport.service';

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  const status = cond ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${name}` + (detail ? `  (${detail})` : ''));
  if (!cond) failed++;
}

// ── fixture: รถประกัน + คู่กรณี 1 + ผู้บาดเจ็บ 1 + ทรัพย์สิน 1 (ค่าชุดเดียวกับฝั่ง py) ──
const row: Record<string, unknown> = {
  survey_job_no: 'SETP-CONTRACT-001', claim_no: 'CLAIM-CONTRACT-001', claim_ref_no: 'REF-CONTRACT-001',
  policy_no: 'POL-CONTRACT-001', assured_name: 'บริษัท ทดสอบสัญญา จำกัด', policy_type: '2+',
  policy_start: '23/06/2026', policy_end: '23/06/2027',
  acc_date: '27/06/2026', acc_time: '19:00', acc_place: 'ซอยทดสอบสัญญา',
  acc_province: 'กรุงเทพฯ', acc_district: 'เขตตลิ่งชัน', acc_detail: 'รายละเอียดทดสอบสัญญา',
  acc_fault: 'คู่กรณีผิด', acc_reporter: 'ผู้แจ้งทดสอบ', acc_surveyor: 'SE250 ผู้สำรวจ',
  prb_number: 'PRB-1', claim_type: 'F',
  // รถประกัน
  car_brand: 'TOYOTA', car_type: 'A', car_color: 'น้ำเงิน', car_model: 'VIOS',
  license_plate: 'ษข9066', car_province: 'กรุงเทพ', chassis_no: 'CHASSIS123', engine_no: 'ENGINE123',
  car_reg_year: '2023', model_no: 'MDL-123', mileage: 45000, risk_code: 'RISK-01',
  driver_name: 'ผู้ขับ ทดสอบ', driver_title: 'นาย', driver_age: 32,
  driver_relation: 'ลูกจ้าง', driver_address: '37 บุรีรัมย์', driver_province: 'บุรีรัมย์',
  driver_district: 'เมืองบุรีรัมย์', driver_phone: '0999999999', driver_id_card: '1234567890123',
  driver_license_no: 'LIC123', driver_license_type: 'ใบขับขี่รถยนต์ส่วนบุคคล', driver_license_place: 'กรุงเทพ',
  driver_license_start: '01/01/2020', driver_license_end: '01/01/2030', driver_birthdate: '16/05/1994',
  driver_gender: 'ชาย', estimated_cost: 3500,
  // 1:N JSONB
  opposing_parties: [{
    plate: '7ชน807', province: 'กรุงเทพ ฯ', district: 'เขตตลิ่งชัน', vin: 'OPPVIN1', car_type: 'A', car_brand: 'HONDA',
    car_model: 'CITY', reg_year: '2022', car_color: 'ขาว', title: 'นาย', first_name: 'คู่กรณี',
    last_name: 'ทดสอบ', age: 40, gender: 'ชาย', relation: 'เจ้าของรถ', address: 'ที่อยู่คู่กรณี', phone: '0888888888',
    cid: '9876543210987', license_no: 'OPPLIC', license_type: 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคล',
    insurer: 'ไอโออิกรุงเทพประกันภัย',
    policy_no: 'OPPPOL', claim_no: 'OPPCLAIM', policy_type: '1',
  }],
  injured_persons: [{
    name: 'ผู้บาดเจ็บ ทดสอบ', age: 25, cid: '1111111111111', occupation: 'พนักงาน', car_reg: 'ษข9066',
    address: 'ที่อยู่ผู้บาดเจ็บ', phone: '0777777777', hospital: 'รพ.ทดสอบ', treat_cost: 5000,
    symptom: 'ฟกช้ำ', gender: 'ชาย', person_type: 'ผู้ขับขี่รถประกัน', wound_level: 'เล็กน้อย',
    // form-carried (bot กรอกฟอร์มเอง — 2026-07-23)
    work_place: 'บริษัท ก จำกัด', position: 'พนักงานขาย', income: 15000,
    treat_from: '27/06/2569', treat_to: '30/06/2569', relation: 'ญาติ',
  }, {
    // คนที่ 2 = ผู้โดยสารรถประกัน → PERSON_TYPE ต้องเป็น PV (ยืนยันจากฟอร์ม EMCS จริง ddlPerson_Type=03)
    name: 'ผู้โดยสาร ทดสอบ', age: 30, cid: '2222222222222', hospital: 'รพ.ทดสอบ', treat_cost: 3000,
    symptom: 'ถลอก', gender: 'หญิง', person_type: 'ผู้โดยสารรถประกัน', wound_level: 'ปานกลาง',
  }],
  damaged_property: [{
    item: 'รั้วบ้าน', detail: 'รั้วหัก', cause: 'ถูกชน', estimated_cost: 2000,
    owner_name: 'เจ้าของทรัพย์', owner_address: 'ที่อยู่ทรัพย์', owner_phone: '0666666666',
  }],
};

const xml = generateSurveyXml(row as never);
const has = (tag: string, val: string) => xml.includes(`<${tag}>${val}</${tag}>`);
const tag = (t: string) => new RegExp(`<${t}>`).test(xml);

// โครงหลัก
check('root INSERT_SURV_REPORT_XML', xml.startsWith('<?xml') && xml.includes('<INSERT_SURV_REPORT_XML>'));
check('มี TXN_SURV_CAR 2 บล็อก (รถประกัน + คู่กรณี)', (xml.match(/<TXN_SURV_CAR>/g) || []).length === 2);
check('มี TXN_SURV_INJ 2 บล็อก', (xml.match(/<TXN_SURV_INJ>/g) || []).length === 2);
check('มี TXN_SURV_ASSET 1 บล็อก', (xml.match(/<TXN_SURV_ASSET>/g) || []).length === 1);

// REPORT — tag ที่ consumer/EMCS ต้องใช้
check('REPORT: SURV_JOBNO', has('SURV_JOBNO', 'SETP-CONTRACT-001'));
check('REPORT: REF_CLAIM_NO', has('REF_CLAIM_NO', 'CLAIM-CONTRACT-001'));
check('REPORT: ACC_CLAIMREF_NO', has('ACC_CLAIMREF_NO', 'REF-CONTRACT-001'));
check('REPORT: ACC_POLICY_NO', has('ACC_POLICY_NO', 'POL-CONTRACT-001'));
check('REPORT: ASSURED_NAME', has('ASSURED_NAME', 'บริษัท ทดสอบสัญญา จำกัด'));
check('REPORT: ACC_DETAIL', has('ACC_DETAIL', 'รายละเอียดทดสอบสัญญา'));

// รถประกัน (TYPE=0) — consumer อ่าน gender/title_id/idcard
check('รถประกัน: TYPE=0', has('TYPE', '0'));
check('รถประกัน: CAR_REGNO=ษข9066', has('CAR_REGNO', 'ษข9066'));
check('รถประกัน: CMFG=ATOYOTA (car_type A + brand)', has('CMFG', 'ATOYOTA'));
check('รถประกัน: DRI_CARDID', has('DRI_CARDID', '1234567890123'));
// เพศ → รหัส 1 ตัว (EMCS XML importer บังคับขนาด 1 — ชาย→M, หญิง→F; live import 2026-07-23)
check('รถประกัน/คู่กรณี: DRI_GENDER=M (ชาย→รหัส)', has('DRI_GENDER', 'M'));
check('บาดเจ็บ: GENDER=M (ชาย→รหัส)', has('GENDER', 'M'));
check('บาดเจ็บ: GENDER=F (หญิง→รหัส)', has('GENDER', 'F'));
check('ไม่มีเพศไทยหลุดใน DRI_GENDER/GENDER', !xml.includes('<DRI_GENDER>ชาย') && !xml.includes('<GENDER>ชาย'));
check('รถประกัน: COST_DAMAGE=3500', has('COST_DAMAGE', '3500'));
// tag ที่เพิ่งต่อสาย (gap audit 2026-07-22) — ล็อกไว้ไม่ให้หลุดกลับเป็นว่าง
check('รถประกัน: MODELNO ← model_no', has('MODELNO', 'MDL-123'));
check('รถประกัน: KM_NO ← mileage', has('KM_NO', '45000'));
check('REPORT: RISK_CODE ← risk_code', has('RISK_CODE', 'RISK-01'));

// คู่กรณี (TYPE=20)
check('คู่กรณี: TYPE=20', has('TYPE', '20'));
check('คู่กรณี: CAR_REGNO=7ชน807', has('CAR_REGNO', '7ชน807'));
check('คู่กรณี: CMFG=AHONDA', has('CMFG', 'AHONDA'));
check('คู่กรณี: CTYPECODE=A', has('CTYPECODE', 'A'));
check('คู่กรณี: DRI_NAME', has('DRI_NAME', 'คู่กรณี ทดสอบ'));
check('คู่กรณี: HAVE_INSURANCE=1 (มีประกัน)', has('HAVE_INSURANCE', '1'));
check('คู่กรณี: POLICYNO/CLAIMNO', has('POLICYNO', 'OPPPOL') && has('CLAIMNO', 'OPPCLAIM'));
// อำเภอคู่กรณี (wired ใหม่ 2026-07-22): เขตตลิ่งชัน กรุงเทพ → DRI_DISTRICTID=219 (เดิม hardcode ว่าง)
check('คู่กรณี: DRI_DISTRICTID=219 (เขตตลิ่งชัน)', has('DRI_DISTRICTID', '219'));
// ประเภทใบขับขี่คู่กรณี (bot select_by_value 2026-07-23): จยย.ส่วนบุคคล=20 (≠ insured รถยนต์=19)
check('คู่กรณี: DRI_DRVTYPE=20 (ประเภทใบขับขี่)', has('DRI_DRVTYPE', '20'));

// ผู้บาดเจ็บ (TXN_SURV_INJ) — ข้อ 3: PERSON_TYPE/WOUNDED_TYPE
check('บาดเจ็บ: NAME', has('NAME', 'ผู้บาดเจ็บ ทดสอบ'));
check('บาดเจ็บ: CITIZEN_ID', has('CITIZEN_ID', '1111111111111'));
check('บาดเจ็บ: COST', has('COST', '5000'));
check('บาดเจ็บ: INJURE=ฟกช้ำ', has('INJURE', 'ฟกช้ำ'));
// ⚠️ ค่าล็อกสัญญา — PERSON_TYPE DV/ON + WOUNDED_TYPE 01-06 ยังไม่ได้ยืนยันกับ EMCS export จริงที่มีผู้บาดเจ็บ
check('บาดเจ็บ: PERSON_TYPE=DV (ผู้ขับขี่รถประกัน)', has('PERSON_TYPE', 'DV'));
check('บาดเจ็บ: PERSON_TYPE=PV (ผู้โดยสารรถประกัน) — ยืนยันจากฟอร์มจริง', has('PERSON_TYPE', 'PV'));
check('บาดเจ็บ: WOUNDED_TYPE=01 (เล็กน้อย)', has('WOUNDED_TYPE', '01'));
check('บาดเจ็บ: WOUNDED_TYPE=02 (ปานกลาง)', has('WOUNDED_TYPE', '02'));
// ผู้บาดเจ็บ tag EMCS canonical (ยืนยัน gold reference 2026-07-23): FROM_DATE/TO_DATE/DRI_RELATION_ID
check('บาดเจ็บ: WORK_PLACE ← work_place', has('WORK_PLACE', 'บริษัท ก จำกัด'));
check('บาดเจ็บ: POSITION ← position', has('POSITION', 'พนักงานขาย'));
check('บาดเจ็บ: INCOME ← income', has('INCOME', '15000'));
check('บาดเจ็บ: FROM_DATE ← treat_from (พ.ศ.→ค.ศ.)', has('FROM_DATE', '2026-06-27 00:00:00'));
check('บาดเจ็บ: TO_DATE ← treat_to', has('TO_DATE', '2026-06-30 00:00:00'));
check('บาดเจ็บ: DRI_RELATION_ID=19 (ญาติ, lookup)', has('DRI_RELATION_ID', '19'));

// ทรัพย์สิน (TXN_SURV_ASSET)
check('ทรัพย์สิน: ASSET_DESC=รั้วบ้าน', has('ASSET_DESC', 'รั้วบ้าน'));
check('ทรัพย์สิน: ASSET_DAMAGE=รั้วหัก', has('ASSET_DAMAGE', 'รั้วหัก'));
check('ทรัพย์สิน: COST_DAMAGE=2000', has('COST_DAMAGE', '2000'));
check('ทรัพย์สิน: OWNER', has('OWNER', 'เจ้าของทรัพย์'));

console.log(`\n${failed === 0 ? '✅ ผ่านทั้งหมด' : `❌ ล้มเหลว ${failed} รายการ`}`);
process.exit(failed === 0 ? 0 : 1);
