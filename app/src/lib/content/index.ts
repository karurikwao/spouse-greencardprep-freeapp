/**
 * Master Content Module
 * 
 * This is the unified content layer for the Green Card Interview Prep app.
 * 
 * IMPORT THIS MODULE to use the master content system:
 * ```ts
 * import { getQuestionBySlug, getRelatedQuestions } from '@/lib/content';
 * ```
 * 
 * Architecture:
 * - types.ts: Canonical type definitions
 * - adapters.ts: Normalization from existing data formats
 * - masterData.ts: Built content data and lazy loading
 * - selectors.ts: Reusable selector functions
 * - related.ts: Related question logic
 * 
 * This module provides:
 * - Single source of truth for question content
 * - Consistent selectors across all features
 * - Backward compatibility with existing code
 * - Foundation for future features (AI simulation, couple compare, etc.)
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Master types
  MasterQuestion,
  MasterCategory,
  MasterTopic,
  
  // User state types (separate from content)
  UserQuestionState,
  UserStoryAnswer,
  PartnerCompareRecord,
  
  // Enums/Unions
  AnxietyLevel,
  DifficultyLevel,
  ContentStatus,
  
  // Display types
  RelatedQuestionDisplay,
  QuestionWithContext,
  
  // Index types
  MasterContentIndex,
  
  // Legacy compatibility
  LegacySEOQuestion,
  LegacyCategoryHub,
} from './types';

// ============================================================================
// MASTER DATA
// ============================================================================

export {
  // Content arrays
  allQuestions,
  allCategories,
  allTopics,
  
  // Content getters
  getMasterContent,
  getQuestionsCount,
  getCategoriesCount,
  getTopicsCount,
  getContentStats,
} from './masterData';

// ============================================================================
// SELECTORS
// ============================================================================

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
  
  // Feature-specific getters
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
  
  // Legacy alias
  getAllQuestions,
  
  // Cache management
  clearContentCache,
  
  // Factory
  createSelectors,
} from './selectors';

// ============================================================================
// RELATED QUESTIONS
// ============================================================================

export {
  // Core related questions
  getRelatedQuestions,
  getFollowUpQuestions,
  
  // Navigation
  getAdjacentQuestions,
  getQuestionBreadcrumb,
  
  // Category/topic helpers
  getQuestionsForCategoryHub,
  getFeaturedQuestionsForCategory,
  getRelatedQuestionsByTopic,
} from './related';

export type {
  RelatedQuestionsOptions,
  AdjacentQuestionsResult,
} from './related';

// ============================================================================
// ADAPTERS (Advanced use)
// ============================================================================

export {
  // Individual adapters
  adaptCategoryToMaster,
  adaptTopicToMaster,
  adaptQuestionToMaster,
  
  // Bulk adapters
  adaptAllCategories,
  adaptAllTopics,
  adaptAllQuestions,
  buildMasterContent,
  
  // Utility
  generateSlug,
} from './adapters';

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

/**
 * MIGRATION FROM OLD SYSTEM:
 * 
 * Old: import { getQuestionBySlug } from '@/lib/seo/questionUniverse';
 * New: import { getQuestionBySlug } from '@/lib/content';
 * 
 * Old: import { getRelatedQuestionsForSEO } from '@/lib/seo/relatedQuestions';
 * New: import { getRelatedQuestions } from '@/lib/content';
 * 
 * Old: import type { SEOQuestion } from '@/lib/seo/types';
 * New: import type { MasterQuestion } from '@/lib/content';
 * 
 * The old SEO exports are preserved for backward compatibility.
 * They now delegate to the master content system.
 */
