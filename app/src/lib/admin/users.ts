import { getToken } from '@/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AdminUserSnapshot {
  id: string;
  email: string;
  joined_at: string;
  updated_at: string;
  display_name: string;
  role: 'user' | 'admin' | 'superadmin';
  is_active: boolean;
  plan_type: 'trial' | 'monthly' | 'lifetime' | 'interviewPass';
  subscription_status: string;
  provider?: string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
  ends_at?: string | null;
  total_downloads: number;
  unique_pdfs_downloaded: number;
  last_download_at?: string | null;
  total_tickets: number;
  open_tickets: number;
  last_ticket_at?: string | null;
  connected_partners: number;
  pending_partners: number;
  ai_sessions_total: number;
  ai_turns_total: number;
  ai_sessions_today: number;
  ai_turns_today: number;
  last_ai_at?: string | null;
  messages_received: number;
  unread_messages: number;
  last_message_at?: string | null;
  messages_opened: number;
  messages_clicked: number;
  last_message_event_at?: string | null;
  saved_questions: number;
  topics_touched: number;
  topics_started: number;
  topics_completed: number;
  last_activity_at?: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserSnapshot[];
  totals: {
    totalUsers: number;
    paidUsers: number;
    trialUsers: number;
    freeUsers?: number;
    usersWithOpenTickets: number;
    robinActiveToday: number;
    usersWithUnreadMessages: number;
  };
}

export interface AdminUserActivityItem {
  kind: string;
  title: string;
  detail: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

export interface AdminUserDailyAiUsage {
  usage_date: string;
  sessions_count: number;
  total_turns: number;
  updated_at?: string | null;
}

export interface AdminUserRecentDownload {
  id: string;
  title: string;
  pdf_filename: string;
  topic_id?: string | null;
  category_id?: string | null;
  download_source?: string | null;
  event_status?: string | null;
  created_at: string;
}

export interface AdminUserMessageStats {
  received: number;
  unread: number;
  opened: number;
  clicked: number;
  last_received_at?: string | null;
  last_engaged_at?: string | null;
}

export interface AdminRobinCreditGrant {
  id: string;
  source_type: string;
  pack_id?: string | null;
  label: string;
  messages_granted: number;
  messages_used: number;
  messages_remaining: number;
  expires_at?: string | null;
  rollover: boolean;
  status: string;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminRobinCreditLedgerEntry {
  id: string;
  grant_id?: string | null;
  event_type: 'grant' | 'purchase' | 'usage' | 'adjustment' | 'void';
  messages_delta: number;
  balance_after: number;
  reference_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AdminRobinCreditSummary {
  balance: number;
  activeGrantCount: number;
  expiredMessages: number;
  totalGranted: number;
  totalUsed: number;
  grants: AdminRobinCreditGrant[];
  ledger: AdminRobinCreditLedgerEntry[];
}

export interface AdminUserActivityResponse {
  user: Pick<AdminUserSnapshot, 'id' | 'email' | 'display_name' | 'role' | 'is_active' | 'joined_at' | 'updated_at'>;
  activity: AdminUserActivityItem[];
  dailyAiUsage: AdminUserDailyAiUsage[];
  recentDownloads: AdminUserRecentDownload[];
  messageStats: AdminUserMessageStats;
  robinCredits?: AdminRobinCreditSummary;
}

export async function fetchAdminUsers(limit = 100): Promise<AdminUsersResponse> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/admin/users?limit=${limit}`, {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to load users');
  }

  return payload as AdminUsersResponse;
}

export async function fetchAdminUserActivity(userId: string): Promise<AdminUserActivityResponse> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/admin/users/${userId}/activity`, {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to load user activity');
  }

  return payload as AdminUserActivityResponse;
}

export async function sendAdminUserMessage(
  userId: string,
  input: { title: string; message: string; sendEmail?: boolean }
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/admin/users/${userId}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to send user message');
  }
}

export async function grantAdminUserRobinCredits(
  userId: string,
  input: { messages: number; label?: string; expirationDays?: number; note?: string; rollover?: boolean; packId?: string }
): Promise<AdminRobinCreditSummary> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/admin/users/${userId}/robin-credits`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to grant Robin credits');
  }

  return payload.credits as AdminRobinCreditSummary;
}
