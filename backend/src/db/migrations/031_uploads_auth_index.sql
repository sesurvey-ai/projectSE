-- index สำหรับด่านตรวจสิทธิ์รูปใน /uploads (middleware/uploadsAuth)
--
-- surveyor เปิดรูปลงเวลาของตัวเอง → ค้น attendance_records ด้วยชื่อไฟล์ทุกครั้งที่ cache miss
-- ไม่มี index = seq scan ทั้งตาราง (ตอนนี้ 602 แถว โตทุกวันที่มีคนลงเวลา)
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม
CREATE INDEX IF NOT EXISTS ix_attendance_records_check_in_photo
  ON attendance_records (check_in_photo)
  WHERE check_in_photo IS NOT NULL;
