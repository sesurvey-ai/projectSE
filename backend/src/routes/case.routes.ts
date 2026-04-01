import { Router } from 'express';
import { z } from 'zod';
import { caseController } from '../controllers/case.controller';
import { reviewController } from '../controllers/review.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import { upload } from '../config/multer';

const router = Router();

const createCaseSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  insurance_company: z.string().optional(),
  incident_location: z.string().min(1, 'Incident location is required'),
  incident_lat: z.number().optional(),
  incident_lng: z.number().optional(),
  // ข้อมูลเบื้องต้นจากใบเคลม (optional ทั้งหมด)
  survey_company: z.string().optional(),
  survey_company_address: z.string().optional(),
  claim_type: z.string().optional(),
  claim_no: z.string().optional(),
  claim_ref_no: z.string().optional(),
  insurance_branch: z.string().optional(),
  survey_job_no: z.string().optional(),
  car_lost: z.boolean().optional(),
  policy_no: z.string().optional(),
  policy_type: z.string().optional(),
  policy_start: z.string().optional(),
  policy_end: z.string().optional(),
  assured_name: z.string().optional(),
  prb_number: z.string().optional(),
  deductible: z.number().optional(),
  car_brand: z.string().optional(),
  car_model: z.string().optional(),
  car_type: z.string().optional(),
  car_color: z.string().optional(),
  license_plate: z.string().optional(),
  car_province: z.string().optional(),
  chassis_no: z.string().optional(),
  engine_no: z.string().optional(),
  car_reg_year: z.string().optional(),
  driver_first_name: z.string().optional(),
  driver_last_name: z.string().optional(),
  driver_phone: z.string().optional(),
  acc_date: z.string().optional(),
  acc_time: z.string().optional(),
  acc_place: z.string().optional(),
  acc_subdistrict: z.string().optional(),
  acc_province: z.string().optional(),
  acc_district: z.string().optional(),
  acc_cause: z.string().optional(),
  acc_damage_type: z.string().optional(),
  acc_detail: z.string().optional(),
  acc_fault: z.string().optional(),
  acc_reporter: z.string().optional(),
  reporter_phone: z.string().optional(),
  acc_insurance_notify_date: z.string().optional(),
  acc_insurance_notify_time: z.string().optional(),
  receiver_name: z.string().optional(),
  surveyor_name: z.string().optional(),
  surveyor_phone: z.string().optional(),
  counterparty_plate: z.string().optional(),
  counterparty_brand: z.string().optional(),
  counterparty_insurance: z.string().optional(),
  counterparty_detail: z.string().optional(),
  notes: z.string().optional(),
  ocr_image_paths: z.array(z.string()).optional(),
});

const assignCaseSchema = z.object({
  surveyor_id: z.number().int().positive(),
});

const optStr = z.string().nullish();
const optNum = z.number().nullish();
const optInt = z.number().int().nullish();
const optBool = z.boolean().nullish();

const submitSurveySchema = z.object({
  // ข้อมูลรถเดิม
  car_model: optStr,
  car_color: optStr,
  license_plate: optStr,
  notes: optStr,
  photo_paths: z.array(z.string()).default([]),
  // ข้อมูลบริษัทสำรวจ
  survey_company: optStr,
  survey_company_address: optStr,
  survey_company_phone: optStr,
  // ข้อมูลเคลม
  claim_type: optStr,
  damage_level: optStr,
  car_lost: optBool,
  insurance_company: optStr,
  insurance_branch: optStr,
  survey_job_no: optStr,
  claim_ref_no: optStr,
  claim_no: optStr,
  // ข้อมูลกรมธรรม์
  prb_number: optStr,
  policy_no: optStr,
  driver_by_policy: optStr,
  policy_start: optStr,
  policy_end: optStr,
  assured_name: optStr,
  policy_type: optStr,
  assured_email: optStr,
  risk_code: optStr,
  deductible: optNum,
  // ข้อมูลรถ
  car_brand: optStr,
  car_type: optStr,
  car_province: optStr,
  chassis_no: optStr,
  engine_no: optStr,
  mileage: optInt,
  car_reg_year: optStr,
  ev_type: optStr,
  model_no: optStr,
  // ข้อมูลผู้ขับขี่
  driver_gender: optStr,
  driver_title: optStr,
  driver_name: optStr,
  driver_first_name: optStr,
  driver_last_name: optStr,
  driver_age: optInt,
  driver_birthdate: optStr,
  driver_phone: optStr,
  driver_address: optStr,
  driver_province: optStr,
  driver_district: optStr,
  driver_id_card: optStr,
  driver_license_no: optStr,
  driver_license_type: optStr,
  driver_license_place: optStr,
  driver_license_start: optStr,
  driver_license_end: optStr,
  driver_relation: optStr,
  driver_ticket: optStr,
  // ความเสียหาย
  damage_description: optStr,
  estimated_cost: optNum,
  // รายละเอียดอุบัติเหตุ
  acc_date: optStr,
  acc_time: optStr,
  acc_place: optStr,
  acc_subdistrict: optStr,
  acc_province: optStr,
  acc_district: optStr,
  acc_cause: optStr,
  acc_damage_type: optStr,
  acc_detail: optStr,
  acc_fault: optStr,
  acc_fault_opponent_no: optStr,
  // การสำรวจ
  acc_reporter: optStr,
  reporter_phone: optStr,
  acc_surveyor: optStr,
  acc_surveyor_branch: optStr,
  acc_surveyor_phone: optStr,
  acc_customer_report_date: optStr,
  acc_insurance_notify_date: optStr,
  acc_survey_arrive_date: optStr,
  acc_survey_complete_date: optStr,
  // คู่กรณี
  acc_claim_opponent: optStr,
  acc_claim_amount: optNum,
  acc_claim_total_amount: optNum,
  // ตำรวจ
  acc_police_name: optStr,
  acc_police_station: optStr,
  acc_police_comment: optStr,
  acc_police_date: optStr,
  acc_police_book_no: optStr,
  acc_alcohol_test: optStr,
  acc_alcohol_result: optStr,
  // ติดตามงาน
  acc_followup: optStr,
  acc_followup_count: optStr,
  acc_followup_detail: optStr,
  acc_followup_date: optStr,
  // การตรวจสอบ
  survey_result: optStr,
  review_comment: optStr,
  surveyor_comment: optStr,
});

const submitReviewSchema = z.object({
  comment: z.string().optional(),
  proposed_fee: z.number().optional(),
  approved_fee: z.number().optional(),
});

router.get('/stats', auth, requireRole('callcenter'), caseController.getStats);
router.post('/', auth, requireRole('callcenter'), validate(createCaseSchema), caseController.create);
router.get('/my', auth, requireRole('surveyor'), caseController.getMyCases);
router.get('/review', auth, requireRole('checker'), caseController.getForReview);
router.get('/:id', auth, requireRole('callcenter', 'checker'), caseController.getCase);
router.get('/:id/detail', auth, requireRole('checker', 'surveyor'), caseController.getDetail);
router.post('/:id/assign', auth, requireRole('callcenter'), validate(assignCaseSchema), caseController.assign);
router.post('/:id/folder', auth, requireRole('surveyor'), caseController.createCaseFolder);
router.post('/:id/upload-folder', auth, requireRole('surveyor'), upload.array('photos', 50), caseController.uploadCaseFolder);
router.post('/:id/arrival', auth, requireRole('surveyor'), caseController.confirmArrival);
router.get('/:id/arrival', auth, requireRole('surveyor', 'checker'), caseController.getArrivalPhotos);
router.post('/:id/survey', auth, requireRole('surveyor'), validate(submitSurveySchema), caseController.submitSurvey);
router.put('/:id/survey', auth, requireRole('surveyor'), caseController.updateSurvey);
router.post('/:id/review', auth, requireRole('checker'), validate(submitReviewSchema), reviewController.submitReview);
router.put('/:id/report', auth, requireRole('checker'), caseController.updateReport);

export default router;
