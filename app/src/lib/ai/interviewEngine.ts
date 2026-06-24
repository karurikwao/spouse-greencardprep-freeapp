/**
 * AI Interview Engine
 * 
 * Core engine for conducting AI-powered mock interviews.
 * All AI calls are routed through the secure edge function.
 * 
 * SECURITY: No provider API calls happen from this file.
 * All external calls go through callInterviewTurn() in client.ts
 */

import { callInterviewTurn } from './client';

import type {
  AIInterviewSession,
  AIInterviewTurn,
  InterviewMode,
  AIProvider,
  FeedbackLabel,
  NormalizedAIResult,
} from './types';
import type { MasterQuestion, MasterTopic, MasterCategory } from '@/lib/content';
import { 
  getRandomQuestions, 
  getQuestionsByTopic,
  getTopicForQuestion,
  getCategoryForQuestion,
} from '@/lib/content';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new interview session
 */
export function createInterviewSession(params: {
  provider: AIProvider;
  modelId: string;
  mode: InterviewMode;
  topicId?: string;
  categoryId?: string;
  maxTurns?: number;
  userId?: string;
}): AIInterviewSession {
  return {
    id: generateSessionId(),
    userId: params.userId,
    provider: params.provider,
    modelId: params.modelId,
    mode: params.mode,
    topicId: params.topicId,
    categoryId: params.categoryId,
    startedAt: new Date().toISOString(),
    turnCount: 0,
    maxTurns: params.maxTurns ?? getDefaultMaxTurns(params.mode),
    status: 'active',
  };
}

/**
 * Get default max turns based on mode
 */
function getDefaultMaxTurns(mode: InterviewMode): number {
  switch (mode) {
    case 'standard':
      return 10;
    case 'topic':
      return 15;
    case 'stress_review':
      return 8;
    case 'couple':
      return 12;
    default:
      return 10;
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// QUESTION SELECTION
// ============================================================================

/**
 * Select the initial question for a session
 */
export function selectInitialQuestion(
  mode: InterviewMode,
  topicId?: string,
  usedQuestionIds: string[] = []
): { question: MasterQuestion; topic: MasterTopic; category: MasterCategory } | null {
  let candidates: MasterQuestion[] = [];
  
  switch (mode) {
    case 'topic':
      if (topicId) {
        candidates = getQuestionsByTopic(topicId);
      }
      break;
    
    case 'stress_review':
      // For stress review, select from sensitive/high anxiety questions
      candidates = getRandomQuestions(20, usedQuestionIds)
        .filter(q => q.anxietyTag === 'high' || q.anxietyTag === 'sensitive');
      break;
    
    case 'couple':
      // For couple mode, select questions good for both partners
      candidates = getRandomQuestions(20, usedQuestionIds);
      break;
    
    case 'standard':
    default:
      // Mix of featured questions from different categories
      candidates = getRandomQuestions(30, usedQuestionIds);
      break;
  }
  
  // Filter out already used questions
  candidates = candidates.filter(q => !usedQuestionIds.includes(q.id));
  
  if (candidates.length === 0) {
    // Fallback to any random question
    const random = getRandomQuestions(1, usedQuestionIds);
    if (random.length > 0) {
      candidates = random;
    } else {
      return null;
    }
  }
  
  // Select first available question
  const question = candidates[0];
  const topic = getTopicForQuestion(question);
  const category = getCategoryForQuestion(question);
  
  if (!topic || !category) {
    return null;
  }
  
  return { question, topic, category };
}

// ============================================================================
// AI INTERACTION (Secure)
// ============================================================================

/**
 * Conduct a single interview turn
 * 
 * SECURITY: This function calls the secure edge function.
 * No provider API calls happen client-side.
 * 
 * PLAN ENFORCEMENT: Server-side plan limits are enforced by the edge function.
 * If limits are exceeded, the function returns an error with upgradeRecommended flag.
 */
export async function conductTurn(params: {
  session: AIInterviewSession;
  question: MasterQuestion;
  topic: MasterTopic;
  category: MasterCategory;
  previousTurns?: AIInterviewTurn[];
  userAnswer?: string;
}): Promise<{ 
  turn: AIInterviewTurn; 
  result: NormalizedAIResult;
  serverSessionId?: string;
  turnsRemaining?: number;
  error?: { message: string; upgradeRecommended?: boolean; isPlanLimitError?: boolean };
}> {
  const { session, question, topic, category, previousTurns = [], userAnswer } = params;
  
  const turnNumber = previousTurns.length + 1;
  
  // Get server session ID from previous turn if available
  const serverSessionId = previousTurns.length > 0 
    ? (previousTurns[0] as AIInterviewTurn & { serverSessionId?: string }).serverSessionId
    : undefined;
  
  // Build context for the edge function
  const requestParams = {
    provider: session.provider,
    modelId: session.modelId,
    interviewMode: session.mode,
    sessionId: serverSessionId, // Pass server session ID for continuing sessions
    questionContext: {
      id: question.id,
      prompt: question.prompt,
      sampleAnswer: question.sampleAnswer,
      officerLookingFor: question.officerLookingFor,
      avoidThis: question.avoidThis,
      explanation: question.explanation,
      shortPrompt: question.shortPrompt,
    },
    topicContext: {
      id: topic.id,
      title: topic.title,
      description: topic.description,
    },
    categoryContext: {
      id: category.id,
      name: category.name,
    },
    userAnswer: userAnswer || '',
    previousTurns: previousTurns.map(t => ({
      aiQuestion: t.aiQuestion,
      userAnswer: t.userAnswer,
      feedbackLabel: t.feedbackLabel,
    })),
    turnNumber,
    maxTurns: session.maxTurns,
  };
  
  // Call secure edge function
  const response = await callInterviewTurn(requestParams);
  
  // Handle plan enforcement errors
  if (!response.success || !response.data) {
    console.error('[InterviewEngine] AI call failed:', response.error);
    
    // Check if this is a plan limit error
    const isPlanLimitError = response.isPlanLimitError || false;
    const upgradeRecommended = response.error?.upgradeRecommended || false;
    
    return { 
      turn: null as unknown as AIInterviewTurn,
      result: null as unknown as NormalizedAIResult,
      error: {
        message: response.error?.userMessage || 'Something went wrong. Please try again.',
        upgradeRecommended,
        isPlanLimitError,
      }
    };
  }
  
  // Build turn from successful response
  const result = response.data;
  const turn: AIInterviewTurn & { serverSessionId?: string } = {
    id: generateTurnId(),
    sessionId: session.id,
    serverSessionId: result.sessionId, // Store server session ID for continuity
    turnNumber,
    questionId: question.id,
    question,
    topic,
    category,
    aiQuestion: turnNumber === 1 ? question.prompt : previousTurns[previousTurns.length - 1]?.followUpQuestion || question.prompt,
    userAnswer: userAnswer || '',
    feedbackSummary: result.feedbackSummary,
    feedbackLabel: result.feedbackLabel,
    followUpQuestion: result.followUpQuestion,
    suggestedReviewTopics: result.suggestedReviewTopics,
    suggestedQuestionIds: result.suggestedQuestionIds,
    provider: session.provider,
    modelId: session.modelId,
    createdAt: new Date().toISOString(),
  };
  
  return { 
    turn, 
    result,
    serverSessionId: result.sessionId,
    turnsRemaining: result.turnsRemaining,
  };
}

/**
 * Generate a unique turn ID
 */
function generateTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// SESSION STATE MANAGEMENT
// ============================================================================

const SESSION_STORAGE_KEY = 'ai_interview_current_session';
const TURNS_STORAGE_KEY = 'ai_interview_current_turns';

/**
 * Save session to localStorage
 */
export function saveSession(session: AIInterviewSession, turns: AIInterviewTurn[]): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(TURNS_STORAGE_KEY, JSON.stringify(turns));
  } catch (e) {
    console.error('[InterviewEngine] Failed to save session:', e);
  }
}

/**
 * Load session from localStorage
 */
export function loadSession(): { session: AIInterviewSession | null; turns: AIInterviewTurn[] } {
  try {
    const sessionJson = localStorage.getItem(SESSION_STORAGE_KEY);
    const turnsJson = localStorage.getItem(TURNS_STORAGE_KEY);
    
    return {
      session: sessionJson ? JSON.parse(sessionJson) : null,
      turns: turnsJson ? JSON.parse(turnsJson) : [],
    };
  } catch (e) {
    console.error('[InterviewEngine] Failed to load session:', e);
    return { session: null, turns: [] };
  }
}

/**
 * Clear saved session
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(TURNS_STORAGE_KEY);
}

// ============================================================================
// SESSION COMPLETION
// ============================================================================

/**
 * Complete a session
 */
export function completeSession(session: AIInterviewSession): AIInterviewSession {
  return {
    ...session,
    status: 'completed',
    endedAt: new Date().toISOString(),
  };
}

/**
 * Check if session is complete
 */
export function isSessionComplete(session: AIInterviewSession): boolean {
  return session.turnCount >= session.maxTurns || session.status === 'completed';
}

/**
 * Get session summary
 */
export function getSessionSummary(session: AIInterviewSession, turns: AIInterviewTurn[]) {
  const feedbackCounts = turns.reduce((acc, turn) => {
    acc[turn.feedbackLabel] = (acc[turn.feedbackLabel] || 0) + 1;
    return acc;
  }, {} as Record<FeedbackLabel, number>);
  
  return {
    totalTurns: turns.length,
    duration: session.endedAt 
      ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
      : 0,
    feedbackCounts,
    topics: [...new Set(turns.map(t => t.topic?.id).filter(Boolean))],
    averageLatency: 0, // Latency now tracked server-side
  };
}
