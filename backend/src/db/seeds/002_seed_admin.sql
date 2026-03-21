-- SE SURVEY: Seed Admin User
-- Password: password01
-- Bcrypt hash: $2b$10$HgIUDY4pD7sX8hBVOwD6.ehjbUkQcztQWoZxMI3F28fTTvS1gLe0y

INSERT INTO users (username, password_hash, first_name, last_name, role, supervisor_id) VALUES
('admin01', '$2a$10$bVQhEow7PyhKuJHeyfRPvu2ywCoJ7TYzi7Y0QX0Vnj0S/KwysMbvy', 'ผู้ดูแล', 'ระบบ', 'admin', NULL)
ON CONFLICT (username) DO NOTHING;
