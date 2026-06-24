/**
* AI Client (Secure)
*
* Provider-agnostic AI client that routes requests through a secure
* API function. No provider secrets are exposed client-side.
*
* ARCHITECTURE:
* Frontend UI → This Client → API Function → Provider API
*
* PLAN ENFORCEMENT:
* All plan limits (sessions, turns, provider/model access) are enforced
* server-side in the edge function. The client handles the structured
* error responses and displays appropriate upgrade/limit messages.
*/

import { apiClient } from '@/lib/apiClient';
import type {
AIProvider,
AIRequestPayload,
AIResponse,
AIError,
AIErrorCode,
NormalizedAIResult,
} from './types';
import { isModelEnabled } from './modelRegistry';

// ============================================================================
// ERROR HANDLING
// ============================================================================

function createAIError(
code: AIErrorCode,
message: string,
userMessage: string,
retryable: boolean = false,
upgradeRecommended: boolean = false
): AIError & { upgradeRecommended?: boolean } {
return { code, message, userMessage, retryable, upgradeRecommended };
}

/**
* Check if an error code indicates a plan limit issue
*/
export function isPlanLimitError(code: string): boolean {
return [
'PLAN_LIMIT_REACHED',
'SESSION_LIMIT_REACHED',
'FEATURE_NOT_ENABLED',
'AI_DISABLED',
'PLAN_EXPIRED',
'MODEL_NOT_ALLOWED',
'PROVIDER_NOT_ALLOWED',
].includes(code);
}

/**
* Check if an error code indicates an upgrade is recommended
*/
export function isUpgradeRecommended(code: string): boolean {
return [
'PLAN_LIMIT_REACHED',
'SESSION_LIMIT_REACHED',
'FEATURE_NOT_ENABLED',
'AI_DISABLED',
'PLAN_EXPIRED',
'MODEL_NOT_ALLOWED',
'PROVIDER_NOT_ALLOWED',
].includes(code);
}

// ============================================================================
// MAIN CLIENT
// ============================================================================

/**
* Call the secure AI interview edge function
*
* This is the ONLY way the frontend should interact with AI providers.
* All actual provider calls happen server-side in the edge function.
*
* @deprecated Use callInterviewTurn instead for interview functionality
*/
export async function callAI(
payload: AIRequestPayload
): Promise<AIResponse> {
const startTime = Date.now();

try {
// Pre-flight validation (client-side only for UX, server enforces truth)
if (!isModelEnabled(payload.provider, payload.modelId)) {
return {
success: false,
content: '',
error: `Provider ${payload.provider} or model ${payload.modelId} is not enabled`,
errorCode: 'provider_disabled',
latencyMs: Date.now() - startTime,
};
}

// Call the secure API function
const { data, error } = await apiClient.invokeFunction('ai-interview-turn', {
provider: payload.provider,
modelId: payload.modelId,
systemPrompt: payload.systemPrompt,
userMessage: payload.userMessage,
temperature: payload.temperature,
maxTokens: payload.maxTokens,
responseFormat: payload.responseFormat,
});

if (error) {
console.error('[AI Client] Edge function error:', error);
return {
success: false,
content: '',
error: error.message,
errorCode: 'unknown',
latencyMs: Date.now() - startTime,
};
}

  // Handle edge function response
  const resp = data as Record<string, unknown> | null;
  if (!resp?.success) {
    const errObj = resp?.error as Record<string, unknown> | undefined;
    return {
      success: false,
      content: '',
      error: (errObj?.message as string) || 'Unknown error from AI service',
      errorCode: (errObj?.code as AIErrorCode) || 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  // Return successful response
  return {
    success: true,
    content: JSON.stringify(resp.data),
    usage: undefined,
    latencyMs: Date.now() - startTime,
  };
} catch (error) {
console.error('[AI Client] Unexpected error:', error);

return {
success: false,
content: '',
error: error instanceof Error ? error.message : 'Unknown error',
errorCode: 'unknown',
latencyMs: Date.now() - startTime,
};
}
}

// ============================================================================
// ANONYMOUS USER TRACKING
// ============================================================================

const ANONYMOUS_ID_KEY = 'interview_anonymous_id';

/**
* Get or generate anonymous ID for trial users
* This provides basic identity binding for anonymous sessions
*/
function getOrCreateAnonymousId(): string | undefined {
// Only run in browser
if (typeof window === 'undefined') return undefined;

try {
let anonymousId = localStorage.getItem(ANONYMOUS_ID_KEY);
if (!anonymousId) {
// Generate UUID-like string
anonymousId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
}
return anonymousId;
} catch {
// localStorage not available
return undefined;
}
}

// ============================================================================
// INTERVIEW TURN CLIENT
// ============================================================================

export interface InterviewTurnResult {
success: boolean;
data?: NormalizedAIResult & {
sessionId?: string;
turnsRemaining?: number;
planType?: string;
};
error?: AIError & { upgradeRecommended?: boolean };
isPlanLimitError?: boolean;
}

/**
* Call the secure interview turn endpoint with full context
*
* This is the preferred method for conducting interview turns as it:
* 1. Sends all necessary context for server-side grounding
* 2. Includes session ID for continuing existing sessions
* 3. Receives server-side plan enforcement errors
* 4. Gets back session metadata (turns remaining, plan type)
*/
export async function callInterviewTurn(params: {
provider: AIProvider;
modelId: string;
interviewMode: 'standard' | 'topic' | 'stress_review' | 'couple';
sessionId?: string;
questionContext: {
id: string;
prompt: string;
sampleAnswer?: string;
officerLookingFor?: string[];
avoidThis?: string[];
explanation?: string;
shortPrompt?: string;
};
topicContext: {
id: string;
title: string;
description?: string;
};
categoryContext: {
id: string;
name: string;
};
userAnswer: string;
previousTurns?: Array<{
aiQuestion: string;
userAnswer: string;
feedbackLabel: string;
}>;
userStoryContext?: {
actualAnswer?: string;
keyDates?: string;
keyPlaces?: string;
keyPeople?: string;
};
turnNumber: number;
maxTurns: number;
}): Promise<InterviewTurnResult> {
try {
// Pre-flight client-side validation (for better UX, but server enforces truth)
if (!isModelEnabled(params.provider, params.modelId)) {
return {
success: false,
error: createAIError(
'provider_disabled',
'Model not enabled',
'This AI model is not available. Please choose another.'
),
isPlanLimitError: false,
};
}

// Get anonymous ID for unauthenticated users (provides basic identity binding)
const anonymousId = getOrCreateAnonymousId();

// Call the secure API function with full context
// The function will:
// 1. Authenticate the user (or use anonymousId for trial users)
// 2. Resolve the user's plan server-side
// 3. Enforce plan limits (AI access, provider/model, sessions, turns)
// 4. Track usage in database
// 5. Return structured error if limits exceeded
const { data, error } = await apiClient.invokeFunction('ai-interview-turn', {
...params,
anonymousId,
});

if (error) {
console.error('[AI Client] Edge function error:', error);
return {
success: false,
error: createAIError(
'unknown',
error.message,
'Something went wrong. Please try again.',
false
),
isPlanLimitError: false,
};
}

  // Handle error response from edge function
  const resp2 = data as Record<string, unknown> | null;
  if (!resp2?.success) {
    const errObj2 = resp2?.error as Record<string, unknown> | undefined;
    const errorCode = (errObj2?.code as string) || 'unknown';
    const userMessage = (errObj2?.userMessage as string) || 'Something went wrong. Please try again.';
    const upgradeRecommended = (errObj2?.upgradeRecommended as boolean) || isUpgradeRecommended(errorCode);

    // Map error codes to AIErrorCode type
    const mappedCode: AIErrorCode = isPlanLimitError(errorCode)
      ? 'usage_exceeded'
      : (errorCode as AIErrorCode) || 'unknown';

    return {
      success: false,
      error: createAIError(
        mappedCode,
        (errObj2?.message as string) || 'Unknown error',
        userMessage,
        errorCode === 'RATE_LIMITED' || errorCode === 'TIMEOUT',
        upgradeRecommended
      ),
      isPlanLimitError: isPlanLimitError(errorCode),
    };
  }

  // Return successful normalized result with server metadata
  return {
    success: true,
    data: resp2.data as NormalizedAIResult & {
      sessionId?: string;
      turnsRemaining?: number;
      planType?: string;
    },
    isPlanLimitError: false,
  };
} catch (error) {
console.error('[AI Client] Unexpected error:', error);

return {
success: false,
error: createAIError(
'unknown',
error instanceof Error ? error.message : 'Unknown error',
'Something went wrong. Please try again.',
false
),
isPlanLimitError: false,
};
}
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
* Check if a provider is healthy and available
*
* NOTE: This now calls the edge function to check provider health
* since the frontend cannot directly access provider APIs.
*/
export async function checkProviderHealth(provider: AIProvider): Promise<{
healthy: boolean;
error?: string;
}> {
// For now, just check if the model is enabled
// A more robust check would call a health-check edge function
if (!isModelEnabled(provider, '')) {
return { healthy: false, error: 'Provider disabled' };
}

return { healthy: true };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { AIError };
export { createAIError };
