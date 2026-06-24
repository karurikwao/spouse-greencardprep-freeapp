/**
 * Plan System Types
 * 
 * Central type definitions for the pricing and plan system.
 * These types define the structure for all plan-related data.
 */

// ============================================================================
// PLAN TYPE DEFINITIONS
// ============================================================================

/**
 * Available plan types
 * 
 * - anonymous: Non-logged-in users, basic browsing only
 * - trial: Authenticated user with explicit started trial
 * - monthly: Active monthly subscription
 * - lifetime: One-time lifetime purchase
 * - interviewPass: Time-limited 90-day pass
 */
export type PlanType = 
  | 'anonymous'
  | 'trial' 
  | 'monthly' 
  | 'lifetime' 
  | 'interviewPass';

/**
 * Legacy plan type for backward compatibility
 * @deprecated Use PlanType instead
 */
export type LegacyPlanType = 'trial' | 'basic' | 'lifetime';

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Feature flags for plan capabilities
 */
export interface PlanFeatures {
  /** Access to practice questions */
  practiceQuestions: boolean;
  /** Access to readiness check */
  readinessCheck: boolean;
  /** Access to AI interview simulation */
  aiInterview: boolean;
  /** PDF downloads enabled */
  pdfDownloads: boolean;
  /** Couple comparison feature */
  coupleCompare: boolean;
  /** Can choose AI provider */
  canChooseProvider: boolean;
  /** Can choose AI model */
  canChooseModel: boolean;
}

/**
 * Feature key type for type-safe feature checking
 */
export type FeatureKey = keyof PlanFeatures;

// ============================================================================
// AI LIMITS
// ============================================================================

/**
 * AI usage limits for a plan
 */
export interface AILimits {
  /** Maximum Robin chats per day */
  maxTurnsPerSession: number;
  /** Legacy session field kept for compatibility; daily chat limit is authoritative */
  maxSessionsPerDay: number;
}

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

/**
 * Base plan configuration interface
 */
export interface BasePlanConfig {
  /** Plan identifier */
  id: PlanType;
  /** Display name */
  name: string;
  /** Plan description */
  description: string;
  /** Plan features */
  features: PlanFeatures;
  /** AI usage limits */
  aiLimits: AILimits;
}

/**
 * Anonymous/basic plan configuration
 */
export interface AnonymousPlanConfig extends BasePlanConfig {
  id: 'anonymous';
  /** No duration for anonymous */
  durationDays: number;
  /** Price is always 0 for anonymous */
  price: 0;
}

/**
 * Free trial plan configuration
 */
export interface TrialPlanConfig extends BasePlanConfig {
  id: 'trial';
  /** Trial duration in days */
  durationDays: number;
  /** Price is always 0 for trial */
  price: 0;
}

/**
 * Subscription plan configuration (monthly)
 */
export interface SubscriptionPlanConfig extends BasePlanConfig {
  id: 'monthly';
  /** Price per billing interval */
  price: number;
  /** Billing interval */
  billingInterval: 'month';
  /** Price display label */
  priceLabel: string;
}

/**
 * One-time purchase plan configuration (lifetime)
 */
export interface LifetimePlanConfig extends BasePlanConfig {
  id: 'lifetime';
  /** One-time price */
  price: number;
  /** Price display label */
  priceLabel: string;
}

/**
 * Time-limited pass plan configuration (interview pass)
 */
export interface PassPlanConfig extends BasePlanConfig {
  id: 'interviewPass';
  /** Pass price */
  price: number;
  /** Pass duration in days */
  durationDays: number;
  /** Price display label */
  priceLabel: string;
}

/**
 * Union type for all plan configurations
 */
export type PlanConfig = 
  | AnonymousPlanConfig
  | TrialPlanConfig 
  | SubscriptionPlanConfig 
  | LifetimePlanConfig 
  | PassPlanConfig;

// ============================================================================
// USER SUBSCRIPTION
// ============================================================================

/**
 * Subscription status
 */
export type SubscriptionStatus = 
  | 'trialing' 
  | 'active' 
  | 'expired' 
  | 'canceled';

/**
 * User's subscription state
 */
export interface UserSubscription {
  /** Current plan type */
  plan: PlanType;
  /** Subscription status */
  status: SubscriptionStatus;
  /** When the current period ends (for subscriptions) */
  currentPeriodEnd: string | null;
  /** When the trial ends (for trials) */
  trialEnd: string | null;
  /** When the pass expires (for interview pass) */
  passEnd: string | null;
  /** Legacy flag for PDF downloads (backward compatibility) */
  pdfDownloadsLocked: boolean;
  /** When the subscription was created */
  createdAt: string;
  /** When the subscription was last updated */
  updatedAt: string;
}

/**
 * Legacy user subscription for backward compatibility
 * @deprecated Use UserSubscription instead
 */
export interface LegacyUserSubscription {
  plan: LegacyPlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  pdfDownloadsLocked: boolean;
}

// ============================================================================
// PRICING DISPLAY
// ============================================================================

/**
 * Pricing display information
 */
export interface PricingDisplayInfo {
  /** Plan ID */
  id: PlanType;
  /** Display name */
  name: string;
  /** Price amount */
  price: number;
  /** Price display label */
  priceLabel: string;
  /** Description */
  description: string;
  /** List of included features */
  includedFeatures: string[];
  /** List of excluded features */
  excludedFeatures: string[];
  /** Badge text (e.g., "Best Value", "Popular") */
  badge?: string;
  /** Whether this is the current plan */
  isCurrentPlan: boolean;
  /** Whether this plan is recommended */
  isRecommended: boolean;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Daily usage record
 */
export interface DailyUsageRecord {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Number of sessions today */
  sessions: number;
  /** Total turns used today */
  totalTurns: number;
}

/**
 * Usage check result
 */
export interface UsageCheckResult {
  /** Whether usage is within limits */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Remaining sessions today (legacy compatibility) */
  remainingSessions: number;
  /** Remaining Robin chats today */
  remainingTurns?: number;
}

// ============================================================================
// ADMIN/CONFIGURATION
// ============================================================================

/**
 * Admin-editable plan settings (for future admin panel)
 */
export interface AdminPlanSettings {
  /** Whether this plan is active and available for purchase */
  isActive: boolean;
  /** Custom price override (null to use default) */
  customPrice: number | null;
  /** Custom AI limits override (null to use default) */
  customAiLimits: AILimits | null;
  /** Custom features override (null to use default) */
  customFeatures: Partial<PlanFeatures> | null;
}

/**
 * Complete plan configuration for admin
 */
export type AdminPlanConfig = PlanConfig & AdminPlanSettings;
