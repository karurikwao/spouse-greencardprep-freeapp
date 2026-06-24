/**
 * Master Content Types
 * Canonical types for the unified question database
 * 
 * This is the single source of truth for question content across the app.
 * All features (SEO pages, practice, readiness, etc.) should consume from
 * these types and the selectors that operate on them.
 */

// ============================================================================
// ENUMS / UNION TYPES
// ============================================================================

export type AnxietyLevel = 'low' | 'medium' | 'high' | 'sensitive';
export type DifficultyLevel = 'beginner' | 'normal' | 'detailed';
export type ContentStatus = 'draft' | 'published' | 'archived';

// ============================================================================
// MASTER QUESTION
// ============================================================================

/**
 * Canonical Master Question type
 * This is the single source of truth for question content
 */
export interface MasterQuestion {
  // Core identifiers
  id: string;
  slug: string;
  prompt: string;
  shortPrompt?: string;

  // Categorization
  categoryId: string;
  topicId: string;

  // Content enrichment
  sampleAnswer?: string;
  shortAnswer?: string;
  conversationalAnswer?: string;
  explanation?: string;

  // Guidance for users
  officerLookingFor?: string[];
  avoidThis?: string[];
  confidenceHint?: string;
  tip?: string;

  // Relationships
  relatedQuestionIds?: string[];
  followUpQuestionIds?: string[];

  // Metadata tags
  anxietyTag?: AnxietyLevel;
  difficulty?: DifficultyLevel;

  // Visibility flags
  isPublic: boolean;
  isFeatured: boolean;
  isSensitive: boolean;

  // Feature eligibility flags
  appearsInQuickPractice: boolean;
  appearsInMockInterview: boolean;
  appearsInReadinessCheck: boolean;
  appearsInTop100: boolean;

  // SEO metadata
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];

  // PDF/Resource relationships
  pdfPackIds?: string[];

  // Future feature support
  timelineTags?: string[];
  compareTags?: string[];

  // Ordering
  sortOrder: number;

  // Lifecycle
  status: ContentStatus;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// MASTER CATEGORY
// ============================================================================

/**
 * Canonical Master Category type
 */
export interface MasterCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  
  // UI
  icon: string;
  color: string;
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  
  // PDF association
  pdfPackName?: string;
  
  // Ordering
  sortOrder: number;
}

// ============================================================================
// MASTER TOPIC
// ============================================================================

/**
 * Canonical Master Topic type
 */
export interface MasterTopic {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  title: string;
  description: string;
  shortDescription?: string;
  
  // UI
  icon: string;
  
  // PDF
  pdfFileName: string;
  questionCount: number;
  
  // Content
  checklist: string[];
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  
  // Ordering
  sortOrder: number;
}

// ============================================================================
// USER STATE TYPES (Separate from content)
// ============================================================================

/**
 * User progress/status for a specific question
 * This is stored separately from the master question content
 */
export interface UserQuestionState {
  userId: string;
  questionId: string;
  
  // Progress tracking
  status: 'unseen' | 'understood' | 'needs_review' | 'stressful';
  savedForLater: boolean;
  
  // Timestamps
  firstSeenAt?: string;
  lastSeenAt?: string;
  lastUpdatedAt?: string;
}

/**
 * User's personal answer notes for a question
 * Used for "Our Story" feature
 */
export interface UserStoryAnswer {
  userId: string;
  questionId: string;
  
  // Personal answers
  actualAnswer?: string;
  keyDates?: string;
  keyPlaces?: string;
  keyPeople?: string;
  evidenceNotes?: string;
  
  // Timestamps
  updatedAt?: string;
}

/**
 * Couple comparison record
 * For future couple compare feature
 */
export interface PartnerCompareRecord {
  questionId: string;
  userAId: string;
  userBId: string;
  
  // Alignment status
  alignmentStatus: 'aligned' | 'mostly_aligned' | 'needs_clarification' | 'incomplete';
  summary?: string;
  
  // Timestamps
  comparedAt?: string;
  updatedAt?: string;
}

// ============================================================================
// DISPLAY / DERIVED TYPES
// ============================================================================

/**
 * Related question for display purposes
 */
export interface RelatedQuestionDisplay {
  id: string;
  slug: string;
  prompt: string;
  shortAnswer?: string;
  topicName: string;
  categoryName: string;
  reason: 'explicit' | 'same-topic' | 'same-category' | 'related-concept' | 'fallback';
}

/**
 * Question with topic/category info attached
 */
export interface QuestionWithContext extends MasterQuestion {
  topic: MasterTopic;
  category: MasterCategory;
}

// ============================================================================
// INDEX / LOOKUP TYPES
// ============================================================================

/**
 * Precomputed index for fast lookups
 */
export interface MasterContentIndex {
  // Maps for O(1) lookups
  questionsById: Map<string, MasterQuestion>;
  questionsBySlug: Map<string, MasterQuestion>;
  categoriesById: Map<string, MasterCategory>;
  categoriesBySlug: Map<string, MasterCategory>;
  topicsById: Map<string, MasterTopic>;
  topicsBySlug: Map<string, MasterTopic>;
  
  // Groupings
  questionsByCategoryId: Map<string, MasterQuestion[]>;
  questionsByTopicId: Map<string, MasterQuestion[]>;
  
  // Filtered lists
  publicQuestions: MasterQuestion[];
  featuredQuestions: MasterQuestion[];
  top100Questions: MasterQuestion[];
  sensitiveQuestions: MasterQuestion[];
  
  // Feature-specific lists
  quickPracticeQuestions: MasterQuestion[];
  mockInterviewQuestions: MasterQuestion[];
  readinessCheckQuestions: MasterQuestion[];
}

// ============================================================================
// LEGACY COMPATIBILITY TYPES
// ============================================================================

/**
 * Legacy SEO Question interface for backward compatibility
 * @deprecated Use MasterQuestion instead
 */
export interface LegacySEOQuestion extends MasterQuestion {
  // Additional legacy fields that may be referenced
  categorySlug: string;
  topicSlug: string;
  seoKeywords?: string[];
}

/**
 * Legacy Category Hub interface for backward compatibility
 * @deprecated Use MasterCategory instead
 */
export interface LegacyCategoryHub {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  icon: string;
  color: string;
  seoTitle: string;
  seoDescription: string;
  questionCount: number;
  pdfPackName?: string;
  pdfPackUrl?: string;
  topics: string[];
}
