import { getToken } from '@/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AdminSponsorLink {
  id: string;
  slug: string;
  title: string;
  sponsorName: string;
  destinationUrl: string;
  disclosureLabel: string;
  notes: string;
  isActive: boolean;
  clickCount: number;
  uniqueUsers: number;
  lastClickAt?: string | null;
  trackingUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSponsorLinkInput {
  title: string;
  sponsorName?: string;
  destinationUrl: string;
  disclosureLabel?: string;
  notes?: string;
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Request failed');
  }
  return payload as T;
}

export async function fetchAdminSponsorLinks(): Promise<AdminSponsorLink[]> {
  const payload = await requestJson<{ links?: AdminSponsorLink[] }>('/api/admin/sponsor-links');
  return payload.links || [];
}

export async function createAdminSponsorLink(input: CreateSponsorLinkInput): Promise<AdminSponsorLink> {
  const payload = await requestJson<{ link?: AdminSponsorLink }>('/api/admin/sponsor-links', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!payload.link) {
    throw new Error('Sponsor link was not returned');
  }
  return payload.link;
}

export async function updateAdminSponsorLink(
  linkId: string,
  input: Partial<CreateSponsorLinkInput> & { isActive?: boolean }
): Promise<AdminSponsorLink> {
  const payload = await requestJson<{ link?: AdminSponsorLink }>(`/api/admin/sponsor-links/${linkId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!payload.link) {
    throw new Error('Sponsor link was not returned');
  }
  return payload.link;
}
