import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

interface ExpansionPageConfig {
  slug: string;
  page_type: 'pattern' | 'situation';
  parent_cluster: string | null;
  is_published: boolean;
  include_in_sitemap: boolean;
  noindex_override: boolean;
}

interface ExpansionConfig {
  settings: {
    pattern_pages_enabled: boolean;
    situation_pages_enabled: boolean;
    include_in_sitemap: boolean;
    noindex_until_approved: boolean;
    updated_at: string | null;
  };
  published_pages: Array<{
    slug: string;
    page_type: string;
    parent_cluster: string | null;
    include_in_sitemap: boolean;
  }>;
  generated_at: string;
}

async function syncExpansionPages() {
  console.log('🔄 Syncing SEO expansion pages from API...');

  const config: ExpansionConfig = {
    settings: {
      pattern_pages_enabled: false,
      situation_pages_enabled: false,
      include_in_sitemap: false,
      noindex_until_approved: true,
      updated_at: null,
    },
    published_pages: [],
    generated_at: new Date().toISOString(),
  };

  if (!API_URL) {
    console.log('⚠ VITE_API_URL not set, using default (empty) config');
    writeConfig(config);
    return;
  }

  try {
    const settingsRes = await fetch(`${API_URL}/api/rpc/get_seo_expansion_settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!settingsRes.ok) {
      console.error('⚠ Error fetching expansion settings:', settingsRes.statusText);
    } else {
      const settingsBody = await settingsRes.json();
      const settings = settingsBody.data;
      if (settings) {
        config.settings = {
          pattern_pages_enabled: settings.pattern_pages_enabled ?? false,
          situation_pages_enabled: settings.situation_pages_enabled ?? false,
          include_in_sitemap: settings.include_in_sitemap ?? false,
          noindex_until_approved: settings.noindex_until_approved ?? true,
          updated_at: settings.updated_at,
        };
        console.log('✓ Fetched expansion settings');
      }
    }

    const pagesRes = await fetch(`${API_URL}/api/table/seo_expansion_pages?select=slug,page_type,parent_cluster,is_published,include_in_sitemap,noindex_override&eq=is_published&eqValue=true`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!pagesRes.ok) {
      console.error('⚠ Error fetching expansion pages:', pagesRes.statusText);
    } else {
      const pagesBody = await pagesRes.json();
      const pages = pagesBody.data;
      if (pages) {
        config.published_pages = (pages as ExpansionPageConfig[])
          .filter((p: ExpansionPageConfig) => p.is_published)
          .map((p: ExpansionPageConfig) => ({
            slug: p.slug,
            page_type: p.page_type,
            parent_cluster: p.parent_cluster,
            include_in_sitemap: p.include_in_sitemap,
          }));
        console.log(`✓ Fetched ${config.published_pages.length} published expansion pages`);
      }
    }

    writeConfig(config);
  } catch (error) {
    console.error('⚠ Error syncing expansion pages:', error);
    writeConfig(config);
  }
}

function writeConfig(config: ExpansionConfig) {
  const outputPath = path.resolve(__dirname, '../../seo-expansion-config.json');

  try {
    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
    console.log(`✓ Expansion config written to ${outputPath}`);
    console.log(`  - Pattern pages enabled: ${config.settings.pattern_pages_enabled}`);
    console.log(`  - Situation pages enabled: ${config.settings.situation_pages_enabled}`);
    console.log(`  - Published pages: ${config.published_pages.length}`);
    console.log(`  - Include in sitemap: ${config.settings.include_in_sitemap}`);
  } catch (error) {
    console.error('⚠ Error writing expansion config:', error);
    process.exit(1);
  }
}

syncExpansionPages();
