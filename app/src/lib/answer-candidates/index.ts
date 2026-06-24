/**
 * Answer Candidates Module
 * 
 * Pipeline for capturing, sanitizing, and reviewing user interview answers
 * for potential use as public educational examples.
 * 
 * IMPORTANT: This is a private, admin-controlled pipeline. No content is
 * automatically made public. All examples must be reviewed and approved.
 */

// Main API
export {
  captureAnswerCandidate,
  fireAndForgetCapture,
  getPendingCandidates,
  getCandidateDetails,
  updateCandidateReview,
  getCandidateStats,
} from './api';

// Types
export type {
  CaptureAnswerInput,
  CaptureAnswerResult,
  AdminCandidateView,
  CandidateStats,
} from './api';

export type { AnswerPattern, QualityScore } from './categorizer';

// Utilities (for testing/admin use)
export { sanitizeAnswer, containsPII, getSanitizationSummary } from './sanitizer';
export { categorizeAnswer, assessQuality, getPatternLabel, getQualityLabel } from './categorizer';
