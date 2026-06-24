-- ============================================================================
-- Content Management Hardening
-- 
-- 1. content_dismissals - Synced dismissals for logged-in users
-- 2. content_interactions - Privacy-respectful analytics
-- ============================================================================

-- ============================================================================
-- Table: content_dismissals
-- Stores per-user dismissal state (syncs across devices for logged-in users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('announcement', 'trust_snippet', 'content_block')),
  content_id UUID NOT NULL,
  placement TEXT, -- helpful for debugging/auditing
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one dismissal per user per content item
  CONSTRAINT unique_user_content_dismissal UNIQUE (user_id, content_type, content_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_content_dismissals_user ON content_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_content_dismissals_content ON content_dismissals(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_dismissals_dismissed_at ON content_dismissals(dismissed_at);

-- RLS: Users can only see their own dismissals
ALTER TABLE content_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals" ON content_dismissals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own dismissals" ON content_dismissals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own dismissals" ON content_dismissals
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all dismissals for analytics
CREATE POLICY "Admins can view all dismissals" ON content_dismissals
  FOR SELECT TO authenticated
  USING (is_admin());

COMMENT ON TABLE content_dismissals IS 'Per-user content dismissals that sync across devices for logged-in users';

-- ============================================================================
-- Table: content_interactions
-- Privacy-respectful analytics for content engagement
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content reference
  content_type TEXT NOT NULL CHECK (content_type IN ('announcement', 'trust_snippet', 'content_block')),
  content_id UUID NOT NULL,
  placement TEXT,
  
  -- Interaction type
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'dismiss', 'cta_click', 'expand')),
  
  -- User context (nullable for anonymous, but we store what we have)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Anonymous session tracking (for deduplication, not fingerprinting)
  session_id TEXT, -- simple session identifier, not device fingerprint
  
  -- Minimal context (privacy-respectful)
  user_agent_hash TEXT, -- hashed UA for basic browser detection, not raw UA
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_content_interactions_content ON content_interactions(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON content_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_content_interactions_created_at ON content_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_content_interactions_user ON content_interactions(user_id) WHERE user_id IS NOT NULL;

-- RLS: Public can insert (for tracking), only admins can query analytics
ALTER TABLE content_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record interactions" ON content_interactions
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Admins can view analytics" ON content_interactions
  FOR SELECT TO authenticated
  USING (is_admin());

COMMENT ON TABLE content_interactions IS 'Privacy-respectful content interaction analytics';
COMMENT ON COLUMN content_interactions.session_id IS 'Simple session identifier for deduplication, not fingerprinting';
COMMENT ON COLUMN content_interactions.user_agent_hash IS 'Hashed user agent for basic browser stats, not raw tracking';

-- ============================================================================
-- Function: get_dismissed_content_ids
-- Returns array of dismissed content IDs for a user
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

-- ============================================================================
-- Function: dismiss_content
-- Records a content dismissal for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION dismiss_content(
  p_user_id UUID,
  p_content_type TEXT,
  p_content_id UUID,
  p_placement TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO content_dismissals (user_id, content_type, content_id, placement)
  VALUES (p_user_id, p_content_type, p_content_id, p_placement)
  ON CONFLICT (user_id, content_type, content_id) DO NOTHING;
  
  -- Also record the interaction
  INSERT INTO content_interactions (content_type, content_id, placement, interaction_type, user_id)
  VALUES (p_content_type, p_content_id, p_placement, 'dismiss', p_user_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: record_content_interaction
-- Records a content interaction (view, cta_click, expand)
-- ============================================================================
CREATE OR REPLACE FUNCTION record_content_interaction(
  p_content_type TEXT,
  p_content_id UUID,
  p_interaction_type TEXT,
  p_placement TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO content_interactions (content_type, content_id, placement, interaction_type, user_id, session_id)
  VALUES (p_content_type, p_content_id, p_placement, p_interaction_type, p_user_id, p_session_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_content_analytics
-- Returns aggregated analytics for a content item
-- ============================================================================
CREATE OR REPLACE FUNCTION get_content_analytics(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  total_dismissals BIGINT,
  total_cta_clicks BIGINT,
  total_expands BIGINT,
  last_interaction_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE ci.interaction_type = 'view') as total_views,
    COUNT(DISTINCT ci.user_id) FILTER (WHERE ci.user_id IS NOT NULL AND ci.interaction_type = 'view') as unique_viewers,
    COUNT(*) FILTER (WHERE ci.interaction_type = 'dismiss') as total_dismissals,
    COUNT(*) FILTER (WHERE ci.interaction_type = 'cta_click') as total_cta_clicks,
    COUNT(*) FILTER (WHERE ci.interaction_type = 'expand') as total_expands,
    MAX(ci.created_at) as last_interaction_at
  FROM content_interactions ci
  WHERE ci.content_type = p_content_type
    AND ci.content_id = p_content_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_placement_analytics
-- Returns aggregated analytics for a placement
-- ============================================================================
CREATE OR REPLACE FUNCTION get_placement_analytics(
  p_placement TEXT
)
RETURNS TABLE (
  content_type TEXT,
  content_id UUID,
  title TEXT,
  total_views BIGINT,
  total_dismissals BIGINT,
  total_cta_clicks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.content_type,
    ci.content_id,
    CASE 
      WHEN ci.content_type = 'announcement' THEN (SELECT a.title FROM site_announcements a WHERE a.id = ci.content_id)
      WHEN ci.content_type = 'trust_snippet' THEN (SELECT t.title FROM site_trust_snippets t WHERE t.id = ci.content_id)
      WHEN ci.content_type = 'content_block' THEN (SELECT b.title FROM site_content_blocks b WHERE b.id = ci.content_id)
    END as title,
    COUNT(*) FILTER (WHERE ci.interaction_type = 'view') as total_views,
    COUNT(*) FILTER (WHERE ci.interaction_type = 'dismiss') as total_dismissals,
    COUNT(*) FILTER (WHERE ci.interaction_type = 'cta_click') as total_cta_clicks
  FROM content_interactions ci
  WHERE ci.placement = p_placement
  GROUP BY ci.content_type, ci.content_id
  ORDER BY total_views DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, DELETE ON content_dismissals TO authenticated;
GRANT SELECT, INSERT ON content_interactions TO authenticated, anon;

-- ============================================================================
-- Update existing get_active functions to exclude dismissed items for logged-in users
-- ============================================================================

-- Updated announcement function that excludes dismissed items
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
    -- Exclude dismissed items for logged-in users
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

-- ============================================================================
-- Function: get_active_trust_snippets
-- Updated to support dismissals for logged-in users
-- ============================================================================
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
    -- Exclude dismissed items for logged-in users
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

-- ============================================================================
-- Function: get_active_content_blocks
-- Updated to support dismissals for logged-in users
-- ============================================================================
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
    -- Exclude dismissed items for logged-in users
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

-- ============================================================================
-- Grant execute permissions on new/updated functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_active_announcements(TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_trust_snippets(TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_content_blocks(TEXT, UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dismissed_content_ids(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_content(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_content_interaction(TEXT, UUID, TEXT, TEXT, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_content_analytics(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_placement_analytics(TEXT) TO authenticated;
