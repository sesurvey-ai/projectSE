-- SE SURVEY: Seed Users
-- Password for all users: password01
-- Bcrypt hash: $2a$10$bVQhEow7PyhKuJHeyfRPvu2ywCoJ7TYzi7Y0QX0Vnj0S/KwysMbvy

INSERT INTO users (username, password_hash, first_name, last_name, role, supervisor_id) VALUES
('survey01', '$2a$10$bVQhEow7PyhKuJHeyfRPvu2ywCoJ7TYzi7Y0QX0Vnj0S/KwysMbvy', 'สมชาย', 'สำรวจ', 'surveyor', NULL),
('survey02', '$2a$10$bVQhEow7PyhKuJHeyfRPvu2ywCoJ7TYzi7Y0QX0Vnj0S/KwysMbvy', 'สมหญิง', 'สำรวจ', 'surveyor', NULL),
('callcenter01', '$2a$10$bVQhEow7PyhKuJHeyfRPvu2ywCoJ7TYzi7Y0QX0Vnj0S/KwysMbvy', 'วิชัย', 'รับแจ้ง', 'callcenter', NULL),
('checker01', '$2a$10$bVQhEow7PyhKuJHeyfRPvu2ywCoJ7TYzi7Y0QX0Vnj0S/KwysMbvy', 'ประเสริฐ', 'ตรวจงาน', 'checker', NULL);
