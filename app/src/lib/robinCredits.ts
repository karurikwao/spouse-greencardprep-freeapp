import { getToken } from '@/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface RobinCreditPack {
  id: string;
  label: string;
  messages: number;
  priceCents: number;
  expirationDays: number;
  rollover: boolean;
}

export interface RobinCreditGrant {
  id: string;
  label: string;
  messages_granted: number;
  messages_used: number;
  messages_remaining: number;
  expires_at?: string | null;
  status: string;
  is_expired?: boolean;
}

export interface RobinCreditSummary {
  balance: number;
  activeGrantCount: number;
  expiredMessages: number;
  totalGranted: number;
  totalUsed: number;
  grants: RobinCreditGrant[];
  ledger: Array<Record<string, unknown>>;
}

export interface RobinCreditPackResponse {
  success: boolean;
  checkoutEnabled: boolean;
  dailyFreeMessages: number;
  paidMessagesRollover: boolean;
  packs: RobinCreditPack[];
}

async function jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Request failed');
  }
  return payload as T;
}

export async function fetchRobinCreditPacks(): Promise<RobinCreditPackResponse> {
  return jsonRequest<RobinCreditPackResponse>('/api/robin/credit-packs');
}

export async function fetchRobinCreditSummary(): Promise<RobinCreditSummary> {
  const payload = await jsonRequest<{ success: boolean; credits: RobinCreditSummary }>('/api/robin/credits');
  return payload.credits;
}

export async function startRobinCreditCheckout(packId: string): Promise<string> {
  const payload = await jsonRequest<{ success: boolean; checkoutUrl?: string }>('/api/stripe/create-robin-credit-checkout-session', {
    method: 'POST',
    body: JSON.stringify({
      packId,
      successUrl: `${window.location.origin}/robin?credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/robin?credits=cancelled`,
    }),
  });
  if (!payload.checkoutUrl) {
    throw new Error('No Checkout URL returned');
  }
  return payload.checkoutUrl;
}

export async function confirmRobinCreditCheckout(sessionId: string): Promise<RobinCreditSummary | null> {
  const payload = await jsonRequest<{ success: boolean; credits?: RobinCreditSummary }>('/api/stripe/confirm-robin-credit-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
  return payload.credits || null;
}
