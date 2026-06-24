-- ============================================================================
-- AI Usage Tracking - Supabase-backed (NOT localStorage)
-- ============================================================================
-- Moves AI interview usage tracking from localStorage to Supabase
-- so it's enforced server-side and consistent across devices.
-- ============================================================================

-- ============================================================================
-- Table: ai_daily_usage
-- Tracks daily AI usage per user (replaces localStorage usage tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  total_turns INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one record per user per day
  UNIQUE(user_id, usage_date)
);

-- Comments
COMMENT ON TABLE ai_daily_usage IS 'Daily AI interview usage per user - authoritative source of truth for usage limits';
COMMENT ON COLUMN ai_daily_usage.sessions_count IS 'Number of AI interview sessions started today';
COMMENT ON COLUMN ai_daily_usage.total_turns IS 'Total Q&A turns used today across all sessions';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_user_date ON ai_daily_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_date ON ai_daily_usage(usage_date);

-- ============================================================================
-- Table: ai_session_tracking
-- Tracks individual AI interview sessions (optional detailed tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_session_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_ended_at TIMESTAMPTZ,
  turns_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  topic_id TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_session_tracking IS 'Individual AI interview session tracking for detailed analytics';

CREATE INDEX IF NOT EXISTS idx_ai_session_tracking_user ON ai_session_tracking(user_id, session_started_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE ai_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_session_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own daily usage" ON ai_daily_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON ai_session_tracking
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all usage (for server-side enforcement)
CREATE POLICY "Service role can manage daily usage" ON ai_daily_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage sessions" ON ai_session_tracking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view all usage (for support)
CREATE POLICY "Admins can view all daily usage" ON ai_daily_usage
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

CREATE POLICY "Admins can view all sessions" ON ai_session_tracking
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: get_or_create_daily_usage
-- Gets or creates today's usage record for a user
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  usage_date DATE,
  sessions_count INTEGER,
  total_turns INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_record RECORD;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_record
  FROM ai_daily_usage
  WHERE ai_daily_usage.user_id = p_user_id
    AND ai_daily_usage.usage_date = v_today;
  
  -- If not found, create it
  IF NOT FOUND THEN
    INSERT INTO ai_daily_usage (user_id, usage_date, sessions_count, total_turns)
    VALUES (p_user_id, v_today, 0, 0)
    RETURNING * INTO v_record;
  END IF;
  
  RETURN QUERY SELECT 
    v_record.id,
    v_record.user_id,
    v_record.usage_date,
    v_record.sessions_count,
    v_record.total_turns,
    v_record.created_at,
    v_record.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: record_ai_session_start
-- Records the start of an AI interview session
CREATE OR REPLACE FUNCTION record_ai_session_start(
  p_user_id UUID,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_topic_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_usage_record RECORD;
BEGIN
  -- Get or create today's usage record
  SELECT * INTO v_usage_record FROM get_or_create_daily_usage(p_user_id);
  
  -- Increment session count
  UPDATE ai_daily_usage
  SET sessions_count = sessions_count + 1,
      updated_at = now()
  WHERE id = v_usage_record.id;
  
  -- Create session record
  INSERT INTO ai_session_tracking (
    user_id,
    provider,
    model,
    topic_id
  ) VALUES (
    p_user_id,
    p_provider,
    p_model,
    p_topic_id
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: record_ai_turn
-- Records a turn (Q&A exchange) in the current session
CREATE OR REPLACE FUNCTION record_ai_turn(
  p_user_id UUID,
  p_session_id UUID,
  p_turn_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_usage_record RECORD;
BEGIN
  -- Get today's usage record
  SELECT * INTO v_usage_record
  FROM ai_daily_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Increment turn count in daily usage
  UPDATE ai_daily_usage
  SET total_turns = total_turns + p_turn_count,
      updated_at = now()
  WHERE id = v_usage_record.id;
  
  -- Update session turn count
  UPDATE ai_session_tracking
  SET turns_count = turns_count + p_turn_count
  WHERE id = p_session_id AND user_id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: check_ai_usage_limits
-- Checks if user is within AI usage limits ( authoritative enforcement )
CREATE OR REPLACE FUNCTION check_ai_usage_limits(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  plan_type TEXT,
  max_sessions_per_day INTEGER,
  max_turns_per_session INTEGER,
  sessions_used_today INTEGER,
  turns_used_today INTEGER,
  sessions_remaining INTEGER,
  turns_remaining INTEGER
) AS $$
DECLARE
  v_plan_type TEXT;
  v_max_sessions INTEGER;
  v_max_turns INTEGER;
  v_usage_record RECORD;
  v_has_access BOOLEAN;
BEGIN
  -- Get user's effective subscription
  SELECT 
    plan_type,
    has_access
  INTO 
    v_plan_type,
    v_has_access
  FROM get_effective_subscription(p_user_id);
  
  -- Default to trial if no subscription
  IF v_plan_type IS NULL THEN
    v_plan_type := 'trial';
    v_has_access := true;
  END IF;
  
  -- Get plan limits from configuration
  -- (These should match PLAN_CONFIG in the app)
  SELECT 
    CASE v_plan_type
      WHEN 'trial' THEN 1
      WHEN 'interviewPass' THEN 5
      WHEN 'monthly' THEN 5
      WHEN 'lifetime' THEN 10
      ELSE 1
    END,
    CASE v_plan_type
      WHEN 'trial' THEN 5
      WHEN 'interviewPass' THEN 20
      WHEN 'monthly' THEN 20
      WHEN 'lifetime' THEN 50
      ELSE 5
    END
  INTO v_max_sessions, v_max_turns;
  
  -- Get today's usage
  SELECT * INTO v_usage_record
  FROM get_or_create_daily_usage(p_user_id);
  
  -- Check if user has access at all
  IF NOT v_has_access THEN
    RETURN QUERY SELECT 
      false,
      'Your subscription has expired. Please upgrade to continue.',
      v_plan_type,
      v_max_sessions,
      v_max_turns,
      v_usage_record.sessions_count,
      v_usage_record.total_turns,
      0,
      0;
    RETURN;
  END IF;
  
  -- Check daily Robin chat limit
  IF v_usage_record.total_turns >= v_max_turns THEN
    RETURN QUERY SELECT 
      false,
      format('Daily Robin chat limit reached (%s per day)', v_max_turns),
      v_plan_type,
      v_max_sessions,
      v_max_turns,
      v_usage_record.sessions_count,
      v_usage_record.total_turns,
      GREATEST(0, v_max_sessions - v_usage_record.sessions_count),
      0;
    RETURN;
  END IF;
  
  -- User is within limits
  RETURN QUERY SELECT 
    true,
    NULL::TEXT,
    v_plan_type,
    v_max_sessions,
    v_max_turns,
    v_usage_record.sessions_count,
    v_usage_record.total_turns,
    GREATEST(0, v_max_sessions - v_usage_record.sessions_count),
    GREATEST(0, v_max_turns - v_usage_record.total_turns);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_user_ai_usage_summary
-- Gets AI usage summary for admin/support
CREATE OR REPLACE FUNCTION get_user_ai_usage_summary(p_user_id UUID)
RETURNS TABLE (
  total_sessions_all_time BIGINT,
  total_turns_all_time BIGINT,
  sessions_today INTEGER,
  turns_today INTEGER,
  last_session_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT COUNT(*) FROM ai_session_tracking WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(total_turns) FROM ai_daily_usage WHERE user_id = p_user_id), 0),
    COALESCE((SELECT sessions_count FROM ai_daily_usage WHERE user_id = p_user_id AND usage_date = CURRENT_DATE), 0),
    COALESCE((SELECT total_turns FROM ai_daily_usage WHERE user_id = p_user_id AND usage_date = CURRENT_DATE), 0),
    (SELECT MAX(session_started_at) FROM ai_session_tracking WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_or_create_daily_usage(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_session_start(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_turn(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_ai_usage_limits(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_ai_usage_summary(UUID) TO authenticated, service_role;
