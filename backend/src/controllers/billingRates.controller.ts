import { Request, Response } from 'express';
import * as rates from '../services/billingRates.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

/** หน้าแก้เรทของผู้ดูแลระบบ — เฉพาะ role admin (บังคับที่ระดับ router) */
export const billingRatesController = {
  /** โหลดทีเดียวจบ — หน้าเว็บเป็นแท็บ สลับไปมาบ่อย ยิงทีละแท็บแล้วกระพริบ */
  overview: asyncHandler(async (_req: Request, res: Response) => {
    const [provinces, tumbons, teams, noTeam, settings] = await Promise.all([
      rates.listProvinceRates(), rates.listTumbonRates(), rates.listTeams(),
      rates.listSurveyorsWithoutTeam(), rates.listSettings(),
    ]);
    sendSuccess(res, {
      provinces, tumbons, teams, surveyors_without_team: noTeam, settings,
      province_options: rates.provinceOptions(),
      field_labels: rates.FIELD_LABELS,
    });
  }),

  amphurs: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.listAmphurRates({
      province: typeof req.query.province === 'string' ? req.query.province : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    }));
  }),

  saveAmphur: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.saveAmphurRate(
      String(req.params.id), req.body ?? {}, req.user?.id));
  }),

  saveProvince: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.saveProvinceRate(
      String(req.params.id), req.body ?? {}, req.user?.id));
  }),

  saveTumbon: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.saveTumbonRate(
      String(req.params.id), req.body ?? {}, req.user?.id));
  }),

  saveTeam: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.saveTeam(
      String(req.body?.sec_code ?? ''), String(req.body?.team ?? ''), req.user?.id));
  }),

  deleteTeam: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.deleteTeam(String(req.params.code), req.user?.id));
  }),

  saveSetting: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.saveSetting(
      String(req.params.key), req.body?.value, req.user?.id));
  }),

  changes: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await rates.listChanges(Number(req.query.limit) || 100));
  }),
};
