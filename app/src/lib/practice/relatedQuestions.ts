/**
 * Related Questions Engine - Enhanced Version
 * 
 * Uses pattern matching, archetype analysis, and logical chains
 * to find the best related questions WITHOUT generating new content.
 */

import type { 
  PracticeQuestion, 
  PracticeTopic, 
  RelatedQuestionsOptions, 
  RelatedQuestionResult 
} from './types';
import { 
  getEnhancedRelatedQuestions, 
  getLawyerDiscussionSuggestions,
  analyzeQuestionArchetypes 
} from './questionPatterns';

const DEFAULT_MAX_ITEMS = 4;

/**
 * Main function to get related questions
 * Uses the enhanced pattern matching system
 */
export function getRelatedQuestions(options: RelatedQuestionsOptions): RelatedQuestionResult[] {
  const { 
    currentQuestion, 
    currentTopic, 
    allTopics, 
    maxItems = DEFAULT_MAX_ITEMS,
  } = options;

  // Use the enhanced matching system
  const enhanced = getEnhancedRelatedQuestions(
    currentQuestion,
    currentTopic,
    allTopics,
    maxItems
  );

  return enhanced.map(e => ({
    question: e.question,
    topicTitle: e.topic.title,
    reason: mapReason(e.reason),
  }));
}

/**
 * Map internal reason strings to display-friendly labels
 */
function mapReason(reason: string): RelatedQuestionResult['reason'] {
  if (reason.includes('follow-up')) return 'explicit';
  if (reason.includes('Related')) return 'same-topic';
  if (reason.includes('From')) return 'same-category';
  return 'fallback';
}

/**
 * Check if related questions are available for a given question
 */
export function hasRelatedQuestions(
  question: PracticeQuestion,
  topic: PracticeTopic,
  allTopics: PracticeTopic[],
  minItems: number = 1
): boolean {
  const related = getRelatedQuestions({
    currentQuestion: question,
    currentTopic: topic,
    allTopics,
    maxItems: minItems,
    excludeCurrent: true
  });
  return related.length >= minItems;
}

/**
 * Get navigation target for a related question click
 */
export function getRelatedQuestionNavigation(
  result: RelatedQuestionResult
): { topicId: string; questionId: string; questionIndex: number } {
  return {
    topicId: result.question.topicId,
    questionId: result.question.id,
    questionIndex: result.question.sortOrder
  };
}

/**
 * Get lawyer discussion suggestions for a question
 */
export function getQuestionGuidance(
  question: PracticeQuestion
): { type: 'caution' | 'note' | 'prepare'; message: string }[] {
  return getLawyerDiscussionSuggestions(question);
}

/**
 * Get question archetypes for analysis display
 */
export function getQuestionArchetypes(
  question: PracticeQuestion
): string[] {
  const archetypes = analyzeQuestionArchetypes(question);
  // Convert to display-friendly names
  const displayNames: Record<string, string> = {
    'location-detail': 'Location details',
    'routine-habit': 'Daily routines',
    'physical-description': 'Physical descriptions',
    'temporal-memory': 'Memory of events',
    'financial-detail': 'Financial matters',
    'relationship-proof': 'Relationship history',
    'daily-schedule': 'Daily schedule',
    'household-detail': 'Home details',
    'personal-preference': 'Personal preferences',
    'social-circle': 'Social connections',
    'travel-memory': 'Travel experiences',
    'document-evidence': 'Documentation',
    'communication-pattern': 'Communication',
    'conflict-resolution': 'Conflict handling',
    'future-plans': 'Future plans',
  };

  return archetypes.map(a => displayNames[a] || a);
}

// Legacy fallback functions for compatibility

/**
 * Fallback: Get questions from same topic (nearby indices)
 */
export function getSameTopicFallback(
  currentQuestion: PracticeQuestion,
  currentTopic: PracticeTopic,
  excludeIds: Set<string>,
  maxItems: number
): RelatedQuestionResult[] {
  const results: RelatedQuestionResult[] = [];
  const currentIndex = currentQuestion.sortOrder;
  const window = 3;

  const candidates = currentTopic.questions
    .filter(q => {
      if (excludeIds.has(q.id)) return false;
      return Math.abs(q.sortOrder - currentIndex) <= window;
    })
    .sort((a, b) => Math.abs(a.sortOrder - currentIndex) - Math.abs(b.sortOrder - currentIndex));

  for (const q of candidates.slice(0, maxItems)) {
    results.push({
      question: q,
      topicTitle: currentTopic.title,
      reason: 'same-topic',
    });
  }

  return results;
}

/**
 * Fallback: Get questions from same category
 */
export function getSameCategoryFallback(
  _currentQuestion: PracticeQuestion,
  currentTopic: PracticeTopic,
  allTopics: PracticeTopic[],
  excludeIds: Set<string>,
  maxItems: number
): RelatedQuestionResult[] {
  const results: RelatedQuestionResult[] = [];
  
  const siblingTopics = allTopics.filter(t => 
    t.categoryId === currentTopic.categoryId && 
    t.id !== currentTopic.id
  );

  for (const topic of siblingTopics) {
    for (const question of topic.questions) {
      if (excludeIds.has(question.id)) continue;
      
      results.push({
        question,
        topicTitle: topic.title,
        reason: 'same-category',
      });

      if (results.length >= maxItems) break;
    }
    if (results.length >= maxItems) break;
  }

  return results;
}
