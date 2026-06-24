-- Migration: Create user_progress table for cross-device progress persistence
-- Created: 2024-03-11

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    questions_practiced INTEGER DEFAULT 0,
    ai_turns INTEGER DEFAULT 0,
    readiness_score INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_practice_date DATE,
    topic_progress JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: user_id must be unique (one progress row per user)
    CONSTRAINT unique_user_progress UNIQUE (user_id)
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);

-- Create index on updated_at for querying recent updates
CREATE INDEX IF NOT EXISTS idx_user_progress_updated_at ON user_progress(updated_at);

-- Enable Row Level Security
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Policy: Users can only SELECT their own progress
CREATE POLICY user_progress_select_policy ON user_progress
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Users can only INSERT their own progress
CREATE POLICY user_progress_insert_policy ON user_progress
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can only UPDATE their own progress
CREATE POLICY user_progress_update_policy ON user_progress
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can only DELETE their own progress (if needed)
CREATE POLICY user_progress_delete_policy ON user_progress
    FOR DELETE
    USING (user_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS trigger_update_user_progress_updated_at ON user_progress;
CREATE TRIGGER trigger_update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE user_progress IS 'Stores user practice progress for cross-device persistence and analytics';
COMMENT ON COLUMN user_progress.questions_practiced IS 'Total number of questions the user has practiced';
COMMENT ON COLUMN user_progress.ai_turns IS 'Total number of AI interview turns/exchanges';
COMMENT ON COLUMN user_progress.readiness_score IS 'Calculated interview readiness score (0-100)';
COMMENT ON COLUMN user_progress.current_streak IS 'Current consecutive days practice streak';
COMMENT ON COLUMN user_progress.longest_streak IS 'Longest streak achieved';
COMMENT ON COLUMN user_progress.last_practice_date IS 'Date of last practice session';
COMMENT ON COLUMN user_progress.topic_progress IS 'JSONB object mapping topic_id to progress data';
