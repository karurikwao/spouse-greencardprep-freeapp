/**
 * Process Refund Edge Function
 * 
 * Securely processes Stripe refunds for approved refund requests.
 * This function is called server-side only and requires admin authorization.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Response types
interface RefundResponse {
  success: boolean;
  refundId?: string;
  message: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (Deno.env.get('LEGACY_PAID_EDGE_FUNCTIONS_ENABLED') !== 'true') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Legacy Stripe refunds are retired in the free app.',
        error: 'FREE_APP_PAYMENT_RETIRED',
      } as RefundResponse),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Server configuration error',
          error: 'Missing Supabase configuration',
        } as RefundResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!stripeSecretKey) {
      console.error('Missing Stripe configuration');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Stripe is not configured',
          error: 'Missing Stripe secret key',
        } as RefundResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { refundRequestId, adminNotes } = await req.json();

    if (!refundRequestId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Refund request ID is required',
          error: 'Missing refundRequestId',
        } as RefundResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user (admin) from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized',
          error: 'Missing authorization header',
        } as RefundResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized',
          error: 'Invalid authentication',
        } as RefundResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('raw_user_meta_data')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.raw_user_meta_data?.is_admin) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Forbidden',
          error: 'Admin access required',
        } as RefundResponse),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch refund request
    const { data: refundRequest, error: fetchError } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('id', refundRequestId)
      .single();

    if (fetchError || !refundRequest) {
      console.error('Refund request not found:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Refund request not found',
          error: 'Invalid refund request ID',
        } as RefundResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already refunded
    if (refundRequest.eligibility_status === 'refunded') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'This refund has already been processed',
          error: 'Duplicate refund request',
        } as RefundResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if eligible or already approved
    if (!['eligible', 'approved'].includes(refundRequest.eligibility_status)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Refund request is not eligible for processing',
          error: `Current status: ${refundRequest.eligibility_status}`,
        } as RefundResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for payment intent
    if (!refundRequest.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No payment information found for this refund',
          error: 'Missing payment intent ID',
        } as RefundResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process Stripe refund
    console.log(`Processing Stripe refund for payment intent: ${refundRequest.stripe_payment_intent_id}`);

    const stripeResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        payment_intent: refundRequest.stripe_payment_intent_id,
        reason: 'requested_by_customer',
      }),
    });

    if (!stripeResponse.ok) {
      const stripeError = await stripeResponse.json();
      console.error('Stripe refund failed:', stripeError);

      // Update refund request with failed status
      await supabase
        .from('refund_requests')
        .update({
          eligibility_status: 'refund_failed',
          admin_notes: `Stripe error: ${stripeError.error?.message || 'Unknown error'}${adminNotes ? '\n\nAdmin notes: ' + adminNotes : ''}`,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundRequestId);

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Stripe refund failed',
          error: stripeError.error?.message || 'Payment processor error',
        } as RefundResponse),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const stripeData = await stripeResponse.json();
    console.log('Stripe refund successful:', stripeData.id);

    // Update refund request with success status
    const { error: updateError } = await supabase
      .from('refund_requests')
      .update({
        eligibility_status: 'refunded',
        stripe_refund_id: stripeData.id,
        refunded_at: new Date().toISOString(),
        processed_by: user.id,
        processed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequestId);

    if (updateError) {
      console.error('Failed to update refund request:', updateError);
      // Don't fail the response since Stripe refund succeeded
    }

    // Create user notification
    try {
      await supabase.rpc('create_user_notification', {
        p_user_id: refundRequest.user_id,
        p_type: 'refund',
        p_title: 'Refund Processed',
        p_message: `Your refund of $${refundRequest.amount} has been processed and will appear in your account within 5-10 business days.`,
        p_action_url: null,
        p_metadata: { refund_id: refundRequestId, amount: refundRequest.amount },
      });
    } catch (notifyError) {
      console.error('Failed to create notification:', notifyError);
      // Don't fail the response
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundId: stripeData.id,
        message: 'Refund processed successfully',
      } as RefundResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in process-refund:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as RefundResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
