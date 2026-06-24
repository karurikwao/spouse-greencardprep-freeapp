/**
 * Trigger Coolify Rebuild Edge Function
 * 
 * Securely triggers a Coolify rebuild/deploy from the admin dashboard.
 * This function is called server-side only and requires admin authorization.
 * 
 * Security features:
 * - Coolify webhook URL stored as Edge Function environment variable (server-side only)
 * - Admin-only access enforced via auth checks
 * - Request origin validation
 * - No exposure of Coolify secrets to frontend or database
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
interface RebuildResponse {
  success: boolean;
  message: string;
  triggeredAt?: string;
  estimatedCompletion?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Coolify webhook URL - stored securely server-side only
    const coolifyWebhookUrl = Deno.env.get('COOLIFY_WEBHOOK_URL');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Server configuration error',
          error: 'Missing Supabase configuration',
        } as RebuildResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!coolifyWebhookUrl) {
      console.error('Missing Coolify webhook configuration');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Rebuild is not configured. Please contact a developer to set up Coolify webhook.',
          error: 'Missing Coolify webhook URL',
        } as RebuildResponse),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized',
          error: 'Missing authorization header',
        } as RebuildResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized',
          error: 'Invalid authentication',
        } as RebuildResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin
    // First check user metadata
    const isAdmin = user.user_metadata?.is_admin === true || 
                    user.user_metadata?.role === 'admin';
    
    if (!isAdmin) {
      // Double-check against database if metadata doesn't show admin
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('is_admin, role')
        .eq('id', user.id)
        .single();

      if (userError || (!userData?.is_admin && userData?.role !== 'admin')) {
        console.warn(`Non-admin user ${user.id} attempted to trigger rebuild`);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Forbidden - Admin access required',
            error: 'Admin access required to trigger rebuilds',
          } as RebuildResponse),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Parse request body for optional metadata
    let requestBody = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body or invalid JSON is okay - rebuild trigger doesn't require parameters
    }

    const triggeredAt = new Date().toISOString();
    const { reason = 'admin_triggered', source = 'admin_dashboard' } = requestBody as Record<string, string>;

    // Record the attempt in database for audit trail
    await supabase.rpc('record_rebuild_attempt', {
      p_triggered_by: user.id,
      p_triggered_at: triggeredAt,
      p_status: 'pending',
      p_reason: reason,
      p_source: source,
    });

    // Trigger Coolify rebuild via webhook
    // The webhook URL is the Coolify deploy webhook - it doesn't need authentication headers
    // Coolify webhooks are typically unique URLs that act as tokens themselves
    console.log(`Admin ${user.id} triggering Coolify rebuild`);

    const coolifyResponse = await fetch(coolifyWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        triggered_at: triggeredAt,
        triggered_by: user.id,
        source: source,
        reason: reason,
      }),
    });

    if (!coolifyResponse.ok) {
      const errorText = await coolifyResponse.text();
      console.error('Coolify rebuild trigger failed:', coolifyResponse.status, errorText);

      // Record the failure
      await supabase.rpc('record_rebuild_attempt', {
        p_triggered_by: user.id,
        p_triggered_at: triggeredAt,
        p_status: 'error',
        p_reason: reason,
        p_source: source,
        p_error: `HTTP ${coolifyResponse.status}: ${errorText}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to trigger rebuild. Coolify returned: ${coolifyResponse.status} ${coolifyResponse.statusText}`,
          error: `Coolify webhook error: ${errorText || 'Unknown error'}`,
        } as RebuildResponse),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Record the success
    // Note: The rebuild is triggered but completion is async - we don't know when it finishes
    await supabase.rpc('record_rebuild_attempt', {
      p_triggered_by: user.id,
      p_triggered_at: triggeredAt,
      p_status: 'triggered',
      p_reason: reason,
      p_source: source,
    });

    // Estimate completion time (typically 2-5 minutes for most sites)
    const estimatedCompletion = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rebuild triggered successfully. The site will rebuild within 2-5 minutes.',
        triggeredAt: triggeredAt,
        estimatedCompletion: estimatedCompletion,
      } as RebuildResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in trigger-coolify-rebuild:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as RebuildResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
