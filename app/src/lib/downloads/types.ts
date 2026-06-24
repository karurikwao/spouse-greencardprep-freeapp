/**
 * PDF Download Tracking Types
 * 
 * Types for tracking PDF downloads to support refund review.
 * This system is for admin visibility only - NOT for blocking downloads.
 */

/**
 * Download event status - honest about certainty
 * - 'requested': User clicked download button
 * - 'access_granted': Secure access approved, signed URL generated
 * - 'denied': Access denied (no subscription or expired)
 * - 'served': File was sent to browser
 * - 'completed_estimated': Browser likely saved file (estimated)
 */
export type DownloadEventStatus = 
  | 'requested' 
  | 'access_granted'
  | 'denied'
  | 'served' 
  | 'completed_estimated';

/**
 * Source of the download
 */
export type DownloadSource = 
  | 'topic_page'      // Downloaded from topic detail page
  | 'practice_mode'   // Downloaded from practice mode
  | 'direct_link'     // Direct PDF link access
  | 'email_link'      // Accessed via email link
  | 'admin_test';     // Admin testing the download

/**
 * Review flag for refund review guidance
 * - 'no_downloads': No PDF download activity recorded
 * - 'downloaded_once': Downloaded one PDF
 * - 'downloaded_multiple': Downloaded 2-5 PDFs
 * - 'heavy_usage': Downloaded 6+ PDFs
 */
export type DownloadReviewFlag = 
  | 'no_downloads' 
  | 'downloaded_once' 
  | 'downloaded_multiple' 
  | 'heavy_usage';

/**
 * Single PDF download event
 */
export interface PDFDownloadEvent {
  id: string;
  userId: string;
  userEmail?: string;
  
  // PDF identification
  pdfFilename: string;
  pdfTitle?: string;
  topicId?: string;
  categoryId?: string;
  
  // Context
  downloadSource: DownloadSource;
  eventStatus: DownloadEventStatus;
  
  // Timestamp
  createdAt: string;
  
  // Privacy-minimized metadata (optional)
  sessionHash?: string;
  userAgentHash?: string;
}

/**
 * Pre-computed download summary for a user
 */
export interface PDFDownloadSummary {
  id: string;
  userId: string;
  
  // Statistics
  totalDownloads: number;
  uniquePdfsDownloaded: number;
  firstDownloadAt: string | null;
  lastDownloadAt: string | null;
  
  // Refund review guidance
  hasDownloaded: boolean;
  reviewFlag: DownloadReviewFlag;
  reviewNote: string;
  
  // Metadata
  updatedAt: string;
}

/**
 * Download data for recording a new event
 */
export interface RecordDownloadInput {
  pdfFilename: string;
  pdfTitle?: string;
  topicId?: string;
  categoryId?: string;
  downloadSource: DownloadSource;
  eventStatus?: DownloadEventStatus;
}

/**
 * Download evidence for refund review
 */
export interface RefundDownloadEvidence {
  // Download statistics
  totalDownloads: number;
  uniquePdfsDownloaded: number;
  firstDownloadAt: string | null;
  lastDownloadAt: string | null;
  
  // Review guidance
  hasDownloaded: boolean;
  reviewFlag: DownloadReviewFlag;
  reviewNote: string;
  
  // Recent download events (for detailed review)
  recentDownloads: PDFDownloadEvent[];
}

/**
 * Admin refund request with download summary
 * Extends the base refund request with download evidence
 */
export interface AdminRefundRequestWithDownloads {
  // Refund request fields
  refundId: string;
  userId: string;
  userEmail: string;
  planType: string;
  amount: number;
  currency: string;
  daysSincePurchase: number;
  questionsCompleted: number;
  mockInterviewsCompleted: number;
  eligibilityStatus: string;
  reason: string;
  additionalComments?: string;
  createdAt: string;
  
  // Download evidence
  totalPdfDownloads: number;
  uniquePdfsDownloaded: number;
  firstDownloadAt: string | null;
  lastDownloadAt: string | null;
  downloadReviewFlag: DownloadReviewFlag;
  downloadReviewNote: string;
}

/**
 * Help text for admin dashboard
 */
export const DOWNLOAD_REVIEW_HELP_TEXT = {
  title: 'PDF Download Activity',
  description: 'This shows PDF download activity to help with refund review decisions.',
  honestyNote: 'Note: Download "completion" is estimated. We can confirm the file was served to the browser, but cannot guarantee the user saved it.',
  noDownloads: 'No PDF downloads recorded for this user.',
  downloadedOnce: 'Downloaded one PDF. Limited content access.',
  downloadedMultiple: 'Downloaded multiple PDFs. Moderate content access.',
  heavyUsage: 'Downloaded many PDFs. Significant content access.',
  guidance: 'Use this data as one factor in refund decisions, not the sole determinant.',
} as const;
