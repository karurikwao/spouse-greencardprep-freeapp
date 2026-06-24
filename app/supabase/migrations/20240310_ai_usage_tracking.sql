-- ============================================================================
-- AI Usage Tracking Tables
-- 
-- Server-side enforcement of AI plan limits and usage tracking
-- ============================================================================

-- ============================================================================
-- Table: ai_interview_sessions
-- Tracks active AI interview sessions with plan enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial',
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'standard',
  turn_count INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for session queries
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_status ON ai_interview_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_started_at ON ai_interview_sessions(started_at);

-- RLS policies for sessions
ALTER TABLE ai_interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON ai_interview_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON ai_interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON ai_interview_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- Table: ai_interview_turns
-- Records individual AI interview turns
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_interview_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_interview_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT,
  turn_number INTEGER NOT NULL,
  ai_question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  feedback_label TEXT NOT NULL,
  feedback_summary TEXT NOT NULL,
  follow_up_question TEXT,
  suggested_review_topics JSONB DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  latency_ms INTEGER,
  token_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for turn queries
CREATE INDEX IF NOT EXISTS idx_ai_turns_session_id ON ai_interview_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_turns_user_id ON ai_interview_turns(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_turns_created_at ON ai_interview_turns(created_at);

-- RLS policies for turns
ALTER TABLE ai_interview_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own turns"
  ON ai_interview_turns FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own turns"
  ON ai_interview_turns FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Table: user_subscriptions
-- Server-side subscription status for plan enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial' CHECK (plan_type IN ('trial', 'monthly', 'lifetime', 'interviewPass')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'expired', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  pass_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies for subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role or triggers can modify subscriptions
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Function: get_daily_session_count
-- Returns the number of AI sessions started by a user today
-- ============================================================================
CREATE OR REPLACE FUNCTION get_daily_session_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM ai_interview_sessions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND started_at >= CURRENT_DATE
      AND started_at < CURRENT_DATE + INTERVAL '1 day'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_or_create_subscription
-- Gets or creates a subscription record for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_subscription(p_user_id UUID)
RETURNS user_subscriptions AS $$
DECLARE
  v_subscription user_subscriptions;
BEGIN
  -- Try to get existing subscription
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  -- If not found, create trial subscription
  IF NOT FOUND THEN
    INSERT INTO user_subscriptions (
      user_id,
      plan_type,
      status,
      trial_ends_at
    ) VALUES (
      p_user_id,
      'trial',
      'trialing',
      now() + INTERVAL '7 days'
    )
    RETURNING * INTO v_subscription;
  END IF;
  
  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: update_subscription_on_signup
-- Auto-creates trial subscription for new users
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
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
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create subscription on signup (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_subscription'
  ) THEN
    CREATE TRIGGER on_auth_user_created_subscription
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION handle_new_user_subscription();
  END IF;
END
$$;

-- ============================================================================
-- Plan Configuration (for server-side reference)
-- This mirrors the client-side PLAN_CONFIG for server-side enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_config (
  plan_type TEXT PRIMARY KEY CHECK (plan_type IN ('trial', 'monthly', 'lifetime', 'interviewPass')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  max_turns_per_session INTEGER NOT NULL DEFAULT 5,
  max_sessions_per_day INTEGER NOT NULL DEFAULT 1,
  can_use_ai BOOLEAN NOT NULL DEFAULT true,
  can_choose_provider BOOLEAN NOT NULL DEFAULT false,
  can_choose_model BOOLEAN NOT NULL DEFAULT false,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default plan configurations
INSERT INTO plan_config (
  plan_type, name, description, 
  max_turns_per_session, max_sessions_per_day,
  can_use_ai, can_choose_provider, can_choose_model
) VALUES 
  ('trial', 'Free Trial', '7-day free trial with limited AI access', 5, 1, true, false, false),
  ('monthly', 'Premium Monthly', 'Full access with 20 daily Robin chats', 20, 1, true, true, true),
  ('lifetime', 'Lifetime Access', 'Full access forever with 30 daily Robin chats', 30, 1, true, true, true),
  ('interviewPass', '90-Day Interview Pass', 'Full access for 90 days with 20 daily Robin chats', 20, 1, true, true, true)
ON CONFLICT (plan_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_turns_per_session = EXCLUDED.max_turns_per_session,
  max_sessions_per_day = EXCLUDED.max_sessions_per_day,
  can_use_ai = EXCLUDED.can_use_ai,
  can_choose_provider = EXCLUDED.can_choose_provider,
  can_choose_model = EXCLUDED.can_choose_model,
  updated_at = now();

-- Allow service role to manage plan config
ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan config"
  ON plan_config FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage plan config"
  ON plan_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
