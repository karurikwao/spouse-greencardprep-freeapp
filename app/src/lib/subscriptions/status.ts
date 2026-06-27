/**
 * Subscription Status
 * 
 * Status definitions, labels, and helpers for subscription state management.
 */

import type { 
  SubscriptionStatus, 
  EffectiveStatus, 
  Subscription,
  EffectiveSubscription,
  SubscriptionDisplayState 
} from './types';
import { PLAN_CONFIG } from '@/lib/plans';

// ============================================================================
// STATUS LABELS
// ============================================================================

export const STATUS_LABELS: Record<SubscriptionStatus | EffectiveStatus, string> = {
  trialing: 'Free Account',
  active: 'Active',
  canceled: 'Canceled',
  expired: 'Expired',
  past_due: 'Payment Issue',
  grace_period: 'Grace Period',
  inactive: 'Inactive',
};

export const STATUS_DESCRIPTIONS: Record<SubscriptionStatus | EffectiveStatus, string> = {
  trialing: 'Your free account access is active.',
  active: 'Your free app access is active.',
  canceled: 'This archived access record is no longer changing core app access.',
  expired: 'This archived access record has expired, but core app access remains free.',
  past_due: 'This archived access record needs review.',
  grace_period: 'This archived access record is in a grace state.',
  inactive: 'Your free app access can be restored by signing in again.',
};

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Check if status allows feature access
 */
export function statusAllowsAccess(status: EffectiveStatus): boolean {
  return ['trialing', 'active', 'grace_period'].includes(status);
}

/**
 * Check if status is in a terminal state (no automatic recovery)
 */
export function isTerminalStatus(status: EffectiveStatus): boolean {
  return ['expired', 'inactive'].includes(status);
}

/**
 * Check if status can be renewed
 */
export function canRenewStatus(status: EffectiveStatus): boolean {
  return ['canceled', 'expired', 'inactive'].includes(status);
}

/**
 * Check if status allows upgrade
 */
export function canUpgradeStatus(status: EffectiveStatus): boolean {
  return ['trialing', 'active', 'canceled', 'past_due', 'grace_period'].includes(status);
}

/**
 * Check if status is in a warning state
 */
export function isWarningStatus(status: EffectiveStatus): boolean {
  return ['canceled', 'past_due', 'grace_period'].includes(status);
}

/**
 * Check if status is an error state
 */
export function isErrorStatus(status: EffectiveStatus): boolean {
  return ['expired', 'inactive'].includes(status);
}

// ============================================================================
// EFFECTIVE STATUS COMPUTATION
// ============================================================================

/**
 * Compute effective status considering time-based expiration
 */
export function computeEffectiveStatus(subscription: Subscription): EffectiveStatus {
  const now = new Date().toISOString();
  
  // If already expired or inactive, return as-is
  if (subscription.status === 'expired' || subscription.status === 'inactive') {
    return subscription.status;
  }
  
  // Check trial expiration
  if (subscription.status === 'trialing' && subscription.trialEndsAt) {
    if (now > subscription.trialEndsAt) {
      return 'expired';
    }
  }
  
  // Check interview pass expiration
  if (subscription.planType === 'interviewPass' && subscription.interviewPassEndsAt) {
    if (now > subscription.interviewPassEndsAt) {
      return 'expired';
    }
  }
  
  // Check grace period expiration
  if (subscription.status === 'grace_period' && subscription.gracePeriodEndsAt) {
    if (now > subscription.gracePeriodEndsAt) {
      return 'expired';
    }
  }
  
  // Check canceled with period ended
  if (subscription.status === 'canceled' && subscription.currentPeriodEndsAt) {
    if (now > subscription.currentPeriodEndsAt) {
      return 'expired';
    }
  }
  
  return subscription.status;
}

// ============================================================================
// DISPLAY STATE COMPUTATION
// ============================================================================

/**
 * Compute user-facing display state for subscription
 */
export function getSubscriptionDisplayState(
  effectiveSub: EffectiveSubscription
): SubscriptionDisplayState {
  const planName = PLAN_CONFIG[effectiveSub.planType].name;
  const statusLabel = STATUS_LABELS[effectiveSub.effectiveStatus];
  const statusDescription = STATUS_DESCRIPTIONS[effectiveSub.effectiveStatus];
  
  // Time remaining
  let timeRemaining: string | null = null;
  if (effectiveSub.daysRemaining !== null && effectiveSub.daysRemaining > 0) {
    if (effectiveSub.daysRemaining === 1) {
      timeRemaining = '1 day left';
    } else if (effectiveSub.daysRemaining < 30) {
      timeRemaining = `${effectiveSub.daysRemaining} days left`;
    } else {
      const months = Math.floor(effectiveSub.daysRemaining / 30);
      timeRemaining = months === 1 ? '1 month left' : `${months} months left`;
    }
  }
  
  // Renewal date
  let renewalDate: string | null = null;
  if (effectiveSub.accessEndsAt && effectiveSub.planType === 'monthly') {
    renewalDate = new Date(effectiveSub.accessEndsAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  
  // Is expiring soon (less than 7 days)
  const isExpiringSoon = effectiveSub.daysRemaining !== null && 
    effectiveSub.daysRemaining > 0 && 
    effectiveSub.daysRemaining <= 7;
  
  // Show upgrade button
  const showUpgradeButton = 
    effectiveSub.effectiveStatus === 'expired' ||
    effectiveSub.effectiveStatus === 'inactive' ||
    effectiveSub.effectiveStatus === 'trialing' ||
    isExpiringSoon;
  
  // Show manage button (for active subscriptions with external provider)
  const showManageButton = 
    (effectiveSub.effectiveStatus === 'active' || 
     effectiveSub.effectiveStatus === 'canceled') &&
    effectiveSub.provider !== 'internal';
  
  // Alert type
  let alertType: SubscriptionDisplayState['alertType'] = null;
  if (isErrorStatus(effectiveSub.effectiveStatus)) {
    alertType = 'error';
  } else if (isWarningStatus(effectiveSub.effectiveStatus)) {
    alertType = 'warning';
  } else if (effectiveSub.effectiveStatus === 'trialing') {
    alertType = 'info';
  } else if (effectiveSub.effectiveStatus === 'active') {
    alertType = 'success';
  }
  
  return {
    planName,
    statusLabel,
    statusDescription,
    timeRemaining,
    renewalDate,
    isExpiringSoon,
    showUpgradeButton,
    showManageButton,
    alertType,
  };
}

// ============================================================================
// STATUS TRANSITION VALIDATION
// ============================================================================

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ['active', 'canceled', 'expired'],
  active: ['canceled', 'past_due', 'grace_period', 'expired'],
  canceled: ['active', 'expired'],
  expired: ['active', 'trialing', 'inactive'],
  past_due: ['active', 'grace_period', 'canceled', 'expired'],
  grace_period: ['active', 'canceled', 'expired'],
  inactive: ['trialing', 'active'],
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  fromStatus: SubscriptionStatus,
  toStatus: SubscriptionStatus
): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * Get valid next statuses for a given status
 */
export function getValidNextStatuses(status: SubscriptionStatus): SubscriptionStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
