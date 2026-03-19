export interface SurveyorLocation {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
  request_id: string | null;
}

export interface LocationResponse {
  user_id: number;
  latitude: number;
  longitude: number;
  request_id: string;
}
