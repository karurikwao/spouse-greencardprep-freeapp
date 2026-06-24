# Supabase SQL Consolidation Report

**Generated:** 2026-03-15  
**For:** InterviewReady Web Application  
**Status:** Current as of all migrations through 2024-03-29

---

## 📋 OVERVIEW

This report documents the consolidated Supabase SQL package created for the InterviewReady application. Two SQL files have been generated:

| File | Purpose | When to Use |
|------|---------|-------------|
| `app/supabase/MASTER_SETUP_CURRENT.sql` | Fresh install | Brand new Supabase projects |
| `app/supabase/PATCH_EXISTING_TO_CURRENT.sql` | Incremental update | Existing projects with data to preserve |

---

## 📁 FILES INCLUDED

### 1. MASTER_SETUP_CURRENT.sql (~104 KB)
A complete SQL file for setting up a brand new Supabase project with all current schema, functions, policies, and seed data.

**Sections:**
1. Extensions and Helpers
2. User Profiles and Admin Roles
3. Subscriptions and Entitlements
4. User Progress Tracking
5. AI Usage Tracking
6. Secure PDF Storage and Download Tracking
7. Content Management System (Announcements, Trust Snippets, Content Blocks)
8. Content Dismissals and Analytics
9. Refund System
10. Notifications and Support Tickets
11. Promo Codes and Referral Tracking
12. SEO Settings and Expansion Publishing
13. Site Verification Codes
14. Stripe Webhook Events
15. Answer Example Candidates
16. Required Seed Data

### 2. PATCH_EXISTING_TO_CURRENT.sql (~74 KB)
A safer SQL file for updating existing Supabase projects. Uses `IF NOT EXISTS` patterns to avoid breaking existing data.

**Key Safety Features:**
- `CREATE TABLE IF NOT EXISTS` - won't overwrite existing tables
- `CREATE INDEX IF NOT EXISTS` - won't recreate existing indexes
- `DROP POLICY IF EXISTS` + `CREATE POLICY` - ensures policy updates work
- `CREATE OR REPLACE FUNCTION` - updates functions without errors
- Preserves all existing data

### 3. SUPABASE_SQL_CONSOLIDATION_REPORT.md (This file)
Human-readable documentation of the SQL package.

---

## 🗄️ DATABASE OBJECTS SUMMARY

### Tables (32 total)

#### Core User & Auth
| Table | Purpose |
|-------|---------|
| `user_profiles` | Extended user data (role, is_active, display_name) |
| `user_subscriptions` | Subscription state (plan_type, status, trial/payment dates) |
| `plan_config` | Server-side plan configuration |
| `user_progress` | Practice progress tracking |

#### AI Usage Tracking
| Table | Purpose |
|-------|---------|
| `ai_interview_sessions` | Legacy AI session tracking |
| `ai_interview_turns` | Legacy AI turn tracking |
| `ai_daily_usage` | New Supabase-backed daily usage limits |
| `ai_session_tracking` | New session tracking |

#### PDF System
| Table | Purpose |
|-------|---------|
| `pdf_assets` | PDF registry (file_key, is_premium, storage_path) |
| `pdf_download_events` | Download tracking for refund review |
| `pdf_download_summaries` | Pre-computed download summaries |

#### Content Management
| Table | Purpose |
|-------|---------|
| `site_announcements` | Admin-controlled announcements |
| `site_trust_snippets` | Trust badges/statements |
| `site_content_blocks` | Rich content blocks (FAQs, etc.) |
| `content_dismissals` | User dismissals (synced) |
| `content_interactions` | Privacy-respectful analytics |

#### Business Logic
| Table | Purpose |
|-------|---------|
| `refund_requests` | Refund request tracking |
| `user_notifications` | User-facing notifications |
| `support_tickets` | Support ticket system |
| `broadcast_messages` | Admin broadcasts |
| `promo_codes` | Influencer promo codes |
| `referral_events` | Referral tracking |

#### SEO System
| Table | Purpose |
|-------|---------|
| `seo_settings` | Basic SEO config (sitemap frequency) |
| `seo_expansion_settings` | Expansion page global settings |
| `seo_expansion_pages` | Individual page publication state |
| `seo_expansion_scheduler_runs` | Scheduler audit log |
| `seo_expansion_rebuild_attempts` | Rebuild trigger tracking |

#### Other
| Table | Purpose |
|-------|---------|
| `site_verification_codes` | Verification code injection (GA, etc.) |
| `stripe_webhook_events` | Idempotency for webhooks |
| `answer_example_candidates` | User answers for admin review |

### Functions (50+ total)

#### Admin/Role Functions
- `is_admin(p_user_id)` - Check if user is admin/superadmin
- `is_superadmin(p_user_id)` - Check if user is superadmin
- `soft_delete_user(p_user_id)` - Soft delete user account

#### Subscription/Entitlement Functions
- `get_effective_subscription(p_user_id)` - Get subscription with computed status
- `has_premium_access(p_user_id)` - Check premium access
- `create_or_update_subscription(...)` - Upsert subscription

#### AI Usage Functions
- `get_or_create_daily_usage(p_user_id)` - Get/create today's usage record
- `check_ai_usage_limits(p_user_id)` - Authoritative limit checking
- `get_user_ai_usage_summary(p_user_id)` - Usage summary for admin

#### PDF Functions
- `get_pdf_download_url(p_user_id, file_key)` - Check access for signed URL
- `record_pdf_download(...)` - Track download event
- `get_user_download_summary(p_user_id)` - Get download summary
- `update_pdf_download_summary(p_user_id)` - Update summary

#### Content Functions
- `get_active_announcements(placement, user_id, user_role)` - Get announcements with dismissal support
- `get_active_trust_snippets(placement, user_id, user_role)` - Get snippets with dismissal support
- `get_active_content_blocks(placement, user_id, user_role, group_key)` - Get blocks with dismissal support
- `dismiss_content(user_id, content_type, content_id, placement)` - Record dismissal
- `get_dismissed_content_ids(user_id, content_type, placement)` - Get dismissed IDs
- `record_content_interaction(...)` - Track content interaction
- `get_content_analytics(content_type, content_id)` - Get analytics for content
- `get_placement_analytics(placement)` - Get placement analytics

#### Notification Functions
- `create_user_notification(...)` - Create notification
- `mark_notification_read(notification_id)` - Mark as read
- `get_unread_notification_count()` - Get unread count
- `get_open_tickets_for_admin()` - Get open tickets

#### Refund Functions
- `get_refund_request_with_download_summary()` - Refund + download evidence
- `get_pending_refund_requests()` - Get pending refunds

#### Promo Code Functions
- `validate_promo_code(code)` - Validate promo code
- `record_referral_event(...)` - Record referral
- `apply_promo_code_discount(code, original_price)` - Calculate discount

#### SEO Functions
- `get_seo_settings()` - Get SEO config
- `get_seo_expansion_settings()` - Get expansion settings
- `get_published_expansion_slugs()` - Get published slugs for sitemap
- `get_sitemap_sync_status_secure()` - Get honest sync status
- `update_seo_expansion_page_status(...)` - Update page status
- `record_scheduler_run(...)` - Log scheduler run
- `record_rebuild_attempt(...)` - Log rebuild attempt

#### Verification Functions
- `get_verification_code(placement, environment)` - Get verification code
- `upsert_verification_code(...)` - Update verification code

### Views
- `user_profiles_with_admin_check` - User profiles with admin flags

### Triggers
- `on_auth_user_created_profile` - Auto-create profile on signup
- `on_auth_user_email_changed` - Sync email changes
- `trigger_user_profiles_updated_at` - Auto-update timestamp
- `trg_update_pdf_summary` - Auto-update download summaries
- Various `*_updated_at` triggers for content tables

---

## 🔐 ROLE MODEL

### User Roles (in user_profiles.role)
- `user` - Regular user (default)
- `admin` - Admin user (can manage content, view analytics)
- `superadmin` - Full access (can manage users, everything)

### RLS Policy Patterns
All tables use Row Level Security with these patterns:

| Pattern | Description |
|---------|-------------|
| Users can view own | Standard user self-access |
| Admins can view all | Admin dashboard access via `is_admin()` check |
| Service role full access | Edge functions/service role bypass |
| Public read | For published content (announcements, etc.) |

---

## 🌱 SEED DATA INCLUDED

### Always Included
- **Plan Config**: trial, monthly, lifetime, interviewPass plan definitions
- **Default Trust Snippets**: 5 trust badges (Secure Login, Progress Sync, PDF Access, etc.)
- **SEO Expansion Pages**: 16 SEO pages (pattern + situation types) in draft status
- **Site Verification Codes**: 3 empty placeholders (head, footer, body_end)
- **SEO Settings**: Default weekly sitemap frequency

### Optional (Requires Manual Action)
- **PDF Assets**: Not auto-inserted - use `pdf_assets_seed.sql` after uploading PDFs to storage
- **Promo Codes**: Not included - add manually via admin or SQL
- **Custom Content**: Announcements, content blocks, etc. - add via admin UI

---

## ⚠️ NON-SQL SETUP REQUIRED

After running the SQL, you STILL need to:

### 1. Storage Setup
- Create the `premium-pdfs` bucket in Supabase Storage
- Set bucket to **Private** (not public)
- Upload your PDF files to the bucket
- Run `pdf_assets_seed.sql` to register the PDFs

### 2. Edge Functions
Deploy these Supabase Edge Functions:
- `generate-pdf-signed-url` - Secure PDF delivery
- (Any other custom Edge Functions your app uses)

### 3. Auth Configuration
- Configure OAuth providers (Google, etc.) in Supabase Auth settings
- Set up email templates if using email auth

### 4. Environment Variables
Set these in your hosting platform (Coolify/Vercel/Netlify):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `COOLIFY_WEBHOOK_URL` (if using Coolify deploy hooks)
- AI provider API keys (OpenAI, etc.)

### 5. Stripe Configuration
- Set up Stripe webhook endpoint pointing to your Edge Function
- Configure webhook events: `checkout.session.completed`, `invoice.payment_succeeded`, etc.

---

## 🚀 HOW TO USE

### For a New Project (Fresh Install)

1. Create a new Supabase project
2. Go to SQL Editor
3. Copy/paste contents of `MASTER_SETUP_CURRENT.sql`
4. Run the SQL
5. Complete the Non-SQL Setup steps above
6. Deploy your app

### For an Existing Project (Patch)

1. **BACKUP YOUR DATABASE** (just in case)
2. Go to SQL Editor in Supabase Dashboard
3. Copy/paste contents of `PATCH_EXISTING_TO_CURRENT.sql`
4. Run the SQL
5. Check for any error messages
6. Test your app thoroughly

---

## 🔍 WHAT WAS RECONCILED

### Migrations Consolidated (21 total)
- `20240310_ai_usage_tracking.sql`
- `20240311_create_user_progress.sql`
- `20240311_subscription_state.sql`
- `20240312_fix_topic_progress_default.sql`
- `20240312_stripe_webhook_events.sql`
- `20240315_promo_codes.sql`
- `20240316_promo_codes_indexes.sql`
- `20240317_seo_settings.sql`
- `20240318_refund_system.sql`
- `20240319_notifications_system.sql`
- `20240320_answer_example_candidates.sql`
- `20240321_seo_expansion_publishing.sql`
- `20240322_seo_expansion_deploy_hooks.sql`
- `20240322_seo_expansion_rebuild_tracking.sql`
- `20240323_pdf_download_tracking.sql`
- `20240324_ai_usage_tracking_supabase.sql`
- `20240325_secure_pdf_storage.sql`
- `20240326_user_profiles_and_admin_roles.sql`
- `20240327_site_content_management.sql`
- `20240328_content_dismissals_and_analytics.sql` (FIXED - was incomplete)
- `20240329_site_verification_codes.sql`

### Key Fixes Applied
1. **Content Dismissals Migration** - The original `20240328_content_dismissals_and_analytics.sql` was incomplete. The consolidated SQL includes the complete version with:
   - `get_active_trust_snippets()` with dismissal support
   - `get_active_content_blocks()` with dismissal support
   - Proper grants for all functions

2. **Verification Code RLS** - Uses correct `user_profiles.user_id` reference (not auth.users.id) in admin checks

3. **Admin Role Logic** - All admin checks use the `is_admin()` function which queries `user_profiles` table

---

## ⚠️ RISKS AND LIMITATIONS

### Risks of Fresh Install
- **Data Loss**: Only use on NEW projects - will not preserve existing data
- **Storage**: PDFs must be uploaded separately after SQL runs
- **Build Required**: App may fail until all pieces are in place

### Risks of Patch
- **Policy Conflicts**: If you had custom RLS policies, they may be overwritten
- **Function Changes**: Functions are replaced with new versions
- **Seed Data**: Trust snippets only added if table is empty

### What Still Requires Manual Testing
- End-to-end PDF download flow
- AI usage limit enforcement
- Content dismissal sync
- Refund review dashboard
- SEO expansion page publishing
- Webhook handling

---

## 📞 TROUBLESHOOTING

### "relation already exists" errors
These are warnings, not errors. The patch uses `IF NOT EXISTS` but some statements may still warn.

### Policy conflicts
If you get policy errors, manually drop the conflicting policies first:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

### Missing functions
Ensure you're using the correct file:
- Fresh project? Use `MASTER_SETUP_CURRENT.sql`
- Existing project? Use `PATCH_EXISTING_TO_CURRENT.sql`

### Storage not working
The SQL creates the storage bucket reference, but you must:
1. Create the bucket in Supabase Dashboard
2. Upload the actual PDF files
3. Run the PDF assets seed

---

## ✅ VERIFICATION CHECKLIST

After running the SQL, verify:

- [ ] All tables exist in Table Editor
- [ ] RLS is enabled on tables
- [ ] Functions appear in Database > Functions
- [ ] Triggers appear in Database > Triggers
- [ ] `is_admin()` function returns correct values
- [ ] Trust snippets show in table (if seed ran)
- [ ] Plan config has 4 rows
- [ ] Storage bucket `premium-pdfs` exists (if created)

---

## 📝 NOTES FOR NON-CODERS

### What is Supabase SQL?
Think of it as instructions that tell the database:
- What tables to create (like Excel sheets)
- What functions to add (like formulas)
- Who can access what (security rules)

### Can I break something?
- **Fresh Install**: No, it's a new project
- **Patch**: Low risk, but backup first if you have important data

### What if something goes wrong?
- Check the error message in SQL Editor
- Most errors are about things already existing (harmless)
- If app stops working, check the environment variables

### Do I need to run this again?
- No, only run once per project
- If you add new features later, you may need a new patch

---

## 🎯 SUMMARY

| Question | Answer |
|----------|--------|
| Fresh install SQL complete? | ✅ Yes - 104KB, all 21 migrations consolidated |
| Patch SQL complete? | ✅ Yes - 74KB, safe patterns for existing data |
| Reflects current app state? | ✅ Yes - audited all migrations |
| Content dismissals fixed? | ✅ Yes - complete version included |
| Verification codes fixed? | ✅ Yes - correct RLS policies |
| Ready for non-coder use? | ✅ Yes - this report explains everything |

---

**End of Report**
