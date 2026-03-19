export type ReviewStatus = 'pending' | 'approved';

export interface Review {
  id: number;
  case_id: number;
  checker_id: number;
  comment: string | null;
  proposed_fee: number | null;
  approved_fee: number | null;
  status: ReviewStatus;
  reviewed_at: string | null;
}

export interface SubmitReviewRequest {
  comment?: string;
  proposed_fee?: number;
  approved_fee?: number;
}
