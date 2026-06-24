/**
 * Question Universe Data Builder
 * 
 * NOTE: This module now delegates to the master content system in lib/content.
 * 
 * For new code, import directly from lib/content:
 *   import { getQuestionBySlug } from '@/lib/content';
 * 
 * This module is preserved for backward compatibility with existing code.
 */

import {
  getQuestionBySlug as masterGetQuestionBySlug,
  getQuestionById as masterGetQuestionById,
  getQuestionsByCategory as masterGetQuestionsByCategory,
  getQuestionsByTopic as masterGetQuestionsByTopic,
  allCategories,
  allTopics,
  allQuestions,
  clearContentCache,
  generateSlug,
} from '@/lib/content';
import type { MasterQuestion, MasterCategory } from '@/lib/content';

import type { SEOQuestion, CategoryHub, QuestionIndex } from './types';

// Cache for question index
let questionIndexCache: QuestionIndex | null = null;

/**
 * Convert MasterQuestion to SEOQuestion format for backward compatibility
 */
function toSEOQuestion(master: MasterQuestion): SEOQuestion {
  const category = allCategories.find((c: MasterCategory) => c.id === master.categoryId);
  const topic = allTopics.find((t: { id: string }) => t.id === master.topicId);

  return {
    ...master,
    // Legacy fields for compatibility
    categorySlug: category?.slug || generateSlug(master.categoryId),
    topicSlug: topic?.slug || generateSlug(master.topicId),
    seoKeywords: master.keywords,
    // Ensure all required fields are present
    officerLookingFor: master.officerLookingFor?.[0],
    avoidThis: master.avoidThis?.[0],
  };
}

/**
 * Convert MasterCategory to CategoryHub format for backward compatibility
 */
function toCategoryHub(master: MasterCategory): CategoryHub {
  const categoryQuestions = masterGetQuestionsByCategory(master.id);
  const topicSlugs = Array.from(new Set(
    categoryQuestions.map((q: { topicId: string }) => {
      const topic = allTopics.find((t: { id: string }) => t.id === q.topicId);
      return topic?.slug || generateSlug(q.topicId);
    })
  )) as string[];

  return {
    id: master.id,
    slug: master.slug,
    name: master.name,
    description: master.description,
    shortDescription: master.shortDescription || master.description.slice(0, 100) + '...',
    icon: master.icon,
    color: master.color,
    seoTitle: master.seoTitle || `${master.name} | USCIS Marriage Interview Questions`,
    seoDescription: master.seoDescription || `Practice ${categoryQuestions.length} questions about ${master.name.toLowerCase()}`,
    questionCount: categoryQuestions.length,
    pdfPackName: master.pdfPackName,
    pdfPackUrl: undefined, // Not in master model
    topics: topicSlugs,
  };
}

/**
 * Build the complete question index
 * @deprecated Use selectors from lib/content instead
 */
export function buildQuestionIndex(): QuestionIndex {
  if (questionIndexCache) {
    return questionIndexCache;
  }

  const bySlug = new Map<string, SEOQuestion>();
  const byId = new Map<string, SEOQuestion>();
  const byCategory = new Map<string, SEOQuestion[]>();
  const byTopic = new Map<string, SEOQuestion[]>();
  const publicOnly: SEOQuestion[] = [];

  for (const master of allQuestions) {
    const seoQuestion = toSEOQuestion(master);

    bySlug.set(seoQuestion.slug, seoQuestion);
    byId.set(seoQuestion.id, seoQuestion);

    // Add to category map
    const categoryQuestions = byCategory.get(seoQuestion.categorySlug) || [];
    categoryQuestions.push(seoQuestion);
    byCategory.set(seoQuestion.categorySlug, categoryQuestions);

    // Add to topic map
    const topicQuestions = byTopic.get(seoQuestion.topicSlug) || [];
    topicQuestions.push(seoQuestion);
    byTopic.set(seoQuestion.topicSlug, topicQuestions);

    if (seoQuestion.isPublic) {
      publicOnly.push(seoQuestion);
    }
  }

  questionIndexCache = {
    bySlug,
    byId,
    byCategory,
    byTopic,
    publicOnly,
  };

  return questionIndexCache;
}

/**
 * Get all SEO questions
 * @deprecated Use getPublicQuestions() from lib/content
 */
export function getAllQuestions(): SEOQuestion[] {
  return buildQuestionIndex().publicOnly;
}

/**
 * Get question by slug
 * @deprecated Use getQuestionBySlug() from lib/content
 */
export function getQuestionBySlug(slug: string): SEOQuestion | undefined {
  // Try to get from master content first
  const master = masterGetQuestionBySlug(slug);
  if (master) {
    return toSEOQuestion(master);
  }
  // Fallback to index
  return buildQuestionIndex().bySlug.get(slug);
}

/**
 * Get question by ID
 * @deprecated Use getQuestionById() from lib/content
 */
export function getQuestionById(id: string): SEOQuestion | undefined {
  // Try to get from master content first
  const master = masterGetQuestionById(id);
  if (master) {
    return toSEOQuestion(master);
  }
  // Fallback to index
  return buildQuestionIndex().byId.get(id);
}

/**
 * Get questions by category
 * @deprecated Use getQuestionsByCategory() from lib/content
 */
export function getQuestionsByCategory(categorySlug: string): SEOQuestion[] {
  // Find category by slug
  const category = allCategories.find((c: MasterCategory) => c.slug === categorySlug);
  if (!category) {
    return buildQuestionIndex().byCategory.get(categorySlug) || [];
  }
  
  // Get from master content
  return masterGetQuestionsByCategory(category.id)
    .map(toSEOQuestion);
}

/**
 * Get questions by topic
 * @deprecated Use getQuestionsByTopic() from lib/content
 */
export function getQuestionsByTopic(topicSlug: string): SEOQuestion[] {
  // Find topic by slug
  const topic = allTopics.find((t: { slug: string }) => t.slug === topicSlug);
  if (!topic) {
    return buildQuestionIndex().byTopic.get(topicSlug) || [];
  }
  
  // Get from master content
  return masterGetQuestionsByTopic(topic.id)
    .map(toSEOQuestion);
}

/**
 * Build category hubs
 * @deprecated Use allCategories from lib/content
 */
export function buildCategoryHubs(): CategoryHub[] {
  return allCategories.map(toCategoryHub);
}

/**
 * Get category hub by slug
 * @deprecated Use getCategoryBySlug() from lib/content
 */
export function getCategoryHubBySlug(slug: string): CategoryHub | undefined {
  const category = allCategories.find((c: MasterCategory) => c.slug === slug);
  if (!category) return undefined;
  return toCategoryHub(category);
}

/**
 * Clear caches
 */
export function clearQuestionCache(): void {
  questionIndexCache = null;
  clearContentCache();
}
