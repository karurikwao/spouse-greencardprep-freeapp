import { getToken } from '@/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export type StripeMode = 'test' | 'live' | 'not_configured' | 'unknown';

export interface AdminProviderStatus {
  provider: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  modelCount: number;
  apiKeyConfigured?: boolean;
  baseUrlConfigured?: boolean;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  baseUrlEnvVar?: string;
  defaultModelEnvVar?: string;
  openAICompatible?: boolean;
  configurationHint?: string;
  managedInAdmin?: boolean;
}

export interface AdminAIProviderSetting {
  enabled?: boolean;
  label?: string;
  openAICompatible?: boolean;
  custom?: boolean;
  defaultModel?: string;
  baseUrl?: string;
  apiKey?: string;
  keepExistingApiKey?: boolean;
  apiKeyConfigured?: boolean;
  apiKeyMasked?: string;
}

export type AdminAIRoleId = 'robin' | 'support' | 'admin_support';

export interface AdminAIRoleAssignment {
  label: string;
  routingPolicy: string;
  defaultModelRef: string;
  enabledModelRefs: string[];
  fallbackModelRefs: string[];
  fallbackTimeoutSeconds: number;
}

export interface AdminAISettings {
  defaultProvider: string;
  defaultModel: string;
  fallbackProviders: string[];
  providers: Record<string, AdminAIProviderSetting>;
  modelCatalog?: Record<string, string[]>;
  roleAssignments?: Record<AdminAIRoleId, AdminAIRoleAssignment>;
}

export interface AdminLawyerDirectoryEntry {
  id: string;
  active: boolean;
  name: string;
  firm: string;
  states: string;
  practiceAreas: string;
  description: string;
  website: string;
  affiliateUrl: string;
  imageUrl: string;
  email: string;
  phone: string;
  priority: number;
}

export interface AdminLawyerDirectorySettings {
  enabled: boolean;
  introText: string;
  affiliateDisclosure: string;
  lawyers: AdminLawyerDirectoryEntry[];
}

export interface AdminWelcomeMessageSettings {
  signupEnabled: boolean;
  upgradeEnabled: boolean;
  sendEmail: boolean;
  signupTitle: string;
  signupMessage: string;
  upgradeTitle: string;
  upgradeMessage: string;
}

export type AdminAdSettingsStatus = 'disabled' | 'verification_only' | 'active';

export interface AdminAdSettings {
  status: AdminAdSettingsStatus;
  adsensePublisherId: string;
  adsenseSlotId: string;
  includeAdsenseMeta: boolean;
  includeAdsenseScript: boolean;
  enableAdsTxt: boolean;
  adsTxt: string;
  placements: Record<string, boolean>;
}

export type PdfDownloadOfferFrequency = 'always' | 'once_per_session' | 'once_per_day';

export interface AdminPdfDownloadOfferSettings {
  enabled: boolean;
  disclosureLabel: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  continueLabel: string;
  frequency: PdfDownloadOfferFrequency;
  sources: Record<string, boolean>;
}

export interface AdminPdfDownloadOfferStats {
  offer_id: string;
  source: string;
  impressions: number;
  cta_clicks: number;
  body_link_clicks: number;
  dismissals: number;
  continues: number;
  last_event_at?: string | null;
}

export interface AdminRobinMessagePack {
  id: string;
  label: string;
  messages: number;
  priceCents: number;
  expirationDays: number;
  rollover: boolean;
  active: boolean;
}

export interface AdminRobinUsageSettings {
  dailyFreeMessages: number;
  dailyResetTimezone: string;
  emergencyPause: boolean;
  pauseMessage: string;
  freeMessagesRollover: boolean;
  paidMessagesRollover: boolean;
  paidCreditExpirationDays: number;
  paidPacks: AdminRobinMessagePack[];
}

export interface AdminStripePriceStatus {
  planType: 'monthly' | 'lifetime' | 'interviewPass';
  label: string;
  configured: boolean;
  envVar: string;
  expectedAmount: number;
  currency: string;
  mode: 'subscription' | 'payment';
}

export interface AdminSystemStatus {
  serverTime: string;
  environment: string;
  frontendUrl: string;
  ai: {
    defaultProvider: string;
    defaultModel: string;
    providers: AdminProviderStatus[];
    settings?: AdminAISettings;
  };
  stripe: {
    mode: StripeMode;
    secretKeyConfigured: boolean;
    publishableKeyConfigured: boolean;
    webhookConfigured: boolean;
    autoCreateTestPrices: boolean;
    checkoutReady: boolean;
    webhookReady: boolean;
    prices: Record<'monthly' | 'lifetime' | 'interviewPass', AdminStripePriceStatus>;
  };
  database: {
    urlConfigured: boolean;
  };
  email: {
    provider: 'plunk' | 'dev';
    plunkConfigured: boolean;
    fromConfigured: boolean;
    fromAddress: string;
    apiUrl?: string;
  };
}

export async function fetchAdminSystemStatus(): Promise<AdminSystemStatus> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/admin/system-status`, {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to load admin system status');
  }

  return payload as AdminSystemStatus;
}

async function adminJson<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Admin request failed');
  }
  return payload as T;
}

export async function fetchAdminAISettings(): Promise<AdminAISettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminAISettings }>('/api/admin/ai-settings');
  return payload.settings;
}

export async function saveAdminAISettings(settings: AdminAISettings): Promise<AdminAISettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminAISettings }>('/api/admin/ai-settings', 'POST', settings);
  return payload.settings;
}

export async function refreshAdminAIProviderModels(
  provider: string,
  providerConfig?: AdminAIProviderSetting
): Promise<string[]> {
  const payload = await adminJson<{ success: boolean; provider: string; models: string[] }>('/api/admin/ai-provider-models', 'POST', {
    provider,
    providerConfig,
  });
  return payload.models || [];
}

export async function fetchAdminLawyerDirectory(): Promise<AdminLawyerDirectorySettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminLawyerDirectorySettings }>('/api/admin/lawyer-directory');
  return payload.settings;
}

export async function saveAdminLawyerDirectory(settings: AdminLawyerDirectorySettings): Promise<AdminLawyerDirectorySettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminLawyerDirectorySettings }>('/api/admin/lawyer-directory', 'POST', settings);
  return payload.settings;
}

export async function fetchAdminWelcomeMessages(): Promise<AdminWelcomeMessageSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminWelcomeMessageSettings }>('/api/admin/welcome-messages');
  return payload.settings;
}

export async function saveAdminWelcomeMessages(settings: AdminWelcomeMessageSettings): Promise<AdminWelcomeMessageSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminWelcomeMessageSettings }>('/api/admin/welcome-messages', 'POST', settings);
  return payload.settings;
}

export async function fetchAdminAdSettings(): Promise<AdminAdSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminAdSettings }>('/api/admin/ad-settings');
  return payload.settings;
}

export async function saveAdminAdSettings(settings: AdminAdSettings): Promise<AdminAdSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminAdSettings }>('/api/admin/ad-settings', 'POST', settings);
  return payload.settings;
}

export async function fetchAdminPdfDownloadOffer(): Promise<AdminPdfDownloadOfferSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminPdfDownloadOfferSettings }>('/api/admin/pdf-download-offer');
  return payload.settings;
}

export async function fetchAdminPdfDownloadOfferStats(): Promise<AdminPdfDownloadOfferStats[]> {
  const payload = await adminJson<{ success: boolean; stats?: AdminPdfDownloadOfferStats[] }>('/api/admin/pdf-download-offer');
  return payload.stats || [];
}

export async function saveAdminPdfDownloadOffer(
  settings: AdminPdfDownloadOfferSettings
): Promise<AdminPdfDownloadOfferSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminPdfDownloadOfferSettings }>(
    '/api/admin/pdf-download-offer',
    'POST',
    settings
  );
  return payload.settings;
}

export async function fetchAdminRobinUsageSettings(): Promise<AdminRobinUsageSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminRobinUsageSettings }>('/api/admin/robin-usage-settings');
  return payload.settings;
}

export async function saveAdminRobinUsageSettings(settings: AdminRobinUsageSettings): Promise<AdminRobinUsageSettings> {
  const payload = await adminJson<{ success: boolean; settings: AdminRobinUsageSettings }>('/api/admin/robin-usage-settings', 'POST', settings);
  return payload.settings;
}
