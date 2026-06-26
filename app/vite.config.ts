import path from "path"
import fs from "fs"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { fileURLToPath } from 'url'

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import cluster data for sitemap generation
// Using dynamic import pattern compatible with tsx
import { CONTENT_CLUSTERS } from './src/lib/seo/clusters'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'generate-sitemap',
      buildStart() {
        // Generate sitemap with cluster pages from clusters.ts
        // This ensures all SEO cluster pages are automatically included
        try {
          const baseUrl = 'https://www.SpouseInterview.com';
          const now = new Date().toISOString();
          
          // Read SEO configuration for sitemap frequency
          let sitemapFrequency = 'weekly';
          try {
            const configPath = './seo-config.json';
            if (fs.existsSync(configPath)) {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              if (config.sitemapFrequency && ['daily', 'weekly', 'monthly'].includes(config.sitemapFrequency)) {
                sitemapFrequency = config.sitemapFrequency;
              }
            }
          } catch (configErr) {
            console.warn('⚠ Could not read seo-config.json, using default frequency:', configErr instanceof Error ? configErr.message : String(configErr));
          }
          
          console.log(`✓ Using sitemap frequency: ${sitemapFrequency}`);
          
          // Static sitemap entries - all use the configured frequency
          const entries = [
            { url: `${baseUrl}/`, lastmod: now, changefreq: sitemapFrequency, priority: '1.0' },
            { url: `${baseUrl}/dashboard`, lastmod: now, changefreq: sitemapFrequency, priority: '0.9' },
            { url: `${baseUrl}/readiness`, lastmod: now, changefreq: sitemapFrequency, priority: '0.8' },
            { url: `${baseUrl}/pricing`, lastmod: now, changefreq: sitemapFrequency, priority: '0.8' },
            { url: `${baseUrl}/marriage-interview-questions`, lastmod: now, changefreq: sitemapFrequency, priority: '0.95' },
            { url: `${baseUrl}/immigration-interview-question-database`, lastmod: now, changefreq: sitemapFrequency, priority: '0.9' },
            { url: `${baseUrl}/marriage-green-card-interview-preparation`, lastmod: now, changefreq: sitemapFrequency, priority: '0.98' },
            { url: `${baseUrl}/interview-topics`, lastmod: now, changefreq: sitemapFrequency, priority: '0.9' },
          ];
          
          // Add pillar pages (cluster hubs) - priority 0.8
          const pillarPages = CONTENT_CLUSTERS.map(c => c.pillarPage);
          for (const pillar of pillarPages) {
            entries.push({
              url: `${baseUrl}/${pillar.slug}`,
              lastmod: now,
              changefreq: sitemapFrequency,
              priority: '0.8'
            });
          }
          console.log(`✓ Added ${pillarPages.length} pillar pages to sitemap`);
          
          // Add supporting pages (cluster sub-pages) - priority 0.7
          const supportingPages = CONTENT_CLUSTERS.flatMap(c => c.supportingPages);
          for (const page of supportingPages) {
            entries.push({
              url: `${baseUrl}/${page.slug}`,
              lastmod: now,
              changefreq: sitemapFrequency,
              priority: '0.7'
            });
          }
          console.log(`✓ Added ${supportingPages.length} supporting pages to sitemap`);
          
          const urls = entries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');
          
          const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
          
          fs.writeFileSync('./public/sitemap.xml', sitemap);
          console.log(`✓ Generated sitemap.xml with ${entries.length} URLs`);
          
          // Generate robots.txt with cluster pages
          const robots = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Disallow admin routes
Disallow: /admin/
Disallow: /superadmin/

# Allow public content
Allow: /questions/
Allow: /topics/
Allow: /marriage-interview-questions
Allow: /immigration-interview-question-database
Allow: /marriage-green-card-interview-preparation
Allow: /interview-topics

# Cluster pillar pages
Allow: /uscis-marriage-interview-questions-about-relationship-history
Allow: /uscis-marriage-interview-questions-about-wedding-ceremony
Allow: /uscis-marriage-interview-questions-about-living-together
Allow: /uscis-marriage-interview-questions-about-family-social-life
Allow: /uscis-marriage-interview-questions-about-finances

# Cluster supporting pages
Allow: /how-did-you-meet-your-spouse-uscis-interview
Allow: /marriage-interview-questions-about-your-proposal
Allow: /uscis-interview-questions-about-dating
Allow: /marriage-interview-questions-about-your-wedding-ceremony
Allow: /uscis-interview-questions-about-wedding-guests
Allow: /green-card-interview-questions-about-your-home
Allow: /green-card-interview-questions-about-daily-routines
Allow: /uscis-interview-questions-about-household-chores
Allow: /marriage-interview-questions-about-in-laws
Allow: /green-card-interview-questions-about-friends
Allow: /marriage-interview-questions-about-shared-bank-accounts
Allow: /uscis-interview-questions-about-joint-assets
`;
          
          fs.writeFileSync('./public/robots.txt', robots);
          console.log('✓ Generated robots.txt');
        } catch (err) {
          console.warn('⚠ Sitemap generation warning:', err instanceof Error ? err.message : String(err));
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
