export interface SurveyReport {
  id: number;
  case_id: number;
  car_model: string | null;
  car_color: string | null;
  license_plate: string | null;
  notes: string | null;
  created_at: string;
}

export interface SurveyPhoto {
  id: number;
  report_id: number;
  file_path: string;
  uploaded_at: string;
}

export interface SubmitSurveyRequest {
  car_model?: string;
  car_color?: string;
  license_plate?: string;
  notes?: string;
  photo_paths: string[];
}
