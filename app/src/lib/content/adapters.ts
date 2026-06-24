/**
 * Data Adapters
 * Normalizes existing data sources into the Master content model
 * 
 * This layer ensures that existing data (topics.ts, etc.) can be used
 * with the new master content system without a big-bang rewrite.
 */

import { topics as rawTopics, categories } from '@/data/topics';
import type { Topic, Category } from '@/data/topics';
import { normalizeAllTopics } from '@/lib/practice/normalize';
import type { PracticeQuestion, PracticeTopic } from '@/lib/practice/types';
import type { 
  MasterQuestion, 
  MasterCategory, 
  MasterTopic,
  AnxietyLevel,
  DifficultyLevel 
} from './types';

// ============================================================================
// SLUG GENERATION (Consistent with existing utils)
// ============================================================================

/**
 * Generate URL-friendly slug from text
 * Mirrors the behavior in lib/seo/utils.ts for consistency
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

// ============================================================================
// CATEGORY ADAPTERS
// ============================================================================

/**
 * Adapt a raw Category to MasterCategory
 */
export function adaptCategoryToMaster(
  raw: Category,
  sortOrder: number = 0
): MasterCategory {
  return {
    id: raw.id,
    slug: generateSlug(raw.name),
    name: raw.name,
    description: raw.description,
    shortDescription: raw.description.slice(0, 100) + (raw.description.length > 100 ? '...' : ''),
    icon: raw.icon,
    color: raw.color,
    seoTitle: `${raw.name} | USCIS Marriage Interview Questions`,
    seoDescription: `Practice questions about ${raw.name.toLowerCase()} for your green card interview. Sample answers and preparation tips included.`,
    pdfPackName: `${raw.name} Study Pack`,
    sortOrder,
  };
}

/**
 * Adapt all categories to MasterCategory format
 */
export function adaptAllCategories(): MasterCategory[] {
  return categories.map((cat, index) => adaptCategoryToMaster(cat, index));
}

// ============================================================================
// TOPIC ADAPTERS
// ============================================================================

/**
 * Extract numeric question count from string like "50+" or "40"
 */
function parseQuestionCount(countStr: string): number {
  const match = countStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Adapt a raw Topic to MasterTopic
 */
export function adaptTopicToMaster(
  raw: Topic,
  sortOrder: number = 0
): MasterTopic {
  return {
    id: raw.id,
    slug: generateSlug(raw.title),
    categoryId: raw.category,
    name: raw.title,
    title: raw.title,
    description: raw.description,
    shortDescription: raw.description.slice(0, 120) + (raw.description.length > 120 ? '...' : ''),
    icon: raw.icon,
    pdfFileName: raw.pdfFileName,
    questionCount: parseQuestionCount(raw.questionCount),
    checklist: raw.checklist || [],
    seoTitle: `${raw.title} | Marriage Interview Practice`,
    seoDescription: raw.description.slice(0, 160),
    sortOrder,
  };
}

/**
 * Adapt all topics to MasterTopic format
 */
export function adaptAllTopics(): MasterTopic[] {
  return rawTopics.map((topic, index) => adaptTopicToMaster(topic, index));
}

// ============================================================================
// QUESTION ADAPTERS
// ============================================================================

/**
 * Determine anxiety level based on question content
 * Mirrors logic from lib/seo/questionUniverse.ts
 */
function determineAnxietyLevel(promptText: string): AnxietyLevel {
  const lower = promptText.toLowerCase();
  
  const highAnxietyPatterns = [
    'divorce', 'previous marriage', 'ex-', 'criminal', 'overstay', 'illegal',
    'deport', 'fraud', 'money', 'paid', 'fake', 'arranged', 'visa',
    'separated', 'interview separately', 'stokes'
  ];
  
  const mediumAnxietyPatterns = [
    'finances', 'bank', 'income', 'job', 'work', 'tax', 'lease',
    'mortgage', 'bills', 'utilities', 'parents', 'in-laws', 'religion',
    'politics', 'age difference', 'language'
  ];
  
  if (highAnxietyPatterns.some(p => lower.includes(p))) return 'high';
  if (mediumAnxietyPatterns.some(p => lower.includes(p))) return 'medium';
  
  return 'low';
}

/**
 * Generate "what officers are looking for" guidance
 */
function generateOfficerLookingFor(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const guidance: string[] = [];
  
  if (lower.includes('met') || lower.includes('meet')) {
    guidance.push("Consistency with your spouse's answer");
    guidance.push("Specific details (date, location, circumstances)");
    guidance.push("Natural progression of your relationship");
  } else if (lower.includes('kitchen') || lower.includes('house') || lower.includes('home') || lower.includes('bedroom')) {
    guidance.push("Familiarity with your shared living space");
    guidance.push("Specific details about layout and items");
    guidance.push("Consistency with your spouse's description");
  } else if (lower.includes('daily') || lower.includes('routine') || lower.includes('morning') || lower.includes('evening')) {
    guidance.push("Knowledge of each other's daily habits");
    guidance.push("Work schedules and routines");
    guidance.push("Shared activities that demonstrate cohabitation");
  } else if (lower.includes('family') || lower.includes('parent') || lower.includes('mother') || lower.includes('father')) {
    guidance.push("Integration into each other's families");
    guidance.push("Knowledge of family members");
    guidance.push("Genuine relationships with in-laws");
  } else if (lower.includes('financ') || lower.includes('bank') || lower.includes('money') || lower.includes('bill')) {
    guidance.push("Evidence of financial co-mingling");
    guidance.push("Shared responsibility for expenses");
    guidance.push("Knowledge of each other's financial situation");
  } else if (lower.includes('wedding') || lower.includes('married') || lower.includes('ceremony')) {
    guidance.push("Details about your wedding ceremony");
    guidance.push("Who attended your wedding");
    guidance.push("Meaningful memories from your special day");
  } else if (lower.includes('travel') || lower.includes('vacation') || lower.includes('trip')) {
    guidance.push("Shared experiences and memories from trips");
    guidance.push("Dates and destinations");
    guidance.push("Activities you did together");
  } else {
    guidance.push("Specific, consistent details that demonstrate genuine knowledge");
    guidance.push("Natural, conversational answers");
    guidance.push("Alignment with your spouse's responses");
  }
  
  return guidance;
}

/**
 * Generate "what to avoid" guidance
 */
function generateAvoidThis(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const warnings: string[] = [];
  
  if (lower.includes('met') || lower.includes('meet')) {
    warnings.push("Vague answers like 'online' without details");
    warnings.push("Different dates than your spouse");
    warnings.push("Appearing to rehearse a memorized script");
  } else if (lower.includes('kitchen') || lower.includes('house') || lower.includes('home')) {
    warnings.push("Hesitation about basic household details");
    warnings.push("Answers that don't match your spouse's description");
    warnings.push("Unfamiliarity with shared spaces");
  } else if (lower.includes('daily') || lower.includes('routine')) {
    warnings.push("Contradicting your spouse's schedule");
    warnings.push("Not knowing basic habits");
    warnings.push("Appearing to guess rather than knowing confidently");
  } else {
    warnings.push("Vague or evasive answers");
    warnings.push("Contradictions with your spouse");
    warnings.push("Appearing uncertain about basic details of your shared life");
  }
  
  return warnings;
}

/**
 * Generate explanation of why this question is asked
 */
function generateExplanation(prompt: string): string {
  const lower = prompt.toLowerCase();
  
  if (lower.includes('met') || lower.includes('meet')) {
    return "This is one of the most common opening questions. Officers want to hear the story of your relationship in your own words.";
  }
  
  if (lower.includes('kitchen') || lower.includes('house') || lower.includes('home')) {
    return "These questions verify you actually live together. Officers know couples who share a home know intimate details about their space.";
  }
  
  if (lower.includes('daily') || lower.includes('routine')) {
    return "Daily routine questions establish that you share a life together, not just a mailing address.";
  }
  
  return "USCIS officers ask this to verify the authenticity of your marriage through specific, consistent details.";
}

/**
 * Generate keywords for SEO
 */
function generateKeywords(_prompt: string, topicName: string, categoryName: string): string[] {
  const keywords = [
    'USCIS interview',
    'marriage green card',
    'immigration interview',
    categoryName.toLowerCase(),
  ];
  
  const lowerTopic = topicName.toLowerCase?.() || String(topicName).toLowerCase();
  
  if (lowerTopic.includes('kitchen')) {
    keywords.push('kitchen questions', 'household questions');
  }
  
  if (lowerTopic.includes('daily')) {
    keywords.push('daily routine', 'lifestyle questions');
  }
  
  if (lowerTopic.includes('relationship')) {
    keywords.push('relationship history', 'how we met');
  }
  
  return keywords;
}

/**
 * Adapt a PracticeQuestion to MasterQuestion
 */
export function adaptQuestionToMaster(
  practice: PracticeQuestion,
  topic: PracticeTopic,
  categoryName: string,
  _sortOrder: number = 0
): MasterQuestion {
  const slug = generateSlug(practice.prompt);
  const anxietyTag = determineAnxietyLevel(practice.prompt);
  const isSensitive = anxietyTag === 'high' || anxietyTag === 'sensitive';
  
  // Determine feature eligibility
  const appearsInQuickPractice = anxietyTag !== 'high' && practice.sortOrder < 20;
  const appearsInMockInterview = true;
  const appearsInReadinessCheck = true;
  const appearsInTop100 = practice.sortOrder < 100;
  
  return {
    id: practice.id,
    slug,
    prompt: practice.prompt,
    shortPrompt: practice.prompt.length > 60 
      ? practice.prompt.slice(0, 60) + '...' 
      : practice.prompt,
    
    categoryId: practice.categoryId,
    topicId: practice.topicId,
    
    sampleAnswer: practice.sampleAnswer,
    shortAnswer: practice.shortAnswer,
    conversationalAnswer: practice.conversationalAnswer,
    explanation: generateExplanation(practice.prompt),
    
    officerLookingFor: practice.officerLookingFor 
      ? [practice.officerLookingFor] 
      : generateOfficerLookingFor(practice.prompt),
    avoidThis: practice.avoidThis 
      ? [practice.avoidThis] 
      : generateAvoidThis(practice.prompt),
    confidenceHint: practice.tip,
    tip: practice.tip,
    
    relatedQuestionIds: practice.relatedQuestionIds,
    followUpQuestionIds: practice.followups,
    
    anxietyTag,
    difficulty: 'normal' as DifficultyLevel,
    
    isPublic: true,
    isFeatured: appearsInQuickPractice,
    isSensitive,
    
    appearsInQuickPractice,
    appearsInMockInterview,
    appearsInReadinessCheck,
    appearsInTop100,
    
    seoTitle: `USCIS Marriage Interview: ${practice.prompt.slice(0, 50)}${practice.prompt.length > 50 ? '...' : ''}`,
    seoDescription: `Practice this common green card marriage interview question: "${practice.prompt.slice(0, 80)}..." Review sample answers and prepare with your spouse.`,
    keywords: generateKeywords(practice.prompt, topic.title, categoryName),
    
    pdfPackIds: [topic.pdfFileName.replace('.pdf', '')],
    timelineTags: [],
    compareTags: [],
    
    sortOrder: practice.sortOrder,
    status: 'published',
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Adapt all practice questions to MasterQuestion format
 */
export function adaptAllQuestions(
  practiceTopics: PracticeTopic[]
): MasterQuestion[] {
  const questions: MasterQuestion[] = [];
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  
  for (const topic of practiceTopics) {
    const categoryName = categoryMap.get(topic.categoryId) || 'General';
    
    for (const practice of topic.questions) {
      questions.push(adaptQuestionToMaster(
        practice,
        topic,
        categoryName,
        practice.sortOrder
      ));
    }
  }
  
  return questions;
}

// ============================================================================
// COMPLETE DATA BUILDERS
// ============================================================================

/**
 * Build complete master content from all sources
 * This is the main entry point for getting all normalized content
 */
export function buildMasterContent(): {
  categories: MasterCategory[];
  topics: MasterTopic[];
  questions: MasterQuestion[];
} {
  const categories = adaptAllCategories();
  const masterTopics = adaptAllTopics();
  
  // Get normalized practice topics to generate questions
  // Use the original raw topics for normalization
  const practiceTopics = normalizeAllTopics(rawTopics);
  const questions = adaptAllQuestions(practiceTopics);
  
  return {
    categories,
    topics: masterTopics,
    questions,
  };
}
