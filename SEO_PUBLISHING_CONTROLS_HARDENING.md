# SEO Publishing Controls Hardening - Implementation Summary

## Overview
This implementation hardens the SEO publishing controls by replacing localStorage with real shared persistence (Supabase), implementing admin-run scheduler execution, and fixing the missing parent cluster column.

## Changes Made

### 1. ✅ Removed localStorage as Source of Truth
**What was changed:**
- All publication state now stored in Supabase (`seo_expansion_pages` table)
- All settings now stored in Supabase (`seo_expansion_settings` table)
- All scheduler runs logged in Supabase (`seo_expansion_scheduler_runs` table)
- localStorage functions kept for backward compatibility but marked as deprecated

**Files modified:**
- `app/src/lib/seo/expansion.ts` - Complete rewrite to use Supabase RPC calls
- `app/src/components/admin/SEOExpansionTab.tsx` - Updated to use async Supabase functions

**Persistence layer used:**
- Supabase PostgreSQL database with RLS policies
- Build-time sync script (`scripts/sync-expansion-pages.ts`) generates JSON for sitemap

### 2. ✅ Admin Dashboard as Control Surface
**What was implemented:**
- All controls remain in the Admin dashboard (SuperAdminPortal → SEO Expansion tab)
- No terminal commands or cron setup required
- Manual execution buttons with preview capability

**New UI elements:**
- "Rollout Rules & Manual Execution" section
- "Preview Next Batch" button with dialog
- "Run Next Cycle Now" button
- Execution history collapsible section

### 3. ✅ Admin-Run Scheduler (Replaced Automatic Scheduler)
**What was implemented:**
- Scheduler rules can be configured but don't auto-execute
- Admin must manually trigger execution
- Preview mode shows what would be published before execution
- Honest UX about manual execution

**New functions:**
- `previewNextSchedulerCycle()` - Shows what would be published
- `executeSchedulerCycle()` - Manually runs the scheduler
- Both log results to Supabase audit table

**UX improvements:**
- Clear message: "Automatic timing rules can be configured here. For now, rollout is executed manually"
- Renamed "Scheduler" to "Rollout Rules" to avoid implying background automation
- "Run Next Cycle Now" button with loading state

### 4. ✅ Fixed Missing Parent Cluster Column
**What was added:**
- New "Parent Cluster" column in the review queue table
- Displays the content cluster each page belongs to
- Data comes from Supabase `parent_cluster` field

**File modified:**
- `app/src/components/admin/SEOExpansionTab.tsx` - Table now has 9 columns including Parent Cluster

### 5. ✅ Public/Sitemap Logic Reads Real Persisted State
**What was implemented:**
- Sitemap generation reads from synced JSON file (`seo-expansion-config.json`)
- JSON file is generated during build from Supabase
- Only published pages with `include_in_sitemap=true` are added
- Page access functions check Supabase state, not local config

**Files modified:**
- `app/src/lib/seo/sitemap.ts` - Added `generateExpansionSitemapEntries()`
- `app/scripts/sync-expansion-pages.ts` - New build-time sync script

### 6. ✅ Execution Log / Audit Trail
**What was implemented:**
- New `seo_expansion_scheduler_runs` table in Supabase
- Logs every manual execution with:
  - Timestamp
  - Who triggered it (user ID)
  - Pages considered
  - Pages published
  - Published slugs
  - Sitemap inclusion status
  - Noindex respect status
  - Execution duration

**UI:**
- Collapsible "Rollout Execution History" section
- Shows recent runs with badges for settings
- Displays published slugs for each run

### 7. ✅ Safety Defaults Preserved
**Defaults remain:**
- `pattern_pages_enabled: false`
- `situation_pages_enabled: false`
- `scheduler_enabled: false`
- `include_in_sitemap: false`
- `noindex_until_approved: true`
- All pages start as `draft` / `is_published: false`

**Additional safety:**
- Build succeeds with 0 expansion pages in sitemap by default
- All expansion pages start unpublished in database

## Files Created

1. **`app/supabase/migrations/20240321_seo_expansion_publishing.sql`**
   - Creates 3 new tables with RLS policies
   - Creates 11 RPC functions for safe access
   - Seeds initial page data

2. **`app/scripts/sync-expansion-pages.ts`**
   - Build-time script to sync expansion pages from Supabase to JSON
   - Runs during `npm run build`

## Files Modified

1. **`app/src/lib/seo/expansion.ts`** (major rewrite)
   - Replaced all localStorage with Supabase calls
   - Added new scheduler execution functions
   - Added audit trail functions
   - Deprecated old localStorage functions

2. **`app/src/components/admin/SEOExpansionTab.tsx`** (major rewrite)
   - Added parent cluster column
   - Added manual scheduler execution UI
   - Added execution history section
   - Updated to use async Supabase functions
   - Added honest UX messaging about manual execution

3. **`app/src/lib/seo/sitemap.ts`**
   - Added `generateExpansionSitemapEntries()` function
   - Reads from synced JSON config

4. **`app/src/lib/seo/index.ts`**
   - Updated exports to include new functions

5. **`app/package.json`**
   - Added `sync-expansion-pages.ts` to prebuild script

## Build Verification

```
✅ Build succeeds
✅ TypeScript compiles with 0 errors
✅ 25 URLs in sitemap (0 expansion pages by default)
✅ Expansion config sync runs during build
✅ Default settings: all OFF, all pages unpublished
```

## Database Schema

### seo_expansion_settings (1 row)
- `pattern_pages_enabled` (bool, default: false)
- `situation_pages_enabled` (bool, default: false)
- `include_in_sitemap` (bool, default: false)
- `noindex_until_approved` (bool, default: true)
- `scheduler_enabled` (bool, default: false)
- `scheduler_frequency`, `scheduler_page_count_mode`, etc.
- `launch_date`, `reminder_banner_enabled`

### seo_expansion_pages (16 rows - 1 per page)
- `slug`, `page_type`, `parent_cluster`
- `status` (draft/reviewed/approved/published/unpublished)
- `is_published`, `include_in_sitemap`, `noindex_override`
- `reviewed_at`, `reviewed_by`, `approved_at`, `approved_by`, etc.

### seo_expansion_scheduler_runs (audit log)
- `triggered_by`, `triggered_manually`
- `pages_considered`, `pages_published`, `published_slugs`
- `sitemap_included`, `noindex_respected`
- `created_at`

## Admin User Instructions (Shown in UI)

**Persistence Notice:**
> "Changes here are saved to the database and affect shared publishing state across all sessions and devices."

**Manual Execution Notice:**
> "Automatic timing rules can be configured here. For now, rollout is executed manually from this dashboard. Use 'Preview Next Batch' to review before publishing."

**Best Practices:**
- Use "Preview Next Rollout Batch" before publishing
- "Run Scheduler Now" executes one safe rollout cycle
- Keep sitemap inclusion off until pages are reviewed and ready
- Recommended activation window: 3–6 months after launch

## Remaining Limitations

1. **No true background cron automation** - The scheduler is manually triggered from the admin dashboard. This is by design for safety and simplicity for a non-technical admin.

2. **Sitemap requires rebuild** - Expansion pages added to sitemap require a new build to be reflected in the generated sitemap.xml. The sync script runs during build.

3. **Supabase required for production** - The app requires Supabase credentials to be configured for the expansion publishing system to work in production.

## Security

- All Supabase tables have Row Level Security (RLS) enabled
- Only admin users can modify expansion settings or page states
- Service role has full access for build-time scripts
- Read access is public for page visibility checks

## Verification Checklist

- [x] localStorage removed as source of truth
- [x] Supabase used as real persistence layer
- [x] Admin dashboard can run scheduler cycles manually
- [x] Parent cluster column added to review queue
- [x] Public/sitemap logic reads from shared persisted state
- [x] Execution history/log added
- [x] Build succeeds
- [x] No expansion pages public by default
- [x] Safety defaults preserved
