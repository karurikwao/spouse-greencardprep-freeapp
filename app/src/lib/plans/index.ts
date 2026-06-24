/**
 * Plan System
 * 
 * Centralized pricing and plan management system.
 * 
 * Usage:
 * ```ts
 * import { 
 *   PLAN_CONFIG, 
 *   getPlanFeatures, 
 *   isFeatureEnabled,
 *   getPlanAiLimits,
 *   checkUsageLimits 
 * } from '@/lib/plans';
 * 
 * // Check if user can use a feature
 * if (isFeatureEnabled('trial', 'pdfDownloads')) {
 *   // Allow PDF download
 * }
 * 
 * // Get AI limits
 * const limits = getPlanAiLimits('monthly');
 * 
 * // Check usage
 * const usage = checkUsageLimits('monthly');
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  PlanType,
  LegacyPlanType,
  PlanFeatures,
  FeatureKey,
  AILimits,
  PlanConfig,
  AnonymousPlanConfig,
  TrialPlanConfig,
  SubscriptionPlanConfig,
  LifetimePlanConfig,
  PassPlanConfig,
  UserSubscription,
  LegacyUserSubscription,
  SubscriptionStatus,
  PricingDisplayInfo,
  DailyUsageRecord,
  UsageCheckResult,
  AdminPlanSettings,
  AdminPlanConfig,
} from './types';

// Re-export FeatureKey for convenience (it's already exported above but let's be explicit)

// ============================================================================
// CONFIGURATION
// ============================================================================

export {
  PLAN_CONFIG,
  PLANS_ARRAY,
  PAID_PLANS,
  DISPLAY_PLANS,
  DEFAULT_SUBSCRIPTION,
  SUBSCRIPTION_STORAGE_KEY,
  TRIAL_START_KEY,
  USAGE_STORAGE_KEY,
  LEGACY_PLAN_MAP,
  PLAN_CONFIG_VERSION,
} from './config';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  // Plan retrieval
  getPlanConfig,
  getPlanDisplayName,
  getPaidPlans,
  isPaidPlan,
  isTimeLimitedPlan,
  
  // Feature access
  getPlanFeatures,
  isFeatureEnabled,
  requiresUpgrade,
  getUpgradeFeatures,
  
  // AI limits
  getPlanAiLimits,
  getMaxTurnsPerSession,
  getMaxSessionsPerDay,
  
  // Subscription management
  getUserSubscription,
  saveUserSubscription,
  isSubscriptionActive,
  isTrialExpired,
  isPassExpired,
  isSubscriptionExpired,
  getTrialDaysLeft,
  getPassDaysLeft,
  getEffectivePlan,
  upgradeSubscription,
  
  // Usage tracking
  getTodayUsage,
  checkUsageLimits,
  recordSessionStart,
  recordTurns,
  
  // Pricing display
  getPricingDisplayInfo,
  
  // Legacy compatibility
  mapLegacyPlan,
  isLegacyPlan,
  
  // Admin helpers
  createAdminPlanConfig,
  validatePlanConfig,
} from './utils';
