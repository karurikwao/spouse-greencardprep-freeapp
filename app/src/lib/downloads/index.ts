/**
 * PDF Download Tracking Module
 * 
 * Tracks PDF downloads to support refund review decisions.
 * 
 * CORE PRINCIPLE:
 * - For refund review support, NOT for blocking downloads
 * - Admin visibility only
 * - Honest about certainty vs estimation
 * - Privacy-minimized data
 */

// Types
export type {
  DownloadEventStatus,
  DownloadSource,
  DownloadReviewFlag,
  PDFDownloadEvent,
  PDFDownloadSummary,
  RecordDownloadInput,
  RefundDownloadEvidence,
  AdminRefundRequestWithDownloads,
} from './types';

// Constants
export { DOWNLOAD_REVIEW_HELP_TEXT } from './types';

// API Functions
export {
  recordPDFDownload,
  updateDownloadEventStatus,
  getUserDownloadSummary,
  getUserDownloadEvents,
  getRefundDownloadEvidence,
  getRefundRequestsWithDownloads,
  trackPDFDownload,
} from './api';

// Secure Access (NEW - for protected PDF delivery)
export {
  requestSecurePDFAccess,
  downloadPDFWithSignedUrl,
  requiresSecureDelivery,
} from './secureAccess';
export type {
  SecurePDFAccessRequest,
  SecurePDFAccessResult,
} from './secureAccess';
