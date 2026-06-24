/**
 * Entitlements Types
 * 
 * Type definitions for the Supabase-backed entitlement system.
 */

// ============================================================================
// SUBSCRIPTION STATE
// ============================================================================

/**
 * Plan Types
 * 
 * - anonymous: Non-logged-in users, basic browsing only
 * - trial: Authenticated user with explicit started trial
 * - monthly: Active monthly subscription
 * - lifetime: One-time lifetime purchase
 * - interviewPass: Time-limited 90-day pass
 */
export type PlanType = 'anonymous' | 'trial' | 'monthly' | 'lifetime' | 'interviewPass';
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'expired' | 'past_due' | 'grace_period' | 'inactive';

export interface SubscriptionState {
  planType: PlanType;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  
  // Access flags
  hasAccess: boolean;
  isActive: boolean;
  isExpired: boolean;
  isTrial: boolean;
  isPaid: boolean;
  isLifetime: boolean;
  
  // Dates
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  accessEndsAt: string | null;
  
  // Days remaining
  daysRemaining: number | null;
  trialDaysLeft: number | null;
  passDaysLeft: number | null;
}

// ============================================================================
// AI USAGE
// ============================================================================

export interface AIServiceUsage {
  allowed: boolean;
  reason?: string;
  planType: PlanType;
  
  // Limits
  maxSessionsPerDay: number;
  maxTurnsPerSession: number;
  
  // Today's usage
  sessionsUsedToday: number;
  turnsUsedToday: number;
  
  // Remaining
  sessionsRemaining: number;
  turnsRemaining: number;
}

// ============================================================================
// FEATURE ACCESS
// ============================================================================

export interface FeatureAccessCheck {
  allowed: boolean;
  requiresUpgrade: boolean;
  reason?: string;
  level?: 'basic' | 'limited' | 'full';
}

export interface EntitlementCheckResult {
  allowed: boolean;
  requiresUpgrade: boolean;
  reason?: string;
  currentPlan: PlanType;
  effectiveStatus?: SubscriptionStatus;
}

// ============================================================================
// COMPLETE USER ENTITLEMENTS
// ============================================================================

export interface UserEntitlements {
  userId: string;
  userEmail: string;
  
  // Core subscription state
  subscription: SubscriptionState;
  
  // AI usage tracking
  aiUsage: AIServiceUsage;
  
  // Feature access computed from subscription
  features: {
    aiInterview: FeatureAccessCheck;
    pdfDownloads: FeatureAccessCheck;
    coupleCompare: FeatureAccessCheck;
    readinessCheck: FeatureAccessCheck;
    progressTracking: FeatureAccessCheck;
  };
}

// ============================================================================
// DISPLAY TYPES (for UI)
// ============================================================================

export interface PlanStatusDisplay {
  // Plan info
  planName: string;
  planType: PlanType;
  
  // Status
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  
  // Trial specific
  trialDaysLeft: number | null;
  isInTrial: boolean;
  
  // Pass specific
  passDaysLeft: number | null;
  isInterviewPass: boolean;
  
  // Lifetime
  isLifetime: boolean;
  
  // Upgrade prompts
  canUpgrade: boolean;
  canRenew: boolean;
}

export interface AIUsageDisplay {
  // Progress
  sessionsUsed: number;
  sessionsTotal: number;
  sessionsRemaining: number;
  
  turnsUsed: number;
  turnsTotal: number;
  turnsRemaining: number;
  
  // Status
  hasReachedLimit: boolean;
  limitReason?: string;
  
  // Plan info
  planType: PlanType;
}

// ============================================================================
// ADMIN/SUPPORT TYPES
// ============================================================================

export interface AdminUserEntitlementView {
  userId: string;
  userEmail: string;
  
  // Subscription
  planType: PlanType;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  hasAccess: boolean;
  
  // Dates
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  accessEndsAt: string | null;
  
  // AI Usage
  totalSessionsAllTime: number;
  totalTurnsAllTime: number;
  sessionsToday: number;
  turnsToday: number;
  lastSessionAt: string | null;
  
  // Features
  features: {
    aiInterview: boolean;
    pdfDownloads: boolean;
    coupleCompare: boolean;
  };
}
