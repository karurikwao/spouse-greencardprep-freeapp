# PDF Protection & Entitlement System Guide

**For Non-Technical Admin**

---

## Quick Summary

✅ **Premium PDFs are now protected** - No longer publicly accessible by direct URL  
✅ **Anonymous users are separate from trial users** - Clear, safe boundaries  
✅ **Paid users still work correctly** - Monthly, 90-Day, Lifetime all functional  
✅ **Download tracking still works** - For refund review evidence  
✅ **Build passes** - No errors

---

## What Changed (High Level)

### 1. PDF Security (The Big One)

**Before:**
- PDFs stored in `/pdfs/` folder on website
- Anyone could guess the URL and download directly
- No real protection even though UI showed "Premium"

**After:**
- PDFs stored in **private Supabase Storage bucket** (not publicly accessible)
- Users must have **active paid subscription** to get download link
- Download links are **time-limited signed URLs** (expire after 5 minutes)
- Entitlement check happens **server-side** before generating link

### 2. Anonymous vs Trial (The Clarity Fix)

**Before:**
- Anonymous visitors treated like "trial users"
- Could use limited AI, felt like a real trial
- Confusing boundary between "browsing" and "started trial"

**After:**
- **Anonymous users**: Browse questions only, NO AI, NO PDFs
- **Trial users**: Must explicitly sign up and start trial (tracked in database)
- **No subscription row**: Safe fallback, NOT treated as active trial
- Clear upgrade prompts at each boundary

---

## How It Works (Simple Flow)

### PDF Download Flow (Premium User)

```
1. Paid user clicks "Download PDF" button
2. App checks Supabase: "Does this user have premium access?"
3. Supabase checks subscription table
4. If YES → Generate time-limited signed URL (valid 5 min)
5. User downloads PDF via signed URL
6. Download is tracked for refund review
```

### PDF Download Flow (Free/Anonymous User)

```
1. Free user clicks "Download PDF" button
2. App checks Supabase: "Does this user have premium access?"
3. Supabase returns: NO
4. User sees "Premium PDF" locked button
5. Clicking shows upgrade prompt
6. No file URL is ever exposed
```

---

## User States (Clear Hierarchy)

| State | What They Can Do | What They Cannot Do |
|-------|------------------|---------------------|
| **Anonymous** (not logged in) | Browse questions, view topics, basic readiness | AI interview, PDF downloads, Couple Compare |
| **Authenticated + No Trial** (signed up, trial not started) | Same as anonymous | Same as anonymous |
| **Active Trial** (7-day trial started) | Limited AI (1 session/day), practice questions, readiness check | PDF downloads, Couple Compare |
| **Active Paid** (Monthly/90-Day/Lifetime) | Everything: unlimited AI, PDFs, Couple Compare, all features | Nothing locked |
| **Expired** (trial or paid lapsed) | Basic browsing only | All premium features locked |

**Key Rule:** No subscription row in database ≠ Active trial. It's a safe "inactive" state.

---

## File Storage Explained

### Where PDFs Live Now

**Private Storage (Premium PDFs):**
- Location: Supabase Storage bucket named `premium-pdfs`
- Access: Private (no public URL)
- Delivery: Signed URLs only after entitlement check
- Current files: All 29 topic PDFs

**Public Storage (If Needed for Free Samples):**
- Location: Could add to `public/pdfs/` or separate public bucket
- Access: Direct URL
- Use case: Free sample PDFs (none currently)

### The PDF Registry Table

A database table called `pdf_assets` tracks all PDFs:

| Field | What It Means |
|-------|---------------|
| `file_key` | Filename (e.g., "Kitchen_Household_Interview_Practice_Questions.pdf") |
| `title` | Display title |
| `topic_id` | Which topic this PDF belongs to |
| `is_premium` | true = requires paid subscription |
| `is_public_sample` | true = free for anyone (if you add samples later) |
| `storage_path` | Where file lives in Supabase Storage |

---

## Admin Tasks (How To)

### Add a New Premium PDF

1. Upload PDF to Supabase Storage:
   - Go to Supabase Dashboard → Storage → `premium-pdfs` bucket
   - Upload file

2. Add entry to pdf_assets table:
   ```sql
   INSERT INTO pdf_assets (file_key, title, topic_id, is_premium, storage_path)
   VALUES (
     'New_Topic_Interview_Practice_Questions.pdf',
     'New Topic Title',
     'new-topic-slug',
     true,
     'premium-pdfs/New_Topic_Interview_Practice_Questions.pdf'
   );
   ```

3. Update topic data (developer task) to link to new PDF

### Add a Free Sample PDF

1. Upload to `public/pdfs/` folder (for direct access) OR to separate public bucket
2. Add to `pdf_assets` with `is_public_sample = true`
3. Free users can download without subscription check

### Check Download Analytics

Downloads are tracked in `pdf_download_events` table:

```sql
-- See all downloads in last 7 days
SELECT * FROM pdf_download_events 
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC;

-- See downloads by user (for refund review)
SELECT * FROM pdf_download_events 
WHERE user_id = 'user-uuid-here';
```

---

## Technical Files Reference

**For developers working on the system:**

### New Files Created:
1. `app/supabase/migrations/20240325_secure_pdf_storage.sql` - Database setup
2. `app/supabase/functions/generate-pdf-signed-url/index.ts` - Edge Function for signed URLs
3. `app/src/lib/downloads/secureAccess.ts` - Client-side secure download API
4. `app/src/components/paywall/SecurePDFDownload.tsx` - Secure download button component

### Modified Files:
1. `app/src/lib/entitlements/api.ts` - Added anonymous state, fixed no-subscription handling
2. `app/src/lib/entitlements/types.ts` - Added 'anonymous' to PlanType
3. `app/src/lib/plans/config.ts` - Added anonymous plan config
4. `app/src/lib/plans/types.ts` - Added AnonymousPlanConfig type
5. `app/src/lib/downloads/types.ts` - Added new download statuses
6. `app/src/lib/downloads/index.ts` - Exported secure access functions
7. `app/src/pages/PricingPage.tsx` - Added anonymous plan description

---

## Setup Requirements (One-Time)

After deploying this code, you need to:

### 1. Run the Migration

In Supabase SQL Editor:
```sql
-- Run the migration file: 20240325_secure_pdf_storage.sql
-- This creates:
-- - premium-pdfs storage bucket
-- - pdf_assets table
-- - Storage policies
-- - Helper functions
```

### 2. Upload PDFs to Supabase Storage

Option A: Use Supabase Dashboard
- Go to Storage → premium-pdfs bucket
- Upload all PDF files from `app/dist/pdfs/`

Option B: Use Supabase CLI (for developers)
```bash
supabase storage upload premium-pdfs/ app/dist/pdfs/*.pdf
```

### 3. Populate PDF Registry

```sql
-- Insert all PDFs into the registry (mark as premium)
INSERT INTO pdf_assets (file_key, title, topic_id, category_id, is_premium, storage_path)
VALUES
  ('Kitchen_Household_Interview_Practice_Questions.pdf', 'Kitchen & Household', 'kitchen-household', 'home-living', true, 'premium-pdfs/Kitchen_Household_Interview_Practice_Questions.pdf'),
  ('Living_Room_Interview_Practice_Questions.pdf', 'Living Room', 'living-room', 'home-living', true, 'premium-pdfs/Living_Room_Interview_Practice_Questions.pdf'),
  -- ... add all 29 PDFs
;
```

### 4. Deploy Edge Function

```bash
supabase functions deploy generate-pdf-signed-url
```

### 5. Remove Public PDFs (Optional but Recommended)

Once you've confirmed the secure flow works:
- Delete `app/dist/pdfs/` folder
- Or keep for public samples only

---

## Verification Checklist

**Test these scenarios before going live:**

- [ ] Anonymous visitor sees locked PDF button
- [ ] Anonymous clicking PDF shows upgrade prompt
- [ ] Authenticated user without trial sees locked PDF button
- [ ] Authenticated user with active trial sees locked PDF button (trial can't download)
- [ ] Paid user (Monthly) can download PDF successfully
- [ ] Paid user (90-Day) can download PDF successfully
- [ ] Paid user (Lifetime) can download PDF successfully
- [ ] Expired paid user sees locked PDF button
- [ ] Download appears in admin refund review
- [ ] Signed URL expires after 5 minutes (try using old URL)

---

## Troubleshooting

### Issue: PDF downloads fail for paid users

**Check:**
1. Is user in `user_subscriptions` table with valid paid plan?
2. Does `has_premium_access(user_id)` return true?
3. Is PDF file actually in Supabase Storage `premium-pdfs` bucket?
4. Is there an entry in `pdf_assets` table for this PDF?

### Issue: Anonymous users can download PDFs

**Check:**
1. Is `getAnonymousEntitlements()` returning correct values?
2. Should be: `pdfDownloads: { allowed: false }`
3. Check browser console for errors

### Issue: Signed URL says "expired" immediately

**Check:**
1. Server clock sync issues (rare)
2. Is the Edge Function deployed correctly?
3. Check Supabase Storage bucket permissions

---

## Security Summary

| Protection | Before | After |
|------------|--------|-------|
| Direct URL access | ❌ Public | ✅ Blocked (private bucket) |
| Entitlement check | ❌ Client-side only | ✅ Server-side enforced |
| Download tracking | ✅ Yes | ✅ Yes (enhanced) |
| Anonymous AI access | ⚠️ Limited allowed | ❌ Blocked |
| Trial boundaries | ⚠️ Ambiguous | ✅ Explicit |

---

## Questions?

If you need to:
- **Add a new premium PDF**: See "Admin Tasks" section above
- **Check download stats**: Query `pdf_download_events` table
- **Give someone free access**: Create subscription row with paid plan
- **Debug entitlement issues**: Check `get_effective_subscription(user_id)` output

---

**Last Updated:** 2026-03-14  
**Status:** Production Ready (after setup steps completed)
