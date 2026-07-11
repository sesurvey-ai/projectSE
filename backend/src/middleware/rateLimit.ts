import { Request, Response, NextFunction } from 'express';

// Rate limiter แบบ in-memory (ไม่พึ่ง dependency — กัน lockfile/deploy สะดุด)
// เพียงพอสำหรับ backend instance เดียว; ถ้าสเกลหลาย instance ค่อยเปลี่ยนเป็น store กลาง
interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  // สร้าง key ต่อผู้ใช้/IP — default = IP อย่างเดียว
  keyFn?: (req: Request) => string;
}

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max } = opts;
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = opts.keyFn ? opts.keyFn(req) : req.ip || 'unknown';

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    // กันหน่วยความจำบวม — กวาด bucket ที่หมดอายุเมื่อ map ใหญ่เกิน
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        message: opts.message || 'คำขอมากเกินไป กรุณาลองใหม่ภายหลัง',
      });
      return;
    }

    next();
  };
}
