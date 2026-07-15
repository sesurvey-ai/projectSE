/* (ก) เติมข้อมูล se-survey ลงฟอร์ม HTML จริงของประกัน (by element id/name) เพื่อเทียบ 1:1
 * ใช้ตาราง lookup ชุดเดียวกับ xmlExport (ชื่อ→รหัส) — dropdown ในฟอร์มโชว์รหัส
 * รัน: FORMS_DIR="C:\path\to\forms" REPORT_JSON="C:\path\to\report.json" node fill-forms.js
 *   → เขียนไฟล์ _filled_*.html ข้างต้นฉบับ (report.json = data.report จาก GET /api/cases/:id/detail)
 *   ถ้าไม่ตั้ง REPORT_JSON จะใช้ fixture ตัวอย่างด้านล่าง (เคส 21BR10AVD-6906-000098) */
const fs = require('fs');
const cheerio = require('cheerio');
const DIR = process.env.FORMS_DIR || 'C:\\Users\\i9\\Desktop\\21BR10AVD-6906-000098';

// ── lookups (ย่อจาก xmlExport.service.ts) ──
const PROVINCE = { 'กรุงเทพ ฯ': '2', 'ปทุมธานี': '28', 'อ่างทอง': '71', 'นนทบุรี': '24', 'ชลบุรี': '9' };
const COLOR = { 'ขาว': '1', 'เทา': '2', 'เงิน': '3', 'ดำ': '13', 'แดง': '10', 'น้ำเงิน': '8' };
const RELATION = { 'เจ้าของรถ': '13', 'สามี': '1', 'ภรรยา': '2', 'บุตร': '3', 'บิดา': '4', 'มารดา': '5', 'เพื่อน': '20' };
const TITLE = { 'นาย': '1', 'นาง': '2', 'นางสาว': '3', 'คุณ': '6' };
const LICENSE = { 'ใบขับขี่รถยนต์ส่วนบุคคล': '19', 'ไม่มีใบขับขี่': '26' };
const FAULT = { 'ฝ่ายผิด': '1', 'รถประกันเป็นฝ่ายผิด': '1', 'คู่กรณีผิด': '2', 'ประมาทร่วม': '3', 'รอสรุปผลคดี': '4', 'ฝ่ายถูกและผิด': '5', 'ยกเลิกการเคลม': '6', 'ไปถึงแล้วไม่พบ': '7' };
const CAUSE = { 'ถูกก้อนหิน': '9301', 'เฉี่ยวชนวัสดุ': '9114', 'ชนท้ายคู่กรณี': '9101', 'ชนสัตว์': '9117' };
const PERSON_TYPE = { 'ผู้ขับขี่รถประกัน': '01', 'ผู้โดยสารรถประกัน': '03', 'ผู้ขับขี่คู่กรณี': '02', 'ผู้โดยสารคู่กรณี': '04', 'บุคคลภายนอก': '05' };
const WOUND = { 'เล็กน้อย': '01', 'ปานกลาง': '02', 'สาหัส': '03', 'ทุพพลภาพ': '04', 'เสียชีวิตก่อนรักษา': '05', 'เสียชีวิตหลังรักษา': '06' };
const L = (t, v) => (v && t[String(v).trim()]) || '';
const polType = (v) => { const m = /(\d+\+?)/.exec(String(v || '')); return m ? (m[1].includes('+') ? m[1] : m[1].padStart(2, '0')) : ''; };
const dpart = (v) => String(v || '').split('|')[0].trim();          // "dd/mm/yyyy|HH:mm" → date
const hpart = (v) => (String(v || '').split('|')[1] || '').split(':')[0] || '';
const mpart = (v) => (String(v || '').split('|')[1] || '').split(':')[1] || '';

// ── se-survey report ที่เทียบเท่าเคส 21BR10AVD-6906-000098 (+ ตัวอย่างทรัพย์สิน/ผู้บาดเจ็บ) ──
const R_DEMO = {
  survey_job_no: 'SETP-69060003', claim_no: '21BR10AVD-6906-000098', claim_ref_no: 'BR10/6906/13144',
  policy_no: 'VM1-3100373218-26N10', assured_name: 'สถาพร สอดส่อง', policy_type: 'ชั้น 1',
  policy_start: '27/03/2569', policy_end: '27/03/2570', acc_date: '02/06/2569', acc_time: '13:27',
  acc_place: 'ตลาดไท ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี', acc_province: 'ปทุมธานี',
  acc_detail: 'หินกระเด็นใส่ // กระจกบังลมหน้าร้าว', acc_fault: 'ฝ่ายผิด', acc_cause: 'ถูกก้อนหิน',
  acc_reporter: 'สถาพร สอดส่อง', acc_surveyor: 'SE254 นาย วุฒิชัย ต้นจันทร์', claim_type: 'D',
  acc_customer_report_date: '02/06/2569|13:27', acc_survey_arrive_date: '02/06/2569|14:21', acc_survey_complete_date: '02/06/2569|19:43',
  license_plate: '4ฒญ3789', car_province: 'กรุงเทพ ฯ', chassis_no: 'MP1TFR41JTT002776', car_type: 'T',
  car_model: 'D-MAX 2.5 2 Doors', car_color: 'ขาว',
  driver_first_name: 'สถาพร', driver_last_name: 'สอดส่อง', driver_age: '35', driver_relation: 'เจ้าของรถ',
  driver_title: 'นาย', driver_address: '52 ม.6 รำมะสัก โพธิ์ทอง อ่างทอง', driver_province: 'อ่างทอง',
  driver_phone: '0911921352', driver_id_card: '1159900142478', driver_license_no: '68004904',
  driver_license_type: 'ใบขับขี่รถยนต์ส่วนบุคคล', driver_license_place: 'อ่างทอง',
  driver_license_start: '26/10/2552', driver_license_end: '23/09/2573', driver_birthdate: '23/09/2533', driver_gender: 'M',
  estimated_cost: '6000',
  damaged_property: [{ owner_name: 'สมชาย มีทรัพย์', owner_phone: '0812223333', owner_address: 'ริมถนนพหลโยธิน', item: 'รั้วคอนกรีต', detail: 'รั้วหัก 2 ช่อง', cause: 'รถเสียหลักชน', estimated_cost: '8000' }],
  injured_persons: [{ name: 'สมหญิง เจ็บป่วย', gender: 'F', cid: '1100000000000', age: '28', person_type: 'บุคคลภายนอก', wound_level: 'สาหัส', relation: 'เพื่อน', address: 'คลองหลวง ปทุมธานี', phone: '0899998888', hospital: 'รพ.ปทุมธานี', symptom: 'ขาหัก', treat_cost: '50000', car_reg: '' }],
};

// ใช้ข้อมูลเคสจริงถ้าตั้ง REPORT_JSON (dump จาก data.report ของ GET /api/cases/:id/detail) ไม่งั้นใช้ fixture
const R = process.env.REPORT_JSON ? JSON.parse(fs.readFileSync(process.env.REPORT_JSON, 'utf8')) : R_DEMO;

function loader(file) {
  const html = fs.readFileSync(`${DIR}\\${file}`, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const pick = (sel) => { let e = $(`#${sel.replace(/\$/g, '\\$')}`); if (!e.length) e = $(`[name="${sel}"]`); if (!e.length) e = $(`[id="${sel}"]`); return e; };
  const text = (id, v) => { const e = pick(id); if (!e.length || v == null || v === '') return; e.is('textarea') ? e.text(String(v)) : e.attr('value', String(v)); };
  const sel = (id, code) => { const e = pick(id); if (!e.length || !code) return; e.find('option').removeAttr('selected'); e.find(`option[value="${code}"]`).attr('selected', 'selected'); };
  const radio = (name, val) => { if (!val) return; $(`input[name="${name}"]`).removeAttr('checked'); $(`input[name="${name}"][value="${val}"]`).attr('checked', 'checked'); };
  const write = (out) => fs.writeFileSync(`${DIR}\\${out}`, $.html(), 'utf8');
  return { $, text, sel, radio, write, pick };
}

// ── หน้า 1: กรอกรายละเอียดอุบัติเหตุ ──
{
  const f = loader('กรอกรายละเอียดอุบัติเหตุ.html');
  f.text('txtSurv_JobNo', R.survey_job_no); f.text('txtRef_Claim_No', R.claim_no); f.text('txtAcc_ClaimRef_No', R.claim_ref_no);
  f.text('txtAcc_Policy_No', R.policy_no); f.text('txtAssured_Name', R.assured_name); f.text('txtPolicy_Type', polType(R.policy_type));
  f.text('wuCale_Policy_Start_txtCalendar', R.policy_start); f.text('wuCale_Policy_End_txtCalendar', R.policy_end);
  f.text('wuCale_Acc_Date_txtCalendar', R.acc_date); f.text('txtAcc_Date_Hour', R.acc_time.split(':')[0]); f.text('txtAcc_Date_Minute', R.acc_time.split(':')[1]);
  f.text('txtAcc_Place', R.acc_place); f.sel('ddlAcc_ProvinceID', L(PROVINCE, R.acc_province));
  f.text('txtAcc_Detail', R.acc_detail); f.sel('ddlClm_Cause', L(CAUSE, R.acc_cause));
  f.radio('rdoAcc_Cause', L(FAULT, R.acc_fault)); f.radio('rdoSurv_Claim_Type', R.claim_type);
  f.text('txtAcc_Call', R.acc_reporter); f.text('txtAcc_Surv', R.acc_surveyor);
  f.text('wuCale_Acc_Call_Date_txtCalendar', dpart(R.acc_customer_report_date)); f.text('txtAcc_Call_Date_Hour', hpart(R.acc_customer_report_date)); f.text('txtAcc_Call_Date_Minute', mpart(R.acc_customer_report_date));
  f.text('wuCale_Acc_Reach_txtCalendar', dpart(R.acc_survey_arrive_date)); f.text('txtAcc_Reach_Hour', hpart(R.acc_survey_arrive_date)); f.text('txtAcc_Reach_Minute', mpart(R.acc_survey_arrive_date));
  f.text('wuCale_Acc_Finish_txtCalendar', dpart(R.acc_survey_complete_date)); f.text('txtAcc_Finish_Hour', hpart(R.acc_survey_complete_date)); f.text('txtAcc_Finish_Minute', mpart(R.acc_survey_complete_date));
  // รถประกัน
  f.text('txtCar_RegNo', R.license_plate); f.sel('ddlCar_Province', L(PROVINCE, R.car_province)); f.text('txtChassisNo', R.chassis_no);
  f.sel('ddlCType', R.car_type); f.sel('ddlCar_Color', L(COLOR, R.car_color)); f.text('txtCModel2', R.car_model);
  // ผู้ขับขี่
  f.sel('ddlDri_Title_ID', L(TITLE, R.driver_title)); f.text('txtDri_Name01', R.driver_first_name); f.text('txtDri_LastName01', R.driver_last_name);
  f.text('txtDri_Age', R.driver_age); f.sel('ddlDri_Relation_ID', L(RELATION, R.driver_relation)); f.text('txtDri_Address', R.driver_address);
  f.sel('ddlDri_ProvinceID', L(PROVINCE, R.driver_province)); f.text('txtDri_Tel_No', R.driver_phone); f.text('txtDri_CardID', R.driver_id_card);
  f.text('txtDri_DrvID', R.driver_license_no); f.sel('ddlEmcs_License_Type', L(LICENSE, R.driver_license_type)); f.text('txtDri_DrvPlace', R.driver_license_place);
  f.text('wuCale_Dri_DrvDate_Start_txtCalendar', R.driver_license_start); f.text('wuCale_Dri_DrvDate_End_txtCalendar', R.driver_license_end);
  f.text('wuCale_Dri_BirthDay_txtCalendar', R.driver_birthdate); f.radio('rdoDri_Gender', R.driver_gender);
  f.write('_filled_กรอกรายละเอียดอุบัติเหตุ.html');
  console.log('[1] main form filled');
}

// ── หน้า 2: ทรัพย์สิน (repeater dtlAsset$ctlNN$wuAsset$) ──
{
  const f = loader('ทรัพย์สิน.html');
  R.damaged_property.forEach((a, i) => {
    const p = `dtlAsset$ctl${String(i).padStart(2, '0')}$wuAsset$`;
    f.text(p + 'txtOwner', a.owner_name); f.text(p + 'txtTel_No', a.owner_phone); f.text(p + 'txtAddress', a.owner_address);
    f.text(p + 'txtAsset_Desc', a.item); f.text(p + 'txtAsset_Damage', a.detail); f.text(p + 'txtAsset_Damage_Cause', a.cause); f.text(p + 'txtCost_Damage', a.estimated_cost);
  });
  f.write('_filled_ทรัพย์สิน.html');
  console.log(`[2] property filled (${R.damaged_property.length} รายการ)`);
}

// ── หน้า 3: ผู้บาดเจ็บ (repeater dtlInj$ctlNN$wuInj$) ──
{
  const f = loader('ผู้บาดเจ็บ.html');
  R.injured_persons.forEach((p0, i) => {
    const p = `dtlInj$ctl${String(i).padStart(2, '0')}$wuInj$`;
    f.text(p + 'txtInj_Name', p0.name); f.radio(`${p}rdoGender`, p0.gender); f.text(p + 'txtCitizen_ID', p0.cid); f.text(p + 'txtInj_Age', p0.age);
    f.sel(p + 'ddlPerson_Type', L(PERSON_TYPE, p0.person_type)); f.sel(p + 'ddlWounded_Type', L(WOUND, p0.wound_level)); f.sel(p + 'ddlDri_Relation_ID', L(RELATION, p0.relation));
    f.text(p + 'txtInj_Address', p0.address); f.text(p + 'txtInj_Tel_No', p0.phone); f.text(p + 'txtInj_Hos_Name', p0.hospital);
    f.text(p + 'txtInj_Injure', p0.symptom); f.text(p + 'txtInj_Cost', p0.treat_cost); f.text(p + 'txtCar_RegNo', p0.car_reg);
  });
  f.write('_filled_ผู้บาดเจ็บ.html');
  console.log(`[3] injured filled (${R.injured_persons.length} คน)`);
}
console.log('\nเสร็จ → ไฟล์ _filled_*.html อยู่ในโฟลเดอร์เดียวกับต้นฉบับ');
