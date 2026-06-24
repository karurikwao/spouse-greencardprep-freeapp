import { apiClient } from '@/lib/apiClient';

export interface DashboardAgentEntry {
  id: string;
  question: string;
  answer: string;
  provider?: string | null;
  model?: string | null;
  tags: string[];
  source: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  providerFallback?: boolean;
  turnsRemaining?: number | null;
  planType?: string | null;
  tokenEstimate?: number | null;
}

export async function askDashboardAgent(question: string, context?: Record<string, unknown>) {
  return apiClient.invokeFunction<DashboardAgentEntry>('dashboard-agent-question', {
    question,
    context,
  });
}

export async function loadDashboardAgentHistory(limit = 8) {
  return apiClient.invokeFunction<{ entries: DashboardAgentEntry[] }>('dashboard-agent-history', {
    limit,
  });
}
