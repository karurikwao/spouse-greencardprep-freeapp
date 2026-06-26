/**
 * AI Interview System Types
 * 
 * Core type definitions for the multi-provider AI interview simulation.
 */

import type { MasterQuestion, MasterCategory, MasterTopic } from '@/lib/content';

// ============================================================================
// AI PROVIDER TYPES
// ============================================================================

export type AIProvider = 'unified' | 'minimax' | 'openai' | 'anthropic' | 'deepseek' | 'nvidia';

export interface AIModelOption {
  provider: AIProvider;
  modelId: string;
  displayName: string;
  description?: string;
  tier: 'budget' | 'standard' | 'premium';
  enabled: boolean;
  defaultForProvider?: boolean;
  defaultForInterview?: boolean;
  maxTokens?: number;
  contextWindow?: number;
}

export interface AIProviderConfig {
  provider: AIProvider;
  enabled: boolean;
  apiKeyEnvVar: string;
  defaultModel: string;
  fallbackModel?: string;
}

// ============================================================================
// INTERVIEW SESSION TYPES
// ============================================================================

export type InterviewMode = 'standard' | 'topic' | 'stress_review' | 'couple';

export interface AIInterviewSession {
  id: string;
  userId?: string;
  provider: AIProvider;
  modelId: string;
  mode: InterviewMode;
  topicId?: string;
  categoryId?: string;
  startedAt: string;
  endedAt?: string;
  turnCount: number;
  maxTurns: number;
  status: 'active' | 'paused' | 'completed' | 'error';
}

export interface AIInterviewTurn {
  id: string;
  sessionId: string;
  turnNumber: number;
  
  // Question context
  questionId?: string;
  question?: MasterQuestion;
  topic?: MasterTopic;
  category?: MasterCategory;
  
  // Interaction
  aiQuestion: string;
  userAnswer: string;
  
  // AI Response
  feedbackSummary: string;
  feedbackLabel: FeedbackLabel;
  followUpQuestion?: string;
  suggestedReviewTopics?: string[];
  suggestedQuestionIds?: string[];
  
  // Metadata
  provider: AIProvider;
  modelId: string;
  latencyMs?: number;
  tokenCount?: number;
  createdAt: string;
}

export type FeedbackLabel =
  | 'clear_and_natural'
  | 'could_use_more_detail'
  | 'worth_reviewing_together'
  | 'a_little_vague'
  | 'review_gently';

export const FEEDBACK_LABELS: Record<FeedbackLabel, { label: string; description: string; color: string }> = {
  clear_and_natural: {
    label: 'Clear and natural',
    description: 'Your answer sounds authentic and well-explained.',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  could_use_more_detail: {
    label: 'Could use more detail',
    description: 'Consider adding specific examples or dates.',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  worth_reviewing_together: {
    label: 'Worth reviewing together',
    description: 'Discuss this answer with your partner to align.',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  a_little_vague: {
    label: 'A little vague',
    description: 'Try to be more specific about details.',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  review_gently: {
    label: 'Review gently',
    description: 'This topic may need more preparation.',
    color: 'text-rose-600 bg-rose-50 border-rose-200',
  },
};

// ============================================================================
// AI REQUEST/RESPONSE TYPES
// ============================================================================

export interface AIRequestPayload {
  provider: AIProvider;
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface AIResponse {
  success: boolean;
  content: string;
  error?: string;
  errorCode?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface NormalizedAIResult {
  nextQuestion?: string;
  feedbackSummary: string;
  feedbackLabel: FeedbackLabel;
  followUpQuestion?: string;
  suggestedReviewTopics?: string[];
  suggestedQuestionIds?: string[];
  rawProvider: string;
  rawModel: string;
}

// ============================================================================
// GROUNDING CONTEXT TYPES
// ============================================================================

export interface InterviewGroundingContext {
  // Current question
  question: MasterQuestion;
  
  // Context
  topic: MasterTopic;
  category: MasterCategory;
  
  // Previous turns (for continuity)
  previousTurns?: AIInterviewTurn[];
  
  // User's personal notes (Our Story) if available
  userStoryAnswer?: {
    actualAnswer?: string;
    keyDates?: string;
    keyPlaces?: string;
    keyPeople?: string;
    evidenceNotes?: string;
  };
  
  // Related content for suggestions
  relatedQuestions?: MasterQuestion[];
  followUpQuestions?: MasterQuestion[];
  
  // Session info
  mode: InterviewMode;
  turnNumber: number;
  maxTurns: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AIInterviewConfig {
  // Feature flags
  enabled: boolean;
  requireAuthentication: boolean;
  
  // Default settings
  defaultProvider: AIProvider;
  defaultModel: string;
  
  // Usage limits by plan
  limits: {
    trial: { maxTurnsPerSession: number; maxSessionsPerDay: number };
    basic: { maxTurnsPerSession: number; maxSessionsPerDay: number };
    lifetime: { maxTurnsPerSession: number; maxSessionsPerDay: number };
  };
  
  // Provider configs
  providers: Record<AIProvider, AIProviderConfig>;
  
  // Model registry
  models: AIModelOption[];
}

// ============================================================================
// UI/STATE TYPES
// ============================================================================

export interface InterviewState {
  session: AIInterviewSession | null;
  turns: AIInterviewTurn[];
  currentTurn: AIInterviewTurn | null;
  isLoading: boolean;
  error: string | null;
  selectedProvider: AIProvider;
  selectedModel: string;
}

export interface ProviderSelectorProps {
  selectedProvider: AIProvider;
  selectedModel: string;
  onProviderChange: (provider: AIProvider) => void;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type AIErrorCode =
  | 'missing_api_key'
  | 'provider_disabled'
  | 'model_unavailable'
  | 'rate_limited'
  | 'timeout'
  | 'invalid_response'
  | 'network_error'
  | 'usage_exceeded'
  | 'unknown';

export interface AIError {
  code: AIErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
}
