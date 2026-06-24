/**
* Answer Candidates API
*
* Service for capturing, sanitizing, and storing user answers
* as candidates for future public educational examples.
*
* IMPORTANT: This is a SILENT background process. It must never:
* - Block the interview flow
* - Show errors to users
* - Slow down the user experience
*/

import { apiClient } from '@/lib/apiClient';
import { sanitizeAnswer, containsPII, getSanitizationSummary } from './sanitizer';
import { categorizeAnswer, assessQuality } from './categorizer';
import type { AnswerPattern, QualityScore } from './categorizer';

/**
* Input for capturing an answer candidate
*/
export interface CaptureAnswerInput {
// User identification (required but may be null for anonymous)
userId: string | null;

// Question context
questionId?: string;
questionSlug?: string;
questionPrompt: string;

// The answer
originalAnswer: string;

// Optional source tracking
sessionId?: string;
turnNumber?: number;
}

/**
* Result of capturing an answer
*/
export interface CaptureAnswerResult {
success: boolean;
candidateId?: string;
error?: string;
// Debug info (not shown to users)
wasSanitized?: boolean;
detectedPII?: string[];
pattern?: AnswerPattern;
qualityScore?: QualityScore;
}

/**
* Capture an answer as a candidate for future educational examples.
*
* This function is designed to be fire-and-forget from the interview flow.
* It will never throw or block - all errors are logged silently.
*
* @param input The answer data to capture
* @returns Result of the capture operation
*/
export async function captureAnswerCandidate(
input: CaptureAnswerInput
): Promise<CaptureAnswerResult> {
try {
// Validate minimum requirements
if (!input.originalAnswer || input.originalAnswer.trim().length < 10) {
return {
success: false,
error: 'Answer too short',
};
}

// Skip anonymous users (safety measure)
if (!input.userId) {
return {
success: false,
error: 'Anonymous answers not captured',
};
}

const originalAnswer = input.originalAnswer.trim();

// Step 1: Sanitize the answer
const sanitizedAnswer = sanitizeAnswer(originalAnswer);
const piiCheck = containsPII(originalAnswer);
const sanitizationSummary = getSanitizationSummary(originalAnswer, sanitizedAnswer);

// Step 2: Categorize the answer
const categorization = categorizeAnswer(sanitizedAnswer, input.questionPrompt);
const qualityAssessment = assessQuality(sanitizedAnswer);

// Step 3: Store in database via RPC function
const { data: candidateId, error } = await apiClient.rpc('create_answer_candidate', {
userId: input.userId,
questionId: input.questionId || null,
questionSlug: input.questionSlug || null,
questionPrompt: input.questionPrompt,
originalAnswer: originalAnswer,
sanitizedAnswer: sanitizedAnswer,
category: categorization.pattern === 'uncategorized' ? 'uncategorized' : categorization.pattern.split('_')[0],
answerPattern: categorization.pattern,
qualityScore: qualityAssessment.score,
qualityReason: qualityAssessment.reason,
sourceSessionId: input.sessionId || null,
sourceTurnNumber: input.turnNumber || null,
});

if (error) {
console.error('[AnswerCapture] Database error:', error);
return {
success: false,
error: error.message,
};
}

  return {
    success: true,
    candidateId: candidateId as string | undefined,
wasSanitized: sanitizationSummary.wasChanged,
detectedPII: piiCheck.detectedTypes,
pattern: categorization.pattern,
qualityScore: qualityAssessment.score,
};

} catch (err) {
// Never throw - log and return failure
console.error('[AnswerCapture] Unexpected error:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Capture answer candidate in a truly fire-and-forget manner.
* This version doesn't return anything and is safe to use without await.
*
* Usage:
* fireAndForgetCapture(input); // No await needed
*/
export function fireAndForgetCapture(input: CaptureAnswerInput): void {
// Run in background, don't await
captureAnswerCandidate(input).then(result => {
if (!result.success) {
console.log('[AnswerCapture] Background capture failed (non-blocking):', result.error);
}
}).catch(err => {
// This should never happen due to internal try/catch, but just in case
console.error('[AnswerCapture] Fire-and-forget error:', err);
});
}

// ============================================================================
// Admin API Functions
// ============================================================================

export interface AdminCandidateView {
id: string;
questionPrompt: string;
category: string;
answerPattern: string;
sanitizedAnswer: string;
qualityScore: string;
reviewStatus: 'pending' | 'approved' | 'rejected' | 'needs_edit';
createdAt: string;
userEmail?: string;
}

export interface CandidateStats {
totalCandidates: number;
pendingReview: number;
approvedCount: number;
rejectedCount: number;
needsEditCount: number;
todayCount: number;
}

/**
* Get pending candidates for admin review
*/
export async function getPendingCandidates(
limit: number = 50,
offset: number = 0
): Promise<{ success: boolean; data?: AdminCandidateView[]; error?: string }> {
try {
const { data, error } = await apiClient.rpc('get_pending_answer_candidates', {
limit,
offset,
});

if (error) {
console.error('[AnswerCapture] Error fetching pending candidates:', error);
return { success: false, error: error.message };
}

  const candidates: AdminCandidateView[] = ((data as Record<string, unknown>[]) || []).map((row: Record<string, unknown>) => ({
id: row.id as string,
questionPrompt: row.question_prompt as string,
category: row.category as string,
answerPattern: row.answer_pattern as string,
sanitizedAnswer: row.sanitized_answer as string,
qualityScore: row.quality_score as string,
reviewStatus: row.review_status as 'pending' | 'approved' | 'rejected' | 'needs_edit',
createdAt: row.created_at as string,
userEmail: row.user_email as string | undefined,
}));

return { success: true, data: candidates };
} catch (err) {
console.error('[AnswerCapture] Error in getPendingCandidates:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Get full candidate details (including private original answer)
* Admin only.
*/
export async function getCandidateDetails(
candidateId: string
): Promise<{
success: boolean;
data?: {
id: string;
userId: string | null;
questionPrompt: string;
originalAnswer: string;
sanitizedAnswer: string;
category: string;
answerPattern: string;
qualityScore: string;
qualityReason: string;
reviewStatus: string;
reviewerNotes: string | null;
reviewedBy: string | null;
reviewedAt: string | null;
createdAt: string;
};
error?: string;
}> {
try {
const { data, error } = await apiClient
.from('answer_example_candidates')
.select('*')
.eq('id', candidateId)
.single();

if (error) {
return { success: false, error: error.message };
}

if (!data) {
return { success: false, error: 'Candidate not found' };
}

const row = data as Record<string, unknown>;
return {
success: true,
data: {
id: row.id as string,
userId: row.user_id as string | null,
questionPrompt: row.question_prompt as string,
originalAnswer: row.original_answer as string,
sanitizedAnswer: row.sanitized_answer as string,
category: row.category as string,
answerPattern: row.answer_pattern as string,
qualityScore: row.quality_score as string,
qualityReason: row.quality_reason as string,
reviewStatus: row.review_status as string,
reviewerNotes: row.reviewer_notes as string | null,
reviewedBy: row.reviewed_by as string | null,
reviewedAt: row.reviewed_at as string | null,
createdAt: row.created_at as string,
},
};
} catch (err) {
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Update candidate review status
*/
export async function updateCandidateReview(
candidateId: string,
reviewStatus: 'approved' | 'rejected' | 'needs_edit',
reviewerNotes?: string,
approvedForPublication: boolean = false
): Promise<{ success: boolean; error?: string }> {
try {
const { error } = await apiClient.rpc('update_answer_candidate_review', {
candidateId,
reviewStatus,
reviewerNotes: reviewerNotes || null,
approvedForPublication,
});

if (error) {
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}

/**
* Get candidate statistics for admin dashboard
*/
export async function getCandidateStats(): Promise<{
success: boolean;
data?: CandidateStats;
error?: string;
}> {
try {
const { data, error } = await apiClient.rpc('get_answer_candidate_stats', {});

if (error) {
return { success: false, error: error.message };
}

    const rows = (data as Record<string, unknown>[]) || [];
    if (rows.length === 0) {
      return {
        success: true,
        data: {
          totalCandidates: 0,
          pendingReview: 0,
          approvedCount: 0,
          rejectedCount: 0,
          needsEditCount: 0,
          todayCount: 0,
        },
      };
    }

    const row = rows[0];
return {
success: true,
data: {
totalCandidates: Number(row.total_candidates),
pendingReview: Number(row.pending_review),
approvedCount: Number(row.approved_count),
rejectedCount: Number(row.rejected_count),
needsEditCount: Number(row.needs_edit_count),
todayCount: Number(row.today_count),
},
};
} catch (err) {
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error',
};
}
}
