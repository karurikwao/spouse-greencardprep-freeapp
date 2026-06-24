/**
 * AI Interview System
 * 
 * Multi-provider AI interview simulation for marriage-based green card preparation.
 * 
 * Usage:
 * ```ts
 * import { 
 *   createInterviewSession, 
 *   conductTurn, 
 *   getEnabledModels,
 *   isProviderEnabled 
 * } from '@/lib/ai';
 * 
 * // Create a session
 * const session = createInterviewSession({
 *   provider: 'openai',
 *   modelId: 'gpt-5-mini',
 *   mode: 'standard',
 * });
 * 
 * // Conduct a turn
 * const { turn, result } = await conductTurn({
 *   session,
 *   question,
 *   topic,
 *   category,
 * });
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  AIProvider,
  AIModelOption,
  AIProviderConfig,
  InterviewMode,
  AIInterviewSession,
  AIInterviewTurn,
  FeedbackLabel,
  AIRequestPayload,
  AIResponse,
  NormalizedAIResult,
  InterviewGroundingContext,
  AIInterviewConfig,
  InterviewState,
  ProviderSelectorProps,
  AIErrorCode,
  AIError,
} from './types';

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export {
  REGISTERED_MODELS,
  PROVIDER_CONFIGS,
  getEnabledModels,
  getEnabledProviders,
  getModelsForProvider,
  getModelById,
  getDefaultModelForProvider,
  getDefaultInterviewModel,
  isProviderEnabled,
  getProviderConfig,
  getProviderApiKey,
  hasApiKey,
  validateModelSelection,
  getRecommendedModel,
} from './modelRegistry';

// ============================================================================
// CONFIGURATION
// ============================================================================

export {
  DEFAULT_AI_CONFIG,
  AI_PRICING,
  AI_FEATURE_ACCESS,
  getAIConfig,
  getPlanLimits,
  getAILimits,
  getAIFeatureAccess,
  checkAIUsageLimits,
  isAIInterviewEnabled,
  getDefaultAISettings,
  getTodayUsage,
  checkUsageLimits,
  recordSessionStart,
  recordTurns,
  AI_ERROR_MESSAGES,
} from './config';

// ============================================================================
// PROMPTS
// ============================================================================

export {
  buildSystemPrompt,
  buildInterviewPrompt,
  buildFollowUpPrompt,
  buildFeedbackPrompt,
  getTopicGuidance,
  INTERVIEW_RESPONSE_SCHEMA,
  getFallbackResponse,
  getErrorResponse,
} from './prompts';

// ============================================================================
// CLIENT
// ============================================================================

export {
  callAI,
  callInterviewTurn,
  checkProviderHealth,
  createAIError,
  isPlanLimitError,
  isUpgradeRecommended,
} from './client';

// ============================================================================
// INTERVIEW ENGINE
// ============================================================================

export {
  createInterviewSession,
  selectInitialQuestion,
  conductTurn,
  saveSession,
  loadSession,
  clearSession,
  completeSession,
  isSessionComplete,
  getSessionSummary,
} from './interviewEngine';

// ============================================================================
// CONSTANTS
// ============================================================================

export { FEEDBACK_LABELS } from './types';
