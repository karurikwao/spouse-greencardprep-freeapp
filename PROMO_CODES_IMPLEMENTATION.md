# Influencer Promo Code and Referral Tracking System

## Overview

This document describes the implementation of the Influencer Promo Code and Referral Tracking system for InterviewReady. This system allows social media influencers to promote the app using unique promo codes or referral links, with automatic discount application and comprehensive tracking.

## Features Implemented

### 1. Database Schema

#### `promo_codes` Table
- `id` (uuid, primary key)
- `code` (text, unique) - The promo code (e.g., MARIA10)
- `description` (text) - Description of the promo
- `discount_percent` (integer) - Discount percentage (0-100)
- `influencer_name` (text) - Name of the influencer
- `is_active` (boolean) - Whether the code is active
- `created_at` (timestamp)

#### `referral_events` Table
- `id` (uuid, primary key)
- `user_id` (uuid, nullable) - User who triggered the event
- `promo_code` (text) - The promo code used
- `referrer` (text) - Referral source (e.g., instagram, youtube)
- `landing_page` (text) - URL of the landing page
- `event_type` (text) - Type: visit, signup, checkout, purchase
- `metadata` (jsonb) - Additional metadata
- `created_at` (timestamp)

### 2. Referral URL Support

The system supports referral links in two formats:

**Query Parameter Format:**
```
https://interviewready.com/?ref=CODE
```

**Path-Based Format:**
```
https://interviewready.com/ref/CODE
```

Examples:
```
https://interviewready.com/?ref=MARIA10
https://interviewready.com/ref/MARIA10

https://interviewready.com/?ref=ANA20
https://interviewready.com/ref/ANA20
```

Both formats work identically - the code is captured, stored in localStorage, and applied at checkout.

When a user visits with a `?ref=` parameter:
1. The code is captured and stored in localStorage
2. A "visit" event is recorded in the database
3. The code persists across page navigation
4. The code is automatically applied at signup/checkout

### 3. Signup Integration

The AuthModal component now includes:
- Promo code input field
- Automatic validation of promo codes
- Display of discount percentage when valid
- Recording of signup events with promo code

### 4. Stripe Checkout Integration

The checkout session creation now:
- Accepts optional promo code parameter
- Validates the promo code server-side
- Records checkout events
- Passes promo code metadata to Stripe
- Records purchase events on successful payment

### 5. Admin Dashboard

The SuperAdminPortal now includes a "Promo Codes" tab with:
- Summary statistics (total referrals, signups, purchases, paid users)
- List of all promo codes with performance metrics
- Ability to add, edit, and deactivate promo codes
- Referral URL examples for sharing with influencers

## Files Modified/Created

### New Files

1. `app/supabase/migrations/20240315_promo_codes.sql`
   - Database migration with tables, indexes, RLS policies, and functions

2. `app/src/lib/promo/types.ts`
   - TypeScript type definitions for promo codes and referrals

3. `app/src/lib/promo/index.ts`
   - Main promo code service with client-side utilities

4. `app/src/lib/promo/admin.ts`
   - Admin functions for managing promo codes and viewing stats

5. `app/src/hooks/useReferralTracking.ts`
   - React hooks for referral tracking in components

### Modified Files

1. `app/src/components/auth/AuthModal.tsx`
   - Added promo code input with validation
   - Records signup events with promo codes

2. `app/supabase/functions/create-checkout-session/index.ts`
   - Added promo code support with discount calculation
   - Records checkout and purchase events

3. `app/supabase/functions/stripe-webhook/index.ts`
   - Records purchase events when payments complete
   - Stores promo code in subscription metadata

4. `app/src/lib/subscriptions/stripe.ts`
   - Updated to support promo code parameter

5. `app/src/components/admin/SuperAdminPortal.tsx`
   - Added Promo Codes tab with management interface

6. `app/src/App.tsx`
   - Added referral capture on app mount

## Usage Examples

### For Influencers

Share your referral link:
```
https://interviewready.com/?ref=MARIA10
```

Or users can enter MARIA10 at signup or checkout.

### For Users

1. Click a referral link like `https://interviewready.com/?ref=MARIA10`
2. The promo code is automatically stored
3. Sign up with the code pre-filled, or enter it manually
4. The discount is automatically applied at checkout

### For Admins

Access the SuperAdmin Portal and navigate to the "Promo Codes" tab to:
- View performance statistics for each code
- Add new promo codes
- Activate/deactivate codes
- View referral URLs to share with influencers

## API Reference

### Client-Side Functions

```typescript
// Capture referral from URL
captureReferralFromUrl();

// Validate a promo code
const result = await validatePromoCode('MARIA10');
// { valid: true, code: 'MARIA10', discount_percent: 10, influencer_name: 'Maria Garcia' }

// Record signup event
await recordSignupEvent(userId);

// Calculate discounted price
const discount = await calculateDiscountedPrice('monthly', 'MARIA10');
// { valid: true, original_price: 19.99, discount_percent: 10, discount_amount: 2.00, final_price: 17.99 }
```

### Database Functions

```sql
-- Validate a promo code
SELECT * FROM validate_promo_code('MARIA10');

-- Get stats for a promo code
SELECT * FROM get_promo_code_stats('MARIA10');

-- Get stats for all promo codes
SELECT * FROM get_all_promo_code_stats();

-- Calculate discount
SELECT * FROM apply_promo_code_discount('MARIA10', 19.99);
```

## Test Scenarios

### Scenario 1: New User with Referral Link (Query Param)
1. Visit `https://interviewready.com/?ref=MARIA10`
2. Verify code is stored in localStorage
3. Sign up with promo code pre-filled
4. Verify signup event recorded with MARIA10
5. Purchase a plan
6. Verify discount applied and purchase event recorded

### Scenario 1b: New User with Referral Link (Path-Based)
1. Visit `https://interviewready.com/ref/MARIA10`
2. Verify redirect to home page occurs
3. Verify code is stored in localStorage
4. Continue with signup and purchase
5. Verify discount applied

### Scenario 2: Manual Promo Code Entry
1. Visit site directly (no ref parameter)
2. Sign up and enter MARIA10 manually
3. Verify code validates and shows discount
4. Complete purchase
5. Verify discount applied

### Scenario 3: Invalid Promo Code
1. Enter invalid code like INVALID99
2. Verify validation fails gracefully
3. Complete purchase without discount
4. Verify checkout succeeds without promo

### Scenario 4: Admin Management
1. Log in as superadmin
2. Navigate to Promo Codes tab
3. Add new promo code TEST20
4. Verify code appears in list
5. Deactivate code
6. Verify code no longer works for new signups

### Scenario 5: Graceful Fallback
1. Disable Supabase temporarily
2. Attempt to use promo code
3. Verify checkout still works (without discount)
4. Verify no error messages displayed to user

## Environment Variables

No new environment variables required. The system uses existing Supabase and Stripe configurations.

## Migration

Run the migrations to set up the database:

```bash
# Using Supabase CLI
supabase migration up

# Or apply manually via Supabase Dashboard
# Copy contents of 20240315_promo_codes.sql to SQL Editor
```

### Migration Files

1. **20240315_promo_codes.sql** - Initial tables, indexes, RLS policies, and functions
2. **20240316_promo_codes_indexes.sql** - Additional indexes for analytics queries

### Indexes

**promo_codes table:**
- `idx_promo_codes_code` - Fast code lookups
- `idx_promo_codes_active` - Partial index for active codes

**referral_events table:**
- `idx_referral_events_user_id` - User event lookups
- `idx_referral_events_promo_code` - Promo code filtering
- `idx_referral_events_event_type` - Event type filtering
- `idx_referral_events_created_at` - Time-based queries
- `idx_referral_events_promo_code_event` - Composite for stats queries
- `idx_referral_events_user_created` - User history by time (v2)
- `idx_referral_events_recent` - Recent events for dashboards (v2)
- `idx_referral_events_referrer` - Referrer source analysis (v2)

## Future Enhancements

Potential improvements for future versions:

1. **Expiration Dates**: Add expiration dates to promo codes
2. **Usage Limits**: Limit number of uses per code
3. **Referral Rewards**: Give credits to influencers for referrals
4. **A/B Testing**: Track conversion rates by code
5. **Affiliate Payouts**: Calculate and track affiliate commissions
6. **Email Integration**: Send welcome emails with referral links

## Support

For issues or questions about the promo code system:
1. Check the browser console for error messages
2. Verify Supabase functions are deployed
3. Ensure RLS policies are correctly configured
4. Check Stripe webhook configuration for purchase events
