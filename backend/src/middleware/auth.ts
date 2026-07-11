import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { db } from '../config/database';

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  const token = header.split(' ')[1];

  let decoded: { id: number; username: string; role: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  try {
    // เช็คสถานะบัญชีสด ๆ กับ DB — ปิดใช้งาน/ลดสิทธิ์แล้ว token เดิมต้องใช้ไม่ได้ทันที
    // (ไม่งั้น token 15 วันยังใช้ได้ต่อ) และใช้ role ล่าสุดจาก DB (honor การเปลี่ยน role)
    const result = await db.query(
      'SELECT id, username, role, is_active FROM users WHERE id = $1 LIMIT 1',
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      res.status(401).json({ success: false, message: 'Account is deactivated' });
      return;
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role as 'admin' | 'surveyor' | 'callcenter' | 'checker',
    };
    next();
  } catch (err) {
    next(err);
  }
};
