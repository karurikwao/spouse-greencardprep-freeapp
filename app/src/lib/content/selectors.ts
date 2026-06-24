/**
 * Master Content Selectors
 * Shared selector/helper functions for accessing master content
 * 
 * All major features should use these selectors instead of scattered local logic.
 * This ensures consistent filtering, sorting, and access patterns.
 */

import type {
  MasterQuestion,
  MasterCategory,
  MasterTopic,
  MasterContentIndex,
  AnxietyLevel,
  DifficultyLevel,
} from './types';

// ============================================================================
// CACHE
// ============================================================================

let contentIndexCache: MasterContentIndex | null = null;

// ============================================================================
// INDEX BUILDER (Internal)
// ============================================================================

/**
 * Build a precomputed index for fast lookups
 * This is called lazily and cached
 */
function buildContentIndex(
  questions: MasterQuestion[],
  categories: MasterCategory[],
  topics: MasterTopic[]
): MasterContentIndex {
  if (contentIndexCache) {
    return contentIndexCache;
  }

  // Build maps
  const questionsById = new Map<string, MasterQuestion>();
  const questionsBySlug = new Map<string, MasterQuestion>();
  const categoriesById = new Map<string, MasterCategory>();
  const categoriesBySlug = new Map<string, MasterCategory>();
  const topicsById = new Map<string, MasterTopic>();
  const topicsBySlug = new Map<string, MasterTopic>();

  // Groupings
  const questionsByCategoryId = new Map<string, MasterQuestion[]>();
  const questionsByTopicId = new Map<string, MasterQuestion[]>();

  // Filtered lists
  const publicQuestions: MasterQuestion[] = [];
  const featuredQuestions: MasterQuestion[] = [];
  const top100Questions: MasterQuestion[] = [];
  const sensitiveQuestions: MasterQuestion[] = [];
  const quickPracticeQuestions: MasterQuestion[] = [];
  const mockInterviewQuestions: MasterQuestion[] = [];
  const readinessCheckQuestions: MasterQuestion[] = [];

  // Index categories
  for (const category of categories) {
    categoriesById.set(category.id, category);
    categoriesBySlug.set(category.slug, category);
  }

  // Index topics
  for (const topic of topics) {
    topicsById.set(topic.id, topic);
    topicsBySlug.set(topic.slug, topic);
  }

  // Index questions
  for (const question of questions) {
    questionsById.set(question.id, question);
    questionsBySlug.set(question.slug, question);

    // Add to category grouping
    const categoryQuestions = questionsByCategoryId.get(question.categoryId) || [];
    categoryQuestions.push(question);
    questionsByCategoryId.set(question.categoryId, categoryQuestions);

    // Add to topic grouping
    const topicQuestions = questionsByTopicId.get(question.topicId) || [];
    topicQuestions.push(question);
    questionsByTopicId.set(question.topicId, topicQuestions);

    // Add to filtered lists
    if (question.isPublic) {
      publicQuestions.push(question);
    }
    if (question.isFeatured) {
      featuredQuestions.push(question);
    }
    if (question.appearsInTop100) {
      top100Questions.push(question);
    }
    if (question.isSensitive) {
      sensitiveQuestions.push(question);
    }
    if (question.appearsInQuickPractice) {
      quickPracticeQuestions.push(question);
    }
    if (question.appearsInMockInterview) {
      mockInterviewQuestions.push(question);
    }
    if (question.appearsInReadinessCheck) {
      readinessCheckQuestions.push(question);
    }
  }

  // Sort filtered lists by sortOrder
  const sortByOrder = (a: MasterQuestion, b: MasterQuestion) => a.sortOrder - b.sortOrder;
  publicQuestions.sort(sortByOrder);
  featuredQuestions.sort(sortByOrder);
  top100Questions.sort(sortByOrder);
  quickPracticeQuestions.sort(sortByOrder);
  mockInterviewQuestions.sort(sortByOrder);
  readinessCheckQuestions.sort(sortByOrder);

  contentIndexCache = {
    questionsById,
    questionsBySlug,
    categoriesById,
    categoriesBySlug,
    topicsById,
    topicsBySlug,
    questionsByCategoryId,
    questionsByTopicId,
    publicQuestions,
    featuredQuestions,
    top100Questions,
    sensitiveQuestions,
    quickPracticeQuestions,
    mockInterviewQuestions,
    readinessCheckQuestions,
  };

  return contentIndexCache;
}

/**
 * Clear the content index cache
 * Useful for testing or when content is hot-reloaded
 */
export function clearContentCache(): void {
  contentIndexCache = null;
}

// ============================================================================
// SELECTOR FACTORY
// ============================================================================

/**
 * Create a selector instance bound to specific content
 * This is useful if you want to work with a specific dataset
 */
export function createSelectors(params: {
  questions: MasterQuestion[];
  categories: MasterCategory[];
  topics: MasterTopic[];
}) {
  const { questions, categories, topics } = params;
  const index = buildContentIndex(questions, categories, topics);

  return {
    // Access the index directly if needed
    index,

    // Core getters by ID
    getQuestionById: (id: string) => index.questionsById.get(id),
    getCategoryById: (id: string) => index.categoriesById.get(id),
    getTopicById: (id: string) => index.topicsById.get(id),

    // Core getters by slug
    getQuestionBySlug: (slug: string) => index.questionsBySlug.get(slug),
    getCategoryBySlug: (slug: string) => index.categoriesBySlug.get(slug),
    getTopicBySlug: (slug: string) => index.topicsBySlug.get(slug),

    // Bulk getters
    getAllQuestions: () => questions,
    getAllCategories: () => categories,
    getAllTopics: () => topics,

    // Filtered lists
    getPublicQuestions: () => index.publicQuestions,
    getFeaturedQuestions: () => index.featuredQuestions,
    getTopQuestions: (limit?: number) => 
      limit ? index.top100Questions.slice(0, limit) : index.top100Questions,
    getSensitiveQuestions: () => index.sensitiveQuestions,

    // Feature-specific getters
    getQuestionsForQuickPractice: () => index.quickPracticeQuestions,
    getQuestionsForMockInterview: () => index.mockInterviewQuestions,
    getQuestionsForReadinessCheck: () => index.readinessCheckQuestions,

    // Category/topic filtered
    getQuestionsByCategory: (categoryId: string) =>
      index.questionsByCategoryId.get(categoryId) || [],
    getQuestionsByTopic: (topicId: string) =>
      index.questionsByTopicId.get(topicId) || [],

    // Cross-reference helpers
    getCategoryForQuestion: (question: MasterQuestion) =>
      index.categoriesById.get(question.categoryId),
    getTopicForQuestion: (question: MasterQuestion) =>
      index.topicsById.get(question.topicId),
  };
}

// ============================================================================
// STANDALONE SELECTORS (with lazy content loading)
// ============================================================================

// These selectors use lazy-loaded content to avoid circular dependencies
// The actual content is loaded from masterData.ts

let lazyContentLoader: (() => { questions: MasterQuestion[]; categories: MasterCategory[]; topics: MasterTopic[] }) | null = null;

/**
 * Register the lazy content loader
 * This is called by masterData.ts to avoid circular imports
 */
export function registerLazyContentLoader(
  loader: () => { questions: MasterQuestion[]; categories: MasterCategory[]; topics: MasterTopic[] }
): void {
  lazyContentLoader = loader;
}

/**
 * Get content lazily
 */
function getLazyContent() {
  if (!lazyContentLoader) {
    throw new Error('Content loader not registered. Import masterData.ts before using selectors.');
  }
  return lazyContentLoader();
}

/**
 * Get the content index (lazy)
 */
function getIndex(): MasterContentIndex {
  if (contentIndexCache) {
    return contentIndexCache;
  }
  const { questions, categories, topics } = getLazyContent();
  return buildContentIndex(questions, categories, topics);
}

// ============================================================================
// STANDALONE GETTERS - By ID
// ============================================================================

/**
 * Get a question by its ID
 */
export function getQuestionById(id: string): MasterQuestion | undefined {
  return getIndex().questionsById.get(id);
}

/**
 * Get a category by its ID
 */
export function getCategoryById(id: string): MasterCategory | undefined {
  return getIndex().categoriesById.get(id);
}

/**
 * Get a topic by its ID
 */
export function getTopicById(id: string): MasterTopic | undefined {
  return getIndex().topicsById.get(id);
}

// ============================================================================
// STANDALONE GETTERS - By Slug
// ============================================================================

/**
 * Get a question by its slug
 */
export function getQuestionBySlug(slug: string): MasterQuestion | undefined {
  return getIndex().questionsBySlug.get(slug);
}

/**
 * Get a category by its slug
 */
export function getCategoryBySlug(slug: string): MasterCategory | undefined {
  return getIndex().categoriesBySlug.get(slug);
}

/**
 * Get a topic by its slug
 */
export function getTopicBySlug(slug: string): MasterTopic | undefined {
  return getIndex().topicsBySlug.get(slug);
}

// ============================================================================
// STANDALONE GETTERS - Filtered Lists
// ============================================================================

/**
 * Get all public questions
 */
export function getPublicQuestions(): MasterQuestion[] {
  return getIndex().publicQuestions;
}

/**
 * Get featured questions
 */
export function getFeaturedQuestions(): MasterQuestion[] {
  return getIndex().featuredQuestions;
}

/**
 * Get top N questions (most important/commonly asked)
 */
export function getTopQuestions(limit: number = 100): MasterQuestion[] {
  return getIndex().top100Questions.slice(0, limit);
}

/**
 * Get sensitive questions (high anxiety)
 */
export function getSensitiveQuestions(): MasterQuestion[] {
  return getIndex().sensitiveQuestions;
}

/**
 * Get questions filtered by anxiety level
 */
export function getQuestionsByAnxietyLevel(level: AnxietyLevel): MasterQuestion[] {
  return getIndex().publicQuestions.filter(q => q.anxietyTag === level);
}

/**
 * Get questions filtered by difficulty
 */
export function getQuestionsByDifficulty(difficulty: DifficultyLevel): MasterQuestion[] {
  return getIndex().publicQuestions.filter(q => q.difficulty === difficulty);
}

// ============================================================================
// STANDALONE GETTERS - Feature-Specific
// ============================================================================

/**
 * Get questions eligible for quick practice
 */
export function getQuestionsForQuickPractice(): MasterQuestion[] {
  return getIndex().quickPracticeQuestions;
}

/**
 * Get questions eligible for mock interview
 */
export function getQuestionsForMockInterview(): MasterQuestion[] {
  return getIndex().mockInterviewQuestions;
}

/**
 * Get questions eligible for readiness check
 */
export function getQuestionsForReadinessCheck(): MasterQuestion[] {
  return getIndex().readinessCheckQuestions;
}

// ============================================================================
// STANDALONE GETTERS - By Category/Topic
// ============================================================================

/**
 * Get questions by category ID
 */
export function getQuestionsByCategory(categoryId: string): MasterQuestion[] {
  return getIndex().questionsByCategoryId.get(categoryId) || [];
}

/**
 * Get questions by topic ID
 */
export function getQuestionsByTopic(topicId: string): MasterQuestion[] {
  return getIndex().questionsByTopicId.get(topicId) || [];
}

/**
 * Get questions by category slug
 */
export function getQuestionsByCategorySlug(categorySlug: string): MasterQuestion[] {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return [];
  return getQuestionsByCategory(category.id);
}

/**
 * Get questions by topic slug
 */
export function getQuestionsByTopicSlug(topicSlug: string): MasterQuestion[] {
  const topic = getTopicBySlug(topicSlug);
  if (!topic) return [];
  return getQuestionsByTopic(topic.id);
}

// ============================================================================
// STANDALONE GETTERS - Cross-Reference
// ============================================================================

/**
 * Get the category for a question
 */
export function getCategoryForQuestion(question: MasterQuestion): MasterCategory | undefined {
  return getIndex().categoriesById.get(question.categoryId);
}

/**
 * Get the topic for a question
 */
export function getTopicForQuestion(question: MasterQuestion): MasterTopic | undefined {
  return getIndex().topicsById.get(question.topicId);
}

/**
 * Get category and topic for a question
 */
export function getContextForQuestion(question: MasterQuestion): {
  category: MasterCategory | undefined;
  topic: MasterTopic | undefined;
} {
  const index = getIndex();
  return {
    category: index.categoriesById.get(question.categoryId),
    topic: index.topicsById.get(question.topicId),
  };
}

// ============================================================================
// STANDALONE GETTERS - Advanced Filtering
// ============================================================================

/**
 * Get questions by PDF pack ID
 */
export function getQuestionsForPdfPack(pdfPackId: string): MasterQuestion[] {
  return getIndex().publicQuestions.filter(q => 
    q.pdfPackIds?.some(id => id.includes(pdfPackId) || pdfPackId.includes(id))
  );
}

/**
 * Get questions by timeline tag
 */
export function getQuestionsForTimelineTag(tag: string): MasterQuestion[] {
  return getIndex().publicQuestions.filter(q => 
    q.timelineTags?.includes(tag)
  );
}

/**
 * Get questions by compare tag
 */
export function getQuestionsForCompareTag(tag: string): MasterQuestion[] {
  return getIndex().publicQuestions.filter(q => 
    q.compareTags?.includes(tag)
  );
}

/**
 * Search questions by keyword
 */
export function searchQuestions(query: string, limit: number = 10): MasterQuestion[] {
  const normalizedQuery = query.toLowerCase();
  const matches: { question: MasterQuestion; score: number }[] = [];

  for (const question of getIndex().publicQuestions) {
    let score = 0;

    if (question.prompt.toLowerCase().includes(normalizedQuery)) score += 10;
    if (question.sampleAnswer?.toLowerCase().includes(normalizedQuery)) score += 5;
    if (question.explanation?.toLowerCase().includes(normalizedQuery)) score += 3;
    if (question.keywords?.some(k => k.includes(normalizedQuery))) score += 4;

    if (score > 0) {
      matches.push({ question, score });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => m.question);
}

/**
 * Get random questions
 */
export function getRandomQuestions(count: number = 5, excludeIds: string[] = []): MasterQuestion[] {
  const available = getIndex().publicQuestions.filter(q => !excludeIds.includes(q.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Get all questions (legacy alias for getPublicQuestions)
 * @deprecated Use getPublicQuestions() instead
 */
export function getAllQuestions(): MasterQuestion[] {
  return getPublicQuestions();
}
