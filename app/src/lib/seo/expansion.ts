/**
* SEO Expansion Framework
*
* This file contains configuration for future SEO expansion pages including:
* - Answer pattern pages (met_online, courthouse_wedding, etc.)
* - Situation pages (couples who met online, long-distance couples, etc.)
*
* IMPORTANT: This framework is preparation-only. All expansion pages are
* DISABLED by default and should NOT be published until:
* - The site has been indexed and aged for 3-6 months
* - The domain has established authority
* - Admin explicitly enables the feature
*
* Safety rules:
* - No public routes until enabled
* - No sitemap entries until enabled
* - No indexing until enabled
* - Admin must explicitly enable via SEO Expansion Settings
*
 * PERSISTENCE: All publication state is stored in the database (seo_expansion_pages table).
* localStorage is NOT used as source of truth - it may only be used as a temporary UI cache.
*/

import { apiClient, getToken } from '@/lib/apiClient';

// ============================================================================
// PUBLICATION STATUS TYPES
// ============================================================================

export type PublicationStatus = 'draft' | 'reviewed' | 'approved' | 'published' | 'unpublished';

export interface PagePublicationState {
id: string;
slug: string;
page_type: 'pattern' | 'situation';
parent_cluster: string | null;
status: PublicationStatus;
is_enabled: boolean;
is_published: boolean;
include_in_sitemap: boolean;
noindex_override: boolean;
sitemap_synced_at: string | null;
is_in_live_sitemap: boolean;
reviewed_at: string | null;
reviewed_by: string | null;
approved_at: string | null;
approved_by: string | null;
published_at: string | null;
published_by: string | null;
unpublished_at: string | null;
unpublished_by: string | null;
notes: string | null;
created_at: string;
updated_at: string;
}

// ============================================================================
// SCHEDULER SETTINGS
// ============================================================================

export type RolloutFrequency = 'weekly' | 'biweekly' | 'monthly';
export type PageCountMode = 'fixed' | 'random';

export interface RolloutSchedulerSettings {
enabled: boolean;
frequency: RolloutFrequency;
page_count_mode: PageCountMode;
fixed_page_count: number;
random_min_pages: number;
random_max_pages: number;
start_date: string | null;
only_publish_approved: boolean;
auto_include_in_sitemap: boolean;
}

export const DEFAULT_SCHEDULER_SETTINGS: RolloutSchedulerSettings = {
enabled: false,
frequency: 'weekly',
page_count_mode: 'fixed',
fixed_page_count: 2,
random_min_pages: 2,
random_max_pages: 4,
start_date: null,
only_publish_approved: true,
auto_include_in_sitemap: false,
};

// ============================================================================
// DEPLOY WEBHOOK SETTINGS
// ============================================================================

export interface DeployWebhookConfig {
webhook_url: string | null;
enabled: boolean;
}

// ============================================================================
// SITEMAP SYNC STATUS
// ============================================================================

/**
* Sitemap sync status with honest estimates
*
* IMPORTANT: Many values here are ESTIMATES, not exact measurements:
* - pages_not_in_sitemap: Estimated based on last known sync
* - last_sitemap_sync_at: Estimated from last rebuild trigger (actual completion unknown)
*
* The UI should label these appropriately to avoid overclaiming accuracy.
*/
export interface SitemapSyncStatus {
// Exact values
published_pages_count: number;
pages_in_sitemap: number;

// Estimated values (see is_*_exact flags)
pages_not_in_sitemap: number; // Estimated: published - in_sitemap
last_sitemap_sync_at: string | null; // Estimated: last rebuild trigger time

// Rebuild status
last_rebuild_triggered_at: string | null;
last_rebuild_status: 'pending' | 'triggered' | 'error' | null;
estimated_completion_at: string | null;

// Scheduler
last_scheduler_run_at: string | null;

// Honesty flags - indicates whether values are exact or estimated
is_pages_not_in_sitemap_exact: boolean; // Always false - we don't know exact sitemap state
is_last_sync_exact: boolean; // Always false - we track trigger, not completion
}

// ============================================================================
// AI RECOMMENDATIONS
// ============================================================================

export interface PageAIRecommendations {
slug: string;
recommended_priority: number; // 1-100, higher = publish first
recommended_for_early_publish: boolean;
quality_hint: string;
duplicate_risk: 'low' | 'medium' | 'high' | null;
cluster_coverage_suggestion: string | null;
strengths: string[];
concerns: string[];
}

// ============================================================================
// ROLLOUT GUIDANCE
// ============================================================================

export interface RolloutGuidance {
launch_date: string | null;
recommended_activation_month: number;
reminder_banner_enabled: boolean;
}

export const DEFAULT_ROLLOUT_GUIDANCE: RolloutGuidance = {
launch_date: null,
recommended_activation_month: 3,
reminder_banner_enabled: true,
};

// ============================================================================
// EXPANSION STATUS TYPE
// ============================================================================

export type ExpansionStatus = 'disabled' | 'enabled';

export interface SEOExpansionSettings {
pattern_pages_enabled: boolean;
situation_pages_enabled: boolean;
recommended_activation_months: 3 | 4 | 6;
admin_notes: string;
// Safety controls for future rollout
include_in_sitemap: boolean; // Default: false - whether to add expansion pages to sitemap when enabled
noindex_until_approved: boolean; // Default: true - whether to apply noindex meta tag until manually approved
// New publishing workflow settings
scheduler: RolloutSchedulerSettings;
guidance: RolloutGuidance;
// Note: Deploy webhook is stored server-side only (Edge Function env var)
// Frontend never sees the Coolify webhook URL for security
}

// ============================================================================
// DEFAULT SETTINGS (ALL DISABLED)
// ============================================================================

export const DEFAULT_EXPANSION_SETTINGS: SEOExpansionSettings = {
pattern_pages_enabled: false,
situation_pages_enabled: false,
recommended_activation_months: 3,
admin_notes: '',
include_in_sitemap: false, // Safety: don't add to sitemap by default
noindex_until_approved: true, // Safety: keep noindex until explicitly approved
scheduler: { ...DEFAULT_SCHEDULER_SETTINGS },
guidance: { ...DEFAULT_ROLLOUT_GUIDANCE },
// Deploy webhook config is server-side only (Edge Function)
};

// ============================================================================
// ANSWER PATTERN PAGE CONFIGURATION
// ============================================================================

export interface PatternPageConfig {
slug: string;
title: string;
description: string;
metaTitle: string;
metaDescription: string;
relatedQuestions: string[];
parentCluster: string;
enabled: boolean; // Individual page enable flag - NOT USED as source of truth anymore
}

/**
* Answer pattern pages - preparation only, all disabled by default
* These pages would provide guidance for specific answer patterns like:
* - "We met online"
* - "We had a courthouse wedding"
* - "We don't have joint bank accounts"
*/
export const PATTERN_PAGES: PatternPageConfig[] = [
{
slug: 'met-online-dating-uscis-interview',
title: 'How to Answer "How Did You Meet?" When You Met Online',
description: 'Guide for couples who met through online dating apps or websites',
metaTitle: 'USCIS Interview: How to Answer When You Met Online | Green Card Prep',
metaDescription: 'Learn how to answer "How did you meet?" in your USCIS marriage interview if you met online. Tips for discussing dating apps, first meetings, and relationship progression.',
relatedQuestions: ['How did you meet your spouse?', 'When did you first meet in person?'],
parentCluster: 'relationship-history',
enabled: false,
},
{
slug: 'met-through-friends-uscis-interview',
title: 'How to Answer "How Did You Meet?" When You Met Through Friends',
description: 'Guide for couples who were introduced by mutual friends',
metaTitle: 'USCIS Interview: How to Answer When You Met Through Friends | Green Card Prep',
metaDescription: 'Learn how to answer "How did you meet?" in your USCIS marriage interview if you were introduced by friends. Tips for discussing the introduction and early relationship.',
relatedQuestions: ['How did you meet your spouse?', 'Who introduced you?'],
parentCluster: 'relationship-history',
enabled: false,
},
{
slug: 'courthouse-wedding-uscis-interview',
title: 'How to Answer Questions About Your Courthouse Wedding',
description: 'Guide for couples who had a simple courthouse or civil ceremony',
metaTitle: 'USCIS Interview: Courthouse Wedding Questions | Green Card Prep',
metaDescription: 'Prepare for USCIS questions about your courthouse wedding. Learn how to explain your simple ceremony, witnesses, and why you chose this option.',
relatedQuestions: ['Where did you get married?', 'Who officiated your wedding?', 'Why did you choose a courthouse wedding?'],
parentCluster: 'wedding-ceremony',
enabled: false,
},
{
slug: 'small-wedding-few-guests-uscis',
title: 'How to Answer Questions About Your Small Wedding',
description: 'Guide for couples who had an intimate wedding with few guests',
metaTitle: 'USCIS Interview: Small Wedding Questions | Green Card Prep',
metaDescription: 'Prepare for USCIS questions about your small wedding. Learn how to explain limited guest attendance and family participation.',
relatedQuestions: ['How many guests attended your wedding?', 'Were your parents present?'],
parentCluster: 'wedding-ceremony',
enabled: false,
},
{
slug: 'no-joint-bank-account-uscis',
title: 'How to Answer When You Don\'t Have Joint Bank Accounts',
description: 'Guide for couples who keep separate finances',
metaTitle: 'USCIS Interview: No Joint Bank Account | Green Card Prep',
metaDescription: 'Learn how to answer finance questions in your USCIS interview if you don\'t have joint bank accounts. Tips for explaining your financial arrangement.',
relatedQuestions: ['Do you have joint bank accounts?', 'How do you divide expenses?'],
parentCluster: 'finances',
enabled: false,
},
{
slug: 'shared-bank-account-uscis-interview',
title: 'How to Answer Questions About Your Joint Bank Account',
description: 'Guide for couples with shared finances',
metaTitle: 'USCIS Interview: Joint Bank Account Questions | Green Card Prep',
metaDescription: 'Prepare for USCIS questions about your joint bank accounts. Learn what details to share about account balances, deposits, and spending.',
relatedQuestions: ['Do you have joint bank accounts?', 'Who manages the finances?'],
parentCluster: 'finances',
enabled: false,
},
{
slug: 'living-apart-temporarily-uscis',
title: 'How to Answer When You\'re Living Apart Temporarily',
description: 'Guide for couples separated due to work, school, or immigration',
metaTitle: 'USCIS Interview: Living Apart Temporarily | Green Card Prep',
metaDescription: 'Learn how to answer questions when you and your spouse live apart temporarily. Tips for explaining work, school, or immigration-related separation.',
relatedQuestions: ['Do you live together?', 'Why are you living apart?', 'When will you live together?'],
parentCluster: 'living-together',
enabled: false,
},
{
slug: 'different-work-schedules-uscis',
title: 'How to Answer Questions About Different Work Schedules',
description: 'Guide for couples with conflicting work hours',
metaTitle: 'USCIS Interview: Different Work Schedules | Green Card Prep',
metaDescription: 'Prepare for USCIS questions about your daily routines when you and your spouse have different work schedules. Learn how to explain your time together.',
relatedQuestions: ['What time do you wake up?', 'Who cooks dinner?', 'What do you do in the evenings?'],
parentCluster: 'living-together',
enabled: false,
},
{
slug: 'parents-never-met-uscis-interview',
title: 'How to Answer When Your Parents Have Never Met',
description: 'Guide for couples whose families haven\'t met due to distance or other factors',
metaTitle: 'USCIS Interview: Parents Never Met | Green Card Prep',
metaDescription: 'Learn how to answer family questions when your parents have never met. Tips for explaining distance, timing, or cultural factors.',
relatedQuestions: ['Have your parents met?', 'When did your families first meet?'],
parentCluster: 'family-social',
enabled: false,
},
{
slug: 'spouse-not-close-to-family-uscis',
title: 'How to Answer When Your Spouse Isn\'t Close to Their Family',
description: 'Guide for couples with limited family contact',
metaTitle: 'USCIS Interview: Limited Family Contact | Green Card Prep',
metaDescription: 'Prepare for USCIS family questions when your spouse isn\'t close to their family. Learn how to explain estrangement or limited contact appropriately.',
relatedQuestions: ['Do you know your spouse\'s parents?', 'How often do you see your in-laws?'],
parentCluster: 'family-social',
enabled: false,
},
];

// ============================================================================
// SITUATION PAGE CONFIGURATION
// ============================================================================

export interface SituationPageConfig {
slug: string;
title: string;
description: string;
metaTitle: string;
metaDescription: string;
targetAudience: string;
relatedPatterns: string[]; // References to PATTERN_PAGES slugs
relatedClusters: string[]; // References to cluster slugs
enabled: boolean; // Individual page enable flag - NOT USED as source of truth anymore
}

/**
* Situation pages - preparation only, all disabled by default
* These pages would help specific couple situations like:
* - Couples who met online
* - Courthouse wedding couples
* - Long-distance couples
*/
export const SITUATION_PAGES_CONFIG: SituationPageConfig[] = [
{
slug: 'couples-who-met-online-green-card-interview',
title: 'Green Card Interview Guide for Couples Who Met Online',
description: 'Complete preparation for couples who met through dating apps or websites',
metaTitle: 'Green Card Interview Guide for Couples Who Met Online | USCIS Prep',
metaDescription: 'Comprehensive guide for couples who met online preparing for their USCIS marriage interview. Tips for answering questions about dating apps, first meetings, and relationship development.',
targetAudience: 'Couples who met through online dating',
relatedPatterns: ['met-online-dating-uscis-interview'],
relatedClusters: ['relationship-history', 'wedding-ceremony'],
enabled: false,
},
{
slug: 'courthouse-wedding-couples-green-card',
title: 'Green Card Interview Guide for Courthouse Wedding Couples',
description: 'Preparation for couples with simple civil ceremonies',
metaTitle: 'Green Card Interview Guide for Courthouse Wedding Couples | USCIS',
metaDescription: 'Specialized guide for couples who had courthouse weddings preparing for USCIS interviews. Learn how to explain your ceremony, witnesses, and celebration plans.',
targetAudience: 'Couples with courthouse or civil ceremonies',
relatedPatterns: ['courthouse-wedding-uscis-interview', 'small-wedding-few-guests-uscis'],
relatedClusters: ['wedding-ceremony', 'living-together'],
enabled: false,
},
{
slug: 'long-distance-couples-green-card-interview',
title: 'Green Card Interview Guide for Long-Distance Couples',
description: 'Preparation for couples who maintained long-distance relationships',
metaTitle: 'Green Card Interview Guide for Long-Distance Couples | USCIS',
metaDescription: 'Complete preparation for long-distance couples facing USCIS marriage interviews. Tips for explaining visits, communication, and relationship maintenance across distance.',
targetAudience: 'Couples with long-distance relationship history',
relatedPatterns: ['living-apart-temporarily-uscis', 'met-online-dating-uscis-interview'],
relatedClusters: ['relationship-history', 'living-together'],
enabled: false,
},
{
slug: 'couples-without-joint-accounts-green-card',
title: 'Green Card Interview Guide for Couples Without Joint Finances',
description: 'Preparation for couples who keep separate bank accounts',
metaTitle: 'Green Card Interview: No Joint Accounts Guide | USCIS',
metaDescription: 'Expert guidance for couples without joint bank accounts preparing for USCIS interviews. Learn how to demonstrate financial partnership through other means.',
targetAudience: 'Couples with separate finances',
relatedPatterns: ['no-joint-bank-account-uscis'],
relatedClusters: ['finances', 'living-together'],
enabled: false,
},
{
slug: 'couples-living-apart-temporarily-green-card',
title: 'Green Card Interview Guide for Couples Living Apart',
description: 'Preparation for couples temporarily separated due to work or school',
metaTitle: 'Green Card Interview: Living Apart Guide | USCIS',
metaDescription: 'Specialized guidance for couples living apart temporarily during the green card process. Learn how to explain your living situation and plans to reunite.',
targetAudience: 'Couples currently living apart',
relatedPatterns: ['living-apart-temporarily-uscis', 'different-work-schedules-uscis'],
relatedClusters: ['living-together', 'finances'],
enabled: false,
},
{
slug: 'older-couples-green-card-interview',
title: 'Green Card Interview Guide for Older Couples',
description: 'Preparation for couples where one or both partners are older',
metaTitle: 'Green Card Interview Guide for Older Couples | USCIS',
metaDescription: 'Age-specific guidance for older couples preparing for USCIS marriage interviews. Tips for addressing age gaps, adult children, and retirement considerations.',
targetAudience: 'Couples with significant age difference or older partners',
relatedPatterns: [],
relatedClusters: ['relationship-history', 'family-social', 'finances'],
enabled: false,
},
];

// ============================================================================
// SUPABASE-BASED SETTINGS FUNCTIONS
// ============================================================================

/**
* Get expansion settings from Supabase (source of truth)
*/
export async function getExpansionSettings(): Promise<SEOExpansionSettings> {
  try {
    const { data, error } = await apiClient
      .rpc('get_seo_expansion_settings', {});

    if (error) {
      console.error('Error fetching expansion settings from Supabase:', error);
      return DEFAULT_EXPANSION_SETTINGS;
    }

    if (!data) {
      return DEFAULT_EXPANSION_SETTINGS;
    }

    const d = data as Record<string, unknown>;

    return {
      pattern_pages_enabled: (d.pattern_pages_enabled as boolean) ?? false,
      situation_pages_enabled: (d.situation_pages_enabled as boolean) ?? false,
      recommended_activation_months: ((d.recommended_activation_months as number) ?? 3) as 3 | 4 | 6,
      admin_notes: (d.admin_notes as string) ?? '',
      include_in_sitemap: (d.include_in_sitemap as boolean) ?? false,
      noindex_until_approved: (d.noindex_until_approved as boolean) ?? true,
      scheduler: {
        enabled: (d.scheduler_enabled as boolean) ?? false,
        frequency: ((d.scheduler_frequency as string) ?? 'weekly') as RolloutFrequency,
        page_count_mode: ((d.scheduler_page_count_mode as string) ?? 'fixed') as PageCountMode,
        fixed_page_count: (d.scheduler_fixed_page_count as number) ?? 2,
        random_min_pages: (d.scheduler_random_min_pages as number) ?? 2,
        random_max_pages: (d.scheduler_random_max_pages as number) ?? 4,
        only_publish_approved: (d.scheduler_only_publish_approved as boolean) ?? true,
        auto_include_in_sitemap: (d.scheduler_auto_include_in_sitemap as boolean) ?? false,
        start_date: (d.start_date as string | null) ?? null,
      },
      guidance: {
        launch_date: (d.launch_date as string | null) ?? null,
        recommended_activation_month: (d.recommended_activation_months as number) ?? 3,
        reminder_banner_enabled: (d.reminder_banner_enabled as boolean) ?? true,
      },
// Deploy webhook is server-side only, not stored in database
};
} catch (e) {
console.error('Error in getExpansionSettings:', e);
return DEFAULT_EXPANSION_SETTINGS;
}
}

/**
* Save expansion settings to Supabase (source of truth)
*/
export async function saveExpansionSettings(
settings: Partial<SEOExpansionSettings>
): Promise<boolean> {
try {
const current = await getExpansionSettings();
const merged = { ...current, ...settings };

const { error } = await apiClient
.rpc('save_seo_expansion_settings', {
patternPagesEnabled: merged.pattern_pages_enabled,
situationPagesEnabled: merged.situation_pages_enabled,
includeInSitemap: merged.include_in_sitemap,
noindexUntilApproved: merged.noindex_until_approved,
recommendedActivationMonths: merged.recommended_activation_months,
schedulerEnabled: merged.scheduler.enabled,
schedulerFrequency: merged.scheduler.frequency,
schedulerPageCountMode: merged.scheduler.page_count_mode,
schedulerFixedPageCount: merged.scheduler.fixed_page_count,
schedulerRandomMinPages: merged.scheduler.random_min_pages,
schedulerRandomMaxPages: merged.scheduler.random_max_pages,
schedulerOnlyPublishApproved: merged.scheduler.only_publish_approved,
schedulerAutoIncludeInSitemap: merged.scheduler.auto_include_in_sitemap,
launchDate: merged.guidance.launch_date,
reminderBannerEnabled: merged.guidance.reminder_banner_enabled,
adminNotes: merged.admin_notes,
});

if (error) {
console.error('Error saving expansion settings to Supabase:', error);
return false;
}

// Note: Deploy webhook config is stored server-side only (Edge Function env var)
// It cannot be set from the frontend for security reasons
return true;
} catch (e) {
console.error('Error in saveExpansionSettings:', e);
return false;
}
}

// ============================================================================
// SITEMAP SYNC STATUS FUNCTIONS
// ============================================================================

/**
* Get current sitemap sync status with honest estimates
*
* NOTE: Many values returned are ESTIMATES, not exact measurements.
* The UI should use is_*_exact flags to display appropriate labels.
*/
export async function getSitemapSyncStatus(): Promise<SitemapSyncStatus | null> {
  try {
    const { data, error } = await apiClient
      .rpc('get_sitemap_sync_status_secure', {});

    if (error || !data) {
      console.error('Error fetching sitemap sync status:', error);
      return null;
    }

    const d = data as Record<string, unknown>;

    return {
      published_pages_count: parseInt(String(d.published_pages_count)) || 0,
      pages_in_sitemap: parseInt(String(d.pages_in_sitemap)) || 0,
      pages_not_in_sitemap: parseInt(String(d.pages_not_in_sitemap)) || 0,
      last_sitemap_sync_at: d.last_sitemap_sync_at as string | null,
      last_rebuild_triggered_at: d.last_rebuild_triggered_at as string | null,
      last_rebuild_status: d.last_rebuild_status as 'error' | 'pending' | 'triggered' | null,
      estimated_completion_at: d.estimated_completion_at as string | null,
      last_scheduler_run_at: d.last_scheduler_run_at as string | null,
      is_pages_not_in_sitemap_exact: (d.is_pages_not_in_sitemap_exact as boolean) ?? false,
      is_last_sync_exact: (d.is_last_sync_exact as boolean) ?? false,
    };
} catch (e) {
console.error('Error in getSitemapSyncStatus:', e);
return null;
}
}

// ============================================================================
// SECURE REBUILD TRIGGER (Coolify)
// ============================================================================

/**
* Trigger a Coolify rebuild via secure API endpoint
*
* SECURITY: This calls a secure API endpoint that:
* - Stores the Coolify webhook URL server-side (never exposed to frontend)
* - Verifies admin authentication
* - Records audit trail
* - Handles errors securely
*
* The frontend never sees or handles the actual Coolify webhook URL.
*/
export async function triggerCoolifyRebuild(): Promise<{
success: boolean;
message: string;
triggeredAt?: string;
estimatedCompletion?: string;
}> {
try {
const token = getToken();

if (!token) {
return {
success: false,
message: 'Authentication required. Please log in.',
};
}

const response = await fetch(
`${import.meta.env.VITE_API_URL}/api/rpc/trigger-rebuild`,
{
method: 'POST',
headers: {
'Authorization': `Bearer ${token}`,
'Content-Type': 'application/json',
},
body: JSON.stringify({
reason: 'admin_triggered',
source: 'admin_dashboard',
}),
}
);

const result = await response.json();

if (!response.ok) {
console.error('Coolify rebuild trigger failed:', response.status, result);
return {
success: false,
message: result.message || `Failed to trigger rebuild: ${response.statusText}`,
};
}

return {
success: true,
message: result.message || 'Rebuild triggered successfully. The site will rebuild within 2-5 minutes.',
triggeredAt: result.triggeredAt,
estimatedCompletion: result.estimatedCompletion,
};
} catch (e) {
console.error('Error triggering Coolify rebuild:', e);
return {
success: false,
message: `Failed to trigger rebuild: ${e instanceof Error ? e.message : 'Unknown error'}`,
};
}
}

/**
* Check if rebuild trigger is available/configured
*
* Note: We can't know for sure if the API endpoint has the webhook configured
* without calling it. This is a safety feature - we don't expose configuration.
*/
export async function isRebuildTriggerAvailable(): Promise<boolean> {
// The rebuild trigger is always "potentially" available if user is admin
// Actual availability is determined when the API is called
// This prevents information leakage about server configuration
try {
const token = getToken();
return !!token;
} catch {
return false;
}
}

// ============================================================================
// SUPABASE-BASED PUBLICATION STATE FUNCTIONS
// ============================================================================

/**
* Get all publication states from Supabase
*/
export async function getAllPublicationStates(): Promise<PagePublicationState[]> {
  try {
    const { data, error } = await apiClient
      .rpc('get_seo_expansion_pages', {});

    if (error) {
      console.error('Error fetching publication states:', error);
      return [];
    }

    return (data as PagePublicationState[]) || [];
} catch (e) {
console.error('Error in getAllPublicationStates:', e);
return [];
}
}

/**
* Get publication state for a specific page
*/
export async function getPagePublicationState(slug: string): Promise<PagePublicationState | null> {
try {
const { data, error } = await apiClient
.from('seo_expansion_pages')
.select('*')
.eq('slug', slug)
.single();

if (error || !data) {
return null;
}

    return data as unknown as PagePublicationState;
} catch (e) {
console.error('Error in getPagePublicationState:', e);
return null;
}
}

/**
* Update publication state for a page
*/
export async function updatePagePublicationState(
slug: string,
updates: Partial<PagePublicationState>
): Promise<boolean> {
try {
const { error } = await apiClient
.from('seo_expansion_pages')
.update({
...updates,
updated_at: new Date().toISOString(),
})
.eq('slug', slug);

if (error) {
console.error('Error updating page publication state:', error);
return false;
}

return true;
} catch (e) {
console.error('Error in updatePagePublicationState:', e);
return false;
}
}

// ============================================================================
// EXPANSION STATUS FUNCTIONS
// ============================================================================

/**
* Check if pattern pages are enabled
* This is the main safety gate - returns false by default
*/
export async function arePatternPagesEnabled(): Promise<boolean> {
try {
const settings = await getExpansionSettings();
return settings.pattern_pages_enabled;
} catch {
// Default to DISABLED on any error - safety first
return false;
}
}

/**
* Check if situation pages are enabled
* This is the main safety gate - returns false by default
*/
export async function areSituationPagesEnabled(): Promise<boolean> {
try {
const settings = await getExpansionSettings();
return settings.situation_pages_enabled;
} catch {
// Default to DISABLED on any error - safety first
return false;
}
}

// ============================================================================
// SAFETY CONTROL FUNCTIONS
// ============================================================================

/**
* Check if expansion pages should be included in sitemap
* Returns false by default - requires explicit admin enable
*/
export async function shouldExpansionPagesBeInSitemap(): Promise<boolean> {
try {
const settings = await getExpansionSettings();
// Only include in sitemap if feature is enabled AND include_in_sitemap is true
const patternEnabled = await arePatternPagesEnabled();
const situationEnabled = await areSituationPagesEnabled();
const anyFeatureEnabled = patternEnabled || situationEnabled;

return anyFeatureEnabled && settings.include_in_sitemap;
} catch {
// Default to EXCLUDED on any error - safety first
return false;
}
}

/**
* Check if a specific page should be in sitemap
* Considers both global settings and page-level settings
*/
export async function shouldPageBeInSitemap(slug: string): Promise<boolean> {
try {
const state = await getPagePublicationState(slug);
if (!state) return false;

// Must be published and explicitly included in sitemap
return state.is_published && state.include_in_sitemap;
} catch {
return false;
}
}

/**
* Check if expansion pages should have noindex meta tag
* Returns true by default (noindex) - requires explicit admin disable of this setting
*/
export async function shouldExpansionPagesHaveNoindex(): Promise<boolean> {
try {
const settings = await getExpansionSettings();
// Only check noindex setting if features are actually enabled
const patternEnabled = await arePatternPagesEnabled();
const situationEnabled = await areSituationPagesEnabled();
const anyFeatureEnabled = patternEnabled || situationEnabled;

if (!anyFeatureEnabled) {
// If features aren't enabled, pages don't exist anyway
return false;
}

// Return true (apply noindex) if noindex_until_approved is true
return settings.noindex_until_approved;
} catch {
// Default to NOINDEX on any error - safety first
return true;
}
}

/**
* Check if a specific page should have noindex
* Considers both global settings and page-level override
*/
export async function shouldPageHaveNoindex(slug: string): Promise<boolean> {
try {
const state = await getPagePublicationState(slug);
if (!state) return true;

// If page has explicit override, use that
if (state.noindex_override !== undefined) {
return state.noindex_override;
}

// Otherwise use global setting
return shouldExpansionPagesHaveNoindex();
} catch {
return true;
}
}

// ============================================================================
// PAGE ACCESS FUNCTIONS (WITH SAFETY CHECKS)
// ============================================================================

/**
* Get all enabled pattern pages
* Returns empty array if pattern pages feature is disabled
*/
export async function getEnabledPatternPages(): Promise<PatternPageConfig[]> {
const enabled = await arePatternPagesEnabled();
if (!enabled) return [];

// Get published slugs from Supabase
const states = await getAllPublicationStates();
const publishedSlugs = new Set(
states
.filter(s => s.page_type === 'pattern' && s.is_published)
.map(s => s.slug)
);

return PATTERN_PAGES.filter(p => publishedSlugs.has(p.slug));
}

/**
* Get all enabled situation pages
* Returns empty array if situation pages feature is disabled
*/
export async function getEnabledSituationPages(): Promise<SituationPageConfig[]> {
const enabled = await areSituationPagesEnabled();
if (!enabled) return [];

// Get published slugs from Supabase
const states = await getAllPublicationStates();
const publishedSlugs = new Set(
states
.filter(s => s.page_type === 'situation' && s.is_published)
.map(s => s.slug)
);

return SITUATION_PAGES_CONFIG.filter(p => publishedSlugs.has(p.slug));
}

/**
* Get a specific pattern page by slug
* Returns null if pattern pages feature is disabled or page not found/not published
*/
export async function getPatternPageBySlug(slug: string): Promise<PatternPageConfig | null> {
const enabled = await arePatternPagesEnabled();
if (!enabled) return null;

const page = PATTERN_PAGES.find(p => p.slug === slug);
if (!page) return null;

const state = await getPagePublicationState(slug);
// Page must be published to be accessible
if (!state?.is_published) return null;

return page;
}

/**
* Get a specific situation page by slug
* Returns null if situation pages feature is disabled or page not found/not published
*/
export async function getSituationPageBySlug(slug: string): Promise<SituationPageConfig | null> {
const enabled = await areSituationPagesEnabled();
if (!enabled) return null;

const page = SITUATION_PAGES_CONFIG.find(p => p.slug === slug);
if (!page) return null;

const state = await getPagePublicationState(slug);
// Page must be published to be accessible
if (!state?.is_published) return null;

return page;
}

// ============================================================================
// PUBLICATION ACTIONS (USING SUPABASE)
// ============================================================================

/**
* Mark page as reviewed
*/
export async function markPageReviewed(slug: string, notes?: string): Promise<boolean> {
try {
const { error } = await apiClient
.rpc('update_seo_expansion_page_status', {
slug,
status: 'reviewed',
notes: notes || null,
});

if (error) {
console.error('Error marking page as reviewed:', error);
return false;
}

return true;
} catch (e) {
console.error('Error in markPageReviewed:', e);
return false;
}
}

/**
* Mark page as approved
*/
export async function markPageApproved(slug: string): Promise<boolean> {
try {
const { error } = await apiClient
.rpc('update_seo_expansion_page_status', {
slug,
status: 'approved',
});

if (error) {
console.error('Error marking page as approved:', error);
return false;
}

return true;
} catch (e) {
console.error('Error in markPageApproved:', e);
return false;
}
}

/**
* Publish a page
*/
export async function publishPage(
slug: string,
includeInSitemap: boolean = false
): Promise<boolean> {
try {
const settings = await getExpansionSettings();

const { error } = await apiClient
.rpc('update_seo_expansion_page_status', {
slug,
status: 'published',
includeInSitemap,
noindexOverride: settings.noindex_until_approved,
});

if (error) {
console.error('Error publishing page:', error);
return false;
}

return true;
} catch (e) {
console.error('Error in publishPage:', e);
return false;
}
}

/**
* Unpublish a page
*/
export async function unpublishPage(slug: string): Promise<boolean> {
try {
const { error } = await apiClient
.rpc('update_seo_expansion_page_status', {
slug,
status: 'unpublished',
includeInSitemap: false,
});

if (error) {
console.error('Error unpublishing page:', error);
return false;
}

return true;
} catch (e) {
console.error('Error in unpublishPage:', e);
return false;
}
}

/**
* Bulk publish pages
*/
export async function bulkPublishPages(
slugs: string[],
includeInSitemap: boolean = false
): Promise<{
succeeded: string[];
failed: string[];
}> {
try {
const { error } = await apiClient
.rpc('bulk_update_seo_expansion_pages', {
slugs,
status: 'published',
includeInSitemap,
});

if (error) {
console.error('Error in bulk publish:', error);
return { succeeded: [], failed: slugs };
}

// Check individually which pages were updated successfully
const succeeded: string[] = [];
const failed: string[] = [];

for (const slug of slugs) {
const state = await getPagePublicationState(slug);
if (state?.is_published) {
succeeded.push(slug);
} else {
failed.push(slug);
}
}

return { succeeded, failed };
} catch (e) {
console.error('Error in bulkPublishPages:', e);
return { succeeded: [], failed: slugs };
}
}

/**
* Bulk unpublish pages
*/
export async function bulkUnpublishPages(slugs: string[]): Promise<{
succeeded: string[];
failed: string[];
}> {
try {
const { error } = await apiClient
.rpc('bulk_update_seo_expansion_pages', {
slugs,
status: 'unpublished',
includeInSitemap: false,
});

if (error) {
console.error('Error in bulk unpublish:', error);
return { succeeded: [], failed: slugs };
}

const succeeded: string[] = [];
const failed: string[] = [];

for (const slug of slugs) {
const state = await getPagePublicationState(slug);
if (state?.status === 'unpublished') {
succeeded.push(slug);
} else {
failed.push(slug);
}
}

return { succeeded, failed };
} catch (e) {
console.error('Error in bulkUnpublishPages:', e);
return { succeeded: [], failed: slugs };
}
}

/**
* Bulk mark pages as reviewed
*/
export async function bulkMarkReviewed(slugs: string[]): Promise<{
succeeded: string[];
failed: string[];
}> {
try {
const { error } = await apiClient
.rpc('bulk_update_seo_expansion_pages', {
slugs,
status: 'reviewed',
});

if (error) {
console.error('Error in bulk mark reviewed:', error);
return { succeeded: [], failed: slugs };
}

const succeeded: string[] = [];
const failed: string[] = [];

for (const slug of slugs) {
const state = await getPagePublicationState(slug);
if (state?.status === 'reviewed') {
succeeded.push(slug);
} else {
failed.push(slug);
}
}

return { succeeded, failed };
} catch (e) {
console.error('Error in bulkMarkReviewed:', e);
return { succeeded: [], failed: slugs };
}
}

/**
* Bulk mark pages as approved
*/
export async function bulkMarkApproved(slugs: string[]): Promise<{
succeeded: string[];
failed: string[];
}> {
const succeeded: string[] = [];
const failed: string[] = [];

try {
const { error } = await apiClient
.rpc('bulk_update_seo_expansion_pages', {
slugs,
status: 'approved',
});

if (error) {
console.error('Error in bulk mark approved:', error);
return { succeeded: [], failed: slugs };
}

for (const slug of slugs) {
const state = await getPagePublicationState(slug);
if (state?.status === 'approved') {
succeeded.push(slug);
} else {
failed.push(slug);
}
}

return { succeeded, failed };
} catch (err) {
console.error('Error in bulkMarkApproved:', err);
return { succeeded, failed };
}
}

// ============================================================================
// ADMIN FUNCTIONS (DEPRECATED - use Supabase functions directly)
// ============================================================================

/**
* Enable or disable a specific pattern page (for admin use)
* @deprecated Use publishPage/unpublishPage instead
*/
export async function setPatternPageEnabled(
slug: string,
enabled: boolean
): Promise<boolean> {
if (enabled) {
return publishPage(slug);
} else {
return unpublishPage(slug);
}
}

/**
* Enable or disable a specific situation page (for admin use)
* @deprecated Use publishPage/unpublishPage instead
*/
export async function setSituationPageEnabled(
slug: string,
enabled: boolean
): Promise<boolean> {
if (enabled) {
return publishPage(slug);
} else {
return unpublishPage(slug);
}
}

// ============================================================================
// STATISTICS FOR ADMIN
// ============================================================================

export interface ExpansionStats {
// Page counts
totalPatternPages: number;
enabledPatternPages: number;
disabledPatternPages: number;
totalSituationPages: number;
enabledSituationPages: number;
disabledSituationPages: number;
totalExpansionPages: number;
// Publication state counts
draftCount: number;
reviewedCount: number;
approvedCount: number;
publishedCount: number;
unpublishedCount: number;
// Feature status
patternPagesFeatureEnabled: boolean;
situationPagesFeatureEnabled: boolean;
// Safety settings
includeInSitemap: boolean;
noindexUntilApproved: boolean;
// Scheduler
schedulerEnabled: boolean;
}

/**
* Get expansion statistics for admin dashboard
*/
export async function getExpansionStats(): Promise<ExpansionStats> {
try {
const [settings, states] = await Promise.all([
getExpansionSettings(),
getAllPublicationStates(),
]);

const patternStates = states.filter(s => s.page_type === 'pattern');
const situationStates = states.filter(s => s.page_type === 'situation');

return {
totalPatternPages: PATTERN_PAGES.length,
enabledPatternPages: patternStates.filter(s => s.is_published).length,
disabledPatternPages: PATTERN_PAGES.length - patternStates.filter(s => s.is_published).length,
totalSituationPages: SITUATION_PAGES_CONFIG.length,
enabledSituationPages: situationStates.filter(s => s.is_published).length,
disabledSituationPages: SITUATION_PAGES_CONFIG.length - situationStates.filter(s => s.is_published).length,
totalExpansionPages: PATTERN_PAGES.length + SITUATION_PAGES_CONFIG.length,
draftCount: states.filter(s => s.status === 'draft').length,
reviewedCount: states.filter(s => s.status === 'reviewed').length,
approvedCount: states.filter(s => s.status === 'approved').length,
publishedCount: states.filter(s => s.status === 'published').length,
unpublishedCount: states.filter(s => s.status === 'unpublished').length,
patternPagesFeatureEnabled: settings.pattern_pages_enabled,
situationPagesFeatureEnabled: settings.situation_pages_enabled,
includeInSitemap: settings.include_in_sitemap,
noindexUntilApproved: settings.noindex_until_approved,
schedulerEnabled: settings.scheduler.enabled,
};
} catch (e) {
console.error('Error in getExpansionStats:', e);
return {
totalPatternPages: PATTERN_PAGES.length,
enabledPatternPages: 0,
disabledPatternPages: PATTERN_PAGES.length,
totalSituationPages: SITUATION_PAGES_CONFIG.length,
enabledSituationPages: 0,
disabledSituationPages: SITUATION_PAGES_CONFIG.length,
totalExpansionPages: PATTERN_PAGES.length + SITUATION_PAGES_CONFIG.length,
draftCount: 0,
reviewedCount: 0,
approvedCount: 0,
publishedCount: 0,
unpublishedCount: 0,
patternPagesFeatureEnabled: false,
situationPagesFeatureEnabled: false,
includeInSitemap: false,
noindexUntilApproved: true,
schedulerEnabled: false,
};
}
}

// ============================================================================
// AI RECOMMENDATIONS
// ============================================================================

// Cluster strength scoring for AI recommendations
const CLUSTER_STRENGTH: Record<string, number> = {
'relationship-history': 95,
'wedding-ceremony': 90,
'living-together': 85,
'finances': 80,
'family-social': 75,
};

/**
* Calculate AI recommendations for a page
* Rule-based scoring system (not actual AI, but structured for future AI integration)
*/
export function calculatePageRecommendations(
slug: string
): PageAIRecommendations {
const config = PATTERN_PAGES.find(p => p.slug === slug) ||
SITUATION_PAGES_CONFIG.find(p => p.slug === slug);

if (!config) {
return {
slug,
recommended_priority: 0,
recommended_for_early_publish: false,
quality_hint: 'Page not found',
duplicate_risk: null,
cluster_coverage_suggestion: null,
strengths: [],
concerns: ['Page configuration not found'],
};
}

const isPattern = 'parentCluster' in config;

// Base priority from cluster strength
let priority = 50;
const concerns: string[] = [];
const strengths: string[] = [];

if (isPattern) {
const pattern = config as PatternPageConfig;
const clusterStrength = CLUSTER_STRENGTH[pattern.parentCluster] || 50;
priority = clusterStrength;

// Bonus for high-search-intent topics
if (pattern.slug.includes('online') || pattern.slug.includes('courthouse')) {
priority += 10;
strengths.push('High search intent topic');
}

// Concerns for potentially thin content
if (pattern.relatedQuestions.length < 2) {
priority -= 10;
concerns.push('Limited related questions - may be thin content');
}
} else {
const situation = config as SituationPageConfig;
priority = 70; // Situation pages generally have good priority

// Bonus for comprehensive situation pages
if (situation.relatedPatterns.length > 1) {
priority += 10;
strengths.push('Comprehensive coverage with multiple related patterns');
}

if (situation.relatedClusters.length > 1) {
priority += 5;
strengths.push('Cross-cluster coverage');
}
}

// Check for duplicate/similar content risk
let duplicate_risk: 'low' | 'medium' | 'high' | null = 'low';

const similarSlugs = PATTERN_PAGES.filter(p =>
p.slug !== slug &&
(p.parentCluster === (config as PatternPageConfig).parentCluster ||
p.slug.split('-').some(part => slug.includes(part) && part.length > 4))
);

if (similarSlugs.length > 2) {
duplicate_risk = 'medium';
concerns.push(`Similar to ${similarSlugs.length} other pages - check for redundancy`);
}

// Determine early publish recommendation
const recommended_for_early_publish = priority >= 80 && duplicate_risk === 'low';

// Quality hint
let quality_hint = 'Standard page';
if (priority >= 85) {
quality_hint = 'High priority - strong cluster coverage';
} else if (priority >= 70) {
quality_hint = 'Good priority - solid topic';
} else if (priority < 60) {
quality_hint = 'Lower priority - consider for later rollout';
}

// Cluster coverage suggestion
let cluster_coverage_suggestion: string | null = null;
if (isPattern) {
const pattern = config as PatternPageConfig;
const clusterPages = PATTERN_PAGES.filter(p => p.parentCluster === pattern.parentCluster);
if (clusterPages.length < 3) {
cluster_coverage_suggestion = `Consider adding more pages to ${pattern.parentCluster} cluster`;
}
}

return {
slug,
recommended_priority: Math.max(0, Math.min(100, priority)),
recommended_for_early_publish,
quality_hint,
duplicate_risk,
cluster_coverage_suggestion,
strengths: strengths.length > 0 ? strengths : ['Standard content page'],
concerns: concerns.length > 0 ? concerns : [],
};
}

/**
* Get AI recommendations for all pages
*/
export function getAllPageRecommendations(): PageAIRecommendations[] {
const allSlugs = [
...PATTERN_PAGES.map(p => p.slug),
...SITUATION_PAGES_CONFIG.map(p => p.slug),
];

return allSlugs
.map(slug => calculatePageRecommendations(slug))
.sort((a, b) => b.recommended_priority - a.recommended_priority);
}

/**
* Get top recommended pages for early publish
*/
export function getTopRecommendedPages(count = 5): PageAIRecommendations[] {
return getAllPageRecommendations()
.filter(r => r.recommended_for_early_publish)
.slice(0, count);
}

// ============================================================================
// SCHEDULER EXECUTION (ADMIN-RUN)
// ============================================================================

export interface SchedulerPreviewResult {
eligibleSlugs: string[];
wouldPublishCount: number;
isRandom: boolean;
settings: RolloutSchedulerSettings;
}

export interface SchedulerRunResult {
runId: string | null;
published: string[];
failed: string[];
count: number;
isRandom: boolean;
sitemapIncluded: boolean;
onlyApprovedPublished: boolean;
durationMs: number;
}

/**
* Preview what the next scheduler cycle would publish
*/
export async function previewNextSchedulerCycle(): Promise<SchedulerPreviewResult> {
const settings = await getExpansionSettings();

if (!settings.scheduler.enabled) {
return {
eligibleSlugs: [],
wouldPublishCount: 0,
isRandom: false,
settings: settings.scheduler,
};
}

// Get all states
const states = await getAllPublicationStates();

// Determine count
let count: number;
let isRandom = false;

if (settings.scheduler.page_count_mode === 'random') {
count = Math.floor(
Math.random() * (settings.scheduler.random_max_pages - settings.scheduler.random_min_pages + 1)
) + settings.scheduler.random_min_pages;
isRandom = true;
} else {
count = settings.scheduler.fixed_page_count;
}

// Get eligible pages
const eligible = states.filter(s => {
const statusOk = settings.scheduler.only_publish_approved
? s.status === 'approved'
: ['approved', 'reviewed', 'draft'].includes(s.status);
const notPublished = !s.is_published;
return statusOk && notPublished;
});

// Sort by AI recommendation priority
const recommendations = getAllPageRecommendations();
const priorityMap = new Map(recommendations.map(r => [r.slug, r.recommended_priority]));

eligible.sort((a, b) =>
(priorityMap.get(b.slug) || 0) - (priorityMap.get(a.slug) || 0)
);

const selected = eligible.slice(0, count);

return {
eligibleSlugs: selected.map(s => s.slug),
wouldPublishCount: selected.length,
isRandom,
settings: settings.scheduler,
};
}

/**
* Execute the scheduler cycle manually (admin-run)
*/
export async function executeSchedulerCycle(): Promise<SchedulerRunResult> {
const startTime = Date.now();
const settings = await getExpansionSettings();

if (!settings.scheduler.enabled) {
return {
runId: null,
published: [],
failed: [],
count: 0,
isRandom: false,
sitemapIncluded: false,
onlyApprovedPublished: settings.scheduler.only_publish_approved,
durationMs: Date.now() - startTime,
};
}

const preview = await previewNextSchedulerCycle();
const slugs = preview.eligibleSlugs;

if (slugs.length === 0) {
const durationMs = Date.now() - startTime;

// Record the run even if nothing was published
const { data: runId } = await apiClient
.rpc('record_scheduler_run', {
triggeredManually: true,
pagesConsidered: 0,
pagesPublished: 0,
publishedSlugs: [],
sitemapIncluded: false,
noindexRespected: settings.noindex_until_approved,
onlyApprovedPublished: settings.scheduler.only_publish_approved,
executionDurationMs: durationMs,
});

return {
      runId: (runId as string | null) || null,
published: [],
failed: [],
count: 0,
isRandom: preview.isRandom,
sitemapIncluded: false,
onlyApprovedPublished: settings.scheduler.only_publish_approved,
durationMs,
};
}

// Publish the pages
const includeInSitemap = settings.scheduler.auto_include_in_sitemap && settings.include_in_sitemap;
const { succeeded, failed } = await bulkPublishPages(slugs, includeInSitemap);

const durationMs = Date.now() - startTime;

// Record the run
const { data: runId } = await apiClient
.rpc('record_scheduler_run', {
triggeredManually: true,
pagesConsidered: slugs.length,
pagesPublished: succeeded.length,
publishedSlugs: succeeded,
sitemapIncluded: includeInSitemap,
noindexRespected: settings.noindex_until_approved,
onlyApprovedPublished: settings.scheduler.only_publish_approved,
executionDurationMs: durationMs,
});

return {
      runId: (runId as string | null) || null,
published: succeeded,
failed,
count: succeeded.length,
isRandom: preview.isRandom,
sitemapIncluded: includeInSitemap,
onlyApprovedPublished: settings.scheduler.only_publish_approved,
durationMs,
};
}

// ============================================================================
// SCHEDULER RUN HISTORY
// ============================================================================

export interface SchedulerRun {
id: string;
triggered_by: string | null;
triggered_manually: boolean;
pages_considered: number;
pages_published: number;
published_slugs: string[];
sitemap_included: boolean;
noindex_respected: boolean;
only_approved_published: boolean;
created_at: string;
}

/**
* Get recent scheduler run history
*/
export async function getSchedulerRunHistory(limit = 10): Promise<SchedulerRun[]> {
try {
const { data, error } = await apiClient
.rpc('get_scheduler_run_history', {
limit,
});

if (error) {
console.error('Error fetching scheduler run history:', error);
return [];
}

    return (data as SchedulerRun[]) || [];
} catch (err) {
console.error('Error in getSchedulerRunHistory:', err);
return [];
}
}

/**
* Get the most recent scheduler run
*/
export async function getLastSchedulerRun(): Promise<SchedulerRun | null> {
const history = await getSchedulerRunHistory(1);
return history[0] || null;
}

// ============================================================================
// ROLLOUT GUIDANCE FUNCTIONS
// ============================================================================

/**
* Calculate days since launch
*/
export async function getDaysSinceLaunch(): Promise<number | null> {
const settings = await getExpansionSettings();
if (!settings.guidance.launch_date) return null;

const launch = new Date(settings.guidance.launch_date);
const now = new Date();
const diff = now.getTime() - launch.getTime();
return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
* Check if reminder banner should be shown
*/
export async function shouldShowReminderBanner(): Promise<boolean> {
const settings = await getExpansionSettings();
if (!settings.guidance.reminder_banner_enabled) return false;

const daysSinceLaunch = await getDaysSinceLaunch();
if (daysSinceLaunch === null) return false;

const recommendedDays = (settings.guidance.recommended_activation_month || 3) * 30;

// Show banner when approaching recommended activation window
return daysSinceLaunch >= recommendedDays - 14;
}

/**
* Get current rollout phase based on days since launch
*/
export async function getCurrentRolloutPhase(): Promise<{
phase: 1 | 2 | 3;
name: string;
description: string;
actions: string[];
}> {
const daysSinceLaunch = await getDaysSinceLaunch();

if (daysSinceLaunch === null) {
return {
phase: 1,
name: 'Phase 1: Foundation',
description: 'Launch to Month 3 - Focus on core pages',
actions: [
'Keep expansion pages OFF',
'Keep sitemap inclusion OFF',
'Keep noindex ON',
'Focus on indexing core pages first',
],
};
}

const monthsSinceLaunch = daysSinceLaunch / 30;

if (monthsSinceLaunch < 3) {
return {
phase: 1,
name: 'Phase 1: Foundation',
description: 'Launch to Month 3 - Focus on core pages',
actions: [
'Keep expansion pages OFF',
'Keep sitemap inclusion OFF',
'Keep noindex ON',
'Focus on indexing core pages first',
],
};
} else if (monthsSinceLaunch < 4) {
return {
phase: 2,
name: 'Phase 2: Gradual Rollout',
description: 'Month 3 to 4 - Begin expansion',
actions: [
'Begin with only approved pages',
'Publish 2–4 expansion pages at a time',
'Keep them noindex first if doing a soft rollout',
'Do not add everything to sitemap immediately',
],
};
} else {
return {
phase: 3,
name: 'Phase 3: Expansion',
description: 'Month 4 to 6+ - Scale up',
actions: [
'Consider adding selected published pages to sitemap',
'Remove noindex only when pages are reviewed and ready',
'Gradually increase rollout if indexing is healthy',
],
};
}
}

// ============================================================================
// DEPRECATED - localStorage functions removed
// ============================================================================

/**
* @deprecated localStorage is no longer used as source of truth.
* All persistence is now handled through Supabase.
*/
export function loadPublicationStates(): void {
console.warn('loadPublicationStates is deprecated. Publication state is now managed in Supabase.');
}

/**
* @deprecated localStorage is no longer used as source of truth.
* All persistence is now handled through Supabase.
*/
export function savePublicationStates(): void {
console.warn('savePublicationStates is deprecated. Publication state is now managed in Supabase.');
}
