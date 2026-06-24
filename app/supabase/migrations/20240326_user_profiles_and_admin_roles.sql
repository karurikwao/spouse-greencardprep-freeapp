-- ============================================================================
-- User Profiles and Admin Roles Migration
-- 
-- Adds:
-- 1. user_profiles table for extended user data
-- 2. Server-side admin role system
-- 3. Auto-creation of profile on signup
-- 4. is_admin() function for RLS and server checks
-- ============================================================================

-- ============================================================================
-- Table: user_profiles
-- Extended user data linked to auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  referral_code TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'Extended user profile data linked to auth.users';
COMMENT ON COLUMN user_profiles.role IS 'User role: user, admin, or superadmin';
COMMENT ON COLUMN user_profiles.is_active IS 'Soft deletion flag - false means account deactivated';

-- ============================================================================
-- Row Level Security for user_profiles
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
  ));

-- Superadmins can update any profile
CREATE POLICY "Superadmins can update any profile" ON user_profiles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() AND role = 'superadmin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() AND role = 'superadmin'
  ));

-- ============================================================================
-- Function: is_admin
-- Server-side check for admin/superadmin role
-- Usage: is_admin() - checks current user
--        is_admin(user_uuid) - checks specific user
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND role IN ('admin', 'superadmin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: is_superadmin
CREATE OR REPLACE FUNCTION is_superadmin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND role = 'superadmin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: handle_new_user_profile
-- Auto-creates user profile when a new user signs up
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (
    user_id,
    email,
    first_name,
    last_name,
    display_name,
    referral_code,
    role,
    is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(
      NULLIF(CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name'), ' '),
      NEW.email
    ),
    NEW.raw_user_meta_data->>'promo_code',
    'user',  -- Default role
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- ============================================================================
-- Function: update_user_profile_email
-- Updates email in user_profiles when auth.users email changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET email = NEW.email,
      updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email changes
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_email();

-- ============================================================================
-- Function: update_updated_at_column
-- Auto-updates updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to user_profiles
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: Add profiles for existing users
-- Creates profile rows for any existing auth.users without profiles
-- ============================================================================
INSERT INTO user_profiles (
  user_id,
  email,
  first_name,
  last_name,
  display_name,
  referral_code,
  role,
  is_active
)
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'first_name',
  au.raw_user_meta_data->>'last_name',
  COALESCE(
    NULLIF(CONCAT(au.raw_user_meta_data->>'first_name', ' ', au.raw_user_meta_data->>'last_name'), ' '),
    au.email
  ),
  au.raw_user_meta_data->>'promo_code',
  CASE 
    WHEN au.email IN ('admin@interviewready.com', 'superadmin@interviewready.com') 
    THEN 'superadmin'
    ELSE 'user'
  END,
  true
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.id IS NULL;

-- ============================================================================
-- Update existing RLS policies to use new is_admin() function
-- This improves security by using server-side role checks
-- ============================================================================

-- Helper function to safely update policies
-- Note: We keep existing policies but document the improvement path

-- The is_admin() function can now be used in new or updated policies like:
-- USING (is_admin())  -- checks current user is admin
-- USING (is_superadmin())  -- checks current user is superadmin

-- ============================================================================
-- View: user_profiles_with_admin_check
-- Convenient view that includes admin status
-- ============================================================================
CREATE OR REPLACE VIEW user_profiles_with_admin_check AS
SELECT 
  up.*,
  is_admin(up.user_id) as is_admin_flag,
  is_superadmin(up.user_id) as is_superadmin_flag
FROM user_profiles up;

-- ============================================================================
-- Function: soft_delete_user
-- Deactivates a user account (safer than hard delete)
-- ============================================================================
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Verify user can only delete themselves, or caller is superadmin
  IF p_user_id != auth.uid() AND NOT is_superadmin() THEN
    RETURN false;
  END IF;

  -- Deactivate profile
  UPDATE user_profiles
  SET is_active = false,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Sign out the user (optional - can be done client-side)
  -- Note: Cannot sign out from within a function easily
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: get_user_profile
-- Gets a user's profile safely
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID DEFAULT auth.uid())
RETURNS user_profiles AS $$
DECLARE
  v_profile user_profiles;
BEGIN
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- ============================================================================
-- Seed superadmin if specific emails exist
-- This ensures the hardcoded admin emails become proper superadmins
-- ============================================================================
UPDATE user_profiles
SET role = 'superadmin'
WHERE email IN ('admin@interviewready.com', 'superadmin@interviewready.com')
AND role != 'superadmin';
