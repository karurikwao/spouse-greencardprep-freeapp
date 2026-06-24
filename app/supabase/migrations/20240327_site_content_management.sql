-- ============================================================================
-- Site Content Management System
-- 
-- Tables:
-- 1. site_announcements - Admin-controlled announcements
-- 2. site_trust_snippets - Verification/trust badges and statements
-- 3. site_content_blocks - Reusable rich content blocks
-- ============================================================================

-- ============================================================================
-- Table: site_announcements
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  
  -- Type/Style
  announcement_type TEXT NOT NULL DEFAULT 'info' 
    CHECK (announcement_type IN ('info', 'success', 'warning', 'update', 'promo')),
  
  -- Placement - where to show it
  placement TEXT NOT NULL DEFAULT 'global.banner'
    CHECK (placement IN (
      'global.banner',
      'home.hero',
      'home.trust',
      'home.faq',
      'pricing.top',
      'pricing.after_comparison',
      'dashboard.top',
      'dashboard.sidebar',
      'topics.detail',
      'auth.login',
      'auth.signup',
      'account.top',
      'checkout.info'
    )),
  
  -- Audience targeting
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN (
      'all',
      'anonymous',
      'logged_in',
      'trial',
      'paid',
      'expired',
      'admin'
    )),
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Priority for ordering (higher = first)
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Dismissible by users
  is_dismissible BOOLEAN NOT NULL DEFAULT false,
  
  -- Optional CTA
  cta_text TEXT,
  cta_link TEXT,
  
  -- Scheduling
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- View tracking
  view_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_announcements_placement ON site_announcements(placement);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON site_announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON site_announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON site_announcements(priority DESC);

-- Comments
COMMENT ON TABLE site_announcements IS 'Admin-controlled announcements displayed across the site';
COMMENT ON COLUMN site_announcements.announcement_type IS 'Visual style: info, success, warning, update, promo';
COMMENT ON COLUMN site_announcements.placement IS 'Where on the site to show the announcement';
COMMENT ON COLUMN site_announcements.target_audience IS 'Who should see this announcement';
COMMENT ON COLUMN site_announcements.status IS 'draft = hidden, published = visible, archived = inactive';
COMMENT ON COLUMN site_announcements.is_dismissible IS 'Whether users can dismiss this announcement';

-- ============================================================================
-- Table: site_trust_snippets
-- Verification/trust badges and factual statements
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_trust_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL,
  subtitle TEXT,
  
  -- Icon reference (using Lucide icon names)
  icon_name TEXT DEFAULT 'Shield',
  
  -- Placement
  placement TEXT NOT NULL DEFAULT 'home.trust'
    CHECK (placement IN (
      'home.trust',
      'home.faq',
      'pricing.top',
      'pricing.after_comparison',
      'dashboard.sidebar',
      'auth.login',
      'auth.signup',
      'account.top',
      'checkout.info',
      'global.footer'
    )),
  
  -- Audience targeting
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN (
      'all',
      'anonymous',
      'logged_in',
      'trial',
      'paid',
      'expired'
    )),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Priority for ordering
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Optional CTA
  cta_text TEXT,
  cta_link TEXT,
  
  -- Scheduling
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trust_snippets_placement ON site_trust_snippets(placement);
CREATE INDEX IF NOT EXISTS idx_trust_snippets_status ON site_trust_snippets(status);
CREATE INDEX IF NOT EXISTS idx_trust_snippets_audience ON site_trust_snippets(target_audience);
CREATE INDEX IF NOT EXISTS idx_trust_snippets_priority ON site_trust_snippets(priority DESC);

COMMENT ON TABLE site_trust_snippets IS 'Trust and verification snippets - factual statements only';
COMMENT ON COLUMN site_trust_snippets.icon_name IS 'Lucide icon name (e.g., Shield, Lock, CheckCircle)';

-- ============================================================================
-- Table: site_content_blocks
-- Rich content blocks for FAQs, explanations, how-tos
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  
  -- Block type determines styling/purpose
  block_type TEXT NOT NULL DEFAULT 'info'
    CHECK (block_type IN (
      'info',
      'faq',
      'comparison',
      'steps',
      'warning',
      'success',
      'promo',
      'note'
    )),
  
  -- Grouping for related items (e.g., FAQ sections)
  group_key TEXT,
  group_order INTEGER DEFAULT 0,
  
  -- Placement
  placement TEXT NOT NULL DEFAULT 'home.faq'
    CHECK (placement IN (
      'home.hero',
      'home.trust',
      'home.faq',
      'pricing.top',
      'pricing.after_comparison',
      'dashboard.top',
      'dashboard.sidebar',
      'topics.detail',
      'account.top',
      'checkout.info'
    )),
  
  -- Audience targeting
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN (
      'all',
      'anonymous',
      'logged_in',
      'trial',
      'paid',
      'expired'
    )),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Priority for ordering within placement
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Optional CTA
  cta_text TEXT,
  cta_link TEXT,
  
  -- Scheduling
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_placement ON site_content_blocks(placement);
CREATE INDEX IF NOT EXISTS idx_content_blocks_status ON site_content_blocks(status);
CREATE INDEX IF NOT EXISTS idx_content_blocks_audience ON site_content_blocks(target_audience);
CREATE INDEX IF NOT EXISTS idx_content_blocks_group ON site_content_blocks(group_key);
CREATE INDEX IF NOT EXISTS idx_content_blocks_priority ON site_content_blocks(priority DESC);

COMMENT ON TABLE site_content_blocks IS 'Rich content blocks for FAQs, explanations, and informational content';
COMMENT ON COLUMN site_content_blocks.block_type IS 'Visual/structural type of the block';
COMMENT ON COLUMN site_content_blocks.group_key IS 'For grouping related items (e.g., faq_general, faq_billing)';

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Enable RLS
ALTER TABLE site_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_trust_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content_blocks ENABLE ROW LEVEL SECURITY;

-- Public can only view published, active items
CREATE POLICY "Public can view published announcements" ON site_announcements
  FOR SELECT TO authenticated, anon
  USING (status = 'published');

CREATE POLICY "Public can view published trust snippets" ON site_trust_snippets
  FOR SELECT TO authenticated, anon
  USING (status = 'published');

CREATE POLICY "Public can view published content blocks" ON site_content_blocks
  FOR SELECT TO authenticated, anon
  USING (status = 'published');

-- Admins can manage all content
CREATE POLICY "Admins can manage announcements" ON site_announcements
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can manage trust snippets" ON site_trust_snippets
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can manage content blocks" ON site_content_blocks
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all content tables
DROP TRIGGER IF EXISTS trigger_announcements_updated_at ON site_announcements;
CREATE TRIGGER trigger_announcements_updated_at
  BEFORE UPDATE ON site_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_trust_snippets_updated_at ON site_trust_snippets;
CREATE TRIGGER trigger_trust_snippets_updated_at
  BEFORE UPDATE ON site_trust_snippets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_content_blocks_updated_at ON site_content_blocks;
CREATE TRIGGER trigger_content_blocks_updated_at
  BEFORE UPDATE ON site_content_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function: get_active_announcements
-- Returns announcements that should be shown to a user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_announcements(
  p_placement TEXT,
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
  ORDER BY a.priority DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_active_trust_snippets
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_trust_snippets(
  p_placement TEXT,
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
  ORDER BY s.priority DESC, s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_active_content_blocks
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_content_blocks(
  p_placement TEXT,
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
  ORDER BY b.priority DESC, b.group_order ASC, b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed: Default trust snippets (factual only)
-- ============================================================================

-- Only insert if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM site_trust_snippets WHERE status = 'published') THEN
    
    INSERT INTO site_trust_snippets (title, subtitle, icon_name, placement, target_audience, status, priority) VALUES
      ('Secure Email Login', 'Sign in with your email and password. No username required.', 'Mail', 'home.trust', 'all', 'published', 100),
      ('Private Progress Sync', 'Your practice progress syncs securely across devices when logged in.', 'Cloud', 'home.trust', 'all', 'published', 90),
      ('Protected PDF Access', 'Premium PDFs delivered through secure, signed URLs.', 'FileCheck', 'home.trust', 'all', 'published', 80),
      ('7-Day Free Trial', 'Try premium features risk-free for 7 days.', 'Calendar', 'pricing.top', 'anonymous', 'published', 100),
      ('Secure Checkout', 'Billing handled securely through Stripe.', 'CreditCard', 'checkout.info', 'all', 'published', 100);
    
  END IF;
END
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT SELECT ON site_announcements TO authenticated, anon;
GRANT SELECT ON site_trust_snippets TO authenticated, anon;
GRANT SELECT ON site_content_blocks TO authenticated, anon;

GRANT ALL ON site_announcements TO service_role;
GRANT ALL ON site_trust_snippets TO service_role;
GRANT ALL ON site_content_blocks TO service_role;
