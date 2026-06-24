/**
 * Pricing Hook
 * Manages subscription state and feature access
 * 
 * This hook now uses Supabase as the source of truth for all subscription
 * and entitlement data. It integrates the new entitlement system while
 * maintaining backward compatibility with existing components.
 * 
 * Migration notes:
 * - Supabase is the authoritative source (serverSubscription)
 * - localStorage is only used as a fallback for anonymous users
 * - AI usage is tracked server-side via useEntitlements
 */

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { PlanType, UserSubscription as LegacyUserSubscription } from '@/lib/plans';
import type { Subscription, SubscriptionStatus, PaymentProvider } from '@/lib/subscriptions/types';
import { 
  PLAN_CONFIG, 
  DEFAULT_SUBSCRIPTION,
  SUBSCRIPTION_STORAGE_KEY,
  TRIAL_START_KEY,
} from '@/lib/plans';
import { PLANS, type FeatureAccess } from '@/lib/pricing/types';
import { 
  buildEffectiveSubscription,
  getSubscriptionDisplayState,
  hasPremiumAccess,
  startCheckout,
  openManageSubscription,
  createRetentionCheckoutSession,
  cancelSubscription,
  resumeSubscription
} from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
// Import new entitlement system
import { useEntitlements, useFeatureAccess, usePlanStatus } from '@/lib/entitlements/hooks';

/**
 * Legacy subscription key for migration
 */
const LEGACY_SUBSCRIPTION_KEY = 'interview-subscription-v1';
const LEGACY_TRIAL_START_KEY = 'interview-trial-start';

/**
 * Convert legacy UserSubscription to new Subscription format
 */
function convertToNewSubscription(legacy: LegacyUserSubscription): Subscription {
  return {
    userId: '', // Will be set when user is authenticated
    planType: legacy.plan,
    status: legacy.status,
    provider: 'internal',
    providerCustomerId: null,
    providerSubscriptionId: null,
    trialStartsAt: legacy.status === 'trialing' ? legacy.createdAt : null,
    trialEndsAt: legacy.trialEnd,
    currentPeriodStartsAt: legacy.status === 'active' ? legacy.createdAt : null,
    currentPeriodEndsAt: legacy.currentPeriodEnd,
    canceledAt: null,
    endsAt: legacy.status === 'expired' ? legacy.updatedAt : null,
    lifetimeGrantedAt: legacy.plan === 'lifetime' ? legacy.createdAt : null,
    interviewPassEndsAt: legacy.passEnd,
    gracePeriodEndsAt: null,
    paymentFailedAt: null,
    paymentFailureCount: 0,
    metadata: {},
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

/**
 * Migrate legacy subscription to new format
 */
function migrateLegacySubscription(): LegacyUserSubscription | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const legacy = localStorage.getItem(LEGACY_SUBSCRIPTION_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      // Convert legacy 'basic' plan to 'monthly'
      const plan: PlanType = parsed.plan === 'basic' ? 'monthly' : parsed.plan;
      
      const migrated: LegacyUserSubscription = {
        plan,
        status: parsed.status,
        currentPeriodEnd: parsed.currentPeriodEnd,
        trialEnd: parsed.trialEnd,
        passEnd: null,
        pdfDownloadsLocked: parsed.pdfDownloadsLocked ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save to new key
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(migrated));
      
      // Remove legacy key
      localStorage.removeItem(LEGACY_SUBSCRIPTION_KEY);
      
      return migrated;
    }
  } catch (e) {
    console.error('Error migrating legacy subscription:', e);
  }
  
  return null;
}

/**
 * Migrate legacy trial start date
 */
function migrateLegacyTrialStart(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const legacy = localStorage.getItem(LEGACY_TRIAL_START_KEY);
    if (legacy) {
      // Save to new key
      localStorage.setItem(TRIAL_START_KEY, legacy);
      // Remove legacy key
      localStorage.removeItem(LEGACY_TRIAL_START_KEY);
      return legacy;
    }
  } catch (e) {
    console.error('Error migrating legacy trial start:', e);
  }
  
  return null;
}

/**
 * Fetch subscription from server (for authenticated users)
 */
async function fetchServerSubscription(userId: string): Promise<Subscription | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_effective_subscription', { p_user_id: userId });
    
    if (error || !data) {
      console.error('Failed to fetch server subscription:', error);
      return null;
    }
    
  const d = data as Record<string, unknown>;
  return {
    userId: d.user_id as string,
    planType: d.plan_type as PlanType,
    status: d.status as SubscriptionStatus,
    provider: (d.provider as PaymentProvider) || 'internal',
          providerCustomerId: null,
          providerSubscriptionId: null,
          trialStartsAt: d.trial_starts_at as string | null,
          trialEndsAt: d.trial_ends_at as string | null,
          currentPeriodStartsAt: d.current_period_starts_at as string | null,
          currentPeriodEndsAt: d.current_period_ends_at as string | null,
          canceledAt: d.canceled_at as string | null,
          endsAt: d.ends_at as string | null,
          lifetimeGrantedAt: d.lifetime_granted_at as string | null,
          interviewPassEndsAt: d.interview_pass_ends_at as string | null,
          gracePeriodEndsAt: d.grace_period_ends_at as string | null,
          paymentFailedAt: null,
          paymentFailureCount: 0,
          metadata: {},
          createdAt: (d.created_at as string) || new Date().toISOString(),
          updatedAt: (d.updated_at as string) || new Date().toISOString(),
        };
  } catch (e) {
    console.error('Error fetching server subscription:', e);
    return null;
  }
}

export function usePricing() {
  // ============================================================================
  // NEW: Supabase-backed entitlement system (source of truth)
  // ============================================================================
  const { 
    entitlements, 
    isLoading: isLoadingEntitlements, 
    error: entitlementsError,
    refresh: refreshEntitlements 
  } = useEntitlements();
  
  const planStatus = usePlanStatus();
  const pdfAccess = useFeatureAccess('pdfDownloads');
  const coupleCompareAccess = useFeatureAccess('coupleCompare');
  const aiInterviewAccess = useFeatureAccess('aiInterview');

  // ============================================================================
  // LEGACY: Local storage fallback (for anonymous users and gradual migration)
  // ============================================================================
  const migratedSubscription = useMemo(() => migrateLegacySubscription(), []);
  const migratedTrialStart = useMemo(() => migrateLegacyTrialStart(), []);

  useLocalStorage<LegacyUserSubscription>(
    SUBSCRIPTION_STORAGE_KEY,
    migratedSubscription || DEFAULT_SUBSCRIPTION
  );
  
  // Legacy trial start (kept for migration purposes, but server now tracks trials)
  const [_trialStartDate, _setTrialStartDate] = useLocalStorage<string | null>(
    TRIAL_START_KEY,
    migratedTrialStart || null
  );

  // ============================================================================
  // Server subscription state (direct Supabase query for additional metadata)
  // ============================================================================
  const [serverSubscription, setServerSubscription] = useState<Subscription | null>(null);
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  
  // Fetch server subscription for authenticated users (supplements entitlements)
  const refreshServerSubscription = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (user) {
      setIsLoadingServer(true);
      const serverSub = await fetchServerSubscription(user.id);
      if (serverSub) {
        setServerSubscription(serverSub);
      }
      setIsLoadingServer(false);
    }
  }, []);
  
  // Combined refresh that updates both entitlements and server subscription
  const refreshSubscription = useCallback(async () => {
    await refreshEntitlements();
    await refreshServerSubscription();
  }, [refreshEntitlements, refreshServerSubscription]);
  
  // Initial fetch
  useEffect(() => {
    refreshServerSubscription();
  }, [refreshServerSubscription]);
  
  // ============================================================================
  // Build effective subscription from entitlements (Supabase is source of truth)
  // ============================================================================
  
  // Convert entitlements to legacy subscription format for backward compatibility
  const subscriptionFromEntitlements = useMemo((): LegacyUserSubscription | null => {
    if (!entitlements) return null;
    
    const sub = entitlements.subscription;
    // Map status to legacy format (handle type mismatch)
    const mapStatus = (status: string): LegacyUserSubscription['status'] => {
      if (status === 'canceled') return 'canceled';
      if (status === 'expired') return 'expired';
      if (status === 'trialing') return 'trialing';
      if (status === 'active') return 'active';
      // Default other statuses (past_due, grace_period) to active for backward compatibility
      return 'active';
    };
    
    return {
      plan: sub.planType,
      status: mapStatus(sub.effectiveStatus),
      currentPeriodEnd: sub.currentPeriodEndsAt,
      trialEnd: sub.trialEndsAt,
      passEnd: sub.accessEndsAt,
      pdfDownloadsLocked: !entitlements.features.pdfDownloads.allowed,
      createdAt: sub.trialStartsAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [entitlements]);
  
  // Determine which subscription to use: entitlements (Supabase) takes priority
  // SECURITY: localStorage is NEVER used for entitlement access control
  // - If user is authenticated: entitlements from Supabase are authoritative
  // - If user is anonymous: default free-app compatibility entitlements are used
  // - localStorage is only used for non-sensitive UI preferences
  const effectiveLegacySubscription = useMemo((): LegacyUserSubscription => {
    // If we have entitlements from Supabase, use them as source of truth
    if (subscriptionFromEntitlements) {
      return subscriptionFromEntitlements;
    }
    // For anonymous users or when entitlements are loading, use default trial
    // NEVER fall back to localStorage for subscription state (prevents client-side tampering)
    return DEFAULT_SUBSCRIPTION;
  }, [subscriptionFromEntitlements]);
  
  // Convert to new subscription format
  const newFormatSubscription = useMemo(() => {
    const base = convertToNewSubscription(effectiveLegacySubscription);
    // Merge any additional server data we have
    if (serverSubscription) {
      return { ...base, ...serverSubscription };
    }
    return base;
  }, [effectiveLegacySubscription, serverSubscription]);
  
  // Build effective subscription with computed access
  const effectiveSubscription = useMemo(() => {
    return buildEffectiveSubscription(newFormatSubscription);
  }, [newFormatSubscription]);

  // ============================================================================
  // Feature access - from Supabase entitlements ONLY
  // ============================================================================
  // SECURITY: localStorage is NEVER consulted for feature access decisions
  // - Supabase entitlements are the single source of truth
  // - If entitlements are loading, default to most restrictive (trial) access
  // - This prevents client-side tampering with localStorage to unlock features
  const featureAccess: FeatureAccess = useMemo(() => {
    // If we have entitlements from Supabase, use them directly
    if (entitlements) {
      // Map new feature structure to legacy format
      return {
        pdfDownloads: entitlements.features.pdfDownloads.allowed,
        coupleCompare: entitlements.features.coupleCompare.allowed,
        aiInterview: entitlements.features.aiInterview.allowed,
        progressTracking: entitlements.features.progressTracking.allowed,
        practice: true, // Basic practice always available
        mockInterview: entitlements.features.aiInterview.allowed,
        timelineBuilder: true,
        readinessCheck: entitlements.features.readinessCheck.allowed,
        printablePacks: entitlements.features.pdfDownloads.allowed,
        futurePacks: entitlements.features.pdfDownloads.allowed,
      };
    }
    // While loading or if entitlements fail, default to the free-app baseline.
    // DO NOT use localStorage for feature access - prevents client-side tampering
    return {
      pdfDownloads: true,
      coupleCompare: true,
      aiInterview: true, // Limited AI allowed during load
      progressTracking: true, // Basic progress tracking allowed
      practice: true,
      mockInterview: true,
      timelineBuilder: true,
      readinessCheck: true, // Basic readiness check allowed
      printablePacks: true,
      futurePacks: true,
    };
  }, [entitlements]);

  // ============================================================================
  // Expiration and access checks
  // ============================================================================
  
  // Check if trial has expired - from Supabase entitlements ONLY
  const isTrialExpired = useMemo(() => {
    if (entitlements) {
      return entitlements.subscription.isExpired && entitlements.subscription.isTrial;
    }
    // Default to not expired while loading (safe default)
    return false;
  }, [entitlements]);

  // Check if pass has expired - from Supabase entitlements ONLY
  const isPassExpired = useMemo(() => {
    if (entitlements?.subscription.accessEndsAt) {
      return new Date(entitlements.subscription.accessEndsAt) < new Date();
    }
    // Default to not expired while loading (safe default)
    return false;
  }, [entitlements]);
  
  // Get display state for UI
  const displayState = useMemo(() => {
    return getSubscriptionDisplayState(effectiveSubscription);
  }, [effectiveSubscription]);

  // Legacy practice locking is retired for the free app.
  const isPracticeLocked = useMemo(() => {
    return false;
  }, []);
  
  // Legacy paid-access flag now means the signed-in account has usable free access.
  const hasPremium = useMemo(() => {
    if (entitlements) {
      return entitlements.subscription.hasAccess;
    }
    return hasPremiumAccess(effectiveSubscription);
  }, [entitlements, effectiveSubscription]);

  // Legacy upgrade callback. Paid-plan changes are retired in the free app.
  const upgradePlan = useCallback(async (plan: PlanType) => {
    console.info(`Ignoring legacy plan change to ${plan}; paid-plan upgrades are retired in the free app.`);
    await refreshEntitlements();
  }, [refreshEntitlements]);
  
  // Start checkout for a plan
  const startPlanCheckout = useCallback(async (plan: PlanType) => {
    return startCheckout(plan, {
      successUrl: `${window.location.origin}/dashboard?checkout=success`,
      cancelUrl: `${window.location.origin}/pricing?checkout=canceled`,
    });
  }, []);

  const upgradeToLifetime = useCallback(async () => {
    return startCheckout('lifetime', {
      successUrl: `${window.location.origin}/dashboard?checkout=success&plan=lifetime`,
      cancelUrl: `${window.location.origin}/dashboard?checkout=canceled`,
    });
  }, []);

  const startRetentionOffer = useCallback(async () => {
    const result = await createRetentionCheckoutSession(
      `${window.location.origin}/dashboard?checkout=success&plan=interviewPass&retention=accepted`,
      `${window.location.origin}/dashboard?retention=canceled`
    );
    if (result.success && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }
    return result;
  }, []);

  const cancelPlanRenewal = useCallback(async () => {
    const result = await cancelSubscription();
    if (result.success) {
      await refreshSubscription();
    }
    return result;
  }, [refreshSubscription]);

  const resumePlanRenewal = useCallback(async () => {
    const result = await resumeSubscription();
    if (result.success) {
      await refreshSubscription();
    }
    return result;
  }, [refreshSubscription]);
  
  // Open subscription management
  const manageSubscription = useCallback(async () => {
    return openManageSubscription();
  }, []);

  // Get days left in trial - from Supabase entitlements ONLY
  const trialDaysLeft = useMemo(() => {
    if (entitlements) {
      return entitlements.subscription.trialDaysLeft ?? entitlements.subscription.daysRemaining ?? 0;
    }
    if (planStatus.planStatus?.daysRemaining != null) {
      return planStatus.planStatus.daysRemaining;
    }
    // Default to 7 days while loading (trial default)
    return 7;
  }, [entitlements, planStatus]);

  // Get days left in pass - from Supabase entitlements ONLY
  const passDaysLeft = useMemo(() => {
    if (entitlements) {
      return entitlements.subscription.passDaysLeft ?? 0;
    }
    // Default to 0 while loading
    return 0;
  }, [entitlements]);

  // Get current plan details (from legacy PLANS for backward compatibility)
  const currentPlan = useMemo(() => {
    const plan = effectiveLegacySubscription.plan;
    return PLANS[plan];
  }, [effectiveLegacySubscription.plan]);

  // Get effective plan (considering expiration)
  const effectivePlan = useMemo(() => {
    if (entitlements) {
      return entitlements.subscription.planType;
    }
    return effectiveSubscription.planType;
  }, [entitlements, effectiveSubscription.planType]);

  // Combined loading state
  const isLoading = isLoadingEntitlements || isLoadingServer;

  return {
    // Core subscription state
    // NOTE: subscription now comes from entitlements (Supabase) when available
    subscription: effectiveLegacySubscription,
    effectiveSubscription,
    serverSubscription,
    isLoadingServer: isLoading,
    
    // NEW: Entitlements from Supabase
    entitlements,
    entitlementsError,
    
    // Feature access (legacy format for compatibility)
    featureAccess,
    
    // NEW: Individual feature access from entitlements
    featureAccessNew: {
      pdfDownloads: pdfAccess,
      coupleCompare: coupleCompareAccess,
      aiInterview: aiInterviewAccess,
    },
    
    // New display state for UI
    displayState,
    
    // Expiration status
    isTrialExpired,
    isPassExpired,
    isPracticeLocked,
    hasPremium,
    
    // Days remaining
    trialDaysLeft,
    passDaysLeft,
    
    // Plan details
    currentPlan,
    effectivePlan,
    
    // Actions
    upgradePlan,
    startPlanCheckout,
    upgradeToLifetime,
    startRetentionOffer,
    cancelPlanRenewal,
    resumePlanRenewal,
    manageSubscription,
    refreshSubscription,
    
    // Constants
    PLANS,
    PLAN_CONFIG,
  };
}

export type PricingHookReturn = ReturnType<typeof usePricing>;

// Re-export new entitlement hooks for direct use
export { useEntitlements, useFeatureAccess, usePlanStatus, useAISession } from '@/lib/entitlements/hooks';
