# Supabase SQL Consolidation Report

**Date:** 2026-03-15  
**Status:** ✅ CORRECTED AND COMPLETE  
**Project:** Interview Ready - Marriage Green Card

## 📦 Files Delivered

| File | Purpose | Size | Status |
|------|---------|------|--------|
| `MASTER_SETUP_CURRENT.sql` | Fresh install for new projects | ~103KB | ✅ Corrected |
| `PATCH_EXISTING_TO_CURRENT.sql` | Safe patch for existing projects | ~18KB | ✅ Corrected |

---

## 🚨 CRITICAL CORRECTIONS MADE (Post-Initial Draft)

Based on code audit of all 21 migration files and TypeScript sources, these issues were identified and **FIXED**:

### 1. **PATCH SQL Missing Function Definitions** ✅ FIXED

**Problem:** `PATCH_EXISTING_TO_CURRENT.sql` contained `GRANT EXECUTE` statements for functions that were never `CREATE`d:
- `get_seo_expansion_settings()`
- `get_published_expansion_slugs()`
- `get_sitemap_sync_status_secure()`

**Fix:** Added complete `CREATE OR REPLACE FUNCTION` definitions for all three functions before the GRANT statements.

### 2. **Recursive RLS on user_profiles** ✅ FIXED

**Problem:** Admin policies on `user_profiles` queried `user_profiles` directly, causing infinite recursion:
```sql
-- WRONG (recursive)
CREATE POLICY "Admins can view all" ON user_profiles
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE ...))  -- Queries itself!
```

**Fix:** Created `is_admin()` and `is_superadmin()` helper functions with `SECURITY DEFINER`, then used them:
```sql
-- CORRECT (non-recursive)
CREATE FUNCTION is_admin(p_user_id UUID) RETURNS BOOLEAN
  SECURITY DEFINER ...  -- Bypasses RLS

CREATE POLICY "Admins can view all" ON user_profiles
  USING (is_admin(auth.uid()));  -- Uses helper, no recursion
```

### 3. **Missing AI Usage Write Functions** ✅ FIXED

**Problem:** App code (`src/lib/entitlements/api.ts`) calls these RPCs, but they were missing from SQL:
- `record_ai_session_start(p_user_id, provider, model, topic_id)`
- `record_ai_turn(p_user_id, session_id, turn_count)`

**Fix:** Added complete implementations for both functions that:
- Create AI interview session records
- Update monthly usage counts
- Respect tier limits

### 4. **PDF Download Status Values Out of Sync** ✅ FIXED

**Problem:** TypeScript type (`src/lib/downloads/types.ts`) defines:
```typescript
type DownloadEventStatus = 'requested' | 'access_granted' | 'denied' | 'served' | 'completed_estimated';
```

But SQL only had:
```sql
CHECK (event_status IN ('requested', 'served', 'completed_estimated'))
```

**Fix:** Updated CHECK constraint to include all 5 statuses.

### 5. **Content Public Policies Too Broad** ✅ FIXED

**Problem:** Public content policies only checked `status='published'` but ignored:
- `starts_at` / `ends_at` (scheduled content)
- `target_audience` (role-restricted content)

**Fix:** Updated policies to require:
```sql
status = 'published'
AND (starts_at IS NULL OR starts_at <= now())
AND (ends_at IS NULL OR ends_at > now())
AND (target_audience IS NULL OR is_admin())
```

### 6. **Promo Code Admin Access** ✅ FIXED

**Problem:** Used `service_role` instead of `is_admin()` for admin management functions.

**Fix:** Policies now use `is_admin()` for dashboard access, while keeping `service_role` for Edge Functions.

---

## 📊 Schema Coverage

### Tables (25 total)
- ✅ `categories`
- ✅ `questions`
- ✅ `user_profiles`
- ✅ `user_subscriptions`
- ✅ `user_answers`
- ✅ `ai_usage`
- ✅ `ai_usage_tiers`
- ✅ `ai_interviews`
- ✅ `ai_interview_questions`
- ✅ `ai_usage_limits`
- ✅ `pdfs`
- ✅ `pdf_topics`
- ✅ `pdf_topic_assignments`
- ✅ `pdf_download_events`
- ✅ `pdf_download_summaries`
- ✅ `content_blocks`
- ✅ `content_dismissals`
- ✅ `content_interactions`
- ✅ `user_notifications`
- ✅ `broadcast_messages`
- ✅ `support_tickets`
- ✅ `refund_requests`
- ✅ `promo_codes`
- ✅ `referral_events`
- ✅ `seo_settings`, `seo_expansion_settings`, `seo_expansion_pages`, `seo_expansion_scheduler_runs`, `seo_expansion_rebuild_attempts`
- ✅ `site_verification`
- ✅ `stripe_webhook_logs`
- ✅ `answer_candidates`

### Functions (40+ total)
All required functions are implemented:
- Admin helpers: `is_admin()`, `is_superadmin()`
- Subscription: `get_effective_subscription()`, `check_ai_usage_limits()`
- AI: `record_ai_session_start()`, `record_ai_turn()`
- Content: `get_dismissed_content_ids()`, `dismiss_content()`
- Notifications: `create_user_notification()`, `publish_broadcast()`, `create_support_ticket()`, `reply_to_support_ticket()`
- Promo: `validate_promo_code()`, `record_referral_event()`
- SEO: `get_seo_settings()`, `get_seo_expansion_settings()`, `get_published_expansion_slugs()`, `get_sitemap_sync_status_secure()`
- Site: `get_site_verification()`, `update_site_verification_status()`

---

## ⚠️ IMPORTANT: Post-SQL Setup Required

**These SQL files ONLY set up the database schema.** After running SQL, you STILL need to:

### 1. Deploy Edge Functions
```bash
cd app/supabase/functions
supabase functions deploy <function-name>
```

### 2. Create Storage Buckets
- Go to Supabase Dashboard → Storage
- Create `pdfs` bucket (private)
- Upload your PDF files

### 3. Configure OAuth
- Go to Supabase Dashboard → Authentication → Providers
- Enable Google provider
- Add your OAuth credentials

### 4. Set Environment Variables
In Supabase Dashboard → Settings → API:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

---

## 🔒 Security Notes

1. **RLS is enabled** on all tables
2. **Policies use `is_admin()` helper** to avoid recursion
3. **Service role** is used only for Edge Function access
4. **Anon access** is limited to read-only public content
5. **Authenticated users** can only access their own data

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] `MASTER_SETUP_CURRENT.sql` runs without errors on fresh project
- [ ] `PATCH_EXISTING_TO_CURRENT.sql` runs without errors on existing project
- [ ] TypeScript build passes: `npm run build`
- [ ] No SQL errors in Supabase Dashboard logs
- [ ] Test user registration works
- [ ] Test AI interview flow works (calls `record_ai_session_start`, `record_ai_turn`)
- [ ] Test PDF download tracking works (records 'access_granted' status)

---

## 📁 File Locations

```
app/supabase/
├── MASTER_SETUP_CURRENT.sql          # Fresh install (use this for new projects)
├── PATCH_EXISTING_TO_CURRENT.sql     # Safe patch (use this for existing projects)
└── SUPABASE_SQL_CONSOLIDATION_REPORT.md  # This document
```

---

## 📝 Change Log

| Date | Change |
|------|--------|
| 2026-03-15 | Initial consolidation created |
| 2026-03-15 | **CORRECTED**: Added missing AI functions, fixed recursive RLS, added missing SEO function definitions, fixed PDF status values, tightened content policies |

---

**Ready for deployment after verification.**
