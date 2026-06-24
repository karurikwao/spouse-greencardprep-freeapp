/**
 * Subscriptions Module
 * 
 * Payment-ready subscription state management.
 * 
 * This module provides:
 * - Subscription state types and status definitions
 * - Access control based on subscription + plan configuration
 * - State transition logic for subscription lifecycle
 * - Payment provider abstraction layer
 * - UI display state helpers
 * 
 * Usage:
 * ```ts
 * import { 
 *   buildEffectiveSubscription,
 *   checkFeatureAccess,
 *   executeTransition,
 *   getSubscriptionDisplayState 
 * } from '@/lib/subscriptions';
 * 
 * // Get effective subscription with computed access
 * const effectiveSub = buildEffectiveSubscription(subscription);
 * 
 * // Check feature access
 * const access = checkFeatureAccess(effectiveSub, 'pdfDownloads');
 * 
 * // Execute state transition
 * const result = executeTransition(subscription, 'subscription_canceled');
 * 
 * // Get display state for UI
 * const display = getSubscriptionDisplayState(effectiveSub);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  Subscription,
  EffectiveSubscription,
  SubscriptionStatus,
  EffectiveStatus,
  PaymentProvider,
  SubscriptionDisplayState,
  SubscriptionTransitionEvent,
  TransitionResult,
  WebhookEventType,
  WebhookPayload,
  PaymentActionResult,
  CheckoutOptions,
  FeatureAccessResult,
} from './types';

// ============================================================================
// STATUS
// ============================================================================

export {
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  statusAllowsAccess,
  isTerminalStatus,
  canRenewStatus,
  canUpgradeStatus,
  isWarningStatus,
  isErrorStatus,
  computeEffectiveStatus,
  getSubscriptionDisplayState,
  isValidTransition,
  getValidNextStatuses,
} from './status';

// ============================================================================
// ACCESS CONTROL
// ============================================================================

export {
  buildEffectiveSubscription,
  checkFeatureAccess,
  canUseAI,
  canDownloadPDFs,
  canUseCoupleCompare,
  canChooseProvider,
  canChooseModel,
  hasPremiumAccess,
  hasLifetimeAccess,
  hasActiveTrial,
  getSubscriptionAiLimits,
  isUpgrade,
  isDowngrade,
} from './access';

// ============================================================================
// TRANSITIONS
// ============================================================================

export {
  executeTransition,
  previewTransition,
  startTrial,
  createMonthlySubscription,
  createLifetimeSubscription,
  createInterviewPassSubscription,
} from './transitions';

// ============================================================================
// PROVIDER MAPPING
// ============================================================================

export {
  PROVIDER_CONFIGS,
  type ProviderConfig,
  normalizeWebhookEvent,
  mapWebhookToTransition,
  generateCheckoutUrl,
  generatePortalUrl,
} from './providerMapping';

// ============================================================================
// STRIPE INTEGRATION
// ============================================================================

export {
  createCheckoutSession,
  confirmCheckoutSession,
  createRetentionCheckoutSession,
  redirectToCheckout,
  redirectToRetentionOffer,
  createCustomerPortalSession,
  redirectToCustomerPortal,
  cancelSubscription,
  resumeSubscription,
  isCheckoutSuccess,
  isCheckoutCanceled,
  getCheckoutSessionId,
  type CheckoutSessionResult,
  type CheckoutConfirmationResult,
  type PortalSessionResult,
  type BillingActionResult,
} from './stripe';

// ============================================================================
// PAYMENT ACTIONS
// ============================================================================

import type { PaymentActionResult, CheckoutOptions } from './types';
import type { PlanType } from '@/lib/plans';
import { redirectToCheckout, redirectToCustomerPortal } from './stripe';

/**
 * Start checkout for a plan
 * Integrates with Stripe Checkout via Supabase Edge Function
 */
export async function startCheckout(
  planType: PlanType,
  options: Omit<CheckoutOptions, 'planType'>
): Promise<PaymentActionResult> {
  const success = await redirectToCheckout(planType, options.successUrl, options.cancelUrl);
  
  if (!success) {
    return {
      success: false,
      error: 'Unable to start checkout. Please try again.',
    };
  }
  
  // redirectToCheckout navigates away, so this return is mostly for type safety
  return { success: true };
}

/**
 * Open subscription management portal
 * Integrates with Stripe Customer Portal
 */
export async function openManageSubscription(): Promise<PaymentActionResult> {
  const success = await redirectToCustomerPortal();
  
  if (!success) {
    return {
      success: false,
      error: 'Unable to open billing portal. You may not have an active subscription.',
    };
  }
  
  // redirectToCustomerPortal navigates away
  return { success: true };
}

/**
 * Restore purchase by opening the Stripe billing portal.
 * Web users can verify invoices, payment methods, and active subscriptions there.
 */
export async function restorePurchase(): Promise<PaymentActionResult> {
  return openManageSubscription();
}

/**
 * Apply a plan transition (for admin/webhook use)
 * This is the entry point for applying subscription changes
 */
export async function applyPlanTransition(
  userId: string,
  event: import('./types').SubscriptionTransitionEvent,
  metadata?: Record<string, unknown>
): Promise<PaymentActionResult> {
  console.log('applyPlanTransition:', { userId, event, metadata });
  
  // TODO: Implement server-side transition application
  // 1. Call Supabase RPC to apply transition
  // 2. Update local state
  // 3. Emit events
  
  return {
    success: true,
    // subscription: updatedSubscription,
  };
}

// ============================================================================
// RE-EXPORT PLAN TYPES FOR CONVENIENCE
// ============================================================================

export type { PlanType, FeatureKey } from '@/lib/plans';
