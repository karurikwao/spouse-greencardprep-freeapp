-- ============================================================================
-- Promo Codes Additional Indexes (Follow-up Migration)
-- ============================================================================
-- This migration adds additional indexes for improved query performance
-- on analytics and reporting queries.
-- ============================================================================

-- Composite index for user analytics queries (e.g., finding all events for a user sorted by time)
CREATE INDEX IF NOT EXISTS idx_referral_events_user_created 
  ON referral_events(user_id, created_at DESC);

-- Partial index for recent events (useful for time-based dashboards)
CREATE INDEX IF NOT EXISTS idx_referral_events_recent 
  ON referral_events(created_at DESC) 
  WHERE created_at > (now() - interval '90 days');

-- Index for source/referrer analysis
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer 
  ON referral_events(referrer) 
  WHERE referrer IS NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON INDEX idx_referral_events_user_created IS 'Optimizes queries for user referral history';
COMMENT ON INDEX idx_referral_events_recent IS 'Optimizes dashboard queries for recent activity';
COMMENT ON INDEX idx_referral_events_referrer IS 'Optimizes referrer source analysis queries';
