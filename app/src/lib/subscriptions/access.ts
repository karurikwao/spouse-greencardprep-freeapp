/**
 * Subscription Access Control
 * 
 * Determines feature access based on subscription state + plan configuration.
 * This works alongside the existing plan system.
 */

import type { 
  Subscription, 
  EffectiveSubscription, 
  FeatureAccessResult 
} from './types';
import type { PlanType, FeatureKey } from '@/lib/plans';
import { 
  getPlanFeatures,
  getPlanAiLimits 
} from '@/lib/plans';
import { computeEffectiveStatus, statusAllowsAccess } from './status';

// ============================================================================
// EFFECTIVE SUBSCRIPTION COMPUTATION
// ============================================================================

/**
 * Build effective subscription with computed access info
 */
export function buildEffectiveSubscription(
  subscription: Subscription
): EffectiveSubscription {
  const effectiveStatus = computeEffectiveStatus(subscription);
  const now = new Date().toISOString();
  
  // Determine if user has access
  let hasAccess = statusAllowsAccess(effectiveStatus);
  
  // Canceled subscriptions may have access until period end
  if (subscription.status === 'canceled' && subscription.currentPeriodEndsAt) {
    hasAccess = now <= subscription.currentPeriodEndsAt;
  }
  
  // Compute access end date
  let accessEndsAt: string | null = null;
  
  if (subscription.planType === 'lifetime' && effectiveStatus === 'active') {
    // Lifetime has no end
    accessEndsAt = null;
  } else {
    // Use the most relevant end date
    accessEndsAt = subscription.endsAt ||
      subscription.currentPeriodEndsAt ||
      subscription.trialEndsAt ||
      subscription.interviewPassEndsAt ||
      subscription.gracePeriodEndsAt ||
      null;
  }
  
  // Compute days remaining
  let daysRemaining: number | null = null;
  if (accessEndsAt) {
    const end = new Date(accessEndsAt);
    const nowDate = new Date();
    const diffMs = end.getTime() - nowDate.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  
  // Paid-plan renewal and upgrade actions are retired in the free app.
  const canRenew = false;
  const canUpgrade = false;
  
  return {
    ...subscription,
    effectiveStatus,
    hasAccess,
    accessEndsAt,
    daysRemaining,
    isInGracePeriod: effectiveStatus === 'grace_period',
    canRenew,
    canUpgrade,
  };
}

// ============================================================================
// FEATURE ACCESS
// ============================================================================

/**
 * Check if a feature is accessible given subscription state
 */
export function checkFeatureAccess(
  subscription: Subscription | EffectiveSubscription | null,
  feature: FeatureKey
): FeatureAccessResult {
  // No subscription = trial access only
  if (!subscription) {
    const trialFeatures = getPlanFeatures('trial');
    return {
      allowed: trialFeatures[feature],
      reason: trialFeatures[feature] ? undefined : 'This free-app setting is managed by Admin.',
      requiresUpgrade: false,
      currentPlan: 'trial',
      effectiveStatus: 'inactive',
    };
  }
  
  // Build effective subscription if needed
  const effectiveSub = 'effectiveStatus' in subscription 
    ? subscription 
    : buildEffectiveSubscription(subscription);
  
  // Get plan features
  const planFeatures = getPlanFeatures(effectiveSub.planType);
  const featureEnabled = planFeatures[feature];
  
  // Check feature availability for the free-app baseline. Legacy subscription
  // status should not lock core tools after the app is converted to free.
  if (!featureEnabled) {
    return {
      allowed: false,
      reason: 'This free-app setting is managed by Admin.',
      requiresUpgrade: false,
      currentPlan: effectiveSub.planType,
      effectiveStatus: effectiveSub.effectiveStatus,
    };
  }
  
  // Feature is allowed
  return {
    allowed: true,
    requiresUpgrade: false,
    currentPlan: effectiveSub.planType,
    effectiveStatus: effectiveSub.effectiveStatus,
  };
}

/**
 * Check if AI interview is accessible
 */
export function canUseAI(subscription: Subscription | EffectiveSubscription | null): boolean {
  return checkFeatureAccess(subscription, 'aiInterview').allowed;
}

/**
 * Check if PDF downloads are accessible
 */
export function canDownloadPDFs(subscription: Subscription | EffectiveSubscription | null): boolean {
  return checkFeatureAccess(subscription, 'pdfDownloads').allowed;
}

/**
 * Check if couple comparison is accessible
 */
export function canUseCoupleCompare(subscription: Subscription | EffectiveSubscription | null): boolean {
  return checkFeatureAccess(subscription, 'coupleCompare').allowed;
}

/**
 * Check if user can choose AI provider
 */
export function canChooseProvider(subscription: Subscription | EffectiveSubscription | null): boolean {
  return checkFeatureAccess(subscription, 'canChooseProvider').allowed;
}

/**
 * Check if user can choose AI model
 */
export function canChooseModel(subscription: Subscription | EffectiveSubscription | null): boolean {
  return checkFeatureAccess(subscription, 'canChooseModel').allowed;
}

// ============================================================================
// LEGACY ACCESS COMPATIBILITY
// ============================================================================

/**
 * Legacy access helper. In the free app this means the signed-in user has
 * usable account access.
 */
export function hasAccountAccess(
  subscription: Subscription | EffectiveSubscription | null
): boolean {
  if (!subscription) return false;
  
  const effectiveSub = 'effectiveStatus' in subscription 
    ? subscription 
    : buildEffectiveSubscription(subscription);
  
  return effectiveSub.hasAccess;
}

/**
 * Check if user has lifetime access
 */
export function hasLifetimeAccess(
  subscription: Subscription | EffectiveSubscription | null
): boolean {
  if (!subscription) return false;
  
  const effectiveSub = 'effectiveStatus' in subscription 
    ? subscription 
    : buildEffectiveSubscription(subscription);
  
  return effectiveSub.planType === 'lifetime' && effectiveSub.hasAccess;
}

/**
 * Check if user has active trial
 */
export function hasActiveTrial(
  subscription: Subscription | EffectiveSubscription | null
): boolean {
  if (!subscription) return true; // Default to trial for new users
  
  const effectiveSub = 'effectiveStatus' in subscription 
    ? subscription 
    : buildEffectiveSubscription(subscription);
  
  return effectiveSub.planType === 'trial' && effectiveSub.hasAccess;
}

// ============================================================================
// AI LIMITS
// ============================================================================

/**
 * Get AI limits for subscription
 */
export function getSubscriptionAiLimits(
  subscription: Subscription | EffectiveSubscription | null
) {
  if (!subscription) {
    return getPlanAiLimits('trial');
  }
  
  const effectiveSub = 'effectiveStatus' in subscription 
    ? subscription 
    : buildEffectiveSubscription(subscription);
  
  // If no access, return trial limits (most restrictive)
  if (!effectiveSub.hasAccess) {
    return getPlanAiLimits('trial');
  }
  
  return getPlanAiLimits(effectiveSub.planType);
}

// ============================================================================
// PLAN COMPARISON
// ============================================================================

/**
 * Compare two plans and determine if it's an upgrade
 */
export function isUpgrade(fromPlan: PlanType, toPlan: PlanType): boolean {
  const planHierarchy: Record<PlanType, number> = {
    anonymous: -1,
    trial: 0,
    interviewPass: 1,
    monthly: 2,
    lifetime: 3,
  };
  
  return planHierarchy[toPlan] > planHierarchy[fromPlan];
}

/**
 * Compare two plans and determine if it's a downgrade
 */
export function isDowngrade(fromPlan: PlanType, toPlan: PlanType): boolean {
  const planHierarchy: Record<PlanType, number> = {
    anonymous: -1,
    trial: 0,
    interviewPass: 1,
    monthly: 2,
    lifetime: 3,
  };
  
  return planHierarchy[toPlan] < planHierarchy[fromPlan];
}
