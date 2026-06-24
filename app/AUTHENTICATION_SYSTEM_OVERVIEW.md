# InterviewReady Authentication System Overview

**Last Updated:** 2026-03-14  
**Authentication Provider:** Supabase Auth (GoTrue)  
**Authentication Mode:** Optional (app works without login)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Email/Password Authentication](#2-emailpassword-authentication)
3. [Signup Flow](#3-signup-flow)
4. [Login Flow](#4-login-flow)
5. [Password Reset / Forgot Password](#5-password-reset--forgot-password)
6. [Session Management](#6-session-management)
7. [User Roles & Admin Access](#7-user-roles--admin-access)
8. [Trial Subscription Auto-Creation](#8-trial-subscription-auto-creation)
9. [Security Considerations](#9-security-considerations)
10. [Known Issues & Limitations](#10-known-issues--limitations)

---

## 1. System Architecture

### Core Files

| File | Purpose |
|------|---------|
| `app/src/lib/auth/AuthContext.tsx` | React context for auth state |
| `app/src/lib/supabase.ts` | Supabase client + auth helpers |
| `app/src/components/auth/AuthModal.tsx` | UI for login/signup/reset |

### Key Dependencies

- `@supabase/supabase-js` - Supabase client library
- Environment variables:
  - `VITE_SUPABASE_URL` - Your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Public anon key

### Authentication Pattern: Optional Auth

The app supports **optional authentication**:
- Users can use the app without signing in
- Data is stored locally (localStorage)
- Signing in enables cloud sync across devices
- This reduces friction for new users

---

## 2. Email/Password Authentication

### Supported Auth Methods

| Method | Status | Notes |
|--------|--------|-------|
| Email/Password | ✅ Active | Primary method |
| Magic Link | ❌ Not implemented | Could be added |
| OAuth (Google, etc.) | ❌ Not implemented | Could be added |
| SSO | ❌ Not implemented | Enterprise feature |

### Password Requirements

- **Minimum length:** 6 characters
- **No complexity requirements** (no special chars, numbers required)
- **Case sensitive**

### User Metadata Stored

When signing up, the following metadata is collected:

```typescript
{
  first_name: string,      // Optional
  last_name: string,       // Optional
  promo_code: string       // Optional (referral code)
}
```

This is stored in `auth.users.raw_user_meta_data`.

---

## 3. Signup Flow

### User Journey

```
1. User clicks "Sign In" → AuthModal opens
2. User switches to "Create Account" tab
3. User enters:
   - First Name (optional)
   - Last Name (optional)
   - Email (required)
   - Password (required, min 6 chars)
   - Promo Code (optional)
4. User clicks "Create Account"
5. Supabase creates user with 'email' provider
6. Database trigger auto-creates trial subscription
7. User sees: "Check your email to confirm your account!"
8. User must click confirmation link in email
9. Account is now active
```

### Code Flow

```typescript
// AuthModal.tsx - handleSignup
const handleSignup = async (e: React.FormEvent) => {
  const { error, data } = await signUp(email, password, {
    first_name: firstName,
    last_name: lastName,
    promo_code: promoCode || undefined,
  });
  
  if (error) {
    // Show error
  } else {
    // Show success message
    setSuccess('Check your email to confirm your account!');
    
    // Track referral if promo code used
    if (data?.user && promoCode) {
      await recordSignupEvent(data.user.id, { email, first_name, lastName });
    }
  }
};
```

### Database Trigger: Auto-Create Trial Subscription

When a new user is created in `auth.users`, a trigger automatically creates their trial subscription:

```sql
-- From 20240310_ai_usage_tracking.sql
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_subscription();

-- Function creates:
-- plan_type: 'trial'
-- status: 'trialing'
-- trial_ends_at: now() + 7 days
```

**This means:** Every new user gets a 7-day trial automatically.

---

## 4. Login Flow

### User Journey

```
1. User clicks "Sign In" → AuthModal opens
2. User enters email and password
3. User clicks "Sign In"
4. Supabase validates credentials
5. Session is created and stored
6. AuthModal closes
7. User sees success message
8. App now uses cloud sync for progress
```

### Code Flow

```typescript
// AuthContext.tsx - signIn
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error };
};
```

### Session Persistence

- Supabase stores session in `localStorage` by default
- Session persists across browser restarts
- Session expires after a period of inactivity (configured in Supabase)

---

## 5. Password Reset / Forgot Password

### Current Implementation

**Status:** ⚠️ Partially implemented

#### User Journey

```
1. User clicks "Forgot password?" on login form
2. Form switches to "Reset Password" view
3. User enters their email
4. User clicks "Send Reset Link"
5. Supabase sends email with reset link
6. User clicks link in email
7. User is redirected to: /reset-password
8. ❌ PROBLEM: No route handler for /reset-password exists!
```

### Code Flow

```typescript
// AuthContext.tsx - resetPassword
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
};
```

### ⚠️ Known Issue: Missing Password Reset Page

**Problem:** The password reset flow redirects to `/reset-password`, but there is **no route handler** for this path in `App.tsx`.

**Current behavior:** Users clicking the reset link will land on the homepage (default `else setPage('home')`).

**Missing:** A page/component to handle the password update after clicking the email link.

### What Should Exist (But Doesn't)

A route handler and page for `/reset-password` that:

1. Detects the password reset token in the URL
2. Shows a form to enter new password
3. Calls `updatePassword(newPassword)`
4. Confirms success and redirects to login

```typescript
// This function exists in AuthContext.tsx but isn't used:
const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { error };
};
```

### Workaround for Now

Users who need to reset their password:
1. Click "Forgot password?"
2. Receive email with reset link
3. Click link → lands on homepage (broken)
4. Must contact admin for manual password reset

---

## 6. Session Management

### Auth State Tracking

```typescript
// AuthContext.tsx
const [user, setUser] = useState<User | null>(null);
const [session, setSession] = useState<Session | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

### On App Load

1. Check for existing session:
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   ```

2. Subscribe to auth state changes:
   ```typescript
   onAuthStateChange((_event, session) => {
     setSession(session);
     setUser(session?.user ?? null);
   });
   ```

### Auth State Change Events

| Event | Trigger |
|-------|---------|
| `SIGNED_IN` | User logs in |
| `SIGNED_OUT` | User logs out |
| `USER_UPDATED` | User data changes |
| `PASSWORD_RECOVERY` | Password reset initiated |
| `TOKEN_REFRESHED` | Session token refreshed |

### Logout Flow

```typescript
const signOut = async () => {
  await supabase.auth.signOut();
  // User and session state automatically cleared via onAuthStateChange
};
```

---

## 7. User Roles & Admin Access

### SuperAdmin Detection

**Current implementation:** Hardcoded email list (client-side)

```typescript
// AuthContext.tsx
const SUPERADMIN_EMAILS = [
  'admin@interviewready.com', 
  'superadmin@interviewready.com'
];

const isSuperAdmin = user 
  ? SUPERADMIN_EMAILS.includes(user.email ?? '') 
  : false;
```

**⚠️ Security Note:** This is client-side only. Always verify admin status server-side for sensitive operations.

### Database-Level Admin Check

Some RLS policies use this pattern:

```sql
EXISTS (
  SELECT 1 FROM auth.users 
  WHERE auth.users.id = auth.uid() 
  AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
)
```

**Note:** The `is_admin` metadata flag is not currently set during signup. This would need to be added manually in Supabase.

### Admin Components

| Component | Access |
|-----------|--------|
| `AdminPanel` | SuperAdmin only |
| `SuperAdminPortal` | SuperAdmin only |

---

## 8. Trial Subscription Auto-Creation

### How It Works

Every new user automatically gets a trial subscription via database trigger:

```sql
-- Trigger fires AFTER INSERT on auth.users
INSERT INTO user_subscriptions (
  user_id,
  plan_type,
  status,
  trial_ends_at
) VALUES (
  NEW.id,
  'trial',
  'trialing',
  now() + INTERVAL '7 days'
);
```

### Trial Limitations

From `plan_config` table:

| Feature | Trial Access |
|---------|-------------|
| AI Interview | ✅ Yes (5 turns/session) |
| Sessions per day | 1 |
| Provider selection | ❌ No |
| Model selection | ❌ No |
| PDF Downloads | ❌ No (premium only) |

### After Trial Ends

- Status changes to `expired`
- User must upgrade to paid plan
- Data is preserved but features are locked

---

## 9. Security Considerations

### ✅ What's Secure

| Aspect | Implementation |
|--------|----------------|
| Password hashing | Handled by Supabase (bcrypt) |
| Session tokens | JWT with automatic refresh |
| Row Level Security | Enabled on all user data tables |
| Email confirmation | Required before account activation |

### ⚠️ Areas for Improvement

| Issue | Risk Level | Recommendation |
|-------|------------|----------------|
| Missing password reset page | Medium | Add `/reset-password` route handler |
| Client-side admin check only | Medium | Add server-side admin verification |
| No password complexity rules | Low | Consider requiring stronger passwords |
| No rate limiting on login | Low | Supabase provides some; consider stricter |
| Hardcoded admin emails | Low | Move to database configuration |

### Environment Variables

**Required:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**⚠️ Important:** The anon key is public (safe to expose in frontend). Never expose the service role key.

---

## 10. Known Issues & Limitations

### Issue #1: Password Reset Flow Incomplete

**Status:** ⚠️ Active  
**Impact:** Users cannot self-serve password reset  
**Workaround:** Manual admin intervention  
**Fix needed:** Add `/reset-password` route and password update UI

### Issue #2: No User Profile Table

**Status:** By design (for now)  
**Current:** User metadata stored in `auth.users.raw_user_meta_data`  
**Limitation:** Hard to query/update user profiles  
**Future:** Could add `public.profiles` table with extended user data

### Issue #3: Admin Role Management

**Status:** Manual process  
**Current:** Must manually set `is_admin` in user metadata  
**No UI:** No admin interface to promote/demote users

### Issue #4: No Account Deletion

**Status:** Not implemented  
**Impact:** Users cannot delete their accounts  
**Compliance:** May be needed for GDPR/CCPA  
**Note:** Can be done manually in Supabase dashboard

### Issue #5: No Email Change Flow

**Status:** Not implemented  
**Impact:** Users cannot change their email address  
**Workaround:** Create new account, contact admin to transfer data

---

## Summary

| Feature | Status | Quality |
|---------|--------|---------|
| Email/Password Signup | ✅ Working | Good |
| Email/Password Login | ✅ Working | Good |
| Session Management | ✅ Working | Good |
| Trial Auto-Creation | ✅ Working | Good |
| Password Reset | ⚠️ Broken | Needs fix |
| Admin System | ⚠️ Basic | Needs hardening |
| OAuth/Social Login | ❌ Not implemented | N/A |
| MFA/2FA | ❌ Not implemented | N/A |

---

## Recommended Next Steps

1. **Fix password reset flow** (Priority: High)
   - Add `/reset-password` route handler
   - Create password update form
   - Test end-to-end flow

2. **Add server-side admin verification** (Priority: Medium)
   - Create `is_admin()` RPC function
   - Update RLS policies to use it
   - Don't rely solely on client-side checks

3. **Consider OAuth providers** (Priority: Low)
   - Google Sign-In
   - Apple Sign-In (for iOS users)

4. **Add account management** (Priority: Low)
   - Email change
   - Account deletion
   - Password change (for logged-in users)
