-- รูปถ่ายตอนลงเวลาเข้างาน (เซลฟี่/หลักฐาน) — เก็บชื่อไฟล์ที่อยู่ใน /uploads
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_photo VARCHAR(255);
