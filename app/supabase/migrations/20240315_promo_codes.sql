-- ============================================================================
-- Influencer Promo Code and Referral Tracking System
-- ============================================================================
-- This migration creates tables for managing influencer promo codes and
-- tracking referral events. The system allows social media influencers to
-- promote the app using unique promo codes or referral links.
-- ============================================================================

-- ============================================================================
-- Table: promo_codes
-- Stores influencer promo codes with discount percentages
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

-- Comments for documentation
COMMENT ON TABLE promo_codes IS 'Stores influencer promo codes with associated discounts';
COMMENT ON COLUMN promo_codes.code IS 'Unique promo code (e.g., MARIA10, ANA20)';
COMMENT ON COLUMN promo_codes.discount_percent IS 'Discount percentage (0-100)';
COMMENT ON COLUMN promo_codes.influencer_name IS 'Name of the influencer who owns this code';
COMMENT ON COLUMN promo_codes.is_active IS 'Whether this promo code is currently active';

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = true;

-- ============================================================================
-- Table: referral_events
-- Tracks visits and signups that used referral links or promo codes
-- ============================================================================
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

-- Comments for documentation
COMMENT ON TABLE referral_events IS 'Tracks referral visits, signups, and conversions';
COMMENT ON COLUMN referral_events.user_id IS 'User who completed the action (null for anonymous visits)';
COMMENT ON COLUMN referral_events.promo_code IS 'Promo code used (if any)';
COMMENT ON COLUMN referral_events.referrer IS 'Referrer source (e.g., instagram, youtube, direct)';
COMMENT ON COLUMN referral_events.landing_page IS 'URL of the landing page';
COMMENT ON COLUMN referral_events.event_type IS 'Type of event: visit, signup, checkout, purchase';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_referral_events_user_id ON referral_events(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_promo_code ON referral_events(promo_code);
CREATE INDEX IF NOT EXISTS idx_referral_events_event_type ON referral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_created_at ON referral_events(created_at);
CREATE INDEX IF NOT EXISTS idx_referral_events_promo_code_event ON referral_events(promo_code, event_type);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

-- Promo codes: Allow read access to all authenticated users
CREATE POLICY "Allow read access to promo codes" ON promo_codes
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

-- Promo codes: Allow full access to service role only
CREATE POLICY "Allow service role full access to promo codes" ON promo_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Referral events: Allow users to see their own events
CREATE POLICY "Allow users to read own referral events" ON referral_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Referral events: Allow insert from anon (for tracking visits before signup)
CREATE POLICY "Allow anon to create referral events" ON referral_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Referral events: Allow service role full access
CREATE POLICY "Allow service role full access to referral events" ON referral_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: validate_promo_code
-- Validates a promo code and returns its details if active
CREATE OR REPLACE FUNCTION validate_promo_code(p_code TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  code TEXT,
  discount_percent INTEGER,
  influencer_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as valid,
    pc.code,
    pc.discount_percent,
    pc.influencer_name
  FROM promo_codes pc
  WHERE pc.code = UPPER(TRIM(p_code))
    AND pc.is_active = true;
  
  -- Return false if no rows found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: record_referral_event
-- Records a referral event (can be called from edge functions or client)
CREATE OR REPLACE FUNCTION record_referral_event(
  p_user_id UUID DEFAULT NULL,
  p_promo_code TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_landing_page TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT 'visit',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS referral_events AS $$
DECLARE
  v_event referral_events;
BEGIN
  INSERT INTO referral_events (
    user_id,
    promo_code,
    referrer,
    landing_page,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    UPPER(TRIM(p_promo_code)),
    p_referrer,
    p_landing_page,
    p_event_type,
    p_metadata,
    now()
  )
  RETURNING * INTO v_event;
  
  RETURN v_event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_promo_code_stats
-- Returns statistics for a promo code (admin only)
CREATE OR REPLACE FUNCTION get_promo_code_stats(p_code TEXT)
RETURNS TABLE (
  promo_code TEXT,
  total_referrals BIGINT,
  total_signups BIGINT,
  total_checkouts BIGINT,
  total_purchases BIGINT,
  total_paid_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    UPPER(TRIM(p_code)) as promo_code,
    COUNT(*) FILTER (WHERE event_type = 'visit') as total_referrals,
    COUNT(*) FILTER (WHERE event_type = 'signup') as total_signups,
    COUNT(*) FILTER (WHERE event_type = 'checkout') as total_checkouts,
    COUNT(*) FILTER (WHERE event_type = 'purchase') as total_purchases,
    COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'purchase' AND user_id IS NOT NULL) as total_paid_users
  FROM referral_events
  WHERE referral_events.promo_code = UPPER(TRIM(p_code));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_all_promo_code_stats
-- Returns statistics for all promo codes (admin only)
CREATE OR REPLACE FUNCTION get_all_promo_code_stats()
RETURNS TABLE (
  promo_code TEXT,
  influencer_name TEXT,
  discount_percent INTEGER,
  is_active BOOLEAN,
  total_referrals BIGINT,
  total_signups BIGINT,
  total_purchases BIGINT,
  total_paid_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.code as promo_code,
    pc.influencer_name,
    pc.discount_percent,
    pc.is_active,
    COALESCE(stats.total_referrals, 0) as total_referrals,
    COALESCE(stats.total_signups, 0) as total_signups,
    COALESCE(stats.total_purchases, 0) as total_purchases,
    COALESCE(stats.total_paid_users, 0) as total_paid_users
  FROM promo_codes pc
  LEFT JOIN (
    SELECT 
      re.promo_code,
      COUNT(*) FILTER (WHERE re.event_type = 'visit') as total_referrals,
      COUNT(*) FILTER (WHERE re.event_type = 'signup') as total_signups,
      COUNT(*) FILTER (WHERE re.event_type = 'purchase') as total_purchases,
      COUNT(DISTINCT re.user_id) FILTER (WHERE re.event_type = 'purchase' AND re.user_id IS NOT NULL) as total_paid_users
    FROM referral_events re
    GROUP BY re.promo_code
  ) stats ON stats.promo_code = pc.code
  ORDER BY pc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: apply_promo_code_discount
-- Calculates discounted price for a plan
CREATE OR REPLACE FUNCTION apply_promo_code_discount(
  p_code TEXT,
  p_original_price DECIMAL
)
RETURNS TABLE (
  valid BOOLEAN,
  original_price DECIMAL,
  discount_percent INTEGER,
  discount_amount DECIMAL,
  final_price DECIMAL
) AS $$
DECLARE
  v_discount INTEGER;
BEGIN
  -- Get discount percent
  SELECT pc.discount_percent INTO v_discount
  FROM promo_codes pc
  WHERE pc.code = UPPER(TRIM(p_code))
    AND pc.is_active = true;
  
  IF v_discount IS NULL THEN
    -- Invalid code, return original price
    RETURN QUERY SELECT 
      false,
      p_original_price,
      0,
      0::DECIMAL,
      p_original_price;
    RETURN;
  END IF;
  
  -- Calculate discounted price
  RETURN QUERY SELECT 
    true,
    p_original_price,
    v_discount,
    ROUND(p_original_price * v_discount / 100, 2),
    ROUND(p_original_price * (100 - v_discount) / 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant execute permissions to appropriate roles
GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_referral_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_promo_code_stats(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_all_promo_code_stats() TO service_role;
GRANT EXECUTE ON FUNCTION apply_promo_code_discount(TEXT, DECIMAL) TO service_role;

-- ============================================================================
-- Seed Data (Optional - Example Promo Codes)
-- Uncomment and modify to create initial promo codes
-- ============================================================================

-- INSERT INTO promo_codes (code, description, discount_percent, influencer_name, is_active)
-- VALUES 
--   ('MARIA10', 'Maria immigration blog - 10% off', 10, 'Maria Garcia', true),
--   ('ANA20', 'Ana YouTube channel - 20% off', 20, 'Ana Rodriguez', true),
--   ('GREENCARD15', 'Green Card Forum - 15% off', 15, 'Green Card Forum', true)
-- ON CONFLICT (code) DO NOTHING;
