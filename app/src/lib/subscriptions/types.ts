/**
 * Subscription Types
 * 
 * Extended subscription model for payment-ready state management.
 * This module works alongside the existing plan system.
 */

import type { PlanType } from '@/lib/plans';

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

/**
 * Subscription lifecycle statuses
 */
export type SubscriptionStatus =
  | 'trialing'      // In trial period
  | 'active'        // Active paid subscription
  | 'canceled'      // Canceled but may have access until period end
  | 'expired'       // Access has ended
  | 'past_due'      // Payment failed, limited access
  | 'grace_period'  // Payment failed but grace period active
  | 'inactive';     // No active subscription

/**
 * Computed effective status that accounts for time-based expiration
 */
export type EffectiveStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'expired'
  | 'past_due'
  | 'grace_period'
  | 'inactive';

// ============================================================================
// PAYMENT PROVIDER
// ============================================================================

/**
 * Payment provider types
 */
export type PaymentProvider =
  | 'internal'      // Default/manual subscriptions
  | 'stripe'        // Stripe integration
  | 'paddle'        // Paddle integration
  | 'lemonsqueezy'  // LemonSqueezy integration
  | 'custom';       // Custom provider

// ============================================================================
// SUBSCRIPTION MODEL
// ============================================================================

/**
 * Complete subscription state from database
 */
export interface Subscription {
  // Core identity
  userId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  
  // Payment provider info
  provider: PaymentProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  
  // Trial dates
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  
  // Billing period dates
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  
  // State transition dates
  canceledAt: string | null;
  endsAt: string | null;
  
  // Plan-specific dates
  lifetimeGrantedAt: string | null;
  interviewPassEndsAt: string | null;
  
  // Grace period
  gracePeriodEndsAt: string | null;
  paymentFailedAt: string | null;
  paymentFailureCount: number;
  
  // Metadata
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Computed subscription state with effective access info
 */
export interface EffectiveSubscription extends Subscription {
  effectiveStatus: EffectiveStatus;
  hasAccess: boolean;
  accessEndsAt: string | null;
  daysRemaining: number | null;
  isInGracePeriod: boolean;
  canRenew: boolean;
  canUpgrade: boolean;
}

// ============================================================================
// SUBSCRIPTION DISPLAY
// ============================================================================

/**
 * User-facing subscription state for UI
 */
export interface SubscriptionDisplayState {
  planName: string;
  statusLabel: string;
  statusDescription: string;
  timeRemaining: string | null;
  renewalDate: string | null;
  isExpiringSoon: boolean;
  showUpgradeButton: boolean;
  showManageButton: boolean;
  alertType: 'info' | 'warning' | 'error' | 'success' | null;
}

// ============================================================================
// TRANSITION EVENTS
// ============================================================================

/**
 * Subscription state transition events
 * These can be triggered by user actions or webhooks
 */
export type SubscriptionTransitionEvent =
  | 'trial_started'
  | 'trial_ended'
  | 'trial_converted'
  | 'checkout_completed'
  | 'subscription_activated'
  | 'subscription_renewed'
  | 'subscription_canceled'
  | 'subscription_expired'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_recovered'
  | 'grace_period_started'
  | 'grace_period_ended'
  | 'lifetime_granted'
  | 'pass_purchased'
  | 'pass_expired'
  | 'upgraded'
  | 'downgraded'
  | 'reactivated';

/**
 * Transition result
 */
export interface TransitionResult {
  success: boolean;
  subscription: Subscription | null;
  previousStatus: SubscriptionStatus | null;
  newStatus: SubscriptionStatus | null;
  error?: string;
}

// ============================================================================
// WEBHOOK EVENTS (Future)
// ============================================================================

/**
 * Standardized webhook event types
 * These map to provider-specific events
 */
export type WebhookEventType =
  | 'checkout.session.completed'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end';

/**
 * Standardized webhook payload
 */
export interface WebhookPayload {
  eventType: WebhookEventType;
  provider: PaymentProvider;
  providerEventId: string;
  timestamp: string;
  data: {
    customerId: string;
    subscriptionId?: string;
    planType?: PlanType;
    status?: SubscriptionStatus;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
  };
}

// ============================================================================
// PAYMENT ACTIONS
// ============================================================================

/**
 * Payment action result
 */
export interface PaymentActionResult {
  success: boolean;
  error?: string;
  checkoutUrl?: string;
  sessionId?: string;
  subscription?: Subscription;
}

/**
 * Checkout options
 */
export interface CheckoutOptions {
  planType?: PlanType; // Optional - can be passed separately
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Feature access result
 */
export interface FeatureAccessResult {
  allowed: boolean;
  reason?: string;
  requiresUpgrade: boolean;
  currentPlan: PlanType;
  effectiveStatus: EffectiveStatus;
}
