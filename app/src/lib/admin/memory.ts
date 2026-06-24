import { getToken } from '@/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AdminMemoryStatus {
  answerCandidates: {
    total_candidates?: number;
    pending_review?: number;
    approved_count?: number;
    approved_for_publication?: number;
    published_examples?: number;
    captured_today?: number;
  };
  seoExpansionPages: {
    total_pages?: number;
    approved_pages?: number;
    published_pages?: number;
    sitemap_pages?: number;
    noindex_pages?: number;
  };
  questionStateIndex: {
    tracked_question_states?: number;
    users_with_question_state?: number;
  };
  dashboardAgentMemory?: {
    total_entries?: number;
    users_with_agent_memory?: number;
    captured_today?: number;
  };
  planLimits: Array<{
    plan_type: string;
    name: string;
    max_turns_per_session: number;
    max_sessions_per_day: number;
    can_use_ai: boolean;
    can_choose_provider: boolean;
    can_choose_model: boolean;
  }>;
  notes: string[];
}

export async function fetchAdminMemoryStatus(): Promise<AdminMemoryStatus> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/admin/memory-status`, {
    method: 'GET',
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to load memory status');
  }
  return payload as AdminMemoryStatus;
}
