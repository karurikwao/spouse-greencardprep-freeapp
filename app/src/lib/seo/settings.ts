import { apiClient } from '@/lib/apiClient';

export type SitemapFrequency = 'daily' | 'weekly' | 'monthly';

export interface SEOSettings {
  sitemapFrequency: SitemapFrequency;
}

export function getFrequencyOptions(): Array<{ value: SitemapFrequency; label: string }> {
  return [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];
}

export async function getSEOSettingsAsync(): Promise<SEOSettings> {
  const { data, error } = await apiClient
    .from('seo_settings')
    .select('sitemap_frequency')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return { sitemapFrequency: 'weekly' };
  }

  const freq = (data as Record<string, unknown>).sitemap_frequency as string;
  if (freq && ['daily', 'weekly', 'monthly'].includes(freq)) {
    return { sitemapFrequency: freq as SitemapFrequency };
  }

  return { sitemapFrequency: 'weekly' };
}

export async function saveSitemapFrequency(frequency: SitemapFrequency): Promise<boolean> {
  const { error } = await apiClient
    .from('seo_settings')
    .update({ sitemap_frequency: frequency, updated_at: new Date().toISOString() })
    .eq('id', 1);

  return !error;
}

let _cachedFrequency: SitemapFrequency = 'weekly';

export function getSitemapFrequency(): SitemapFrequency {
  return _cachedFrequency;
}

export function setSitemapFrequency(frequency: SitemapFrequency): void {
  _cachedFrequency = frequency;
}
