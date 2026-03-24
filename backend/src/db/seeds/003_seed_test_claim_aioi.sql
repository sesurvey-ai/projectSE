-- SE SURVEY: Test Data from Aioi Bangkok Insurance Claim Form
-- Source: แบบรับแจ้งอุบัติเหตุยานยนต์ ไอโออิ กรุงเทพ ประกันภัย
-- Claim No: 2026013124026 | Date: 23/03/2026

-- Step 1: Insert case
INSERT INTO cases (customer_name, incident_location, incident_lat, incident_lng, assigned_to, created_by, status, insurance_company)
VALUES (
  'บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง จำกัด',
  'บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง ซ.ศูนย์วิจัย 8 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ',
  13.7246834,
  100.5317347,
  1,  -- assigned_to: survey01
  3,  -- created_by: callcenter01
  'assigned',
  'ไอโออิกรุงเทพประกันภัย'
);

-- Step 2: Insert survey report (uses currval to get the case_id)
INSERT INTO survey_reports (
  case_id,
  -- Survey Company
  survey_company,
  survey_company_address,
  survey_company_phone,
  -- Claim Info
  claim_type,
  claim_no,
  claim_ref_no,
  insurance_company,
  insurance_branch,
  survey_job_no,
  damage_level,
  car_lost,
  -- Policy Info (ภาคสมัครใจ)
  policy_no,
  policy_type,
  policy_start,
  policy_end,
  assured_name,
  prb_number,
  deductible,
  -- Vehicle Info
  car_brand,
  car_model,
  car_type,
  car_color,
  license_plate,
  car_province,
  chassis_no,
  engine_no,
  car_reg_year,
  -- Driver Info
  driver_first_name,
  driver_last_name,
  driver_name,
  driver_phone,
  -- Accident Details
  acc_date,
  acc_time,
  acc_place,
  acc_province,
  acc_district,
  acc_cause,
  acc_damage_type,
  acc_detail,
  acc_fault,
  acc_reporter,
  acc_insurance_notify_date,
  -- Notes
  notes
) VALUES (
  currval(pg_get_serial_sequence('cases', 'id')),
  -- Survey Company
  'บริษัท เอลอี เซอร์เวย์ แอนด์ คอนซัลแทนท์ จำกัด',
  '43 ชั้นที่ ซ.ลาดพร้าว138(มีสุข) ถ.ลาดพร้าว แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 102',
  NULL,
  -- Claim Info
  'F',                          -- เคลมสด (Fresh)
  '2026013124026',              -- เลขที่เคลม
  '2026051556',                 -- เลขรับแจ้ง
  'ไอโออิกรุงเทพประกันภัย',
  'กรุงเทพ',
  'SEABI-210260302833',         -- survey job no
  NULL,
  false,
  -- Policy Info (ภาคสมัครใจ)
  '125013115911',               -- เลขกรมธรรม์ภาคสมัครใจ
  '1',                          -- ประเภทกรมธรรม์ ชั้น 1
  '30/03/2568',                 -- เริ่มต้นคุ้มครอง (พ.ศ.)
  '30/03/2569',                 -- สิ้นสุดความคุ้มครอง (พ.ศ.)
  'บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง จำกัด',
  '125013326605',               -- เลขกรมธรรม์ พ.ร.บ.
  0.00,                         -- AmountDeduct (ว่างในใบเคลม)
  -- Vehicle Info
  'TOYOTA',
  'COMMUTER 2.8 COMMUTER',
  'V',                          -- Van type
  'ขาว',
  '1นจ2922',
  'กรุงเทพ ฯ',
  'MMKBBHCPX06523611',
  '1GD5396358',
  '2023',                       -- รถปี 2023
  -- Driver Info
  'สรธัทร',
  'พูนสวัสดิ์',
  'สรธัทร พูนสวัสดิ์',
  '0993166888',
  -- Accident Details
  '23/03/2569',                 -- วันที่เกิดเหตุ (พ.ศ.)
  '13:30',
  'บริษัท เช็ด แอนด์ เสิร์ฟ แคทเทอริง ซ.ศูนย์วิจัย 8',
  'กรุงเทพฯ',
  'เขตห้วยขวาง',
  'ชนวัสดุ/สิ่งของ เช่น เสา,กำแพง,ประตู ฯลฯ',
  'เฉี่ยวชนวัสดุ',
  'ป.เปิดประตูฝาท้ายไว้แล้วถอยชนเสา มีแจ้งเพิ่ม\nรถประกันประเภท 1 ซ่อมห้าง ไม่มี DD ไม่ระบุคนขับ\nรถปี 2023 ต่ออายุปีที่ 3',
  'รถประกันผิด',
  'จินดา ชูศิลปกิจเจริญ (ABI)',
  '24/03/2569|11:32',           -- วันที่รับแจ้ง
  -- Notes
  'โอนสาย 8899 | ป.เปิดประตูฝาท้ายไว้แล้วถอยชนเสา | SE408 นายมนชัย 095-9412353 | กรวีย์ ประสานงานแทนให้ 0993166888'
);
