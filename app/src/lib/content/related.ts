/**
 * Related Questions Module
 * 
 * Provides related question functionality using the master content system.
 * This replaces and extends the functionality from lib/seo/relatedQuestions.ts
 */

import type {
  MasterQuestion,
  RelatedQuestionDisplay,
} from './types';
import {
  getQuestionById,
  getQuestionBySlug,
  getQuestionsByTopic,
  getQuestionsByCategory,
  getTopicById,
  getCategoryById,
  getPublicQuestions,
} from './selectors';

// ============================================================================
// TYPES
// ============================================================================

export interface RelatedQuestionsOptions {
  /** Current question ID or slug */
  questionId?: string;
  questionSlug?: string;
  /** Maximum number of related questions to return */
  maxItems?: number;
  /** Whether to exclude the current question from results */
  excludeCurrent?: boolean;
  /** Strategy for finding related questions */
  strategy?: 'balanced' | 'same-topic-only' | 'same-category-only' | 'random';
}

export interface AdjacentQuestionsResult {
  previous: RelatedQuestionDisplay | null;
  next: RelatedQuestionDisplay | null;
}

// ============================================================================
// DISPLAY BUILDER
// ============================================================================

/**
 * Create a display-friendly related question object
 */
function createDisplayQuestion(
  question: MasterQuestion,
  reason: RelatedQuestionDisplay['reason']
): RelatedQuestionDisplay {
  const topic = getTopicById(question.topicId);
  const category = getCategoryById(question.categoryId);

  return {
    id: question.id,
    slug: question.slug,
    prompt: question.prompt,
    shortAnswer: question.shortAnswer,
    topicName: topic?.name || topic?.title || question.topicId,
    categoryName: category?.name || question.categoryId,
    reason,
  };
}

// ============================================================================
// CORE RELATED QUESTIONS
// ============================================================================

/**
 * Get related questions for a given question
 * 
 * Priority order:
 * 1. Explicitly linked relatedQuestionIds
 * 2. Same topic questions
 * 3. Same category questions
 * 4. Random public questions (fallback)
 */
export function getRelatedQuestions(
  options: RelatedQuestionsOptions
): RelatedQuestionDisplay[] {
  const {
    questionId,
    questionSlug,
    maxItems = 4,
    excludeCurrent = true,
    strategy = 'balanced',
  } = options;

  // Find the current question
  let currentQuestion: MasterQuestion | undefined;
  if (questionId) {
    currentQuestion = getQuestionById(questionId);
  } else if (questionSlug) {
    currentQuestion = getQuestionBySlug(questionSlug);
  }

  if (!currentQuestion) {
    // If no current question, return random featured questions
    return getPublicQuestions()
      .filter(q => q.isFeatured)
      .slice(0, maxItems)
      .map(q => createDisplayQuestion(q, 'fallback'));
  }

  const results: RelatedQuestionDisplay[] = [];
  const addedIds = new Set<string>();

  if (excludeCurrent) {
    addedIds.add(currentQuestion.id);
  }

  // Strategy: same-topic-only
  if (strategy === 'same-topic-only') {
    const topicQuestions = getQuestionsByTopic(currentQuestion.topicId)
      .filter(q => q.isPublic && !addedIds.has(q.id))
      .slice(0, maxItems);
    
    for (const q of topicQuestions) {
      results.push(createDisplayQuestion(q, 'same-topic'));
      addedIds.add(q.id);
    }
    return results;
  }

  // Strategy: same-category-only
  if (strategy === 'same-category-only') {
    const categoryQuestions = getQuestionsByCategory(currentQuestion.categoryId)
      .filter(q => q.isPublic && !addedIds.has(q.id))
      .slice(0, maxItems);
    
    for (const q of categoryQuestions) {
      results.push(createDisplayQuestion(q, 'same-category'));
      addedIds.add(q.id);
    }
    return results;
  }

  // Strategy: random
  if (strategy === 'random') {
    const allPublic = getPublicQuestions().filter(q => !addedIds.has(q.id));
    const shuffled = [...allPublic].sort(() => Math.random() - 0.5);
    
    for (const q of shuffled.slice(0, maxItems)) {
      results.push(createDisplayQuestion(q, 'related-concept'));
      addedIds.add(q.id);
    }
    return results;
  }

  // Strategy: balanced (default)
  // Priority 1: Explicit relatedQuestionIds
  if (currentQuestion.relatedQuestionIds?.length) {
    for (const relatedId of currentQuestion.relatedQuestionIds) {
      if (results.length >= maxItems) break;
      if (addedIds.has(relatedId)) continue;

      const relatedQuestion = getQuestionById(relatedId);
      if (relatedQuestion && relatedQuestion.isPublic) {
        results.push(createDisplayQuestion(relatedQuestion, 'explicit'));
        addedIds.add(relatedId);
      }
    }
  }

  // Priority 2: Same topic
  if (results.length < maxItems) {
    const sameTopicQuestions = getQuestionsByTopic(currentQuestion.topicId)
      .filter(q => q.isPublic && !addedIds.has(q.id));

    for (const q of sameTopicQuestions) {
      if (results.length >= maxItems) break;
      results.push(createDisplayQuestion(q, 'same-topic'));
      addedIds.add(q.id);
    }
  }

  // Priority 3: Same category
  if (results.length < maxItems) {
    const sameCategoryQuestions = getQuestionsByCategory(currentQuestion.categoryId)
      .filter(q => q.isPublic && !addedIds.has(q.id));

    for (const q of sameCategoryQuestions) {
      if (results.length >= maxItems) break;
      results.push(createDisplayQuestion(q, 'same-category'));
      addedIds.add(q.id);
    }
  }

  // Priority 4: Fallback to any public questions
  if (results.length < maxItems) {
    const allPublic = getPublicQuestions().filter(q => !addedIds.has(q.id));
    const needed = maxItems - results.length;

    for (const q of allPublic.slice(0, needed)) {
      results.push(createDisplayQuestion(q, 'fallback'));
      addedIds.add(q.id);
    }
  }

  return results;
}

/**
 * Get follow-up questions for a given question
 */
export function getFollowUpQuestions(
  questionId: string,
  maxItems: number = 3
): RelatedQuestionDisplay[] {
  const question = getQuestionById(questionId);
  if (!question?.followUpQuestionIds?.length) {
    return [];
  }

  const results: RelatedQuestionDisplay[] = [];

  for (const followUpId of question.followUpQuestionIds.slice(0, maxItems)) {
    const followUp = getQuestionById(followUpId);
    if (followUp && followUp.isPublic) {
      results.push(createDisplayQuestion(followUp, 'explicit'));
    }
  }

  return results;
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Get next and previous questions for navigation
 * Based on sort order within the same topic
 */
export function getAdjacentQuestions(questionId: string): AdjacentQuestionsResult {
  const current = getQuestionById(questionId);
  if (!current) {
    return { previous: null, next: null };
  }

  // Get questions in same topic, sorted by order
  const topicQuestions = getQuestionsByTopic(current.topicId)
    .filter(q => q.isPublic)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const currentIndex = topicQuestions.findIndex(q => q.id === questionId);

  const previous = currentIndex > 0
    ? createDisplayQuestion(topicQuestions[currentIndex - 1], 'same-topic')
    : null;

  const next = currentIndex < topicQuestions.length - 1
    ? createDisplayQuestion(topicQuestions[currentIndex + 1], 'same-topic')
    : null;

  return { previous, next };
}

/**
 * Get breadcrumb navigation for a question
 */
export function getQuestionBreadcrumb(questionId: string): {
  category: { id: string; name: string; slug: string } | null;
  topic: { id: string; name: string; slug: string } | null;
  question: { id: string; prompt: string; slug: string } | null;
} {
  const question = getQuestionById(questionId);
  if (!question) {
    return { category: null, topic: null, question: null };
  }

  const topic = getTopicById(question.topicId);
  const category = getCategoryById(question.categoryId);

  return {
    category: category
      ? { id: category.id, name: category.name, slug: category.slug }
      : null,
    topic: topic
      ? { id: topic.id, name: topic.title, slug: topic.slug }
      : null,
    question: {
      id: question.id,
      prompt: question.shortPrompt || question.prompt,
      slug: question.slug,
    },
  };
}

// ============================================================================
// CATEGORY/TOPIC HELPERS
// ============================================================================

/**
 * Get questions for a category hub page
 * Returns a curated list sorted by anxiety level and sort order
 */
export function getQuestionsForCategoryHub(
  categoryId: string,
  limit: number = 30
): RelatedQuestionDisplay[] {
  const questions = getQuestionsByCategory(categoryId);

  // Sort by: anxiety level (low to high), then by sortOrder
  const anxietyOrder: Record<string, number> = { low: 0, medium: 1, high: 2, sensitive: 3 };

  const sorted = questions
    .filter(q => q.isPublic)
    .sort((a, b) => {
      const aAnxiety = anxietyOrder[a.anxietyTag || 'low'] || 0;
      const bAnxiety = anxietyOrder[b.anxietyTag || 'low'] || 0;
      if (aAnxiety !== bAnxiety) return aAnxiety - bAnxiety;
      return a.sortOrder - b.sortOrder;
    });

  return sorted.slice(0, limit).map(q => createDisplayQuestion(q, 'same-category'));
}

/**
 * Get featured questions for a category
 */
export function getFeaturedQuestionsForCategory(
  categoryId: string,
  count: number = 5
): RelatedQuestionDisplay[] {
  const questions = getQuestionsByCategory(categoryId);

  // Pick questions that appear in quick practice (commonly asked)
  const featured = questions
    .filter(q => q.isPublic && q.appearsInQuickPractice)
    .slice(0, count);

  // If not enough, fill with other public questions
  if (featured.length < count) {
    const others = questions
      .filter(q => q.isPublic && !q.appearsInQuickPractice)
      .slice(0, count - featured.length);
    featured.push(...others);
  }

  return featured.map(q => createDisplayQuestion(q, 'same-category'));
}

/**
 * Get related questions by topic
 */
export function getRelatedQuestionsByTopic(
  topicId: string,
  excludeQuestionId?: string,
  limit: number = 5
): RelatedQuestionDisplay[] {
  const questions = getQuestionsByTopic(topicId);

  return questions
    .filter(q => q.isPublic && q.id !== excludeQuestionId)
    .slice(0, limit)
    .map(q => createDisplayQuestion(q, 'same-topic'));
}
