# Handoff For Next Chat: Spouse GreencardPrep Free App

Date: 2026-06-25  
Primary repo: `C:\Users\lnw73\Documents\FREE APPS TO GO\Spouse_GreencardPrep_FreeApp`  
GitHub repo: `https://github.com/karurikwao/spouse-greencardprep-freeapp`  
Live app: `https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io/`  
Coolify project: `Spouse GreencardPrep FreeApp Clean`  
Current deployed commit: `71a58f6a34286617acd78ef4e895271dcfa2ebe7` (`Update Google OAuth client for free app`)

## Read This First

This handoff exists because the previous chat became long enough that the in-app browser, preview window, and clipboard started behaving oddly. Start a fresh same-project chat from this file and use subagents early for both implementation and verification.

Do not harden existing user-facing features yet. First finish the remaining conversion, security, and bundle cleanup gates below. The app should remain free and ad-supported. Optional monetization surfaces must stay hidden by default unless explicitly enabled in Admin.

## Current Verified State

- Clean free-app repo exists and deploys from `karurikwao/spouse-greencardprep-freeapp`.
- Coolify deployment is live on HTTPS at `https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io/`.
- HTTP now redirects to HTTPS.
- Google OAuth was moved to a new Google Cloud project/client:
  - Project ID: `spouse-interview-freeapp-oauth`
  - Client ID: `525916855163-4qt3urorpvh8lrs6rqidcscngcmn999d.apps.googleusercontent.com`
  - Authorized JavaScript origin: `https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io`
  - Test user added: `luewaweru@gmail.com`
- User confirmed Google signup worked perfectly after deployment.
- Coolify env was updated:
  - `FRONTEND_URL=https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io`
  - `GOOGLE_CLIENT_ID=525916855163-4qt3urorpvh8lrs6rqidcscngcmn999d.apps.googleusercontent.com`
  - `VITE_GOOGLE_CLIENT_ID=525916855163-4qt3urorpvh8lrs6rqidcscngcmn999d.apps.googleusercontent.com`
- Verification passed in the prior chat:
  - `py -3 -m compileall server`
  - `npm.cmd run lint` with warnings only
  - `npm.cmd run build`
  - HTTPS `/api/health` returns 200
  - deployed JS contains the new Google client ID and not the old one
  - routes checked over HTTPS included `/`, `/dashboard`, `/pdf-library`, `/privacy`, `/contact`, `/marriage-interview-questions`, `/mock-interview`, `/reset-password`

## Completed In Prior Work

- PDF download failure UX:
  - `app/src/components/paywall/SecurePDFDownload.tsx`
  - Shows visible signed-URL errors.
  - Opens `AuthModal` if backend returns `requiresSignIn`.
  - Handles button/link/icon variants.
- AI interview dictation:
  - `app/src/hooks/useSpeechDictation.ts`
  - `app/src/components/ai/AIInterviewPage.tsx`
  - Robin dictation also exists in `app/src/components/dashboard/VirtualAgentPanel.tsx`.
- Admin-configurable pre-download PDF offer:
  - Admin UI around Ads tab in `app/src/components/admin/SuperAdminPortal.tsx`.
  - Backend endpoints in `server/routes/api_routes.py`:
    - `/admin/pdf-download-offer`
    - `/pdf-download-offer/public`
  - Normalization in `server/admin_settings.py`.
  - `SecurePDFDownload` shows the sponsored dialog and lets users continue.
- Native analytics for the PDF pre-download sponsored offer were implemented in prior continuation work and need regression verification when touching related files.
- OAuth and HTTPS deployment are now complete.

## Do Before Hardening Existing Features

### 1. P0: Tighten Generic Table API Safety

Goal: prevent caller-controlled SQL identifiers, prevent unsafe generic writes, and block unauthenticated/user-crossing access to user-scoped tables.

Primary file:

- `server/routes/api_routes.py`

Key anchors from subagent read-only audit:

- Generic table API starts around `server/routes/api_routes.py:812`.
- Table allowlists and write controls are around `server/routes/api_routes.py:980`.
- Generic write/update behavior is around `server/routes/api_routes.py:1061`.
- The current generic write list appears to allow authenticated users to update `user_subscriptions`; with `eq=user_id`, this looks like a direct self-plan/status mutation path. Treat this as P0 before hardening user-facing features.
- The same generic write lists still include retired `support_tickets` and `refund_requests`.

Known problem:

- Table names are whitelisted, but caller-controlled fields can still be interpolated into SQL:
  - `select`
  - `eq` and filter columns
  - filters JSON columns
  - order columns
  - insert/update keys
  - `onConflict`
- Add per-table column allowlists or a conservative identifier validator plus allowed columns.
- Remove dangerous generic write access for sensitive tables.
- Ensure unauthenticated `GET` cannot read user-scoped tables.
- Tables that should require auth and scope non-admins to their own `user_id` where applicable include:
  - `user_profiles`
  - `user_subscriptions`
  - `user_progress`
  - `question_states`
  - `user_preferences`
  - any other user-owned tables discovered in the allowlist.
- Keep public/admin settings reads working where intended.

Verification targets:

- unauthenticated `GET /api/table/user_profiles` should return 401/403.
- authenticated non-admin must not be able to `PATCH /api/table/user_subscriptions`.
- non-admin user-scoped reads should only return that user's rows.
- public config tables still work where intended, for example public offer/ad settings endpoints.
- malicious-looking column/order/select inputs should be rejected, not interpolated.

Suggested subagent split:

- Subagent A: identify table allowlist and user-scoped tables.
- Subagent B: implement validator/column allowlists and remove unsafe writes.
- Subagent C: write/verify focused tests or route smoke scripts.

### 2. P0/P1: Clean Or Quarantine Remaining Paid-App Leftovers

Goal: make the active app clearly free/ad-supported, with Robin credit purchase support preserved if still intended.

Known remaining areas:

- `server/routes/stripe_routes.py`
  - Some behavior-retired routes return `FREE_APP_PAYMENT_RETIRED`, but old paid-plan bodies may remain below returns.
  - Webhook still handles legacy subscription/invoice events and may update `user_subscriptions`.
  - Keep Robin credit purchase support if active, but quarantine/remove legacy monthly/lifetime/interview-pass branches from active behavior.
  - Retired workflow response starts around `server/routes/stripe_routes.py:350`.
  - Legacy bodies remain after early returns around `server/routes/stripe_routes.py:362`.
  - Optional Robin checkout path starts around `server/routes/stripe_routes.py:523`.
  - Webhook handling is around `server/routes/stripe_routes.py:1145`.
- `server/routes/api_routes.py`
  - Support/refund routes return 410 in places, but old bodies may remain below returns.
  - Clean or quarantine dead paid support/refund code.
  - Retired workflow response starts around `server/routes/api_routes.py:198`.
  - Legacy bodies remain after early returns around `server/routes/api_routes.py:3514`.
- `server/support_service.py`
  - File already describes legacy paid-app support compatibility, but still contains refund, billing, ticket, subscription, and retention context logic.
  - Either remove from active imports/use or move to clearly named legacy/quarantine module.
- SQL setup files:
  - `app/supabase/MASTER_SETUP_CURRENT.sql`
  - `MASTER_SETUP_CURRENT_FINAL_v4.sql`
  - `MASTER_SETUP_POSTGRES_v5.sql`
  - These still include `user_subscriptions`, `refund_requests`, `support_tickets`, Stripe webhook structures, refund review functions, support ticket functions, and policies.
  - Move old paid/refund/support setup into a clearly marked legacy SQL file or comment it out of current free-app setup.
  - `MASTER_SETUP_CURRENT_FINAL_v4.sql` still has paid/trial/subscription setup around line `209`.
  - `app/supabase/migrations/20240318_refund_system.sql` still has refund setup around line `11`.
- Admin UI:
  - `app/src/components/admin/SuperAdminPortal.tsx`
  - Check for Billing, support workflow, tickets, refund, retention, and old paid-plan surfaces.
  - Hide/remove/quarantine active Admin UI that suggests paid-app workflows.
  - Preserve Robin credit settings, sponsor/ad controls, content controls, and free-app admin tools.
  - Subagent found retired Billing/Support tabs and paid Stripe status copy around `SuperAdminPortal.tsx:1134`.
- Frontend compatibility wrappers:
  - `app/src/components/subscription/*`
  - `app/src/components/support/*`
  - Verify these are harmless compatibility/retired views or remove them from active navigation/imports.
  - Compatibility client blocking/retired API handling lives around `app/src/lib/apiClient.ts:126`.

Suggested subagent split:

- Subagent A: backend Stripe/support/refund cleanup, read-only audit first.
- Subagent B: SQL setup cleanup strategy, especially current setup versus legacy files.
- Subagent C: Admin/frontend paid-flow UI audit.

### 3. P2: Performance Cleanup And Code Splitting

Goal: reduce initial user JS and keep heavy admin code out of the public user bundle.

Primary files:

- `app/src/App.tsx`
- `app/src/components/AdminPanel.tsx`
- `app/src/components/admin/SuperAdminPortal.tsx`
- `app/src/lib/promo/index.ts` if dynamic import warning remains relevant

Known issue:

- Build output still has a large main JS chunk.
- Prior build after OAuth produced:
  - `assets/index-CkjY090N.js` locally around `894.88 kB`
  - Live asset after deploy: `assets/index-Caj83VdU.js`
- Previous state had a single JS bundle around 1.14 MB raw.
- Admin overlays are already lazy-loaded around `app/src/App.tsx:138`, but the active bundle is still large.
- `SuperAdminPortal.tsx` still carries broad admin functionality and should be split by active tab after P0/P1 safety cleanup.

Tasks:

- Use `React.lazy` and `Suspense` or route-level dynamic imports for:
  - `AdminPanel`
  - `SuperAdminPortal`
  - any other heavy admin/subscription/promo-only areas.
- Keep user-facing routes stable.
- Avoid visible loading weirdness by adding a small restrained fallback.
- Re-run build and confirm separate chunks remain and initial user JS decreases where possible.

Verification:

- `npm.cmd run build`
- Inspect `app/dist/assets`.
- Verify `/`, `/dashboard`, `/pdf-library`, `/mock-interview`, `/admin`, and super-admin route behavior.
- Use browser or endpoint smoke checks after deployment if pushed.

## Only After Those Gates

After the cleanup/security/performance gates are done, then harden existing features:

- PDF download offer analytics regression tests and admin stats display polish.
- Sponsor/ad controls and hidden-by-default behavior.
- Auth/session UX polish.
- Admin dashboard usability.
- SEO/canonical domain decision:
  - App currently uses sslip.io for deployment but SEO files reference `https://www.SpouseInterview.com`.
  - Decide whether sslip.io is only temporary preview or whether a custom production domain should be connected.

## Verification Commands For Next Chat

Run from:

```powershell
cd "C:\Users\lnw73\Documents\FREE APPS TO GO\Spouse_GreencardPrep_FreeApp"
```

Baseline:

```powershell
git status --short
py -3 -m compileall server
cd app
npm.cmd run lint
npm.cmd run build
```

Live smoke checks:

```powershell
$origin = "https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io"
$paths = @(
  "/",
  "/dashboard",
  "/pdf-library",
  "/mock-interview",
  "/api/health",
  "/health",
  "/healthz",
  "/api/pdf-download-offer/public?source=practice_completion",
  "/api/ad-settings/public"
)
foreach ($path in $paths) {
  Invoke-WebRequest -Uri "$origin$path" -UseBasicParsing -TimeoutSec 30 |
    Select-Object @{n="Path";e={$path}}, StatusCode
}
```

OAuth deployed asset check:

```powershell
$origin = "https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io"
$html = (Invoke-WebRequest -Uri "$origin/" -UseBasicParsing -TimeoutSec 30).Content
$asset = ($html | Select-String -Pattern 'assets/[^"'']+\.js' -AllMatches).Matches.Value | Select-Object -First 1
$js = (Invoke-WebRequest -Uri "$origin/$asset" -UseBasicParsing -TimeoutSec 30).Content
$js.Contains("525916855163-4qt3urorpvh8lrs6rqidcscngcmn999d.apps.googleusercontent.com")
$js.Contains("39326050245-27vfptarof8c1s0qv3lcdpvkmpk0u6te.apps.googleusercontent.com")
```

## Deployment Notes

- Use the clean GitHub repo, not the older repo with previous paid/checkout setup.
- Avoid destructive git commands.
- Use `npm.cmd` and `npx.cmd` on Windows PowerShell.
- Coolify may show "unapplied configuration changes" until redeployed.
- If changing HTTPS/domain/env:
  - verify Coolify app domain stays `https://vq08kggh2g8js8e0i38e23au.95.216.19.44.sslip.io`
  - verify `FRONTEND_URL` stays HTTPS
  - verify HTTP redirects to HTTPS
  - verify Google OAuth still opens account chooser, not `origin_mismatch`

## Suggested First Prompt For The New Chat

```text
Continue the Spouse GreencardPrep FreeApp conversion from HANDOFF_NEXT_CHAT_2026-06-25_FREE_APP_PRE_HARDENING.md.

Use subagents by default for audit, implementation, and verification. Do not restart from scratch. Before hardening existing features, finish these gates in order:
1. Clean/quarantine remaining paid-app/refund/support-ticket leftovers while preserving Robin credit and sponsor/ad controls.
2. Tighten generic table API safety in server/routes/api_routes.py.
3. Code-split heavy admin areas so public user bundles are smaller.

Run compileall, lint, build, and live HTTPS smoke checks. Keep the app free/ad-supported and hidden-by-default for ads/offers.
```
