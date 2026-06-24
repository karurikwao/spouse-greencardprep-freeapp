/**
 * Master Content Data Module
 * 
 * This is the main entry point for accessing master content.
 * It builds the normalized content from existing data sources
 * and exposes it through a clean API.
 * 
 * Import this module to ensure selectors work correctly.
 */

import { normalizeAllTopics } from '@/lib/practice/normalize';
// Types
import { topics } from '@/data/topics';
import {
  adaptAllCategories,
  adaptAllTopics,
  adaptAllQuestions,
} from './adapters';
import { registerLazyContentLoader } from './selectors';
import type {
  MasterQuestion,
  MasterCategory,
  MasterTopic,
} from './types';

// ============================================================================
// CONTENT BUILDING
// ============================================================================

/**
 * Build all master content from source data
 */
function buildMasterContent(): {
  questions: MasterQuestion[];
  categories: MasterCategory[];
  topics: MasterTopic[];
} {
  // Build categories and topics
  const categories = adaptAllCategories();
  const masterTopics = adaptAllTopics();

  // Build questions from normalized practice topics
  const practiceTopics = normalizeAllTopics(topics);
  const questions = adaptAllQuestions(practiceTopics);

  return {
    questions,
    categories,
    topics: masterTopics,
  };
}

// ============================================================================
// LAZY LOADING REGISTRATION
// ============================================================================

// Register the lazy content loader so selectors can work
// This avoids circular imports between selectors.ts and masterData.ts
registerLazyContentLoader(buildMasterContent);

// ============================================================================
// CONTENT INSTANCE
// ============================================================================

/**
 * The master content instance
 * Built once and reused
 */
const masterContent = buildMasterContent();

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All master questions
 */
export const allQuestions: MasterQuestion[] = masterContent.questions;

/**
 * All master categories
 */
export const allCategories: MasterCategory[] = masterContent.categories;

/**
 * All master topics
 */
export const allTopics: MasterTopic[] = masterContent.topics;

/**
 * Get the complete master content
 */
export function getMasterContent(): {
  questions: MasterQuestion[];
  categories: MasterCategory[];
  topics: MasterTopic[];
} {
  return masterContent;
}

/**
 * Get questions count
 */
export function getQuestionsCount(): number {
  return masterContent.questions.length;
}

/**
 * Get categories count
 */
export function getCategoriesCount(): number {
  return masterContent.categories.length;
}

/**
 * Get topics count
 */
export function getTopicsCount(): number {
  return masterContent.topics.length;
}

/**
 * Get content statistics
 */
export function getContentStats(): {
  questions: number;
  categories: number;
  topics: number;
  publicQuestions: number;
  featuredQuestions: number;
  quickPracticeQuestions: number;
  mockInterviewQuestions: number;
} {
  return {
    questions: masterContent.questions.length,
    categories: masterContent.categories.length,
    topics: masterContent.topics.length,
    publicQuestions: masterContent.questions.filter(q => q.isPublic).length,
    featuredQuestions: masterContent.questions.filter(q => q.isFeatured).length,
    quickPracticeQuestions: masterContent.questions.filter(q => q.appearsInQuickPractice).length,
    mockInterviewQuestions: masterContent.questions.filter(q => q.appearsInMockInterview).length,
  };
}

// ============================================================================
// RE-EXPORT SELECTORS
// ============================================================================

// Re-export all selectors for convenience
export {
  // Core getters by ID
  getQuestionById,
  getCategoryById,
  getTopicById,

  // Core getters by slug
  getQuestionBySlug,
  getCategoryBySlug,
  getTopicBySlug,

  // Bulk getters
  getPublicQuestions,
  getFeaturedQuestions,
  getTopQuestions,
  getSensitiveQuestions,
  getQuestionsByAnxietyLevel,
  getQuestionsByDifficulty,

  // Feature-specific
  getQuestionsForQuickPractice,
  getQuestionsForMockInterview,
  getQuestionsForReadinessCheck,

  // Category/topic filtered
  getQuestionsByCategory,
  getQuestionsByTopic,
  getQuestionsByCategorySlug,
  getQuestionsByTopicSlug,

  // Cross-reference
  getCategoryForQuestion,
  getTopicForQuestion,
  getContextForQuestion,

  // Advanced filtering
  getQuestionsForPdfPack,
  getQuestionsForTimelineTag,
  getQuestionsForCompareTag,
  searchQuestions,
  getRandomQuestions,

  // Legacy
  getAllQuestions,

  // Cache management
  clearContentCache,
} from './selectors';
