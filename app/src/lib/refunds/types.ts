/**
 * Refund System Types
 */

export type RefundStatus = 
  | 'pending' 
  | 'eligible' 
  | 'not_eligible' 
  | 'approved' 
  | 'denied' 
  | 'refunded';

export interface RefundRequest {
  id: string;
  userId: string;
  subscriptionId?: string;
  stripePaymentIntentId?: string;
  planType: string;
  amount: number;
  currency: string;
  
  // Eligibility tracking
  purchasedAt: string;
  daysSincePurchase: number;
  questionsCompleted: number;
  mockInterviewsCompleted: number;
  eligibilityStatus: RefundStatus;
  
  // Request details
  reason: string;
  additionalComments?: string;
  
  // Admin handling
  adminNotes?: string;
  processedBy?: string;
  processedAt?: string;
  
  // Stripe refund tracking
  stripeRefundId?: string;
  refundedAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestInput {
  subscriptionId?: string;
  stripePaymentIntentId?: string;
  planType: string;
  amount: number;
  reason: string;
  additionalComments?: string;
}

export interface RefundEligibility {
  daysSincePurchase: number;
  questionsCompleted: number;
  mockInterviewsCompleted: number;
  isEligible: boolean;
  reason: string;
}

export interface AdminRefundRequest extends RefundRequest {
  userEmail: string;
}

export const REFUND_REASONS = [
  { value: 'unauthorized_transaction', label: 'I did not authorize this purchase' },
  { value: 'unclear_purchase', label: 'It was not clear what I was buying' },
  { value: 'not_satisfied', label: 'Not satisfied with the service' },
  { value: 'too_difficult', label: 'Questions were too difficult' },
  { value: 'not_needed', label: 'No longer need the service' },
  { value: 'technical_issues', label: 'Technical issues' },
  { value: 'accidental_purchase', label: 'Accidental purchase' },
  { value: 'found_alternative', label: 'Found an alternative' },
  { value: 'other', label: 'Other' },
] as const;

export type RefundReason = typeof REFUND_REASONS[number]['value'];
