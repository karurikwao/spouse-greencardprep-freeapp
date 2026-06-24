# InterviewReady Safe Patch - Detailed Documentation

**File:** `PATCH_EXISTING_TO_CURRENT_SAFE.sql`  
**Created:** 2026-03-15  
**Purpose:** Safe incremental patch for existing InterviewReady Supabase project  
**Target:** Existing hosted Supabase projects only (NOT for fresh installs)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Foundation](#architecture-foundation)
3. [Section-by-Section Breakdown](#section-by-section-breakdown)
4. [Pre-Flight Checklist](#pre-flight-checklist)
5. [Execution Guide](#execution-guide)
6. [Verification Steps](#verification-steps)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Comparison with Rejected SQL](#comparison-with-rejected-sql)
10. [Architecture Decision Records](#architecture-decision-records)

---

## Executive Summary

### What This Patch Fixes

This patch addresses **six critical issues** identified in the previous "corrected" SQL that was rejected:

| Issue | Severity | Fix in This Patch |
|-------|----------|-------------------|
| Recursive RLS on `user_profiles` | **Critical** | Non-recursive `is_admin()` / `is_superadmin()` helpers |
| Missing AI write functions | **Critical** | Proper functions for current `ai_daily_usage` architecture |
| PDF status constraint incomplete | **High** | All 5 app statuses included |
| Missing SEO function definitions | **High** | Complete `CREATE OR REPLACE FUNCTION` statements |
| Dangerous blanket grants | **Medium** | Specific table-level grants only |
| Schema drift / wrong tables | **Critical** | Only references tables that actually exist |

### What Makes This "Safe"

1. **No destructive operations** - No `DROP TABLE`, no `DELETE`, no data loss
2. **Idempotent** - Can be run multiple times without error
3. **Assumes existing schema** - Only fixes/enhances, doesn't recreate
4. **Honest about limitations** - Documents where RPCs are needed vs table policies
5. **Verified against actual migrations** - Based on 20 audited migration files

---

## Architecture Foundation

### Database Schema Reality

After auditing all 20 migration files, here is the **actual** current schema:

#### AI Tracking System (CURRENT - Not Old)

```
ai_daily_usage
├── id (UUID, PK)
├── user_id (UUID, FK)
├── usage_date (DATE)
├── sessions_count (INTEGER)
├── total_turns (INTEGER)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

ai_session_tracking
├── id (UUID, PK)
├── user_id (UUID, FK)
├── session_started_at (TIMESTAMPTZ)
├── session_ended_at (TIMESTAMPTZ)
├── turns_count (INTEGER)
├── provider (TEXT)
├── model (TEXT)
├── topic_id (TEXT)
├── completed (BOOLEAN)
└── created_at (TIMESTAMPTZ)
```

**NOT** these non-existent tables:
- ~~`ai_usage`~~
- ~~`ai_usage_tiers`~~
- ~~`ai_interviews`~~ (different table exists with different schema)
- ~~`interview_questions`~~

#### Content Management System

```
site_announcements / site_trust_snippets / site_content_blocks
├── id (UUID, PK)
├── title (TEXT)
├── body (TEXT) [announcements/blocks only]
├── subtitle (TEXT) [snippets only]
├── status (TEXT: 'draft' | 'published' | 'archived')
├── placement (TEXT)
├── target_audience (TEXT: 'all' | 'anonymous' | 'logged_in' | 'trial' | 'paid' | 'expired')
├── starts_at (TIMESTAMPTZ)
├── ends_at (TIMESTAMPTZ)
├── priority (INTEGER)
└── ... metadata columns

content_dismissals
├── id (UUID, PK)
├── user_id (UUID, FK)
├── content_type (TEXT: 'announcement' | 'trust_snippet' | 'content_block')
├── content_id (UUID)
├── placement (TEXT)
└── dismissed_at (TIMESTAMPTZ)
```

#### Verification Code System

```
site_verification_codes
├── id (UUID, PK)
├── placement (TEXT: 'head' | 'footer' | 'body_end')
├── code (TEXT)
├── is_enabled (BOOLEAN)
├── notes (TEXT)
├── environment (TEXT)
├── created_by (UUID, FK)
└── updated_by (UUID, FK)
```

**NOT** `site_verification` (singular) - that was a different concept from rejected SQL.

---

## Section-by-Section Breakdown

### SECTION 1: Fix Recursive RLS on user_profiles

**Problem:**
The original policies checked admin status by querying `user_profiles` within the policy itself:

```sql
-- PROBLEMATIC (recursive)
CREATE POLICY "Admins can view all" ON user_profiles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));
```

This creates infinite recursion because the policy queries the same table it's protecting.

**Solution:**
Helper functions with `SECURITY DEFINER` (bypasses RLS):

```sql
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND role IN ('admin', 'superadmin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then policies use the helper:

```sql
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT TO authenticated 
  USING (is_admin(auth.uid()));
```

**Why this works:** `SECURITY DEFINER` runs with the privileges of the function creator (postgres), bypassing RLS checks inside the function.

---

### SECTION 2: AI Tracking Functions (Current Architecture)

**Functions Created:**

#### `get_or_create_daily_usage(p_user_id UUID)`
- Returns today's usage record for the user
- Creates record if doesn't exist (sessions_count=0, total_turns=0)
- Used by other functions to ensure record exists

#### `record_ai_session_start(p_user_id, p_provider, p_model, p_topic_id)`
- Creates entry in `ai_session_tracking`
- Increments `sessions_count` in today's `ai_daily_usage` record
- Returns the new session ID

**Flow:**
```
App calls record_ai_session_start()
  → get_or_create_daily_usage() ensures today's record exists
  → Updates ai_daily_usage.sessions_count + 1
  → Inserts into ai_session_tracking
  → Returns session_id
```

#### `record_ai_turn(p_user_id, p_session_id, p_turn_count)`
- Increments `total_turns` in today's `ai_daily_usage`
- Increments `turns_count` in the specific session
- Returns boolean success

**Flow:**
```
App calls record_ai_turn() after each AI exchange
  → Updates ai_daily_usage.total_turns
  → Updates ai_session_tracking.turns_count
  → Returns true
```

#### `check_ai_usage_limits(p_user_id)`
- Checks subscription status via `get_effective_subscription()`
- Gets plan limits from `plan_config`
- Compares against today's usage
- Returns detailed status object:
  ```typescript
  {
    allowed: boolean,
    reason: string | null,
    plan_type: string,
    max_sessions_per_day: number,
    max_turns_per_session: number,
    sessions_used_today: number,
    turns_used_today: number,
    sessions_remaining: number,
    turns_remaining: number
  }
  ```

**Why These Are Safe:**
- Only reference tables that exist (`ai_daily_usage`, `ai_session_tracking`)
- Match the current app architecture (Supabase-backed, not localStorage)
- Don't conflict with legacy `ai_interview_sessions` table (separate system)

---

### SECTION 3: PDF Download Event Status Fix

**The Problem:**
The TypeScript type allows 5 statuses:
```typescript
type DownloadEventStatus = 
  | 'requested' 
  | 'access_granted' 
  | 'denied' 
  | 'served' 
  | 'completed_estimated';
```

But the database constraint only had 3:
```sql
CHECK (event_status IN ('requested', 'served', 'completed_estimated'))
```

This causes errors when app tries to save 'access_granted' or 'denied'.

**The Fix:**
```sql
ALTER TABLE IF EXISTS pdf_download_events 
DROP CONSTRAINT IF EXISTS pdf_download_events_event_status_check;

ALTER TABLE IF EXISTS pdf_download_events 
ADD CONSTRAINT pdf_download_events_event_status_check 
CHECK (event_status IN (
  'requested', 
  'access_granted', 
  'denied', 
  'served', 
  'completed_estimated'
));
```

**Safe Because:**
- Uses `IF EXISTS` - won't fail if constraint doesn't exist
- Expands allowed values - doesn't restrict existing data
- All 5 values are legitimate app statuses

---

### SECTION 4: Content Dismissal Functions

#### `get_dismissed_content_ids(p_user_id, p_content_type, p_placement)`
Returns array of content IDs that user has dismissed.

**Used by:** RPC functions to filter out dismissed content.

#### `dismiss_content(p_user_id, p_content_type, p_content_id, p_placement)`
- Inserts into `content_dismissals`
- Also inserts 'dismiss' interaction into `content_interactions`
- Returns true

**Flow:**
```
User clicks dismiss button
  → App calls dismiss_content()
  → Records dismissal
  → Records analytics interaction
  → Content no longer shown to user
```

---

### SECTION 5: Verification Code Functions

**Preserves:** `site_verification_codes` table with admin-managed code injection.

#### `get_verification_code(p_placement)`
Returns the active verification code for a placement (head, footer, body_end).

**Used by:** Frontend to inject Google Search Console, analytics codes, etc.

#### `upsert_verification_code(p_placement, p_code, p_is_enabled, p_notes, p_environment)`
Admin function to set/update verification codes.

**Why This Matters:**
The rejected SQL tried to replace this with a generic `site_verification` table that had nothing to do with code injection. This patch preserves the actual working feature.

---

### SECTION 6: SEO Functions

#### `get_seo_settings()`
Returns sitemap frequency (daily/weekly/monthly).

#### `get_seo_expansion_settings()`
Returns all SEO expansion configuration:
- pattern_pages_enabled
- situation_pages_enabled
- scheduler settings
- activation recommendations
- etc.

#### `get_published_expansion_slugs()`
Returns slugs that should appear in sitemap:
- Only pages where `is_published = true`
- Only if expansion feature is enabled
- Includes `include_in_sitemap` flag

#### `get_sitemap_sync_status_secure()`
Returns comprehensive sync status for admin dashboard:
- Count of published pages
- Count in sitemap vs not in sitemap
- Last scheduler run
- Last rebuild attempt
- Estimated completion times

**Why These Were Missing:**
The rejected SQL had `GRANT EXECUTE` statements for these functions, but the functions were never `CREATE`d! This patch adds the actual function definitions.

---

### SECTION 7: Content Access Functions (RPC-Based)

**Critical Design Decision:**

Table-level policies ONLY check `status = 'published'`. They do NOT filter by:
- `starts_at` / `ends_at` (scheduling)
- `target_audience` (role-based targeting)
- Content dismissals

**Why?** RLS policies can't easily handle complex filtering with good performance.

**Solution:** RPC functions that apps SHOULD use:

#### `get_active_announcements(p_placement, p_user_id, p_user_role)`
Filters by:
1. status = 'published'
2. placement matches
3. starts_at <= now() (or null)
4. ends_at >= now() (or null)
5. target_audience matches user's role
6. Not in user's dismissal list

#### `get_active_trust_snippets(...)`
Same filtering logic for trust snippets.

#### `get_active_content_blocks(...)`
Same filtering logic + group_key support for FAQ sections.

**Honest Security Model:**
- Table policies: Permissive (allow reading published rows)
- RPC functions: Restrictive (proper business logic filtering)
- Recommendation: Apps should use RPCs for public content

---

### SECTION 8: Specific Grants (No Blanket Grants)

**The Rejected SQL Had:**
```sql
-- DANGEROUS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
```

**This Patch Has:**
Specific grants per table:

```sql
-- Example: User profiles
GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- Example: AI usage (users can read their own, service_role manages)
GRANT SELECT ON ai_daily_usage TO authenticated;
GRANT ALL ON ai_daily_usage TO service_role;

-- Example: Content (public read via policies, service_role manages)
GRANT SELECT ON site_announcements TO authenticated, anon;
GRANT ALL ON site_announcements TO service_role;
```

**Why This Matters:**
Even with RLS, blanket grants are dangerous:
- Future tables get unintended permissions
- `SECURITY DEFINER` functions could be exploited
- Violates principle of least privilege

---

### SECTION 9: Schema Reload

```sql
NOTIFY pgrst, 'reload schema';
```

Tells PostgREST (Supabase's API layer) to refresh its schema cache.

**Required when:** Adding new functions or changing function signatures.

---

## Pre-Flight Checklist

### Required Tables Verification

Run this SQL to verify required tables exist:

```sql
-- Check critical tables
SELECT 
  'user_profiles' as table_name, 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') as exists
UNION ALL
SELECT 'user_subscriptions', 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions')
UNION ALL
SELECT 'ai_daily_usage', 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_daily_usage')
UNION ALL
SELECT 'ai_session_tracking', 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_session_tracking')
UNION ALL
SELECT 'pdf_download_events', 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pdf_download_events')
UNION ALL
SELECT 'site_verification_codes', 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_verification_codes')
UNION ALL
SELECT 'seo_expansion_pages', 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seo_expansion_pages');
```

**All should return `exists = true`.**

### Backup Verification

Before running:
1. Go to Supabase Dashboard → Database → Backups
2. Verify recent backup exists
3. Or create manual backup: "Create a backup now"

### Environment Verification

Confirm you're running on the correct project:
- Project URL matches your production project
- Not running on a fresh/empty project (this is a PATCH, not a setup script)

---

## Execution Guide

### Method 1: Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy entire contents of `PATCH_EXISTING_TO_CURRENT_SAFE.sql`
4. Paste into editor
5. Click "Run"
6. Look for success message: `Interview Ready Safe Patch Applied Successfully!`

### Method 2: psql CLI

```bash
# Set your connection string
export SUPABASE_DB_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Run the patch
psql "$SUPABASE_DB_URL" -f PATCH_EXISTING_TO_CURRENT_SAFE.sql
```

### Expected Output

```
NOTICE:  trigger "trigger_user_profiles_updated_at" does not exist, skipping
NOTICE:  trigger "on_auth_user_created_subscription" does not exist, skipping
...
 status
------------------------------------------
 Interview Ready Safe Patch Applied Successfully!
(1 row)
```

NOTICES about non-existent triggers/functions are normal and safe.

---

## Verification Steps

After running the patch, verify each fix:

### 1. Verify Non-Recursive Admin Check

```sql
-- Should return false for regular users
SELECT is_admin(auth.uid());

-- Should return true for admin users
-- (Run as admin to test)
```

### 2. Verify AI Functions Work

```sql
-- Start a session (returns UUID)
SELECT record_ai_session_start(
  auth.uid(), 
  'openai', 
  'gpt-4', 
  'test-topic'
);

-- Check limits
SELECT * FROM check_ai_usage_limits(auth.uid());

-- Should show allowed=true and current counts
```

### 3. Verify PDF Status Constraint

```sql
-- Insert with 'access_granted' status (was failing before)
INSERT INTO pdf_download_events (
  user_id, 
  pdf_filename, 
  event_status
) VALUES (
  auth.uid(), 
  'test-document.pdf', 
  'access_granted'
);

-- Should succeed
```

### 4. Verify Content Functions

```sql
-- Get active announcements for home page
SELECT * FROM get_active_announcements(
  'home.hero',           -- placement
  auth.uid(),            -- user_id (for dismissal filtering)
  'logged_in'            -- user_role
);

-- Should return only published, non-expired, non-dismissed content
```

### 5. Verify Verification Code Functions

```sql
-- Get head verification code
SELECT * FROM get_verification_code('head');

-- Should return row (possibly empty if none enabled)
```

### 6. Verify SEO Functions

```sql
-- Get SEO settings
SELECT * FROM get_seo_settings();

-- Should return: weekly, <timestamp>

-- Get published expansion slugs
SELECT * FROM get_published_expansion_slugs();

-- Should return empty (pages are in draft by default)
```

---

## Rollback Procedures

### If You Need to Revert

**IMPORTANT:** This patch doesn't have a direct "undo" because it's additive. However:

#### Revert RLS Policy Changes

```sql
-- Drop the new policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Superadmin can manage all profiles" ON user_profiles;

-- Recreate original (recursive) policies if needed
-- (But they were broken, so probably not)
```

#### Revert PDF Constraint

```sql
ALTER TABLE pdf_download_events 
DROP CONSTRAINT pdf_download_events_event_status_check;

-- Optional: Go back to old constraint
ALTER TABLE pdf_download_events 
ADD CONSTRAINT pdf_download_events_event_status_check 
CHECK (event_status IN ('requested', 'served', 'completed_estimated'));
```

#### Drop New Functions

```sql
-- Only if absolutely necessary
DROP FUNCTION IF EXISTS record_ai_session_start(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS record_ai_turn(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_or_create_daily_usage(UUID);
-- ... etc
```

### Database Restore (Nuclear Option)

If everything fails:
1. Go to Supabase Dashboard → Database → Backups
2. Find backup from before patch
3. Click "Restore"
4. Confirm (this will overwrite current data)

---

## Troubleshooting

### Error: "relation 'X' does not exist"

**Cause:** Your database is missing tables this patch assumes exist.

**Solution:** 
- Check Pre-Flight Checklist
- If table truly doesn't exist, your schema is different from expected
- DO NOT run this patch - contact developer

### Error: "function X already exists with different argument types"

**Cause:** Function exists but signature differs.

**Solution:**
```sql
-- Drop the conflicting function first
DROP FUNCTION IF EXISTS function_name(arg_types);

-- Then re-run patch
```

### Error: "infinite recursion detected in policy"

**Cause:** Old recursive policies still exist alongside new ones.

**Solution:**
```sql
-- List all policies on user_profiles
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Drop any policies that query user_profiles within their USING clause
```

### Warning: "NOTICE: function X does not exist, skipping"

**This is normal.** The `DROP IF EXISTS` statements produce these notices.

### AI Functions Return Wrong Data

**Check:** Are you using the right AI system?

```sql
-- Check if ai_daily_usage has data
SELECT * FROM ai_daily_usage 
WHERE user_id = auth.uid() 
AND usage_date = CURRENT_DATE;

-- Check if ai_session_tracking has sessions
SELECT * FROM ai_session_tracking 
WHERE user_id = auth.uid()
ORDER BY session_started_at DESC
LIMIT 5;
```

If empty, functions are working but no sessions recorded yet.

---

## Comparison with Rejected SQL

### Issues in Rejected SQL (Why It Was Dangerous)

| Issue | Rejected SQL | Safe Patch |
|-------|--------------|------------|
| **Undefined tables** | Referenced `ai_usage_tiers`, `categories`, `questions` that don't exist | Only uses verified existing tables |
| **Wrong AI system** | Mixed old (`ai_interviews`) with new (`ai_daily_usage`) | Uses only current `ai_daily_usage` system |
| **Wrong verification** | Used `site_verification` instead of `site_verification_codes` | Preserves correct `site_verification_codes` |
| **Blanket grants** | `GRANT ALL ON ALL TABLES` | Specific grants per table |
| **Content policy lie** | Claimed policies fixed scheduling leaks | Honest: policies are loose, RPCs are strict |
| **Schema assumptions** | Assumed fresh install structure | Assumes existing migrations are in place |

### Size Comparison

| File | Rejected | Safe Patch |
|------|----------|------------|
| Lines | ~1,425 | ~580 |
| Size | ~103KB | ~25KB |
| Tables created | 30+ (risk of conflict) | 0 (assumes exist) |
| Functions | Mixed old/new | Current only |

---

## Architecture Decision Records

### ADR 1: RPC Functions vs Strict Table Policies

**Decision:** Use permissive table policies + strict RPC functions for content access.

**Rationale:**
- RLS policies with complex filtering (time ranges, arrays, dismissals) are slow
- RPC functions can optimize queries with proper indexes
- Frontend needs batch fetching anyway (not single-row)

**Trade-off:**
- Table policies alone don't enforce scheduling/audience
- Must document that apps should use RPCs, not direct table access
- Admin dashboards can use direct access (they're admins)

### ADR 2: Keep Both AI Systems

**Decision:** Don't drop `ai_interview_sessions` table, add new `ai_daily_usage` alongside.

**Rationale:**
- `ai_interview_sessions` has detailed per-turn data
- `ai_daily_usage` is for quick limit checks
- Different use cases, can coexist

**Trade-off:**
- Two tables to maintain
- Potential confusion about which to use
- But: no data migration needed

### ADR 3: Specific Grants Over Blanket Grants

**Decision:** List every table grant explicitly.

**Rationale:**
- Security: Principle of least privilege
- Clarity: Exactly what's granted is visible
- Safety: Future tables don't accidentally get permissions

**Trade-off:**
- More verbose
- Must update when adding new tables

### ADR 4: Coalesce in Functions

**Decision:** Use `COALESCE(column, default)` in SELECT functions.

**Rationale:**
- Allows LEFT JOIN pattern for settings tables
- Returns sensible defaults even if row missing
- Apps don't need to handle nulls

**Example:**
```sql
SELECT COALESCE(ses.pattern_pages_enabled, false)
FROM (SELECT 1 as dummy) d
LEFT JOIN seo_expansion_settings ses ON ses.id = 1;
```

---

## Post-Patch Requirements

SQL alone is not enough. After this patch, you still need:

### 1. Edge Functions
Deploy these if not already deployed:
- `stripe-webhook` - Payment processing
- `create-checkout-session` - Stripe checkout
- `check-subscription` - Subscription validation
- `check-ai-limits` - AI usage limits
- `get-signed-pdf-url` - Secure PDF downloads
- `seo-deploy-trigger` - SEO deployment

### 2. Storage
- Create `premium-pdfs` bucket (private)
- Upload PDF files
- Populate `pdf_assets` table with file keys

### 3. Authentication
- Enable Google provider
- Configure OAuth credentials
- Set callback URLs

### 4. Environment Variables
In Supabase Dashboard → Settings → API:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

---

## Final Checklist

Before considering this patch "deployed":

- [ ] Patch SQL reviewed and understood
- [ ] Database backed up
- [ ] Required tables verified to exist
- [ ] Patch executed successfully
- [ ] Verification steps all passed
- [ ] App tested (registration, AI interview, PDF download)
- [ ] Admin functions tested (content management, verification codes)
- [ ] Edge functions deployed (separate from SQL)
- [ ] Storage configured (separate from SQL)
- [ ] Environment variables set (separate from SQL)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-15  
**Status:** Ready for Review
