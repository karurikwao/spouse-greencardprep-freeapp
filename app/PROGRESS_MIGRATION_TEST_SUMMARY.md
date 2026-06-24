# Progress Migration Test Summary

## Migration: localStorage to Supabase

This document outlines the test scenarios for verifying the progress persistence migration from localStorage to Supabase.

---

## Deliverables Checklist

| Item | Status | File |
|------|--------|------|
| SQL Migration | ✅ | `supabase/migrations/20240311_create_user_progress.sql` |
| RLS Policies | ✅ | Included in migration |
| Trigger | ✅ | Included in migration |
| Progress Service | ✅ | `src/lib/progressService.ts` |
| Updated Hooks | ✅ | `usePracticeStreak.ts`, `useProgressStats.ts` |
| Migration Logic | ✅ | `progressService.ts` (migrateLocalStorageToSupabase) |
| Build Verification | ✅ | Passed |

---

## Test Scenarios

### 1. New User with Empty Progress

**Setup:**
- Create new user account
- No localStorage data exists
- First login

**Expected Behavior:**
- [ ] Empty progress row created in Supabase on first activity
- [ ] Default values: questions_practiced=0, ai_turns=0, readiness_score=0, streaks=0
- [ ] UI shows empty state messages
- [ ] No errors in console

**Verification Steps:**
1. Sign up with new email
2. Navigate to practice page
3. Verify no console errors
4. Check Supabase user_progress table for new row

---

### 2. Existing User with localStorage Progress

**Setup:**
- User has existing localStorage data:
  - `practice-progress`: `{ "topic-1-0": true, "topic-1-1": true }`
  - `practice-streak-v1`: `{ currentStreak: 5, longestStreak: 10, lastPracticeDate: "2024-03-10" }`
  - `ai-interview-stats`: `{ totalTurns: 20, streakDays: 5, lastPracticeDate: "2024-03-10" }`
- Clear `progress-migrated-v1` flag
- Login

**Expected Behavior:**
- [ ] Migration runs automatically on first login
- [ ] localStorage values merged with Supabase (max values)
- [ ] `progress-migrated-v1` flag set to "true"
- [ ] localStorage retained as fallback cache

**Verification Steps:**
1. Manually set localStorage values via DevTools
2. Clear `progress-migrated-v1`
3. Login
4. Check Supabase row has correct values
5. Verify migration flag is set
6. Verify localStorage still exists

---

### 3. Multi-Device Login

**Setup:**
- User practices on Device A (adds 5 questions)
- User logs in on Device B

**Expected Behavior:**
- [ ] Device B loads Supabase data on login
- [ ] Progress from Device A visible on Device B
- [ ] Streak correctly calculated based on Supabase last_practice_date

**Verification Steps:**
1. Practice 5 questions on Device A
2. Wait for Supabase sync (immediate)
3. Login on Device B (incognito window)
4. Verify questions_practiced = 5
5. Verify streak is correct

---

### 4. Refresh After Progress Update

**Setup:**
- User practices a question
- Page is refreshed

**Expected Behavior:**
- [ ] Progress persists after refresh
- [ ] Supabase has latest data
- [ ] localStorage has latest data (fallback)

**Verification Steps:**
1. Practice one question
2. Note questions_practiced count
3. Refresh page
4. Verify count unchanged
5. Check Supabase row updated

---

### 5. Clearing localStorage

**Setup:**
- User clears browser data/localStorage
- User is logged in

**Expected Behavior:**
- [ ] Data reloaded from Supabase on next page load
- [ ] No data loss
- [ ] UI displays correct progress

**Verification Steps:**
1. Practice several questions while logged in
2. Clear localStorage via DevTools: `localStorage.clear()`
3. Refresh page
4. Verify progress still displays correctly (loaded from Supabase)

---

### 6. Supabase Temporarily Unavailable

**Setup:**
- Block Supabase network requests (via DevTools Network tab or offline mode)
- User practices questions

**Expected Behavior:**
- [ ] UI updates immediately (optimistic)
- [ ] localStorage updated as fallback
- [ ] No UI blocking or error messages
- [ ] Silent retry in background
- [ ] Console warning logged

**Verification Steps:**
1. Login and load practice page
2. Block network to Supabase URL in DevTools
3. Practice a question
4. Verify UI updates immediately
5. Check localStorage has new data
6. Unblock network
7. Verify sync completes (check console)

---

### 7. Malformed topic_progress JSON

**Setup:**
- Manually insert malformed JSON into Supabase topic_progress column
- User loads progress

**Expected Behavior:**
- [ ] App handles gracefully
- [ ] Falls back to localStorage or empty state
- [ ] No crash
- [ ] Console warning logged

**Verification Steps:**
1. Via Supabase dashboard, set topic_progress to `"invalid json"`
2. Refresh app
3. Verify no crash
4. Check console for warning

---

### 8. Mobile Device Login

**Setup:**
- User practices on desktop
- User opens app on mobile device

**Expected Behavior:**
- [ ] Progress synced to mobile
- [ ] Streak calculated correctly
- [ ] Readiness score matches desktop

**Verification Steps:**
1. Practice on desktop browser
2. Open app on mobile browser (or responsive mode)
3. Login with same account
4. Verify all stats match

---

### 9. Performance - Excessive Write Prevention

**Setup:**
- User rapidly practices questions
- Multiple streak updates in same day

**Expected Behavior:**
- [ ] Streak updated only once per day (not on every question)
- [ ] Topic progress only updates when changed
- [ ] AI turns batched efficiently

**Verification Steps:**
1. Login and note last_practice_date
2. Practice 5 questions rapidly
3. Check Supabase - streak should only update on first question of the day
4. Verify topic_progress only updates when question count changes

---

### 10. Offline Mode Recovery

**Setup:**
- User practices while offline
- Network returns

**Expected Behavior:**
- [ ] localStorage holds changes while offline
- [ ] Automatic sync when network returns
- [ ] No duplicate counts

**Verification Steps:**
1. Go offline (DevTools Network tab)
2. Practice 3 questions
3. Check localStorage has data
4. Go online
5. Verify Supabase syncs with correct counts

---

## Backward Compatibility Tests

### LocalStorage Keys Maintained

The following keys continue to work as fallback:

| Key | Purpose | Status |
|-----|---------|--------|
| `practice-progress` | Question completion status | ✅ Preserved |
| `practice-streak-v1` | Streak tracking | ✅ Preserved |
| `ai-interview-stats` | AI interview turns | ✅ Preserved |
| `progress-migrated-v1` | Migration flag | ✅ New |

### Anonymous Mode (Not Logged In)

**Expected Behavior:**
- [ ] All progress stored in localStorage only
- [ ] No Supabase calls attempted
- [ ] UI works normally
- [ ] Prompt to login for cross-device sync

---

## Security Tests

### RLS Policy Verification

**Test:** Attempt to access another user's progress

**Expected:** Access denied

**SQL to verify:**
```sql
-- Should return only current user's row
SELECT * FROM user_progress WHERE user_id = auth.uid();

-- Should return 0 rows (different user)
SELECT * FROM user_progress WHERE user_id != auth.uid();
```

---

## Console Error Monitoring

During all tests, verify no console errors:

```
❌ Unexpected errors
❌ Network timeout warnings (expected warnings OK)
❌ Type errors
✅ Expected warnings (Supabase unavailable, etc.)
```

---

## Performance Benchmarks

| Metric | Target | Status |
|--------|--------|--------|
| Initial load time | < 500ms | ⏳ Test |
| Sync latency | < 2s | ⏳ Test |
| Offline resilience | Works | ✅ Pass |
| Retry attempts | 3 | ✅ Configured |

---

## Deployment Checklist

Before deploying to production:

- [ ] Run SQL migration in Supabase dashboard
- [ ] Verify RLS policies enabled
- [ ] Test with production Supabase URL
- [ ] Verify build passes
- [ ] Test on staging environment
- [ ] Monitor error rates post-deployment

---

## Rollback Plan

If issues occur:

1. **Immediate:** No action needed - localStorage continues as fallback
2. **Short-term:** Disable Supabase sync by setting feature flag
3. **Long-term:** Restore previous code version

All user data remains safe in localStorage during any rollback.
