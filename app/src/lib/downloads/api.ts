/**
* PDF Download Tracking API
*
* Functions for recording and retrieving PDF download events.
* All data is stored in Supabase (authoritative source of truth).
*/

import { apiClient } from '@/lib/apiClient';
import type {
PDFDownloadEvent,
PDFDownloadSummary,
RecordDownloadInput,
RefundDownloadEvidence,
DownloadEventStatus,
DownloadSource,
DownloadReviewFlag,
AdminRefundRequestWithDownloads
} from './types';

/**
* Record a PDF download event in Supabase
*
* This should be called when a user initiates a PDF download.
* The function records the event and updates the user's download summary.
*
* @param input Download event data
* @returns Success status and event ID
*/
export async function recordPDFDownload(
input: RecordDownloadInput
): Promise<{ success: boolean; eventId?: string; error?: string }> {
try {
// Get current user
const { data: user, error: authError } = await apiClient.auth.getUser();

if (authError || !user) {
// Still record the download attempt even if not logged in
// (for analytics, though less useful for refund review)
console.warn('PDF download attempted without authenticated user');
}

// Call the Supabase function to record the download
const { data, error } = await apiClient
.rpc('record_pdf_download', {
userId: user?.id || null,
userEmail: user?.email || null,
pdfFilename: input.pdfFilename,
pdfTitle: input.pdfTitle || null,
topicId: input.topicId || null,
categoryId: input.categoryId || null,
downloadSource: input.downloadSource,
eventStatus: input.eventStatus || 'requested',
sessionHash: null,
userAgentHash: null,
});

if (error) {
console.error('Error recording PDF download:', error);
return { success: false, error: error.message };
}

  return { success: true, eventId: data as unknown as string };
} catch (err) {
console.error('Error in recordPDFDownload:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Update a download event status
*
* Use this to update the status from 'requested' to 'served' or 'completed_estimated'
* when you have more information about the download outcome.
*
* @param eventId The download event ID
* @param status The new status
*/
export async function updateDownloadEventStatus(
eventId: string,
status: DownloadEventStatus
): Promise<{ success: boolean; error?: string }> {
try {
const { error } = await apiClient
.from('pdf_download_events')
.update({ event_status: status })
.eq('id', eventId);

if (error) {
console.error('Error updating download status:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Error in updateDownloadEventStatus:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get download summary for a user
*
* @param userId The user ID
* @returns Download summary or null
*/
export async function getUserDownloadSummary(
userId: string
): Promise<{ success: boolean; data?: PDFDownloadSummary; error?: string }> {
try {
const { data, error } = await apiClient
.rpc('get_user_download_summary', {
userId,
});

if (error) {
console.error('Error fetching download summary:', error);
return { success: false, error: error.message };
}

  if (!data || (data as unknown[]).length === 0) {
// Return default empty summary
return {
success: true,
data: {
id: '',
userId,
totalDownloads: 0,
uniquePdfsDownloaded: 0,
firstDownloadAt: null,
lastDownloadAt: null,
hasDownloaded: false,
reviewFlag: 'no_downloads',
reviewNote: 'No PDF download activity recorded.',
updatedAt: new Date().toISOString(),
},
};
}

  const summary = (data as Record<string, unknown>[])[0];
  return {
    success: true,
    data: {
      id: '',
      userId,
      totalDownloads: summary.total_downloads as number,
      uniquePdfsDownloaded: summary.unique_pdfs_downloaded as number,
      firstDownloadAt: summary.first_download_at as string | null,
      lastDownloadAt: summary.last_download_at as string | null,
      hasDownloaded: summary.has_downloaded as boolean,
      reviewFlag: summary.review_flag as DownloadReviewFlag,
      reviewNote: summary.review_note as string,
updatedAt: new Date().toISOString(),
},
};
} catch (err) {
console.error('Error in getUserDownloadSummary:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get download events for a user
*
* @param userId The user ID
* @param limit Maximum number of events to return
* @returns Array of download events
*/
export async function getUserDownloadEvents(
userId: string,
limit: number = 50
): Promise<{ success: boolean; data?: PDFDownloadEvent[]; error?: string }> {
try {
const { data, error } = await apiClient
.rpc('get_user_download_events', {
userId,
limit,
});

if (error) {
console.error('Error fetching download events:', error);
return { success: false, error: error.message };
}

  const events: PDFDownloadEvent[] = ((data as Record<string, unknown>[]) || []).map((event) => ({
id: event.id as string,
userId,
pdfFilename: event.pdf_filename as string,
pdfTitle: event.pdf_title as string | undefined,
downloadSource: event.download_source as DownloadSource,
eventStatus: event.event_status as DownloadEventStatus,
createdAt: event.created_at as string,
}));

return { success: true, data: events };
} catch (err) {
console.error('Error in getUserDownloadEvents:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get complete download evidence for refund review
*
* Combines summary and recent events for admin review.
*
* @param userId The user ID
* @returns Complete download evidence
*/
export async function getRefundDownloadEvidence(
userId: string
): Promise<{ success: boolean; data?: RefundDownloadEvidence; error?: string }> {
try {
// Get summary and events in parallel
const [summaryResult, eventsResult] = await Promise.all([
getUserDownloadSummary(userId),
getUserDownloadEvents(userId, 10), // Last 10 downloads
]);

if (!summaryResult.success) {
return { success: false, error: summaryResult.error };
}

const summary = summaryResult.data!;
const events = eventsResult.success ? eventsResult.data || [] : [];

return {
success: true,
data: {
totalDownloads: summary.totalDownloads,
uniquePdfsDownloaded: summary.uniquePdfsDownloaded,
firstDownloadAt: summary.firstDownloadAt,
lastDownloadAt: summary.lastDownloadAt,
hasDownloaded: summary.hasDownloaded,
reviewFlag: summary.reviewFlag,
reviewNote: summary.reviewNote,
recentDownloads: events,
},
};
} catch (err) {
console.error('Error in getRefundDownloadEvidence:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get refund requests with download summaries (admin only)
*
* @returns Array of refund requests with download evidence
*/
export async function getRefundRequestsWithDownloads(): Promise<{
success: boolean;
data?: AdminRefundRequestWithDownloads[];
error?: string;
}> {
try {
const { data, error } = await apiClient
.rpc('get_refund_request_with_download_summary', {});

if (error) {
console.error('Error fetching refunds with downloads:', error);
return { success: false, error: error.message };
}

  const refunds: AdminRefundRequestWithDownloads[] = ((data as Record<string, unknown>[]) || []).map((row) => ({
refundId: row.refund_id as string,
userId: row.user_id as string,
userEmail: row.user_email as string,
planType: row.plan_type as string,
amount: parseFloat(row.amount as string),
currency: row.currency as string,
daysSincePurchase: row.days_since_purchase as number,
questionsCompleted: row.questions_completed as number,
mockInterviewsCompleted: row.mock_interviews_completed as number,
eligibilityStatus: row.eligibility_status as string,
reason: row.reason as string,
createdAt: row.created_at as string,
totalPdfDownloads: row.total_pdf_downloads as number,
uniquePdfsDownloaded: row.unique_pdfs_downloaded as number,
firstDownloadAt: row.first_download_at as string | null,
lastDownloadAt: row.last_download_at as string | null,
downloadReviewFlag: row.download_review_flag as DownloadReviewFlag,
downloadReviewNote: row.download_review_note as string,
}));

return { success: true, data: refunds };
} catch (err) {
console.error('Error in getRefundRequestsWithDownloads:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Simple function to track a download from the UI
*
* This is a convenience wrapper that handles the common case
* of tracking a download when the user clicks the download button.
*
* @param pdfFilename The PDF filename
* @param pdfTitle The PDF title (optional)
* @param topicId The topic ID (optional)
* @param categoryId The category ID (optional)
* @param source The download source
*/
export async function trackPDFDownload(
pdfFilename: string,
pdfTitle?: string,
topicId?: string,
categoryId?: string,
source: DownloadSource = 'topic_page'
): Promise<void> {
// Fire and forget - don't block the download on tracking
recordPDFDownload({
pdfFilename,
pdfTitle,
topicId,
categoryId,
downloadSource: source,
eventStatus: 'requested',
}).catch((err) => {
// Log but don't throw - download should still work
console.warn('Failed to track PDF download (non-critical):', err);
});
}
