/**
 * Stripe Refund Integration
 */

import type { RefundRequest } from './types';

interface StripeRefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

/**
 * Process a refund through Stripe
 * Note: In production, this should be done via a secure backend/edge function
 */
export async function processStripeRefund(
  _paymentIntentId: string,
  _amount?: number
): Promise<StripeRefundResult> {
  console.warn('Stripe refunds must be processed by the authenticated backend API.');
  return {
    success: false,
    error: 'Stripe refunds must be processed server-side for security',
  };
}

/**
 * Record a Stripe refund in the database
 * This is called after the refund is processed via server-side function
 */
export async function recordStripeRefund(
  refundRequestId: string,
  stripeRefundId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // This should be handled by the server-side function
    // that processes the refund
    const { supabase } = await import('@/lib/supabase');
    
    const { error } = await supabase
      .from('refund_requests')
      .update({
        stripeRefundId: stripeRefundId,
        refunded_at: new Date().toISOString(),
        eligibilityStatus: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequestId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Check if a refund can be processed for a given request
 */
export function canProcessRefund(request: RefundRequest): {
  canRefund: boolean;
  reason?: string;
} {
  if (request.eligibilityStatus === 'refunded') {
    return { canRefund: false, reason: 'Already refunded' };
  }

  if (!request.stripePaymentIntentId) {
    return { canRefund: false, reason: 'No payment intent ID found' };
  }

  if (request.eligibilityStatus === 'denied') {
    return { canRefund: false, reason: 'Refund request was denied' };
  }

  return { canRefund: true };
}
