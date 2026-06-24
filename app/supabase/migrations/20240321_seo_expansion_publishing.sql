-- ============================================================================
-- SEO Expansion Publishing System
-- ============================================================================
-- This migration creates tables for managing SEO expansion page publishing
-- with proper audit trails and admin controls.
-- 
-- IMPORTANT: This replaces localStorage as the source of truth for:
-- - publication state
-- - reviewed / approved status
-- - publish / unpublish actions
-- - sitemap inclusion
-- - noindex settings
-- - scheduler settings
-- - rollout execution history
-- ============================================================================

-- ============================================================================
-- Table: seo_expansion_settings
-- Stores global SEO expansion configuration (single row)
-- ============================================================================
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE seo_expansion_settings IS 'Global SEO expansion publishing configuration';
COMMENT ON COLUMN seo_expansion_settings.pattern_pages_enabled IS 'Master toggle for pattern pages feature';
COMMENT ON COLUMN seo_expansion_settings.situation_pages_enabled IS 'Master toggle for situation pages feature';
COMMENT ON COLUMN seo_expansion_settings.include_in_sitemap IS 'Whether published expansion pages should be in sitemap';
COMMENT ON COLUMN seo_expansion_settings.noindex_until_approved IS 'Apply noindex meta tag to expansion pages by default';

-- ============================================================================
-- Table: seo_expansion_pages
-- Stores publication state for each expansion page
-- ============================================================================
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

COMMENT ON TABLE seo_expansion_pages IS 'Publication state for individual SEO expansion pages';
COMMENT ON COLUMN seo_expansion_pages.slug IS 'URL slug for the page';
COMMENT ON COLUMN seo_expansion_pages.page_type IS 'Type: pattern or situation page';
COMMENT ON COLUMN seo_expansion_pages.parent_cluster IS 'Content cluster this page belongs to';
COMMENT ON COLUMN seo_expansion_pages.status IS 'Publication workflow status';
COMMENT ON COLUMN seo_expansion_pages.is_published IS 'Whether page is publicly accessible';

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_seo_expansion_pages_status ON seo_expansion_pages(status);
CREATE INDEX IF NOT EXISTS idx_seo_expansion_pages_type ON seo_expansion_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_seo_expansion_pages_published ON seo_expansion_pages(is_published) WHERE is_published = true;

-- ============================================================================
-- Table: seo_expansion_scheduler_runs
-- Audit log for scheduler execution
-- ============================================================================
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

COMMENT ON TABLE seo_expansion_scheduler_runs IS 'Audit log for scheduler execution history';

-- Index for recent runs
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_created_at ON seo_expansion_scheduler_runs(created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE seo_expansion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_expansion_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_expansion_scheduler_runs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_seo_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- seo_expansion_settings policies
CREATE POLICY "Allow read access to seo_expansion_settings" ON seo_expansion_settings
  FOR SELECT TO authenticated, anon, service_role
  USING (true);

CREATE POLICY "Allow admin update to seo_expansion_settings" ON seo_expansion_settings
  FOR ALL TO authenticated
  USING (is_seo_admin())
  WITH CHECK (is_seo_admin());

CREATE POLICY "Allow service role full access to seo_expansion_settings" ON seo_expansion_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- seo_expansion_pages policies
CREATE POLICY "Allow read access to seo_expansion_pages" ON seo_expansion_pages
  FOR SELECT TO authenticated, anon, service_role
  USING (true);

CREATE POLICY "Allow admin update to seo_expansion_pages" ON seo_expansion_pages
  FOR ALL TO authenticated
  USING (is_seo_admin())
  WITH CHECK (is_seo_admin());

CREATE POLICY "Allow service role full access to seo_expansion_pages" ON seo_expansion_pages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- seo_expansion_scheduler_runs policies
CREATE POLICY "Allow read access to scheduler runs" ON seo_expansion_scheduler_runs
  FOR SELECT TO authenticated, service_role
  USING (true);

CREATE POLICY "Allow admin insert to scheduler runs" ON seo_expansion_scheduler_runs
  FOR INSERT TO authenticated
  WITH CHECK (is_seo_admin());

CREATE POLICY "Allow service role full access to scheduler runs" ON seo_expansion_scheduler_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: get_seo_expansion_settings
-- Returns current expansion settings
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

-- Function: get_seo_expansion_pages
-- Returns all expansion pages with their publication state
CREATE OR REPLACE FUNCTION get_seo_expansion_pages()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  page_type TEXT,
  parent_cluster TEXT,
  status TEXT,
  is_enabled BOOLEAN,
  is_published BOOLEAN,
  include_in_sitemap BOOLEAN,
  noindex_override BOOLEAN,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  published_at TIMESTAMPTZ,
  published_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sep.id,
    sep.slug,
    sep.page_type,
    sep.parent_cluster,
    sep.status,
    sep.is_enabled,
    sep.is_published,
    sep.include_in_sitemap,
    sep.noindex_override,
    sep.reviewed_at,
    sep.reviewed_by,
    sep.approved_at,
    sep.approved_by,
    sep.published_at,
    sep.published_by,
    sep.notes,
    sep.created_at
  FROM seo_expansion_pages sep
  ORDER BY sep.page_type, sep.slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_seo_expansion_page_status
-- Updates a page's publication status
CREATE OR REPLACE FUNCTION update_seo_expansion_page_status(
  p_slug TEXT,
  p_status TEXT,
  p_include_in_sitemap BOOLEAN DEFAULT false,
  p_noindex_override BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Validate status
  IF p_status NOT IN ('draft', 'reviewed', 'approved', 'published', 'unpublished') THEN
    RETURN false;
  END IF;
  
  -- Update the page
  UPDATE seo_expansion_pages
  SET 
    status = p_status,
    is_enabled = (p_status = 'published'),
    is_published = (p_status = 'published'),
    include_in_sitemap = p_include_in_sitemap,
    noindex_override = p_noindex_override,
    notes = COALESCE(p_notes, notes),
    reviewed_at = CASE WHEN p_status = 'reviewed' THEN now() ELSE reviewed_at END,
    reviewed_by = CASE WHEN p_status = 'reviewed' THEN v_user_id ELSE reviewed_by END,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN p_status = 'approved' THEN v_user_id ELSE approved_by END,
    published_at = CASE WHEN p_status = 'published' THEN now() ELSE published_at END,
    published_by = CASE WHEN p_status = 'published' THEN v_user_id ELSE published_by END,
    unpublished_at = CASE WHEN p_status = 'unpublished' THEN now() ELSE unpublished_at END,
    unpublished_by = CASE WHEN p_status = 'unpublished' THEN v_user_id ELSE unpublished_by END,
    updated_at = now()
  WHERE slug = p_slug;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: bulk_update_seo_expansion_pages
-- Updates multiple pages at once
CREATE OR REPLACE FUNCTION bulk_update_seo_expansion_pages(
  p_slugs TEXT[],
  p_status TEXT,
  p_include_in_sitemap BOOLEAN DEFAULT false
)
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER := 0;
  v_slug TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF p_status NOT IN ('reviewed', 'approved', 'published', 'unpublished') THEN
    RETURN 0;
  END IF;
  
  FOREACH v_slug IN ARRAY p_slugs
  LOOP
    UPDATE seo_expansion_pages
    SET 
      status = p_status,
      is_enabled = (p_status = 'published'),
      is_published = (p_status = 'published'),
      include_in_sitemap = CASE WHEN p_status = 'published' THEN p_include_in_sitemap ELSE include_in_sitemap END,
      reviewed_at = CASE WHEN p_status = 'reviewed' THEN now() ELSE reviewed_at END,
      reviewed_by = CASE WHEN p_status = 'reviewed' THEN v_user_id ELSE reviewed_by END,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
      approved_by = CASE WHEN p_status = 'approved' THEN v_user_id ELSE approved_by END,
      published_at = CASE WHEN p_status = 'published' THEN now() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_user_id ELSE published_by END,
      unpublished_at = CASE WHEN p_status = 'unpublished' THEN now() ELSE unpublished_at END,
      unpublished_by = CASE WHEN p_status = 'unpublished' THEN v_user_id ELSE unpublished_by END,
      updated_at = now()
    WHERE slug = v_slug;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: save_seo_expansion_settings
-- Saves global expansion settings
CREATE OR REPLACE FUNCTION save_seo_expansion_settings(
  p_pattern_pages_enabled BOOLEAN DEFAULT false,
  p_situation_pages_enabled BOOLEAN DEFAULT false,
  p_include_in_sitemap BOOLEAN DEFAULT false,
  p_noindex_until_approved BOOLEAN DEFAULT true,
  p_recommended_activation_months INTEGER DEFAULT 3,
  p_scheduler_enabled BOOLEAN DEFAULT false,
  p_scheduler_frequency TEXT DEFAULT 'weekly',
  p_scheduler_page_count_mode TEXT DEFAULT 'fixed',
  p_scheduler_fixed_page_count INTEGER DEFAULT 2,
  p_scheduler_random_min_pages INTEGER DEFAULT 2,
  p_scheduler_random_max_pages INTEGER DEFAULT 4,
  p_scheduler_only_publish_approved BOOLEAN DEFAULT true,
  p_scheduler_auto_include_in_sitemap BOOLEAN DEFAULT false,
  p_launch_date DATE DEFAULT NULL,
  p_reminder_banner_enabled BOOLEAN DEFAULT true,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO seo_expansion_settings (
    id, pattern_pages_enabled, situation_pages_enabled, include_in_sitemap,
    noindex_until_approved, recommended_activation_months, scheduler_enabled,
    scheduler_frequency, scheduler_page_count_mode, scheduler_fixed_page_count,
    scheduler_random_min_pages, scheduler_random_max_pages,
    scheduler_only_publish_approved, scheduler_auto_include_in_sitemap,
    launch_date, reminder_banner_enabled, admin_notes, updated_at, updated_by
  ) VALUES (
    1, p_pattern_pages_enabled, p_situation_pages_enabled, p_include_in_sitemap,
    p_noindex_until_approved, p_recommended_activation_months, p_scheduler_enabled,
    p_scheduler_frequency, p_scheduler_page_count_mode, p_scheduler_fixed_page_count,
    p_scheduler_random_min_pages, p_scheduler_random_max_pages,
    p_scheduler_only_publish_approved, p_scheduler_auto_include_in_sitemap,
    p_launch_date, p_reminder_banner_enabled, p_admin_notes, now(), auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    pattern_pages_enabled = EXCLUDED.pattern_pages_enabled,
    situation_pages_enabled = EXCLUDED.situation_pages_enabled,
    include_in_sitemap = EXCLUDED.include_in_sitemap,
    noindex_until_approved = EXCLUDED.noindex_until_approved,
    recommended_activation_months = EXCLUDED.recommended_activation_months,
    scheduler_enabled = EXCLUDED.scheduler_enabled,
    scheduler_frequency = EXCLUDED.scheduler_frequency,
    scheduler_page_count_mode = EXCLUDED.scheduler_page_count_mode,
    scheduler_fixed_page_count = EXCLUDED.scheduler_fixed_page_count,
    scheduler_random_min_pages = EXCLUDED.scheduler_random_min_pages,
    scheduler_random_max_pages = EXCLUDED.scheduler_random_max_pages,
    scheduler_only_publish_approved = EXCLUDED.scheduler_only_publish_approved,
    scheduler_auto_include_in_sitemap = EXCLUDED.scheduler_auto_include_in_sitemap,
    launch_date = EXCLUDED.launch_date,
    reminder_banner_enabled = EXCLUDED.reminder_banner_enabled,
    admin_notes = EXCLUDED.admin_notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: record_scheduler_run
-- Records a scheduler execution
CREATE OR REPLACE FUNCTION record_scheduler_run(
  p_triggered_manually BOOLEAN DEFAULT true,
  p_pages_considered INTEGER DEFAULT 0,
  p_pages_published INTEGER DEFAULT 0,
  p_published_slugs TEXT[] DEFAULT '{}',
  p_sitemap_included BOOLEAN DEFAULT false,
  p_noindex_respected BOOLEAN DEFAULT true,
  p_only_approved_published BOOLEAN DEFAULT true,
  p_execution_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  INSERT INTO seo_expansion_scheduler_runs (
    triggered_by, triggered_manually, pages_considered, pages_published,
    published_slugs, sitemap_included, noindex_respected, only_approved_published,
    execution_duration_ms, error_message
  ) VALUES (
    auth.uid(), p_triggered_manually, p_pages_considered, p_pages_published,
    p_published_slugs, p_sitemap_included, p_noindex_respected, p_only_approved_published,
    p_execution_duration_ms, p_error_message
  )
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_scheduler_run_history
-- Returns recent scheduler runs
CREATE OR REPLACE FUNCTION get_scheduler_run_history(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  triggered_by UUID,
  triggered_manually BOOLEAN,
  pages_considered INTEGER,
  pages_published INTEGER,
  published_slugs TEXT[],
  sitemap_included BOOLEAN,
  noindex_respected BOOLEAN,
  only_approved_published BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sesr.id,
    sesr.triggered_by,
    sesr.triggered_manually,
    sesr.pages_considered,
    sesr.pages_published,
    sesr.published_slugs,
    sesr.sitemap_included,
    sesr.noindex_respected,
    sesr.only_approved_published,
    sesr.created_at
  FROM seo_expansion_scheduler_runs sesr
  ORDER BY sesr.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: should_expansion_page_be_public
-- Determines if a specific page should be publicly accessible
CREATE OR REPLACE FUNCTION should_expansion_page_be_public(p_slug TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_settings seo_expansion_settings%ROWTYPE;
  v_page seo_expansion_pages%ROWTYPE;
BEGIN
  -- Get settings
  SELECT * INTO v_settings FROM seo_expansion_settings WHERE id = 1;
  
  -- If expansion features are disabled, no pages are public
  IF NOT COALESCE(v_settings.pattern_pages_enabled, false) 
     AND NOT COALESCE(v_settings.situation_pages_enabled, false) THEN
    RETURN false;
  END IF;
  
  -- Get page
  SELECT * INTO v_page FROM seo_expansion_pages WHERE slug = p_slug;
  
  -- Page must exist and be published
  IF v_page.id IS NULL OR NOT v_page.is_published THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_published_expansion_slugs
-- Returns all published expansion page slugs for sitemap generation
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

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_seo_expansion_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_seo_expansion_pages() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_seo_expansion_page_status(TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bulk_update_seo_expansion_pages(TEXT[], TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION save_seo_expansion_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN, DATE, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_scheduler_run(BOOLEAN, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_scheduler_run_history(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION should_expansion_page_be_public(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_published_expansion_slugs() TO authenticated, anon, service_role;

-- ============================================================================
-- Seed Data
-- ============================================================================

-- Insert default settings
INSERT INTO seo_expansion_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Seed expansion pages from known configuration
-- Pattern pages
INSERT INTO seo_expansion_pages (slug, page_type, parent_cluster, status, is_enabled, is_published)
VALUES
  ('met-online-dating-uscis-interview', 'pattern', 'relationship-history', 'draft', false, false),
  ('met-through-friends-uscis-interview', 'pattern', 'relationship-history', 'draft', false, false),
  ('courthouse-wedding-uscis-interview', 'pattern', 'wedding-ceremony', 'draft', false, false),
  ('small-wedding-few-guests-uscis', 'pattern', 'wedding-ceremony', 'draft', false, false),
  ('no-joint-bank-account-uscis', 'pattern', 'finances', 'draft', false, false),
  ('shared-bank-account-uscis-interview', 'pattern', 'finances', 'draft', false, false),
  ('living-apart-temporarily-uscis', 'pattern', 'living-together', 'draft', false, false),
  ('different-work-schedules-uscis', 'pattern', 'living-together', 'draft', false, false),
  ('parents-never-met-uscis-interview', 'pattern', 'family-social', 'draft', false, false),
  ('spouse-not-close-to-family-uscis', 'pattern', 'family-social', 'draft', false, false)
ON CONFLICT (slug) DO NOTHING;

-- Situation pages
INSERT INTO seo_expansion_pages (slug, page_type, parent_cluster, status, is_enabled, is_published)
VALUES
  ('couples-who-met-online-green-card-interview', 'situation', 'relationship-history', 'draft', false, false),
  ('courthouse-wedding-couples-green-card', 'situation', 'wedding-ceremony', 'draft', false, false),
  ('long-distance-couples-green-card-interview', 'situation', 'relationship-history', 'draft', false, false),
  ('couples-without-joint-accounts-green-card', 'situation', 'finances', 'draft', false, false),
  ('couples-living-apart-temporarily-green-card', 'situation', 'living-together', 'draft', false, false),
  ('older-couples-green-card-interview', 'situation', 'family-social', 'draft', false, false)
ON CONFLICT (slug) DO NOTHING;
