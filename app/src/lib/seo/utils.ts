/**
 * SEO Utilities
 * Helpers for generating slugs, meta tags, and schema markup
 */

import type { 
  SEOQuestion, 
  SEOMetaTags, 
  FAQSchema, 
  BreadcrumbSchema,
  SitemapEntry,
  CategoryHub 
} from './types';

/**
 * Generate URL-friendly slug from text
 * 
 * NOTE: This function is also available in lib/content/adapters.ts
 * Import from there for new code to avoid circular dependencies.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .slice(0, 60);                // Limit length
}

/**
 * Generate SEO title for a question
 */
export function generateQuestionTitle(question: SEOQuestion): string {
  if (question.seoTitle) return question.seoTitle;
  
  const prompt = question.prompt;
  const shortPrompt = prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt;
  
  return `USCIS Marriage Interview Question: ${shortPrompt} | Green Card Practice`;
}

/**
 * Generate SEO description for a question
 */
export function generateQuestionDescription(question: SEOQuestion): string {
  if (question.seoDescription) return question.seoDescription;
  
  const sampleAnswer = question.sampleAnswer 
    ? question.sampleAnswer.slice(0, 120) + '...'
    : 'Practice this common immigration interview question';
    
  return `Practice this USCIS marriage interview question: "${question.prompt}". Review sample answers for green card interview questions for couples. ${sampleAnswer}`;
}

/**
 * Generate meta tags for a question page
 */
export function generateQuestionMetaTags(
  question: SEOQuestion,
  baseUrl: string = 'https://www.SpouseInterview.com'
): SEOMetaTags {
  const title = generateQuestionTitle(question);
  const description = generateQuestionDescription(question);
  const url = `${baseUrl}/questions/${question.slug}`;
  
  return {
    title,
    description,
    keywords: question.seoKeywords || [
      'USCIS interview',
      'marriage green card',
      'immigration interview',
      'marriage interview questions',
      'green card preparation'
    ],
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    canonicalUrl: url,
  };
}

/**
 * Generate meta tags for a category hub page
 */
export function generateCategoryMetaTags(
  category: CategoryHub,
  baseUrl: string = 'https://www.SpouseInterview.com'
): SEOMetaTags {
  return {
    title: category.seoTitle,
    description: category.seoDescription,
    keywords: [
      'USCIS interview',
      'marriage green card',
      category.name.toLowerCase(),
      'immigration questions',
      'green card interview prep'
    ],
    ogTitle: category.seoTitle,
    ogDescription: category.seoDescription,
    ogUrl: `${baseUrl}/topics/${category.slug}`,
    canonicalUrl: `${baseUrl}/topics/${category.slug}`,
  };
}

/**
 * Generate FAQ schema markup for a question
 */
export function generateFAQSchema(question: SEOQuestion): FAQSchema {
  const answerParts: string[] = [];
  
  if (question.explanation) {
    answerParts.push(`<p><strong>Why officers ask this:</strong> ${question.explanation}</p>`);
  }
  
  if (question.sampleAnswer) {
    answerParts.push(`<p><strong>Sample answer:</strong> ${question.sampleAnswer}</p>`);
  }
  
  if (question.officerLookingFor) {
    answerParts.push(`<p><strong>What officers look for:</strong> ${question.officerLookingFor}</p>`);
  }
  
  if (question.avoidThis) {
    answerParts.push(`<p><strong>Avoid:</strong> ${question.avoidThis}</p>`);
  }
  
  const answerText = answerParts.join('') || 
    '<p>Practice this question with your spouse to prepare for your green card interview.</p>';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{
      '@type': 'Question',
      name: question.prompt,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answerText,
      },
    }],
  };
}

/**
 * Generate breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(
  items: { name: string; url: string }[],
  baseUrl: string = 'https://www.SpouseInterview.com'
): BreadcrumbSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * Generate sitemap entries for questions
 */
export function generateQuestionSitemapEntries(
  questions: SEOQuestion[],
  baseUrl: string = 'https://www.SpouseInterview.com'
): SitemapEntry[] {
  const now = new Date().toISOString();
  
  return questions
    .filter(q => q.isPublic)
    .map(q => ({
      url: `${baseUrl}/questions/${q.slug}`,
      lastModified: q.updatedAt || now,
      changeFrequency: 'monthly',
      priority: 0.8,
    }));
}

/**
 * Generate sitemap entries for category hubs
 */
export function generateCategorySitemapEntries(
  categories: CategoryHub[],
  baseUrl: string = 'https://www.SpouseInterview.com'
): SitemapEntry[] {
  const now = new Date().toISOString();
  
  return categories.map(c => ({
    url: `${baseUrl}/topics/${c.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));
}

/**
 * Truncate text for previews
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Strip HTML tags for plain text meta descriptions
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate XML sitemap from entries
 */
export function generateSitemapXML(entries: SitemapEntry[]): string {
  const urls = entries.map(entry => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get anxiety color for UI
 */
export function getAnxietyColor(level: 'low' | 'medium' | 'high' | 'sensitive'): string {
  switch (level) {
    case 'high': return 'text-rose-600 bg-rose-50';
    case 'sensitive': return 'text-red-700 bg-red-50';
    case 'medium': return 'text-amber-600 bg-amber-50';
    case 'low': return 'text-emerald-600 bg-emerald-50';
    default: return 'text-slate-600 bg-slate-50';
  }
}

/**
 * Get anxiety label
 */
export function getAnxietyLabel(level: 'low' | 'medium' | 'high' | 'sensitive'): string {
  switch (level) {
    case 'high': return 'High Anxiety';
    case 'sensitive': return 'Sensitive Topic';
    case 'medium': return 'Medium Anxiety';
    case 'low': return 'Low Anxiety';
    default: return '';
  }
}
