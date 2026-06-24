-- ============================================================================
-- SEO Expansion Rebuild Tracking
-- ============================================================================
-- Adds secure rebuild tracking for Coolify deployments.
-- 
-- SECURITY NOTES:
-- - Coolify webhook URL is stored server-side only (Edge Function env var)
-- - This table only tracks rebuild attempts, not the secret itself
-- - Frontend never sees the actual Coolify webhook URL
-- - All rebuild triggers go through secure Edge Function with admin auth
-- ============================================================================

-- ============================================================================
-- Table: seo_expansion_rebuild_attempts
-- Audit log for rebuild trigger attempts (Coolify deployments)
-- ============================================================================
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

COMMENT ON TABLE seo_expansion_rebuild_attempts IS 'Audit log for Coolify rebuild trigger attempts';
COMMENT ON COLUMN seo_expansion_rebuild_attempts.status IS 'Status: pending, triggered (sent to Coolify), or error';
COMMENT ON COLUMN seo_expansion_rebuild_attempts.reason IS 'Why the rebuild was triggered';
COMMENT ON COLUMN seo_expansion_rebuild_attempts.source IS 'Source of trigger (admin_dashboard, scheduler, etc.)';

-- Index for recent attempts
CREATE INDEX IF NOT EXISTS idx_rebuild_attempts_created_at ON seo_expansion_rebuild_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rebuild_attempts_status ON seo_expansion_rebuild_attempts(status);

-- ============================================================================
-- RLS Policies for rebuild_attempts
-- ============================================================================
ALTER TABLE seo_expansion_rebuild_attempts ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (admins will see all)
CREATE POLICY "Allow read access to rebuild attempts" ON seo_expansion_rebuild_attempts
  FOR SELECT TO authenticated, service_role
  USING (true);

-- Only service role or admin via function can insert
CREATE POLICY "Allow service role full access to rebuild attempts" ON seo_expansion_rebuild_attempts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Function: record_rebuild_attempt
-- Records a rebuild trigger attempt
-- ============================================================================
CREATE OR REPLACE FUNCTION record_rebuild_attempt(
  p_triggered_by UUID,
  p_triggered_at TIMESTAMPTZ,
  p_status TEXT DEFAULT 'pending',
  p_reason TEXT DEFAULT 'admin_triggered',
  p_source TEXT DEFAULT 'admin_dashboard',
  p_error TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
  v_estimated_completion TIMESTAMPTZ;
BEGIN
  -- Estimate completion (3 minutes from trigger)
  v_estimated_completion := p_triggered_at + interval '3 minutes';
  
  INSERT INTO seo_expansion_rebuild_attempts (
    triggered_by, triggered_at, status, reason, source, error_message, estimated_completion_at
  ) VALUES (
    p_triggered_by, p_triggered_at, p_status, p_reason, p_source, p_error, v_estimated_completion
  )
  RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_latest_rebuild_attempt
-- Returns the most recent rebuild attempt for status display
-- ============================================================================
CREATE OR REPLACE FUNCTION get_latest_rebuild_attempt()
RETURNS TABLE (
  id UUID,
  triggered_by UUID,
  triggered_at TIMESTAMPTZ,
  status TEXT,
  reason TEXT,
  source TEXT,
  error_message TEXT,
  estimated_completion_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sera.id,
    sera.triggered_by,
    sera.triggered_at,
    sera.status,
    sera.reason,
    sera.source,
    sera.error_message,
    sera.estimated_completion_at,
    sera.created_at
  FROM seo_expansion_rebuild_attempts sera
  ORDER BY sera.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_rebuild_attempt_history
-- Returns recent rebuild attempts
-- ============================================================================
CREATE OR REPLACE FUNCTION get_rebuild_attempt_history(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  triggered_by UUID,
  triggered_at TIMESTAMPTZ,
  status TEXT,
  reason TEXT,
  source TEXT,
  error_message TEXT,
  estimated_completion_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sera.id,
    sera.triggered_by,
    sera.triggered_at,
    sera.status,
    sera.reason,
    sera.source,
    sera.error_message,
    sera.estimated_completion_at,
    sera.created_at
  FROM seo_expansion_rebuild_attempts sera
  ORDER BY sera.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_sitemap_sync_status_secure
-- Returns honest status about sitemap/rebuild state
-- 
-- NOTE: This provides ESTIMATES, not exact values:
-- - published_pages_count = exact (from database)
-- - pages_not_in_sitemap = estimated (based on last known sync)
-- - last_sitemap_sync_at = last known build time (not guaranteed current)
-- ============================================================================
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
  -- Honest labels for UI
  is_pages_not_in_sitemap_exact BOOLEAN,
  is_last_sync_exact BOOLEAN
) AS $$
DECLARE
  v_published_count INTEGER;
  v_in_sitemap INTEGER;
  v_last_sync TIMESTAMPTZ;
  v_last_scheduler TIMESTAMPTZ;
  v_last_rebuild TIMESTAMPTZ;
  v_last_rebuild_status TEXT;
  v_estimated_completion TIMESTAMPTZ;
BEGIN
  -- Count published pages (exact)
  SELECT COUNT(*) INTO v_published_count
  FROM seo_expansion_pages
  WHERE is_published = true;
  
  -- Count pages marked for sitemap inclusion (exact from DB)
  SELECT COUNT(*) INTO v_in_sitemap
  FROM seo_expansion_pages
  WHERE is_published = true AND include_in_sitemap = true;
  
  -- Last scheduler run
  SELECT MAX(created_at) INTO v_last_scheduler
  FROM seo_expansion_scheduler_runs;
  
  -- Last rebuild attempt
  SELECT triggered_at, status, estimated_completion_at
  INTO v_last_rebuild, v_last_rebuild_status, v_estimated_completion
  FROM seo_expansion_rebuild_attempts
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- We don't know the exact last sitemap sync time
  -- We use the last successful rebuild trigger as an estimate
  v_last_sync := v_last_rebuild;
  
  RETURN QUERY
  SELECT 
    v_published_count,
    v_in_sitemap,
    GREATEST(0, v_published_count - v_in_sitemap), -- Estimated pages waiting
    v_last_sync,
    v_last_scheduler,
    v_last_rebuild,
    v_last_rebuild_status,
    v_estimated_completion,
    -- Honesty flags
    false, -- pages_not_in_sitemap is estimated
    false  -- last_sync is estimated (based on trigger, not confirmed completion)
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION record_rebuild_attempt(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_latest_rebuild_attempt() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_rebuild_attempt_history(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_sitemap_sync_status_secure() TO authenticated, anon, service_role;

-- ============================================================================
-- Cleanup: Remove any old deploy_webhook columns if they existed
-- These are no longer needed since webhook is stored in Edge Function env
-- ============================================================================

-- Remove deploy_webhook_url and deploy_webhook_enabled from settings if they exist
DO $$
BEGIN
  -- Check if columns exist and drop them
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seo_expansion_settings' 
    AND column_name = 'deploy_webhook_url'
  ) THEN
    ALTER TABLE seo_expansion_settings DROP COLUMN deploy_webhook_url;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seo_expansion_settings' 
    AND column_name = 'deploy_webhook_enabled'
  ) THEN
    ALTER TABLE seo_expansion_settings DROP COLUMN deploy_webhook_enabled;
  END IF;
  
  -- Also clean up sitemap_sync table if it had these columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seo_expansion_sitemap_sync' 
    AND column_name = 'deploy_webhook_url'
  ) THEN
    ALTER TABLE seo_expansion_sitemap_sync DROP COLUMN deploy_webhook_url;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seo_expansion_sitemap_sync' 
    AND column_name = 'deploy_webhook_enabled'
  ) THEN
    ALTER TABLE seo_expansion_sitemap_sync DROP COLUMN deploy_webhook_enabled;
  END IF;
END $$;

COMMENT ON FUNCTION get_sitemap_sync_status_secure() IS 
'Returns honest estimates about sitemap/rebuild status. Pages not in sitemap and last sync time are estimates based on last known rebuild trigger, not confirmed completion.';
