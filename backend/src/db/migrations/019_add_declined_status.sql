-- เพิ่ม 'declined' ให้ case_status enum
-- มือถือเรียก POST /api/cases/:id/decline (ปุ่มปฏิเสธงานบน overlay/notification) → UPDATE cases SET status='declined'
-- และหน้า "งานที่ปฏิเสธ" บนแอปกรองด้วย status='declined' แต่ enum เดิม (001) ไม่มีค่านี้ → UPDATE พังด้วย invalid enum
-- additive + idempotent: รันซ้ำได้ ปลอดภัยทั้ง DB ที่เคยแก้มือไว้แล้วและ DB ที่ยังไม่มี
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'declined';
