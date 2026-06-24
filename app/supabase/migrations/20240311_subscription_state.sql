-- ============================================================================
-- Subscription State Architecture
-- 
-- Extended subscription model for payment-ready state management
-- ============================================================================

-- ============================================================================
-- Extend: user_subscriptions
-- Add payment-ready fields while preserving existing data
-- ============================================================================

-- First, extend the status enum if needed
ALTER TABLE user_subscriptions 
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

-- Add new columns for payment provider integration
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifetime_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_pass_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Rename existing columns to match new naming convention (preserving data)
-- trial_ends_at already exists
-- current_period_ends_at already exists

-- Add grace period tracking
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_failure_count INTEGER DEFAULT 0;

-- Create new status check constraint with expanded statuses
ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check 
  CHECK (status IN ('trialing', 'active', 'canceled', 'expired', 'past_due', 'grace_period', 'inactive'));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider ON user_subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_ends_at ON user_subscriptions(ends_at);

-- ============================================================================
-- Function: get_effective_subscription
-- Returns subscription with computed effective status
-- ============================================================================
CREATE OR REPLACE FUNCTION get_effective_subscription(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  plan_type TEXT,
  status TEXT,
  effective_status TEXT,
  provider TEXT,
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_starts_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  interview_pass_ends_at TIMESTAMPTZ,
  lifetime_granted_at TIMESTAMPTZ,
  has_access BOOLEAN,
  access_ends_at TIMESTAMPTZ,
  days_remaining INTEGER
) AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_sub RECORD;
  v_effective_status TEXT;
  v_has_access BOOLEAN := false;
  v_access_ends_at TIMESTAMPTZ;
  v_days_remaining INTEGER;
BEGIN
  -- Get subscription
  SELECT * INTO v_sub
  FROM user_subscriptions
  WHERE user_subscriptions.user_id = p_user_id;
  
  -- Return null if no subscription found
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Compute effective status
  v_effective_status := v_sub.status;
  
  -- Check if trialing and trial ended
  IF v_sub.status = 'trialing' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at < v_now THEN
    v_effective_status := 'expired';
  END IF;
  
  -- Check if interview pass expired
  IF v_sub.plan_type = 'interviewPass' AND v_sub.interview_pass_ends_at IS NOT NULL 
     AND v_sub.interview_pass_ends_at < v_now THEN
    v_effective_status := 'expired';
  END IF;
  
  -- Check grace period
  IF v_sub.status = 'grace_period' AND v_sub.grace_period_ends_at IS NOT NULL 
     AND v_sub.grace_period_ends_at < v_now THEN
    v_effective_status := 'expired';
  END IF;
  
  -- Check if canceled and period ended
  IF v_sub.status = 'canceled' AND v_sub.current_period_ends_at IS NOT NULL 
     AND v_sub.current_period_ends_at < v_now THEN
    v_effective_status := 'expired';
  END IF;
  
  -- Compute access
  v_has_access := v_effective_status IN ('trialing', 'active', 'grace_period');
  
  -- Add canceled with remaining time
  IF v_sub.status = 'canceled' AND v_sub.current_period_ends_at > v_now THEN
    v_has_access := true;
  END IF;
  
  -- Compute access end date
  v_access_ends_at := COALESCE(
    v_sub.ends_at,
    v_sub.current_period_ends_at,
    v_sub.trial_ends_at,
    v_sub.interview_pass_ends_at,
    v_sub.grace_period_ends_at
  );
  
  -- Lifetime has no end
  IF v_sub.plan_type = 'lifetime' AND v_effective_status = 'active' THEN
    v_access_ends_at := NULL;
  END IF;
  
  -- Compute days remaining
  IF v_access_ends_at IS NOT NULL THEN
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_access_ends_at - v_now))::INTEGER);
  ELSE
    v_days_remaining := NULL;
  END IF;
  
  RETURN QUERY SELECT
    v_sub.user_id,
    v_sub.plan_type,
    v_sub.status,
    v_effective_status,
    v_sub.provider,
    v_sub.trial_starts_at,
    v_sub.trial_ends_at,
    v_sub.current_period_starts_at,
    v_sub.current_period_ends_at,
    v_sub.canceled_at,
    v_sub.ends_at,
    v_sub.grace_period_ends_at,
    v_sub.interview_pass_ends_at,
    v_sub.lifetime_granted_at,
    v_has_access,
    v_access_ends_at,
    v_days_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: transition_subscription
-- Handles subscription state transitions safely
-- ============================================================================
CREATE OR REPLACE FUNCTION transition_subscription(
  p_user_id UUID,
  p_new_status TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS user_subscriptions AS $$
DECLARE
  v_sub user_subscriptions;
  v_old_status TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Get current subscription
  SELECT * INTO v_sub
  FROM user_subscriptions
  WHERE user_subscriptions.user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for user %', p_user_id;
  END IF;
  
  v_old_status := v_sub.status;
  
  -- Validate transition
  IF v_old_status = p_new_status THEN
    RETURN v_sub; -- No change needed
  END IF;
  
  -- Apply transition with timestamps
  UPDATE user_subscriptions
  SET
    status = p_new_status,
    updated_at = v_now,
    metadata = metadata || p_metadata || jsonb_build_object(
      'last_transition', jsonb_build_object(
        'from_status', v_old_status,
        'to_status', p_new_status,
        'transitioned_at', v_now
      )
    ),
    -- Set timestamps based on transition
    canceled_at = CASE 
      WHEN p_new_status = 'canceled' AND canceled_at IS NULL THEN v_now
      ELSE canceled_at
    END,
    ends_at = CASE
      WHEN p_new_status = 'expired' AND ends_at IS NULL THEN v_now
      WHEN p_new_status = 'canceled' AND plan_type = 'monthly' THEN current_period_ends_at
      ELSE ends_at
    END,
    grace_period_ends_at = CASE
      WHEN p_new_status = 'grace_period' AND grace_period_ends_at IS NULL 
      THEN v_now + INTERVAL '7 days'
      ELSE grace_period_ends_at
    END
  WHERE user_subscriptions.user_id = p_user_id
  RETURNING * INTO v_sub;
  
  RETURN v_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: create_or_update_subscription
-- Creates or updates subscription (for webhooks/checkout)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_or_update_subscription(
  p_user_id UUID,
  p_plan_type TEXT,
  p_status TEXT DEFAULT 'active',
  p_provider TEXT DEFAULT 'internal',
  p_provider_customer_id TEXT DEFAULT NULL,
  p_provider_subscription_id TEXT DEFAULT NULL,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_current_period_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS user_subscriptions AS $$
DECLARE
  v_sub user_subscriptions;
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO user_subscriptions (
    user_id,
    plan_type,
    status,
    provider,
    provider_customer_id,
    provider_subscription_id,
    trial_starts_at,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    lifetime_granted_at,
    interview_pass_ends_at,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_plan_type,
    p_status,
    p_provider,
    p_provider_customer_id,
    p_provider_subscription_id,
    CASE WHEN p_status = 'trialing' THEN v_now ELSE NULL END,
    p_trial_ends_at,
    CASE WHEN p_status = 'active' THEN v_now ELSE NULL END,
    p_current_period_ends_at,
    CASE WHEN p_plan_type = 'lifetime' THEN v_now ELSE NULL END,
    CASE WHEN p_plan_type = 'interviewPass' THEN p_current_period_ends_at ELSE NULL END,
    p_metadata,
    v_now,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    provider = EXCLUDED.provider,
    provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, user_subscriptions.provider_customer_id),
    provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, user_subscriptions.provider_subscription_id),
    trial_starts_at = COALESCE(EXCLUDED.trial_starts_at, user_subscriptions.trial_starts_at),
    trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, user_subscriptions.trial_ends_at),
    current_period_starts_at = COALESCE(EXCLUDED.current_period_starts_at, user_subscriptions.current_period_starts_at),
    current_period_ends_at = COALESCE(EXCLUDED.current_period_ends_at, user_subscriptions.current_period_ends_at),
    lifetime_granted_at = COALESCE(EXCLUDED.lifetime_granted_at, user_subscriptions.lifetime_granted_at),
    interview_pass_ends_at = COALESCE(EXCLUDED.interview_pass_ends_at, user_subscriptions.interview_pass_ends_at),
    metadata = user_subscriptions.metadata || EXCLUDED.metadata,
    updated_at = v_now
  RETURNING * INTO v_sub;
  
  RETURN v_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: has_premium_access
-- Simple check for premium feature access
-- ============================================================================
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM get_effective_subscription(p_user_id);
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN v_sub.has_access AND v_sub.plan_type IN ('monthly', 'lifetime', 'interviewPass');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update existing subscriptions to set trial_starts_at if missing
-- ============================================================================
UPDATE user_subscriptions
SET trial_starts_at = created_at
WHERE status = 'trialing' AND trial_starts_at IS NULL;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_effective_subscription(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION transition_subscription(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION create_or_update_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION has_premium_access(UUID) TO authenticated, service_role;
