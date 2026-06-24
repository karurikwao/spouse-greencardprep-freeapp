/**
 * Generate PDF Signed URL Edge Function
 * 
 * Creates a time-limited signed URL for premium PDF downloads.
 * Checks user entitlements before granting access.
 * 
 * POST /functions/v1/generate-pdf-signed-url
 * Body: { fileKey: string }
 * Headers: Authorization: Bearer <user_jwt>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  fileKey: string;
  topicId?: string;
  categoryId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with auth
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
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { fileKey, topicId, categoryId }: RequestBody = await req.json();

    if (!fileKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'fileKey is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a public sample PDF
    const { data: pdfAsset, error: pdfError } = await supabaseClient
      .from('pdf_assets')
      .select('is_premium, is_public_sample, title')
      .eq('file_key', fileKey)
      .single();

    // If PDF not in registry or is premium, check entitlements
    const needsEntitlement = !pdfAsset || (pdfAsset.is_premium && !pdfAsset.is_public_sample);

    if (needsEntitlement) {
      // Check if user has premium access via RPC
      const { data: hasAccess, error: accessError } = await supabaseClient
        .rpc('has_premium_access', { p_user_id: user.id });

      if (accessError || !hasAccess) {
        // Record denied access attempt
        await supabaseClient.rpc('record_pdf_download', {
          p_user_id: user.id,
          p_user_email: user.email,
          p_pdf_filename: fileKey,
          p_pdf_title: pdfAsset?.title || fileKey,
          p_topic_id: topicId || null,
          p_category_id: categoryId || null,
          p_download_source: 'topic_page',
          p_event_status: 'denied',
          p_session_hash: null,
          p_user_agent_hash: null,
        });

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Premium subscription required',
            requiresUpgrade: true 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate signed URL (expires in 5 minutes)
    const { data: signedUrl, error: urlError } = await supabaseClient
      .storage
      .from('premium-pdfs')
      .createSignedUrl(fileKey, 300); // 5 minutes

    if (urlError || !signedUrl) {
      console.error('Error generating signed URL:', urlError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate download link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record successful access grant
    await supabaseClient.rpc('record_pdf_download', {
      p_user_id: user.id,
      p_user_email: user.email,
      p_pdf_filename: fileKey,
      p_pdf_title: pdfAsset?.title || fileKey,
      p_topic_id: topicId || null,
      p_category_id: categoryId || null,
      p_download_source: 'topic_page',
      p_event_status: 'access_granted',
      p_session_hash: null,
      p_user_agent_hash: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrl.signedUrl,
        expiresIn: 300,
        fileKey,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
