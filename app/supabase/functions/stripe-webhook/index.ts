/**
 * Stripe Webhook Edge Function
 * 
 * Processes Stripe webhook events and updates subscription state.
 * This is the authoritative source for subscription changes.
 * 
 * @security Verifies Stripe webhook signature to ensure authenticity.
 * @idempotent Uses idempotency keys to prevent duplicate processing.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================================================
// TYPES
// ============================================================================

type PlanType = 'monthly' | 'lifetime' | 'interviewPass';
type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'expired' | 'past_due' | 'grace_period' | 'unpaid';

interface StripeEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  type: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

/**
 * Verify Stripe webhook signature
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await computeWebhookSignature(payload, secret);
  
  // Constant-time comparison to prevent timing attacks
  const sigBuf = new TextEncoder().encode(signature);
  const expectedBuf = new TextEncoder().encode(expectedSignature);
  
  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    result |= sigBuf[i] ^ expectedBuf[i];
  }
  
  return result === 0;
}

/**
 * Compute HMAC-SHA256 signature for webhook verification
 */
async function computeWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Check if webhook event has already been processed
 */
async function isEventProcessed(supabase: ReturnType<typeof createClient>, eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error checking event status:', error);
  }
  
  return !!data;
}

/**
 * Record webhook event as processed
 * Uses ON CONFLICT to handle race conditions gracefully
 */
async function recordEventProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  eventType: string,
  status: 'success' | 'error',
  errorMessage?: string
): Promise<'inserted' | 'already_exists' | 'error'> {
  try {
    const { error } = await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: eventId,
        event_type: eventType,
        status,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      });
    
    if (error) {
      // Check if this is a unique constraint violation (event already processed)
      if (error.code === '23505') {
        console.log(`Event ${eventId} was already processed (constraint violation)`);
        return 'already_exists';
      }
      console.error('Error recording event:', error);
      return 'error';
    }
    
    return 'inserted';
  } catch (err) {
    console.error('Exception recording event:', err);
    return 'error';
  }
}

/**
 * Get user subscription by Stripe customer ID
 */
async function getSubscriptionByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string
): Promise<{ user_id: string; plan_type: string; status: string } | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan_type, status')
    .eq('provider_customer_id', customerId)
    .single();
  
  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
  
  return data;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle checkout.session.completed
 * Activates subscription/purchase after successful payment
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Record<string, unknown>
): Promise<void> {
  const userId = (session.metadata as Record<string, string>)?.user_id;
  const planType = (session.metadata as Record<string, string>)?.plan_type as PlanType;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string | null;
  const paymentIntentId = session.payment_intent as string | null;
  const promoCode = (session.metadata as Record<string, string>)?.promo_code;
  const discountPercent = (session.metadata as Record<string, string>)?.discount_percent;
  
  if (!userId || !planType) {
    throw new Error('Missing user_id or plan_type in session metadata');
  }
  
  console.log(`Processing checkout completion for user ${userId}, plan ${planType}${promoCode ? `, promo: ${promoCode}` : ''}`);
  
  const now = new Date().toISOString();
  
  // Build update based on plan type
  const baseUpdate: Record<string, unknown> = {
    user_id: userId,
    plan_type: planType,
    status: 'active',
    provider: 'stripe',
    provider_customer_id: customerId,
    updated_at: now,
  };
  
  if (planType === 'monthly') {
    // Monthly subscription
    baseUpdate.provider_subscription_id = subscriptionId;
    baseUpdate.current_period_starts_at = now;
    // Period end will be updated by subscription.created or invoice.paid
  } else if (planType === 'lifetime') {
    // Lifetime one-time purchase
    baseUpdate.lifetime_granted_at = now;
    baseUpdate.provider_subscription_id = paymentIntentId;
  } else if (planType === 'interviewPass') {
    // 90-day pass
    const passEnd = new Date();
    passEnd.setDate(passEnd.getDate() + 90);
    baseUpdate.interview_pass_ends_at = passEnd.toISOString();
    baseUpdate.ends_at = passEnd.toISOString();
    baseUpdate.provider_subscription_id = paymentIntentId;
  }
  
  // Add promo code info to metadata if present
  if (promoCode) {
    baseUpdate.metadata = {
      ...((baseUpdate.metadata as Record<string, unknown>) || {}),
      promo_code: promoCode,
      discount_percent: discountPercent ? parseInt(discountPercent, 10) : 0,
    };
  }
  
  // Upsert subscription
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(baseUpdate, { onConflict: 'user_id' });
  
  if (error) {
    console.error('Error updating subscription:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
  
  // Record purchase referral event if promo code was used
  if (promoCode) {
    try {
      await supabase.rpc('record_referral_event', {
        p_user_id: userId,
        p_promo_code: promoCode,
        p_referrer: 'stripe_checkout',
        p_landing_page: null,
        p_event_type: 'purchase',
        p_metadata: {
          plan_type: planType,
          discount_percent: discountPercent ? parseInt(discountPercent, 10) : 0,
          session_id: session.id,
        },
      });
    } catch (err) {
      // Log but don't fail if referral recording fails
      console.error('Error recording purchase referral event:', err);
    }
  }
  
  console.log(`Successfully activated ${planType} plan for user ${userId}`);
}

/**
 * Handle customer.subscription.created/updated
 * Updates subscription details for recurring subscriptions
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id as string;
  const status = subscription.status as string;
  const currentPeriodEnd = subscription.current_period_end as number;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end as boolean;
  
  // Get user by customer ID
  const sub = await getSubscriptionByCustomerId(supabase, customerId);
  if (!sub) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }
  
  // Map Stripe status to our status
  let ourStatus: SubscriptionStatus;
  switch (status) {
    case 'active':
    case 'trialing':
      ourStatus = cancelAtPeriodEnd ? 'canceled' : 'active';
      break;
    case 'canceled':
      ourStatus = 'canceled';
      break;
    case 'past_due':
      ourStatus = 'past_due';
      break;
    case 'unpaid':
      ourStatus = 'unpaid';
      break;
    case 'paused':
      ourStatus = 'grace_period';
      break;
    default:
      ourStatus = 'active';
  }
  
  const update: Record<string, unknown> = {
    status: ourStatus,
    provider_subscription_id: subscriptionId,
    current_period_ends_at: new Date(currentPeriodEnd * 1000).toISOString(),
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  };
  
  // If canceled, record when
  if (cancelAtPeriodEnd && !sub.status.includes('cancel')) {
    update.canceled_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('user_subscriptions')
    .update(update)
    .eq('user_id', sub.user_id);
  
  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
  
  console.log(`Updated subscription ${subscriptionId} for user ${sub.user_id}: ${ourStatus}`);
}

/**
 * Handle customer.subscription.deleted
 * Marks subscription as expired
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const customerId = subscription.customer as string;
  
  const sub = await getSubscriptionByCustomerId(supabase, customerId);
  if (!sub) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }
  
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'expired',
      ends_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', sub.user_id);
  
  if (error) {
    console.error('Error expiring subscription:', error);
    throw error;
  }
  
  console.log(`Expired subscription for user ${sub.user_id}`);
}

/**
 * Handle invoice.paid
 * Updates period end and ensures active status
 */
async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  invoice: Record<string, unknown>
): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string | null;
  const periodEnd = invoice.period_end as number;
  
  // Skip if not a subscription invoice
  if (!subscriptionId) return;
  
  const sub = await getSubscriptionByCustomerId(supabase, customerId);
  if (!sub) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }
  
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_ends_at: new Date(periodEnd * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', sub.user_id);
  
  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
  
  console.log(`Recorded payment for user ${sub.user_id}, period ends ${new Date(periodEnd * 1000).toISOString()}`);
}

/**
 * Handle invoice.payment_failed
 * Sets status to past_due
 */
async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Record<string, unknown>
): Promise<void> {
  const customerId = invoice.customer as string;
  
  const sub = await getSubscriptionByCustomerId(supabase, customerId);
  if (!sub) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }
  
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      payment_failed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', sub.user_id);
  
  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
  
  console.log(`Payment failed for user ${sub.user_id}`);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  // Check configuration
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
    console.error('Stripe webhook not configured');
    return new Response('Webhook not configured', { status: 503 });
  }
  
  // Get signature from header
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }
  
  // Read raw body for signature verification
  const payload = await req.text();
  
  // Verify signature
  const isValid = await verifyWebhookSignature(payload, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('Invalid webhook signature');
    return new Response('Invalid signature', { status: 400 });
  }
  
  // Parse event
  const event = JSON.parse(payload) as StripeEvent;
  
  console.log(`Received webhook: ${event.type} (${event.id})`);
  
  // Initialize Supabase client with service role for admin access
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Try to record event as being processed (atomic insert with conflict handling)
  // This serves as both the idempotency check and the record creation
  const recordResult = await recordEventProcessed(supabase, event.id, event.type, 'success');
  
  // If event already exists, skip processing
  if (recordResult === 'already_exists') {
    console.log(`Event ${event.id} already processed, skipping`);
    return new Response('Already processed', { status: 200 });
  }
  
  // If we couldn't record the event, don't process it
  if (recordResult === 'error') {
    console.error(`Failed to record event ${event.id}, not processing`);
    return new Response('Database error', { status: 500 });
  }
  
  try {
    // Route to appropriate handler
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Event already recorded as success above, just return OK
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error(`Error processing webhook ${event.id}:`, error);
    
    // Update record with error status
    await supabase
      .from('stripe_webhook_events')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('stripe_event_id', event.id);
    
    // Return 500 so Stripe retries
    return new Response('Processing error', { status: 500 });
  }
});
