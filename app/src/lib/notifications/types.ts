/**
 * Notifications, Broadcasts, and Support Tickets Types
 */

// ============================================================================
// Notifications
// ============================================================================

export type NotificationType = 'general' | 'refund' | 'subscription' | 'support' | 'milestone' | 'broadcast';

export interface UserNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  dismissedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Broadcasts
// ============================================================================

export type BroadcastAudience = 'all_users' | 'free_users' | 'robin_users' | 'unread_message_users' | 'reengagement_users';

export interface BroadcastAnalytics {
  delivered: number;
  opened: number;
  clicked: number;
  dismissed: number;
  clickEvents?: number;
  openRate: number;
  clickRate: number;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  audienceType: BroadcastAudience;
  isActive: boolean;
  sentCount: number;
  analytics?: BroadcastAnalytics;
  scheduledAt?: string | null;
  sendEmail?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBroadcastInput {
  title: string;
  message: string;
  audienceType: BroadcastAudience;
  scheduledAt?: string | null;
  sendEmail?: boolean;
  publishNow?: boolean;
}

export const BROADCAST_AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all_users: 'All Users',
  free_users: 'Free Members',
  robin_users: 'Robin Users Today',
  unread_message_users: 'Users With Unread Messages',
  reengagement_users: 'Re-engagement Users',
};

// ============================================================================
// Support Tickets
// ============================================================================

export type TicketCategory = 'billing' | 'refund' | 'technical' | 'account' | 'feature_request' | 'other';
export type TicketStatus = 'open' | 'replied' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  category: TicketCategory;
  message: string;
  status: TicketStatus;
  adminReply?: string;
  aiSummary?: string;
  aiSuggestedReply?: string;
  aiTriage?: Record<string, unknown>;
  aiConversation?: SupportConversationMessage[];
  adminUrgent?: boolean;
  repliedBy?: string;
  repliedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportConversationMessage {
  role: 'user' | 'assistant' | 'admin';
  content: string;
  source?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminSupportTicket extends SupportTicket {
  userEmail: string;
  refundSignal?: boolean;
  cancelSignal?: boolean;
  refundEligibility?: {
    status?: string;
    note?: string;
    daysSincePurchase?: number | null;
    questionsCompleted?: number;
    mockInterviewsCompleted?: number;
    downloadReviewFlag?: string;
  };
  retentionOffer?: {
    eligible: boolean;
    label: string;
    amountCents: number;
    amount: number;
    currency: string;
    message: string;
  };
  subscription?: {
    planType?: string;
    planLabel?: string;
    status?: string;
  };
  usage?: {
    questionsCompleted?: number;
    mockInterviewsCompleted?: number;
    totalPdfDownloads?: number;
    uniquePdfsDownloaded?: number;
    downloadReviewFlag?: string;
    downloadReviewNote?: string;
  };
}

export interface CreateTicketInput {
  subject: string;
  category: TicketCategory;
  message: string;
  aiSummary?: string;
  aiSuggestedReply?: string;
  aiTriage?: Record<string, unknown>;
}

export interface SupportAiAssistInput {
  subject?: string;
  category?: TicketCategory | '';
  message?: string;
}

export interface SupportAiAssistResponse {
  reply: string;
  summary: string;
  suggestedTicketSubject: string;
  recommendedCategory: TicketCategory;
  shouldCreateTicket: boolean;
  urgency: 'low' | 'normal' | 'high';
  canResolve?: boolean;
  needsAdminReview?: boolean;
  escalationReason?: string;
  provider: string;
  model?: string | null;
  fallback?: boolean;
  providerFallback?: boolean;
  requestedProvider?: string;
  requestedModel?: string | null;
}

export interface AdminSupportDraftResponse {
  reply: string;
  summary: string;
  urgency: 'low' | 'normal' | 'high';
  refundEligibilityStatus?: string;
  retentionOfferRecommended?: boolean;
  notifyAdmin?: boolean;
  internalNotes?: string;
  provider: string;
  model?: string | null;
  fallback?: boolean;
  providerFallback?: boolean;
}

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'billing', label: 'Billing Issue' },
  { value: 'refund', label: 'Refund Request' },
  { value: 'technical', label: 'Technical Problem' },
  { value: 'account', label: 'Account Question' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  replied: 'Replied',
  closed: 'Closed',
};
