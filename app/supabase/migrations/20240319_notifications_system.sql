-- ============================================================================
-- Notifications, Broadcasts, and Support Tickets System
-- ============================================================================

-- ============================================================================
-- Table: user_notifications
-- Stores user-facing notifications and messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'refund', 'subscription', 'support', 'milestone', 'broadcast')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE user_notifications IS 'User-facing notifications and messages';
COMMENT ON COLUMN user_notifications.type IS 'Type: general, refund, subscription, support, milestone, broadcast';
COMMENT ON COLUMN user_notifications.metadata IS 'Additional data like refund_id, ticket_id, etc.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read ON user_notifications(user_id, is_read);

-- ============================================================================
-- Table: broadcast_messages
-- Admin broadcast messages to groups of users
-- ============================================================================
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all_users' CHECK (audience_type IN ('all_users', 'trial_users', 'premium_users', 'expired_users', 'free_users')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sent_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE broadcast_messages IS 'Admin broadcast messages to user groups';
COMMENT ON COLUMN broadcast_messages.audience_type IS 'Target audience: all_users, trial_users, premium_users, expired_users, free_users';
COMMENT ON COLUMN broadcast_messages.sent_count IS 'Number of users who received this broadcast';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_is_active ON broadcast_messages(is_active);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_audience ON broadcast_messages(audience_type, is_active);

-- ============================================================================
-- Table: support_tickets
-- User support tickets
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('billing', 'technical', 'account', 'feature_request', 'other')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  admin_reply TEXT,
  replied_by UUID REFERENCES auth.users(id),
  replied_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE support_tickets IS 'User support tickets';
COMMENT ON COLUMN support_tickets.category IS 'Category: billing, technical, account, feature_request, other';
COMMENT ON COLUMN support_tickets.status IS 'Status: open, replied, closed';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- user_notifications policies
CREATE POLICY "Users can view own notifications" ON user_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications (mark read)" ON user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage notifications" ON user_notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all notifications" ON user_notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

-- broadcast_messages policies
CREATE POLICY "Users can view active broadcasts" ON broadcast_messages
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage broadcasts" ON broadcast_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

CREATE POLICY "Service role can manage broadcasts" ON broadcast_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- support_tickets policies
CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view and manage all tickets" ON support_tickets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true));

CREATE POLICY "Service role can manage tickets" ON support_tickets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: create_user_notification
-- Creates a notification for a specific user
CREATE OR REPLACE FUNCTION create_user_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO user_notifications (user_id, type, title, message, action_url, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_action_url, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: mark_notification_read
-- Marks a notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_notifications
  SET is_read = true, updated_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_unread_notification_count
-- Returns count of unread notifications for current user
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_notifications
  WHERE user_id = auth.uid() AND is_read = false;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: create_support_ticket
-- Creates a new support ticket and notification
CREATE OR REPLACE FUNCTION create_support_ticket(
  p_user_id UUID,
  p_subject TEXT,
  p_category TEXT,
  p_message TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Create ticket
  INSERT INTO support_tickets (user_id, subject, category, message)
  VALUES (p_user_id, p_subject, p_category, p_message)
  RETURNING id INTO v_ticket_id;
  
  -- Create notification for user
  PERFORM create_user_notification(
    p_user_id,
    'support',
    'Support Ticket Created',
    'Your support ticket "' || p_subject || '" has been submitted. We''ll respond soon.',
    NULL,
    jsonb_build_object('ticket_id', v_ticket_id)
  );
  
  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: reply_to_support_ticket
-- Admin replies to a ticket and notifies user
CREATE OR REPLACE FUNCTION reply_to_support_ticket(
  p_ticket_id UUID,
  p_admin_user_id UUID,
  p_reply TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_subject TEXT;
BEGIN
  -- Get ticket info
  SELECT user_id, subject INTO v_user_id, v_subject
  FROM support_tickets
  WHERE id = p_ticket_id;
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update ticket
  UPDATE support_tickets
  SET 
    admin_reply = p_reply,
    status = 'replied',
    replied_by = p_admin_user_id,
    replied_at = now(),
    updated_at = now()
  WHERE id = p_ticket_id;
  
  -- Create notification for user
  PERFORM create_user_notification(
    v_user_id,
    'support',
    'Support Reply Received',
    'You have a new reply to your ticket: "' || v_subject || '"',
    NULL,
    jsonb_build_object('ticket_id', p_ticket_id)
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: publish_broadcast
-- Publishes a broadcast to matching users
CREATE OR REPLACE FUNCTION publish_broadcast(p_broadcast_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_broadcast RECORD;
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get broadcast details
  SELECT * INTO v_broadcast
  FROM broadcast_messages
  WHERE id = p_broadcast_id;
  
  IF v_broadcast IS NULL OR NOT v_broadcast.is_active THEN
    RETURN 0;
  END IF;
  
  -- Create notifications for matching users based on audience_type
  FOR v_user IN 
    SELECT u.id as user_id
    FROM auth.users u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
    WHERE 
      -- Filter based on audience type
      CASE v_broadcast.audience_type
        WHEN 'all_users' THEN true
        WHEN 'trial_users' THEN s.plan = 'trial' OR s.id IS NULL
        WHEN 'premium_users' THEN s.plan IN ('premium', 'premium-annual', 'premium-monthly') AND s.status = 'active'
        WHEN 'expired_users' THEN s.status = 'expired' OR (s.current_period_end < now() AND s.status != 'active')
        WHEN 'free_users' THEN s.id IS NULL OR s.plan = 'trial'
        ELSE true
      END
  LOOP
    PERFORM create_user_notification(
      v_user.user_id,
      'broadcast',
      v_broadcast.title,
      v_broadcast.message,
      NULL,
      jsonb_build_object('broadcast_id', p_broadcast_id)
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Update broadcast sent count
  UPDATE broadcast_messages
  SET sent_count = v_count
  WHERE id = p_broadcast_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_user_tickets_with_replies
-- Returns user's tickets with reply info
CREATE OR REPLACE FUNCTION get_user_tickets_with_replies()
RETURNS TABLE (
  id UUID,
  subject TEXT,
  category TEXT,
  message TEXT,
  status TEXT,
  admin_reply TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.subject,
    t.category,
    t.message,
    t.status,
    t.admin_reply,
    t.created_at,
    t.updated_at
  FROM support_tickets t
  WHERE t.user_id = auth.uid()
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_open_tickets_for_admin
-- Returns open tickets for admin review
CREATE OR REPLACE FUNCTION get_open_tickets_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  subject TEXT,
  category TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    u.email::TEXT,
    t.subject,
    t.category,
    t.message,
    t.status,
    t.created_at
  FROM support_tickets t
  JOIN auth.users u ON t.user_id = u.id
  WHERE t.status IN ('open', 'replied')
  ORDER BY 
    CASE t.status WHEN 'open' THEN 0 ELSE 1 END,
    t.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Updated At Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_user_notifications_updated_at
  BEFORE UPDATE ON user_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broadcast_messages_updated_at
  BEFORE UPDATE ON broadcast_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_user_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_support_ticket(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reply_to_support_ticket(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION publish_broadcast(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_tickets_with_replies() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_open_tickets_for_admin() TO authenticated, service_role;
