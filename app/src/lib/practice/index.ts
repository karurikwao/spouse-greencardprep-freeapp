/**
 * Practice Module - index file
 * 
 * This module provides:
 * - Data normalization for questions
 * - Related questions engine with fallback logic
 * - Practice state management
 */

// Types
export type {
  ComfortStatus,
  PracticeQuestion,
  PracticeTopic,
  QuestionState,
  UserPracticeState,
  RelatedQuestionsOptions,
  RelatedQuestionResult,
} from './types';

// Normalization utilities
export {
  createQuestionId,
  parseQuestionId,
  normalizeQuestion,
  normalizeTopic,
  normalizeAllTopics,
  findQuestionById,
  findTopicById,
  getQuestionsByCategory,
  isValidQuestion,
  hasSampleAnswer,
} from './normalize';

// Related questions engine
export {
  getRelatedQuestions,
  hasRelatedQuestions,
  getRelatedQuestionNavigation,
  getQuestionGuidance,
  getQuestionArchetypes,
} from './relatedQuestions';

// Question pattern analysis
export type { QuestionArchetype } from './questionPatterns';
export {
  analyzeQuestionArchetypes,
  getRelatedArchetypes,
  getEnhancedRelatedQuestions,
  getLawyerDiscussionSuggestions,
} from './questionPatterns';

// React context
export {
  PracticeProvider,
  usePractice,
  PracticeContext,
} from './PracticeContext';

// Supabase persistence
export {
  saveQuestionStateToSupabase,
  loadQuestionStatesFromSupabase,
  saveTopicProgressToSupabase,
  loadTopicProgressFromSupabase,
  getSavedQuestionsFromSupabase,
  getQuestionsByComfortStatus,
  getPracticeStatsFromSupabase,
  syncLocalStateToSupabase,
  isSupabaseSyncAvailable,
  TABLES,
} from './supabasePersistence';
