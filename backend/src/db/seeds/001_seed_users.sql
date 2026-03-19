-- SE SURVEY: Seed Users
-- Password for all users: password01
-- Bcrypt hash: $2b$10$HgIUDY4pD7sX8hBVOwD6.ehjbUkQcztQWoZxMI3F28fTTvS1gLe0y

INSERT INTO users (username, password_hash, first_name, last_name, role, supervisor_id) VALUES
('survey01', '$2b$10$HgIUDY4pD7sX8hBVOwD6.ehjbUkQcztQWoZxMI3F28fTTvS1gLe0y', 'สมชาย', 'สำรวจ', 'surveyor', NULL),
('survey02', '$2b$10$HgIUDY4pD7sX8hBVOwD6.ehjbUkQcztQWoZxMI3F28fTTvS1gLe0y', 'สมหญิง', 'สำรวจ', 'surveyor', NULL),
('callcenter01', '$2b$10$HgIUDY4pD7sX8hBVOwD6.ehjbUkQcztQWoZxMI3F28fTTvS1gLe0y', 'วิชัย', 'รับแจ้ง', 'callcenter', NULL),
('checker01', '$2b$10$HgIUDY4pD7sX8hBVOwD6.ehjbUkQcztQWoZxMI3F28fTTvS1gLe0y', 'ประเสริฐ', 'ตรวจงาน', 'checker', NULL);
