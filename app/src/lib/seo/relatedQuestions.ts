/**
 * Related Question Engine for SEO
 * 
 * NOTE: This module now delegates to the master content system in lib/content.
 * 
 * For new code, import directly from lib/content:
 *   import { getRelatedQuestions, getQuestionsForCategoryHub } from '@/lib/content';
 * 
 * This module is preserved for backward compatibility with existing code.
 */

import {
  getRelatedQuestions as masterGetRelatedQuestions,
  getQuestionsForCategoryHub as masterGetQuestionsForCategoryHub,
  getFeaturedQuestionsForCategory as masterGetFeaturedQuestionsForCategory,
  getRelatedQuestionsByTopic as masterGetRelatedQuestionsByTopic,
  getAdjacentQuestions as masterGetAdjacentQuestions,
  searchQuestions as masterSearchQuestions,
  getRandomQuestions as masterGetRandomQuestions,
  getQuestionsByAnxietyLevel as masterGetQuestionsByAnxietyLevel,
  getQuestionBySlug,
  getCategoryBySlug,
  getTopicBySlug,
  allCategories,
  allTopics,
} from '@/lib/content';
import type { RelatedQuestionDisplay } from './types';

export interface RelatedQuestionsOptions {
  currentQuestionSlug: string;
  maxItems?: number;
  excludeCurrent?: boolean;
}

/**
 * Get related questions for SEO pages
 * @deprecated Use getRelatedQuestions from lib/content
 */
export function getRelatedQuestionsForSEO(
  options: RelatedQuestionsOptions
): RelatedQuestionDisplay[] {
  const { currentQuestionSlug, maxItems = 4, excludeCurrent = true } = options;

  return masterGetRelatedQuestions({
    questionSlug: currentQuestionSlug,
    maxItems,
    excludeCurrent,
    strategy: 'balanced',
  });
}

/**
 * Get questions for a category hub page
 * @deprecated Use getQuestionsForCategoryHub from lib/content
 */
export function getQuestionsForCategoryHub(
  categorySlug: string,
  limit: number = 30
): RelatedQuestionDisplay[] {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return [];
  
  return masterGetQuestionsForCategoryHub(category.id, limit);
}

/**
 * Get featured questions for a category
 * @deprecated Use getFeaturedQuestionsForCategory from lib/content
 */
export function getFeaturedQuestionsForCategory(
  categorySlug: string,
  count: number = 5
): RelatedQuestionDisplay[] {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return [];
  
  return masterGetFeaturedQuestionsForCategory(category.id, count);
}

/**
 * Get related questions by topic
 * @deprecated Use getRelatedQuestionsByTopic from lib/content
 */
export function getRelatedQuestionsByTopic(
  topicSlug: string,
  excludeSlug?: string,
  limit: number = 5
): RelatedQuestionDisplay[] {
  const topic = getTopicBySlug(topicSlug);
  if (!topic) return [];

  // Find exclude question ID if provided
  let excludeQuestionId: string | undefined;
  if (excludeSlug) {
    const excludeQuestion = getQuestionBySlug(excludeSlug);
    excludeQuestionId = excludeQuestion?.id;
  }

  return masterGetRelatedQuestionsByTopic(topic.id, excludeQuestionId, limit);
}

/**
 * Search questions by keyword
 * @deprecated Use searchQuestions from lib/content
 */
export function searchQuestions(
  query: string,
  limit: number = 10
): RelatedQuestionDisplay[] {
  const results = masterSearchQuestions(query, limit);
  
  // Convert to RelatedQuestionDisplay format
  return results.map(q => {
    const topic = allTopics.find(t => t.id === q.topicId);
    const category = allCategories.find(c => c.id === q.categoryId);
    
    return {
      id: q.id,
      slug: q.slug,
      prompt: q.prompt,
      shortAnswer: q.shortAnswer,
      topicName: topic?.name || topic?.title || q.topicId,
      categoryName: category?.name || q.categoryId,
      reason: 'related-concept',
    };
  });
}

/**
 * Get random questions for exploration
 * @deprecated Use getRandomQuestions from lib/content
 */
export function getRandomQuestions(
  count: number = 5,
  excludeSlugs: string[] = []
): RelatedQuestionDisplay[] {
  // Convert slugs to IDs
  const excludeIds = excludeSlugs
    .map(slug => getQuestionBySlug(slug)?.id)
    .filter((id): id is string => !!id);
  
  const results = masterGetRandomQuestions(count, excludeIds);
  
  // Convert to RelatedQuestionDisplay format
  return results.map(q => {
    const topic = allTopics.find(t => t.id === q.topicId);
    const category = allCategories.find(c => c.id === q.categoryId);
    
    return {
      id: q.id,
      slug: q.slug,
      prompt: q.prompt,
      shortAnswer: q.shortAnswer,
      topicName: topic?.name || topic?.title || q.topicId,
      categoryName: category?.name || q.categoryId,
      reason: 'related-concept',
    };
  });
}

/**
 * Get questions by anxiety level
 * @deprecated Use getQuestionsByAnxietyLevel from lib/content
 */
export function getQuestionsByAnxietyLevel(
  level: 'low' | 'medium' | 'high',
  limit: number = 10
): RelatedQuestionDisplay[] {
  const results = masterGetQuestionsByAnxietyLevel(level).slice(0, limit);
  
  // Convert to RelatedQuestionDisplay format
  return results.map(q => {
    const topic = allTopics.find(t => t.id === q.topicId);
    const category = allCategories.find(c => c.id === q.categoryId);
    
    return {
      id: q.id,
      slug: q.slug,
      prompt: q.prompt,
      shortAnswer: q.shortAnswer,
      topicName: topic?.name || topic?.title || q.topicId,
      categoryName: category?.name || q.categoryId,
      reason: 'related-concept',
    };
  });
}

/**
 * Get next and previous questions for navigation
 * @deprecated Use getAdjacentQuestions from lib/content
 */
export function getAdjacentQuestions(
  currentSlug: string
): { previous: RelatedQuestionDisplay | null; next: RelatedQuestionDisplay | null } {
  const current = getQuestionBySlug(currentSlug);
  if (!current) {
    return { previous: null, next: null };
  }

  return masterGetAdjacentQuestions(current.id);
}
