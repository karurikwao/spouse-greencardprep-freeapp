/**
* Content Management API
*
* Provides methods for managing and retrieving:
* - Announcements
* - Trust Snippets
* - Content Blocks
*/

import { apiClient } from '@/lib/apiClient';

// ============================================================================
// Types
// ============================================================================

export type AnnouncementType = 'info' | 'success' | 'warning' | 'update' | 'promo';
export type TrustIconName = string; // Lucide icon names
export type ContentBlockType = 'info' | 'faq' | 'comparison' | 'steps' | 'warning' | 'success' | 'promo' | 'note';
export type ContentStatus = 'draft' | 'published' | 'archived';

export type Placement =
  | 'global.banner'
  | 'home.hero'
  | 'home.trust'
  | 'home.faq'
  | 'pricing.top'
  | 'pricing.after_comparison'
  | 'dashboard.top'
  | 'dashboard.sidebar'
  | 'topics.detail'
  | 'auth.login'
  | 'auth.signup'
  | 'account.top'
  | 'checkout.info'
  | 'global.footer';

export type TargetAudience =
  | 'all'
  | 'anonymous'
  | 'logged_in'
  | 'trial'
  | 'paid'
  | 'expired'
  | 'admin';

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  announcement_type: AnnouncementType;
  placement: Placement;
  target_audience: TargetAudience;
  status: ContentStatus;
  priority: number;
  is_dismissible: boolean;
  cta_text: string | null;
  cta_link: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
}

export interface TrustSnippet {
  id: string;
  title: string;
  subtitle: string | null;
  icon_name: string;
  placement: Placement;
  target_audience: TargetAudience;
  status: ContentStatus;
  priority: number;
  cta_text: string | null;
  cta_link: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
}

export interface ContentBlock {
  id: string;
  title: string;
  body: string | null;
  block_type: ContentBlockType;
  group_key: string | null;
  group_order: number;
  placement: Placement;
  target_audience: TargetAudience;
  status: ContentStatus;
  priority: number;
  cta_text: string | null;
  cta_link: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const PLACEMENT_LABELS: Record<Placement, string> = {
  'global.banner': 'Global Banner (Top)',
  'home.hero': 'Homepage - Hero Section',
  'home.trust': 'Homepage - Trust Section',
  'home.faq': 'Homepage - FAQ Section',
  'pricing.top': 'Pricing Page - Top',
  'pricing.after_comparison': 'Pricing Page - After Comparison',
  'dashboard.top': 'Dashboard - Top',
  'dashboard.sidebar': 'Dashboard - Sidebar',
  'topics.detail': 'Topic Detail Page',
  'auth.login': 'Login Page',
  'auth.signup': 'Signup Page',
  'account.top': 'Account Settings - Top',
  'checkout.info': 'Checkout - Info Section',
  'global.footer': 'Global Footer',
};

const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  'all': 'All Visitors',
  'anonymous': 'Anonymous Users Only',
  'logged_in': 'Logged-in Users',
  'trial': 'Trial Users',
  'paid': 'Paid Users',
  'expired': 'Expired Users',
  'admin': 'Admins Only',
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  'draft': 'Draft',
  'published': 'Published',
  'archived': 'Archived',
};

const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  'info': 'Info',
  'success': 'Success',
  'warning': 'Warning',
  'update': 'Update',
  'promo': 'Promotion',
};

const BLOCK_TYPE_LABELS: Record<ContentBlockType, string> = {
  'info': 'Info',
  'faq': 'FAQ',
  'comparison': 'Comparison',
  'steps': 'How-To Steps',
  'warning': 'Warning',
  'success': 'Success',
  'promo': 'Promotion',
  'note': 'Note/Callout',
};

export const getPlacementLabel = (placement: Placement): string => PLACEMENT_LABELS[placement] || placement;
export const getAudienceLabel = (audience: TargetAudience): string => AUDIENCE_LABELS[audience] || audience;
export const getStatusLabel = (status: ContentStatus): string => STATUS_LABELS[status] || status;
export const getAnnouncementTypeLabel = (type: AnnouncementType): string => ANNOUNCEMENT_TYPE_LABELS[type] || type;
export const getBlockTypeLabel = (type: ContentBlockType): string => BLOCK_TYPE_LABELS[type] || type;

export const PLACEMENT_OPTIONS = Object.entries(PLACEMENT_LABELS).map(([value, label]) => ({ value: value as Placement, label }));
export const AUDIENCE_OPTIONS = Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({ value: value as TargetAudience, label }));
export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as ContentStatus, label }));
export const ANNOUNCEMENT_TYPE_OPTIONS = Object.entries(ANNOUNCEMENT_TYPE_LABELS).map(([value, label]) => ({ value: value as AnnouncementType, label }));
export const BLOCK_TYPE_OPTIONS = Object.entries(BLOCK_TYPE_LABELS).map(([value, label]) => ({ value: value as ContentBlockType, label }));

// Common Lucide icon names for trust snippets
export const TRUST_ICON_OPTIONS = [
  { value: 'Shield', label: 'Shield (Security)' },
  { value: 'Lock', label: 'Lock (Privacy)' },
  { value: 'CheckCircle', label: 'Check Circle (Verified)' },
  { value: 'Mail', label: 'Mail (Email)' },
  { value: 'Cloud', label: 'Cloud (Sync)' },
  { value: 'FileCheck', label: 'File Check (Documents)' },
  { value: 'Calendar', label: 'Calendar (Trial/Date)' },
  { value: 'CreditCard', label: 'Credit Card (Billing)' },
  { value: 'Star', label: 'Star (Premium)' },
  { value: 'Heart', label: 'Heart (Favorite)' },
  { value: 'Award', label: 'Award (Quality)' },
  { value: 'Zap', label: 'Zap (Fast)' },
  { value: 'Users', label: 'Users (Community)' },
  { value: 'MessageCircle', label: 'Message Circle (Support)' },
  { value: 'HelpCircle', label: 'Help Circle (Help)' },
];

// ============================================================================
// Announcements API
// ============================================================================

export async function getAnnouncements(filters?: { status?: ContentStatus; placement?: Placement }) {
  const { data, error } = await apiClient
    .from('site_announcements')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    return { data: null as Announcement[] | null, error };
  }

  let results = data as Announcement[];

  if (filters?.status) {
    results = results.filter(item => item.status === filters.status);
  }
  if (filters?.placement) {
    results = results.filter(item => item.placement === filters.placement);
  }

  return { data: results as Announcement[] | null, error: null };
}

export async function getActiveAnnouncements(
  placement: Placement,
  userId?: string,
  userRole: TargetAudience = 'all'
) {
  const { data, error } = await apiClient
    .rpc('get_active_announcements', {
      placement,
      userId: userId || null,
      userRole,
    });

  return { data: data as Announcement[] | null, error };
}

export async function getAnnouncementById(id: string) {
  const { data, error } = await apiClient
    .from('site_announcements')
    .select('*')
    .eq('id', id)
    .single();

  return { data: data as Announcement | null, error };
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'created_by' | 'updated_by'>) {
  const { data, error } = await apiClient
    .from('site_announcements')
    .insert([announcement])
    .single();

  return { data: data as Announcement | null, error };
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>) {
  const { data, error } = await apiClient
    .from('site_announcements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .single();

  return { data: data as Announcement | null, error };
}

export async function deleteAnnouncement(id: string) {
  const { error } = await apiClient
    .from('site_announcements')
    .delete()
    .eq('id', id);

  return { error };
}

// ============================================================================
// Trust Snippets API
// ============================================================================

export async function getTrustSnippets(filters?: { status?: ContentStatus; placement?: Placement }) {
  const { data, error } = await apiClient
    .from('site_trust_snippets')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    return { data: null as TrustSnippet[] | null, error };
  }

  let results = data as TrustSnippet[];

  if (filters?.status) {
    results = results.filter(item => item.status === filters.status);
  }
  if (filters?.placement) {
    results = results.filter(item => item.placement === filters.placement);
  }

  return { data: results as TrustSnippet[] | null, error: null };
}

export async function getActiveTrustSnippets(
  placement: Placement,
  userId?: string,
  userRole: TargetAudience = 'all'
) {
  const { data, error } = await apiClient
    .rpc('get_active_trust_snippets', {
      placement,
      userId: userId || null,
      userRole,
    });

  return { data: data as TrustSnippet[] | null, error };
}

export async function getTrustSnippetById(id: string) {
  const { data, error } = await apiClient
    .from('site_trust_snippets')
    .select('*')
    .eq('id', id)
    .single();

  return { data: data as TrustSnippet | null, error };
}

export async function createTrustSnippet(snippet: Omit<TrustSnippet, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'created_by' | 'updated_by'>) {
  const { data, error } = await apiClient
    .from('site_trust_snippets')
    .insert([snippet])
    .single();

  return { data: data as TrustSnippet | null, error };
}

export async function updateTrustSnippet(id: string, updates: Partial<TrustSnippet>) {
  const { data, error } = await apiClient
    .from('site_trust_snippets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .single();

  return { data: data as TrustSnippet | null, error };
}

export async function deleteTrustSnippet(id: string) {
  const { error } = await apiClient
    .from('site_trust_snippets')
    .delete()
    .eq('id', id);

  return { error };
}

// ============================================================================
// Content Blocks API
// ============================================================================

export async function getContentBlocks(filters?: { status?: ContentStatus; placement?: Placement; group_key?: string }) {
  const { data, error } = await apiClient
    .from('site_content_blocks')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    return { data: null as ContentBlock[] | null, error };
  }

  let results = data as ContentBlock[];

  if (filters?.status) {
    results = results.filter(item => item.status === filters.status);
  }
  if (filters?.placement) {
    results = results.filter(item => item.placement === filters.placement);
  }
  if (filters?.group_key) {
    results = results.filter(item => item.group_key === filters.group_key);
  }

  return { data: results as ContentBlock[] | null, error: null };
}

export async function getActiveContentBlocks(
  placement: Placement,
  userId?: string,
  userRole: TargetAudience = 'all',
  groupKey?: string
) {
  const { data, error } = await apiClient
    .rpc('get_active_content_blocks', {
      placement,
      userId: userId || null,
      userRole,
      groupKey: groupKey || null,
    });

  return { data: data as ContentBlock[] | null, error };
}

export async function getContentBlockById(id: string) {
  const { data, error } = await apiClient
    .from('site_content_blocks')
    .select('*')
    .eq('id', id)
    .single();

  return { data: data as ContentBlock | null, error };
}

export async function createContentBlock(block: Omit<ContentBlock, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'created_by' | 'updated_by'>) {
  const { data, error } = await apiClient
    .from('site_content_blocks')
    .insert([block])
    .single();

  return { data: data as ContentBlock | null, error };
}

export async function updateContentBlock(id: string, updates: Partial<ContentBlock>) {
  const { data, error } = await apiClient
    .from('site_content_blocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .single();

  return { data: data as ContentBlock | null, error };
}

export async function deleteContentBlock(id: string) {
  const { error } = await apiClient
    .from('site_content_blocks')
    .delete()
    .eq('id', id);

  return { error };
}

// ============================================================================
// Content Sanitization Helper
// ============================================================================

/**
* Sanitizes content to prevent XSS
* Only allows safe HTML tags and attributes
*/
export function sanitizeContent(content: string): string {
  // For now, we escape HTML to be safe
  // In the future, this could use a library like DOMPurify for allowed tags
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
* Renders plain text with simple formatting
* - Converts newlines to <br>
* - Makes URLs clickable
* - Preserves basic formatting
*/
// ============================================================================
// Safe Markdown-Lite Formatter
// Supports: paragraphs, line breaks, bullet lists, bold, italic, links
// All HTML is escaped for security
// ============================================================================

export interface FormattedSegment {
  type: 'text' | 'bold' | 'italic' | 'bold_italic' | 'link';
  content: string;
  href?: string;
}

// ============================================================================
// Safe Link Sanitization
// Only allows safe protocols; blocks javascript:, data:, file:, etc.
// ============================================================================

const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:'];
const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:', 'filesystem:'];

/**
* Sanitizes a URL to prevent XSS and unsafe protocols.
*
* Allowed:
* - https://example.com
* - http://example.com
* - mailto:email@example.com
* - /relative/path
* - #anchor
* - ?query=params
*
* Blocked (returns empty string):
* - javascript:alert('xss')
* - data:text/html,<script>...
* - file:///etc/passwd
* - vbscript:...
*/
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';

  const trimmed = url.trim();

  // Allow empty strings
  if (trimmed === '') return '';

  // Allow relative URLs (start with /, #, or ?)
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return trimmed;
  }

  // Allow protocol-relative URLs (//example.com)
  if (trimmed.startsWith('//')) {
    return trimmed;
  }

  // Extract and check the protocol
  const protocolMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);

  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase() + ':';

    // Explicitly block dangerous protocols
    if (BLOCKED_PROTOCOLS.includes(protocol)) {
      console.warn(`Blocked unsafe URL protocol: ${protocol}`);
      return '';
    }

    // Only allow explicitly safe protocols
    if (!ALLOWED_PROTOCOLS.includes(protocol)) {
      console.warn(`Blocked unknown URL protocol: ${protocol}`);
      return '';
    }

    return trimmed;
  }

  // No protocol found - treat as relative URL
  // But be cautious of URLs that look like they might be trying to sneak in
  // a protocol via encoding or other tricks
  if (trimmed.includes(':')) {
    // Has a colon but we couldn't parse it as a protocol - could be suspicious
    // Check for encoded colons or other tricks
    const decoded = decodeURIComponent(trimmed);
    if (BLOCKED_PROTOCOLS.some(p => decoded.toLowerCase().includes(p))) {
      console.warn('Blocked potentially encoded unsafe URL');
      return '';
    }
  }

  return trimmed;
}

/**
* Checks if a URL is external (different origin)
*/
export function isExternalUrl(url: string): boolean {
  if (!url) return false;

  // Relative URLs are not external
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith('?')) {
    return false;
  }

  // Protocol-relative URLs are external
  if (url.startsWith('//')) {
    return true;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.origin !== window.location.origin;
  } catch {
    // If URL parsing fails, assume external to be safe
    return true;
  }
}

/**
* Parses markdown-lite syntax into safe formatted segments
* Supported syntax:
* - **bold** or __bold__
* - *italic* or _italic_
* - ***bold+italic***
* - [link text](url)
* - - bullet lists
* - regular paragraphs
*/
export function parseMarkdownLite(text: string): FormattedSegment[][] {
  if (!text) return [];

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map(paragraph => {
    const segments: FormattedSegment[] = [];
    let remaining = paragraph.trim();

    // Handle bullet list items
    if (remaining.startsWith('- ') || remaining.startsWith('* ')) {
      remaining = remaining.slice(2);
    }

    // Regex patterns for inline formatting (in order of precedence)
    const patterns = [
      { regex: /\*\*\*(.+?)\*\*\*|___(.+?)___/, type: 'bold_italic' as const }, // ***bold+italic***
      { regex: /\*\*(.+?)\*\*|__(.+?)__/, type: 'bold' as const }, // **bold**
      { regex: /\*(.+?)\*|_(.+?)_/, type: 'italic' as const }, // *italic*
      { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' as const }, // [text](url)
    ];

    while (remaining.length > 0) {
      let matched = false;

      for (const pattern of patterns) {
        const match = remaining.match(pattern.regex);
        if (match && match.index === 0) {
          const content = match[1] || match[2] || match[3] || '';

          if (pattern.type === 'link') {
            const rawUrl = match[2];
            const safeUrl = sanitizeUrl(rawUrl);

            // Only add link if URL passed sanitization
            if (safeUrl) {
              segments.push({
                type: 'link',
                content: escapeHtml(match[1]),
                href: safeUrl,
              });
            } else {
              // If URL was blocked, render as plain text instead
              segments.push({
                type: 'text',
                content: escapeHtml(`[${match[1]}](blocked)`),
              });
            }
          } else {
            segments.push({
              type: pattern.type,
              content: escapeHtml(content),
            });
          }

          remaining = remaining.slice(match[0].length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Find next special character or end of string
        const nextSpecial = remaining.search(/[*_\[]/);
        const textEnd = nextSpecial === -1 ? remaining.length : nextSpecial;
        const text = remaining.slice(0, textEnd);

        if (text) {
          segments.push({ type: 'text', content: escapeHtml(text) });
        }

        remaining = remaining.slice(textEnd);
      }
    }

    return segments;
  });
}

/**
* Detects if text contains bullet list items
*/
export function containsBulletList(text: string): boolean {
  if (!text) return false;
  return /^[\s]*[-*][\s]+/m.test(text);
}

/**
* Splits text into bullet list items
*/
export function parseBulletList(text: string): string[] {
  if (!text) return [];

  return text
    .split(/\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => line.slice(2).trim());
}

/**
* Escape HTML entities for safe rendering
*/
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
* Legacy function for backward compatibility
* Converts newlines to <br> tags with HTML escaping
*/
export function renderSimpleContent(content: string): string {
  if (!content) return '';

  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ============================================================================
// Content Dismissals API (Syncs across devices for logged-in users)
// ============================================================================

export interface ContentDismissal {
  id: string;
  user_id: string;
  content_type: 'announcement' | 'trust_snippet' | 'content_block';
  content_id: string;
  placement: string | null;
  dismissed_at: string;
}

/**
* Get dismissed content IDs for the current user
*/
export async function getDismissedContentIds(
  contentType: 'announcement' | 'trust_snippet' | 'content_block',
  placement?: string
): Promise<string[]> {
  const { data: user } = await apiClient.auth.getUser();

  const { data, error } = await apiClient
    .rpc('get_dismissed_content_ids', {
      userId: user?.id,
      contentType,
      placement: placement || null,
    });

  if (error) {
    console.error('Error fetching dismissals:', error);
    return [];
  }

  return (data as string[]) || [];
}

/**
 * Dismiss a content item (syncs to backend for logged-in users)
 */
export async function dismissContent(
  contentType: 'announcement' | 'trust_snippet' | 'content_block',
  contentId: string,
  placement?: string
): Promise<boolean> {
  const { data: user } = await apiClient.auth.getUser();

  if (!user) {
    // Anonymous user - return false, caller should use localStorage
    return false;
  }

  const { error } = await apiClient
    .rpc('dismiss_content', {
      userId: user.id,
      contentType,
      contentId,
      placement: placement || null,
    });

  if (error) {
    console.error('Error dismissing content:', error);
    return false;
  }

  return true;
}

// ============================================================================
// Analytics Deduplication Helper
// Uses sessionStorage to persist deduping across component remounts
// ============================================================================

const ANALYTICS_SESSION_KEY = 'content_analytics_recorded';

/**
* Check if an interaction has already been recorded this session.
* This prevents overcounting from rerenders or remounts.
*/
export function hasRecordedInteraction(
  contentType: string,
  contentId: string,
  interactionType: string,
  placement?: string
): boolean {
  try {
    const recorded = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    const recordedSet = recorded ? new Set(JSON.parse(recorded)) : new Set<string>();

    const key = `${contentType}:${contentId}:${interactionType}:${placement || 'global'}`;
    return recordedSet.has(key);
  } catch {
    // If sessionStorage fails, fall back to not deduping
    return false;
  }
}

/**
* Mark an interaction as recorded for this session.
*/
export function markInteractionRecorded(
  contentType: string,
  contentId: string,
  interactionType: string,
  placement?: string
): void {
  try {
    const recorded = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    const recordedSet = recorded ? new Set(JSON.parse(recorded)) : new Set<string>();

    const key = `${contentType}:${contentId}:${interactionType}:${placement || 'global'}`;
    recordedSet.add(key);

    sessionStorage.setItem(ANALYTICS_SESSION_KEY, JSON.stringify([...recordedSet]));
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

/**
* Clear recorded interactions (useful for testing or on logout)
*/
export function clearRecordedInteractions(): void {
  try {
    sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
  } catch {
    // Silently fail
  }
}

// ============================================================================
// Content Analytics API
// ============================================================================

export interface ContentAnalytics {
  total_views: number;
  unique_viewers: number;
  total_dismissals: number;
  total_cta_clicks: number;
  total_expands: number;
  last_interaction_at: string | null;
}

export interface PlacementAnalytics {
  content_type: string;
  content_id: string;
  title: string | null;
  total_views: number;
  total_dismissals: number;
  total_cta_clicks: number;
}

/**
* Record a content interaction (view, dismiss, cta_click, expand)
*/
export async function recordContentInteraction(
  contentType: 'announcement' | 'trust_snippet' | 'content_block',
  contentId: string,
  interactionType: 'view' | 'dismiss' | 'cta_click' | 'expand',
  placement?: string,
  sessionId?: string
): Promise<boolean> {
  const { data: user } = await apiClient.auth.getUser();

  const { error } = await apiClient
    .rpc('record_content_interaction', {
      contentType,
      contentId,
      interactionType,
      placement: placement || null,
      userId: user?.id || null,
      sessionId: sessionId || null,
    });

  if (error) {
    console.error('Error recording interaction:', error);
    return false;
  }

  return true;
}

/**
* Get analytics for a specific content item
*/
export async function getContentAnalytics(
  contentType: 'announcement' | 'trust_snippet' | 'content_block',
  contentId: string
): Promise<ContentAnalytics | null> {
  const { data, error } = await apiClient
    .rpc('get_content_analytics', {
      contentType,
      contentId,
    });

  if (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }

  return (data as ContentAnalytics[])?.[0] || null;
}

/**
* Get analytics for a placement
*/
export async function getPlacementAnalytics(
  placement: string
): Promise<PlacementAnalytics[]> {
  const { data, error } = await apiClient
    .rpc('get_placement_analytics', {
      placement,
    });

  if (error) {
    console.error('Error fetching placement analytics:', error);
    return [];
  }

  return (data as PlacementAnalytics[]) || [];
}
