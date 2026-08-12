import { Request, Response } from 'express';
import { caseService } from '../services/case.service';
import * as payService from '../services/pay.service';
import { buildPayWorkbook } from '../services/payExport.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { parseIsurveyXml } from '../services/xmlImport.service';
import { AppError } from '../middleware/errorHandler';

export const caseController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const result = await caseService.create(req.body, req.user!.id);
    sendSuccess(res, result, 201);
  }),

  getMyCases: asyncHandler(async (req: Request, res: Response) => {
    const cases = await caseService.getMyCases(req.user!.id);
    sendSuccess(res, cases);
  }),

  assign: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const { surveyor_id } = req.body;
    const result = await caseService.assign(caseId, surveyor_id);
    sendSuccess(res, result);
  }),

  submitSurvey: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.submitSurvey(caseId, req.user!.id, req.body);
    sendSuccess(res, result);
  }),

  updateSurvey: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.updateSurvey(caseId, req.user!.id, req.body);
    sendSuccess(res, result);
  }),

  getCase: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.getById(caseId);
    sendSuccess(res, result);
  }),

  getForReview: asyncHandler(async (_req: Request, res: Response) => {
    const cases = await caseService.getForReview();
    sendSuccess(res, cases);
  }),

  getDetail: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const detail = await caseService.getDetail(caseId, req.user);
    sendSuccess(res, detail);
  }),

  // ดาวน์โหลด INSERT_SURV_REPORT_XML (สำหรับ import เข้าพอร์ทัลประกัน)
  /** นำเข้าเคสจากไฟล์ XML ของ ISURVEY (+ zip รูป) — flow ระบบเก่าที่กำลังเลิกใช้ */
  importXml: asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const xmlFile = files?.xml?.[0];
    if (!xmlFile) throw new AppError(400, 'กรุณาแนบไฟล์ XML ของรายงานสำรวจ');
    const insuranceCompany = String((req.body?.insurance_company ?? '')).trim();
    if (!insuranceCompany) throw new AppError(400, 'กรุณาเลือกบริษัทประกัน — XML ของ ISURVEY ไม่มีข้อมูลนี้ และบอทต้องใช้เลือกบริษัทก่อนนำเข้า EMCS');

    const parsed = parseIsurveyXml(xmlFile.buffer.toString('utf8'));
    const result = await caseService.importFromXml(parsed, {
      insuranceCompany,
      createdBy: req.user!.id,
    });

    let photos = { added: 0, perCat: {} as Record<string, number> };
    const zipFile = files?.zip?.[0];
    if (zipFile) photos = await caseService.importPhotoZip(result.caseId, zipFile.buffer);

    res.json({
      success: true,
      data: {
        ...result,
        photos,
        warnings: parsed.warnings,
        hasMoney: parsed.expenses !== null,
      },
    });
  }),

  exportXml: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const xml = await caseService.getSurveyXml(caseId, req.user);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="survey_${caseId}.xml"`);
    res.send(xml);
  }),

  updateReport: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.updateReport(caseId, req.body);
    sendSuccess(res, result);
  }),

  /** ค่าตอบแทนผู้สำรวจของเคสนี้ — ยอดที่บันทึกไว้ + ยอดที่ระบบแนะนำจากตารางเรท */
  getPay: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await payService.getCasePay(parseInt(req.params.id as string)));
  }),

  savePay: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    sendSuccess(res, await payService.saveCasePay(caseId, req.body ?? {}, req.user?.id));
  }),

  /** ใบเบิกเงินค่าตอบแทนผู้สำรวจ (.xlsx) — กรองตามช่วงวันที่คิดเงิน */
  exportPayXlsx: asyncHandler(async (req: Request, res: Response) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const wb = await buildPayWorkbook({ from, to });
    const stamp = [from, to].filter(Boolean).join('_') || 'all';
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="surveyor_pay_${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }),

  uploadCaseFolder: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const folder = req.body?.folder || '';
    const files = req.files as Express.Multer.File[];
    const result = await caseService.uploadCaseFolder(caseId, folder, files || [], req.user, req.body?.keep);
    sendSuccess(res, result);
  }),

  listCaseFolder: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.listCaseFolder(caseId, req.user);
    sendSuccess(res, result);
  }),

  createCaseFolder: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.createCaseFolder(caseId, req.user);
    sendSuccess(res, result);
  }),

  declineCase: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const result = await caseService.declineCase(caseId, req.user!.id);
    sendSuccess(res, result);
  }),

  confirmArrival: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const { photo_path } = req.body;
    const result = await caseService.confirmArrival(caseId, req.user!.id, photo_path);
    sendSuccess(res, result);
  }),

  getArrivalPhotos: asyncHandler(async (req: Request, res: Response) => {
    const caseId = parseInt(req.params.id as string);
    const photos = await caseService.getArrivalPhotos(caseId, req.user);
    sendSuccess(res, photos);
  }),

  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await caseService.getStats();
    sendSuccess(res, stats);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const result = await caseService.list({ page, limit, status, search });
    sendSuccess(res, result);
  }),

  getWorkload: asyncHandler(async (_req: Request, res: Response) => {
    const data = await caseService.activeWorkload();
    sendSuccess(res, data);
  }),
};
