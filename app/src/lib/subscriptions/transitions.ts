/**
 * Subscription Transitions
 * 
 * State transition logic for subscription lifecycle management.
 * All state changes should go through these functions.
 */

import type { 
  Subscription, 
  SubscriptionTransitionEvent,
  TransitionResult,
  PaymentProvider
} from './types';
import type { PlanType } from '@/lib/plans';
import { isValidTransition } from './status';

// ============================================================================
// TRANSITION HANDLERS
// ============================================================================

/**
 * Transition handler function type
 */
type TransitionHandler = (
  subscription: Subscription,
  metadata?: Record<string, unknown>
) => Partial<Subscription> | null;

/**
 * Transition definitions
 */
const TRANSITIONS: Record<SubscriptionTransitionEvent, TransitionHandler> = {
  // Trial events
  trial_started: (_sub, meta) => ({
    status: 'trialing',
    planType: 'trial',
    trialStartsAt: new Date().toISOString(),
    trialEndsAt: (meta?.trialEndsAt as string) || getDaysFromNow(7),
  }),
  
  trial_ended: () => ({
    status: 'expired',
  }),
  
  trial_converted: (sub, meta) => ({
    status: 'active',
    planType: (meta?.planType as PlanType) || 'monthly',
    trialEndsAt: sub.trialEndsAt, // Keep trial end date for reference
    currentPeriodStartsAt: new Date().toISOString(),
    currentPeriodEndsAt: (meta?.currentPeriodEndsAt as string) || getDaysFromNow(30),
  }),
  
  // Subscription events
  checkout_completed: (_sub, meta) => {
    const planType = (meta?.planType as PlanType) || 'monthly';
    const provider = (meta?.provider as PaymentProvider) || 'internal';
    
    if (planType === 'lifetime') {
      return {
        status: 'active',
        planType: 'lifetime',
        lifetimeGrantedAt: new Date().toISOString(),
        provider,
        providerCustomerId: (meta?.providerCustomerId as string) || null,
      };
    }
    
    if (planType === 'interviewPass') {
      return {
        status: 'active',
        planType: 'interviewPass',
        interviewPassEndsAt: (meta?.interviewPassEndsAt as string) || getDaysFromNow(90),
        provider,
        providerCustomerId: (meta?.providerCustomerId as string) || null,
      };
    }
    
    // Monthly subscription
    return {
      status: 'active',
      planType: 'monthly',
      currentPeriodStartsAt: new Date().toISOString(),
      currentPeriodEndsAt: (meta?.currentPeriodEndsAt as string) || getDaysFromNow(30),
      provider,
      providerCustomerId: (meta?.providerCustomerId as string) || null,
      providerSubscriptionId: (meta?.providerSubscriptionId as string) || null,
    };
  },
  
  subscription_activated: (_sub, meta) => ({
    status: 'active',
    currentPeriodStartsAt: new Date().toISOString(),
    currentPeriodEndsAt: (meta?.currentPeriodEndsAt as string) || getDaysFromNow(30),
  }),
  
  subscription_renewed: (_sub, meta) => ({
    status: 'active',
    currentPeriodStartsAt: new Date().toISOString(),
    currentPeriodEndsAt: (meta?.currentPeriodEndsAt as string) || getDaysFromNow(30),
    canceledAt: null, // Clear cancel date on renewal
    endsAt: null,
  }),
  
  subscription_canceled: () => ({
    status: 'canceled',
    canceledAt: new Date().toISOString(),
    // Keep currentPeriodEndsAt - user keeps access until then
  }),
  
  subscription_expired: () => ({
    status: 'expired',
    endsAt: new Date().toISOString(),
  }),
  
  // Payment events
  payment_succeeded: (sub) => {
    // Recover from past_due or grace_period
    if (sub.status === 'past_due' || sub.status === 'grace_period') {
      return {
        status: 'active',
        gracePeriodEndsAt: null,
        paymentFailedAt: null,
        paymentFailureCount: 0,
      };
    }
    return null; // No change needed
  },
  
  payment_failed: (sub, meta) => {
    const newFailureCount = (sub.paymentFailureCount || 0) + 1;
    
    // First failure - enter grace period
    if (newFailureCount === 1) {
      return {
        status: 'grace_period',
        gracePeriodEndsAt: meta?.gracePeriodEndsAt as string || getDaysFromNow(7),
        paymentFailedAt: new Date().toISOString(),
        paymentFailureCount: newFailureCount,
      };
    }
    
    // Multiple failures - past_due
    return {
      status: 'past_due',
      paymentFailedAt: new Date().toISOString(),
      paymentFailureCount: newFailureCount,
    };
  },
  
  payment_recovered: () => ({
    status: 'active',
    gracePeriodEndsAt: null,
    paymentFailedAt: null,
    paymentFailureCount: 0,
  }),
  
  grace_period_started: (_sub, meta) => ({
    status: 'grace_period',
    gracePeriodEndsAt: (meta?.gracePeriodEndsAt as string) || getDaysFromNow(7),
  }),
  
  grace_period_ended: () => ({
    status: 'expired',
    gracePeriodEndsAt: null,
  }),
  
  // Plan-specific events
  lifetime_granted: (_sub, meta) => ({
    status: 'active',
    planType: 'lifetime',
    lifetimeGrantedAt: new Date().toISOString(),
    provider: (meta?.provider as PaymentProvider) || 'internal',
  }),
  
  pass_purchased: (_sub, meta) => ({
    status: 'active',
    planType: 'interviewPass',
    interviewPassEndsAt: (meta?.interviewPassEndsAt as string) || getDaysFromNow(90),
  }),
  
  pass_expired: () => ({
    status: 'expired',
  }),
  
  // Change events
  upgraded: (_sub, meta) => {
    const newPlan = (meta?.planType as PlanType) || 'monthly';
    
    if (newPlan === 'lifetime') {
      return {
        planType: 'lifetime',
        status: 'active',
        lifetimeGrantedAt: new Date().toISOString(),
      };
    }
    
    if (newPlan === 'interviewPass') {
      return {
        planType: 'interviewPass',
        status: 'active',
        interviewPassEndsAt: (meta?.interviewPassEndsAt as string) || getDaysFromNow(90),
      };
    }
    
    return {
      planType: 'monthly',
      status: 'active',
      currentPeriodStartsAt: new Date().toISOString(),
      currentPeriodEndsAt: (meta?.currentPeriodEndsAt as string) || getDaysFromNow(30),
    };
  },
  
  downgraded: (_sub, meta) => {
    // Downgrade typically means switching from lifetime/monthly to lower tier
    // This is rare - usually we just let the subscription expire
    return {
      planType: (meta?.planType as PlanType) || 'trial',
      status: 'active',
    };
  },
  
  reactivated: (_sub, meta) => ({
    status: 'active',
    currentPeriodStartsAt: new Date().toISOString(),
    currentPeriodEndsAt: (meta?.currentPeriodEndsAt as string) || getDaysFromNow(30),
    canceledAt: null,
    endsAt: null,
  }),
};

// ============================================================================
// TRANSITION EXECUTION
// ============================================================================

/**
 * Execute a subscription transition
 */
export function executeTransition(
  subscription: Subscription,
  event: SubscriptionTransitionEvent,
  metadata?: Record<string, unknown>
): TransitionResult {
  const previousStatus = subscription.status;
  
  // Get transition handler
  const handler = TRANSITIONS[event];
  if (!handler) {
    return {
      success: false,
      subscription: null,
      previousStatus,
      newStatus: null,
      error: `Unknown transition event: ${event}`,
    };
  }
  
  // Execute transition
  const updates = handler(subscription, metadata);
  
  if (!updates) {
    return {
      success: false,
      subscription: null,
      previousStatus,
      newStatus: null,
      error: 'Transition handler returned no updates',
    };
  }
  
  // Validate status transition if status is changing
  if (updates.status && updates.status !== subscription.status) {
    if (!isValidTransition(subscription.status, updates.status)) {
      return {
        success: false,
        subscription: null,
        previousStatus,
        newStatus: updates.status,
        error: `Invalid transition from ${subscription.status} to ${updates.status}`,
      };
    }
  }
  
  // Build new subscription
  const newSubscription: Subscription = {
    ...subscription,
    ...updates,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...subscription.metadata,
      ...metadata,
      lastTransition: {
        event,
        fromStatus: previousStatus,
        toStatus: updates.status || subscription.status,
        transitionedAt: new Date().toISOString(),
      },
    },
  };
  
  return {
    success: true,
    subscription: newSubscription,
    previousStatus,
    newStatus: updates.status || subscription.status,
  };
}

/**
 * Preview a transition without executing it
 */
export function previewTransition(
  subscription: Subscription,
  event: SubscriptionTransitionEvent,
  metadata?: Record<string, unknown>
): TransitionResult {
  return executeTransition(subscription, event, metadata);
}

// ============================================================================
// COMMON TRANSITIONS
// ============================================================================

/**
 * Start a trial for a new user
 */
export function startTrial(
  userId: string,
  trialDays: number = 7
): Partial<Subscription> {
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + trialDays);
  
  return {
    userId,
    planType: 'trial',
    status: 'trialing',
    provider: 'internal',
    trialStartsAt: now.toISOString(),
    trialEndsAt: trialEnds.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {},
  };
}

/**
 * Create a new monthly subscription
 */
export function createMonthlySubscription(
  userId: string,
  provider: PaymentProvider = 'internal',
  providerCustomerId?: string,
  providerSubscriptionId?: string
): Partial<Subscription> {
  const now = new Date();
  const periodEnds = new Date(now);
  periodEnds.setMonth(periodEnds.getMonth() + 1);
  
  return {
    userId,
    planType: 'monthly',
    status: 'active',
    provider,
    providerCustomerId: providerCustomerId || null,
    providerSubscriptionId: providerSubscriptionId || null,
    currentPeriodStartsAt: now.toISOString(),
    currentPeriodEndsAt: periodEnds.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {},
  };
}

/**
 * Create a lifetime subscription
 */
export function createLifetimeSubscription(
  userId: string,
  provider: PaymentProvider = 'internal',
  providerCustomerId?: string
): Partial<Subscription> {
  const now = new Date();
  
  return {
    userId,
    planType: 'lifetime',
    status: 'active',
    provider,
    providerCustomerId: providerCustomerId || null,
    lifetimeGrantedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {},
  };
}

/**
 * Create an interview pass subscription
 */
export function createInterviewPassSubscription(
  userId: string,
  passDays: number = 90,
  provider: PaymentProvider = 'internal'
): Partial<Subscription> {
  const now = new Date();
  const passEnds = new Date(now);
  passEnds.setDate(passEnds.getDate() + passDays);
  
  return {
    userId,
    planType: 'interviewPass',
    status: 'active',
    provider,
    interviewPassEndsAt: passEnds.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {},
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get date string N days from now
 */
function getDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
