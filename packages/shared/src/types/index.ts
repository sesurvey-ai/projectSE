export * from './user';
export * from './case';
export * from './survey';
export * from './review';
export * from './location';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}
