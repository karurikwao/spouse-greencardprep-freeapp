# InterviewReady Safe Patch Report

**Date:** 2026-03-15  
**File:** `PATCH_EXISTING_TO_CURRENT_SAFE.sql`  
**Size:** ~25KB  
**Status:** Ready for Review

---

## What This Patch Does

This is a **minimal, safe patch** for an existing InterviewReady Supabase project. It fixes specific issues without recreating existing tables or mixing schema versions.

### Fixes Applied

| Issue | Fix |
|-------|-----|
| **Recursive RLS on user_profiles** | Replaced recursive policies with `is_admin()` / `is_superadmin()` helper functions using `SECURITY DEFINER` |
| **Missing AI write functions** | Added `record_ai_session_start()`, `record_ai_turn()`, `check_ai_usage_limits()` for the **current** ai_daily_usage/ai_session_tracking architecture |
| **PDF status constraint** | Updated CHECK constraint to include all 5 statuses: 'requested', 'access_granted', 'denied', 'served', 'completed_estimated' |
| **Missing content functions** | Added `get_dismissed_content_ids()`, `dismiss_content()`, and proper RPC content retrieval functions |
| **Missing verification code functions** | Added `get_verification_code()`, `upsert_verification_code()` for site_verification_codes table |
| **Missing SEO functions** | Added `get_seo_settings()`, `get_seo_expansion_settings()`, `get_published_expansion_slugs()`, `get_sitemap_sync_status_secure()` |
| **Dangerous blanket grants** | Replaced with specific, table-level GRANT statements |

---

## What This Patch Does NOT Do

| Excluded | Reason |
|----------|--------|
| Create `categories` or `questions` tables | These don't exist in current migrations (app uses local/code-based questions) |
| Create `ai_usage` or `ai_usage_tiers` tables | These don't exist; app uses `ai_daily_usage` + `ai_session_tracking` |
| Create `ai_interviews` or `interview_questions` tables | These don't exist; old architecture was replaced |
| Replace `site_verification_codes` with `site_verification` | Keeps the correct table for admin verification code injection |
| Create tables that already exist | Uses `CREATE OR REPLACE FUNCTION` and `IF NOT EXISTS` patterns only |
| Drop any tables or data | Safe for existing data |
| Use blanket grants | Specific grants only |

---

## Schema Architecture Honesty

### AI Tracking System (Current)
The patch correctly uses the **current** architecture:
- `ai_daily_usage` - Daily session/turn counters
- `ai_session_tracking` - Session records with provider/model/topic
- Functions: `record_ai_session_start()`, `record_ai_turn()`, `check_ai_usage_limits()`

NOT the old architecture:
- ~~`ai_interviews`~~ (doesn't exist in current schema)
- ~~`ai_usage`~~ (doesn't exist in current schema)

### Verification Code System
The patch correctly preserves:
- `site_verification_codes` table with placements: head, footer, body_end
- Admin-managed code injection feature

NOT a generic site verification status table.

### Content Access Model
The patch is **honest** about content security:

**Table-level policies** (loose, only check status='published'):
```sql
CREATE POLICY "Public can view published announcements" 
  ON site_announcements FOR SELECT 
  USING (status = 'published');
```

**RPC functions** (proper filtering by scheduling/audience):
```sql
-- These properly filter by starts_at, ends_at, target_audience, dismissals
get_active_announcements(placement, user_id, user_role)
get_active_trust_snippets(placement, user_id, user_role)
get_active_content_blocks(placement, user_id, user_role, group_key)
```

**Recommendation:** Frontend/public reads should use the RPC functions, not direct table access.

---

## Pre-Requisites (Verify Before Running)

This patch assumes your database already has these tables from previous migrations:

### Required Tables (must exist)
- [ ] `user_profiles` (with role, is_active columns)
- [ ] `user_subscriptions` (with plan_type, status, trial_ends_at, etc.)
- [ ] `plan_config` (seeded with plan types)
- [ ] `ai_daily_usage` (id, user_id, usage_date, sessions_count, total_turns)
- [ ] `ai_session_tracking` (id, user_id, session_started_at, turns_count, provider, model, topic_id)
- [ ] `pdf_assets` (id, file_key, title, is_premium, storage_path)
- [ ] `pdf_download_events` (id, user_id, pdf_filename, event_status, created_at)
- [ ] `pdf_download_summaries` (id, user_id, total_downloads, unique_pdfs_downloaded)
- [ ] `site_announcements` (id, title, body, status, placement, target_audience, starts_at, ends_at)
- [ ] `site_trust_snippets` (id, title, subtitle, status, placement, target_audience)
- [ ] `site_content_blocks` (id, title, body, status, placement, target_audience, group_key)
- [ ] `content_dismissals` (id, user_id, content_type, content_id, dismissed_at)
- [ ] `content_interactions` (id, content_type, content_id, interaction_type, user_id, created_at)
- [ ] `site_verification_codes` (id, placement, code, is_enabled, notes, environment)
- [ ] `seo_settings` (id, sitemap_frequency, updated_at)
- [ ] `seo_expansion_settings` (id, pattern_pages_enabled, situation_pages_enabled, etc.)
- [ ] `seo_expansion_pages` (id, slug, page_type, status, is_published, include_in_sitemap)
- [ ] `user_notifications` (id, user_id, type, title, message, is_read)
- [ ] `promo_codes` (id, code, discount_percent, influencer_name, is_active)
- [ ] `referral_events` (id, user_id, promo_code, event_type, created_at)

If any of these tables are missing, this patch may fail.

---

## Safety Checks

| Check | Status |
|-------|--------|
| No `DROP TABLE` statements | ✅ Safe |
| No `DELETE` statements | ✅ Safe |
| Uses `CREATE OR REPLACE FUNCTION` | ✅ Safe for functions |
| Uses `IF NOT EXISTS` for constraints | ✅ Safe |
| Uses `DROP POLICY IF EXISTS` before recreate | ✅ Safe |
| No blanket grants | ✅ Safe |
| No references to non-existent tables | ✅ Verified |
| Matches current app architecture | ✅ Verified |

---

## Manual Setup Still Required

After running this SQL patch, you still need to:

1. **Deploy Edge Functions** (if not already deployed)
   ```bash
   cd app/supabase/functions
   supabase functions deploy
   ```

2. **Create Storage Bucket** (if not exists)
   - Go to Supabase Dashboard → Storage
   - Create `premium-pdfs` bucket (private)
   - Upload PDF files to the bucket

3. **Configure OAuth Providers** (if not done)
   - Enable Google provider in Authentication settings
   - Add OAuth credentials

4. **Set Environment Variables** (in Supabase Dashboard)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `OPENAI_API_KEY`

5. **Seed PDF Assets** (if not done)
   - Populate `pdf_assets` table with file keys matching your uploaded PDFs

---

## Verification Steps After Running

After running the patch, verify:

```sql
-- 1. Check admin functions work
SELECT is_admin(auth.uid());

-- 2. Check AI functions exist
SELECT record_ai_session_start(auth.uid(), 'openai', 'gpt-4', 'test-topic');

-- 3. Check PDF status constraint allows all values
INSERT INTO pdf_download_events (user_id, pdf_filename, event_status)
VALUES (auth.uid(), 'test.pdf', 'access_granted');

-- 4. Check verification code functions
SELECT * FROM get_verification_code('head');

-- 5. Check SEO functions
SELECT * FROM get_seo_settings();
SELECT * FROM get_published_expansion_slugs();
```

---

## Comparison to Rejected SQL

| Issue | Rejected SQL | This Safe Patch |
|-------|--------------|-----------------|
| Referenced undefined tables | ❌ Yes (ai_usage_tiers, categories, questions) | ✅ No - only uses existing tables |
| Mixed AI architectures | ❌ Yes (mixed old/new) | ✅ No - uses current ai_daily_usage/ai_session_tracking only |
| Wrong verification table | ❌ Yes (site_verification) | ✅ No - preserves site_verification_codes |
| Blanket grants | ❌ Yes (GRANT ALL ON ALL TABLES) | ✅ No - specific grants only |
| Overclaimed content policy fix | ❌ Yes (claimed fixed but wasn't) | ✅ Honest - documents RPC-based filtering |
| Safe for existing data | ❌ Risky | ✅ No destructive operations |

---

## Final Recommendation

**This patch is much safer than the previous version**, but you should still:

1. **Back up your database** before running any SQL
2. **Run in a test environment first** if possible
3. **Verify all required tables exist** before running
4. **Review the SQL** one more time to ensure it matches your expectations

**Do not run if:**
- Your database schema differs significantly from the audited migrations
- You are missing key tables listed in Pre-Requisites
- You want a fresh-install master file (this is a patch only)

---

**Status: Ready for your final review before execution.**
