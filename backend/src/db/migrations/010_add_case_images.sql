-- case_images: เก็บรูปที่ใช้ OCR / capture จาก call center
CREATE TABLE IF NOT EXISTS case_images (
    id SERIAL PRIMARY KEY,
    case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    image_type VARCHAR(50) DEFAULT 'ocr',
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_images_case_id ON case_images(case_id);
