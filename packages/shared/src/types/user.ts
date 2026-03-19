export type UserRole = 'surveyor' | 'callcenter' | 'checker';

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  supervisor_id: number | null;
  is_active: boolean;
  fcm_token: string | null;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'fcm_token'>;
}
