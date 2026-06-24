-- ============================================================================
-- SEO Expansion Deploy Hooks and Sitemap Tracking
-- ============================================================================
-- This migration adds:
-- 1. Sitemap sync tracking fields
-- 2. Deploy webhook configuration
-- 3. Functions for triggering rebuilds
-- ============================================================================

-- ============================================================================
-- Add columns to seo_expansion_settings for deploy webhook
-- ============================================================================
ALTER TABLE seo_expansion_settings
ADD COLUMN IF NOT EXISTS deploy_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS deploy_webhook_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_sitemap_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_deploy_triggered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_deploy_status TEXT CHECK (last_deploy_status IN ('pending', 'success', 'error'));

COMMENT ON COLUMN seo_expansion_settings.deploy_webhook_url IS 'Optional webhook URL for triggering site rebuild (Netlify/Vercel/etc)';
COMMENT ON COLUMN seo_expansion_settings.deploy_webhook_enabled IS 'Whether the deploy webhook is enabled';
COMMENT ON COLUMN seo_expansion_settings.last_sitemap_sync_at IS 'When the sitemap was last synced from Supabase';
COMMENT ON COLUMN seo_expansion_settings.last_deploy_triggered_at IS 'When the last deploy was triggered';
COMMENT ON COLUMN seo_expansion_settings.last_deploy_status IS 'Status of the last deploy attempt';

-- ============================================================================
-- Add columns to seo_expansion_pages for tracking sitemap inclusion
-- ============================================================================
ALTER TABLE seo_expansion_pages
ADD COLUMN IF NOT EXISTS sitemap_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_in_live_sitemap BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN seo_expansion_pages.sitemap_synced_at IS 'When this page was last included in a built sitemap';
COMMENT ON COLUMN seo_expansion_pages.is_in_live_sitemap IS 'Whether this page is currently in the live sitemap';

-- ============================================================================
-- Function: get_sitemap_sync_status
-- Returns current sitemap sync status for admin display
-- ============================================================================
CREATE OR REPLACE FUNCTION get_sitemap_sync_status()
RETURNS TABLE (
  last_sitemap_sync_at TIMESTAMPTZ,
  last_deploy_triggered_at TIMESTAMPTZ,
  last_deploy_status TEXT,
  deploy_webhook_url TEXT,
  deploy_webhook_enabled BOOLEAN,
  published_pages_count BIGINT,
  pages_not_in_sitemap BIGINT,
  last_scheduler_run_at TIMESTAMPTZ
) AS $$
DECLARE
  v_last_scheduler_run TIMESTAMPTZ;
BEGIN
  -- Get last scheduler run
  SELECT MAX(created_at) INTO v_last_scheduler_run
  FROM seo_expansion_scheduler_runs;
  
  RETURN QUERY
  SELECT 
    ses.last_sitemap_sync_at,
    ses.last_deploy_triggered_at,
    ses.last_deploy_status,
    ses.deploy_webhook_url,
    ses.deploy_webhook_enabled,
    COUNT(sep.id) FILTER (WHERE sep.is_published = true) as published_pages_count,
    COUNT(sep.id) FILTER (WHERE sep.is_published = true AND sep.include_in_sitemap = true AND sep.is_in_live_sitemap = false) as pages_not_in_sitemap,
    v_last_scheduler_run as last_scheduler_run_at
  FROM seo_expansion_settings ses
  CROSS JOIN seo_expansion_pages sep
  WHERE ses.id = 1
  GROUP BY ses.last_sitemap_sync_at, ses.last_deploy_triggered_at, ses.last_deploy_status,
           ses.deploy_webhook_url, ses.deploy_webhook_enabled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: update_sitemap_sync_time
-- Updates the last sitemap sync timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sitemap_sync_time()
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE seo_expansion_settings
  SET last_sitemap_sync_at = now(),
      updated_at = now()
  WHERE id = 1;
  
  -- Mark all published pages with include_in_sitemap=true as synced
  UPDATE seo_expansion_pages
  SET sitemap_synced_at = now(),
      is_in_live_sitemap = true,
      updated_at = now()
  WHERE is_published = true 
    AND include_in_sitemap = true
    AND (is_in_live_sitemap = false OR sitemap_synced_at IS NULL);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: record_deploy_attempt
-- Records a deploy attempt and its status
-- ============================================================================
CREATE OR REPLACE FUNCTION record_deploy_attempt(
  p_status TEXT DEFAULT 'pending'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE seo_expansion_settings
  SET last_deploy_triggered_at = now(),
      last_deploy_status = p_status,
      updated_at = now()
  WHERE id = 1;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: save_deploy_webhook_config
-- Saves deploy webhook configuration
-- ============================================================================
CREATE OR REPLACE FUNCTION save_deploy_webhook_config(
  p_webhook_url TEXT,
  p_enabled BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE seo_expansion_settings
  SET deploy_webhook_url = p_webhook_url,
      deploy_webhook_enabled = p_enabled,
      updated_at = now()
  WHERE id = 1;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_sitemap_sync_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_sitemap_sync_time() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_deploy_attempt(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION save_deploy_webhook_config(TEXT, BOOLEAN) TO authenticated, service_role;
