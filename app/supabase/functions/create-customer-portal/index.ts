/**
 * Create Customer Portal Session Edge Function
 * 
 * Creates a Stripe Customer Portal session for managing subscriptions.
 * 
 * @security This function has access to server-side Stripe secrets only.
 * Users can only access their own customer portal.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================================================
// TYPES
// ============================================================================

interface PortalResponse {
  portalUrl: string;
}

interface ErrorResponse {
  error: string;
  code: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify Stripe is configured
    if (!STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Billing system not configured', 
          code: 'STRIPE_NOT_CONFIGURED' 
        } as ErrorResponse),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required', 
          code: 'UNAUTHORIZED' 
        } as ErrorResponse),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user's Stripe customer ID
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('provider_customer_id, provider, plan_type')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription?.provider_customer_id) {
      return new Response(
        JSON.stringify({ 
          error: 'No billing account found. Please purchase a plan first.', 
          code: 'NO_CUSTOMER' 
        } as ErrorResponse),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Only Stripe subscriptions can use the customer portal
    if (subscription.provider !== 'stripe') {
      return new Response(
        JSON.stringify({ 
          error: 'Billing management not available for this plan type', 
          code: 'NOT_STRIPE_CUSTOMER' 
        } as ErrorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // One-time purchases (lifetime, interviewPass) don't need portal
    if (subscription.plan_type === 'lifetime' || subscription.plan_type === 'interviewPass') {
      return new Response(
        JSON.stringify({ 
          error: 'One-time purchases cannot be managed through the billing portal. Contact support for assistance.', 
          code: 'ONE_TIME_PURCHASE' 
        } as ErrorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Default return URL
    const returnUrl = `${req.headers.get('origin') || 'http://localhost:5173'}/dashboard`;

    // Create portal session
    const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: subscription.provider_customer_id,
        return_url: returnUrl,
      }),
    });

    if (!portalResponse.ok) {
      const errorData = await portalResponse.json();
      console.error('Failed to create portal session:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create billing portal session', 
          code: 'PORTAL_CREATE_FAILED' 
        } as ErrorResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const portalSession = await portalResponse.json();

    // Return portal URL
    return new Response(
      JSON.stringify({
        portalUrl: portalSession.url,
      } as PortalResponse),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred', 
        code: 'INTERNAL_ERROR' 
      } as ErrorResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
