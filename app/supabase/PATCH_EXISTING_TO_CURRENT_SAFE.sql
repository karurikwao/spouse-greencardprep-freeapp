-- ============================================================================
-- INTERVIEWREADY SAFE PATCH - EXISTING PROJECT ONLY
-- ============================================================================
-- Created: 2026-03-15
-- Purpose: Safe incremental fixes for existing hosted Supabase project
--
-- Based on: Actual current migration files (20 migrations audited)
--
-- CRITICAL: This patch assumes your database already has the schema from
-- migrations 20240306 through 20240331. It only FIXES issues, doesn't
-- recreate existing tables.
--
-- DO NOT RUN ON FRESH PROJECTS - this is for fixing existing projects only.
-- ============================================================================

-- ============================================================================
-- SECTION 1: FIX RECURSIVE RLS ON user_profiles
-- ============================================================================

-- First, create the admin helper functions if they don't exist
-- These use SECURITY DEFINER to avoid recursion
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

-- Drop and recreate the problematic admin policies using the helper functions
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Superadmin can manage all profiles" ON user_profiles;

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE TO authenticated 
  USING (is_admin(auth.uid())) 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Superadmin can manage all profiles" ON user_profiles
  FOR ALL TO authenticated 
  USING (is_superadmin(auth.uid())) 
  WITH CHECK (is_superadmin(auth.uid()));

-- ============================================================================
-- SECTION 2: ENSURE AI TRACKING FUNCTIONS EXIST (Current Architecture)
-- ============================================================================
-- The current app uses ai_daily_usage + ai_session_tracking (NOT ai_interviews)

-- Function to get or create today's usage record
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
  SELECT * INTO v_record 
  FROM ai_daily_usage 
  WHERE ai_daily_usage.user_id = p_user_id 
  AND ai_daily_usage.usage_date = v_today;
  
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

-- Function to start an AI session (creates session record, increments daily count)
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
  
  -- Increment session count for today
  UPDATE ai_daily_usage 
  SET sessions_count = sessions_count + 1, 
      updated_at = now() 
  WHERE id = v_usage_record.id;
  
  -- Create the session tracking record
  INSERT INTO ai_session_tracking (
    user_id, 
    provider, 
    model, 
    topic_id,
    session_started_at
  ) VALUES (
    p_user_id, 
    p_provider, 
    p_model, 
    p_topic_id,
    now()
  ) RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a turn (updates both daily usage and session)
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
  WHERE user_id = p_user_id 
  AND usage_date = CURRENT_DATE;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update daily turn count
  UPDATE ai_daily_usage 
  SET total_turns = total_turns + p_turn_count, 
      updated_at = now() 
  WHERE id = v_usage_record.id;
  
  -- Update session turn count
  UPDATE ai_session_tracking 
  SET turns_count = turns_count + p_turn_count,
      last_activity_at = now()
  WHERE id = p_session_id 
  AND user_id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check AI usage limits
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
  -- Get effective subscription
  SELECT plan_type, has_access 
  INTO v_plan_type, v_has_access 
  FROM get_effective_subscription(p_user_id);
  
  IF v_plan_type IS NULL THEN
    v_plan_type := 'trial';
    v_has_access := true;
  END IF;
  
  -- Get plan limits
  SELECT 
    COALESCE(max_sessions_per_day, 1),
    COALESCE(max_turns_per_session, 5)
  INTO v_max_sessions, v_max_turns
  FROM plan_config
  WHERE plan_type = v_plan_type;
  
  -- Get today's usage
  SELECT * INTO v_usage_record 
  FROM get_or_create_daily_usage(p_user_id);
  
  -- Check if subscription expired
  IF NOT v_has_access THEN
    RETURN QUERY SELECT 
      false, 
      'Your subscription has expired. Please upgrade to continue.'::TEXT,
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
      format('Daily Robin chat limit reached (%s per day)', v_max_turns)::TEXT,
      v_plan_type,
      v_max_sessions,
      v_max_turns,
      v_usage_record.sessions_count,
      v_usage_record.total_turns,
      GREATEST(0, v_max_sessions - v_usage_record.sessions_count),
      0;
    RETURN;
  END IF;
  
  -- Allowed
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_daily_usage(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_session_start(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_turn(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_ai_usage_limits(UUID) TO authenticated, service_role;

-- ============================================================================
-- SECTION 3: FIX PDF DOWNLOAD EVENT STATUS VALUES
-- ============================================================================
-- The app uses: 'requested' | 'access_granted' | 'denied' | 'served' | 'completed_estimated'

-- First drop the existing constraint if it has wrong values
ALTER TABLE IF EXISTS pdf_download_events 
DROP CONSTRAINT IF EXISTS pdf_download_events_event_status_check;

-- Add the correct constraint with all 5 statuses
ALTER TABLE IF EXISTS pdf_download_events 
ADD CONSTRAINT pdf_download_events_event_status_check 
CHECK (event_status IN ('requested', 'access_granted', 'denied', 'served', 'completed_estimated'));

-- ============================================================================
-- SECTION 4: ENSURE CONTENT DISMISSAL FUNCTIONS EXIST
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dismissed_content_ids(
  p_user_id UUID, 
  p_content_type TEXT, 
  p_placement TEXT DEFAULT NULL
)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT cd.content_id
    FROM content_dismissals cd
    WHERE cd.user_id = p_user_id
    AND cd.content_type = p_content_type
    AND (p_placement IS NULL OR cd.placement = p_placement)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION dismiss_content(
  p_user_id UUID, 
  p_content_type TEXT, 
  p_content_id UUID, 
  p_placement TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert dismissal
  INSERT INTO content_dismissals (
    user_id, 
    content_type, 
    content_id, 
    placement
  ) VALUES (
    p_user_id, 
    p_content_type, 
    p_content_id, 
    p_placement
  )
  ON CONFLICT (user_id, content_type, content_id) DO NOTHING;
  
  -- Record the interaction
  INSERT INTO content_interactions (
    content_type, 
    content_id, 
    placement, 
    interaction_type, 
    user_id
  ) VALUES (
    p_content_type, 
    p_content_id, 
    p_placement, 
    'dismiss', 
    p_user_id
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dismissed_content_ids(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_content(UUID, TEXT, UUID, TEXT) TO authenticated;

-- ============================================================================
-- SECTION 5: ENSURE VERIFICATION CODE FUNCTIONS EXIST
-- ============================================================================
-- Uses site_verification_codes table (head, footer, body_end placements)

CREATE OR REPLACE FUNCTION get_verification_code(p_placement TEXT)
RETURNS TABLE (
  id UUID,
  placement TEXT,
  code TEXT,
  is_enabled BOOLEAN,
  notes TEXT,
  environment TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    svc.id,
    svc.placement,
    svc.code,
    svc.is_enabled,
    svc.notes,
    svc.environment,
    svc.created_at,
    svc.updated_at
  FROM site_verification_codes svc
  WHERE svc.placement = p_placement
  AND svc.is_enabled = true
  ORDER BY svc.updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION upsert_verification_code(
  p_placement TEXT,
  p_code TEXT,
  p_is_enabled BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT 'production'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO site_verification_codes (
    placement,
    code,
    is_enabled,
    notes,
    environment,
    created_by,
    updated_by
  ) VALUES (
    p_placement,
    p_code,
    p_is_enabled,
    p_notes,
    p_environment,
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (placement) 
  DO UPDATE SET
    code = EXCLUDED.code,
    is_enabled = EXCLUDED.is_enabled,
    notes = EXCLUDED.notes,
    environment = EXCLUDED.environment,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_verification_code(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_verification_code(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- SECTION 6: ENSURE SEO FUNCTIONS EXIST
-- ============================================================================

-- get_seo_settings
CREATE OR REPLACE FUNCTION get_seo_settings()
RETURNS TABLE (
  sitemap_frequency TEXT, 
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ss.sitemap_frequency, 'weekly')::TEXT, 
    ss.updated_at
  FROM (SELECT 1 as dummy) d
  LEFT JOIN seo_settings ss ON ss.id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_seo_expansion_settings
CREATE OR REPLACE FUNCTION get_seo_expansion_settings()
RETURNS TABLE (
  pattern_pages_enabled BOOLEAN,
  situation_pages_enabled BOOLEAN,
  include_in_sitemap BOOLEAN,
  noindex_until_approved BOOLEAN,
  recommended_activation_months INTEGER,
  scheduler_enabled BOOLEAN,
  scheduler_frequency TEXT,
  scheduler_page_count_mode TEXT,
  scheduler_fixed_page_count INTEGER,
  scheduler_random_min_pages INTEGER,
  scheduler_random_max_pages INTEGER,
  scheduler_only_publish_approved BOOLEAN,
  scheduler_auto_include_in_sitemap BOOLEAN,
  launch_date DATE,
  reminder_banner_enabled BOOLEAN,
  admin_notes TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ses.pattern_pages_enabled, false),
    COALESCE(ses.situation_pages_enabled, false),
    COALESCE(ses.include_in_sitemap, false),
    COALESCE(ses.noindex_until_approved, true),
    COALESCE(ses.recommended_activation_months, 3),
    COALESCE(ses.scheduler_enabled, false),
    COALESCE(ses.scheduler_frequency, 'weekly'),
    COALESCE(ses.scheduler_page_count_mode, 'fixed'),
    COALESCE(ses.scheduler_fixed_page_count, 2),
    COALESCE(ses.scheduler_random_min_pages, 2),
    COALESCE(ses.scheduler_random_max_pages, 4),
    COALESCE(ses.scheduler_only_publish_approved, true),
    COALESCE(ses.scheduler_auto_include_in_sitemap, false),
    ses.launch_date,
    COALESCE(ses.reminder_banner_enabled, true),
    ses.admin_notes,
    ses.updated_at
  FROM (SELECT 1 as dummy) d
  LEFT JOIN seo_expansion_settings ses ON ses.id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_published_expansion_slugs
CREATE OR REPLACE FUNCTION get_published_expansion_slugs()
RETURNS TABLE (
  slug TEXT, 
  include_in_sitemap BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT sep.slug, sep.include_in_sitemap
  FROM seo_expansion_pages sep
  JOIN seo_expansion_settings ses ON ses.id = 1
  WHERE sep.is_published = true
  AND (ses.pattern_pages_enabled = true OR ses.situation_pages_enabled = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_sitemap_sync_status_secure
CREATE OR REPLACE FUNCTION get_sitemap_sync_status_secure()
RETURNS TABLE (
  published_pages_count INTEGER,
  pages_in_sitemap INTEGER,
  pages_not_in_sitemap INTEGER,
  last_sitemap_sync_at TIMESTAMPTZ,
  last_scheduler_run_at TIMESTAMPTZ,
  last_rebuild_triggered_at TIMESTAMPTZ,
  last_rebuild_status TEXT,
  estimated_completion_at TIMESTAMPTZ,
  is_pages_not_in_sitemap_exact BOOLEAN,
  is_last_sync_exact BOOLEAN
) AS $$
DECLARE
  v_published_count INTEGER;
  v_in_sitemap INTEGER;
  v_last_scheduler TIMESTAMPTZ;
  v_last_rebuild TIMESTAMPTZ;
  v_last_rebuild_status TEXT;
  v_estimated_completion TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*) INTO v_published_count 
  FROM seo_expansion_pages 
  WHERE is_published = true;
  
  SELECT COUNT(*) INTO v_in_sitemap 
  FROM seo_expansion_pages 
  WHERE is_published = true AND include_in_sitemap = true;
  
  SELECT MAX(created_at) INTO v_last_scheduler 
  FROM seo_expansion_scheduler_runs;
  
  SELECT triggered_at, status, estimated_completion_at 
  INTO v_last_rebuild, v_last_rebuild_status, v_estimated_completion
  FROM seo_expansion_rebuild_attempts 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RETURN QUERY SELECT
    v_published_count,
    v_in_sitemap,
    GREATEST(0, v_published_count - v_in_sitemap),
    v_last_rebuild,
    v_last_scheduler,
    v_last_rebuild,
    v_last_rebuild_status,
    v_estimated_completion,
    false,
    false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_seo_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_seo_expansion_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_published_expansion_slugs() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_sitemap_sync_status_secure() TO authenticated, anon, service_role;

-- ============================================================================
-- SECTION 7: CONTENT ACCESS FUNCTIONS (RPC-based filtering)
-- ============================================================================
-- IMPORTANT: These functions properly filter by starts_at, ends_at, target_audience
-- Frontend should use these RPCs instead of direct table access for public content

CREATE OR REPLACE FUNCTION get_active_announcements(
  p_placement TEXT, 
  p_user_id UUID DEFAULT NULL, 
  p_user_role TEXT DEFAULT 'anonymous'
)
RETURNS TABLE (
  id UUID, 
  title TEXT, 
  body TEXT, 
  announcement_type TEXT, 
  is_dismissible BOOLEAN, 
  cta_text TEXT, 
  cta_link TEXT, 
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id, 
    a.title, 
    a.body, 
    a.announcement_type, 
    a.is_dismissible, 
    a.cta_text, 
    a.cta_link, 
    a.priority
  FROM site_announcements a
  WHERE a.status = 'published'
  AND a.placement = p_placement
  AND (a.starts_at IS NULL OR a.starts_at <= now())
  AND (a.ends_at IS NULL OR a.ends_at >= now())
  AND (
    a.target_audience = 'all' 
    OR a.target_audience = p_user_role 
    OR (a.target_audience = 'logged_in' AND p_user_role != 'anonymous')
    OR (a.target_audience = 'paid' AND p_user_role IN ('monthly', 'lifetime', 'interviewPass'))
  )
  AND (
    p_user_id IS NULL 
    OR NOT a.is_dismissible 
    OR a.id NOT IN (
      SELECT cd.content_id 
      FROM content_dismissals cd 
      WHERE cd.user_id = p_user_id 
      AND cd.content_type = 'announcement'
    )
  )
  ORDER BY a.priority DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_trust_snippets(
  p_placement TEXT, 
  p_user_id UUID DEFAULT NULL, 
  p_user_role TEXT DEFAULT 'anonymous'
)
RETURNS TABLE (
  id UUID, 
  title TEXT, 
  subtitle TEXT, 
  icon_name TEXT, 
  cta_text TEXT, 
  cta_link TEXT, 
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, 
    s.title, 
    s.subtitle, 
    s.icon_name, 
    s.cta_text, 
    s.cta_link, 
    s.priority
  FROM site_trust_snippets s
  WHERE s.status = 'published'
  AND s.placement = p_placement
  AND (s.starts_at IS NULL OR s.starts_at <= now())
  AND (s.ends_at IS NULL OR s.ends_at >= now())
  AND (
    s.target_audience = 'all' 
    OR s.target_audience = p_user_role 
    OR (s.target_audience = 'logged_in' AND p_user_role != 'anonymous')
    OR (s.target_audience = 'paid' AND p_user_role IN ('monthly', 'lifetime', 'interviewPass'))
  )
  AND (
    p_user_id IS NULL 
    OR s.id NOT IN (
      SELECT cd.content_id 
      FROM content_dismissals cd 
      WHERE cd.user_id = p_user_id 
      AND cd.content_type = 'trust_snippet'
    )
  )
  ORDER BY s.priority DESC, s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_content_blocks(
  p_placement TEXT, 
  p_user_id UUID DEFAULT NULL, 
  p_user_role TEXT DEFAULT 'anonymous',
  p_group_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, 
  title TEXT, 
  body TEXT, 
  block_type TEXT, 
  group_key TEXT, 
  group_order INTEGER, 
  cta_text TEXT, 
  cta_link TEXT, 
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, 
    b.title, 
    b.body, 
    b.block_type, 
    b.group_key, 
    b.group_order, 
    b.cta_text, 
    b.cta_link, 
    b.priority
  FROM site_content_blocks b
  WHERE b.status = 'published'
  AND b.placement = p_placement
  AND (p_group_key IS NULL OR b.group_key = p_group_key)
  AND (b.starts_at IS NULL OR b.starts_at <= now())
  AND (b.ends_at IS NULL OR b.ends_at >= now())
  AND (
    b.target_audience = 'all' 
    OR b.target_audience = p_user_role 
    OR (b.target_audience = 'logged_in' AND p_user_role != 'anonymous')
    OR (b.target_audience = 'paid' AND p_user_role IN ('monthly', 'lifetime', 'interviewPass'))
  )
  AND (
    p_user_id IS NULL 
    OR b.id NOT IN (
      SELECT cd.content_id 
      FROM content_dismissals cd 
      WHERE cd.user_id = p_user_id 
      AND cd.content_type = 'content_block'
    )
  )
  ORDER BY b.priority DESC, b.group_order ASC, b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_active_announcements(TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_trust_snippets(TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_content_blocks(TEXT, UUID, TEXT, TEXT) TO authenticated, anon;

-- ============================================================================
-- SECTION 8: SPECIFIC GRANTS (NOT blanket grants)
-- ============================================================================

-- User profile access
GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- Subscription access
GRANT SELECT ON user_subscriptions TO authenticated;
GRANT ALL ON user_subscriptions TO service_role;

-- AI usage access
GRANT SELECT ON ai_daily_usage TO authenticated;
GRANT SELECT ON ai_session_tracking TO authenticated;
GRANT ALL ON ai_daily_usage TO service_role;
GRANT ALL ON ai_session_tracking TO service_role;

-- Content read access (but use RPCs for proper filtering)
GRANT SELECT ON site_announcements TO authenticated, anon;
GRANT SELECT ON site_trust_snippets TO authenticated, anon;
GRANT SELECT ON site_content_blocks TO authenticated, anon;
GRANT ALL ON site_announcements TO service_role;
GRANT ALL ON site_trust_snippets TO service_role;
GRANT ALL ON site_content_blocks TO service_role;

-- Content dismissals/interactions
GRANT SELECT, INSERT, DELETE ON content_dismissals TO authenticated;
GRANT SELECT, INSERT ON content_interactions TO authenticated, anon;
GRANT ALL ON content_dismissals TO service_role;
GRANT ALL ON content_interactions TO service_role;

-- Verification codes
GRANT SELECT ON site_verification_codes TO authenticated, anon, service_role;
GRANT ALL ON site_verification_codes TO service_role;

-- PDFs
GRANT SELECT ON pdf_assets TO authenticated, anon;
GRANT SELECT ON pdf_download_events TO authenticated;
GRANT SELECT ON pdf_download_summaries TO authenticated;
GRANT ALL ON pdf_assets TO service_role;
GRANT ALL ON pdf_download_events TO service_role;
GRANT ALL ON pdf_download_summaries TO service_role;

-- SEO
GRANT SELECT ON seo_settings TO authenticated, anon, service_role;
GRANT SELECT ON seo_expansion_settings TO authenticated, anon, service_role;
GRANT SELECT ON seo_expansion_pages TO authenticated, anon, service_role;
GRANT ALL ON seo_settings TO service_role;
GRANT ALL ON seo_expansion_settings TO service_role;
GRANT ALL ON seo_expansion_pages TO service_role;

-- Notifications
GRANT SELECT ON user_notifications TO authenticated;
GRANT ALL ON user_notifications TO service_role;

-- Promo codes
GRANT SELECT ON promo_codes TO authenticated, anon;
GRANT ALL ON promo_codes TO service_role;

-- Referral events
GRANT SELECT ON referral_events TO authenticated;
GRANT INSERT ON referral_events TO authenticated, anon;
GRANT ALL ON referral_events TO service_role;

-- ============================================================================
-- SECTION 9: FORCE SCHEMA RELOAD
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
SELECT 'Interview Ready Safe Patch Applied Successfully!' as status;
