import { UserRole } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: UserRole;
      };
    }
  }
}

export type UserRole = 'admin' | 'surveyor' | 'callcenter' | 'checker';
