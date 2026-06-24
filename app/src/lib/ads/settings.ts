const API_URL = import.meta.env.VITE_API_URL || '';

export type PublicAdStatus = 'disabled' | 'verification_only' | 'active';

export interface PublicAdSettings {
  status: PublicAdStatus;
  adsensePublisherId: string;
  adsenseSlotId: string;
  placements: Record<string, boolean>;
}

export async function fetchPublicAdSettings(): Promise<PublicAdSettings> {
  const response = await fetch(`${API_URL}/api/ad-settings/public`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to load ad settings');
  }

  return payload.settings as PublicAdSettings;
}
