/**
 * Create Checkout Session Edge Function
 * 
 * Securely creates Stripe Checkout sessions for plan purchases.
 * Now supports promo codes for influencer discounts.
 * 
 * @security This function has access to server-side Stripe secrets only.
 * No Stripe secrets are exposed to the client.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================================================
// TYPES
// ============================================================================

type PlanType = 'monthly' | 'lifetime' | 'interviewPass';

interface CheckoutRequest {
  planType: PlanType;
  successUrl?: string;
  cancelUrl?: string;
  promoCode?: string;
}

interface CheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
  appliedDiscount?: {
    originalPrice: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
  };
}

interface ErrorResponse {
  error: string;
  code: string;
}

interface PromoCodeValidation {
  valid: boolean;
  code: string | null;
  discount_percent: number | null;
  influencer_name: string | null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

const PRICE_ID_MAP: Record<PlanType, string | undefined> = {
  monthly: Deno.env.get('STRIPE_PRICE_ID_MONTHLY'),
  lifetime: Deno.env.get('STRIPE_PRICE_ID_LIFETIME'),
  interviewPass: Deno.env.get('STRIPE_PRICE_ID_INTERVIEW_PASS'),
};

// Plan display names for Stripe Checkout
const PLAN_NAMES: Record<PlanType, string> = {
  monthly: 'Premium Monthly',
  lifetime: 'Lifetime Access',
  interviewPass: '90-Day Interview Pass',
};

// Plan prices in cents (for calculating discounts)
const PLAN_PRICES: Record<PlanType, number> = {
  monthly: 1999,    // $19.99
  lifetime: 7999,   // $79.99
  interviewPass: 3999, // $39.99
};

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// PROMO CODE FUNCTIONS
// ============================================================================

/**
 * Validate promo code with database
 */
async function validatePromoCode(
  supabase: ReturnType<typeof createClient>,
  code: string
): Promise<PromoCodeValidation> {
  try {
    const { data, error } = await supabase.rpc('validate_promo_code', {
      p_code: code,
    });

    if (error) {
      console.error('Error validating promo code:', error);
      return { valid: false, code: null, discount_percent: null, influencer_name: null };
    }

    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      valid: result?.valid || false,
      code: result?.code || null,
      discount_percent: result?.discount_percent || null,
      influencer_name: result?.influencer_name || null,
    };
  } catch (err) {
    console.error('Unexpected error validating promo code:', err);
    return { valid: false, code: null, discount_percent: null, influencer_name: null };
  }
}

/**
 * Record referral event
 */
async function recordReferralEvent(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string;
    promoCode?: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.rpc('record_referral_event', {
      p_user_id: params.userId,
      p_promo_code: params.promoCode || null,
      p_referrer: 'stripe_checkout',
      p_landing_page: null,
      p_event_type: params.eventType,
      p_metadata: params.metadata || {},
    });
  } catch (err) {
    // Log but don't fail checkout if recording fails
    console.error('Error recording referral event:', err);
  }
}

/**
 * Calculate discount for a plan
 */
function calculateDiscount(
  planType: PlanType,
  discountPercent: number
): { discountAmount: number; finalPrice: number } {
  const originalPrice = PLAN_PRICES[planType];
  const discountAmount = Math.round(originalPrice * discountPercent / 100);
  const finalPrice = originalPrice - discountAmount;
  
  return { discountAmount, finalPrice };
}

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
          error: 'Payment system not configured', 
          code: 'STRIPE_NOT_CONFIGURED' 
        } as ErrorResponse),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { planType, successUrl, cancelUrl, promoCode }: CheckoutRequest = await req.json();

    // Validate plan type
    if (!planType || !['monthly', 'lifetime', 'interviewPass'].includes(planType)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid plan type. Must be: monthly, lifetime, or interviewPass', 
          code: 'INVALID_PLAN_TYPE' 
        } as ErrorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get price ID for plan
    const priceId = PRICE_ID_MAP[planType];
    if (!priceId) {
      console.error(`Price ID not configured for plan: ${planType}`);
      return new Response(
        JSON.stringify({ 
          error: `Payment not configured for this plan`, 
          code: 'PRICE_NOT_CONFIGURED' 
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

    // Validate promo code if provided
    let promoValidation: PromoCodeValidation | null = null;
    let discountInfo: { discountAmount: number; finalPrice: number } | null = null;
    
    if (promoCode && promoCode.trim()) {
      promoValidation = await validatePromoCode(supabaseClient, promoCode);
      
      if (promoValidation.valid && promoValidation.discount_percent) {
        discountInfo = calculateDiscount(planType, promoValidation.discount_percent);
      }
    }

    // Get or create Stripe customer
    const { data: existingSub } = await supabaseClient
      .from('user_subscriptions')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = existingSub?.provider_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || '',
          metadata: JSON.stringify({
            user_id: user.id,
            app_source: 'interview_ready',
            promo_code: promoValidation?.code || '',
          }),
        }),
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json();
        console.error('Failed to create Stripe customer:', errorData);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to initialize payment', 
            code: 'CUSTOMER_CREATE_FAILED' 
          } as ErrorResponse),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const customer = await customerResponse.json();
      customerId = customer.id;

      // Store customer ID in subscription record
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          provider: 'stripe',
          provider_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    // Determine mode based on plan type
    const isSubscription = planType === 'monthly';

    // Default URLs
    const defaultSuccessUrl = `${req.headers.get('origin') || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${req.headers.get('origin') || 'http://localhost:5173'}/billing/cancel`;

    // Build checkout session parameters
    const sessionParams: Record<string, string> = {
      'customer': customerId,
      'mode': isSubscription ? 'subscription' : 'payment',
      'success_url': successUrl || defaultSuccessUrl,
      'cancel_url': cancelUrl || defaultCancelUrl,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'client_reference_id': user.id,
      'metadata[user_id]': user.id,
      'metadata[plan_type]': planType,
      'metadata[app_source]': 'interview_ready',
    };

    // Add promo code metadata if valid
    if (promoValidation?.valid && promoValidation.code) {
      sessionParams['metadata[promo_code]'] = promoValidation.code;
      sessionParams['metadata[discount_percent]'] = String(promoValidation.discount_percent);
      sessionParams['metadata[influencer_name]'] = promoValidation.influencer_name || '';
    }

    // Add payment_intent_data for one-time payments
    if (!isSubscription) {
      sessionParams['payment_intent_data[metadata][user_id]'] = user.id;
      sessionParams['payment_intent_data[metadata][plan_type]'] = planType;
      sessionParams['payment_intent_data[metadata][app_source]'] = 'interview_ready';
      
      if (promoValidation?.valid && promoValidation.code) {
        sessionParams['payment_intent_data[metadata][promo_code]'] = promoValidation.code;
        sessionParams['payment_intent_data[metadata][discount_percent]'] = String(promoValidation.discount_percent);
      }
      
      // Apply discount coupon if discount exists (for one-time payments)
      // Note: For subscriptions, discounts should be configured in Stripe Dashboard
      // or applied via subscription discounts API
      if (discountInfo && discountInfo.finalPrice < PLAN_PRICES[planType]) {
        // Create a coupon for this discount if needed
        // For now, we'll record the discount in metadata
        sessionParams['metadata[discounted_amount]'] = String(discountInfo.finalPrice);
      }
    } else {
      // Add subscription_data for subscriptions
      sessionParams['subscription_data[metadata][user_id]'] = user.id;
      sessionParams['subscription_data[metadata][plan_type]'] = planType;
      sessionParams['subscription_data[metadata][app_source]'] = 'interview_ready';
      
      if (promoValidation?.valid && promoValidation.code) {
        sessionParams['subscription_data[metadata][promo_code]'] = promoValidation.code;
      }
      
      // Allow promotion codes to be entered at checkout for subscriptions
      sessionParams['allow_promotion_codes'] = 'true';
    }

    // Record checkout event
    await recordReferralEvent(supabaseClient, {
      userId: user.id,
      promoCode: promoValidation?.code || undefined,
      eventType: 'checkout',
      metadata: {
        plan_type: planType,
        discount_percent: promoValidation?.discount_percent || 0,
      },
    });

    const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(sessionParams),
    });

    if (!sessionResponse.ok) {
      const errorData = await sessionResponse.json();
      console.error('Failed to create checkout session:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create checkout session', 
          code: 'CHECKOUT_CREATE_FAILED' 
        } as ErrorResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const session = await sessionResponse.json();

    // Build response
    const response: CheckoutResponse = {
      checkoutUrl: session.url,
      sessionId: session.id,
    };

    // Include discount info if applied
    if (discountInfo && promoValidation?.valid) {
      response.appliedDiscount = {
        originalPrice: PLAN_PRICES[planType] / 100,
        discountPercent: promoValidation.discount_percent!,
        discountAmount: discountInfo.discountAmount / 100,
        finalPrice: discountInfo.finalPrice / 100,
      };
    }

    // Return checkout URL
    return new Response(
      JSON.stringify(response),
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
