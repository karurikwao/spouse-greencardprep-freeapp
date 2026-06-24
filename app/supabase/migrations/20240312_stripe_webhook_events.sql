-- ============================================================================
-- Stripe Webhook Events Table
-- ============================================================================
-- Tracks processed webhook events for idempotency and debugging.
-- Prevents duplicate processing of the same Stripe event.

-- Create table for webhook event tracking
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups by event ID
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event_id 
  ON stripe_webhook_events(stripe_event_id);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type 
  ON stripe_webhook_events(event_type);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status 
  ON stripe_webhook_events(status);

-- Auto-cleanup old events after 30 days (optional, for performance)
-- Uncomment if you want automatic cleanup:
-- SELECT cron.schedule('cleanup-stripe-webhook-events', '0 0 * * *', 
--   $$ DELETE FROM stripe_webhook_events WHERE created_at < now() - interval '30 days' $$);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN stripe_webhook_events.stripe_event_id IS 'The unique event ID from Stripe (evt_xxx)';
COMMENT ON COLUMN stripe_webhook_events.event_type IS 'The Stripe event type (e.g., checkout.session.completed)';
COMMENT ON COLUMN stripe_webhook_events.status IS 'Whether processing succeeded or failed';
COMMENT ON COLUMN stripe_webhook_events.error_message IS 'Error details if processing failed';
