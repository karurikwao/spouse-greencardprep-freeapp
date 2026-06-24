-- ============================================================================
-- Refund System Tables
-- ============================================================================
-- Tables for managing refund requests and tracking refund status.
-- ============================================================================

-- ============================================================================
-- Table: refund_requests
-- Stores user refund requests with eligibility calculation
-- ============================================================================
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  plan_type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  
  -- Eligibility tracking
  purchased_at TIMESTAMPTZ,
  days_since_purchase INTEGER DEFAULT 0,
  questions_completed INTEGER DEFAULT 0,
  mock_interviews_completed INTEGER DEFAULT 0,
  eligibility_status TEXT NOT NULL DEFAULT 'pending' CHECK (eligibility_status IN ('pending', 'eligible', 'not_eligible', 'approved', 'denied', 'refunded')),
  
  -- Request details
  reason TEXT,
  additional_comments TEXT,
  
  -- Admin handling
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  
  -- Stripe refund tracking
  stripe_refund_id TEXT,
  refunded_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments for documentation
COMMENT ON TABLE refund_requests IS 'Stores user refund requests with automatic eligibility calculation';
COMMENT ON COLUMN refund_requests.eligibility_status IS 'Current status: pending, eligible, not_eligible, approved, denied, refunded';
COMMENT ON COLUMN refund_requests.stripe_refund_id IS 'Stripe refund ID once processed';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_refund_requests_stripe_payment ON refund_requests(stripe_payment_intent_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own refund requests
CREATE POLICY "Users can view own refund requests" ON refund_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own refund requests
CREATE POLICY "Users can create own refund requests" ON refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only service role/admins can update refund requests
CREATE POLICY "Service role can manage refund requests" ON refund_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view all refund requests
CREATE POLICY "Admins can view all refund requests" ON refund_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- Admins can update refund requests
CREATE POLICY "Admins can update refund requests" ON refund_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: calculate_refund_eligibility
-- Calculates if a user is eligible for refund based on usage criteria
CREATE OR REPLACE FUNCTION calculate_refund_eligibility(
  p_user_id UUID,
  p_purchased_at TIMESTAMPTZ
)
RETURNS TABLE (
  days_since_purchase INTEGER,
  questions_completed INTEGER,
  mock_interviews_completed INTEGER,
  is_eligible BOOLEAN,
  eligibility_reason TEXT
) AS $$
DECLARE
  v_days_since INTEGER;
  v_questions INTEGER;
  v_interviews INTEGER;
  v_is_eligible BOOLEAN := true;
  v_reason TEXT := '';
BEGIN
  -- Calculate days since purchase
  v_days_since := EXTRACT(DAY FROM (now() - p_purchased_at))::INTEGER;
  
  -- Get questions completed (from user_progress table if exists, otherwise 0)
  SELECT COALESCE(COUNT(*), 0) INTO v_questions
  FROM user_progress
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND updated_at > p_purchased_at;
  
  -- Get mock interviews completed (from ai_interview_sessions table)
  SELECT COALESCE(COUNT(*), 0) INTO v_interviews
  FROM ai_interview_sessions
  WHERE user_id = p_user_id
    AND created_at > p_purchased_at
    AND status = 'completed';
  
  -- Check eligibility criteria
  -- Criteria: within 7 days, fewer than 25 questions, no more than 1 interview
  IF v_days_since > 7 THEN
    v_is_eligible := false;
    v_reason := 'Refund window expired (over 7 days)';
  ELSIF v_questions >= 25 THEN
    v_is_eligible := false;
    v_reason := 'Exceeded usage limit (25+ questions)';
  ELSIF v_interviews > 1 THEN
    v_is_eligible := false;
    v_reason := 'Exceeded usage limit (more than 1 mock interview)';
  ELSE
    v_reason := 'Within refund window and usage limits';
  END IF;
  
  RETURN QUERY SELECT v_days_since, v_questions, v_interviews, v_is_eligible, v_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: create_refund_request
-- Creates a new refund request with eligibility calculation
CREATE OR REPLACE FUNCTION create_refund_request(
  p_user_id UUID,
  p_subscription_id TEXT,
  p_stripe_payment_intent_id TEXT,
  p_plan_type TEXT,
  p_amount DECIMAL,
  p_reason TEXT,
  p_additional_comments TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_refund_id UUID;
  v_purchased_at TIMESTAMPTZ;
  v_eligibility RECORD;
BEGIN
  -- Get purchase date from subscription or default to now
  SELECT created_at INTO v_purchased_at
  FROM user_subscriptions
  WHERE stripe_subscription_id = p_subscription_id
    AND user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_purchased_at IS NULL THEN
    v_purchased_at := now();
  END IF;
  
  -- Calculate eligibility
  SELECT * INTO v_eligibility
  FROM calculate_refund_eligibility(p_user_id, v_purchased_at);
  
  -- Insert refund request
  INSERT INTO refund_requests (
    user_id,
    subscription_id,
    stripe_payment_intent_id,
    plan_type,
    amount,
    purchased_at,
    days_since_purchase,
    questions_completed,
    mock_interviews_completed,
    eligibility_status,
    reason,
    additional_comments
  ) VALUES (
    p_user_id,
    p_subscription_id,
    p_stripe_payment_intent_id,
    p_plan_type,
    p_amount,
    v_purchased_at,
    v_eligibility.days_since_purchase,
    v_eligibility.questions_completed,
    v_eligibility.mock_interviews_completed,
    CASE WHEN v_eligibility.is_eligible THEN 'eligible' ELSE 'not_eligible' END,
    p_reason,
    p_additional_comments
  )
  RETURNING id INTO v_refund_id;
  
  RETURN v_refund_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: process_refund_approval
-- Updates refund request when approved by admin
CREATE OR REPLACE FUNCTION process_refund_approval(
  p_refund_id UUID,
  p_admin_user_id UUID,
  p_stripe_refund_id TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE refund_requests
  SET 
    eligibility_status = CASE 
      WHEN p_stripe_refund_id IS NOT NULL THEN 'refunded'
      ELSE 'approved'
    END,
    processed_by = p_admin_user_id,
    processed_at = now(),
    stripe_refund_id = COALESCE(p_stripe_refund_id, stripe_refund_id),
    refunded_at = CASE WHEN p_stripe_refund_id IS NOT NULL THEN now() ELSE refunded_at END,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_refund_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: deny_refund_request
-- Updates refund request when denied by admin
CREATE OR REPLACE FUNCTION deny_refund_request(
  p_refund_id UUID,
  p_admin_user_id UUID,
  p_admin_notes TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE refund_requests
  SET 
    eligibility_status = 'denied',
    processed_by = p_admin_user_id,
    processed_at = now(),
    admin_notes = p_admin_notes,
    updated_at = now()
  WHERE id = p_refund_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_pending_refund_requests
-- Returns all pending refund requests for admin review
CREATE OR REPLACE FUNCTION get_pending_refund_requests()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  plan_type TEXT,
  amount DECIMAL,
  currency TEXT,
  days_since_purchase INTEGER,
  questions_completed INTEGER,
  mock_interviews_completed INTEGER,
  eligibility_status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.user_id,
    u.email::TEXT,
    r.plan_type,
    r.amount,
    r.currency,
    r.days_since_purchase,
    r.questions_completed,
    r.mock_interviews_completed,
    r.eligibility_status,
    r.reason,
    r.created_at
  FROM refund_requests r
  JOIN auth.users u ON r.user_id = u.id
  WHERE r.eligibility_status IN ('pending', 'eligible', 'not_eligible')
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION calculate_refund_eligibility(UUID, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_refund_request(UUID, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_refund_approval(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION deny_refund_request(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_refund_requests() TO authenticated, service_role;
