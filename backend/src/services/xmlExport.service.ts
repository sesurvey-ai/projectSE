/**
 * xmlExport.service — สร้าง INSERT_SURV_REPORT_XML (สัญญาข้อมูลพอร์ทัลประกัน e-Survey)
 * จาก survey_reports ของ se-survey เพื่อให้ surveyor นำไป import เข้าระบบประกันแทนการคีย์มือ
 *
 * โครงสร้าง 3 บล็อก: TXN_SURV_REPORT (1) · TXN_SURV_CAR (รถประกัน + คู่กรณีซ้ำได้) · TXN_SURV_BILL (1)
 * โค้ด/ตาราง lookup สกัดจาก dropdown ของหน้า frmSurvey.aspx (กรอกรายละเอียดอุบัติเหตุ.html) ตรงเป๊ะ
 *
 * วันที่ทุกกลุ่ม (POLICY_/ACC_/DRI_) เป็น "ค.ศ." — ยืนยันจาก export จริงของ EMCS 2 ไฟล์
 * (se-autokey/runs/xml/*.txt: POLICY_START=2025-11-03 ฯลฯ); ความเชื่อเดิมว่า POLICY_* เป็น พ.ศ.
 * มาจาก sample แรกที่หาไม่เจอแล้ว และขัดกับไฟล์จริงทั้งคู่ → ใช้ ค.ศ. ทั้งหมด
 * ⚠️ เขต/อำเภอ (ACC_DISTRICTID/DRI_DISTRICTID): พอร์ทัลใช้รหัส 4 หลัก cascade รายจังหวัด — ตารางเต็มไม่มีในไฟล์
 *    ที่บันทึกไว้ → v1 ปล่อยว่าง (เหมือน ACC_DISTRICTID ในตัวอย่าง) จนกว่าจะได้ตารางอำเภอครบจากประกัน
 */

import { EMCS_REQUIRED, EMCS_REQUIRED_BY_INSURER, EMCS_INSURER_CODE }
  from '../data/emcsRequired';
import type { EmcsRequiredField } from '../data/emcsRequired';
import { EMCS_DISTRICTS } from '../data/emcsDistricts';

// ── SE Survey identity ในพอร์ทัล (คงที่ต่อบริษัท; override ได้ผ่าน env) ──
const SURVEY_ID = process.env.PORTAL_SURVEY_ID || '5684';
const SURVEY_BR_ID = process.env.PORTAL_SURVEY_BR_ID || '1602';

// ── ตาราง lookup ชื่อ(se) → รหัส(พอร์ทัล) ──
const PROVINCE: Record<string, string> = {
  'กระบี่': '1', 'กรุงเทพ ฯ': '2', 'กรุงเทพฯ': '2', 'กรุงเทพมหานคร': '2', 'กาญจนบุรี': '3', 'กาฬสินธุ์': '4',
  'กำแพงเพชร': '5', 'ขอนแก่น': '6', 'จันทบุรี': '7', 'ฉะเชิงเทรา': '8', 'ชลบุรี': '9', 'ชัยนาท': '10',
  'ชัยภูมิ': '11', 'ชุมพร': '12', 'เชียงราย': '13', 'เชียงใหม่': '14', 'ตรัง': '15', 'ตราด': '16', 'ตาก': '17',
  'นครนายก': '18', 'นครปฐม': '19', 'นครพนม': '20', 'นครราชสีมา': '21', 'นครศรีธรรมราช': '22', 'นครสวรรค์': '23',
  'นนทบุรี': '24', 'นราธิวาส': '25', 'น่าน': '26', 'บุรีรัมย์': '27', 'ปทุมธานี': '28', 'ประจวบคีรีขันธ์': '29',
  'ปราจีนบุรี': '30', 'ปัตตานี': '31', 'พะเยา': '32', 'พังงา': '33', 'พัทลุง': '34', 'พิจิตร': '35', 'พิษณุโลก': '36',
  'เพชรบุรี': '37', 'เพชรบูรณ์': '38', 'แพร่': '39', 'ภูเก็ต': '40', 'มหาสารคาม': '41', 'มุกดาหาร': '42',
  'แม่ฮ่องสอน': '43', 'ยโสธร': '44', 'ยะลา': '45', 'ร้อยเอ็ด': '46', 'ระนอง': '47', 'ระยอง': '48', 'ราชบุรี': '49',
  'ลพบุรี': '50', 'ลำปาง': '51', 'ลำพูน': '52', 'เลย': '53', 'ศรีสะเกษ': '54', 'สกลนคร': '55', 'สงขลา': '56',
  'สตูล': '57', 'สมุทรปราการ': '58', 'สมุทรสงคราม': '59', 'สมุทรสาคร': '60', 'สระแก้ว': '61', 'สระบุรี': '62',
  'สิงห์บุรี': '63', 'สุโขทัย': '64', 'สุพรรณบุรี': '65', 'สุราษฎร์ธานี': '66', 'สุรินทร์': '67', 'หนองคาย': '68',
  'หนองบัวลำภู': '69', 'พระนครศรีอยุธยา': '70', 'อยุธยา': '70', 'อ่างทอง': '71', 'อำนาจเจริญ': '72', 'อุดรธานี': '73',
  'อุตรดิตถ์': '74', 'อุทัยธานี': '75', 'อุบลราชธานี': '76', 'เบตง': '77', 'บึงกาฬ': '78', 'อื่นๆ': '79',
};

// สีรถ (ddlCar_Color) — sync master EMCS 55 รหัส verbatim 2026-07-25
const COLOR: Record<string, string> = {
  'ขาว': '1', 'เทา': '2', 'เงิน': '3', 'ทอง': '4', 'เหลือง': '5', 'เขียว': '6', 'ฟ้า': '7', 'น้ำเงิน': '8',
  'ม่วง': '9', 'แดง': '10', 'ส้ม': '11', 'เลือดหมู': '12', 'ดำ': '13', 'ขาว / ทอง': '14',
  'เทา / เงิน': '15', 'เหลือง / เงิน': '16', 'เขียว / เงิน': '17', 'น้ำเงิน / เทา': '18',
  'น้ำเงิน / เงิน': '19', 'แดง / เทา': '20', 'ดำ / เทา': '21', 'น้ำตาล': '22', 'เขียว / เทา': '23',
  'ชมพู': '24', 'แดง/ทอง': '25', 'เขียว / เหลือง': '26', 'ขาวมุก': '27', 'ขาว / เขียว / เหลือง': '28',
  'น้ำตาล / เทา': '29', 'บรอน': '30', 'เทา/น้ำเงิน/เหลือง': '31', 'ฟ้า/แดง': '32', 'ทอง / น้ำตาล': '33',
  'น้ำตาล / เขียว': '34', 'ขาว / น้ำเงิน': '35', 'บรอนทอง': '36', 'ขาว / น้ำตาล': '37', 'บรอนฟ้า': '38',
  'ครีม': '39', 'ขาว / เหลือง / ส้ม': '40', 'ดำ / น้ำตาล': '41', 'น้ำเงิน / น้ำตาล': '42',
  'ขาว / เทา': '43', 'เหลือง/ทอง': '44', 'ม่วง/เทา': '45', 'บรอน/ทอง': '46', 'ขาว/ดำ': '47',
  'ขาว/แดง': '48', 'แดง/ดำ': '49', 'ขาว/ส้ม/เขียว': '50', 'ดำ/ขาว/เหลือง': '51', 'ขาว/แดง/หลายสี': '52',
  'หลายสี': '53', 'UNDEFINE': '54', 'เหลือง/ดำ': '55',
  // alias ของข้อมูลเก่าในแอป/DB (ป้ายที่ EMCS ไม่มี)
  'บรอนซ์': '30',  'บรอนซ์ทอง': '36',  'อื่นๆ': '54',
};

// ความสัมพันธ์ (ddlDri_Relation_ID) — sync master EMCS 40 รหัส verbatim (2026-07-23; code 37 ซ้ำ label 27)
export const RELATION: Record<string, string> = {
  'สามี': '1', 'ภรรยา': '2', 'บุตร': '3', 'บิดา': '4', 'มารดา': '5', 'นายจ้าง': '6',
  'ลูกจ้าง': '7', 'ผู้เช่า': '8', 'พี่ชาย': '9', 'พี่สาว': '10', 'น้องชาย': '11',
  'น้องสาว': '12', 'เจ้าของรถ': '13', 'หลาน': '14', 'อา': '15', 'น้า': '16', 'ลุง': '17',
  'ป้า': '18', 'ญาติ': '19', 'เพื่อน': '20', 'แฟน': '21', 'พนักงาน': '22', 'พี่เขย': '23',
  'น้องเขย': '24', 'พี่สะใภ้': '25', 'น้องสะใภ้': '26', 'พนักงานผู้เช่า': '27', 'ลุงเขย': '28',
  'น้าเขย': '29', 'น้าสะใภ้': '30', 'อาเขย': '31', 'อาสะใภ้': '32', 'หุ้นส่วน': '33',
  'บุตรหุ้นส่วน': '34', 'เจ้าของบริษัท': '35', 'เพื่อนบุตรเจ้าของรถ': '36', 'บุตรเขย': '38',
  'หลานเขย': '39', 'บุตรสะใภ้': '40',
};

const TITLE: Record<string, string> = {
  'นาย': '1', 'นาง': '2', 'นางสาว': '3', 'ด.ช.': '4', 'ด.ญ.': '5', 'เด็กชาย': '4', 'เด็กหญิง': '5', 'คุณ': '6',
};

// ประเภทใบขับขี่ (ddlEmcs_License_Type) — sync master EMCS 21 รหัส (se เก็บชื่อ clean, พอร์ทัลใช้รหัส; +variant typo EMCS 19/16)
export const LICENSE_TYPE: Record<string, string> = {
  'ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ': '1', 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลตลอดชีพ': '2',
  'ใบขับขี่รถยนต์ส่วนบุคคลชั่วคราว': '4', 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลชั่วคราว': '6',
  'ใบขับขี่รถยนต์ส่วนบุคคล 5 ปีต่ออายุ': '7', 'ใบขับขี่รถยนต์สาธารณะ': '10', 'ใบขับขี่สากล': '15',
  'ใบขับขี่รถยนต์ส่วนบุคคลหนึ่งปีต่ออายุ': '16', 'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลหนึ่งปี': '17',
  'ใบขับขี่รถยนต์ส่วนบุคคล 7 ปีต่ออายุ': '18', 'ใบขับขี่รถยนต์ส่วนบุคคล': '19',
  'ใบขับขี่รถจักรยานยนต์ส่วนบุคคล': '20', 'ใบขับขี่ขนส่งชนิดที่1': '22',
  'ใบขับขี่ขนส่งชนิดที่2': '23', 'ใบขับขี่ขนส่งชนิดที่3': '24', 'ใบอนุญาติขับขี่ชนิดที่4': '25',
  'ไม่มีใบขับขี่': '26', 'ใบขับขี่รถยนต์สามล้อส่วนบุคคลสาธารณะ': '27',
  'ใบขับขี่รถยนต์สามล้อส่วนบุคคลชั่วคราว': '28', 'ใบอนุญาตเป็นผู้ขับรถทุกประเภท': '29',
  'อื่นๆ': '99', 'ใบขับขี่รถยนต์ส่วนบุคคคล': '19', 'ใบขับขี่รถยนต์ส่วนบุคคลหนี่งปีต่ออายุ': '16',
};

// ลักษณะความเสียหาย (ddlLoss_ID) — master EMCS 21 รหัส verbatim
const LOSS: Record<string, string> = {
  'เคลมแห้ง': '1', 'กระจกแตก': '2', 'กระจกอื่นๆ แตก': '3', 'ชนคู่กรณีเสียหาย': '4',
  'ถูกคู่กรณีชน': '5', 'ตกถนน': '6', 'พลิกคว่ำ': '7', 'รถประกันชนรถคู่กรณีไม่เอาความ': '8',
  'เฉี่ยวชนวัสดุ': '9', 'ถูกขูดขีดกลั่นแกล้ง': '10', 'ถูกลักอุปกรณ์ส่วนควบ': '11',
  'วัสดุหล่นใส่': '12', 'ยางระเบิด': '13', 'จอดไว้ถูกชนไม่ทราบคู่กรณี': '14',
  'หนูกัดสายไฟ': '15', 'รถหาย': '16', 'รถประกันไฟไหม้': '17', 'น้ำท่วมเสียหาย': '18',
  'ชนคนบาดเจ็บ': '19', 'ผู้โดยสารประกันตกรถ': '20', 'เสียหายทั้งหมด': '21',
};

/** ระดับความเสียหายรถประกัน (rdoHev_Car) — หนัก=1 / เบา=0 (ค่าจริงจากฟอร์ม EMCS) */
const hevCar = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (s === 'หนัก') return '1';
  if (s === 'เบา') return '0';
  return '';
};

// ฝ่ายประมาท (rdoAcc_Cause 1-7) — รับได้ทั้ง key สั้นของแอป และข้อความเต็ม
const FAULT: Record<string, string> = {
  'ฝ่ายผิด': '1', 'รถประกันฝ่ายผิด': '1', 'รถประกันเป็นฝ่ายผิด': '1', 'รถประกันเป็นฝ่ายผิด ': '1',
  'คู่กรณีผิด': '2', 'รถคู่กรณีเป็นฝ่ายผิด': '2',
  'ประมาทร่วม': '3',
  'รอสรุปผลคดี': '4', 'รอผลคดี': '4',
  'ฝ่ายถูกและผิด': '5', 'รถประกันเป็นฝ่ายถูกและผิด': '5', 'ถูกและผิด': '5',
  'ยกเลิกการเคลม': '6',
  'ไปถึงแล้วไม่พบ': '7',
};

// ลักษณะการเกิดเหตุ (ddlClm_Cause) → CAUSE_CODE 9xxx
// ครบทั้ง 79 ตัวเลือก สกัดจาก master จริงของ EMCS (21BR10AVD-6906-000098/กรอกรายละเอียดอุบัติเหตุ.html)
// เดิมมีแค่ 26 ตัว → 53 ป้ายที่เว็บ/แอปเลือกได้ export ออกไปเป็น CAUSE_CODE ว่าง (ข้อมูลหายเงียบ)
export const CAUSE: Record<string, string> = {
  'ชนท้ายคู่กรณี': '9101', 'ชนคนบาดเจ็บ/เสียชีวิต': '9102', 'ชนรถคู่กรณีมีการบาดเจ็บ/เสียชีวิต': '9103',
  'ชน/เสียหลักหมุน/พลิกคว่ำ/ตกข้างทางมีผู้บาดเจ็บ/เสียชีวิต': '9104', 'ชนทรัพย์สินคู่กรณี': '9105',
  'ชนคู่กรณีในช่องทางสวน': '9106', 'ชนคู่กรณีและถูกชน': '9107', 'ถอยชนคู่กรณี': '9108',
  'เฉี่ยว/เบียดคู่กรณี': '9109', 'เปิดประตูชนรถคู่กรณี': '9110',
  'ชนคู่กรณี/หรือถูกชนและไม่ทราบคู่กรณี': '9111', 'เลี้ยว/กลับรถ/เปลี่ยนช่องทางชนคู่กรณี': '9112',
  'ชนรถคู่กรณีไม่คุ้มครองรถประกัน': '9113', 'ชนวัสดุ/สิ่งของ เช่น เสา,กำแพง,ประตู ฯลฯ': '9114',
  'ชนฟุตบาท': '9115', 'ชนทรัพย์สินตนเอง': '9116', 'ชนสัตว์': '9117', 'ทรัพย์สินหล่นใส่คู่กรณี': '9118',
  'ผู้โดยสารตกรถ': '9119', 'เกี่ยวสายไฟฟ้า/โทรศัพท์/สายน้ำมัน': '9120', 'เสียหลักล้ม': '9121',
  'ฝากระโปรงหน้าเปิด': '9122', 'ยางระเบิด': '9123', 'ตกหลุม': '9124', 'ถูกน้ำมันเบรคราด': '9190',
  'ประมาทร่วม': '9191', 'ต่างฝ่ายต่างซ่อม': '9192', 'ช่วยเหลือมนุษยธรรม': '9193',
  'รอคู่กรณีติดต่อ': '9194', 'รอตรวจสอบใบขับขี่': '9195', 'แก๊สระเบิด': '9196', 'คู่กรณีชนท้าย': '9201',
  'คู่กรณีชนแล้วหลบหนี': '9202', 'คู่กรณีเฉี่ยวชน': '9203',
  'คู่กรณีเฉี่ยวชนบุคคลในรถประกันบาดเจ็บ/เสียชีวิต': '9204', 'ชนสัตว์และเรียกร้องเจ้าของ': '9205',
  'คู่กรณีเปิดประตูชนรถประกัน': '9206', 'คู่กรณีถอยชน': '9207',
  'คู่กรณีชน/ทรัพย์สินผู้เอาประกันเดียวกัน': '9208', 'คู่กรณีกลั่นแกล้ง': '9209',
  'ทรัพย์สินคู่กรณีหล่นใส่': '9210', 'เด็กปั๊มประมาทลืมปลดสายน้ำมัน': '9211',
  'ความเสียหายของรถประกันทีเกิดจากเหตุภายนอก': '9212',
  'รถหายโดยการฉ้อฉล ตามสัญญาประกันภัย(A.P.HONDA)': '9213', 'ไฟไหม้จากเหตุภายนอก': '9214',
  'ถูกก้อนหิน': '9301', 'ถูกขูดขีด/กลั่นแกล้ง': '9302', 'วัตถุหล่นใส่': '9303',
  'รถหายตามสัญญาเช่าซื้อ': '9304', 'รถหายโดยการโจรกรรม': '9305', 'ไฟไหม้โดยระบบของตัวรถยนต์': '9306',
  'ไฟไหม้ที่เกิดจากการชน': '9307', 'น้ำท่วม': '9308', 'ภัยธรรมชาติอื่น ๆ': '9309',
  'ลักทรัพย์อุปกรณ์/ส่วนควบ': '9310', 'ภัยอื่น ๆ': '9311', 'ภัยก่อการร้าย': '9312',
  'ไม่พบรถประกัน': '9390', 'ไม่พบรถคู่กรณี': '9391', 'ไม่พบรถประกัน/คู่กรณี': '9392', 'รอผลคดี': '9393',
  'รอตรวจสอบกรมธรรม์': '9394', 'รอเซ็นเคลม': '9395', 'รอรายงานอุบัติเหตุ': '9396',
  'รอรถประกันติดต่อ': '9397', 'เคลมซ้ำ': '9398', 'เปิดเคลมผิดพลาด': '9399', 'ฉ้อฉลจากการชน': '9401',
  'รถหายโดยการฉ้อฉล': '9402', 'ไฟไหม้โดยการฉ้อฉล': '9403', 'การยึดรถ ( A.P.HONDA )': '9404',
  'เสียหายขณะจอดอยู่': '9992', 'กระจกบังลมหน้าแตก': '9993', 'กระจกอื่นๆ แตก': '9994',
  'รถประกันชนรถคู่กรณีไม่เอาความ': '9995', 'สูญเสียการควบคุม': '9996', 'หนูกัดสายไฟ': '9997',
  'การเสียชีวิตอ้นเกิดจากสาเหตุอื่นๆ': '9998', 'การเสียชีวิตอันเกิดจาการใช้รถ': '9999',
  // alias เดิมของเรา (ไม่มีใน master) — เก็บไว้กันข้อมูลเก่าที่บันทึกป้ายนี้ไว้แล้ว export ไม่ออก
  'เฉี่ยวชนวัสดุ': '9114',
};

// ประเภทผู้บาดเจ็บใน XML — รหัสจริงจากไฟล์ export ของ EMCS (ยืนยันโดย parser se-autokey
// surv_xml.py:90 จากเคลมจริง): DV = ผู้ขับขี่รถประกัน, ON = คู่กรณี/บุคคลอื่นทั้งหมด
// (ระวัง: dropdown บนฟอร์ม ddlPerson_Type ใช้รหัส 01-05 คนละชุดกับ XML — ห้ามสลับ)
// ยืนยันจากฟอร์ม EMCS จริง (ddlPerson_Type, เคลม 21BR10AVD-6906-000098 2026-07-22):
// DV→01 ผู้ขับขี่-รถประกัน · PV→03 ผู้โดยสาร-รถประกัน · ON→05 บุคคลภายนอกรถ
// (คู่กรณี = บุคคลภายนอกฝั่งรถประกัน → ON) — เดิม 'ผู้โดยสารรถประกัน'→ON ผิด แก้เป็น PV
// ⚠️ XML มีรหัสแค่ 3 ตัว (DV/PV/ON) ทั้งที่ ddlPerson_Type ของ EMCS มี 5 (01-05)
// ฝั่งคู่กรณี (02/04) จึงถูกยุบเป็น ON ในเส้นทาง XML — ไม่ได้เดารหัสใหม่เพราะยังไม่มี
// ตัวอย่างจริงยืนยันว่า EMCS importer รับรหัสอะไรสำหรับ 02/04
// เส้นทางหลัก (se-autokey) ไม่เสียข้อมูล: main.py ส่ง "ป้ายไทย" ของแอปไปตรง ๆ แล้ว
// emcs.PERSON_TYPE_LABEL แปลงเป็น 02/04 ได้ครบ (งานจริงไอโออิใช้ 02)
const PERSON_TYPE: Record<string, string> = {
  // label EMCS master ddlPerson_Type ครบ 5 ตัว — sync 2026-07-27
  'ผู้ขับขี่ - รถประกัน': 'DV', 'ผู้โดยสาร - รถประกัน': 'PV', 'บุคคลภายนอกรถ': 'ON',
  'ผู้ขับขี่ - รถคู่กรณี': 'ON', 'ผู้โดยสาร - รถคู่กรณี': 'ON',
  // เดิม (เผื่อข้อมูล/OCR)
  'ผู้ขับขี่รถประกัน': 'DV', 'ผู้โดยสารรถประกัน': 'PV',
  'ผู้ขับขี่คู่กรณี': 'ON', 'ผู้โดยสารคู่กรณี': 'ON', 'บุคคลภายนอก': 'ON',
};

// ระดับการบาดเจ็บ (ddlWounded_Type) — ✅ ยืนยันจากฟอร์ม EMCS จริง (2026-07-22):
// 01 บาดเจ็บเล็กน้อย · 02 ปานกลาง · 03 สาหัส · 04 ทุพพลภาพ · 05 เสียชีวิตก่อนรักษา · 06 หลังรักษา — ตรง 1:1
const WOUND: Record<string, string> = {
  // label EMCS master (ddlWounded_Type 01-06) — sync 2026-07-23
  'บาดเจ็บ - เล็กน้อย': '01', 'บาดเจ็บ - ปานกลาง': '02', 'บาดเจ็บ - สาหัส': '03',
  'ทุพพลภาพ': '04', 'เสียชีวิตก่อนรักษา': '05', 'เสียชีวิตหลังรักษา': '06',
  // เดิม (short, เผื่อข้อมูล/OCR)
  'เล็กน้อย': '01', 'ปานกลาง': '02', 'สาหัส': '03',
};

// ยี่ห้อรถ (ไทย → code พอร์ทัล, ใช้ต่อกับ CTYPECODE เป็น CMFG เช่น T+ISUZU=TISUZU)
const BRAND: Record<string, string> = {
  'อีซูซุ': 'ISUZU', 'โตโยต้า': 'TOYOTA', 'ฮอนด้า': 'HONDA', 'นิสสัน': 'NISSAN', 'มิตซูบิชิ': 'MITSUBISHI',
  'มาสด้า': 'MAZDA', 'ฟอร์ด': 'FORD', 'เชฟโรเลต': 'CHEVROLET', 'ซูซูกิ': 'SUZUKI', 'เมอร์เซเดส-เบนซ์': 'BENZ',
  'เบนซ์': 'BENZ', 'บีเอ็มดับเบิลยู': 'BMW', 'เกีย': 'KIA', 'ฮุนได': 'HYUNDAI', 'เอ็มจี': 'MG', 'MG': 'MG',
};

// ประเภทรถ (CTYPECODE / prefix ของ CMFG) — แอปเก็บเป็น code อยู่แล้ว (A/E/M/O/T/V/W) แต่คู่กรณี
// (opposing_parties) อาจเก็บเป็นข้อความไทย → map ให้เป็น code เดียวกัน (ไม่งั้น CMFG เพี้ยน เช่น "เก๋งTOYOTA")
const CAR_TYPE: Record<string, string> = {
  'เก๋ง': 'A', 'เก๋งเอเชีย': 'A', 'เอเชีย': 'A', 'เก๋งยุโรป': 'E', 'ยุโรป': 'E',
  'รถจักรยานยนต์': 'M', 'จักรยานยนต์': 'M', 'มอเตอร์ไซค์': 'M',
  'รถอื่นๆ': 'O', 'อื่นๆ': 'O', 'กระบะ': 'T', 'รถกระบะ': 'T',
  'รถตู้': 'V', 'ตู้': 'V', 'รถบรรทุก': 'W', 'บรรทุก': 'W',
};
const carTypeCode = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^[A-Za-z]$/.test(s)) return s.toUpperCase();   // เป็น code อยู่แล้ว
  return CAR_TYPE[s] || '';
};

// เพศ → รหัส 1 ตัว (EMCS XML importer อ่าน DRI_GENDER/GENDER ตรงๆ + บังคับขนาด 1 — Thai ยาว 3
// ตัวจะถูก reject "ข้อมูลนำเข้ามีขนาดเกิน"). คู่กรณี/ผู้บาดเจ็บเก็บค่าไทย 'ชาย'/'หญิง';
// รถประกันเก็บ M/F อยู่แล้ว → normalize เป็น M/F (ตรงกับ insured ที่ EMCS รับ 2026-07-23)
const genderCode = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (s === 'ชาย') return 'M';
  if (s === 'หญิง') return 'F';
  return s.toUpperCase();   // M/F/W ผ่านตรง
};

// ── helpers ──
const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// element: ค่าว่าง → " " (พอร์ทัลคาดว่า element มีอยู่เสมอ เหมือนตัวอย่าง)
const el = (tag: string, v: unknown): string => {
  const s = String(v ?? '').trim();
  return `<${tag}>${s === '' ? ' ' : esc(s)}</${tag}>`;
};

const lookup = (table: Record<string, string>, v: unknown): string => {
  const k = String(v ?? '').trim();
  return k && table[k] ? table[k] : '';
};

// การติดตามงาน (rdoFlu_Type) — value จริงของ EMCS: N/W/Y
const FLU_TYPE: Record<string, string> = {
  'ไม่มีการนัดหมาย': 'N', 'รอการนัดหมาย': 'W', 'มีการนัดหมาย': 'Y',
};

// ปีจดทะเบียน: แอป/DB เก็บ พ.ศ. แต่ EMCS รับเฉพาะ ค.ศ. (dropdown 1900-2026)
const yearAD = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!/^\d{4}$/.test(s)) return s;
  const y = Number(s);
  return y >= 2400 ? String(y - 543) : s;
};

// เบอร์โทร: EMCS maxlength=10 และรับเฉพาะตัวเลข ('081-234-5678' = 12 ตัว ถูกตัดท้ายเงียบ ๆ)
const tel10 = (v: unknown): string => String(v ?? '').replace(/\D/g, '').slice(0, 10);
// ช่องโทรศัพท์ของ "ทรัพย์สิน" บน EMCS รับได้ 50 ตัว (maxlength=50) — ตัดเหลือ 10 ทำให้
// เบอร์ที่มีรหัสพื้นที่/ต่อภายใน/หลายเบอร์ ถูกตัดกลางคัน กลายเป็นเบอร์ผิดแบบเงียบ ๆ
const tel50 = (v: unknown): string => String(v ?? '').trim().slice(0, 50);

// จำนวนเงิน: EMCS num() ใช้ regex ^\d+$|^\d+\.\d+$ ไม่ผ่าน = ล้างช่องทิ้ง (maxlength=10)
const money = (v: unknown): string => {
  let s = String(v ?? '').replace(/[,\s]/g, '');
  const i = s.indexOf('.');
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
  s = s.replace(/\.$/, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return '';
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.length > 10 ? '' : s;
};

const provinceCode = (v: unknown) => lookup(PROVINCE, v);

// รหัสอำเภอ/เขต 4 หลักของพอร์ทัล (cascade รายจังหวัด) — ชื่อใน dropdown แอปมาจาก source เดียว
// กับพอร์ทัล → เคสปกติ match แบบ exact; fallback normalize ไว้รับข้อมูลเก่า/ที่ OCR พิมพ์เอง
const districtId = (provinceRaw: unknown, districtRaw: unknown): string => {
  const prov = provinceCode(provinceRaw);
  const table = prov ? EMCS_DISTRICTS[prov] : undefined;
  const raw = String(districtRaw ?? '').trim();
  if (!table || !raw) return '';
  // export จริงของ EMCS ใช้เลขไม่มีศูนย์นำ ("0407" ใน dropdown → "407" ในไฟล์) — ทำให้ตรงกัน
  const fmt = (code: string) => String(parseInt(code, 10));
  if (table[raw]) return fmt(table[raw]);
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/^กิ่งอำเภอ|^อำเภอ|^เขต/, '');
  const n = norm(raw);
  for (const [name, code] of Object.entries(table)) {
    if (norm(name) === n) return fmt(code);
  }
  // "เมือง<ชื่อจังหวัด>" (ชุดข้อมูลราชการ/OCR) → พอร์ทัลใช้ชื่อสั้น "อำเภอเมือง" ไม่มีจังหวัดต่อท้าย
  const provName = String(provinceRaw ?? '').replace(/\s+|ฯ/g, '');
  if (n === `เมือง${provName}`) {
    for (const [name, code] of Object.entries(table)) {
      if (norm(name) === 'เมือง') return fmt(code);
    }
  }
  return ''; // หาไม่เจอ = ปล่อยว่าง (เหมือนเดิม) ดีกว่าใส่รหัสผิด
};

// se date "dd/mm/yyyy(พ.ศ.)" หรือ "dd/mm/yyyy|HH:mm" หรือแยก date+time → {d,m,yBE,hh,mi}
function parseSe(dateStr: unknown, timeStr?: unknown): { d: string; m: string; yBE: number; hh: string; mi: string } | null {
  let ds = String(dateStr ?? '').trim();
  let ts = String(timeStr ?? '').trim();
  if (!ds) return null;
  if (ds.includes('|')) { const p = ds.split('|'); ds = p[0].trim(); if (!ts && p[1]) ts = p[1].trim(); }
  const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(ds);
  if (!dm) return null;
  let yBE = parseInt(dm[3], 10);
  if (yBE < 100) yBE += 2500;          // พ.ศ. ย่อ
  else if (yBE < 2400) yBE += 543;     // เผื่อ input เป็น ค.ศ. → ทำให้เป็น พ.ศ. ฐานเดียว
  const tm = /^(\d{1,2}):(\d{2})/.exec(ts);
  return { d: dm[1].padStart(2, '0'), m: dm[2].padStart(2, '0'), yBE, hh: tm ? tm[1].padStart(2, '0') : '00', mi: tm ? tm[2] : '00' };
}
// วันที่ใน XML ทุก field : แปลงเป็น ค.ศ. (ลบ 543) — ยืนยันจาก export จริง (ดู header)
const toXmlCE = (dateStr: unknown, timeStr?: unknown): string => {
  const p = parseSe(dateStr, timeStr); if (!p) return '';
  return `${p.yBE - 543}-${p.m}-${p.d} ${p.hh}:${p.mi}:00`;
};

// "ชั้น 1" | "1" | "ประเภท 1" → "01"
const policyTypeCode = (v: unknown): string => {
  const m = /(\d+\+?)/.exec(String(v ?? ''));
  if (!m) return '';
  return m[1].includes('+') ? m[1] : m[1].padStart(2, '0');
};

type Row = Record<string, any>;

// รถ 1 คัน (รถประกัน type=0 หรือ คู่กรณี) — insured อ่านจาก report, คู่กรณีอ่านจาก opposing_parties element
function buildCar(c: Row, type: number, insured: boolean): string {
  const ctype = carTypeCode(c.car_type);   // code A/E/M/O/T/V/W (คู่กรณีอาจเก็บเป็นไทย → map)
  const brandRaw = insured ? c.car_brand : c.car_brand;
  const brandCode = lookup(BRAND, brandRaw) || String(brandRaw ?? '').trim();
  const cmfg = ctype && brandCode ? `${ctype}${brandCode}` : brandCode;
  const driName = insured
    ? (String(c.driver_name ?? '').trim() || `${c.driver_first_name ?? ''} ${c.driver_last_name ?? ''}`.trim())
    : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();

  const g = (k: string, ok: string) => (insured ? c[k] : c[ok]);

  return '<TXN_SURV_CAR>' +
    el('TYPE', type) +
    el('OPO_NAME', insured ? '' : c.owner_name) +
    el('OPO_ADDRESS', insured ? '' : c.owner_address) +
    el('OPO_TYPE', insured ? 'รถประกัน' : 'รถคู่กรณี') +
    el('CAR_REGNO', insured ? c.license_plate : c.plate) +
    el('CAR_PROVINCE', provinceCode(insured ? c.car_province : c.province)) +
    // เลขตัวถังว่าง → "-" (EMCS ต้องการค่า ไม่รับ Null/ช่องว่าง; คู่กรณีมักไม่ทราบเลขตัวถัง)
    el('CHASSISNO', String((insured ? c.chassis_no : c.vin) ?? '').trim() || '-') +
    el('ENGINENO', insured ? c.engine_no : '') +
    el('KM_NO', c.mileage) +
    el('CMFG', cmfg) +
    el('CMODEL', c.car_model) +
    el('CAR_REGNO_YEAR', yearAD(insured ? c.car_reg_year : c.reg_year)) +
    el('CCL_ID', lookup(COLOR, c.car_color)) +
    el('DRI_TITLE_ID', lookup(TITLE, insured ? c.driver_title : c.title)) +
    el('DRI_NAME', driName) +
    el('DRI_AGE', insured ? c.driver_age : c.age) +
    el('DRI_RELATION', lookup(RELATION, insured ? c.driver_relation : c.relation)) +
    el('DRI_ADDRESS', insured ? c.driver_address : c.address) +
    // คู่กรณีไม่มีช่องอำเภอในแอป (มีแต่ที่อยู่) → ปล่อยว่างเฉพาะคู่กรณี
    // คู่กรณีมีช่องอำเภอแล้ว (opposing_parties[].district cascade จากจังหวัด) → ddlDri_DistrictID ของคู่กรณี
    // ภูมิลำเนาผู้ขับขี่ (จากบัตรประชาชน/ทะเบียนบ้าน) — คนละช่องกับ CAR_PROVINCE ที่เป็น
    // จังหวัดป้ายทะเบียน; EMCS แยก 2 dropdown จริง (ddlCar_Province vs ddlDri_ProvinceID)
    // คู่กรณี: home_province เป็นช่องใหม่ — เคสเก่าที่ยังไม่มี fallback ไป province เดิม
    el('DRI_DISTRICTID', insured
      ? districtId(c.driver_province, c.driver_district)
      : districtId(c.home_province || c.province, c.district)) +
    el('DRI_PROVINCEID', provinceCode(insured ? c.driver_province : (c.home_province || c.province))) +
    el('DRI_TELNO', insured ? c.driver_phone : c.phone) +
    el('DRI_CARDID', insured ? c.driver_id_card : c.cid) +
    el('DRI_DRVID', insured ? c.driver_license_no : c.license_no) +
    el('DRI_DRVTYPE', lookup(LICENSE_TYPE, insured ? c.driver_license_type : c.license_type)) +
    el('DRI_DRVPLACE', insured ? c.driver_license_place : c.license_place) +
    el('DRI_DRVDATE_START', toXmlCE(insured ? c.driver_license_start : c.license_start)) +
    el('DRI_DRVDATE_END', toXmlCE(insured ? c.driver_license_end : c.license_end)) +
    el('DRI_ORDER', '') +
    el('DRI_BIRTHDAY', toXmlCE(insured ? c.driver_birthdate : c.birthdate)) +
    el('DRI_GENDER', genderCode(g('driver_gender', 'gender'))) +
    // insurer เก็บเป็นข้อความไทย — "ไม่มีบริษัทประกันภัย" ต้องนับว่า "ไม่มีประกัน" ไม่ใช่ truthy = 1
    el('HAVE_INSURANCE', insured ? '' : (c.insurer && c.insurer !== 'ไม่มีบริษัทประกันภัย' ? '1' : '')) +
    el('POLICYNO', insured ? '' : c.policy_no) +
    el('CLAIMNO', insured ? '' : c.claim_no) +
    el('POLICY_TYPE', insured ? '' : policyTypeCode(c.policy_type)) +
    el('CTYPECODE', ctype) +
    el('MODELNO', insured ? c.model_no : '') +
    el('COST_DAMAGE', money(c.estimated_cost)) +
    el('REPAIRER_NAME', '') +
    el('REPAIRER_TYPE', '') +
    el('DAMAGE_LIST', '') +
    el('HAS_KFK', insured ? '' : (c.kfk === true ? '1' : '')) +
    '</TXN_SURV_CAR>';
}

// ทรัพย์สินเสียหาย 1 ชิ้น (จาก damaged_property JSONB)
// ชื่อ tag + ลำดับ ยืนยันจาก gold reference (ISURVEY→EMCS XML จริง 21BR10AVD-6906-000831,
// 2026-07-23): 8/8 tag ตรง; gold เรียง ASSET_DAMAGE_CAUSE ก่อน ASSET_DAMAGE
function buildAsset(a: Row, seq: number): string {
  return '<TXN_SURV_ASSET>' +
    el('ASSET_SEQ', seq) +
    el('ASSET_DESC', a.item) +               // ชื่อทรัพย์สิน (เช่น เสาไฟฟ้า)
    el('ASSET_DAMAGE_CAUSE', a.cause) +      // สาเหตุ (ลำดับตรง gold: cause ก่อน damage)
    el('ASSET_DAMAGE', a.detail) +           // รายละเอียดความเสียหาย
    el('COST_DAMAGE', money(a.estimated_cost)) +
    el('OWNER', a.owner_name) +
    el('ADDRESS', a.owner_address) +
    el('TEL_NO', tel50(a.owner_phone)) +
    '</TXN_SURV_ASSET>';
}

// ผู้บาดเจ็บ 1 คน (จาก injured_persons JSONB)
// tag จริงคือ TXN_SURV_INJ + ชื่อ field สั้น (NAME/AGE/CITIZEN_ID/...) — ยืนยันจาก parser
// ของ se-autokey (surv_xml.py:91 อ้างเคลมจริง 2026013144960); ชุดเดิม TXN_SURV_INJURE/INJ_*
// เป็น inferred ที่ผิด → importer จะมองไม่เห็นผู้บาดเจ็บทั้ง section
// ชื่อ tag + ลำดับ ยืนยันจาก gold reference = INSERT_SURV_REPORT_XML จริงที่ ISURVEY สร้าง
// import เข้า EMCS มาหลายปี (2026-07-23, 21BR10AVD-6907-001011/SURV_REPORT_00000945329.txt)
// → ตรง EMCS canonical 20/20 tag. DRI_RELATION_ID/WORK_PLACE/POSITION/INCOME/FROM_DATE/TO_DATE
// = สคีมา EMCS จริง (เดิมเดา TREAT_FROM/TREAT_TO/RELATION ผิด). bot fill_injuries กรอกฟอร์มเป็น
// backup ผ่าน id จาก ผู้บาดเจ็บ.html; EMCS importer น่าจะเติมเองจาก XML ที่ตรงสคีมาแล้ว
function buildInjure(p: Row, seq: number): string {
  return '<TXN_SURV_INJ>' +
    el('INJ_SEQ', seq) +
    el('NAME', p.name) +
    el('AGE', p.age) +
    el('CITIZEN_ID', p.cid) +
    el('DRI_RELATION_ID', lookup(RELATION, p.relation)) + // ความสัมพันธ์ (รหัส 1-35)
    el('JOB', p.occupation) +
    el('CAR_REGNO', p.car_reg) +
    el('ADDRESS', p.address) +
    el('TEL_NO', tel10(p.phone)) +
    el('WORK_PLACE', p.work_place) +
    el('POSITION', p.position) +
    el('INCOME', money(p.income)) +                  // ประกอบค่าขาดรายได้ (EMCS num() ไม่รับ comma)
    el('HOS_NAME', p.hospital) +
    el('FROM_DATE', toXmlCE(p.treat_from)) +         // ช่วงวันรักษา (จาก)
    el('TO_DATE', toXmlCE(p.treat_to)) +             // ช่วงวันรักษา (ถึง)
    el('COST', money(p.treat_cost)) +                // ค่ารักษา (ต้องผ่าน money ไม่งั้น EMCS ล้างทิ้ง)
    el('INJURE', p.symptom) +           // อาการบาดเจ็บ
    el('GENDER', genderCode(p.gender)) +
    el('PERSON_TYPE', lookup(PERSON_TYPE, p.person_type)) + // DV=ผู้ขับรถประกัน, ON=บุคคลอื่น
    el('WOUNDED_TYPE', lookup(WOUND, p.wound_level)) +
    '</TXN_SURV_INJ>';
}

const parseJsonArr = (v: unknown): Row[] =>
  Array.isArray(v) ? v
    : (typeof v === 'string' && v.trim().startsWith('[') ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);

/**
 * สร้าง INSERT_SURV_REPORT_XML จาก survey_reports row (+ opposing_parties/damaged_property/injured_persons ที่ parse แล้ว)
 */
// "มี/ไม่มีการตรวจแอลกอฮอล์" → '1' มีการตรวจ / '0' ไม่มี / '' ไม่มีข้อมูล
// (แอปเก็บเป็นข้อความอิสระช่องเดียว ต้องตีความ — ตรรกะเดียวกับ se-autokey _fill_police_and_alcohol)
const alcChk = (test: unknown, result: unknown): string => {
  const t = String(test ?? '').trim();
  const rs = String(result ?? '').trim();
  if (!t && !rs) return '';
  return ['ไม่ได้ตรวจ', 'ไม่ตรวจ', 'ไม่มีการตรวจ', 'ไม่มี'].some((k) => t.includes(k)) ? '0' : '1';
};

/**
 * ช่อง "ชื่อคน" ของ EMCS ที่มีตัวกรองอักขระติดอยู่ — ถ้าค่ามีอักขระนอกลิสต์
 * **EMCS จะล้างค่าทั้งช่องทิ้งเงียบ ๆ** ตอนคนคลิกเข้า-ออกช่องนั้น (ไม่ใช่แค่ปฏิเสธตัวอักษร)
 *
 *   function noTyping_paste(strInput) {            // TextboxValidate.js ของ EMCS
 *       var format = /([ a-zA-Z0-9ก-์.-])/;
 *       ... if (!format.test(character[i])) { alert(...); strInput.value = ""; }
 *   }
 *
 * import ผ่าน XML ไม่โดนกรอง (JS ไม่ทำงาน) ค่าจึงเข้าไปได้ — แต่พอหัวหน้าเปิดมาตรวจ
 * แล้วคลิกโดนช่องนั้น ชื่อหายทั้งช่องโดยไม่มีใครรู้ตัว จึงต้องเตือนตั้งแต่ตอน export
 *
 * รายชื่อ id ที่มีตัวกรองนี้ ตรวจจากหน้า EMCS จริงทั้ง 4 หน้า (2026-08-02):
 *   หน้าหลัก   txtAcc_Call · txtAcc_Surv · txtPolice_Name · txtDri_Name(01)/LastName01
 *              + ของคู่กรณีทุกแถว txtOpo_Name · txtDri_Name(01)/LastName01
 *   ผู้บาดเจ็บ  txtInj_Name(01)/LastName01
 *   ทรัพย์สิน   txtOwner
 * (ผู้เอาประกัน txtAssured_Name **ไม่มี** ตัวกรองนี้ — ตรวจแล้ว ไม่ต้องเตือน)
 */
const EMCS_NAME_OK = /^[ a-zA-Z0-9ก-์.-]*$/;

export type EmcsNameWarning = { tag: string; label: string; value: string; bad: string };

const nameWarn = (out: EmcsNameWarning[], tag: string, label: string, v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s || EMCS_NAME_OK.test(s)) return;
  const bad = [...new Set([...s].filter((c) => !EMCS_NAME_OK.test(c)))].join(' ');
  out.push({ tag, label, value: s, bad });
};

/** ตรวจก่อนส่ง: ชื่อคนช่องไหนมีอักขระที่ EMCS จะล้างทิ้ง (ว่าง = ไม่มีปัญหา) */
export function emcsNameWarnings(r: Row): EmcsNameWarning[] {
  const out: EmcsNameWarning[] = [];
  nameWarn(out, 'ACC_CALL', 'ผู้แจ้ง', r.acc_reporter);
  nameWarn(out, 'ACC_SURV', 'ผู้สำรวจภัย', r.acc_surveyor);
  nameWarn(out, 'POLICE_NAME', 'ชื่อพนักงานสอบสวน', r.acc_police_name);
  nameWarn(out, 'DRI_NAME', 'ชื่อผู้ขับขี่รถประกัน',
    String(r.driver_name ?? '').trim() || `${r.driver_first_name ?? ''} ${r.driver_last_name ?? ''}`.trim());
  parseJsonArr(r.opposing_parties).forEach((o, i) => {
    nameWarn(out, 'OPO_NAME', `เจ้าของรถคู่กรณีคันที่ ${i + 1}`, o.owner_name);
    nameWarn(out, 'DRI_NAME', `ผู้ขับขี่รถคู่กรณีคันที่ ${i + 1}`,
      `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim());
  });
  parseJsonArr(r.injured_persons).forEach((p, i) =>
    nameWarn(out, 'NAME', `ชื่อผู้บาดเจ็บคนที่ ${i + 1}`, p.name));
  parseJsonArr(r.damaged_property).forEach((a, i) =>
    nameWarn(out, 'OWNER', `เจ้าของทรัพย์สินรายการที่ ${i + 1}`, a.owner_name));
  return out;
}

/**
 * ช่องที่ EMCS บังคับ แต่ XML ที่เราจะส่งยังว่าง — ให้หัวหน้าเห็นตอนตรวจงาน
 *
 * ทำไมต้องตรวจตอนนี้ (ไม่ใช่ตอนอัปโหลดไฟล์): ตอนตรวจงาน **เรารู้บริษัทประกันแล้ว**
 * จึงเช็คช่องบังคับ "เฉพาะบางบริษัท" ได้ด้วย ซึ่งตอนอ่านไฟล์ยังทำไม่ได้
 *
 * วิธีเช็ค: สร้าง XML จริงแล้วอ่านค่าจาก tag — ไม่ทำ mapping ซ้ำ อะไรที่ exporter
 * จะส่งจริงคือสิ่งที่ตรวจ (ถ้า exporter เปลี่ยน การตรวจก็เปลี่ยนตาม ไม่หลุดจากกัน)
 *
 * ลิสต์ช่องบังคับมาจาก se-autokey/tools/emcs_spec.py --emit-ts (อ่านฟังก์ชัน vlid*
 * ในหน้า EMCS จริง) — ไม่ใช่รายการที่เขียนมือ
 */
export function emcsMissingRequired(r: Row): EmcsRequiredField[] {
  const xml = generateSurveyXml(r);
  const blocks = (name: string): string[] =>
    [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);
  const report = blocks('TXN_SURV_REPORT')[0] ?? '';
  // รถประกัน = บล็อกแรก (TYPE=0) — คู่กรณีมีกติกาคนละชุด ยังไม่ตรวจในรอบนี้
  const car = blocks('TXN_SURV_CAR')[0] ?? '';
  const val = (block: string, tag: string): string => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : '';
  };

  const code = EMCS_INSURER_CODE[String(r.insurance_company ?? '').trim()] ?? '';
  const list = [...EMCS_REQUIRED, ...(code ? EMCS_REQUIRED_BY_INSURER[code] ?? [] : [])];
  const seen = new Set<string>();
  return list.filter((f) => {
    if (seen.has(f.tag)) return false;
    seen.add(f.tag);
    return !val(f.block === 'CAR' ? car : report, f.tag);
  });
}

export function generateSurveyXml(r: Row): string {
  const opponents = parseJsonArr(r.opposing_parties);
  const assets = parseJsonArr(r.damaged_property);
  const injured = parseJsonArr(r.injured_persons);

  const report = '<TXN_SURV_REPORT>' +
    el('SURV_JOBNO', r.survey_job_no) +
    el('REF_CLAIM_NO', r.claim_no) +
    el('INSURERBRID', r.insurance_branch) +
    el('SURVEYID', SURVEY_ID) +
    el('SURVEYBRID', SURVEY_BR_ID) +
    el('ACC_CLAIMREF_NO', r.claim_ref_no) +
    el('ACC_POLICY_NO', r.policy_no) +
    el('ASSURED_NAME', r.assured_name) +
    el('POLICY_TYPE', policyTypeCode(r.policy_type)) +
    el('POLICY_START', toXmlCE(r.policy_start)) +
    el('POLICY_END', toXmlCE(r.policy_end)) +
    el('ACC_DATE', toXmlCE(r.acc_date, r.acc_time)) +
    el('ACC_PLACE', r.acc_place) +
    el('ACC_DISTRICTID', districtId(r.acc_province, r.acc_district)) +
    el('ACC_PROVINCEID', provinceCode(r.acc_province)) +
    el('ACC_DETAIL', r.acc_detail) +
    el('ACC_CAUSE', lookup(FAULT, r.acc_fault)) +
    el('ACC_CALL', r.acc_reporter) +
    el('ACC_SURV', r.acc_surveyor) +
    // โทรศัพท์ผู้สำรวจภัย — EMCS บังคับ (txtAcc_Tel ใน vlidSurvey) แต่ XML ไม่เคยมี tag นี้เลย
    el('ACC_TEL', tel10(r.acc_surveyor_phone)) +
    el('ACC_CALL_DATE', toXmlCE(r.acc_customer_report_date)) +
    el('ACC_REACH', toXmlCE(r.acc_survey_arrive_date)) +
    el('ACC_FINISH', toXmlCE(r.acc_survey_complete_date)) +
    // การเรียกร้องค่าเสียหายจากคู่กรณี — แอปเก็บครบ (ติ๊ก 5 ข้อ + ยอดเงิน 2 ช่อง)
    // แต่เดิม hardcode ว่างทั้งชุด → เส้นทาง XML ทิ้งข้อมูลนี้ทุกเคส
    // (เส้นทางหลักผ่าน se-autokey กรอก chkOpo_Result บนหน้าให้แล้วตั้งแต่ 9719228)
    el('OPO_RESULT', r.acc_claim_opponent) +
    el('OPO_PAY', money(r.acc_claim_amount) || '0') +
    el('OPO_RECOVERY_AMOUNT', money(r.acc_claim_total_amount)) +
    el('OPO_AMOUNT_TYPE', '') +
    el('POLICE_NAME', r.acc_police_name) +
    el('POLICE_STATION', r.acc_police_station) +
    el('POLICE_COMMENT', r.acc_police_comment) +
    el('POLICE_DATE', toXmlCE(r.acc_police_date)) +
    el('BOOK_NUMBER', r.acc_police_book_no) +
    el('PRB_NUMBER', r.prb_number) +
    el('SURV_COMMENT', r.surveyor_comment || r.notes) +
    el('ACC_CAUSE_NO', r.acc_fault_opponent_no) +
    // ALC_CHK = "มี/ไม่มีการตรวจแอลกอฮอล์" (EMCS เป็น radio 2 ตัว rdoAlc_Chk_0/_1)
    // ✅ แอปมือถือใช้ dropdown 2 ตัวเลือกที่ป้ายตรงกับ EMCS แล้ว
    //    ('ไม่มีการตรวจแอลกอฮอล์' / 'มีการตรวจแอลกอฮอล์') + ช่อง "ระบุผล" ที่โผล่เมื่อเลือก "มี"
    //    ป้ายชุดนี้ตรงกันทั้ง 5 จุด: มือถือ · เว็บ (radio) · importer · exporter · บอท
    // การตีความจากข้อความด้านล่างจึงเป็น **fallback ของเคสเก่า/ISURVEY** ที่เป็น free text
    // (คอมเมนต์เดิมเขียนว่า "แอปมีกล่องข้อความเดียว" — ล้าสมัยแล้ว เคยทำให้เข้าใจผิดว่าต้องไปแก้แอป)
    el('ALC_CHK', alcChk(r.acc_alcohol_test, r.acc_alcohol_result)) +
    el('ALC_RESULT', r.acc_alcohol_result || r.acc_alcohol_test) +
    el('FLU_TYPE', lookup(FLU_TYPE, r.acc_followup)) + el('FLU_NO', r.acc_followup_count) +
    el('FLU_DETAIL', r.acc_followup_detail) + el('FLU_DATE', toXmlCE(r.acc_followup_date)) +
    // ระดับความเสียหายรถประกัน — EMCS บังคับ (rdoHev_Car ใน vlidSurvey) เดิม hardcode ว่าง
    // ทั้งที่แอปบังคับให้เลือก หนัก/เบา อยู่แล้ว → ค่าที่ช่างเลือกไม่เคยไปถึง EMCS
    el('HEV_CAR', hevCar(r.damage_level)) +
    el('ACC_CRASH_REAR', '') +
    el('HAS_PRB', r.prb_number ? '1' : '') +
    el('RISK_CODE', r.risk_code) +
    el('LOST_CAR', r.car_lost === true ? '1' : '') +
    el('INS_CALLING_SURV_DATE', toXmlCE(r.acc_insurance_notify_date, r.acc_insurance_notify_time)) +
    el('SURV_CLAIM_TYPE', String(r.claim_type ?? '').trim().toUpperCase()) +
    el('DRIVER_BY_POLICY', r.driver_by_policy) +
    el('DEDUCTIBLE', r.deductible) +
    el('CAUSE_CODE', lookup(CAUSE, r.acc_cause)) +
    // ลักษณะความเสียหาย — EMCS บังคับ (ddlLoss_ID ใน vlidSurvey) เดิม hardcode ว่างเช่นกัน
    el('LOSS_ID', lookup(LOSS, r.acc_damage_type)) +
    '</TXN_SURV_REPORT>';

  // รถประกัน TYPE=0; คู่กรณี TYPE=20,21,… (EMCS: 0=รถประกัน 20=คู่กรณี — เดิมส่ง 1,2,… ทำให้ EMCS
  // อ่านคู่กรณีเป็น "รถประกันคันที่ N" แล้วบังคับเลขตัวถัง/ฟิลด์ของรถประกัน → import ไม่ผ่าน)
  const cars = buildCar(r, 0, true) + opponents.map((o, i) => buildCar(o, 20 + i, false)).join('');
  const assetBlocks = assets.map((a, i) => buildAsset(a, i + 1)).join('');   // ทรัพย์สินเสียหาย (0..n)
  const injureBlocks = injured.map((p, i) => buildInjure(p, i + 1)).join(''); // ผู้บาดเจ็บ (0..n)

  // ── ตารางค่าใช้จ่าย: มียอดเฉพาะงานที่นำเข้าจาก ISURVEY ─────────────────────────
  //
  //  งานจากแอปมือถือ  — **แอปไม่มีหน้า "ค่าใช้จ่าย" เลย** (แท็บขึ้นว่า "อยู่นอกขอบเขตตอนนี้")
  //                     จึงไม่มียอดให้ส่งตั้งแต่ต้น หัวหน้าเป็นคนกรอกที่หน้าค่าใช้จ่ายของ EMCS
  //                     เองแล้วกดส่งงาน (บอทกรอกหน้านั้นแค่ "เลขที่ใบแจ้งหนี้ + วันที่")
  //  งานนำเข้า ISURVEY — ไฟล์ระบบเก่ามียอดที่ "หัวหน้ากรอกไว้แล้ว" ติดมาด้วย → ต้องส่งต่อ
  //                     ไม่งั้นข้อมูลหายตอนย้ายระบบ
  //
  // caseService.getSurveyXml merge แถว survey_expenses เข้ามาให้เฉพาะเคส source='isurvey_xml'
  // → ที่นี่แค่ดูว่ามีค่ามาไหม (มี = ISURVEY, ไม่มี = มือถือ) ไม่ต้องรู้จัก cases.source
  const num = (v: unknown): number => {
    const n = Number(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const photoCount = num(r.photo_fee_count);
  const photoUnit = num(r.photo_fee_price);
  // บล็อกนี้ gold reference ใช้ทศนิยม 2 ตำแหน่งเสมอ ('350.00') — money() ตัดศูนย์ท้ายทิ้ง
  // ('350') ซึ่งอาจต่างจากที่ EMCS importer เคยรับมาหลายปี → คงรูปแบบเดิมไว้
  const baht = (v: unknown): string => num(v).toFixed(2);
  const bill = '<TXN_SURV_BILL>' +
    el('SUR_INVEST', baht(r.service_fee_price)) +   // ค่าบริการ (ต่อครั้ง)
    el('FUL_INVEST', '0.00') +
    el('SUR_TRANS', baht(r.travel_fee_price)) +     // ค่าเดินทาง/พาหนะ (ต่อครั้ง)
    el('FUL_TRANS', '0.00') +
    el('INVEST_NUM', String(num(r.service_fee_count) || 0)) +
    el('TRANS_NUM', String(num(r.travel_fee_count) || 0)) +
    el('PHOTO_NUM', String(photoCount || 0)) +
    // SUR_PHOTO ฝั่งบอทคาดว่าเป็น "ยอดรวม" แล้วหารด้วย PHOTO_NUM เอง → ส่งยอดรวม
    el('SUR_PHOTO', (photoUnit * (photoCount || 1)).toFixed(2)) +
    el('FUL_PHOTO', '0.00') +
    el('SUR_OTHER', baht(r.other_fee_price)) +
    el('OTHER_DESC', String(r.other_fee_detail ?? '')) +
    el('BILL_NO', '') + el('BILL_DATE', '') + el('CREDIT_TERM', '') + el('DUE_DATE', '') +
    el('SUR_TEL', baht(r.phone_fee)) +              // ค่าโทรศัพท์
    el('SUR_INSURE', baht(r.bail_fee)) +            // ค่าประกันตัว
    el('SUR_CLAIM', baht(r.claim_fee_price)) +      // ค่าเรียกร้อง
    el('SUR_DAILY', baht(r.daily_record_fee)) +     // ค่าคัดประจำวัน
    // ⛔ 3 ช่องความเห็นบนหน้า "ค่าใช้จ่าย" ของ EMCS — **หัวหน้ากรอกเองทั้งหมด** (กติกา user)
    //    ผลการดำเนินงาน (ACC_RESULT) · ความเห็นผู้ตรวจสอบ (ACC_COMMENT) · ความเห็นเซอร์เวย์ (SURV_COMMENT)
    //    เคยต่อสาย ACC_RESULT ← survey_result ไว้ (0ed4bba) แล้วถอย: ส่งไปเท่ากับเขียนความเห็น
    //    แทนหัวหน้า. สิ่งที่ผู้สำรวจเขียนคือ "รายละเอียดการเกิดเหตุ" → ACC_DETAIL คนละช่องกัน
    el('ACC_RESULT', '') + el('ACC_COMMENT', '') + el('SURV_COMMENT', '') + el('INC_VAT', '') +
    el('SUR_PERCENT_CLAIM', baht(r.claim_fee_percent)) +
    '</TXN_SURV_BILL>';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<INSERT_SURV_REPORT_XML>${report}${cars}${assetBlocks}${injureBlocks}${bill}</INSERT_SURV_REPORT_XML>`;
}
