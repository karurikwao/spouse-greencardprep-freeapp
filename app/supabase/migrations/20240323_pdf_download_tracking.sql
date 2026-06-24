-- ============================================================================
-- PDF Download Tracking for Refund Review
-- ============================================================================
-- Tracks PDF download activity to support refund review decisions.
-- 
-- CORE PRINCIPLE:
-- - This is for refund review support, NOT for blocking downloads
-- - Data helps admins make informed decisions, not auto-deny refunds
-- - Honest labeling about certainty vs estimation
-- - Privacy-minimized data collection
-- ============================================================================

-- ============================================================================
-- Table: pdf_download_events
-- Tracks each PDF download attempt/event
-- ============================================================================
CREATE TABLE IF NOT EXISTS pdf_download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  
  -- PDF/File identification
  pdf_filename TEXT NOT NULL,
  pdf_title TEXT,
  topic_id TEXT,
  category_id TEXT,
  
  -- Download context
  download_source TEXT DEFAULT 'topic_page', -- topic_page, practice_mode, direct_link, etc.
  
  -- Event status (honest about certainty)
  event_status TEXT NOT NULL DEFAULT 'requested' 
    CHECK (event_status IN ('requested', 'served', 'completed_estimated')),
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Optional: Privacy-minimized metadata (hashed, not raw)
  -- These help distinguish unique sessions without storing sensitive data
  session_hash TEXT, -- Hashed session identifier (not IP)
  user_agent_hash TEXT -- Hashed user agent string
);

-- Comments for documentation
COMMENT ON TABLE pdf_download_events IS 'Tracks PDF download events for refund review support. NOT for blocking downloads.';
COMMENT ON COLUMN pdf_download_events.event_status IS 'Status of download: requested (user clicked), served (file sent), completed_estimated (browser likely saved)';
COMMENT ON COLUMN pdf_download_events.session_hash IS 'Hashed session identifier for distinguishing unique download sessions without storing IP addresses';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_user_id ON pdf_download_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_created_at ON pdf_download_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_pdf_filename ON pdf_download_events(pdf_filename);
CREATE INDEX IF NOT EXISTS idx_pdf_download_events_user_created ON pdf_download_events(user_id, created_at DESC);

-- ============================================================================
-- Table: pdf_download_summary (materialized view helper)
-- Stores pre-computed download summaries per user for fast refund review
-- ============================================================================
CREATE TABLE IF NOT EXISTS pdf_download_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Summary statistics
  total_downloads INTEGER NOT NULL DEFAULT 0,
  unique_pdfs_downloaded INTEGER NOT NULL DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  
  -- Refund review flags (guidance only, not auto-decisions)
  has_downloaded BOOLEAN NOT NULL DEFAULT false,
  review_flag TEXT DEFAULT 'no_downloads' 
    CHECK (review_flag IN ('no_downloads', 'downloaded_once', 'downloaded_multiple', 'heavy_usage')),
  
  -- Human-readable note for refund review
  review_note TEXT,
  
  -- Last updated
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pdf_download_summaries IS 'Pre-computed download summary per user for refund review dashboard. Updated by trigger.';
COMMENT ON COLUMN pdf_download_summaries.review_flag IS 'Guidance flag for refund review: no_downloads, downloaded_once, downloaded_multiple, heavy_usage';

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_pdf_download_summaries_user_id ON pdf_download_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_download_summaries_review_flag ON pdf_download_summaries(review_flag);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE pdf_download_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_download_summaries ENABLE ROW LEVEL SECURITY;

-- Users can view their own download events
CREATE POLICY "Users can view own download events" ON pdf_download_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all download events
CREATE POLICY "Service role can manage download events" ON pdf_download_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view all download events (for refund review)
CREATE POLICY "Admins can view all download events" ON pdf_download_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- Service role can manage summaries
CREATE POLICY "Service role can manage summaries" ON pdf_download_summaries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view all summaries (for refund review)
CREATE POLICY "Admins can view all summaries" ON pdf_download_summaries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- Users can view their own summary
CREATE POLICY "Users can view own summary" ON pdf_download_summaries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: record_pdf_download
-- Records a PDF download event
CREATE OR REPLACE FUNCTION record_pdf_download(
  p_user_id UUID,
  p_user_email TEXT,
  p_pdf_filename TEXT,
  p_pdf_title TEXT DEFAULT NULL,
  p_topic_id TEXT DEFAULT NULL,
  p_category_id TEXT DEFAULT NULL,
  p_download_source TEXT DEFAULT 'topic_page',
  p_event_status TEXT DEFAULT 'requested',
  p_session_hash TEXT DEFAULT NULL,
  p_user_agent_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO pdf_download_events (
    user_id,
    user_email,
    pdf_filename,
    pdf_title,
    topic_id,
    category_id,
    download_source,
    event_status,
    session_hash,
    user_agent_hash
  ) VALUES (
    p_user_id,
    p_user_email,
    p_pdf_filename,
    p_pdf_title,
    p_topic_id,
    p_category_id,
    p_download_source,
    p_event_status,
    p_session_hash,
    p_user_agent_hash
  )
  RETURNING id INTO v_event_id;
  
  -- Update summary (will be handled by trigger, but we can call it explicitly too)
  PERFORM update_pdf_download_summary(p_user_id);
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_pdf_download_summary
-- Updates the download summary for a user
CREATE OR REPLACE FUNCTION update_pdf_download_summary(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total_downloads INTEGER;
  v_unique_pdfs INTEGER;
  v_first_download TIMESTAMPTZ;
  v_last_download TIMESTAMPTZ;
  v_has_downloaded BOOLEAN;
  v_review_flag TEXT;
  v_review_note TEXT;
BEGIN
  -- Calculate statistics
  SELECT 
    COUNT(*),
    COUNT(DISTINCT pdf_filename),
    MIN(created_at),
    MAX(created_at)
  INTO 
    v_total_downloads,
    v_unique_pdfs,
    v_first_download,
    v_last_download
  FROM pdf_download_events
  WHERE user_id = p_user_id;
  
  -- Determine review flag and note
  v_has_downloaded := v_total_downloads > 0;
  
  IF v_total_downloads = 0 THEN
    v_review_flag := 'no_downloads';
    v_review_note := 'No PDF download activity recorded for this user.';
  ELSIF v_total_downloads = 1 THEN
    v_review_flag := 'downloaded_once';
    v_review_note := 'Downloaded one PDF. Limited content access before refund request.';
  ELSIF v_total_downloads <= 5 THEN
    v_review_flag := 'downloaded_multiple';
    v_review_note := 'Downloaded multiple PDFs. Moderate content access before refund request.';
  ELSE
    v_review_flag := 'heavy_usage';
    v_review_note := 'Downloaded many PDFs. Significant content access before refund request.';
  END IF;
  
  -- Insert or update summary
  INSERT INTO pdf_download_summaries (
    user_id,
    total_downloads,
    unique_pdfs_downloaded,
    first_download_at,
    last_download_at,
    has_downloaded,
    review_flag,
    review_note,
    updated_at
  ) VALUES (
    p_user_id,
    v_total_downloads,
    v_unique_pdfs,
    v_first_download,
    v_last_download,
    v_has_downloaded,
    v_review_flag,
    v_review_note,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_downloads = EXCLUDED.total_downloads,
    unique_pdfs_downloaded = EXCLUDED.unique_pdfs_downloaded,
    first_download_at = EXCLUDED.first_download_at,
    last_download_at = EXCLUDED.last_download_at,
    has_downloaded = EXCLUDED.has_downloaded,
    review_flag = EXCLUDED.review_flag,
    review_note = EXCLUDED.review_note,
    updated_at = EXCLUDED.updated_at;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_user_download_summary
-- Gets download summary for a user (for refund review)
CREATE OR REPLACE FUNCTION get_user_download_summary(p_user_id UUID)
RETURNS TABLE (
  total_downloads INTEGER,
  unique_pdfs_downloaded INTEGER,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  has_downloaded BOOLEAN,
  review_flag TEXT,
  review_note TEXT
) AS $$
BEGIN
  -- Ensure summary is up to date
  PERFORM update_pdf_download_summary(p_user_id);
  
  -- Return summary
  RETURN QUERY
  SELECT 
    ds.total_downloads,
    ds.unique_pdfs_downloaded,
    ds.first_download_at,
    ds.last_download_at,
    ds.has_downloaded,
    ds.review_flag,
    ds.review_note
  FROM pdf_download_summaries ds
  WHERE ds.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_user_download_events
-- Gets download events for a user (for detailed refund review)
CREATE OR REPLACE FUNCTION get_user_download_events(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  pdf_filename TEXT,
  pdf_title TEXT,
  download_source TEXT,
  event_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.pdf_filename,
    de.pdf_title,
    de.download_source,
    de.event_status,
    de.created_at
  FROM pdf_download_events de
  WHERE de.user_id = p_user_id
  ORDER BY de.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_refund_request_with_download_summary
-- Gets refund request with download evidence for admin review
CREATE OR REPLACE FUNCTION get_refund_request_with_download_summary()
RETURNS TABLE (
  -- Refund request fields
  refund_id UUID,
  user_id UUID,
  user_email TEXT,
  plan_type TEXT,
  amount DECIMAL,
  currency TEXT,
  days_since_purchase INTEGER,
  questions_completed INTEGER,
  mock_interviews_completed INTEGER,
  eligibility_status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ,
  -- Download summary fields
  total_pdf_downloads INTEGER,
  unique_pdfs_downloaded INTEGER,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  download_review_flag TEXT,
  download_review_note TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS refund_id,
    r.user_id,
    u.email::TEXT AS user_email,
    r.plan_type,
    r.amount,
    r.currency,
    r.days_since_purchase,
    r.questions_completed,
    r.mock_interviews_completed,
    r.eligibility_status,
    r.reason,
    r.created_at,
    COALESCE(ds.total_downloads, 0) AS total_pdf_downloads,
    COALESCE(ds.unique_pdfs_downloaded, 0) AS unique_pdfs_downloaded,
    ds.first_download_at,
    ds.last_download_at,
    COALESCE(ds.review_flag, 'no_downloads') AS download_review_flag,
    COALESCE(ds.review_note, 'No PDF download activity recorded.') AS download_review_note
  FROM refund_requests r
  JOIN auth.users u ON r.user_id = u.id
  LEFT JOIN pdf_download_summaries ds ON r.user_id = ds.user_id
  WHERE r.eligibility_status IN ('pending', 'eligible', 'not_eligible')
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger: Auto-update summary on new download
-- ============================================================================

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_update_pdf_download_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Update summary for the user
  PERFORM update_pdf_download_summary(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_pdf_summary ON pdf_download_events;
CREATE TRIGGER trg_update_pdf_summary
  AFTER INSERT ON pdf_download_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_pdf_download_summary();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION record_pdf_download(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_pdf_download_summary(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_download_summary(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_download_events(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_refund_request_with_download_summary() TO authenticated, service_role;
