/**
 * SEO Library Export
 */

// Types
export type {
  SEOQuestion,
  CategoryHub,
  SituationPage,
  FAQSchema,
  FAQItem,
  BreadcrumbSchema,
  BreadcrumbItem,
  SEOMetaTags,
  SitemapEntry,
  InternalLink,
  RelatedQuestionDisplay,
  QuestionIndex,
  AnxietyLevel,
} from './types';

// Utils
export {
  generateSlug,
  generateQuestionTitle,
  generateQuestionDescription,
  generateQuestionMetaTags,
  generateCategoryMetaTags,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateSitemapXML,
  truncateText,
  stripHtml,
  getAnxietyColor,
  getAnxietyLabel,
} from './utils';

// Question Universe
export {
  buildQuestionIndex,
  getAllQuestions,
  getQuestionBySlug,
  getQuestionById,
  getQuestionsByCategory,
  getQuestionsByTopic,
  buildCategoryHubs,
  getCategoryHubBySlug,
  clearQuestionCache,
} from './questionUniverse';

// Related Questions
export {
  getRelatedQuestionsForSEO,
  getQuestionsForCategoryHub,
  getFeaturedQuestionsForCategory,
  getRelatedQuestionsByTopic,
  searchQuestions,
  getRandomQuestions,
  getQuestionsByAnxietyLevel,
  getAdjacentQuestions,
} from './relatedQuestions';

// Sitemap
export {
  generateQuestionSitemapEntries,
  generateTopicSitemapEntries,
  generateSituationSitemapEntries,
  generateStaticSitemapEntries,
  generatePillarSitemapEntries,
  generateSupportingSitemapEntries,
  generateExpansionSitemapEntries,
  generateCompleteSitemap,
  getSitemapStats,
  generateRobotsTxt,
} from './sitemap';

// Expansion Framework (Future SEO Pages)
export {
  // Constants
  DEFAULT_EXPANSION_SETTINGS,
  DEFAULT_SCHEDULER_SETTINGS,
  DEFAULT_ROLLOUT_GUIDANCE,
  PATTERN_PAGES,
  SITUATION_PAGES_CONFIG,
  // Feature enablement checks
  arePatternPagesEnabled,
  areSituationPagesEnabled,
  // Settings
  getExpansionSettings,
  saveExpansionSettings,
  // Page access
  getEnabledPatternPages,
  getEnabledSituationPages,
  getPatternPageBySlug,
  getSituationPageBySlug,
  // Legacy admin functions (deprecated)
  setPatternPageEnabled,
  setSituationPageEnabled,
  // Stats
  getExpansionStats,
  // Safety control functions
  shouldExpansionPagesBeInSitemap,
  shouldExpansionPagesHaveNoindex,
  shouldPageBeInSitemap,
  shouldPageHaveNoindex,
  // Publication state management (Supabase-based)
  getPagePublicationState,
  getAllPublicationStates,
  updatePagePublicationState,
  // Individual page actions
  markPageReviewed,
  markPageApproved,
  publishPage,
  unpublishPage,
  // Bulk actions
  bulkPublishPages,
  bulkUnpublishPages,
  bulkMarkReviewed,
  bulkMarkApproved,
  // AI Recommendations
  calculatePageRecommendations,
  getAllPageRecommendations,
  getTopRecommendedPages,
  // Scheduler (admin-run)
  previewNextSchedulerCycle,
  executeSchedulerCycle,
  // Scheduler history
  getSchedulerRunHistory,
  getLastSchedulerRun,
  // Rollout guidance
  getDaysSinceLaunch,
  shouldShowReminderBanner,
  getCurrentRolloutPhase,
  // Deprecated - no longer used
  loadPublicationStates,
  savePublicationStates,
} from './expansion';

export type {
  // Core types
  ExpansionStatus,
  SEOExpansionSettings,
  PatternPageConfig,
  SituationPageConfig,
  ExpansionStats,
  // Publication types
  PublicationStatus,
  PagePublicationState,
  // Scheduler types
  RolloutFrequency,
  PageCountMode,
  RolloutSchedulerSettings,
  // AI types
  PageAIRecommendations,
  // Guidance types
  RolloutGuidance,
  // Scheduler execution types
  SchedulerPreviewResult,
  SchedulerRunResult,
  SchedulerRun,
} from './expansion';
