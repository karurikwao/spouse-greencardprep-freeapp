import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.resolve(__dirname, '../seo-config.json');
const DEFAULT_FREQUENCY = 'weekly';

const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

interface SEOConfig {
  sitemapFrequency: 'daily' | 'weekly' | 'monthly';
  lastSynced: string;
  source: string;
}

async function fetchSEOSettingsFromAPI(): Promise<string | null> {
  if (!API_URL) {
    console.warn('⚠ VITE_API_URL not set, using default settings');
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/table/seo_settings?select=sitemap_frequency&eq=id&eqValue=1&single=true`);
    if (!res.ok) {
      console.warn('⚠ seo_settings table not found or API unavailable, using default');
      return null;
    }
    const body = await res.json();
    const data = body.data;
    if (data && data.sitemap_frequency) {
      return data.sitemap_frequency;
    }
    return null;
  } catch (err) {
    console.error('Error connecting to API:', err);
    return null;
  }
}

function readExistingConfig(): SEOConfig | null {
  try {
    if (fs.existsSync(OUTPUT_PATH)) {
      const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
      const config = JSON.parse(content);
      if (config.sitemapFrequency && ['daily', 'weekly', 'monthly'].includes(config.sitemapFrequency)) {
        return config;
      }
    }
  } catch (e) {
    console.warn('Could not read existing config:', e);
  }
  return null;
}

async function main() {
  console.log('🔄 Syncing SEO settings from API...');

  const frequencyFromDb = await fetchSEOSettingsFromAPI();

  let frequency: string;
  let source: string;

  if (frequencyFromDb && ['daily', 'weekly', 'monthly'].includes(frequencyFromDb)) {
    frequency = frequencyFromDb;
    source = 'api';
    console.log(`✓ Found frequency in API: ${frequency}`);
  } else {
    const existing = readExistingConfig();
    if (existing) {
      frequency = existing.sitemapFrequency;
      source = 'existing-config';
      console.log(`✓ Using existing config frequency: ${frequency}`);
    } else {
      frequency = DEFAULT_FREQUENCY;
      source = 'default';
      console.log(`✓ Using default frequency: ${frequency}`);
    }
  }

  const config: SEOConfig = {
    sitemapFrequency: frequency as 'daily' | 'weekly' | 'monthly',
    lastSynced: new Date().toISOString(),
    source,
  };

  try {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(config, null, 2));
    console.log(`✓ SEO config written to ${OUTPUT_PATH}`);
    console.log(`  Frequency: ${config.sitemapFrequency}`);
    console.log(`  Source: ${config.source}`);
  } catch (err) {
    console.error('✗ Failed to write config:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

export { main };
