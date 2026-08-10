import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

// ชื่อ constraint/index ที่กันเลขซ้ำ (migration 030) → ข้อความไทยที่คนอ่านรู้เรื่อง
// ต้องแปลงเป็น 409 ให้ได้ ไม่งั้นออกเป็น 500 แล้วคิวมือถือจะถือว่า "กู้ได้" แล้ว
// retry ทุก 15 นาทีพร้อมอัปโหลดรูปทั้งโฟลเดอร์ใหม่ทุกรอบ (survey_queue.dart)
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const CONSTRAINT_MESSAGE: Record<string, string> = {
  ux_survey_reports_job_no: 'เลขเซอร์เวย์นี้ถูกใช้ในเคสอื่นแล้ว — เลขเซอร์เวย์ใช้อ้างอิงเบิกเงิน ห้ามซ้ำ',
  ux_survey_reports_job_no_2: 'เลขเซอร์เวย์ (งานครั้งที่ 2) นี้ถูกใช้ในเคสอื่นแล้ว — ห้ามซ้ำ',
  survey_job_no_registry_pkey: 'เลขเซอร์เวย์นี้ถูกใช้ในเคสอื่นแล้ว — เลขเซอร์เวย์ใช้อ้างอิงเบิกเงิน ห้ามซ้ำ',
  ck_survey_reports_job_no_distinct: 'เลขเซอร์เวย์ของงานครั้งที่ 2 ซ้ำกับเลขของงานครั้งแรกในเคสเดียวกัน',
};

type PgError = Error & { code?: string; constraint?: string };

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // DB ปฏิเสธเพราะเลขซ้ำ = ความผิดของข้อมูลที่ส่งมา ไม่ใช่เซิร์ฟเวอร์พัง → 409
  const pg = err as PgError;
  if (pg.code === UNIQUE_VIOLATION || pg.code === CHECK_VIOLATION) {
    const known = pg.constraint ? CONSTRAINT_MESSAGE[pg.constraint] : undefined;
    if (known) {
      res.status(409).json({ success: false, message: known });
      return;
    }
  }

  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
