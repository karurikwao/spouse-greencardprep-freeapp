# SEO Publishing System — Deployment Checklist for Non-Coders

**A step-by-step guide for deploying the Coolify rebuild trigger system**

---

## Table of Contents
1. [What You Need Before Starting](#part-1--what-you-need-before-starting)
2. [Where to Run Each Step](#part-2--where-to-run-each-step)
3. [Pre-Flight Safety Check](#part-3--pre-flight-safety-check)
4. [Install / Verify Required Tools](#part-4--install--verify-required-tools)
5. [Exact Commands to Run](#part-5--exact-commands-to-run)
6. [How to Set the COOLIFY_WEBHOOK_URL Secret](#part-6--how-to-set-the-coolify_webhook_url-secret)
7. [How to Apply the Migration](#part-7--how-to-apply-the-migration)
8. [How to Deploy the Edge Function](#part-8--how-to-deploy-the-edge-function)
9. [How to Test From the Admin Dashboard](#part-9--how-to-test-from-the-admin-dashboard)
10. [How to Confirm It Worked](#part-10--how-to-confirm-it-worked)
11. [Common Mistakes to Avoid](#part-11--common-mistakes-to-avoid)
12. [How to Roll Back or Recover](#part-12--how-to-roll-back-or-recover)
13. [Final Non-Coder Checklist](#part-13--final-non-coder-checklist)

---

## PART 1 — WHAT YOU NEED BEFORE STARTING

Before you do anything, make sure you have ALL of these ready:

| Item | What It Is | How to Find It |
|------|-----------|----------------|
| **Supabase Project URL** | The web address of your Supabase dashboard | Open your browser bookmark or email from Supabase. Looks like: `https://app.supabase.com/project/xxxxxxxxxxxxxx` |
| **Supabase Project Reference ID** | A short code that identifies your project | In Supabase dashboard, look at the URL or Project Settings. It's the random letters/numbers after `/project/`. Example: `abc123def456` |
| **Supabase Access Token** | A secret password that lets your computer talk to Supabase | In Supabase dashboard: click your profile picture (top right) → "Access Tokens" → "Generate New Token". Copy and save it somewhere safe. |
| **Coolify Webhook URL** | The special web address that triggers a rebuild | See PART 6 for exactly where to find this in Coolify |
| **Local Project Folder Path** | The folder on your computer where the website code lives | This is where you see folders like `app`, `src`, `supabase`, etc. Example: `C:\Users\YourName\Documents\InterviewReady\app` |
| **Admin Account Login** | The email and password for an admin user in your app | You need to be logged in as someone with admin rights to test the rebuild button |
| **Terminal/Command Line** | A program that lets you type commands | Windows: Use **PowerShell** (search "PowerShell" in Start menu). Mac: Use **Terminal**. Do NOT use Command Prompt on Windows. |

**IMPORTANT:** If you don't have ALL of these, stop here and collect them first.

---

## PART 2 — WHERE TO RUN EACH STEP

Here's what happens where:

| Task | Where You Do It |
|------|-----------------|
| Install Supabase CLI | Your computer (PowerShell/Terminal) |
| Check if CLI is installed | Your computer (PowerShell/Terminal) |
| Deploy Edge Function | Your computer (PowerShell/Terminal) |
| Set COOLIFY_WEBHOOK_URL secret | Your computer (PowerShell/Terminal) |
| Apply database migration | Your computer (PowerShell/Terminal) OR Supabase Dashboard |
| Test the rebuild button | Web browser → Your app's Admin dashboard |
| Check if rebuild worked | Web browser → Coolify dashboard |
| View rebuild history | Web browser → Your app's Admin dashboard |

**Remember:** Most commands run on YOUR COMPUTER in PowerShell (Windows) or Terminal (Mac), not in the web browser.

---

## PART 3 — PRE-FLIGHT SAFETY CHECK

Before running ANY commands, check ALL of these:

- [ ] **I backed up my code** (Git commit, or make a copy of the project folder)
- [ ] **I am in the correct project folder** (the one with `app`, `src`, `supabase` folders inside)
- [ ] **I know my Supabase Project Reference ID** (see Part 1)
- [ ] **I have my Supabase Access Token copied** (see Part 1)
- **I am connected to the correct Supabase project** (we'll verify this in Part 5)
- **I have the CORRECT Coolify webhook URL** (not just any webhook, the one for THIS project)
- **I am logged into the Admin account** in the app (we'll verify when testing)
- **I have 15-30 minutes of uninterrupted time**

**⚠️ WARNING:** If you use the wrong Supabase project or wrong Coolify webhook, you could break a different website. Triple-check these.

---

## PART 4 — INSTALL / VERIFY REQUIRED TOOLS

### Do I Need Supabase CLI?

**Yes.** The CLI (Command Line Interface) is a tool that lets your computer talk to Supabase.

### How to Check If It's Already Installed

Open PowerShell (Windows) or Terminal (Mac) and type:

```powershell
supabase --version
```

**What success looks like:** You see a version number like `1.145.2` or similar.

**What failure looks like:** You see an error like "supabase: command not found" or "The term 'supabase' is not recognized."

### If It's NOT Installed

**On Windows (PowerShell):**

1. First, install Node.js if you don't have it:
   - Go to https://nodejs.org
   - Click the big green "LTS" button to download
   - Run the installer, click "Next" until it finishes
   
2. Then install Supabase CLI:
   ```powershell
   npm install -g supabase
   ```

**On Mac (Terminal):**
```bash
brew install supabase
```

If you don't have Homebrew, follow the instructions at https://brew.sh first.

### How to Verify Installation

After installing, close PowerShell/Terminal completely, reopen it, and run:

```powershell
supabase --version
```

You should see a version number.

---

## PART 5 — EXACT COMMANDS TO RUN

Run these commands IN ORDER. Do not skip any.

### Step 1: Open PowerShell/Terminal

**Windows:** Press Windows key, type "PowerShell", click "Windows PowerShell"

**Mac:** Press Command + Space, type "Terminal", press Enter

### Step 2: Navigate to Your Project Folder

Type this command (replace the path with YOUR actual folder path):

**Windows:**
```powershell
cd C:\Users\YourName\Documents\InterviewReady\app
```

**Mac:**
```bash
cd /Users/YourName/Documents/InterviewReady/app
```

**What success looks like:** The prompt changes to show you're in that folder. Example: `PS C:\Users\YourName\Documents\InterviewReady\app>`

**Common error:** "Cannot find path..." means you typed the wrong folder path. Check where your project actually is.

### Step 3: Log Into Supabase CLI

Run this command:

```powershell
supabase login
```

**What happens:** It opens a web browser asking you to paste an access token.

1. Copy your Supabase Access Token (from Part 1)
2. Paste it into the browser
3. Click "Verify"

**What success looks like:** The browser says "Success!" and your terminal says "You are now logged in."

**Common error:** "Invalid token" means you copied the wrong thing. Go back to Supabase dashboard and generate a new token.

### Step 4: Link to Your Supabase Project

Run this command (replace `xxxxxxxxxxxxxx` with your actual Project Reference ID):

```powershell
supabase link --project-ref xxxxxxxxxxxxxx
```

**What this does:** Connects your computer to your specific Supabase project.

**What success looks like:** You see "Connected to project xxxxxxxxxxxxxx" and a list of services.

**⚠️ WARNING:** Make sure this is the CORRECT project ID. If you link to the wrong project, you'll deploy to the wrong website.

**Common error:** "Project not found" means you used the wrong Reference ID. Check your Supabase dashboard URL.

---

## PART 6 — HOW TO SET THE COOLIFY_WEBHOOK_URL SECRET

This is the MOST IMPORTANT step. Do this carefully.

### Where to Get the Coolify Webhook URL

1. **Log into your Coolify dashboard** (the web interface where you manage deployments)

2. **Find your project** (the one for this website)

3. **Look for "Webhooks" or "Deploy Webhooks"** (usually in project settings or deployment settings)

4. **Copy the webhook URL** - it looks like:
   ```
   https://app.coolify.io/webhooks/deploy/abc123def456
   ```
   or
   ```
   https://coolify.yourdomain.com/api/v1/deploy?token=xyz789
   ```

5. **⚠️ SECURITY WARNING:** This URL is like a password. Anyone with this URL can trigger rebuilds. Keep it secret.

### How to Set It in Supabase

Run this command in PowerShell/Terminal (make sure you're in the project folder from Step 2):

```powershell
supabase secrets set COOLIFY_WEBHOOK_URL="paste-your-webhook-url-here"
```

**Example of what the full command looks like:**
```powershell
supabase secrets set COOLIFY_WEBHOOK_URL="https://app.coolify.io/webhooks/deploy/abc123def456"
```

**IMPORTANT DETAILS:**

- **Use straight quotes** `"` not curly quotes `"`
- **Include the full URL** including `https://`
- **No spaces** around the `=` sign
- **Keep the quotes** around the URL

### How to Confirm It Was Set

Run:

```powershell
supabase secrets list
```

**What success looks like:** You see `COOLIFY_WEBHOOK_URL` in the list (it won't show the actual URL, just the name, for security).

**Common error:** If you see "secrets is not a valid command," your Supabase CLI is outdated. Update it with `npm install -g supabase`.

### Do You Need to Redeploy the Edge Function After Setting It?

**No.** The Edge Function reads this secret each time it runs. Just setting it is enough.

---

## PART 7 — HOW TO APPLY THE MIGRATION

### What Migration File Should Already Exist

The file should already be in your project at:
```
app/supabase/migrations/20240322_seo_expansion_rebuild_tracking.sql
```

(This was created during the security hardening.)

### Command to Apply It

Make sure you're in the `app` folder (or the folder containing `supabase` folder), then run:

```powershell
supabase db push
```

**What this does:** Sends the new database structure to Supabase, creating the rebuild tracking tables.

**What success looks like:** You see messages like:
```
Connecting to remote database...
Applying migration 20240322_seo_expansion_rebuild_tracking.sql...
Finished supabase db push.
```

**How to Confirm It Worked:**

1. Go to your Supabase Dashboard in your web browser
2. Click "Table Editor" on the left
3. Look for a new table called `seo_expansion_rebuild_attempts`
4. If you see it, the migration worked!

**What to Do If It Fails:**

- **Error "permission denied":** You might not have admin rights on this Supabase project. Contact the project owner.
- **Error "relation already exists":** The migration might have already been applied. Check the Table Editor to confirm.
- **Error "syntax error":** The SQL file might be corrupted. Ask a developer to check it.

---

## PART 8 — HOW TO DEPLOY THE EDGE FUNCTION

### What the Edge Function Does (In Plain English)

The Edge Function is a small piece of code that lives on Supabase's servers (not on your computer). When you click "Trigger Coolify Rebuild" in the Admin dashboard:

1. The button sends a request to this Edge Function
2. The Edge Function checks that you're an admin
3. If you are, it sends the rebuild request to Coolify
4. It records what happened in the database

**Why this is secure:** The actual Coolify webhook URL stays hidden on Supabase's servers. Your browser never sees it.

### The Exact Deploy Command

Make sure you're in the project folder, then run:

```powershell
supabase functions deploy trigger-coolify-rebuild
```

**What success looks like:**
```
Deploying trigger-coolify-rebuild...
Deployed trigger-coolify-rebuild
```

This might take 30-60 seconds.

**What failure looks like:**
- "Function not found" - make sure the folder `app/supabase/functions/trigger-coolify-rebuild` exists
- "Not authenticated" - run `supabase login` again (Step 3)
- "Permission denied" - you might not have rights to deploy functions

### How to Confirm the Function Is Available

After deploying, you can verify it's there by running:

```powershell
supabase functions list
```

**What success looks like:** You see `trigger-coolify-rebuild` in the list.

### Does It Use the Secret Automatically?

**Yes.** The Edge Function automatically reads the `COOLIFY_WEBHOOK_URL` secret you set in Part 6. You don't need to do anything else.

---

## PART 9 — HOW TO TEST FROM THE ADMIN DASHBOARD

Follow these steps exactly to test:

### Step 1: Log Into the App as Admin

1. Open your web browser
2. Go to your app's website
3. Log in with an admin account (not a regular user account)

**How to tell if you're an admin:** You should see an "Admin" link or button somewhere in the navigation.

### Step 2: Go to SEO Expansion Settings

1. Click "Admin" (or "Admin Dashboard")
2. Look for "SEO Expansion" or "SEO Settings" tab/section
3. Click on it

### Step 3: Check the Safety Settings

Before testing, verify these are set safely:

- **Pattern Pages:** OFF
- **Situation Pages:** OFF
- **Include in Sitemap:** OFF

(We can test without actually publishing pages to the live site.)

### Step 4: Look for the Rebuild Section

Scroll down until you see a section called **"Trigger Coolify Rebuild"** with a blue button.

### Step 5: Click the Button

1. Click the **"Trigger Coolify Rebuild"** button
2. The button should change to say "Sending Request..." with a spinning icon
3. Wait 5-10 seconds

### Step 6: Watch for the Result

**What success looks like:**
- A green message box appears saying "Rebuild triggered successfully"
- It mentions "The site will rebuild within 2-5 minutes"
- The button becomes disabled (grayed out) for 5 minutes

**What failure looks like:**
- A red message box appears
- It might say "Authentication required" or "Failed to trigger rebuild"
- See Part 11 for troubleshooting

### Step 7: Check the History

1. Look for a "Rebuild History" or "Recent Rebuild Attempts" section (if visible)
2. You should see your attempt listed with status "triggered"

### Step 8: Verify in Coolify

1. Open a new browser tab
2. Go to your Coolify dashboard
3. Look for "Deployments" or "Activity Log"
4. You should see a new deployment starting within 1-2 minutes

---

## PART 10 — HOW TO CONFIRM IT WORKED

Use this checklist to verify everything:

### Immediate Confirmation (within 10 seconds)

- [ ] Green success message appeared in Admin dashboard
- [ ] Message said "Rebuild triggered successfully"
- [ ] Button became disabled (cooldown started)

### Short-Term Confirmation (within 2 minutes)

- [ ] Logged into Coolify dashboard
- [ ] Saw a new deployment/rebuild in the activity log
- [ ] Deployment status shows "In Progress" or "Building"

### Long-Term Confirmation (after 5 minutes)

- [ ] Coolify shows deployment as "Completed" or "Success"
- [ ] Website still loads normally
- [ ] (If you published test pages) Check sitemap.xml to see if they appear

### Understanding the Status

| What You See | What It Means |
|--------------|---------------|
| "Rebuild triggered successfully" | ✅ Request was sent to Coolify |
| "Sending Request..." | ⏳ Waiting for Coolify to respond |
| "Failed to trigger rebuild" | ❌ Something went wrong (check Part 11) |
| Coolify shows "Building" | ✅ Coolify received the request and is working |
| Coolify shows "Completed" | ✅ Rebuild finished (sitemap should be updated) |

**Important Honesty Check:** The Admin dashboard can only confirm that the REQUEST was sent. It cannot confirm that the rebuild actually completed successfully. Always check Coolify dashboard to verify the rebuild actually happened.

---

## PART 11 — COMMON MISTAKES TO AVOID

### Mistake 1: Running Commands from Wrong Folder

**What it is:** You run Supabase commands from your Desktop or Documents instead of the project folder.

**Symptom:** Error like "Cannot find supabase/config.toml" or "No project found."

**How to fix:** Use `cd` command to navigate to the correct folder (see Part 5, Step 2).

### Mistake 2: Using the Wrong Supabase Project

**What it is:** You link to a different Supabase project than the one your app actually uses.

**Symptom:** Changes don't appear in your app, or you break a different website.

**How to fix:** Check your app's environment file (`.env` or similar) for the correct Supabase URL, or ask a developer which project ID to use.

### Mistake 3: Forgetting to Deploy the Edge Function

**What it is:** You set the secret and applied the migration, but never ran `supabase functions deploy`.

**Symptom:** When clicking "Trigger Coolify Rebuild," you get an error like "Function not found" or "404."

**How to fix:** Run `supabase functions deploy trigger-coolify-rebuild` (see Part 8).

### Mistake 4: Forgetting to Set COOLIFY_WEBHOOK_URL

**What it is:** You deploy the Edge Function but never set the secret.

**Symptom:** Clicking the button gives error: "Rebuild is not configured."

**How to fix:** Run the secrets set command (see Part 6).

### Mistake 5: Using the Wrong Coolify Webhook

**What it is:** You copy a webhook URL from a different project in Coolify.

**Symptom:** Rebuilds trigger on the wrong website, or nothing happens.

**How to fix:** Double-check you're in the correct Coolify project. The webhook URL should match your website's project name.

### Mistake 6: Expecting Instant Completion

**What it is:** You click the button and immediately check the sitemap.

**Symptom:** You don't see changes and think it failed.

**How to fix:** Wait 2-5 minutes. Rebuilds take time. Check Coolify dashboard to see progress.

### Mistake 7: Testing While Not Logged In as Admin

**What it is:** You try to click the rebuild button as a regular user.

**Symptom:** Error "Admin access required" or the button is disabled.

**How to fix:** Log out and log back in with an admin account.

### Mistake 8: Typo in Secret Name

**What it is:** You type `COOLIFY_WEBHOOK` instead of `COOLIFY_WEBHOOK_URL`.

**Symptom:** Error "Rebuild is not configured" even though you set a secret.

**How to fix:** Run `supabase secrets list` to see what secrets exist. Delete the wrong one and set the correct one:
```powershell
supabase secrets unset COOLIFY_WEBHOOK
supabase secrets set COOLIFY_WEBHOOK_URL="your-url-here"
```

### Mistake 9: Migration Not Applied

**What it is:** You try to test but the rebuild tracking table doesn't exist.

**Symptom:** Database errors in the browser console, or the rebuild history doesn't save.

**How to fix:** Run `supabase db push` again (see Part 7).

---

## PART 12 — HOW TO ROLL BACK OR RECOVER

If something goes wrong, stay calm. Here's how to recover:

### Safest First Thing to Do

**Don't panic.** The worst-case scenario is that rebuild triggering doesn't work. Your website and SEO publishing state are still safe.

### How to Disable Rebuild Triggering Temporarily

If the button is causing problems:

1. **Remove the secret:**
   ```powershell
   supabase secrets unset COOLIFY_WEBHOOK_URL
   ```

2. **Now the button will show a friendly error** instead of breaking things

### How to Stop Using the Button Until Fixed

Simply **don't click it**. The rest of the SEO publishing system works fine without it. You can always trigger rebuilds manually from Coolify dashboard.

### How to Confirm SEO Publishing State Is Still Safe

Check these in the Admin dashboard:

- **Pattern Pages:** Should be OFF
- **Situation Pages:** Should be OFF
- **Published Pages:** Should show as Draft or Unpublished
- **Include in Sitemap:** Should be OFF

If these are all correct, your site is safe regardless of the rebuild button.

### How to Retry After Fixing

1. Fix the issue (see Part 11 for specific fixes)
2. Re-run the failed command
3. Test again using Part 9

### Nuclear Option: Start Over

If everything is broken:

1. Delete the Edge Function:
   ```powershell
   supabase functions delete trigger-coolify-rebuild
   ```

2. Remove the secret:
   ```powershell
   supabase secrets unset COOLIFY_WEBHOOK_URL
   ```

3. Ask a developer for help

**Your data is safe.** The rebuild button is completely separate from your actual page content and publishing state.

---

## PART 13 — FINAL NON-CODER CHECKLIST

Print this out and check each box:

### Before Starting
- [ ] I found my Coolify webhook URL (Part 6)
- [ ] I have my Supabase Project Reference ID
- [ ] I have my Supabase Access Token copied
- [ ] I know where my project folder is on my computer
- [ ] I have an admin account for the app
- [ ] I opened PowerShell (Windows) or Terminal (Mac)

### Tool Check
- [ ] I verified Supabase CLI is installed (`supabase --version` worked)
- [ ] I logged into Supabase CLI (`supabase login` succeeded)

### Deployment Steps
- [ ] I navigated to the correct project folder (`cd` command)
- [ ] I linked to the correct Supabase project (`supabase link`)
- [ ] I set the COOLIFY_WEBHOOK_URL secret (`supabase secrets set`)
- [ ] I verified the secret is set (`supabase secrets list` showed it)
- [ ] I applied the database migration (`supabase db push` succeeded)
- [ ] I deployed the Edge Function (`supabase functions deploy` succeeded)
- [ ] I verified the function is deployed (`supabase functions list` showed it)

### Testing
- [ ] I logged into the Admin dashboard as an admin
- [ ] I found the SEO Expansion settings page
- [ ] I clicked "Trigger Coolify Rebuild"
- [ ] I saw a green success message
- [ ] I logged into Coolify and saw a new deployment starting
- [ ] I waited 5 minutes and confirmed the deployment completed

### Final Verification
- [ ] My website still works normally
- [ ] The rebuild history shows my test attempt
- [ ] I understand the 5-minute cooldown

---

## QUICK REFERENCE CARD

**Save this somewhere handy:**

```
SUPABASE LOGIN:
supabase login

LINK PROJECT:
supabase link --project-ref YOUR_PROJECT_ID

SET WEBHOOK SECRET:
supabase secrets set COOLIFY_WEBHOOK_URL="your-url-here"

APPLY MIGRATION:
supabase db push

DEPLOY FUNCTION:
supabase functions deploy trigger-coolify-rebuild

CHECK STATUS:
supabase functions list
supabase secrets list
```

---

**Document Version:** 1.0  
**Last Updated:** March 2026  
**For:** SEO Publishing System with Coolify Integration

**You did it!** If you followed all these steps, your SEO publishing system is now securely deployed and ready to use.
