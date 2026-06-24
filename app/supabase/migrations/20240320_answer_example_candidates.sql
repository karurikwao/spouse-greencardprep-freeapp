-- ============================================================================
-- Answer Example Candidates Table
-- 
-- Stores user interview answers that may become public educational examples.
-- This is a PRIVATE pipeline - nothing here is automatically public.
-- All content must be reviewed and approved by admins before publication.
-- ============================================================================

-- Main table for answer candidates
CREATE TABLE IF NOT EXISTS answer_example_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference (nullable for anonymous users, but we prefer authenticated)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Question identification
  question_id TEXT,
  question_slug TEXT,
  question_prompt TEXT NOT NULL,
  
  -- The answer content (PRIVATE - original never exposed publicly)
  original_answer TEXT NOT NULL,
  
  -- Sanitized version (reviewable, may become public after approval)
  sanitized_answer TEXT NOT NULL,
  
  -- Categorization for grouping examples
  category TEXT DEFAULT 'uncategorized',
  answer_pattern TEXT DEFAULT 'other',
  
  -- Quality assessment (for admin review prioritization)
  quality_score TEXT DEFAULT 'uncategorized',
  quality_reason TEXT,
  
  -- Review workflow
  review_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_edit')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  
  -- Publication control (NOT YET IMPLEMENTED - future use)
  approved_for_publication BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  published_slug TEXT,
  
  -- Source tracking
  source_session_id TEXT,
  source_turn_number INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_answer_candidates_user_id 
  ON answer_example_candidates(user_id);
  
CREATE INDEX IF NOT EXISTS idx_answer_candidates_review_status 
  ON answer_example_candidates(review_status);
  
CREATE INDEX IF NOT EXISTS idx_answer_candidates_category 
  ON answer_example_candidates(category);
  
CREATE INDEX IF NOT EXISTS idx_answer_candidates_pattern 
  ON answer_example_candidates(answer_pattern);
  
CREATE INDEX IF NOT EXISTS idx_answer_candidates_created_at 
  ON answer_example_candidates(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_answer_candidates_approved 
  ON answer_example_candidates(approved_for_publication) 
  WHERE approved_for_publication = TRUE;

-- Composite index for admin review queue
CREATE INDEX IF NOT EXISTS idx_answer_candidates_review_queue 
  ON answer_example_candidates(review_status, created_at DESC) 
  WHERE review_status = 'pending';

-- Enable RLS
ALTER TABLE answer_example_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only see their own candidates (if we ever expose this to users)
CREATE POLICY "Users can view own answer candidates" 
  ON answer_example_candidates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users cannot insert directly (we use service role or edge function)
-- This prevents users from spamming the queue
CREATE POLICY "Service role can insert answer candidates" 
  ON answer_example_candidates
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Admins can view all candidates
CREATE POLICY "Admins can view all answer candidates" 
  ON answer_example_candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('admin@interviewready.com', 'superadmin@interviewready.com')
    )
  );

-- Admins can update candidates (review workflow)
CREATE POLICY "Admins can update answer candidates" 
  ON answer_example_candidates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('admin@interviewready.com', 'superadmin@interviewready.com')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('admin@interviewready.com', 'superadmin@interviewready.com')
    )
  );

-- Service role can do everything
CREATE POLICY "Service role can manage all answer candidates" 
  ON answer_example_candidates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_answer_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_answer_candidates_updated_at
  BEFORE UPDATE ON answer_example_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_answer_candidates_updated_at();

-- ============================================================================
-- Database Functions for Answer Pipeline
-- ============================================================================

-- Function to create an answer candidate
-- Called from edge function or service role
CREATE OR REPLACE FUNCTION create_answer_candidate(
  p_user_id UUID,
  p_question_id TEXT,
  p_question_slug TEXT,
  p_question_prompt TEXT,
  p_original_answer TEXT,
  p_sanitized_answer TEXT,
  p_category TEXT DEFAULT 'uncategorized',
  p_answer_pattern TEXT DEFAULT 'other',
  p_quality_score TEXT DEFAULT 'uncategorized',
  p_quality_reason TEXT DEFAULT NULL,
  p_source_session_id TEXT DEFAULT NULL,
  p_source_turn_number INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate_id UUID;
BEGIN
  INSERT INTO answer_example_candidates (
    user_id,
    question_id,
    question_slug,
    question_prompt,
    original_answer,
    sanitized_answer,
    category,
    answer_pattern,
    quality_score,
    quality_reason,
    source_session_id,
    source_turn_number
  ) VALUES (
    p_user_id,
    p_question_id,
    p_question_slug,
    p_question_prompt,
    p_original_answer,
    p_sanitized_answer,
    p_category,
    p_answer_pattern,
    p_quality_score,
    p_quality_reason,
    p_source_session_id,
    p_source_turn_number
  )
  RETURNING id INTO v_candidate_id;
  
  RETURN v_candidate_id;
END;
$$;

-- Function to get pending candidates for admin review
CREATE OR REPLACE FUNCTION get_pending_answer_candidates(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  question_prompt TEXT,
  category TEXT,
  answer_pattern TEXT,
  sanitized_answer TEXT,
  quality_score TEXT,
  review_status TEXT,
  created_at TIMESTAMPTZ,
  user_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aec.id,
    aec.question_prompt,
    aec.category,
    aec.answer_pattern,
    aec.sanitized_answer,
    aec.quality_score,
    aec.review_status,
    aec.created_at,
    au.email as user_email
  FROM answer_example_candidates aec
  LEFT JOIN auth.users au ON au.id = aec.user_id
  WHERE aec.review_status = 'pending'
  ORDER BY aec.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to update review status
CREATE OR REPLACE FUNCTION update_answer_candidate_review(
  p_candidate_id UUID,
  p_review_status TEXT,
  p_reviewer_notes TEXT DEFAULT NULL,
  p_approved_for_publication BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE answer_example_candidates
  SET 
    review_status = p_review_status,
    reviewer_notes = p_reviewer_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    approved_for_publication = p_approved_for_publication,
    published_at = CASE WHEN p_approved_for_publication THEN now() ELSE published_at END
  WHERE id = p_candidate_id;
  
  RETURN FOUND;
END;
$$;

-- Function to get candidate statistics for admin dashboard
CREATE OR REPLACE FUNCTION get_answer_candidate_stats()
RETURNS TABLE (
  total_candidates BIGINT,
  pending_review BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  needs_edit_count BIGINT,
  today_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM answer_example_candidates) as total_candidates,
    (SELECT COUNT(*) FROM answer_example_candidates WHERE review_status = 'pending') as pending_review,
    (SELECT COUNT(*) FROM answer_example_candidates WHERE review_status = 'approved') as approved_count,
    (SELECT COUNT(*) FROM answer_example_candidates WHERE review_status = 'rejected') as rejected_count,
    (SELECT COUNT(*) FROM answer_example_candidates WHERE review_status = 'needs_edit') as needs_edit_count,
    (SELECT COUNT(*) FROM answer_example_candidates WHERE created_at >= CURRENT_DATE) as today_count;
END;
$$;
