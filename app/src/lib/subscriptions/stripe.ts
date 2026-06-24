/**
* Stripe Integration Module
*
* Client-side Stripe integration for checkout and billing management.
* All sensitive operations are delegated to API routes via apiClient.
*/

import { apiClient } from '@/lib/apiClient';
import type { PlanType } from '@/lib/plans';

// ============================================================================
// TYPES
// ============================================================================

export interface CheckoutSessionResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
  code?: string;
  appliedDiscount?: {
    originalPrice: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
  };
  offer?: {
    eligible: boolean;
    label: string;
    amountCents: number;
    amount: number;
    currency: string;
    message: string;
  };
}

export interface PortalSessionResult {
  success: boolean;
  portalUrl?: string;
  error?: string;
  code?: string;
}

export interface CheckoutConfirmationResult {
  success: boolean;
  planType?: PlanType;
  sessionId?: string;
  error?: string;
  code?: string;
}

export interface BillingActionResult {
  success: boolean;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEndsAt?: string | null;
  error?: string;
  code?: string;
}

// ============================================================================
// CHECKOUT
// ============================================================================

/**
* Create a Stripe checkout session and return the URL
*
* @param planType - The plan to purchase
* @param successUrl - Optional override for success redirect
* @param cancelUrl - Optional override for cancel redirect
* @param promoCode - Optional promo code for discount
*/
export async function createCheckoutSession(
  planType: PlanType,
  successUrl?: string,
  cancelUrl?: string,
  promoCode?: string
): Promise<CheckoutSessionResult> {
  try {
    // Only paid plans can be purchased
    if (planType === 'trial') {
      return {
        success: false,
        error: 'Trial plan does not require payment',
        code: 'INVALID_PLAN',
      };
    }

    const { data, error } = await apiClient.invokeFunction<CheckoutSessionResult>(
      'create-checkout-session',
      { planType, successUrl, cancelUrl, promoCode }
    );

    if (error) {
      console.error('Checkout session creation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to start checkout',
        code: 'INVOKE_ERROR',
      };
    }

    if (!data?.checkoutUrl) {
      return {
        success: false,
        error: 'No checkout URL returned',
        code: 'NO_URL',
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
      appliedDiscount: data.appliedDiscount,
    };
  } catch (err) {
    console.error('Unexpected error creating checkout:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
* Redirect to Stripe Checkout
*
* @param planType - The plan to purchase
* @param successUrl - Optional override for success redirect
* @param cancelUrl - Optional override for cancel redirect
* @param promoCode - Optional promo code for discount
*/
export async function redirectToCheckout(
  planType: PlanType,
  successUrl?: string,
  cancelUrl?: string,
  promoCode?: string
): Promise<boolean> {
  const result = await createCheckoutSession(planType, successUrl, cancelUrl, promoCode);

  if (result.success && result.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return true;
  }

  return false;
}

export async function createRetentionCheckoutSession(
  successUrl?: string,
  cancelUrl?: string
): Promise<CheckoutSessionResult> {
  try {
    const { data, error } = await apiClient.invokeFunction<CheckoutSessionResult>(
      'create-retention-checkout-session',
      { successUrl, cancelUrl }
    );

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to start retention checkout',
        code: error.code,
      };
    }

    if (!data?.checkoutUrl) {
      return {
        success: false,
        error: 'No checkout URL returned',
        code: 'NO_URL',
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
      offer: data.offer,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function redirectToRetentionOffer(
  successUrl?: string,
  cancelUrl?: string
): Promise<boolean> {
  const result = await createRetentionCheckoutSession(successUrl, cancelUrl);
  if (result.success && result.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return true;
  }
  return false;
}

/**
 * Confirm a completed Stripe Checkout session and activate access.
 *
 * This is a webhook fallback for test mode and delayed webhook delivery.
 * The server verifies the session belongs to the authenticated user before
 * applying any subscription changes.
 */
export async function confirmCheckoutSession(
  sessionId: string
): Promise<CheckoutConfirmationResult> {
  try {
    const { data, error } = await apiClient.invokeFunction<CheckoutConfirmationResult>(
      'confirm-checkout-session',
      { sessionId }
    );

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to confirm checkout',
        code: error.code,
      };
    }

    return {
      success: Boolean(data?.success),
      planType: data?.planType,
      sessionId: data?.sessionId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

// ============================================================================
// CUSTOMER PORTAL
// ============================================================================

/**
* Create a Stripe customer portal session
*/
export async function createCustomerPortalSession(): Promise<PortalSessionResult> {
  try {
    const { data, error } = await apiClient.invokeFunction<PortalSessionResult>(
      'create-customer-portal',
      {}
    );

    if (error) {
      console.error('Portal session creation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to open billing portal',
        code: 'INVOKE_ERROR',
      };
    }

    if (!data?.portalUrl) {
      return {
        success: false,
        error: 'No portal URL returned',
        code: 'NO_URL',
      };
    }

    return {
      success: true,
      portalUrl: data.portalUrl,
    };
  } catch (err) {
    console.error('Unexpected error creating portal:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
* Redirect to Stripe Customer Portal
*/
export async function redirectToCustomerPortal(): Promise<boolean> {
  const result = await createCustomerPortalSession();

  if (result.success && result.portalUrl) {
    window.location.href = result.portalUrl;
    return true;
  }

  return false;
}

// ============================================================================
// BILLING ACTIONS
// ============================================================================

export async function cancelSubscription(): Promise<BillingActionResult> {
  try {
    const { data, error } = await apiClient.invokeFunction<BillingActionResult>(
      'cancel-subscription',
      {}
    );

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to cancel renewal',
        code: error.code,
      };
    }

    return {
      success: Boolean(data?.success),
      status: data?.status,
      cancelAtPeriodEnd: data?.cancelAtPeriodEnd,
      currentPeriodEndsAt: data?.currentPeriodEndsAt,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function resumeSubscription(): Promise<BillingActionResult> {
  try {
    const { data, error } = await apiClient.invokeFunction<BillingActionResult>(
      'resume-subscription',
      {}
    );

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to resume renewal',
        code: error.code,
      };
    }

    return {
      success: Boolean(data?.success),
      status: data?.status,
      cancelAtPeriodEnd: data?.cancelAtPeriodEnd,
      currentPeriodEndsAt: data?.currentPeriodEndsAt,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

// ============================================================================
// CHECKOUT STATUS
// ============================================================================

/**
* Check if current URL indicates a successful checkout
*/
export function isCheckoutSuccess(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('session_id') && window.location.pathname.includes('/billing/success');
}

/**
* Check if current URL indicates a canceled checkout
*/
export function isCheckoutCanceled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/billing/cancel');
}

/**
* Get checkout session ID from URL if present
*/
export function getCheckoutSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('session_id');
}
