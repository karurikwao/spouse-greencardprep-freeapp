-- ============================================================================
-- INTERVIEWREADY MASTER SETUP SQL - FRESH INSTALL (CORRECTED)
-- ============================================================================
-- For: Brand new Supabase projects
-- Created: 2026-03-15 (Corrected)
-- 
-- IMPORTANT FOR NON-CODERS:
-- 1. This file is for NEW Supabase projects only
-- 2. Run this in the Supabase SQL Editor
-- 3. After SQL setup, you STILL need to:
--    - Deploy Edge Functions
--    - Create Storage buckets and upload PDFs
--    - Configure OAuth providers (Google login)
--    - Set environment variables
--
-- CORRECTIONS MADE:
-- - Fixed PDF download event statuses to match app
-- - Added missing AI write functions (record_ai_session_start, record_ai_turn)
-- - Fixed user_profiles RLS recursion issue
-- - Added complete broadcast message functions
--
-- WARNING: Do NOT run on existing projects - use PATCH_EXISTING_TO_CURRENT.sql instead
--
-- FREE-APP CONVERSION NOTE (2026-06-25):
-- This setup file still contains legacy paid-plan, refund-request, and
-- support-ticket compatibility schema so older database snapshots can be read.
-- Do not treat user_subscriptions monthly/lifetime/interviewPass plans,
-- refund_requests, support_tickets, or create_or_update_subscription as active
-- free-app product flows. The Flask API retires those workflows and only keeps
-- optional Robin credit purchases plus sponsor/ad controls active.
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS AND HELPERS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 2: USER PROFILES AND ADMIN ROLES (RECURSION-FIXED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  referral_code TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

COMMENT ON TABLE user_profiles IS 'Extended user profile data linked to auth.users';

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view/update own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin helper function (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND role IN ('admin', 'superadmin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superadmin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND role = 'superadmin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies using helper functions (non-recursive)
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Superadmins can update any profile" ON user_profiles
  FOR ALL TO authenticated USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, email, first_name, last_name, display_name, referral_code, role, is_active)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name',
    COALESCE(NULLIF(CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name'), ' '), NEW.email),
    NEW.raw_user_meta_data->>'promo_code', 'user', true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();

-- Email sync trigger
CREATE OR REPLACE FUNCTION update_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN UPDATE user_profiles SET email = NEW.email, updated_at = now() WHERE user_id = NEW.id; RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION update_user_profile_email();

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for admin check
CREATE OR REPLACE VIEW user_profiles_with_admin_check AS
SELECT up.*, is_admin(up.user_id) as is_admin_flag, is_superadmin(up.user_id) as is_superadmin_flag FROM user_profiles up;

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN IF p_user_id != auth.uid() AND NOT is_superadmin() THEN RETURN false; END IF;
UPDATE user_profiles SET is_active = false, updated_at = now() WHERE user_id = p_user_id; RETURN true; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- ============================================================================
-- SECTION 3: SUBSCRIPTIONS AND ENTITLEMENTS
-- ============================================================================

-- LEGACY PAID-APP COMPATIBILITY ONLY.
-- The free app does not sell core subscriptions. Keep this block only when
-- migrating an older paid-app database; exclude it from fresh free-app setup
-- unless a compatibility read path explicitly needs historical plan rows.
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial' CHECK (plan_type IN ('trial', 'monthly', 'lifetime', 'interviewPass')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'canceled', 'expired', 'past_due', 'grace_period', 'inactive')),
  provider TEXT DEFAULT 'internal',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_starts_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  payment_failed_at TIMESTAMPTZ,
  payment_failure_count INTEGER DEFAULT 0,
  lifetime_granted_at TIMESTAMPTZ,
  interview_pass_ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider ON user_subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_ends_at ON user_subscriptions(ends_at);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON user_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Plan config
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

ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view plan config" ON plan_config FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Service role can manage plan config" ON plan_config FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO plan_config (plan_type, name, description, max_turns_per_session, max_sessions_per_day, can_use_ai, can_choose_provider, can_choose_model)
VALUES 
  ('trial', 'Free Trial', '7-day free trial with limited AI access', 5, 1, true, false, false),
  ('monthly', 'Premium Monthly', 'Full access with 20 daily Robin chats', 20, 1, true, true, true),
  ('lifetime', 'Lifetime Access', 'Full access forever with 30 daily Robin chats', 30, 1, true, true, true),
  ('interviewPass', '90-Day Interview Pass', 'Full access for 90 days with 20 daily Robin chats', 20, 1, true, true, true)
ON CONFLICT (plan_type) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  max_turns_per_session = EXCLUDED.max_turns_per_session, max_sessions_per_day = EXCLUDED.max_sessions_per_day,
  can_use_ai = EXCLUDED.can_use_ai, can_choose_provider = EXCLUDED.can_choose_provider,
  can_choose_model = EXCLUDED.can_choose_model, updated_at = now();

-- Subscription functions
CREATE OR REPLACE FUNCTION get_effective_subscription(p_user_id UUID)
RETURNS TABLE (user_id UUID, plan_type TEXT, status TEXT, effective_status TEXT, provider TEXT, trial_starts_at TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ, current_period_starts_at TIMESTAMPTZ, current_period_ends_at TIMESTAMPTZ, canceled_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, grace_period_ends_at TIMESTAMPTZ, interview_pass_ends_at TIMESTAMPTZ, lifetime_granted_at TIMESTAMPTZ, has_access BOOLEAN, access_ends_at TIMESTAMPTZ, days_remaining INTEGER) AS $$
DECLARE v_now TIMESTAMPTZ := now(); v_sub RECORD; v_effective_status TEXT; v_has_access BOOLEAN := false; v_access_ends_at TIMESTAMPTZ; v_days_remaining INTEGER;
BEGIN
  SELECT * INTO v_sub FROM user_subscriptions WHERE user_subscriptions.user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_effective_status := v_sub.status;
  IF v_sub.status = 'trialing' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at < v_now THEN v_effective_status := 'expired'; END IF;
  IF v_sub.plan_type = 'interviewPass' AND v_sub.interview_pass_ends_at IS NOT NULL AND v_sub.interview_pass_ends_at < v_now THEN v_effective_status := 'expired'; END IF;
  IF v_sub.status = 'grace_period' AND v_sub.grace_period_ends_at IS NOT NULL AND v_sub.grace_period_ends_at < v_now THEN v_effective_status := 'expired'; END IF;
  IF v_sub.status = 'canceled' AND v_sub.current_period_ends_at IS NOT NULL AND v_sub.current_period_ends_at < v_now THEN v_effective_status := 'expired'; END IF;
  v_has_access := v_effective_status IN ('trialing', 'active', 'grace_period');
  IF v_sub.status = 'canceled' AND v_sub.current_period_ends_at > v_now THEN v_has_access := true; END IF;
  v_access_ends_at := COALESCE(v_sub.ends_at, v_sub.current_period_ends_at, v_sub.trial_ends_at, v_sub.interview_pass_ends_at, v_sub.grace_period_ends_at);
  IF v_sub.plan_type = 'lifetime' AND v_effective_status = 'active' THEN v_access_ends_at := NULL; END IF;
  IF v_access_ends_at IS NOT NULL THEN v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_access_ends_at - v_now))::INTEGER); ELSE v_days_remaining := NULL; END IF;
  RETURN QUERY SELECT v_sub.user_id, v_sub.plan_type, v_sub.status, v_effective_status, v_sub.provider, v_sub.trial_starts_at, v_sub.trial_ends_at, v_sub.current_period_starts_at, v_sub.current_period_ends_at, v_sub.canceled_at, v_sub.ends_at, v_sub.grace_period_ends_at, v_sub.interview_pass_ends_at, v_sub.lifetime_granted_at, v_has_access, v_access_ends_at, v_days_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_sub RECORD;
BEGIN SELECT * INTO v_sub FROM get_effective_subscription(p_user_id); IF NOT FOUND THEN RETURN false; END IF; RETURN v_sub.has_access AND v_sub.plan_type IN ('monthly', 'lifetime', 'interviewPass'); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_or_update_subscription(p_user_id UUID, p_plan_type TEXT, p_status TEXT DEFAULT 'active', p_provider TEXT DEFAULT 'internal', p_provider_customer_id TEXT DEFAULT NULL, p_provider_subscription_id TEXT DEFAULT NULL, p_trial_ends_at TIMESTAMPTZ DEFAULT NULL, p_current_period_ends_at TIMESTAMPTZ DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS user_subscriptions AS $$
DECLARE v_sub user_subscriptions; v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO user_subscriptions (user_id, plan_type, status, provider, provider_customer_id, provider_subscription_id, trial_starts_at, trial_ends_at, current_period_starts_at, current_period_ends_at, lifetime_granted_at, interview_pass_ends_at, metadata, created_at, updated_at)
  VALUES (p_user_id, p_plan_type, p_status, p_provider, p_provider_customer_id, p_provider_subscription_id, CASE WHEN p_status = 'trialing' THEN v_now ELSE NULL END, p_trial_ends_at, CASE WHEN p_status = 'active' THEN v_now ELSE NULL END, p_current_period_ends_at, CASE WHEN p_plan_type = 'lifetime' THEN v_now ELSE NULL END, CASE WHEN p_plan_type = 'interviewPass' THEN p_current_period_ends_at ELSE NULL END, p_metadata, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE SET plan_type = EXCLUDED.plan_type, status = EXCLUDED.status, provider = EXCLUDED.provider, provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, user_subscriptions.provider_customer_id), provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, user_subscriptions.provider_subscription_id), trial_starts_at = COALESCE(EXCLUDED.trial_starts_at, user_subscriptions.trial_starts_at), trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, user_subscriptions.trial_ends_at), current_period_starts_at = COALESCE(EXCLUDED.current_period_starts_at, user_subscriptions.current_period_starts_at), current_period_ends_at = COALESCE(EXCLUDED.current_period_ends_at, user_subscriptions.current_period_ends_at), lifetime_granted_at = COALESCE(EXCLUDED.lifetime_granted_at, user_subscriptions.lifetime_granted_at), interview_pass_ends_at = COALESCE(EXCLUDED.interview_pass_ends_at, user_subscriptions.interview_pass_ends_at), metadata = user_subscriptions.metadata || EXCLUDED.metadata, updated_at = v_now RETURNING * INTO v_sub;
  RETURN v_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create trial subscription on signup
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, plan_type, status, trial_ends_at) VALUES (NEW.id, 'trial', 'trialing', now() + INTERVAL '7 days') ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_subscription();

GRANT EXECUTE ON FUNCTION get_effective_subscription(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION has_premium_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_or_update_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO service_role;


-- ============================================================================
-- SECTION 4: USER PROGRESS TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questions_practiced INTEGER DEFAULT 0,
  ai_turns INTEGER DEFAULT 0,
  readiness_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date DATE,
  topic_progress JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_progress UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_progress_select_policy ON user_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_progress_insert_policy ON user_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_progress_update_policy ON user_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS trigger_update_user_progress_updated_at ON user_progress;
CREATE TRIGGER trigger_update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 5: AI USAGE TRACKING (WITH WRITE FUNCTIONS)
-- ============================================================================

-- Legacy AI sessions/turns
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
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_interview_sessions(user_id);
ALTER TABLE ai_interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON ai_interview_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sessions" ON ai_interview_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

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
CREATE INDEX IF NOT EXISTS idx_ai_turns_session_id ON ai_interview_turns(session_id);
ALTER TABLE ai_interview_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own turns" ON ai_interview_turns FOR SELECT TO authenticated USING (user_id = auth.uid());

-- New Supabase-backed daily usage tracking
CREATE TABLE IF NOT EXISTS ai_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  total_turns INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_user_date ON ai_daily_usage(user_id, usage_date);

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
CREATE INDEX IF NOT EXISTS idx_ai_session_tracking_user ON ai_session_tracking(user_id, session_started_at DESC);

ALTER TABLE ai_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_session_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily usage" ON ai_daily_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view own sessions" ON ai_session_tracking FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can manage daily usage" ON ai_daily_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage sessions" ON ai_session_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view all daily usage" ON ai_daily_usage FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can view all sessions" ON ai_session_tracking FOR SELECT TO authenticated USING (is_admin());

-- AI Usage Functions (including WRITE functions)
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(p_user_id UUID)
RETURNS TABLE (id UUID, user_id UUID, usage_date DATE, sessions_count INTEGER, total_turns INTEGER, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ) AS $$
DECLARE v_today DATE := CURRENT_DATE; v_record RECORD;
BEGIN
  SELECT * INTO v_record FROM ai_daily_usage WHERE ai_daily_usage.user_id = p_user_id AND ai_daily_usage.usage_date = v_today;
  IF NOT FOUND THEN
    INSERT INTO ai_daily_usage (user_id, usage_date, sessions_count, total_turns) VALUES (p_user_id, v_today, 0, 0) RETURNING * INTO v_record;
  END IF;
  RETURN QUERY SELECT v_record.id, v_record.user_id, v_record.usage_date, v_record.sessions_count, v_record.total_turns, v_record.created_at, v_record.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MISSING FUNCTION ADDED: record_ai_session_start
CREATE OR REPLACE FUNCTION record_ai_session_start(p_user_id UUID, p_provider TEXT DEFAULT NULL, p_model TEXT DEFAULT NULL, p_topic_id TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_session_id UUID; v_usage_record RECORD;
BEGIN
  SELECT * INTO v_usage_record FROM get_or_create_daily_usage(p_user_id);
  UPDATE ai_daily_usage SET sessions_count = sessions_count + 1, updated_at = now() WHERE id = v_usage_record.id;
  INSERT INTO ai_session_tracking (user_id, provider, model, topic_id) VALUES (p_user_id, p_provider, p_model, p_topic_id) RETURNING id INTO v_session_id;
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MISSING FUNCTION ADDED: record_ai_turn
CREATE OR REPLACE FUNCTION record_ai_turn(p_user_id UUID, p_session_id UUID, p_turn_count INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE v_usage_record RECORD;
BEGIN
  SELECT * INTO v_usage_record FROM ai_daily_usage WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE ai_daily_usage SET total_turns = total_turns + p_turn_count, updated_at = now() WHERE id = v_usage_record.id;
  UPDATE ai_session_tracking SET turns_count = turns_count + p_turn_count WHERE id = p_session_id AND user_id = p_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_ai_usage_limits(p_user_id UUID)
RETURNS TABLE (allowed BOOLEAN, reason TEXT, plan_type TEXT, max_sessions_per_day INTEGER, max_turns_per_session INTEGER, sessions_used_today INTEGER, turns_used_today INTEGER, sessions_remaining INTEGER, turns_remaining INTEGER) AS $$
DECLARE v_plan_type TEXT; v_max_sessions INTEGER; v_max_turns INTEGER; v_usage_record RECORD; v_has_access BOOLEAN;
BEGIN
  SELECT plan_type, has_access INTO v_plan_type, v_has_access FROM get_effective_subscription(p_user_id);
  IF v_plan_type IS NULL THEN v_plan_type := 'trial'; v_has_access := true; END IF;
  SELECT 1,
         CASE v_plan_type WHEN 'trial' THEN 5 WHEN 'interviewPass' THEN 20 WHEN 'monthly' THEN 20 WHEN 'lifetime' THEN 30 ELSE 5 END
  INTO v_max_sessions, v_max_turns;
  SELECT * INTO v_usage_record FROM get_or_create_daily_usage(p_user_id);
  IF NOT v_has_access THEN RETURN QUERY SELECT false, 'Your subscription has expired. Please upgrade to continue.'::TEXT, v_plan_type, v_max_sessions, v_max_turns, v_usage_record.sessions_count, v_usage_record.total_turns, 0, 0; RETURN; END IF;
  IF v_usage_record.total_turns >= v_max_turns THEN RETURN QUERY SELECT false, format('Daily Robin chat limit reached (%s per day)', v_max_turns)::TEXT, v_plan_type, v_max_sessions, v_max_turns, v_usage_record.sessions_count, v_usage_record.total_turns, GREATEST(0, v_max_sessions - v_usage_record.sessions_count), 0; RETURN; END IF;
  RETURN QUERY SELECT true, NULL::TEXT, v_plan_type, v_max_sessions, v_max_turns, v_usage_record.sessions_count, v_usage_record.total_turns, GREATEST(0, v_max_sessions - v_usage_record.sessions_count), GREATEST(0, v_max_turns - v_usage_record.total_turns);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_or_create_daily_usage(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_session_start(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_turn(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_ai_usage_limits(UUID) TO authenticated, service_role;


-- ============================================================================
-- SECTION 6: SECURE PDF STORAGE AND DOWNLOAD TRACKING (STATUSES CORRECTED)
-- ============================================================================

-- Storage bucket creation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('premium-pdfs', 'premium-pdfs', false) ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;
END $$;

-- PDF Assets Registry
CREATE TABLE IF NOT EXISTS pdf_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  topic_id TEXT,
  category_id TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT true,
  is_public_sample BOOLEAN DEFAULT false,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT DEFAULT 'application/pdf',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_assets_topic_id ON pdf_assets(topic_id);
CREATE INDEX IF NOT EXISTS idx_pdf_assets_is_premium ON pdf_assets(is_premium);
ALTER TABLE pdf_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pdf_assets metadata" ON pdf_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Only service role can modify pdf_assets" ON pdf_assets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PDF Download Tracking (CORRECTED STATUSES - includes 'access_granted' and 'denied')
CREATE TABLE IF NOT EXISTS pdf_download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  pdf_filename TEXT NOT NULL,
  pdf_title TEXT,
  topic_id TEXT,
  category_id TEXT,
  download_source TEXT DEFAULT 'topic_page',
  -- CORRECTED: Now includes all statuses used by the app
  event_status TEXT NOT NULL DEFAULT 'requested' CHECK (event_status IN ('requested', 'access_granted', 'denied', 'served', 'completed_estimated')),
  delivery_method TEXT DEFAULT 'signed_url' CHECK (delivery_method IN ('signed_url', 'direct', 'public')),
  access_granted BOOLEAN DEFAULT true,
  session_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_user_id ON pdf_download_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_created_at ON pdf_download_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_pdf_filename ON pdf_download_events(pdf_filename);

CREATE TABLE IF NOT EXISTS pdf_download_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_downloads INTEGER NOT NULL DEFAULT 0,
  unique_pdfs_downloaded INTEGER NOT NULL DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  has_downloaded BOOLEAN NOT NULL DEFAULT false,
  review_flag TEXT DEFAULT 'no_downloads' CHECK (review_flag IN ('no_downloads', 'downloaded_once', 'downloaded_multiple', 'heavy_usage')),
  review_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_download_summaries_user_id ON pdf_download_summaries(user_id);

ALTER TABLE pdf_download_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_download_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own download events" ON pdf_download_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can manage download events" ON pdf_download_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view all download events" ON pdf_download_events FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Service role can manage summaries" ON pdf_download_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view all summaries" ON pdf_download_summaries FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Users can view own summary" ON pdf_download_summaries FOR SELECT TO authenticated USING (user_id = auth.uid());

-- PDF Functions
CREATE OR REPLACE FUNCTION update_pdf_download_summary(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_total_downloads INTEGER; v_unique_pdfs INTEGER; v_first_download TIMESTAMPTZ; v_last_download TIMESTAMPTZ; v_has_downloaded BOOLEAN; v_review_flag TEXT; v_review_note TEXT;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT pdf_filename), MIN(created_at), MAX(created_at) INTO v_total_downloads, v_unique_pdfs, v_first_download, v_last_download FROM pdf_download_events WHERE user_id = p_user_id;
  v_has_downloaded := v_total_downloads > 0;
  IF v_total_downloads = 0 THEN v_review_flag := 'no_downloads'; v_review_note := 'No PDF download activity recorded for this user.';
  ELSIF v_total_downloads = 1 THEN v_review_flag := 'downloaded_once'; v_review_note := 'Downloaded one PDF. Limited content access before refund request.';
  ELSIF v_total_downloads <= 5 THEN v_review_flag := 'downloaded_multiple'; v_review_note := 'Downloaded multiple PDFs. Moderate content access before refund request.';
  ELSE v_review_flag := 'heavy_usage'; v_review_note := 'Downloaded many PDFs. Significant content access before refund request.';
  END IF;
  INSERT INTO pdf_download_summaries (user_id, total_downloads, unique_pdfs_downloaded, first_download_at, last_download_at, has_downloaded, review_flag, review_note, updated_at)
  VALUES (p_user_id, v_total_downloads, v_unique_pdfs, v_first_download, v_last_download, v_has_downloaded, v_review_flag, v_review_note, now())
  ON CONFLICT (user_id) DO UPDATE SET total_downloads = EXCLUDED.total_downloads, unique_pdfs_downloaded = EXCLUDED.unique_pdfs_downloaded, first_download_at = EXCLUDED.first_download_at, last_download_at = EXCLUDED.last_download_at, has_downloaded = EXCLUDED.has_downloaded, review_flag = EXCLUDED.review_flag, review_note = EXCLUDED.review_note, updated_at = EXCLUDED.updated_at;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_pdf_download(p_user_id UUID, p_user_email TEXT, p_pdf_filename TEXT, p_pdf_title TEXT DEFAULT NULL, p_topic_id TEXT DEFAULT NULL, p_category_id TEXT DEFAULT NULL, p_download_source TEXT DEFAULT 'topic_page', p_event_status TEXT DEFAULT 'requested', p_session_hash TEXT DEFAULT NULL, p_user_agent_hash TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_event_id UUID;
BEGIN
  INSERT INTO pdf_download_events (user_id, user_email, pdf_filename, pdf_title, topic_id, category_id, download_source, event_status, session_hash, user_agent_hash)
  VALUES (p_user_id, p_user_email, p_pdf_filename, p_pdf_title, p_topic_id, p_category_id, p_download_source, p_event_status, p_session_hash, p_user_agent_hash)
  RETURNING id INTO v_event_id;
  PERFORM update_pdf_download_summary(p_user_id);
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_download_summary(p_user_id UUID)
RETURNS TABLE (total_downloads INTEGER, unique_pdfs_downloaded INTEGER, first_download_at TIMESTAMPTZ, last_download_at TIMESTAMPTZ, has_downloaded BOOLEAN, review_flag TEXT, review_note TEXT) AS $$
BEGIN PERFORM update_pdf_download_summary(p_user_id); RETURN QUERY SELECT ds.total_downloads, ds.unique_pdfs_downloaded, ds.first_download_at, ds.last_download_at, ds.has_downloaded, ds.review_flag, ds.review_note FROM pdf_download_summaries ds WHERE ds.user_id = p_user_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pdf_download_url(p_user_id UUID, p_file_key TEXT, p_expiry_seconds INTEGER DEFAULT 300)
RETURNS TABLE (success BOOLEAN, signed_url TEXT, error TEXT) AS $$
DECLARE v_has_premium BOOLEAN; v_pdf_record RECORD;
BEGIN
  SELECT * INTO v_pdf_record FROM pdf_assets WHERE file_key = p_file_key;
  IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::TEXT, 'PDF not found'::TEXT; RETURN; END IF;
  IF v_pdf_record.is_public_sample THEN RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT; RETURN; END IF;
  SELECT has_premium_access(p_user_id) INTO v_has_premium;
  IF NOT v_has_premium THEN RETURN QUERY SELECT false, NULL::TEXT, 'Premium access required'::TEXT; RETURN; END IF;
  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update trigger for summaries
CREATE OR REPLACE FUNCTION trigger_update_pdf_download_summary()
RETURNS TRIGGER AS $$ BEGIN PERFORM update_pdf_download_summary(NEW.user_id); RETURN NEW; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_update_pdf_summary ON pdf_download_events;
CREATE TRIGGER trg_update_pdf_summary AFTER INSERT ON pdf_download_events FOR EACH ROW EXECUTE FUNCTION trigger_update_pdf_download_summary();

GRANT EXECUTE ON FUNCTION record_pdf_download(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_download_summary(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_pdf_download_url(UUID, TEXT, INTEGER) TO authenticated, service_role;


-- ============================================================================
-- SECTION 7: CONTENT MANAGEMENT SYSTEM (POLICY NOTES ADDED)
-- ============================================================================

-- Site Announcements
CREATE TABLE IF NOT EXISTS site_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  announcement_type TEXT NOT NULL DEFAULT 'info' CHECK (announcement_type IN ('info', 'success', 'warning', 'update', 'promo')),
  placement TEXT NOT NULL DEFAULT 'global.banner' CHECK (placement IN ('global.banner', 'home.hero', 'home.trust', 'home.faq', 'pricing.top', 'pricing.after_comparison', 'dashboard.top', 'dashboard.sidebar', 'topics.detail', 'auth.login', 'auth.signup', 'account.top', 'checkout.info')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'anonymous', 'logged_in', 'trial', 'paid', 'expired', 'admin')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  priority INTEGER NOT NULL DEFAULT 0,
  is_dismissible BOOLEAN NOT NULL DEFAULT false,
  cta_text TEXT,
  cta_link TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_announcements_placement ON site_announcements(placement);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON site_announcements(status);

-- Trust Snippets
CREATE TABLE IF NOT EXISTS site_trust_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  icon_name TEXT DEFAULT 'Shield',
  placement TEXT NOT NULL DEFAULT 'home.trust' CHECK (placement IN ('home.trust', 'home.faq', 'pricing.top', 'pricing.after_comparison', 'dashboard.sidebar', 'auth.login', 'auth.signup', 'account.top', 'checkout.info', 'global.footer')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'anonymous', 'logged_in', 'trial', 'paid', 'expired')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  priority INTEGER NOT NULL DEFAULT 0,
  cta_text TEXT,
  cta_link TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_trust_snippets_placement ON site_trust_snippets(placement);
CREATE INDEX IF NOT EXISTS idx_trust_snippets_status ON site_trust_snippets(status);

-- Content Blocks
CREATE TABLE IF NOT EXISTS site_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  block_type TEXT NOT NULL DEFAULT 'info' CHECK (block_type IN ('info', 'faq', 'comparison', 'steps', 'warning', 'success', 'promo', 'note')),
  group_key TEXT,
  group_order INTEGER DEFAULT 0,
  placement TEXT NOT NULL DEFAULT 'home.faq' CHECK (placement IN ('home.hero', 'home.trust', 'home.faq', 'pricing.top', 'pricing.after_comparison', 'dashboard.top', 'dashboard.sidebar', 'topics.detail', 'account.top', 'checkout.info')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'anonymous', 'logged_in', 'trial', 'paid', 'expired')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  priority INTEGER NOT NULL DEFAULT 0,
  cta_text TEXT,
  cta_link TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_content_blocks_placement ON site_content_blocks(placement);
CREATE INDEX IF NOT EXISTS idx_content_blocks_status ON site_content_blocks(status);
CREATE INDEX IF NOT EXISTS idx_content_blocks_group ON site_content_blocks(group_key);

-- Enable RLS
ALTER TABLE site_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_trust_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content_blocks ENABLE ROW LEVEL SECURITY;

-- NOTE: Public table-level policies allow reading published rows.
-- The app uses RPC functions (get_active_announcements, etc.) for frontend access
-- which properly filter by starts_at, ends_at, and target_audience.
-- Admin access uses direct table access for CRUD operations.

-- Public can view published (apps should use RPC for proper filtering)
CREATE POLICY "Public can view published announcements" ON site_announcements FOR SELECT TO authenticated, anon USING (status = 'published');
CREATE POLICY "Public can view published trust snippets" ON site_trust_snippets FOR SELECT TO authenticated, anon USING (status = 'published');
CREATE POLICY "Public can view published content blocks" ON site_content_blocks FOR SELECT TO authenticated, anon USING (status = 'published');

-- Admins can manage all content
CREATE POLICY "Admins can manage announcements" ON site_announcements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can manage trust snippets" ON site_trust_snippets FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can manage content blocks" ON site_content_blocks FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Triggers
DROP TRIGGER IF EXISTS trigger_announcements_updated_at ON site_announcements;
CREATE TRIGGER trigger_announcements_updated_at BEFORE UPDATE ON site_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trigger_trust_snippets_updated_at ON site_trust_snippets;
CREATE TRIGGER trigger_trust_snippets_updated_at BEFORE UPDATE ON site_trust_snippets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trigger_content_blocks_updated_at ON site_content_blocks;
CREATE TRIGGER trigger_content_blocks_updated_at BEFORE UPDATE ON site_content_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Content Functions with Dismissal Support
CREATE OR REPLACE FUNCTION get_active_announcements(p_placement TEXT, p_user_id UUID DEFAULT NULL, p_user_role TEXT DEFAULT 'anonymous')
RETURNS TABLE (id UUID, title TEXT, body TEXT, announcement_type TEXT, is_dismissible BOOLEAN, cta_text TEXT, cta_link TEXT, priority INTEGER) AS $$
BEGIN RETURN QUERY SELECT a.id, a.title, a.body, a.announcement_type, a.is_dismissible, a.cta_text, a.cta_link, a.priority FROM site_announcements a WHERE a.status = 'published' AND a.placement = p_placement AND (a.starts_at IS NULL OR a.starts_at <= now()) AND (a.ends_at IS NULL OR a.ends_at >= now()) AND (a.target_audience = 'all' OR a.target_audience = p_user_role OR (a.target_audience = 'logged_in' AND p_user_role != 'anonymous') OR (a.target_audience = 'paid' AND p_user_role IN ('monthly', 'lifetime', 'interviewPass'))) AND (p_user_id IS NULL OR NOT a.is_dismissible OR a.id NOT IN (SELECT cd.content_id FROM content_dismissals cd WHERE cd.user_id = p_user_id AND cd.content_type = 'announcement')) ORDER BY a.priority DESC, a.created_at DESC; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_trust_snippets(p_placement TEXT, p_user_id UUID DEFAULT NULL, p_user_role TEXT DEFAULT 'anonymous')
RETURNS TABLE (id UUID, title TEXT, subtitle TEXT, icon_name TEXT, cta_text TEXT, cta_link TEXT, priority INTEGER) AS $$
BEGIN RETURN QUERY SELECT s.id, s.title, s.subtitle, s.icon_name, s.cta_text, s.cta_link, s.priority FROM site_trust_snippets s WHERE s.status = 'published' AND s.placement = p_placement AND (s.starts_at IS NULL OR s.starts_at <= now()) AND (s.ends_at IS NULL OR s.ends_at >= now()) AND (s.target_audience = 'all' OR s.target_audience = p_user_role OR (s.target_audience = 'logged_in' AND p_user_role != 'anonymous') OR (s.target_audience = 'paid' AND p_user_role IN ('monthly', 'lifetime', 'interviewPass'))) AND (p_user_id IS NULL OR s.id NOT IN (SELECT cd.content_id FROM content_dismissals cd WHERE cd.user_id = p_user_id AND cd.content_type = 'trust_snippet')) ORDER BY s.priority DESC, s.created_at DESC; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_content_blocks(p_placement TEXT, p_user_id UUID DEFAULT NULL, p_user_role TEXT DEFAULT 'anonymous', p_group_key TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, title TEXT, body TEXT, block_type TEXT, group_key TEXT, group_order INTEGER, cta_text TEXT, cta_link TEXT, priority INTEGER) AS $$
BEGIN RETURN QUERY SELECT b.id, b.title, b.body, b.block_type, b.group_key, b.group_order, b.cta_text, b.cta_link, b.priority FROM site_content_blocks b WHERE b.status = 'published' AND b.placement = p_placement AND (p_group_key IS NULL OR b.group_key = p_group_key) AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at >= now()) AND (b.target_audience = 'all' OR b.target_audience = p_user_role OR (b.target_audience = 'logged_in' AND p_user_role != 'anonymous') OR (b.target_audience = 'paid' AND p_user_role IN ('monthly', 'lifetime', 'interviewPass'))) AND (p_user_id IS NULL OR b.id NOT IN (SELECT cd.content_id FROM content_dismissals cd WHERE cd.user_id = p_user_id AND cd.content_type = 'content_block')) ORDER BY b.priority DESC, b.group_order ASC, b.created_at DESC; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON site_announcements TO authenticated, anon;
GRANT SELECT ON site_trust_snippets TO authenticated, anon;
GRANT SELECT ON site_content_blocks TO authenticated, anon;
GRANT ALL ON site_announcements TO service_role;
GRANT ALL ON site_trust_snippets TO service_role;
GRANT ALL ON site_content_blocks TO service_role;
GRANT EXECUTE ON FUNCTION get_active_announcements(TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_trust_snippets(TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_content_blocks(TEXT, UUID, TEXT, TEXT) TO authenticated, anon;


-- ============================================================================
-- SECTION 8: CONTENT DISMISSALS AND ANALYTICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('announcement', 'trust_snippet', 'content_block')),
  content_id UUID NOT NULL,
  placement TEXT,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_content_dismissal UNIQUE (user_id, content_type, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_dismissals_user ON content_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_content_dismissals_content ON content_dismissals(content_type, content_id);
ALTER TABLE content_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own dismissals" ON content_dismissals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own dismissals" ON content_dismissals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all dismissals" ON content_dismissals FOR SELECT TO authenticated USING (is_admin());

CREATE TABLE IF NOT EXISTS content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('announcement', 'trust_snippet', 'content_block')),
  content_id UUID NOT NULL,
  placement TEXT,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'dismiss', 'cta_click', 'expand')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content ON content_interactions(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON content_interactions(interaction_type);
ALTER TABLE content_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record interactions" ON content_interactions FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Admins can view analytics" ON content_interactions FOR SELECT TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION get_dismissed_content_ids(p_user_id UUID, p_content_type TEXT, p_placement TEXT DEFAULT NULL)
RETURNS UUID[] AS $$ BEGIN RETURN ARRAY(SELECT cd.content_id FROM content_dismissals cd WHERE cd.user_id = p_user_id AND cd.content_type = p_content_type AND (p_placement IS NULL OR cd.placement = p_placement)); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION dismiss_content(p_user_id UUID, p_content_type TEXT, p_content_id UUID, p_placement TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$ BEGIN INSERT INTO content_dismissals (user_id, content_type, content_id, placement) VALUES (p_user_id, p_content_type, p_content_id, p_placement) ON CONFLICT (user_id, content_type, content_id) DO NOTHING; INSERT INTO content_interactions (content_type, content_id, placement, interaction_type, user_id) VALUES (p_content_type, p_content_id, p_placement, 'dismiss', p_user_id); RETURN true; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_content_interaction(p_content_type TEXT, p_content_id UUID, p_interaction_type TEXT, p_placement TEXT DEFAULT NULL, p_user_id UUID DEFAULT NULL, p_session_id TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$ BEGIN INSERT INTO content_interactions (content_type, content_id, placement, interaction_type, user_id, session_id) VALUES (p_content_type, p_content_id, p_placement, p_interaction_type, p_user_id, p_session_id); RETURN true; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT, DELETE ON content_dismissals TO authenticated;
GRANT SELECT, INSERT ON content_interactions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dismissed_content_ids(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_content(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_content_interaction(TEXT, UUID, TEXT, TEXT, UUID, TEXT) TO authenticated, anon;

-- ============================================================================
-- SECTION 9: REFUND SYSTEM
-- ============================================================================
-- LEGACY PAID-APP COMPATIBILITY ONLY.
-- Refund workflows are retired in the free app. Keep this block only for
-- historical paid-app migrations; exclude from fresh free-app setup.
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  plan_type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  purchased_at TIMESTAMPTZ,
  days_since_purchase INTEGER DEFAULT 0,
  questions_completed INTEGER DEFAULT 0,
  mock_interviews_completed INTEGER DEFAULT 0,
  eligibility_status TEXT NOT NULL DEFAULT 'pending' CHECK (eligibility_status IN ('pending', 'eligible', 'not_eligible', 'approved', 'denied', 'refunded')),
  reason TEXT,
  additional_comments TEXT,
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  stripe_refund_id TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(eligibility_status);
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own refund requests" ON refund_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own refund requests" ON refund_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role can manage refund requests" ON refund_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view all refund requests" ON refund_requests FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can update refund requests" ON refund_requests FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION get_refund_request_with_download_summary()
RETURNS TABLE (refund_id UUID, user_id UUID, user_email TEXT, plan_type TEXT, amount DECIMAL, currency TEXT, days_since_purchase INTEGER, questions_completed INTEGER, mock_interviews_completed INTEGER, eligibility_status TEXT, reason TEXT, created_at TIMESTAMPTZ, total_pdf_downloads INTEGER, unique_pdfs_downloaded INTEGER, first_download_at TIMESTAMPTZ, last_download_at TIMESTAMPTZ, download_review_flag TEXT, download_review_note TEXT) AS $$
BEGIN RETURN QUERY SELECT r.id, r.user_id, u.email::TEXT, r.plan_type, r.amount, r.currency, r.days_since_purchase, r.questions_completed, r.mock_interviews_completed, r.eligibility_status, r.reason, r.created_at, COALESCE(ds.total_downloads, 0), COALESCE(ds.unique_pdfs_downloaded, 0), ds.first_download_at, ds.last_download_at, COALESCE(ds.review_flag, 'no_downloads'), COALESCE(ds.review_note, 'No PDF download activity recorded.') FROM refund_requests r JOIN auth.users u ON r.user_id = u.id LEFT JOIN pdf_download_summaries ds ON r.user_id = ds.user_id WHERE r.eligibility_status IN ('pending', 'eligible', 'not_eligible') ORDER BY r.created_at DESC; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_refund_request_with_download_summary() TO authenticated, service_role;

-- ============================================================================
-- SECTION 10: NOTIFICATIONS, BROADCASTS, AND SUPPORT TICKETS (COMPLETE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'refund', 'subscription', 'support', 'milestone', 'broadcast')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read ON user_notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all_users' CHECK (audience_type IN ('all_users', 'trial_users', 'premium_users', 'expired_users', 'free_users')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sent_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_is_active ON broadcast_messages(is_active);

-- LEGACY PAID-APP COMPATIBILITY ONLY.
-- Ticket/refund/retention support workflows are retired in the free app.
-- Current user messaging should use notifications/broadcasts instead.
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('billing', 'technical', 'account', 'feature_request', 'other')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  admin_reply TEXT,
  replied_by UUID REFERENCES auth.users(id),
  replied_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON user_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can manage notifications" ON user_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view all notifications" ON user_notifications FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Users can view active broadcasts" ON broadcast_messages FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage broadcasts" ON broadcast_messages FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Service role can manage broadcasts" ON broadcast_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view and manage all tickets" ON support_tickets FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Service role can manage tickets" ON support_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Notification Functions (COMPLETE)
CREATE OR REPLACE FUNCTION create_user_notification(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_action_url TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID AS $$
DECLARE v_notification_id UUID;
BEGIN INSERT INTO user_notifications (user_id, type, title, message, action_url, metadata) VALUES (p_user_id, p_type, p_title, p_message, p_action_url, p_metadata) RETURNING id INTO v_notification_id; RETURN v_notification_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN UPDATE user_notifications SET is_read = true, updated_at = now() WHERE id = p_notification_id AND user_id = auth.uid(); RETURN FOUND; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN SELECT COUNT(*) INTO v_count FROM user_notifications WHERE user_id = auth.uid() AND is_read = false; RETURN v_count; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_support_ticket(p_user_id UUID, p_subject TEXT, p_category TEXT, p_message TEXT)
RETURNS UUID AS $$
DECLARE v_ticket_id UUID;
BEGIN INSERT INTO support_tickets (user_id, subject, category, message) VALUES (p_user_id, p_subject, p_category, p_message) RETURNING id INTO v_ticket_id;
PERFORM create_user_notification(p_user_id, 'support', 'Support Ticket Created', 'Your support ticket "' || p_subject || '" has been submitted. We''ll respond soon.', NULL, jsonb_build_object('ticket_id', v_ticket_id));
RETURN v_ticket_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reply_to_support_ticket(p_ticket_id UUID, p_admin_user_id UUID, p_reply TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_user_id UUID; v_subject TEXT;
BEGIN SELECT user_id, subject INTO v_user_id, v_subject FROM support_tickets WHERE id = p_ticket_id;
IF v_user_id IS NULL THEN RETURN false; END IF;
UPDATE support_tickets SET admin_reply = p_reply, status = 'replied', replied_by = p_admin_user_id, replied_at = now(), updated_at = now() WHERE id = p_ticket_id;
PERFORM create_user_notification(v_user_id, 'support', 'Support Reply Received', 'You have a new reply to your ticket: "' || v_subject || '"', NULL, jsonb_build_object('ticket_id', p_ticket_id));
RETURN true; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMPLETE FUNCTION: publish_broadcast
CREATE OR REPLACE FUNCTION publish_broadcast(p_broadcast_id UUID)
RETURNS INTEGER AS $$
DECLARE v_broadcast RECORD; v_user RECORD; v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_broadcast FROM broadcast_messages WHERE id = p_broadcast_id;
  IF v_broadcast IS NULL OR NOT v_broadcast.is_active THEN RETURN 0; END IF;
  FOR v_user IN 
    SELECT u.id as user_id FROM auth.users u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
    WHERE CASE v_broadcast.audience_type WHEN 'all_users' THEN true WHEN 'trial_users' THEN s.plan_type = 'trial' OR s.user_id IS NULL WHEN 'premium_users' THEN s.plan_type IN ('monthly', 'lifetime', 'interviewPass') AND s.status = 'active' WHEN 'expired_users' THEN s.status = 'expired' OR (s.current_period_ends_at < now() AND s.status != 'active') WHEN 'free_users' THEN s.user_id IS NULL OR s.plan_type = 'trial' ELSE true END
  LOOP
    PERFORM create_user_notification(v_user.user_id, 'broadcast', v_broadcast.title, v_broadcast.message, NULL, jsonb_build_object('broadcast_id', p_broadcast_id));
    v_count := v_count + 1;
  END LOOP;
  UPDATE broadcast_messages SET sent_count = v_count WHERE id = p_broadcast_id;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_open_tickets_for_admin()
RETURNS TABLE (id UUID, user_id UUID, user_email TEXT, subject TEXT, category TEXT, message TEXT, status TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN RETURN QUERY SELECT t.id, t.user_id, u.email::TEXT, t.subject, t.category, t.message, t.status, t.created_at FROM support_tickets t JOIN auth.users u ON t.user_id = u.id WHERE t.status IN ('open', 'replied') ORDER BY CASE t.status WHEN 'open' THEN 0 ELSE 1 END, t.created_at ASC; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_user_notifications_updated_at ON user_notifications;
CREATE TRIGGER update_user_notifications_updated_at BEFORE UPDATE ON user_notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_broadcast_messages_updated_at ON broadcast_messages;
CREATE TRIGGER update_broadcast_messages_updated_at BEFORE UPDATE ON broadcast_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT EXECUTE ON FUNCTION create_user_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_support_ticket(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reply_to_support_ticket(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION publish_broadcast(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_open_tickets_for_admin() TO authenticated, service_role;


-- ============================================================================
-- SECTION 11: PROMO CODES AND REFERRAL TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  influencer_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  promo_code TEXT,
  referrer TEXT,
  landing_page TEXT,
  event_type TEXT NOT NULL DEFAULT 'visit' CHECK (event_type IN ('visit', 'signup', 'checkout', 'purchase')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_events_user_id ON referral_events(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_promo_code ON referral_events(promo_code);
CREATE INDEX IF NOT EXISTS idx_referral_events_event_type ON referral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_user_created ON referral_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_events_recent ON referral_events(created_at DESC) WHERE created_at > (now() - interval '90 days');

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

-- NOTE: Promo code admin management is primarily via service_role/Edge Functions
-- Admin UI access can be added later when needed
CREATE POLICY "Allow read access to promo codes" ON promo_codes FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Allow service role full access to promo codes" ON promo_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow users to read own referral events" ON referral_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Allow anon to create referral events" ON referral_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow service role full access to referral events" ON referral_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION validate_promo_code(p_code TEXT)
RETURNS TABLE (valid BOOLEAN, code TEXT, discount_percent INTEGER, influencer_name TEXT) AS $$
BEGIN RETURN QUERY SELECT true, pc.code, pc.discount_percent, pc.influencer_name FROM promo_codes pc WHERE pc.code = UPPER(TRIM(p_code)) AND pc.is_active = true; IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, NULL::TEXT; END IF; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_referral_event(p_user_id UUID DEFAULT NULL, p_promo_code TEXT DEFAULT NULL, p_referrer TEXT DEFAULT NULL, p_landing_page TEXT DEFAULT NULL, p_event_type TEXT DEFAULT 'visit', p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS referral_events AS $$
DECLARE v_event referral_events;
BEGIN INSERT INTO referral_events (user_id, promo_code, referrer, landing_page, event_type, metadata, created_at) VALUES (p_user_id, UPPER(TRIM(p_promo_code)), p_referrer, p_landing_page, p_event_type, p_metadata, now()) RETURNING * INTO v_event; RETURN v_event; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_all_promo_code_stats()
RETURNS TABLE (promo_code TEXT, influencer_name TEXT, discount_percent INTEGER, is_active BOOLEAN, total_referrals BIGINT, total_signups BIGINT, total_purchases BIGINT, total_paid_users BIGINT) AS $$
BEGIN RETURN QUERY SELECT pc.code, pc.influencer_name, pc.discount_percent, pc.is_active, COALESCE(stats.total_referrals, 0), COALESCE(stats.total_signups, 0), COALESCE(stats.total_purchases, 0), COALESCE(stats.total_paid_users, 0) FROM promo_codes pc LEFT JOIN (SELECT re.promo_code, COUNT(*) FILTER (WHERE re.event_type = 'visit') as total_referrals, COUNT(*) FILTER (WHERE re.event_type = 'signup') as total_signups, COUNT(*) FILTER (WHERE re.event_type = 'purchase') as total_purchases, COUNT(DISTINCT re.user_id) FILTER (WHERE re.event_type = 'purchase' AND re.user_id IS NOT NULL) as total_paid_users FROM referral_events re GROUP BY re.promo_code) stats ON stats.promo_code = pc.code ORDER BY pc.created_at DESC; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION apply_promo_code_discount(p_code TEXT, p_original_price DECIMAL)
RETURNS TABLE (valid BOOLEAN, original_price DECIMAL, discount_percent INTEGER, discount_amount DECIMAL, final_price DECIMAL) AS $$
DECLARE v_discount INTEGER;
BEGIN SELECT pc.discount_percent INTO v_discount FROM promo_codes pc WHERE pc.code = UPPER(TRIM(p_code)) AND pc.is_active = true; IF v_discount IS NULL THEN RETURN QUERY SELECT false, p_original_price, 0, 0::DECIMAL, p_original_price; RETURN; END IF; RETURN QUERY SELECT true, p_original_price, v_discount, ROUND(p_original_price * v_discount / 100, 2), ROUND(p_original_price * (100 - v_discount) / 100, 2); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_referral_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_all_promo_code_stats() TO service_role;
GRANT EXECUTE ON FUNCTION apply_promo_code_discount(TEXT, DECIMAL) TO service_role;

-- ============================================================================
-- SECTION 12: SEO SETTINGS AND EXPANSION PUBLISHING
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sitemap_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (sitemap_frequency IN ('daily', 'weekly', 'monthly')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to seo_settings" ON seo_settings FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY "Allow admin update to seo_settings" ON seo_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
INSERT INTO seo_settings (id, sitemap_frequency, updated_at) VALUES (1, 'weekly', now()) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS seo_expansion_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pattern_pages_enabled BOOLEAN NOT NULL DEFAULT false,
  situation_pages_enabled BOOLEAN NOT NULL DEFAULT false,
  include_in_sitemap BOOLEAN NOT NULL DEFAULT false,
  noindex_until_approved BOOLEAN NOT NULL DEFAULT true,
  recommended_activation_months INTEGER NOT NULL DEFAULT 3 CHECK (recommended_activation_months IN (3, 4, 6)),
  scheduler_enabled BOOLEAN NOT NULL DEFAULT false,
  scheduler_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (scheduler_frequency IN ('weekly', 'biweekly', 'monthly')),
  scheduler_page_count_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (scheduler_page_count_mode IN ('fixed', 'random')),
  scheduler_fixed_page_count INTEGER NOT NULL DEFAULT 2,
  scheduler_random_min_pages INTEGER NOT NULL DEFAULT 2,
  scheduler_random_max_pages INTEGER NOT NULL DEFAULT 4,
  scheduler_only_publish_approved BOOLEAN NOT NULL DEFAULT true,
  scheduler_auto_include_in_sitemap BOOLEAN NOT NULL DEFAULT false,
  launch_date DATE,
  reminder_banner_enabled BOOLEAN NOT NULL DEFAULT true,
  admin_notes TEXT,
  last_sitemap_sync_at TIMESTAMPTZ,
  last_deploy_triggered_at TIMESTAMPTZ,
  last_deploy_status TEXT CHECK (last_deploy_status IN ('pending', 'success', 'error')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS seo_expansion_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL CHECK (page_type IN ('pattern', 'situation')),
  parent_cluster TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'published', 'unpublished')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  include_in_sitemap BOOLEAN NOT NULL DEFAULT false,
  noindex_override BOOLEAN NOT NULL DEFAULT true,
  sitemap_synced_at TIMESTAMPTZ,
  is_in_live_sitemap BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unpublished_at TIMESTAMPTZ,
  unpublished_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_expansion_pages_status ON seo_expansion_pages(status);
CREATE INDEX IF NOT EXISTS idx_seo_expansion_pages_published ON seo_expansion_pages(is_published) WHERE is_published = true;

CREATE TABLE IF NOT EXISTS seo_expansion_scheduler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_manually BOOLEAN NOT NULL DEFAULT true,
  pages_considered INTEGER NOT NULL DEFAULT 0,
  pages_published INTEGER NOT NULL DEFAULT 0,
  published_slugs TEXT[] DEFAULT '{}',
  sitemap_included BOOLEAN NOT NULL DEFAULT false,
  noindex_respected BOOLEAN NOT NULL DEFAULT true,
  only_approved_published BOOLEAN NOT NULL DEFAULT true,
  execution_duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seo_expansion_rebuild_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'error')),
  reason TEXT DEFAULT 'admin_triggered',
  source TEXT DEFAULT 'admin_dashboard',
  error_message TEXT,
  estimated_completion_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seo_expansion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_expansion_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_expansion_scheduler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_expansion_rebuild_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to seo_expansion_settings" ON seo_expansion_settings FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY "Allow admin update to seo_expansion_settings" ON seo_expansion_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Allow read access to seo_expansion_pages" ON seo_expansion_pages FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY "Allow admin update to seo_expansion_pages" ON seo_expansion_pages FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Allow read access to scheduler runs" ON seo_expansion_scheduler_runs FOR SELECT TO authenticated, service_role USING (true);
CREATE POLICY "Allow admin insert to scheduler runs" ON seo_expansion_scheduler_runs FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Allow read access to rebuild attempts" ON seo_expansion_rebuild_attempts FOR SELECT TO authenticated, service_role USING (true);

-- SEO Functions
CREATE OR REPLACE FUNCTION get_seo_settings()
RETURNS TABLE (sitemap_frequency TEXT, updated_at TIMESTAMPTZ) AS $$
BEGIN RETURN QUERY SELECT COALESCE(ss.sitemap_frequency, 'weekly')::TEXT, ss.updated_at FROM (SELECT 1 as dummy) d LEFT JOIN seo_settings ss ON ss.id = 1; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_sitemap_frequency(p_frequency TEXT)
RETURNS BOOLEAN AS $$
BEGIN IF p_frequency NOT IN ('daily', 'weekly', 'monthly') THEN RETURN false; END IF;
INSERT INTO seo_settings (id, sitemap_frequency, updated_at) VALUES (1, p_frequency, now()) ON CONFLICT (id) DO UPDATE SET sitemap_frequency = EXCLUDED.sitemap_frequency, updated_at = EXCLUDED.updated_at; RETURN true; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_seo_expansion_settings()
RETURNS TABLE (pattern_pages_enabled BOOLEAN, situation_pages_enabled BOOLEAN, include_in_sitemap BOOLEAN, noindex_until_approved BOOLEAN, recommended_activation_months INTEGER, scheduler_enabled BOOLEAN, scheduler_frequency TEXT, scheduler_page_count_mode TEXT, scheduler_fixed_page_count INTEGER, scheduler_random_min_pages INTEGER, scheduler_random_max_pages INTEGER, scheduler_only_publish_approved BOOLEAN, scheduler_auto_include_in_sitemap BOOLEAN, launch_date DATE, reminder_banner_enabled BOOLEAN, admin_notes TEXT, updated_at TIMESTAMPTZ) AS $$
BEGIN RETURN QUERY SELECT COALESCE(ses.pattern_pages_enabled, false), COALESCE(ses.situation_pages_enabled, false), COALESCE(ses.include_in_sitemap, false), COALESCE(ses.noindex_until_approved, true), COALESCE(ses.recommended_activation_months, 3), COALESCE(ses.scheduler_enabled, false), COALESCE(ses.scheduler_frequency, 'weekly'), COALESCE(ses.scheduler_page_count_mode, 'fixed'), COALESCE(ses.scheduler_fixed_page_count, 2), COALESCE(ses.scheduler_random_min_pages, 2), COALESCE(ses.scheduler_random_max_pages, 4), COALESCE(ses.scheduler_only_publish_approved, true), COALESCE(ses.scheduler_auto_include_in_sitemap, false), ses.launch_date, COALESCE(ses.reminder_banner_enabled, true), ses.admin_notes, ses.updated_at FROM (SELECT 1 as dummy) d LEFT JOIN seo_expansion_settings ses ON ses.id = 1; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_published_expansion_slugs()
RETURNS TABLE (slug TEXT, include_in_sitemap BOOLEAN) AS $$
BEGIN RETURN QUERY SELECT sep.slug, sep.include_in_sitemap FROM seo_expansion_pages sep JOIN seo_expansion_settings ses ON ses.id = 1 WHERE sep.is_published = true AND (ses.pattern_pages_enabled = true OR ses.situation_pages_enabled = true); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_seo_expansion_page_status(p_slug TEXT, p_status TEXT, p_include_in_sitemap BOOLEAN DEFAULT false, p_noindex_override BOOLEAN DEFAULT true, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE v_user_id UUID;
BEGIN v_user_id := auth.uid(); IF p_status NOT IN ('draft', 'reviewed', 'approved', 'published', 'unpublished') THEN RETURN false; END IF;
UPDATE seo_expansion_pages SET status = p_status, is_enabled = (p_status = 'published'), is_published = (p_status = 'published'), include_in_sitemap = p_include_in_sitemap, noindex_override = p_noindex_override, notes = COALESCE(p_notes, notes), reviewed_at = CASE WHEN p_status = 'reviewed' THEN now() ELSE reviewed_at END, reviewed_by = CASE WHEN p_status = 'reviewed' THEN v_user_id ELSE reviewed_by END, approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END, approved_by = CASE WHEN p_status = 'approved' THEN v_user_id ELSE approved_by END, published_at = CASE WHEN p_status = 'published' THEN now() ELSE published_at END, published_by = CASE WHEN p_status = 'published' THEN v_user_id ELSE published_by END, unpublished_at = CASE WHEN p_status = 'unpublished' THEN now() ELSE unpublished_at END, unpublished_by = CASE WHEN p_status = 'unpublished' THEN v_user_id ELSE unpublished_by END, updated_at = now() WHERE slug = p_slug; RETURN FOUND; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_scheduler_run(p_triggered_manually BOOLEAN DEFAULT true, p_pages_considered INTEGER DEFAULT 0, p_pages_published INTEGER DEFAULT 0, p_published_slugs TEXT[] DEFAULT '{}', p_sitemap_included BOOLEAN DEFAULT false, p_noindex_respected BOOLEAN DEFAULT true, p_only_approved_published BOOLEAN DEFAULT true, p_execution_duration_ms INTEGER DEFAULT NULL, p_error_message TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_run_id UUID;
BEGIN INSERT INTO seo_expansion_scheduler_runs (triggered_by, triggered_manually, pages_considered, pages_published, published_slugs, sitemap_included, noindex_respected, only_approved_published, execution_duration_ms, error_message) VALUES (auth.uid(), p_triggered_manually, p_pages_considered, p_pages_published, p_published_slugs, p_sitemap_included, p_noindex_respected, p_only_approved_published, p_execution_duration_ms, p_error_message) RETURNING id INTO v_run_id; RETURN v_run_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_rebuild_attempt(p_triggered_by UUID, p_triggered_at TIMESTAMPTZ, p_status TEXT DEFAULT 'pending', p_reason TEXT DEFAULT 'admin_triggered', p_source TEXT DEFAULT 'admin_dashboard', p_error TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_attempt_id UUID;
BEGIN INSERT INTO seo_expansion_rebuild_attempts (triggered_by, triggered_at, status, reason, source, error_message, estimated_completion_at) VALUES (p_triggered_by, p_triggered_at, p_status, p_reason, p_source, p_error, p_triggered_at + interval '3 minutes') RETURNING id INTO v_attempt_id; RETURN v_attempt_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_latest_rebuild_attempt()
RETURNS TABLE (id UUID, triggered_by UUID, triggered_at TIMESTAMPTZ, status TEXT, reason TEXT, source TEXT, error_message TEXT, estimated_completion_at TIMESTAMPTZ, created_at TIMESTAMPTZ) AS $$
BEGIN RETURN QUERY SELECT sera.id, sera.triggered_by, sera.triggered_at, sera.status, sera.reason, sera.source, sera.error_message, sera.estimated_completion_at, sera.created_at FROM seo_expansion_rebuild_attempts sera ORDER BY sera.created_at DESC LIMIT 1; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_sitemap_sync_status_secure()
RETURNS TABLE (published_pages_count INTEGER, pages_in_sitemap INTEGER, pages_not_in_sitemap INTEGER, last_sitemap_sync_at TIMESTAMPTZ, last_scheduler_run_at TIMESTAMPTZ, last_rebuild_triggered_at TIMESTAMPTZ, last_rebuild_status TEXT, estimated_completion_at TIMESTAMPTZ, is_pages_not_in_sitemap_exact BOOLEAN, is_last_sync_exact BOOLEAN) AS $$
DECLARE v_published_count INTEGER; v_in_sitemap INTEGER; v_last_scheduler TIMESTAMPTZ; v_last_rebuild TIMESTAMPTZ; v_last_rebuild_status TEXT; v_estimated_completion TIMESTAMPTZ;
BEGIN SELECT COUNT(*) INTO v_published_count FROM seo_expansion_pages WHERE is_published = true; SELECT COUNT(*) INTO v_in_sitemap FROM seo_expansion_pages WHERE is_published = true AND include_in_sitemap = true; SELECT MAX(created_at) INTO v_last_scheduler FROM seo_expansion_scheduler_runs; SELECT triggered_at, status, estimated_completion_at INTO v_last_rebuild, v_last_rebuild_status, v_estimated_completion FROM seo_expansion_rebuild_attempts ORDER BY created_at DESC LIMIT 1; RETURN QUERY SELECT v_published_count, v_in_sitemap, GREATEST(0, v_published_count - v_in_sitemap), v_last_rebuild, v_last_scheduler, v_last_rebuild, v_last_rebuild_status, v_estimated_completion, false, false; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO seo_expansion_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Seed expansion pages
INSERT INTO seo_expansion_pages (slug, page_type, parent_cluster, status, is_enabled, is_published) VALUES
  ('met-online-dating-uscis-interview', 'pattern', 'relationship-history', 'draft', false, false),
  ('met-through-friends-uscis-interview', 'pattern', 'relationship-history', 'draft', false, false),
  ('courthouse-wedding-uscis-interview', 'pattern', 'wedding-ceremony', 'draft', false, false),
  ('small-wedding-few-guests-uscis', 'pattern', 'wedding-ceremony', 'draft', false, false),
  ('no-joint-bank-account-uscis', 'pattern', 'finances', 'draft', false, false),
  ('shared-bank-account-uscis-interview', 'pattern', 'finances', 'draft', false, false),
  ('living-apart-temporarily-uscis', 'pattern', 'living-together', 'draft', false, false),
  ('different-work-schedules-uscis', 'pattern', 'living-together', 'draft', false, false),
  ('parents-never-met-uscis-interview', 'pattern', 'family-social', 'draft', false, false),
  ('spouse-not-close-to-family-uscis', 'pattern', 'family-social', 'draft', false, false),
  ('couples-who-met-online-green-card-interview', 'situation', 'relationship-history', 'draft', false, false),
  ('courthouse-wedding-couples-green-card', 'situation', 'wedding-ceremony', 'draft', false, false),
  ('long-distance-couples-green-card-interview', 'situation', 'relationship-history', 'draft', false, false),
  ('couples-without-joint-accounts-green-card', 'situation', 'finances', 'draft', false, false),
  ('couples-living-apart-temporarily-green-card', 'situation', 'living-together', 'draft', false, false),
  ('older-couples-green-card-interview', 'situation', 'family-social', 'draft', false, false)
ON CONFLICT (slug) DO NOTHING;

GRANT EXECUTE ON FUNCTION get_seo_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_sitemap_frequency(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_seo_expansion_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_published_expansion_slugs() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_seo_expansion_page_status(TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_scheduler_run(BOOLEAN, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_rebuild_attempt(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_latest_rebuild_attempt() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_sitemap_sync_status_secure() TO authenticated, anon, service_role;


-- ============================================================================
-- SECTION 13: SITE VERIFICATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_verification (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Interview Ready - Marriage Green Card',
  verified_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'blocked')),
  verification_source TEXT,
  verification_url TEXT,
  last_checked_at TIMESTAMPTZ,
  manual_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE site_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to site_verification" ON site_verification FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY "Allow service_role full access to site_verification" ON site_verification FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin update to site_verification" ON site_verification FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
INSERT INTO site_verification (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION get_site_verification()
RETURNS TABLE (verified_at TIMESTAMPTZ, verification_status TEXT, verification_source TEXT, verification_url TEXT, last_checked_at TIMESTAMPTZ, manual_override BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ) AS $$
BEGIN RETURN QUERY SELECT sv.verified_at, sv.verification_status, sv.verification_source, sv.verification_url, sv.last_checked_at, sv.manual_override, sv.created_at, sv.updated_at FROM (SELECT 1 as dummy) d LEFT JOIN site_verification sv ON sv.id = 1; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_site_verification_status(p_status TEXT, p_source TEXT DEFAULT NULL, p_url TEXT DEFAULT NULL, p_override BOOLEAN DEFAULT false)
RETURNS BOOLEAN AS $$
BEGIN IF p_status NOT IN ('unverified', 'verified', 'blocked') THEN RETURN false; END IF;
INSERT INTO site_verification (id, verification_status, verification_source, verification_url, manual_override, verified_at, last_checked_at, updated_at) VALUES (1, p_status, p_source, p_url, p_override, CASE WHEN p_status = 'verified' THEN now() ELSE NULL END, now(), now()) ON CONFLICT (id) DO UPDATE SET verification_status = EXCLUDED.verification_status, verification_source = COALESCE(EXCLUDED.verification_source, site_verification.verification_source), verification_url = COALESCE(EXCLUDED.verification_url, site_verification.verification_url), manual_override = EXCLUDED.manual_override, verified_at = CASE WHEN EXCLUDED.verification_status = 'verified' THEN now() ELSE site_verification.verified_at END, last_checked_at = now(), updated_at = now(); RETURN true; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_site_verification() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_site_verification_status(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

-- ============================================================================
-- SECTION 14: STRIPE WEBHOOK LOGS
-- ============================================================================
-- LEGACY PAID-APP COMPATIBILITY ONLY.
-- Core subscription webhooks are ignored in the free app. Robin credit
-- purchases use the active server Stripe route and Robin credit ledger.
CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_logs_event_type ON stripe_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_logs_processed_at ON stripe_webhook_logs(processed_at DESC);
ALTER TABLE stripe_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service_role full access" ON stripe_webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin read access" ON stripe_webhook_logs FOR SELECT TO authenticated USING (is_admin());

-- ============================================================================
-- SECTION 15: ANSWER CANDIDATES (for RAG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS answer_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES ai_interviews(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  candidate_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_answer TEXT,
  confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answer_candidates_interview_id ON answer_candidates(interview_id);
CREATE INDEX IF NOT EXISTS idx_answer_candidates_question_id ON answer_candidates(question_id);
ALTER TABLE answer_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own answer candidates" ON answer_candidates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM ai_interviews i WHERE i.id = interview_id AND i.user_id = auth.uid()));
CREATE POLICY "Users can insert own answer candidates" ON answer_candidates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM ai_interviews i WHERE i.id = interview_id AND i.user_id = auth.uid()));
CREATE POLICY "Admins can view all answer candidates" ON answer_candidates FOR SELECT TO authenticated USING (is_admin());

-- ============================================================================
-- SECTION 16: REFRESH VIEW FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_interview_questions_materialized_view()
RETURNS void AS $$
BEGIN RAISE NOTICE 'refresh_interview_questions_materialized_view called - no materialized view in this schema version'; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION refresh_interview_questions_materialized_view() TO service_role;

-- ============================================================================
-- SECTION 17: SEED DATA
-- ============================================================================
DO $$
BEGIN
  -- Default AI Usage Tiers
  IF NOT EXISTS (SELECT 1 FROM ai_usage_tiers WHERE plan_type = 'free') THEN
    INSERT INTO ai_usage_tiers (plan_type, questions_per_month, ai_interviews_per_month) VALUES ('free', 30, 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ai_usage_tiers WHERE plan_type = 'trial') THEN
    INSERT INTO ai_usage_tiers (plan_type, questions_per_month, ai_interviews_per_month) VALUES ('trial', 30, 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ai_usage_tiers WHERE plan_type = 'monthly') THEN
    INSERT INTO ai_usage_tiers (plan_type, questions_per_month, ai_interviews_per_month) VALUES ('monthly', 300, 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ai_usage_tiers WHERE plan_type = 'lifetime') THEN
    INSERT INTO ai_usage_tiers (plan_type, questions_per_month, ai_interviews_per_month) VALUES ('lifetime', 10000, 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ai_usage_tiers WHERE plan_type = 'interviewPass') THEN
    INSERT INTO ai_usage_tiers (plan_type, questions_per_month, ai_interviews_per_month) VALUES ('interviewPass', 500, 10);
  END IF;
END $$;

-- Seed the new promo codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'FRIENDS20') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('FRIENDS20', 'Friend Referral Program', 20, '20% off any plan - friends of existing customers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'YOUTUBE25') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('YOUTUBE25', 'YouTube Partnership', 25, '25% off - YouTube influencer partnership');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'TIKTOK30') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('TIKTOK30', 'TikTok Partnership', 30, '30% off - TikTok influencer partnership');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'PODCAST15') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('PODCAST15', 'Podcast Sponsorship', 15, '15% off - Podcast listener discount');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'BLOG20') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('BLOG20', 'Blog/Website Partnership', 20, '20% off - Blog reader discount');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'IMMIGRATIONHELP') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('IMMIGRATIONHELP', 'Immigration Lawyer Partnership', 25, '25% off - Referral from immigration attorney');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'ATTORNEY25') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('ATTORNEY25', 'Legal Professional Referral', 25, '25% off - Attorney partnership program');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'COMMUNITY10') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('COMMUNITY10', 'Community Discount', 10, '10% off - Community member discount');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'FACEBOOK15') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('FACEBOOK15', 'Facebook Partnership', 15, '15% off - Facebook group member discount');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'INSTAGRAM20') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('INSTAGRAM20', 'Instagram Partnership', 20, '20% off - Instagram follower discount');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'VISA') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('VISA', 'Visa Journey Partnership', 25, '25% off - Visa Journey community partnership');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'VISAJOURNEY') THEN
    INSERT INTO promo_codes (code, influencer_name, discount_percent, description) VALUES ('VISAJOURNEY', 'Visa Journey Community', 25, '25% off - Visa Journey community partnership');
  END IF;
END $$;

-- Seed additional categories and questions
DO $$
BEGIN
  -- TRADITIONAL
  IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'traditional' AND category_type = 'topic') THEN
    INSERT INTO categories (name, code, category_type, priority) VALUES ('Traditional/History', 'traditional', 'topic', 1);
  END IF;

  -- UPDATES
  IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'updates' AND category_type = 'topic') THEN
    INSERT INTO categories (name, code, category_type, priority) VALUES ('Updates/Changes', 'updates', 'topic', 2);
  END IF;

  -- MISC (catch-all category)
  IF NOT EXISTS (SELECT 1 FROM categories WHERE code = 'misc' AND category_type = 'topic') THEN
    INSERT INTO categories (name, code, category_type, priority) VALUES ('Miscellaneous', 'misc', 'topic', 99);
  END IF;
END $$;

DO $$
DECLARE v_traditional_id UUID; v_updates_id UUID; v_misc_id UUID;
BEGIN
  SELECT id INTO v_traditional_id FROM categories WHERE code = 'traditional' AND category_type = 'topic' LIMIT 1;
  SELECT id INTO v_updates_id FROM categories WHERE code = 'updates' AND category_type = 'topic' LIMIT 1;
  SELECT id INTO v_misc_id FROM categories WHERE code = 'misc' AND category_type = 'topic' LIMIT 1;

  -- Traditional/History questions
  IF v_traditional_id IS NOT NULL THEN
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('How and when did you two meet?', v_traditional_id, 'easy', 1, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Tell me about your first date', v_traditional_id, 'easy', 2, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('When did you realize you wanted to marry this person?', v_traditional_id, 'medium', 3, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Tell me about the proposal', v_traditional_id, 'easy', 4, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Did you tell your parents you were going to get married before the proposal?', v_traditional_id, 'medium', 5, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Who performed your wedding ceremony?', v_traditional_id, 'easy', 6, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('How many guests attended your wedding?', v_traditional_id, 'easy', 7, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What did you do for your honeymoon?', v_traditional_id, 'medium', 8, 'system') ON CONFLICT DO NOTHING;
  END IF;

  -- Updates/Changes questions
  IF v_updates_id IS NOT NULL THEN
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What changes have you made to your home since getting married?', v_updates_id, 'medium', 1, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Have you changed any of your insurance policies since getting married?', v_updates_id, 'hard', 2, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What documents have you updated with your married name?', v_updates_id, 'medium', 3, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Have you changed your will or other estate planning documents?', v_updates_id, 'hard', 4, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What subscriptions or accounts have you combined?', v_updates_id, 'medium', 5, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Have there been any changes to your work schedules since getting married?', v_updates_id, 'medium', 6, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What new expenses do you have now that you are married?', v_updates_id, 'medium', 7, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Have you attended any couples events, counseling, or workshops?', v_updates_id, 'hard', 8, 'system') ON CONFLICT DO NOTHING;
  END IF;

  -- Miscellaneous questions
  IF v_misc_id IS NOT NULL THEN
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Is there anything else you would like to tell me about your relationship?', v_misc_id, 'easy', 1, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What are your future plans together?', v_misc_id, 'easy', 2, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Do you have any trips planned together?', v_misc_id, 'easy', 3, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('What are your long-term goals as a couple?', v_misc_id, 'medium', 4, 'system') ON CONFLICT DO NOTHING;
    INSERT INTO questions (text, category_id, difficulty, order_num, source) VALUES ('Tell me about your typical Sunday together', v_misc_id, 'easy', 5, 'system') ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- SECTION 18: FINAL GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION 19: FORCE SCHEMA RELOAD
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
SELECT 'Interview Ready - Marriage Green Card Database Setup Complete!' as status;
