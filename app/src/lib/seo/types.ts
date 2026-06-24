/**
 * SEO Question Universe Types
 * Unified structure for questions with SEO metadata
 */

// Note: PracticeQuestion type is duplicated here to avoid circular dependencies
interface PracticeQuestionBase {
  id: string;
  topicId: string;
  categoryId: string;
  prompt: string;
  sampleAnswer?: string;
  shortAnswer?: string;
  conversationalAnswer?: string;
  tip?: string;
  officerLookingFor?: string;
  avoidThis?: string;
  followups?: string[];
  relatedQuestionIds?: string[];
  sortOrder: number;
}

export type AnxietyLevel = 'low' | 'medium' | 'high' | 'sensitive';

/**
 * Extended Question with SEO fields
 * Builds on existing PracticeQuestion, adds SEO-specific fields
 */
export interface SEOQuestion extends PracticeQuestionBase {
  // SEO fields
  slug: string;
  categorySlug: string;
  topicSlug: string;
  
  // Content enrichment fields
  officerLookingFor?: string;
  avoidThis?: string;
  explanation?: string;
  anxietyTag?: AnxietyLevel;
  
  // SEO metadata
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  
  // Visibility flags
  isPublic: boolean;
  appearsInQuickPractice: boolean;
  appearsInMockInterview: boolean;
  appearsInReadinessCheck: boolean;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Category Hub metadata for SEO pages
 */
export interface CategoryHub {
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
  topics: string[]; // topic slugs
}

/**
 * Situation Page for common anxious searches
 */
export interface SituationPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  relatedQuestionSlugs: string[];
  relatedTopicSlugs: string[];
  icon: string;
}

/**
 * Schema.org FAQ structured data
 */
export interface FAQSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: FAQItem[];
}

export interface FAQItem {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

/**
 * Breadcrumb structured data
 */
export interface BreadcrumbSchema {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

/**
 * Meta tags for SEO pages
 */
export interface SEOMetaTags {
  title: string;
  description: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
}

/**
 * Sitemap entry
 */
export interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

/**
 * Internal link for navigation
 */
export interface InternalLink {
  label: string;
  href: string;
  type: 'question' | 'topic' | 'category' | 'app' | 'pdf' | 'tool';
  description?: string;
}

/**
 * Related question with context for display
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
 * Question index for fast lookup
 */
export interface QuestionIndex {
  bySlug: Map<string, SEOQuestion>;
  byId: Map<string, SEOQuestion>;
  byCategory: Map<string, SEOQuestion[]>;
  byTopic: Map<string, SEOQuestion[]>;
  publicOnly: SEOQuestion[];
}
