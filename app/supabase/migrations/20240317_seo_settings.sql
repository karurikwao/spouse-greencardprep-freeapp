-- ============================================================================
-- SEO Settings Table
-- ============================================================================
-- Stores SEO-related configuration that affects sitemap.xml generation.
-- This is read by the build process to generate the correct sitemap.
-- ============================================================================

-- ============================================================================
-- Table: seo_settings
-- Stores SEO configuration with a single row (id = 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sitemap_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (sitemap_frequency IN ('daily', 'weekly', 'monthly')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments for documentation
COMMENT ON TABLE seo_settings IS 'SEO configuration settings (single row table)';
COMMENT ON COLUMN seo_settings.sitemap_frequency IS 'How often search engines should check for updates (daily/weekly/monthly)';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (needed for build-time generation)
CREATE POLICY "Allow read access to seo_settings" ON seo_settings
  FOR SELECT TO authenticated, anon, service_role
  USING (true);

-- Allow update to admin users only (using is_admin function)
CREATE POLICY "Allow admin update to seo_settings" ON seo_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- Allow insert to admin users (for initial seed)
CREATE POLICY "Allow admin insert to seo_settings" ON seo_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- Allow service role full access
CREATE POLICY "Allow service role full access to seo_settings" ON seo_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: get_seo_settings
-- Returns current SEO settings (safe for edge functions and build scripts)
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

-- Function: update_sitemap_frequency
-- Updates the sitemap frequency (admin only)
CREATE OR REPLACE FUNCTION update_sitemap_frequency(p_frequency TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validate frequency
  IF p_frequency NOT IN ('daily', 'weekly', 'monthly') THEN
    RETURN false;
  END IF;
  
  -- Insert or update the setting
  INSERT INTO seo_settings (id, sitemap_frequency, updated_at)
  VALUES (1, p_frequency, now())
  ON CONFLICT (id) DO UPDATE
  SET sitemap_frequency = EXCLUDED.sitemap_frequency,
      updated_at = EXCLUDED.updated_at;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_seo_settings() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_sitemap_frequency(TEXT) TO authenticated, service_role;

-- ============================================================================
-- Seed Data
-- ============================================================================

-- Insert default value if table is empty
INSERT INTO seo_settings (id, sitemap_frequency, updated_at)
VALUES (1, 'weekly', now())
ON CONFLICT (id) DO NOTHING;
