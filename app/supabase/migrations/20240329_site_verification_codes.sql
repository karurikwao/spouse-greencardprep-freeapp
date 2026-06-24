-- ============================================================================
-- Site Verification Codes Table
-- 
-- Stores trusted verification/partner code snippets for injection into
-- controlled site locations (head, footer, body_end).
-- 
-- This is NOT for visible content - use announcements/content blocks for that.
-- This is specifically for technical verification code (Google Analytics,
-- affiliate verification tags, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL CHECK (placement IN ('head', 'footer', 'body_end')),
  code TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'test')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Only one entry per placement/environment combination
  CONSTRAINT unique_placement_environment UNIQUE (placement, environment)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_placement 
  ON site_verification_codes(placement);
CREATE INDEX IF NOT EXISTS idx_verification_codes_enabled 
  ON site_verification_codes(is_enabled);
CREATE INDEX IF NOT EXISTS idx_verification_codes_environment 
  ON site_verification_codes(environment);

-- RLS Policies
ALTER TABLE site_verification_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read enabled verification codes (for site rendering)
CREATE POLICY "Anyone can read enabled verification codes"
  ON site_verification_codes
  FOR SELECT
  USING (is_enabled = true);

-- Only admins can manage verification codes (admin or superadmin role)
CREATE POLICY "Only admins can manage verification codes"
  ON site_verification_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'superadmin')
    )
  );

-- Function to get enabled verification code for a placement
CREATE OR REPLACE FUNCTION get_verification_code(
  p_placement TEXT,
  p_environment TEXT DEFAULT 'production'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT code 
    FROM site_verification_codes 
    WHERE placement = p_placement 
      AND is_enabled = true
      AND environment = p_environment
    LIMIT 1
  );
END;
$$;

-- Function to upsert verification code (admin only)
CREATE OR REPLACE FUNCTION upsert_verification_code(
  p_placement TEXT,
  p_code TEXT,
  p_is_enabled BOOLEAN,
  p_notes TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT 'production'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Verify user is admin (admin or superadmin role)
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = v_user_id 
    AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Only admins can manage verification codes';
  END IF;
  
  -- Insert or update
  INSERT INTO site_verification_codes (
    placement, code, is_enabled, notes, environment, created_by, updated_by
  ) VALUES (
    p_placement, p_code, p_is_enabled, p_notes, p_environment, v_user_id, v_user_id
  )
  ON CONFLICT (placement, environment) 
  DO UPDATE SET
    code = EXCLUDED.code,
    is_enabled = EXCLUDED.is_enabled,
    notes = EXCLUDED.notes,
    updated_by = v_user_id,
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_code_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_verification_code_timestamp
  BEFORE UPDATE ON site_verification_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_code_timestamp();

-- ============================================================================
-- Default empty entries for all placements (disabled by default)
-- ============================================================================

INSERT INTO site_verification_codes (placement, code, is_enabled, notes, environment)
VALUES 
  ('head', '', false, 'Code to be injected into the <head> section', 'production'),
  ('footer', '', false, 'Code to be injected before closing </body> tag', 'production'),
  ('body_end', '', false, 'Code to be injected at the end of <body>', 'production')
ON CONFLICT (placement, environment) DO NOTHING;
