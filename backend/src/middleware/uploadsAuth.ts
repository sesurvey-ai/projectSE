import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// ป้องกันการเข้าถึงรูปใน /uploads โดยไม่ผ่าน auth (บัตร ปชช./ใบขับขี่/รูปลงเวลา = PII)
// รับ token ได้ 2 ทาง:
//   1. Authorization: Bearer <token>  — มือถือ (Image.network ส่ง header ได้ → token ไม่โผล่ใน URL)
//   2. ?token=<token>                 — เว็บ <img>/<a> ที่แนบ header ไม่ได้
// ตรวจแค่ลายเซ็น JWT (ไม่ query DB) เพราะ endpoint นี้โดนเรียกถี่ (avatar หลายรูป/หน้า);
// การเพิกถอนสิทธิ์จริงบังคับที่ /api (middleware auth) ซึ่ง path รูปใหม่ต้องผ่านที่นั่นก่อน
export const uploadsAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const headerToken = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const token = headerToken || queryToken;

  if (!token) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  try {
    jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
