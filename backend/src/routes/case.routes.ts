import { Router } from 'express';
import { z } from 'zod';
import { caseController } from '../controllers/case.controller';
import { reviewController } from '../controllers/review.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';

const router = Router();

const createCaseSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  insurance_company: z.string().optional(),
  incident_location: z.string().min(1, 'Incident location is required'),
  incident_lat: z.number().optional(),
  incident_lng: z.number().optional(),
});

const assignCaseSchema = z.object({
  surveyor_id: z.number().int().positive(),
});

const submitSurveySchema = z.object({
  // ข้อมูลรถเดิม
  car_model: z.string().optional(),
  car_color: z.string().optional(),
  license_plate: z.string().optional(),
  notes: z.string().optional(),
  photo_paths: z.array(z.string()).default([]),
  // ข้อมูลบริษัทสำรวจ
  survey_company: z.string().optional(),
  survey_company_address: z.string().optional(),
  survey_company_phone: z.string().optional(),
  // ข้อมูลเคลม
  claim_type: z.string().optional(),
  damage_level: z.string().optional(),
  car_lost: z.boolean().optional(),
  insurance_company: z.string().optional(),
  insurance_branch: z.string().optional(),
  survey_job_no: z.string().optional(),
  claim_ref_no: z.string().optional(),
  claim_no: z.string().optional(),
  // ข้อมูลกรมธรรม์
  prb_number: z.string().optional(),
  policy_no: z.string().optional(),
  driver_by_policy: z.string().optional(),
  policy_start: z.string().optional(),
  policy_end: z.string().optional(),
  assured_name: z.string().optional(),
  policy_type: z.string().optional(),
  assured_email: z.string().optional(),
  risk_code: z.string().optional(),
  deductible: z.number().optional(),
  // ข้อมูลรถ
  car_brand: z.string().optional(),
  car_type: z.string().optional(),
  car_province: z.string().optional(),
  chassis_no: z.string().optional(),
  engine_no: z.string().optional(),
  mileage: z.number().int().optional(),
  car_reg_year: z.string().optional(),
  ev_type: z.string().optional(),
  model_no: z.string().optional(),
  // ข้อมูลผู้ขับขี่
  driver_gender: z.string().optional(),
  driver_title: z.string().optional(),
  driver_name: z.string().optional(),
  driver_first_name: z.string().optional(),
  driver_last_name: z.string().optional(),
  driver_age: z.number().int().optional(),
  driver_birthdate: z.string().optional(),
  driver_phone: z.string().optional(),
  driver_address: z.string().optional(),
  driver_province: z.string().optional(),
  driver_district: z.string().optional(),
  driver_id_card: z.string().optional(),
  driver_license_no: z.string().optional(),
  driver_license_type: z.string().optional(),
  driver_license_place: z.string().optional(),
  driver_license_start: z.string().optional(),
  driver_license_end: z.string().optional(),
  driver_relation: z.string().optional(),
  driver_ticket: z.string().optional(),
  // ความเสียหาย
  damage_description: z.string().optional(),
  estimated_cost: z.number().optional(),
  // รายละเอียดอุบัติเหตุ
  acc_date: z.string().optional(),
  acc_time: z.string().optional(),
  acc_place: z.string().optional(),
  acc_province: z.string().optional(),
  acc_district: z.string().optional(),
  acc_cause: z.string().optional(),
  acc_damage_type: z.string().optional(),
  acc_detail: z.string().optional(),
  acc_fault: z.string().optional(),
  acc_fault_opponent_no: z.string().optional(),
  // การสำรวจ
  acc_reporter: z.string().optional(),
  acc_surveyor: z.string().optional(),
  acc_surveyor_branch: z.string().optional(),
  acc_surveyor_phone: z.string().optional(),
  acc_customer_report_date: z.string().optional(),
  acc_insurance_notify_date: z.string().optional(),
  acc_survey_arrive_date: z.string().optional(),
  acc_survey_complete_date: z.string().optional(),
  // คู่กรณี
  acc_claim_opponent: z.string().optional(),
  acc_claim_amount: z.number().optional(),
  acc_claim_total_amount: z.number().optional(),
  // ตำรวจ
  acc_police_name: z.string().optional(),
  acc_police_station: z.string().optional(),
  acc_police_comment: z.string().optional(),
  acc_police_date: z.string().optional(),
  acc_police_book_no: z.string().optional(),
  acc_alcohol_test: z.string().optional(),
  acc_alcohol_result: z.string().optional(),
  // ติดตามงาน
  acc_followup: z.string().optional(),
  acc_followup_count: z.string().optional(),
  acc_followup_detail: z.string().optional(),
  acc_followup_date: z.string().optional(),
  // การตรวจสอบ
  survey_result: z.string().optional(),
  review_comment: z.string().optional(),
  surveyor_comment: z.string().optional(),
});

const submitReviewSchema = z.object({
  comment: z.string().optional(),
  proposed_fee: z.number().optional(),
  approved_fee: z.number().optional(),
});

router.post('/', auth, requireRole('callcenter'), validate(createCaseSchema), caseController.create);
router.get('/my', auth, requireRole('surveyor'), caseController.getMyCases);
router.get('/review', auth, requireRole('checker'), caseController.getForReview);
router.get('/:id', auth, requireRole('callcenter', 'checker'), caseController.getCase);
router.get('/:id/detail', auth, requireRole('checker', 'surveyor'), caseController.getDetail);
router.post('/:id/assign', auth, requireRole('callcenter'), validate(assignCaseSchema), caseController.assign);
router.post('/:id/survey', auth, requireRole('surveyor'), validate(submitSurveySchema), caseController.submitSurvey);
router.post('/:id/review', auth, requireRole('checker'), validate(submitReviewSchema), reviewController.submitReview);
router.put('/:id/report', auth, requireRole('checker'), caseController.updateReport);

export default router;
