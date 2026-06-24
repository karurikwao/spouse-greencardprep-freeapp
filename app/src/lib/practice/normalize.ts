/**
 * Data normalization layer
 * Converts raw topic data into normalized PracticeQuestion/PracticeTopic format
 * Handles various field name variations and creates deterministic IDs
 */

import type { Topic, SampleQA } from '@/data/topics';
import type { PracticeQuestion, PracticeTopic } from './types';

/**
 * Create a deterministic question ID from topic slug and index
 */
export function createQuestionId(topicId: string, index: number): string {
  return `${topicId}-q${index}`;
}

/**
 * Parse a question ID to extract topic and index
 */
export function parseQuestionId(questionId: string): { topicId: string; index: number } | null {
  const match = questionId.match(/^(.+)-q(\d+)$/);
  if (!match) return null;
  return {
    topicId: match[1],
    index: parseInt(match[2], 10)
  };
}

/**
 * Normalize a single SampleQA into PracticeQuestion
 * Handles multiple possible field names for flexibility
 */
export function normalizeQuestion(
  raw: SampleQA,
  topicId: string,
  categoryId: string,
  index: number
): PracticeQuestion {
  const id = createQuestionId(topicId, index);
  
  // The raw data currently only has question, sampleAnswer, tip
  // But we structure this to handle future field additions gracefully
  return {
    id,
    topicId,
    categoryId,
    prompt: raw.question?.trim() || '',
    sampleAnswer: raw.sampleAnswer?.trim() || undefined,
    shortAnswer: undefined, // Future expansion
    conversationalAnswer: undefined, // Future expansion
    tip: raw.tip?.trim() || undefined,
    officerLookingFor: undefined, // Future expansion
    avoidThis: undefined, // Future expansion
    followups: undefined, // Future expansion - will be populated from related logic
    relatedQuestionIds: undefined, // Will be computed dynamically
    sortOrder: index,
  };
}

/**
 * Normalize a Topic into PracticeTopic
 */
export function normalizeTopic(raw: Topic): PracticeTopic {
  const questions = (raw.sampleQA || []).map((qa, idx) =>
    normalizeQuestion(qa, raw.id, raw.category, idx)
  );

  // Extract numeric question count from string like "50+" or "40"
  const questionCountMatch = raw.questionCount?.match(/(\d+)/);
  const questionCount = questionCountMatch 
    ? parseInt(questionCountMatch[1], 10) 
    : questions.length;

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    categoryId: raw.category,
    pdfFileName: raw.pdfFileName,
    questionCount,
    icon: raw.icon,
    questions,
    checklist: raw.checklist || [],
  };
}

/**
 * Normalize all topics
 */
export function normalizeAllTopics(rawTopics: Topic[]): PracticeTopic[] {
  return rawTopics.map(normalizeTopic);
}

/**
 * Find a question by ID across all topics
 */
export function findQuestionById(
  questionId: string,
  topics: PracticeTopic[]
): { question: PracticeQuestion; topic: PracticeTopic } | null {
  for (const topic of topics) {
    const question = topic.questions.find(q => q.id === questionId);
    if (question) {
      return { question, topic };
    }
  }
  return null;
}

/**
 * Find a topic by ID
 */
export function findTopicById(
  topicId: string,
  topics: PracticeTopic[]
): PracticeTopic | null {
  return topics.find(t => t.id === topicId) || null;
}

/**
 * Get all questions from a category
 */
export function getQuestionsByCategory(
  categoryId: string,
  topics: PracticeTopic[]
): PracticeQuestion[] {
  return topics
    .filter(t => t.categoryId === categoryId)
    .flatMap(t => t.questions);
}

/**
 * Check if a question has meaningful content for display
 */
export function isValidQuestion(question: PracticeQuestion): boolean {
  return !!question.prompt && question.prompt.length > 0;
}

/**
 * Check if a question has a sample answer
 */
export function hasSampleAnswer(question: PracticeQuestion): boolean {
  return !!question.sampleAnswer && question.sampleAnswer.length > 0;
}
