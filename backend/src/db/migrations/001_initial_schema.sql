-- SE SURVEY: Initial Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- Custom ENUM Types
-- ============================================

CREATE TYPE user_role AS ENUM ('surveyor', 'callcenter', 'checker');
CREATE TYPE case_status AS ENUM ('pending', 'assigned', 'surveyed', 'reviewed');
CREATE TYPE review_status AS ENUM ('pending', 'approved');

-- ============================================
-- Table: users
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    supervisor_id INT REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    fcm_token VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Table: surveyor_locations
-- ============================================

CREATE TABLE surveyor_locations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    request_id VARCHAR(100)
);

CREATE INDEX idx_surveyor_locations_user_id ON surveyor_locations(user_id);
CREATE INDEX idx_surveyor_locations_recorded_at ON surveyor_locations(recorded_at DESC);

-- ============================================
-- Table: cases
-- ============================================

CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    incident_location VARCHAR(500) NOT NULL,
    incident_lat DECIMAL(10,7),
    incident_lng DECIMAL(10,7),
    assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
    created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status case_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_created_by ON cases(created_by);

-- ============================================
-- Table: survey_reports
-- ============================================

CREATE TABLE survey_reports (
    id SERIAL PRIMARY KEY,
    case_id INT NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
    car_model VARCHAR(200),
    car_color VARCHAR(50),
    license_plate VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Table: survey_photos
-- ============================================

CREATE TABLE survey_photos (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Table: reviews
-- ============================================

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    case_id INT NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
    checker_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    comment TEXT,
    proposed_fee DECIMAL(10,2),
    approved_fee DECIMAL(10,2),
    status review_status NOT NULL DEFAULT 'pending',
    reviewed_at TIMESTAMP
);

CREATE INDEX idx_reviews_case_id ON reviews(case_id);
CREATE INDEX idx_reviews_checker_id ON reviews(checker_id);
