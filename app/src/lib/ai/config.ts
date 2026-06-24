/**
 * AI Interview Configuration
 * 
 * Central configuration for AI interview features, pricing, and usage limits.
 * All settings are future-editable through this config structure.
 * 
 * This file now integrates with the centralized plan system in @/lib/plans.
 * Legacy exports are maintained for backward compatibility.
 */

import type { AIInterviewConfig, AIProvider } from './types';
import { getDefaultInterviewModel, PROVIDER_CONFIGS } from './modelRegistry';
import { 
  PLAN_CONFIG, 
  getPlanAiLimits,
  getPlanFeatures,
  type PlanType,
} from '@/lib/plans';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const defaultModel = getDefaultInterviewModel();

/**
 * Default AI configuration
 * Note: Plan limits are now sourced from PLAN_CONFIG in @/lib/plans
 */
export const DEFAULT_AI_CONFIG: AIInterviewConfig = {
  // Feature flags
  enabled: true,
  requireAuthentication: false,
  
  // Default settings
  defaultProvider: defaultModel.provider,
  defaultModel: defaultModel.modelId,
  
  // Usage limits by plan - NOW SOURCED FROM CENTRAL PLAN CONFIG
  // These are kept for backward compatibility but delegate to plan system
  limits: {
    trial: {
      maxTurnsPerSession: PLAN_CONFIG.trial.aiLimits.maxTurnsPerSession,
      maxSessionsPerDay: PLAN_CONFIG.trial.aiLimits.maxSessionsPerDay,
    },
    basic: {
      maxTurnsPerSession: PLAN_CONFIG.monthly.aiLimits.maxTurnsPerSession,
      maxSessionsPerDay: PLAN_CONFIG.monthly.aiLimits.maxSessionsPerDay,
    },
    lifetime: {
      maxTurnsPerSession: PLAN_CONFIG.lifetime.aiLimits.maxTurnsPerSession,
      maxSessionsPerDay: PLAN_CONFIG.lifetime.aiLimits.maxSessionsPerDay,
    },
  },
  
  // Provider configs (from registry)
  providers: PROVIDER_CONFIGS,
  
  // Models (populated from registry at runtime)
  models: [],
};

// ============================================================================
// CONFIGURATION ACCESSOR
// ============================================================================

/**
 * Get the current AI configuration
 * In the future, this could fetch from Supabase or localStorage
 */
export function getAIConfig(): AIInterviewConfig {
  // TODO: Future enhancement - load from Supabase admin settings
  // const { data: adminSettings } = await supabase.from('ai_config').select('*').single();
  
  // For now, return default config with models populated
  return {
    ...DEFAULT_AI_CONFIG,
    models: [], // Populated from modelRegistry at runtime
  };
}

/**
 * Get limits for a specific plan
 * 
 * @deprecated Use getPlanAiLimits from @/lib/plans instead
 */
export function getPlanLimits(plan: 'trial' | 'basic' | 'lifetime') {
  // Map legacy plan types to new plan types
  const planMap: Record<string, PlanType> = {
    'trial': 'trial',
    'basic': 'monthly',
    'lifetime': 'lifetime',
  };
  
  const newPlan = planMap[plan] || 'trial';
  const limits = getPlanAiLimits(newPlan);
  
  return {
    maxTurnsPerSession: limits.maxTurnsPerSession,
    maxSessionsPerDay: limits.maxSessionsPerDay,
  };
}

/**
 * Get AI limits using the new plan system
 * This is the preferred method for new code
 */
export function getAILimits(plan: PlanType) {
  return getPlanAiLimits(plan);
}

/**
 * Check if AI interview is enabled
 */
export function isAIInterviewEnabled(): boolean {
  return DEFAULT_AI_CONFIG.enabled;
}

/**
 * Get default provider and model
 */
export function getDefaultAISettings(): { provider: AIProvider; modelId: string } {
  return {
    provider: DEFAULT_AI_CONFIG.defaultProvider,
    modelId: DEFAULT_AI_CONFIG.defaultModel,
  };
}

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

/**
 * Central pricing configuration
 * @deprecated These values are now defined in PLAN_CONFIG in @/lib/plans
 */
export const AI_PRICING = {
  monthly: {
    amount: PLAN_CONFIG.monthly.price,
    label: (PLAN_CONFIG.monthly as { priceLabel: string }).priceLabel,
  },
  lifetime: {
    amount: PLAN_CONFIG.lifetime.price,
    label: (PLAN_CONFIG.lifetime as { priceLabel: string }).priceLabel,
  },
} as const;

/**
 * Feature access by plan
 * @deprecated Use getPlanFeatures from @/lib/plans instead
 */
export const AI_FEATURE_ACCESS = {
  trial: {
    canUseAI: PLAN_CONFIG.trial.features.aiInterview,
    canChooseModel: PLAN_CONFIG.trial.features.canChooseModel,
    canChooseProvider: PLAN_CONFIG.trial.features.canChooseProvider,
    maxTurns: PLAN_CONFIG.trial.aiLimits.maxTurnsPerSession,
  },
  basic: {
    canUseAI: PLAN_CONFIG.monthly.features.aiInterview,
    canChooseModel: PLAN_CONFIG.monthly.features.canChooseModel,
    canChooseProvider: PLAN_CONFIG.monthly.features.canChooseProvider,
    maxTurns: PLAN_CONFIG.monthly.aiLimits.maxTurnsPerSession,
  },
  lifetime: {
    canUseAI: PLAN_CONFIG.lifetime.features.aiInterview,
    canChooseModel: PLAN_CONFIG.lifetime.features.canChooseModel,
    canChooseProvider: PLAN_CONFIG.lifetime.features.canChooseProvider,
    maxTurns: PLAN_CONFIG.lifetime.aiLimits.maxTurnsPerSession,
  },
} as const;

/**
 * New feature access using the plan system
 * Supports all plan types including interviewPass
 */
export function getAIFeatureAccess(plan: PlanType) {
  const features = getPlanFeatures(plan);
  const limits = getPlanAiLimits(plan);
  
  return {
    canUseAI: features.aiInterview,
    canChooseModel: features.canChooseModel,
    canChooseProvider: features.canChooseProvider,
    maxTurns: limits.maxTurnsPerSession,
  };
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

const USAGE_STORAGE_KEY = 'ai_interview_usage_v1';

interface UsageRecord {
  date: string;        // YYYY-MM-DD
  sessions: number;
  totalTurns: number;
}

/**
 * Get today's usage
 * @deprecated Use getTodayUsage from @/lib/plans instead
 */
export function getTodayUsage(): UsageRecord {
  const stored = localStorage.getItem(USAGE_STORAGE_KEY);
  const today = new Date().toISOString().split('T')[0];
  
  if (stored) {
    const records: UsageRecord[] = JSON.parse(stored);
    const todayRecord = records.find(r => r.date === today);
    if (todayRecord) return todayRecord;
  }
  
  return { date: today, sessions: 0, totalTurns: 0 };
}

/**
 * Check if user has exceeded daily limits
 * 
 * @deprecated Use checkUsageLimits from @/lib/plans instead
 */
export function checkUsageLimits(
  plan: 'trial' | 'basic' | 'lifetime'
): { allowed: boolean; reason?: string; remaining: number } {
  const planMap: Record<string, PlanType> = {
    'trial': 'trial',
    'basic': 'monthly',
    'lifetime': 'lifetime',
  };
  
  const newPlan = planMap[plan] || 'trial';
  const limits = getPlanAiLimits(newPlan);
  const today = getTodayUsage();
  
  if (today.totalTurns >= limits.maxTurnsPerSession) {
    return {
      allowed: false,
      reason: `Daily Robin chat limit reached (${limits.maxTurnsPerSession} per day)`,
      remaining: 0,
    };
  }
  
  return {
    allowed: true,
    remaining: Math.max(0, limits.maxTurnsPerSession - today.totalTurns),
  };
}

/**
 * Check usage limits using the new plan system
 * Supports all plan types including interviewPass
 */
export function checkAIUsageLimits(plan: PlanType): { 
  allowed: boolean; 
  reason?: string; 
  remaining: number;
  remainingTurns?: number;
} {
  const limits = getPlanAiLimits(plan);
  const today = getTodayUsage();
  
  if (today.totalTurns >= limits.maxTurnsPerSession) {
    return {
      allowed: false,
      reason: `Daily Robin chat limit reached (${limits.maxTurnsPerSession} per day)`,
      remaining: 0,
      remainingTurns: 0,
    };
  }
  
  return {
    allowed: true,
    remaining: Math.max(0, limits.maxTurnsPerSession - today.totalTurns),
    remainingTurns: Math.max(0, limits.maxTurnsPerSession - today.totalTurns),
  };
}

/**
 * Record a session start
 * @deprecated Use recordSessionStart from @/lib/plans instead
 */
export function recordSessionStart(): void {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem(USAGE_STORAGE_KEY);
  const records: UsageRecord[] = stored ? JSON.parse(stored) : [];
  
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
}

/**
 * Record turns used
 * @deprecated Use recordTurns from @/lib/plans instead
 */
export function recordTurns(turnCount: number): void {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem(USAGE_STORAGE_KEY);
  const records: UsageRecord[] = stored ? JSON.parse(stored) : [];
  
  const todayRecord = records.find(r => r.date === today);
  if (todayRecord) {
    todayRecord.totalTurns += turnCount;
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(records));
  }
}

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const AI_ERROR_MESSAGES: Record<string, { title: string; message: string; action?: string }> = {
  missing_api_key: {
    title: 'AI Not Configured',
    message: 'The AI interview feature is not fully set up yet. Please try again later or contact support.',
    action: 'Contact Support',
  },
  provider_disabled: {
    title: 'Provider Unavailable',
    message: 'This AI provider is temporarily unavailable. Please select a different provider.',
    action: 'Switch Provider',
  },
  model_unavailable: {
    title: 'Model Unavailable',
    message: 'The selected AI model is not responding. Please try a different model.',
    action: 'Switch Model',
  },
  rate_limited: {
    title: 'Too Many Requests',
    message: 'We\'re experiencing high demand. Please wait a moment and try again.',
    action: 'Try Again',
  },
  timeout: {
    title: 'Request Timed Out',
    message: 'The AI is taking longer than expected. Please try again.',
    action: 'Try Again',
  },
  usage_exceeded: {
    title: 'Daily Limit Reached',
    message: 'You\'ve reached your daily AI interview limit. Upgrade for more sessions.',
    action: 'View Plans',
  },
  upgrade_required: {
    title: 'Upgrade Required',
    message: 'This feature requires a premium plan. Upgrade to unlock all features.',
    action: 'View Plans',
  },
  network_error: {
    title: 'Connection Issue',
    message: 'Unable to reach the AI service. Please check your connection and try again.',
    action: 'Try Again',
  },
  unknown: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    action: 'Try Again',
  },
};
