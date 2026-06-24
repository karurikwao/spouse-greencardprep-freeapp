/**
* Entitlements API - API Client-backed
*
* Fetches subscription and usage data via apiClient as the authoritative source.
* Replaces localStorage-based plan/entitlement checks.
*/

import { apiClient } from '@/lib/apiClient';
import type {
  UserEntitlements,
  AIServiceUsage,
  EntitlementCheckResult,
  FeatureAccessCheck,
  PlanType,
  SubscriptionStatus,
} from './types';

/**
* Get complete user entitlements from apiClient
* This is the main entry point for checking what a user can access
*/
export async function getUserEntitlements(): Promise<{
success: boolean;
data?: UserEntitlements;
error?: string;
}> {
try {
const { data: user, error: authError } = await apiClient.auth.getUser();

if (authError) {
console.error('Error fetching user:', authError);
return {
success: false,
error: authError.message,
};
}

if (!user) {
return {
success: true,
data: getAnonymousEntitlements(),
};
}

const [subResult, aiResult] = await Promise.all([
apiClient.rpc('get_effective_subscription', { userId: user.id }),
apiClient.rpc('check_ai_usage_limits', { userId: user.id }),
]);

if (subResult.error) {
console.error('Error fetching subscription:', subResult.error);
return {
success: false,
error: 'Failed to load subscription data',
};
}

  const sub = (subResult.data as Record<string, unknown>[] | null)?.[0];
  const ai = (aiResult.data as Record<string, unknown>[] | null)?.[0];

  const hasSubscription = !!sub;
  const planType: PlanType = hasSubscription ? (sub?.plan_type as PlanType) : 'trial';
  const effectiveStatus = (hasSubscription ? sub?.effective_status : 'trialing') as string;
  const hasAccess = hasSubscription ? (sub?.has_access as boolean) : true;
  const daysRemaining = hasSubscription ? ((sub?.days_remaining as number | null) ?? null) : 7;

  const entitlements: UserEntitlements = {
    userId: user.id,
    userEmail: user.email || '',

    subscription: {
      planType,
      status: (sub?.status as SubscriptionStatus) || 'trialing',
      effectiveStatus: (effectiveStatus || 'trialing') as SubscriptionStatus,
      hasAccess: hasAccess ?? false,
      isActive: ['trialing', 'active', 'grace_period'].includes(effectiveStatus),
      isExpired: effectiveStatus === 'expired',
      isTrial: planType === 'trial',
      isPaid: hasSubscription && ['monthly', 'lifetime', 'interviewPass'].includes(planType),
      isLifetime: planType === 'lifetime',

      trialStartsAt: sub?.trial_starts_at as string | null,
      trialEndsAt: sub?.trial_ends_at as string | null,
      currentPeriodStartsAt: sub?.current_period_starts_at as string | null,
      currentPeriodEndsAt: sub?.current_period_ends_at as string | null,
      accessEndsAt: sub?.access_ends_at as string | null,

      daysRemaining,
      trialDaysLeft: planType === 'trial' ? (daysRemaining ?? 7) : null,
      passDaysLeft: planType === 'interviewPass' ? (daysRemaining ?? 0) : null,
    },

    aiUsage: hasSubscription && ai ? {
      allowed: ai.allowed as boolean,
      reason: ai.reason as string,
      planType: ai.plan_type as PlanType,
      maxSessionsPerDay: ai.max_sessions_per_day as number,
      maxTurnsPerSession: ai.max_turns_per_session as number,
      sessionsUsedToday: ai.sessions_used_today as number,
      turnsUsedToday: ai.turns_used_today as number,
      sessionsRemaining: ai.sessions_remaining as number,
      turnsRemaining: ai.turns_remaining as number,
    } : getAnonymousAIUsage(),

    features: computeFeatureAccess(planType, hasAccess ?? false),
};

return { success: true, data: entitlements };
} catch (err) {
console.error('Error in getUserEntitlements:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Check if a specific feature is accessible
*/
export async function checkFeatureAccess(
feature: 'aiInterview' | 'pdfDownloads' | 'coupleCompare' | 'readinessCheck' | 'progressTracking'
): Promise<EntitlementCheckResult> {
const { success, data, error } = await getUserEntitlements();

if (!success || !data) {
return {
allowed: false,
requiresUpgrade: true,
reason: error || 'Unable to verify access',
currentPlan: 'trial',
};
}

const featureAccess = data.features[feature];

return {
allowed: featureAccess.allowed,
requiresUpgrade: featureAccess.requiresUpgrade,
reason: featureAccess.reason,
currentPlan: data.subscription.planType,
effectiveStatus: data.subscription.effectiveStatus,
};
}

/**
* Record AI session start (authoritative server-side tracking)
*/
export async function recordAISessionStart(
provider?: string,
model?: string,
topicId?: string
): Promise<{
success: boolean;
sessionId?: string;
error?: string;
}> {
try {
const { data: user, error: authError } = await apiClient.auth.getUser();

if (authError) {
console.error('Error fetching user:', authError);
return { success: false, error: authError.message };
}

if (!user) {
return { success: false, error: 'User not authenticated' };
}

const { data, error } = await apiClient.rpc('record_ai_session_start', {
userId: user.id,
provider: provider || null,
model: model || null,
topicId: topicId || null,
});

if (error) {
console.error('Error recording AI session:', error);
return { success: false, error: error.message };
}

  return { success: true, sessionId: data as unknown as string };
} catch (err) {
console.error('Error in recordAISessionStart:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Record AI turn usage
*/
export async function recordAITurn(
sessionId: string,
turnCount: number = 1
): Promise<{ success: boolean; error?: string }> {
try {
const { data: user, error: authError } = await apiClient.auth.getUser();

if (authError) {
console.error('Error fetching user:', authError);
return { success: false, error: authError.message };
}

if (!user) {
return { success: false, error: 'User not authenticated' };
}

const { error } = await apiClient.rpc('record_ai_turn', {
userId: user.id,
sessionId,
turnCount,
});

if (error) {
console.error('Error recording AI turn:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Error in recordAITurn:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Get AI usage for display in UI
*/
export async function getAIUsageDisplay(): Promise<{
success: boolean;
data?: {
sessionsUsed: number;
sessionsTotal: number;
sessionsRemaining: number;
turnsUsed: number;
turnsTotal: number;
turnsRemaining: number;
allowed: boolean;
reason?: string;
};
error?: string;
}> {
const { success, data, error } = await getUserEntitlements();

if (!success || !data) {
return { success: false, error };
}

const { aiUsage } = data;

return {
success: true,
data: {
sessionsUsed: aiUsage.sessionsUsedToday,
sessionsTotal: aiUsage.maxSessionsPerDay,
sessionsRemaining: aiUsage.sessionsRemaining,
turnsUsed: aiUsage.turnsUsedToday,
turnsTotal: aiUsage.maxTurnsPerSession,
turnsRemaining: aiUsage.turnsRemaining,
allowed: aiUsage.allowed,
reason: aiUsage.reason,
},
};
}

/**
* Start trial for new user
*/
export async function startTrial(): Promise<{
success: boolean;
error?: string;
}> {
try {
const { data: user, error: authError } = await apiClient.auth.getUser();

if (authError) {
console.error('Error fetching user:', authError);
return { success: false, error: authError.message };
}

if (!user) {
return { success: false, error: 'User not authenticated' };
}

const trialEndsAt = new Date();
trialEndsAt.setDate(trialEndsAt.getDate() + 7);

const { error } = await apiClient.rpc('create_or_update_subscription', {
userId: user.id,
planType: 'trial',
status: 'trialing',
trialEndsAt: trialEndsAt.toISOString(),
});

if (error) {
console.error('Error starting trial:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Error in startTrial:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
* Anonymous users - basic browsing only
*
* Explicitly NOT a trial. Anonymous users can browse but cannot:
* - Use AI interview
* - Download PDFs
* - Use Couple Compare
* - Track progress persistently
*/
function getAnonymousEntitlements(): UserEntitlements {
return {
userId: '',
userEmail: '',
subscription: {
planType: 'anonymous',
status: 'inactive',
effectiveStatus: 'inactive',
hasAccess: false,
isActive: false,
isExpired: false,
isTrial: false,
isPaid: false,
isLifetime: false,
daysRemaining: null,
trialDaysLeft: null,
passDaysLeft: null,
trialStartsAt: null,
trialEndsAt: null,
currentPeriodStartsAt: null,
currentPeriodEndsAt: null,
accessEndsAt: null,
},
aiUsage: getAnonymousAIUsage(),
features: computeFeatureAccess('anonymous', false),
};
}

/**
* Anonymous AI usage - completely disabled
*/
function getAnonymousAIUsage(): AIServiceUsage {
return {
allowed: false,
reason: 'Sign up for free to practice with Robin',
planType: 'anonymous',
maxSessionsPerDay: 0,
maxTurnsPerSession: 0,
sessionsUsedToday: 0,
turnsUsedToday: 0,
sessionsRemaining: 0,
turnsRemaining: 0,
};
}

/**
* Free account entitlements for authenticated users.
*
* The legacy plan_type remains "trial" for database compatibility, but this is
* now the free app baseline rather than a paid-plan trial.
*/
// @ts-expect-error Function may be used in future implementations
function getDefaultTrialEntitlements(): UserEntitlements {
return {
userId: '',
userEmail: '',
subscription: {
planType: 'trial',
status: 'trialing',
effectiveStatus: 'trialing',
hasAccess: true,
isActive: true,
isExpired: false,
isTrial: true,
isPaid: false,
isLifetime: false,
daysRemaining: 7,
trialDaysLeft: 7,
passDaysLeft: null,
trialStartsAt: null,
trialEndsAt: null,
currentPeriodStartsAt: null,
currentPeriodEndsAt: null,
accessEndsAt: null,
},
aiUsage: getDefaultTrialAIUsage(),
features: computeFeatureAccess('trial', true),
};
}

function getDefaultTrialAIUsage(): AIServiceUsage {
return {
allowed: true,
reason: undefined,
planType: 'trial',
maxSessionsPerDay: 1,
maxTurnsPerSession: 5,
sessionsUsedToday: 0,
turnsUsedToday: 0,
sessionsRemaining: 1,
turnsRemaining: 5,
};
}

function computeFeatureAccess(
planType: string,
hasAccess: boolean
): { aiInterview: FeatureAccessCheck; pdfDownloads: FeatureAccessCheck; coupleCompare: FeatureAccessCheck; readinessCheck: FeatureAccessCheck; progressTracking: FeatureAccessCheck } {

if (planType === 'anonymous') {
return {
aiInterview: {
allowed: false,
requiresUpgrade: true,
reason: 'Sign up for free to practice with Robin'
},
pdfDownloads: {
allowed: false,
requiresUpgrade: true,
reason: 'Sign in to download free PDF guides'
},
coupleCompare: {
allowed: false,
requiresUpgrade: true,
reason: 'Sign in to use partner sync and couple comparison'
},
readinessCheck: {
allowed: true,
requiresUpgrade: false,
level: 'basic'
},
progressTracking: {
allowed: true,
requiresUpgrade: false,
level: 'basic'
},
};
}

if (!hasAccess) {
return {
aiInterview: { allowed: true, requiresUpgrade: false, level: 'limited' },
pdfDownloads: { allowed: true, requiresUpgrade: false, level: 'full' },
coupleCompare: { allowed: true, requiresUpgrade: false, level: 'full' },
readinessCheck: { allowed: true, requiresUpgrade: false, level: 'full' },
progressTracking: { allowed: true, requiresUpgrade: false, level: 'basic' },
};
}

const isLegacyPaidPlan = ['monthly', 'lifetime', 'interviewPass'].includes(planType);

return {
aiInterview: {
allowed: true,
requiresUpgrade: false,
level: isLegacyPaidPlan ? 'full' : 'limited',
},
pdfDownloads: {
allowed: true,
requiresUpgrade: false,
level: 'full',
},
coupleCompare: {
allowed: true,
requiresUpgrade: false,
level: 'full',
},
readinessCheck: {
allowed: true,
requiresUpgrade: false,
level: isLegacyPaidPlan ? 'full' : 'basic',
},
progressTracking: {
allowed: true,
requiresUpgrade: false,
level: isLegacyPaidPlan ? 'full' : 'basic',
},
};
}
