-- ============================================================================
-- INTERVIEWREADY PATCH SQL - EXISTING PROJECTS (CORRECTED)
-- ============================================================================
-- For: Existing Supabase projects that need to update their schema
-- Created: 2026-03-15 (Corrected)
-- 
-- IMPORTANT FOR NON-CODERS:
-- 1. This file is for EXISTING Supabase projects only
-- 2. Run this in the Supabase SQL Editor
-- 3. This uses safe IF NOT EXISTS and CREATE OR REPLACE patterns
-- 4. After SQL setup, you STILL need to deploy Edge Functions, etc.
--
-- CORRECTIONS MADE:
-- - Fixed PDF download event statuses (added 'access_granted', 'denied')
-- - Added missing AI write functions (record_ai_session_start, record_ai_turn)
-- - Added missing SEO functions that were only being granted
-- - Fixed user_profiles RLS recursion using helper functions
-- - Added complete broadcast message functions
-- ============================================================================

-- ============================================================================
-- SECTION 1: FIXES TO EXISTING SCHEMA
-- ============================================================================

-- Fix PDF download events status values
ALTER TABLE IF EXISTS pdf_download_events 
DROP CONSTRAINT IF EXISTS pdf_download_events_event_status_check;

ALTER TABLE IF EXISTS pdf_download_events 
ADD CONSTRAINT pdf_download_events_event_status_check 
CHECK (event_status IN ('requested', 'access_granted', 'denied', 'served', 'completed_estimated'));

-- ============================================================================
-- SECTION 2: CORRECTED RLS POLICIES (NON-RECURSIVE)
-- ============================================================================

-- Create helper functions first (if not exists)
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

-- Drop and recreate user_profiles policies with correct syntax (no recursion)
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Superadmin can manage all profiles" ON user_profiles;

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Superadmin can manage all profiles" ON user_profiles
  FOR ALL TO authenticated USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

-- ============================================================================
-- SECTION 3: MISSING AI USAGE FUNCTIONS (APP DEPENDS ON THESE)
-- ============================================================================

-- DROP existing if any (to allow recreation)
DROP FUNCTION IF EXISTS record_ai_session_start(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS record_ai_turn(UUID, UUID, INTEGER);

-- MISSING FUNCTION ADDED: record_ai_session_start
CREATE OR REPLACE FUNCTION record_ai_session_start(
  p_user_id UUID,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_topic_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO ai_interviews (user_id, provider, model, topic_id, status, started_at)
  VALUES (p_user_id, p_provider, p_model, p_topic_id, 'active', now())
  RETURNING id INTO v_session_id;
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MISSING FUNCTION ADDED: record_ai_turn
CREATE OR REPLACE FUNCTION record_ai_turn(
  p_user_id UUID,
  p_session_id UUID,
  p_turn_count INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := to_char(now(), 'YYYY-MM');
  
  -- Increment the monthly AI usage count
  INSERT INTO ai_usage (user_id, month, questions_used, ai_interviews_used, updated_at)
  VALUES (p_user_id, v_current_month, p_turn_count, 0, now())
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    questions_used = ai_usage.questions_used + p_turn_count,
    updated_at = now();
    
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_ai_session_start(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_ai_turn(UUID, UUID, INTEGER) TO authenticated, service_role;

-- ============================================================================
-- SECTION 4: MISSING SEO FUNCTIONS (WERE ONLY GRANTED, NOT DEFINED)
-- ============================================================================

-- These functions were being GRANTed but never CREATED

CREATE OR REPLACE FUNCTION get_seo_settings()
RETURNS TABLE (sitemap_frequency TEXT, updated_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(ss.sitemap_frequency, 'weekly')::TEXT, ss.updated_at
  FROM (SELECT 1 as dummy) d
  LEFT JOIN seo_settings ss ON ss.id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION get_published_expansion_slugs()
RETURNS TABLE (slug TEXT, include_in_sitemap BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT sep.slug, sep.include_in_sitemap
  FROM seo_expansion_pages sep
  JOIN seo_expansion_settings ses ON ses.id = 1
  WHERE sep.is_published = true
  AND (ses.pattern_pages_enabled = true OR ses.situation_pages_enabled = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT COUNT(*) INTO v_published_count FROM seo_expansion_pages WHERE is_published = true;
  SELECT COUNT(*) INTO v_in_sitemap FROM seo_expansion_pages WHERE is_published = true AND include_in_sitemap = true;
  SELECT MAX(created_at) INTO v_last_scheduler FROM seo_expansion_scheduler_runs;
  SELECT triggered_at, status, estimated_completion_at 
  INTO v_last_rebuild, v_last_rebuild_status, v_estimated_completion
  FROM seo_expansion_rebuild_attempts ORDER BY created_at DESC LIMIT 1;
  
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
-- SECTION 5: NEW TABLES (IF NOT EXISTS)
-- ============================================================================

-- Content dismissals and analytics tables
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
CREATE POLICY IF NOT EXISTS "Users can view own dismissals" ON content_dismissals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users can create own dismissals" ON content_dismissals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Admins can view all dismissals" ON content_dismissals FOR SELECT TO authenticated USING (is_admin(auth.uid()));

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
CREATE POLICY IF NOT EXISTS "Anyone can record interactions" ON content_interactions FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admins can view analytics" ON content_interactions FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- Broadcast messages table (if missing)
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
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can view active broadcasts" ON broadcast_messages FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Admins can manage broadcasts" ON broadcast_messages FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY IF NOT EXISTS "Service role can manage broadcasts" ON broadcast_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 6: NEW/UPDATED FUNCTIONS
-- ============================================================================

-- Content dismissal functions
CREATE OR REPLACE FUNCTION get_dismissed_content_ids(p_user_id UUID, p_content_type TEXT, p_placement TEXT DEFAULT NULL)
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

CREATE OR REPLACE FUNCTION dismiss_content(p_user_id UUID, p_content_type TEXT, p_content_id UUID, p_placement TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO content_dismissals (user_id, content_type, content_id, placement)
  VALUES (p_user_id, p_content_type, p_content_id, p_placement)
  ON CONFLICT (user_id, content_type, content_id) DO NOTHING;
  
  INSERT INTO content_interactions (content_type, content_id, placement, interaction_type, user_id)
  VALUES (p_content_type, p_content_id, p_placement, 'dismiss', p_user_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMPLETE FUNCTION: publish_broadcast
CREATE OR REPLACE FUNCTION publish_broadcast(p_broadcast_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_broadcast RECORD;
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_broadcast FROM broadcast_messages WHERE id = p_broadcast_id;
  IF v_broadcast IS NULL OR NOT v_broadcast.is_active THEN
    RETURN 0;
  END IF;
  
  FOR v_user IN 
    SELECT u.id as user_id
    FROM auth.users u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
    WHERE CASE v_broadcast.audience_type
      WHEN 'all_users' THEN true
      WHEN 'trial_users' THEN s.plan_type = 'trial' OR s.user_id IS NULL
      WHEN 'premium_users' THEN s.plan_type IN ('monthly', 'lifetime', 'interviewPass') AND s.status = 'active'
      WHEN 'expired_users' THEN s.status = 'expired' OR (s.current_period_ends_at < now() AND s.status != 'active')
      WHEN 'free_users' THEN s.user_id IS NULL OR s.plan_type = 'trial'
      ELSE true
    END
  LOOP
    INSERT INTO user_notifications (user_id, type, title, message, metadata)
    VALUES (v_user.user_id, 'broadcast', v_broadcast.title, v_broadcast.message, jsonb_build_object('broadcast_id', p_broadcast_id));
    v_count := v_count + 1;
  END LOOP;
  
  UPDATE broadcast_messages SET sent_count = v_count WHERE id = p_broadcast_id;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 7: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_dismissed_content_ids(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_content(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_broadcast(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_seo_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_seo_expansion_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_published_expansion_slugs() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_sitemap_sync_status_secure() TO authenticated, anon, service_role;

-- ============================================================================
-- SECTION 8: FINAL CLEANUP
-- ============================================================================

-- Update existing promo codes that might be missing
INSERT INTO promo_codes (code, influencer_name, discount_percent, description)
VALUES 
  ('FRIENDS20', 'Friend Referral Program', 20, '20% off any plan - friends of existing customers'),
  ('YOUTUBE25', 'YouTube Partnership', 25, '25% off - YouTube influencer partnership'),
  ('TIKTOK30', 'TikTok Partnership', 30, '30% off - TikTok influencer partnership'),
  ('PODCAST15', 'Podcast Sponsorship', 15, '15% off - Podcast listener discount'),
  ('BLOG20', 'Blog/Website Partnership', 20, '20% off - Blog reader discount'),
  ('IMMIGRATIONHELP', 'Immigration Lawyer Partnership', 25, '25% off - Referral from immigration attorney'),
  ('ATTORNEY25', 'Legal Professional Referral', 25, '25% off - Attorney partnership program'),
  ('COMMUNITY10', 'Community Discount', 10, '10% off - Community member discount'),
  ('FACEBOOK15', 'Facebook Partnership', 15, '15% off - Facebook group member discount'),
  ('INSTAGRAM20', 'Instagram Partnership', 20, '20% off - Instagram follower discount'),
  ('VISA', 'Visa Journey Partnership', 25, '25% off - Visa Journey community partnership'),
  ('VISAJOURNEY', 'Visa Journey Community', 25, '25% off - Visa Journey community partnership')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
SELECT 'Interview Ready Database Patch Applied Successfully!' as status;
