export type CaseStatus = 'pending' | 'assigned' | 'surveyed' | 'reviewed';

export interface Case {
  id: number;
  customer_name: string;
  incident_location: string;
  incident_lat: number | null;
  incident_lng: number | null;
  assigned_to: number | null;
  created_by: number;
  status: CaseStatus;
  created_at: string;
}

export interface CreateCaseRequest {
  customer_name: string;
  incident_location: string;
  incident_lat?: number;
  incident_lng?: number;
}

export interface AssignCaseRequest {
  surveyor_id: number;
}
