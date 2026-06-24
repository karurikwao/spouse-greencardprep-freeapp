/**
 * Plan Configuration
 * 
 * Central compatibility configuration for legacy plan definitions.
 * 
 * The app now uses a free baseline. Legacy paid plan records remain here so old
 * subscription rows and imports keep compiling, but public purchase flows are
 * retired and optional Robin credit packs should be configured in Admin.
 */

import type {
  PlanType,
  PlanConfig,
  AnonymousPlanConfig,
  TrialPlanConfig,
  SubscriptionPlanConfig,
  LifetimePlanConfig,
  PassPlanConfig,
  AILimits,
  PlanFeatures,
} from './types';

// ============================================================================
// DEFAULT AI LIMITS BY TIER
// ============================================================================

/**
 * Free baseline AI limits. Admin Robin settings are authoritative at runtime.
 */
const LOW_AI_LIMITS: AILimits = {
  maxTurnsPerSession: 5,
  maxSessionsPerDay: 1,
};

/**
 * Legacy medium-tier AI limits.
 */
const MEDIUM_AI_LIMITS: AILimits = {
  maxTurnsPerSession: 20,
  maxSessionsPerDay: 1,
};

/**
 * Legacy high-tier AI limits.
 */
const HIGH_AI_LIMITS: AILimits = {
  maxTurnsPerSession: 20,
  maxSessionsPerDay: 1,
};

/**
 * Legacy high-tier AI limits.
 */
const UNLIMITED_AI_LIMITS: AILimits = {
  maxTurnsPerSession: 30,
  maxSessionsPerDay: 1,
};

// ============================================================================
// DEFAULT FEATURE SETS
// ============================================================================

/**
 * Free account features.
 */
const TRIAL_FEATURES: PlanFeatures = {
  practiceQuestions: true,
  readinessCheck: true,
  aiInterview: true,
  pdfDownloads: true,
  coupleCompare: true,
  canChooseProvider: false,
  canChooseModel: false,
};

/**
 * Legacy paid-plan features. Kept for compatibility with old rows only.
 */
const PREMIUM_FEATURES: PlanFeatures = {
  practiceQuestions: true,
  readinessCheck: true,
  aiInterview: true,
  pdfDownloads: true,
  coupleCompare: true,
  canChooseProvider: true,
  canChooseModel: true,
};

// ============================================================================
// PLAN CONFIGURATIONS
// ============================================================================

/**
 * Free Account Plan
 * - Core tools included
 * - Robin usage controlled by Admin daily limits
 * - PDF downloads and partner comparison included for signed-in users
 */
const TRIAL_CONFIG: TrialPlanConfig = {
  id: 'trial',
  name: 'Free Account',
  description: 'Use the core preparation tools for free with Admin-set Robin daily limits.',
  price: 0,
  durationDays: 7,
  aiLimits: LOW_AI_LIMITS,
  features: TRIAL_FEATURES,
};

/**
 * Monthly Premium Plan
 * - $19.99/month
 * - Unlimited practice
 * - Full AI interview access
 * - All features enabled
 */
const MONTHLY_CONFIG: SubscriptionPlanConfig = {
  id: 'monthly',
  name: 'Premium Monthly',
  description: 'Full access with 20 daily Robin chats and all features',
  price: 19.99,
  billingInterval: 'month',
  priceLabel: '$19.99/month',
  aiLimits: HIGH_AI_LIMITS,
  features: PREMIUM_FEATURES,
};

/**
 * Lifetime Plan
 * - $79.99 one-time
 * - Same features as the legacy paid tier
 * - Highest AI limits
 * - Best value
 */
const LIFETIME_CONFIG: LifetimePlanConfig = {
  id: 'lifetime',
  name: 'Lifetime Access',
  description: 'Full access forever with 30 daily Robin chats - best value',
  price: 79.99,
  priceLabel: '$79.99 one-time',
  aiLimits: UNLIMITED_AI_LIMITS,
  features: PREMIUM_FEATURES,
};

/**
 * 90-Day Interview Pass
 * - $39.99 one-time
 * - 90 days duration
 * - Same features as the legacy paid tier
 * - Medium AI limits
 */
const INTERVIEW_PASS_CONFIG: PassPlanConfig = {
  id: 'interviewPass',
  name: '90-Day Interview Pass',
  description: 'Full access for 90 days - perfect for upcoming interviews',
  price: 39.99,
  durationDays: 90,
  priceLabel: '$39.99 for 90 days',
  aiLimits: MEDIUM_AI_LIMITS,
  features: PREMIUM_FEATURES,
};

/**
 * Anonymous/Basic Plan
 * - No authentication required
 * - Browse questions only
 * - Sign-in required for PDFs, Robin, and partner features
 * - Used for non-logged-in visitors
 */
const ANONYMOUS_CONFIG: AnonymousPlanConfig = {
  id: 'anonymous',
  name: 'Basic Access',
  description: 'Browse questions and topics. Sign up for full access.',
  price: 0,
  durationDays: 0,
  aiLimits: { maxTurnsPerSession: 0, maxSessionsPerDay: 0 },
  features: TRIAL_FEATURES, // Same restrictions as trial
};

// ============================================================================
// CENTRAL PLAN CONFIGURATION EXPORT
// ============================================================================

/**
 * Central plan configuration object.
 * This is the single source of truth for all plan definitions.
 */
export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  anonymous: ANONYMOUS_CONFIG,
  trial: TRIAL_CONFIG,
  monthly: MONTHLY_CONFIG,
  lifetime: LIFETIME_CONFIG,
  interviewPass: INTERVIEW_PASS_CONFIG,
};

/**
 * Array of all plans in display order
 */
export const PLANS_ARRAY: PlanConfig[] = [
  ANONYMOUS_CONFIG,
  TRIAL_CONFIG,
  MONTHLY_CONFIG,
  LIFETIME_CONFIG,
  INTERVIEW_PASS_CONFIG,
];

/**
 * Public-facing paid plans. Empty while the free-app conversion is active.
 */
export const PAID_PLANS: PlanConfig[] = [
];

/**
 * Display order for legacy pricing surfaces.
 */
export const DISPLAY_PLANS: PlanConfig[] = [
  TRIAL_CONFIG,
];

// ============================================================================
// DEFAULT SUBSCRIPTION STATE
// ============================================================================

/**
 * Default subscription for new users
 */
export const DEFAULT_SUBSCRIPTION = {
  plan: 'trial' as PlanType,
  status: 'trialing' as const,
  currentPeriodEnd: null,
  trialEnd: null,
  passEnd: null,
  pdfDownloadsLocked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// LEGACY MAPPING (for backward compatibility)
// ============================================================================

/**
 * Maps legacy 'basic' plan to new 'monthly' plan
 * @deprecated Use PlanType directly
 */
export const LEGACY_PLAN_MAP: Record<string, PlanType> = {
  'basic': 'monthly',
  'trial': 'trial',
  'lifetime': 'lifetime',
};

// ============================================================================
// CONFIGURATION VERSION (for future migrations)
// ============================================================================

/**
 * Current configuration version
 * Increment when making breaking changes to plan structure
 */
export const PLAN_CONFIG_VERSION = '2.0.0';

/**
 * Storage key for subscription data
 */
export const SUBSCRIPTION_STORAGE_KEY = 'interview-subscription-v2';

/**
 * Storage key for trial start date
 */
export const TRIAL_START_KEY = 'interview-trial-start-v2';

/**
 * Storage key for usage data
 */
export const USAGE_STORAGE_KEY = 'ai-interview-usage-v2';
