// Admin and Ad Management System

export type AdNetwork = 'ezoic' | 'adsense' | 'monetag' | 'propellerads' | 'adsterra' | 'medianet';

export interface AdConfig {
  enabled: boolean;
  network: AdNetwork;
  publisherId: string;
  slotId?: string;
  scriptUrl?: string;
  customHtml?: string;
}

export interface AdminSettings {
  adsEnabled: boolean;
  interstitialBeforeDownload: boolean;
  interstitialDelay: number; // seconds before skip button appears
  showEmptyPageFallback: boolean;
  activeNetworks: AdNetwork[];
  adConfigs: Record<AdNetwork, AdConfig>;
}

export const defaultAdminSettings: AdminSettings = {
  adsEnabled: false,
  interstitialBeforeDownload: false,
  interstitialDelay: 5,
  showEmptyPageFallback: false,
  activeNetworks: [],
  adConfigs: {
    ezoic: {
      enabled: false,
      network: 'ezoic',
      publisherId: '',
    },
    adsense: {
      enabled: false,
      network: 'adsense',
      publisherId: '',
      slotId: '',
    },
    monetag: {
      enabled: false,
      network: 'monetag',
      publisherId: '',
      scriptUrl: '',
    },
    propellerads: {
      enabled: false,
      network: 'propellerads',
      publisherId: '',
    },
    adsterra: {
      enabled: false,
      network: 'adsterra',
      publisherId: '',
    },
    medianet: {
      enabled: false,
      network: 'medianet',
      publisherId: '',
      slotId: '',
    },
  },
};

// Simple hash function for password (not secure, but sufficient for this use case)
export const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

// Default admin password: "admin123" (change this in production)
export const ADMIN_PASSWORD_HASH = 'c63bc483';

export const adNetworkInfo: Record<AdNetwork, { name: string; description: string; fields: string[] }> = {
  ezoic: {
    name: 'Ezoic',
    description: 'AI-powered ad optimization platform',
    fields: ['Publisher ID'],
  },
  adsense: {
    name: 'Google AdSense',
    description: 'Google\'s ad network for publishers',
    fields: ['Publisher ID (ca-pub-XXXXXXXX)', 'Ad Slot ID'],
  },
  monetag: {
    name: 'Monetag',
    description: 'High CPM ad network with multiple formats',
    fields: ['Publisher ID', 'Script URL'],
  },
  propellerads: {
    name: 'PropellerAds',
    description: 'Multi-format ad network with push notifications',
    fields: ['Publisher ID'],
  },
  adsterra: {
    name: 'Adsterra',
    description: 'Global ad network with various formats',
    fields: ['Publisher ID'],
  },
  medianet: {
    name: 'Media.net',
    description: 'Yahoo/Bing contextual ad network',
    fields: ['Publisher ID', 'Ad Slot ID'],
  },
};
