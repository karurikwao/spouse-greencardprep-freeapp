/**
 * Plan Utilities
 * 
 * Helper functions for working with plans, features, and AI limits.
 * All plan-related logic should use these utilities to ensure consistency.
 */

import {
  PLAN_CONFIG,
  PAID_PLANS,
  DEFAULT_SUBSCRIPTION,
  SUBSCRIPTION_STORAGE_KEY,
  USAGE_STORAGE_KEY,
  LEGACY_PLAN_MAP,
} from './config';
import type {
  PlanType,
  LegacyPlanType,
  PlanConfig,
  PlanFeatures,
  AILimits,
  UserSubscription,
  LegacyUserSubscription,
  FeatureKey,
  DailyUsageRecord,
  UsageCheckResult,
  PricingDisplayInfo,
} from './types';

// ============================================================================
// PLAN RETRIEVAL
// ============================================================================

/**
 * Get configuration for a specific plan
 * @param plan - The plan type
 * @returns The plan configuration
 */
export function getPlanConfig(plan: PlanType): PlanConfig {
  return PLAN_CONFIG[plan];
}

/**
 * Get display name for a plan
 * @param plan - The plan type
 * @returns Human-readable plan name
 */
export function getPlanDisplayName(plan: PlanType): string {
  return PLAN_CONFIG[plan].name;
}

/**
 * Get all available purchase plans (for compatibility pages)
 * @returns Array of purchase plan configurations
 */
export function getPaidPlans(): PlanConfig[] {
  return PAID_PLANS;
}

/**
 * Check if a plan is a purchase plan
 * @param plan - The plan type
 * @returns True if the plan requires payment
 */
export function isPaidPlan(plan: PlanType): boolean {
  return plan !== 'trial';
}

/**
 * Check if a plan has a time limit (trial or pass)
 * @param plan - The plan type
 * @returns True if the plan expires after a set duration
 */
export function isTimeLimitedPlan(plan: PlanType): boolean {
  return plan === 'trial' || plan === 'interviewPass';
}

// ============================================================================
// FEATURE ACCESS
// ============================================================================

/**
 * Get feature configuration for a plan
 * @param plan - The plan type
 * @returns Feature flags for the plan
 */
export function getPlanFeatures(plan: PlanType): PlanFeatures {
  return PLAN_CONFIG[plan].features;
}

/**
 * Check if a specific feature is enabled for a plan
 * @param plan - The plan type
 * @param feature - The feature to check
 * @returns True if the feature is enabled
 * 
 * @example
 * ```ts
 * if (isFeatureEnabled('trial', 'pdfDownloads')) {
 *   // Allow PDF download
 * }
 * ```
 */
export function isFeatureEnabled(plan: PlanType, feature: FeatureKey): boolean {
  return PLAN_CONFIG[plan].features[feature];
}

/**
 * Check if a feature requires upgrade from the given plan
 * @param currentPlan - The user's current plan
 * @param feature - The feature to check
 * @returns True if the user needs to upgrade to use this feature
 */
export function requiresUpgrade(currentPlan: PlanType, feature: FeatureKey): boolean {
  return !isFeatureEnabled(currentPlan, feature);
}

/**
 * Get list of features that would be unlocked by upgrading
 * @param currentPlan - The user's current plan
 * @returns Array of feature keys that would be unlocked
 */
export function getUpgradeFeatures(currentPlan: PlanType): FeatureKey[] {
  const allFeatures: FeatureKey[] = [
    'practiceQuestions',
    'readinessCheck',
    'aiInterview',
    'pdfDownloads',
    'coupleCompare',
    'canChooseProvider',
    'canChooseModel',
  ];
  
  return allFeatures.filter(feature => requiresUpgrade(currentPlan, feature));
}

// ============================================================================
// AI LIMITS
// ============================================================================

/**
 * Get AI usage limits for a plan
 * @param plan - The plan type
 * @returns AI limits configuration
 */
export function getPlanAiLimits(plan: PlanType): AILimits {
  return PLAN_CONFIG[plan].aiLimits;
}

/**
 * Get the maximum daily Robin chats for a plan
 * @param plan - The plan type
 * @returns Maximum daily Robin chats
 */
export function getMaxTurnsPerSession(plan: PlanType): number {
  return PLAN_CONFIG[plan].aiLimits.maxTurnsPerSession;
}

/**
 * Get the legacy maximum sessions per day for a plan
 * @param plan - The plan type
 * @returns Legacy maximum sessions per day
 */
export function getMaxSessionsPerDay(plan: PlanType): number {
  return PLAN_CONFIG[plan].aiLimits.maxSessionsPerDay;
}

// ============================================================================
// USER SUBSCRIPTION
// ============================================================================

/**
 * Get user's subscription from localStorage
 * @returns The user's subscription or default subscription
 */
export function getUserSubscription(): UserSubscription {
  if (typeof window === 'undefined') {
    return DEFAULT_SUBSCRIPTION;
  }

  try {
    const stored = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UserSubscription | LegacyUserSubscription;
      
      // Handle legacy subscription format migration
      if ('passEnd' in parsed) {
        return parsed as UserSubscription;
      }
      
      // Migrate legacy subscription
      return migrateLegacySubscription(parsed as LegacyUserSubscription);
    }
  } catch (e) {
    console.error('Error loading subscription:', e);
  }

  return DEFAULT_SUBSCRIPTION;
}

/**
 * Migrate legacy subscription to new format
 * @param legacy - Legacy subscription object
 * @returns Migrated subscription
 */
function migrateLegacySubscription(legacy: LegacyUserSubscription): UserSubscription {
  return {
    plan: LEGACY_PLAN_MAP[legacy.plan] || 'trial',
    status: legacy.status,
    currentPeriodEnd: legacy.currentPeriodEnd,
    trialEnd: legacy.trialEnd,
    passEnd: null,
    pdfDownloadsLocked: legacy.pdfDownloadsLocked,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save user subscription to localStorage
 * @param subscription - The subscription to save
 */
export function saveUserSubscription(subscription: UserSubscription): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({
      ...subscription,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('Error saving subscription:', e);
  }
}

/**
 * Check if user's subscription is active
 * @param subscription - The user's subscription
 * @returns True if subscription is active or trialing
 */
export function isSubscriptionActive(subscription: UserSubscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Check if user's trial has expired
 * @param subscription - The user's subscription
 * @returns True if trial has expired
 */
export function isTrialExpired(subscription: UserSubscription): boolean {
  if (subscription.plan !== 'trial' || !subscription.trialEnd) return false;
  return new Date() > new Date(subscription.trialEnd);
}

/**
 * Check if user's interview pass has expired
 * @param subscription - The user's subscription
 * @returns True if pass has expired
 */
export function isPassExpired(subscription: UserSubscription): boolean {
  if (subscription.plan !== 'interviewPass' || !subscription.passEnd) return false;
  return new Date() > new Date(subscription.passEnd);
}

/**
 * Check if user's subscription has expired (trial or pass)
 * @param subscription - The user's subscription
 * @returns True if any time-limited plan has expired
 */
export function isSubscriptionExpired(subscription: UserSubscription): boolean {
  return isTrialExpired(subscription) || isPassExpired(subscription);
}

/**
 * Get days remaining in trial
 * @param subscription - The user's subscription
 * @returns Number of days left (0 if expired)
 */
export function getTrialDaysLeft(subscription: UserSubscription): number {
  if (!subscription.trialEnd) return (PLAN_CONFIG.trial as { durationDays: number }).durationDays;
  const end = new Date(subscription.trialEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get days remaining in interview pass
 * @param subscription - The user's subscription
 * @returns Number of days left (0 if expired)
 */
export function getPassDaysLeft(subscription: UserSubscription): number {
  if (!subscription.passEnd) return 0;
  const end = new Date(subscription.passEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get the user's effective plan type, considering expiration
 * @param subscription - The user's subscription
 * @returns The effective plan type (reverts to trial if expired)
 */
export function getEffectivePlan(subscription: UserSubscription): PlanType {
  if (isSubscriptionExpired(subscription)) {
    return 'trial';
  }
  return subscription.plan;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Get today's usage record
 * @returns Usage record for today
 */
export function getTodayUsage(): DailyUsageRecord {
  if (typeof window === 'undefined') {
    return { date: new Date().toISOString().split('T')[0], sessions: 0, totalTurns: 0 };
  }

  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    const today = new Date().toISOString().split('T')[0];
    
    if (stored) {
      const records: DailyUsageRecord[] = JSON.parse(stored);
      const todayRecord = records.find(r => r.date === today);
      if (todayRecord) return todayRecord;
    }
    
    return { date: today, sessions: 0, totalTurns: 0 };
  } catch (e) {
    console.error('Error loading usage:', e);
    return { date: new Date().toISOString().split('T')[0], sessions: 0, totalTurns: 0 };
  }
}

/**
 * Check if user has exceeded daily limits
 * @param plan - The user's plan type
 * @returns Usage check result
 */
export function checkUsageLimits(plan: PlanType): UsageCheckResult {
  const limits = getPlanAiLimits(plan);
  const today = getTodayUsage();
  
  if (today.totalTurns >= limits.maxTurnsPerSession) {
    return {
      allowed: false,
      reason: `Daily Robin chat limit reached (${limits.maxTurnsPerSession} per day)`,
      remainingSessions: 0,
      remainingTurns: 0,
    };
  }
  
  return {
    allowed: true,
    remainingSessions: Math.max(0, limits.maxSessionsPerDay - today.sessions),
    remainingTurns: Math.max(0, limits.maxTurnsPerSession - today.totalTurns),
  };
}

/**
 * Record a new session start
 */
export function recordSessionStart(): void {
  if (typeof window === 'undefined') return;
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    const records: DailyUsageRecord[] = stored ? JSON.parse(stored) : [];
    
    // Clean up old records (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split('T')[0];
    const filtered = records.filter(r => r.date >= cutoff);
    
    // Update or create today's record
    const todayRecord = filtered.find(r => r.date === today);
    if (todayRecord) {
      todayRecord.sessions += 1;
    } else {
      filtered.push({ date: today, sessions: 1, totalTurns: 0 });
    }
    
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error recording session:', e);
  }
}

/**
 * Record turns used
 * @param turnCount - Number of turns to record
 */
export function recordTurns(turnCount: number): void {
  if (typeof window === 'undefined') return;
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    const records: DailyUsageRecord[] = stored ? JSON.parse(stored) : [];
    
    const todayRecord = records.find(r => r.date === today);
    if (todayRecord) {
      todayRecord.totalTurns += turnCount;
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(records));
    }
  } catch (e) {
    console.error('Error recording turns:', e);
  }
}

// ============================================================================
// PRICING DISPLAY
// ============================================================================

/**
 * Get pricing display information for all purchase plans
 * @param currentPlan - The user's current plan
 * @returns Array of pricing display info
 */
export function getPricingDisplayInfo(currentPlan: PlanType): PricingDisplayInfo[] {
  return PAID_PLANS.map(plan => {
    const features = getPlanFeatures(plan.id);
    const includedFeatures: string[] = [];
    const excludedFeatures: string[] = [];
    
    // Build feature lists
    if (features.practiceQuestions) {
      includedFeatures.push('Unlimited practice questions');
    }
    if (features.aiInterview) {
      includedFeatures.push(`${plan.aiLimits.maxTurnsPerSession} daily Robin chats`);
    }
    if (features.readinessCheck) {
      includedFeatures.push('Unlimited readiness checks');
    }
    if (features.pdfDownloads) {
      includedFeatures.push('PDF downloads');
    }
    if (features.coupleCompare) {
      includedFeatures.push('Couple comparison');
    }
    
    return {
      id: plan.id,
      name: plan.name,
      price: plan.id === 'trial' ? 0 : (plan as { price: number }).price,
      priceLabel: plan.id === 'trial' ? 'Free' : (plan as { priceLabel: string }).priceLabel,
      description: plan.description,
      includedFeatures,
      excludedFeatures,
      isCurrentPlan: plan.id === currentPlan,
      isRecommended: plan.id === 'lifetime',
      badge: plan.id === 'lifetime' ? 'Best Value' : plan.id === 'monthly' ? 'Most Popular' : undefined,
    };
  });
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Map legacy plan type to new plan type
 * @param legacyPlan - Legacy plan type
 * @returns New plan type
 * @deprecated Use PlanType directly
 */
export function mapLegacyPlan(legacyPlan: LegacyPlanType): PlanType {
  return LEGACY_PLAN_MAP[legacyPlan] || 'trial';
}

/**
 * Check if a legacy plan string is valid
 * @param plan - Plan string to check
 * @returns True if valid legacy plan
 * @deprecated Use PlanType directly
 */
export function isLegacyPlan(plan: string): plan is LegacyPlanType {
  return plan === 'trial' || plan === 'basic' || plan === 'lifetime';
}

/**
 * Upgrade subscription to a new plan
 * @param currentSubscription - Current subscription state
 * @param newPlan - Plan to upgrade to
 * @returns Updated subscription
 */
export function upgradeSubscription(
  currentSubscription: UserSubscription,
  newPlan: PlanType
): UserSubscription {
  const now = new Date();
  let currentPeriodEnd: string | null = null;
  let trialEnd: string | null = null;
  let passEnd: string | null = null;

  if (newPlan === 'monthly') {
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    currentPeriodEnd = end.toISOString();
  } else if (newPlan === 'trial') {
    const end = new Date(now);
    end.setDate(end.getDate() + (PLAN_CONFIG.trial as { durationDays: number }).durationDays);
    trialEnd = end.toISOString();
  } else if (newPlan === 'interviewPass') {
    const end = new Date(now);
    end.setDate(end.getDate() + (PLAN_CONFIG.interviewPass as { durationDays: number }).durationDays);
    passEnd = end.toISOString();
  }

  return {
    plan: newPlan,
    status: newPlan === 'trial' ? 'trialing' : 'active',
    currentPeriodEnd,
    trialEnd,
    passEnd,
    pdfDownloadsLocked: !getPlanFeatures(newPlan).pdfDownloads,
    createdAt: currentSubscription.createdAt,
    updatedAt: now.toISOString(),
  };
}

// ============================================================================
// ADMIN HELPERS (for future admin panel)
// ============================================================================

/**
 * Create admin-editable plan settings
 * @param plan - The plan type
 * @returns Plan configuration with admin settings
 */
export function createAdminPlanConfig(plan: PlanType) {
  const config = PLAN_CONFIG[plan];
  
  return {
    ...config,
    isActive: true,
    customPrice: null,
    customAiLimits: null,
    customFeatures: null,
  };
}

/**
 * Validate a custom plan configuration
 * @param config - Custom configuration to validate
 * @returns Validation result
 */
export function validatePlanConfig(config: Partial<PlanConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.aiLimits) {
    if (config.aiLimits.maxTurnsPerSession < 1) {
      errors.push('maxTurnsPerSession must be at least 1');
    }
    if (config.aiLimits.maxSessionsPerDay < 1) {
      errors.push('maxSessionsPerDay must be at least 1');
    }
  }

  if ('price' in config && config.price !== undefined) {
    if (config.price < 0) {
      errors.push('Price cannot be negative');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

import type { TrialPlanConfig, SubscriptionPlanConfig, LifetimePlanConfig, PassPlanConfig } from './types';

/**
 * Type guard: Check if plan is a trial plan
 */
export function isTrialPlan(plan: PlanConfig): plan is TrialPlanConfig {
  return plan.id === 'trial';
}

/**
 * Type guard: Check if plan is a subscription plan (monthly)
 */
export function isSubscriptionPlan(plan: PlanConfig): plan is SubscriptionPlanConfig {
  return plan.id === 'monthly';
}

/**
 * Type guard: Check if plan is a lifetime plan
 */
export function isLifetimePlan(plan: PlanConfig): plan is LifetimePlanConfig {
  return plan.id === 'lifetime';
}

/**
 * Type guard: Check if plan is a pass plan (interview pass)
 */
export function isPassPlan(plan: PlanConfig): plan is PassPlanConfig {
  return plan.id === 'interviewPass';
}

/**
 * Type guard: Check if plan has a duration
 */
export function hasDuration(plan: PlanConfig): plan is TrialPlanConfig | PassPlanConfig {
  return plan.id === 'trial' || plan.id === 'interviewPass';
}

/**
 * Type guard: Check if plan has a price label
 */
export function hasPriceLabel(plan: PlanConfig): plan is SubscriptionPlanConfig | LifetimePlanConfig | PassPlanConfig {
  return plan.id !== 'trial';
}

/**
 * Get duration days for a plan (if applicable)
 */
export function getPlanDurationDays(plan: PlanType): number | undefined {
  const config = PLAN_CONFIG[plan];
  if (hasDuration(config)) {
    return config.durationDays;
  }
  return undefined;
}

/**
 * Get price label for a plan (if applicable)
 */
export function getPlanPriceLabel(plan: PlanType): string | undefined {
  const config = PLAN_CONFIG[plan];
  if (hasPriceLabel(config)) {
    return config.priceLabel;
  }
  return undefined;
}
