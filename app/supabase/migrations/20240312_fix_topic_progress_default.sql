-- Migration: Ensure topic_progress has safe default and fix existing NULL values
-- Created: 2024-03-12

-- 1. Set default value for topic_progress if not already set
-- This ensures new rows always have {} instead of NULL
ALTER TABLE user_progress
ALTER COLUMN topic_progress
SET DEFAULT '{}'::jsonb;

-- 2. Update existing rows with NULL topic_progress to empty object
-- This prevents UI errors from null values
UPDATE user_progress
SET topic_progress = '{}'::jsonb
WHERE topic_progress IS NULL;

-- 3. Add NOT NULL constraint to prevent future NULL values
-- Only run this if all existing NULL values have been fixed
-- Uncomment the line below after verifying no NULLs exist:
-- ALTER TABLE user_progress ALTER COLUMN topic_progress SET NOT NULL;

-- 4. Verify the fix
-- This query should return 0 rows after the migration
-- SELECT COUNT(*) as null_count FROM user_progress WHERE topic_progress IS NULL;

-- Add comment explaining the default
COMMENT ON COLUMN user_progress.topic_progress IS 
  'JSONB object mapping topic_id to progress data. Always defaults to {} to prevent UI null errors.';
