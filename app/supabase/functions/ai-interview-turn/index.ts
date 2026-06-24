/**
 * AI Interview Turn Edge Function
 * 
 * Secure server-side handler for AI interview turns with plan enforcement.
 * All provider API calls happen here with server-side secrets.
 * All plan limits are enforced server-side based on user's subscription.
 * 
 * @security This function has access to server-side env vars only.
 * No API keys are exposed to the client.
 * Plan limits are enforced in the backend, not client-side.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================================================
// TYPES
// ============================================================================

type AIProvider = 'openai' | 'anthropic' | 'deepseek';
type PlanType = 'trial' | 'monthly' | 'lifetime' | 'interviewPass';

interface PlanConfig {
  plan_type: PlanType;
  name: string;
  max_turns_per_session: number;
  max_sessions_per_day: number;
  can_use_ai: boolean;
  can_choose_provider: boolean;
  can_choose_model: boolean;
  ai_enabled: boolean;
}

interface UserSubscription {
  user_id: string;
  plan_type: PlanType;
  status: 'trialing' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  pass_ends_at: string | null;
}

interface AIUsageStatus {
  dailySessionCount: number;
  dailyTurnCount: number;
  currentSessionTurnCount: number;
  hasActiveSession: boolean;
  activeSessionId: string | null;
}

type FeedbackLabel =
  | 'clear_and_natural'
  | 'could_use_more_detail'
  | 'worth_reviewing_together'
  | 'a_little_vague'
  | 'review_gently';

interface InterviewTurnRequest {
  provider: AIProvider;
  modelId: string;
  interviewMode: 'standard' | 'topic' | 'stress_review' | 'couple';
  sessionId?: string; // Optional: if continuing an existing session
  anonymousId?: string; // Optional: for anonymous user tracking (trial/demo)
  questionContext: {
    id: string;
    prompt: string;
    sampleAnswer?: string;
    officerLookingFor?: string[];
    avoidThis?: string[];
    explanation?: string;
    shortPrompt?: string;
  };
  topicContext: {
    id: string;
    title: string;
    description?: string;
  };
  categoryContext: {
    id: string;
    name: string;
  };
  userAnswer: string;
  previousTurns?: Array<{
    aiQuestion: string;
    userAnswer: string;
    feedbackLabel: FeedbackLabel;
  }>;
  userStoryContext?: {
    actualAnswer?: string;
    keyDates?: string;
    keyPlaces?: string;
    keyPeople?: string;
  };
  turnNumber: number;
  maxTurns: number;
}

interface InterviewTurnResponse {
  success: boolean;
  data?: {
    feedbackSummary: string;
    feedbackLabel: FeedbackLabel;
    followUpQuestion: string;
    suggestedReviewTopics?: string[];
    suggestedQuestionIds?: string[];
    explanation?: string;
    rawProvider: string;
    rawModel: string;
    sessionId?: string;
    turnsRemaining?: number;
    planType?: PlanType;
  };
  error?: {
    code: string;
    message: string;
    userMessage: string;
    upgradeRecommended?: boolean;
  };
}

// ============================================================================
// ERROR CODES
// ============================================================================

const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PLAN_EXPIRED: 'PLAN_EXPIRED',
  PLAN_LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  FEATURE_NOT_ENABLED: 'FEATURE_NOT_ENABLED',
  MODEL_NOT_ALLOWED: 'MODEL_NOT_ALLOWED',
  PROVIDER_NOT_ALLOWED: 'PROVIDER_NOT_ALLOWED',
  AI_DISABLED: 'AI_DISABLED',
  SESSION_LIMIT_REACHED: 'SESSION_LIMIT_REACHED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MODEL_DISABLED: 'MODEL_DISABLED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function createSupabaseClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
  });
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Generate a consistent anonymous ID from the provided anonymousId
 * If no anonymousId provided, return null (will be handled by caller)
 */
function getAnonymousUserId(anonymousId?: string): string | null {
  if (!anonymousId) return null;
  // Prefix to distinguish from real user IDs
  return `anon_${anonymousId}`;
}

async function authenticateUser(
  supabase: ReturnType<typeof createSupabaseClient>,
  authHeader: string | null,
  anonymousId?: string
): Promise<{ userId: string | null; isAnonymous: boolean }> {
  // If auth header exists, try to get real user
  if (authHeader) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!error && user) {
        return { userId: user.id, isAnonymous: false };
      }
    } catch {
      // Fall through to anonymous handling
    }
  }
  
  // Use anonymous ID if provided, otherwise return null
  // (null will be handled by enforcePlanLimits as trial user)
  const anonUserId = getAnonymousUserId(anonymousId);
  return { userId: anonUserId, isAnonymous: true };
}

// ============================================================================
// PLAN RESOLUTION
// ============================================================================

async function getPlanConfig(
  supabase: ReturnType<typeof createSupabaseClient>,
  planType: PlanType
): Promise<PlanConfig | null> {
  const { data, error } = await supabase
    .from('plan_config')
    .select('*')
    .eq('plan_type', planType)
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    console.error('Failed to get plan config:', error);
    return null;
  }
  
  return data as PlanConfig;
}

async function getUserSubscription(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string | null
): Promise<{ subscription: UserSubscription; isAnonymous: boolean }> {
  // For anonymous users, use trial plan with temporary tracking
  if (!userId) {
    return {
      subscription: {
        user_id: 'anonymous',
        plan_type: 'trial',
        status: 'trialing',
        trial_ends_at: null,
        current_period_ends_at: null,
        pass_ends_at: null,
      },
      isAnonymous: true,
    };
  }
  
  // Get or create subscription for authenticated user
  const { data, error } = await supabase
    .rpc('get_or_create_subscription', { p_user_id: userId });
  
  if (error || !data) {
    console.error('Failed to get subscription:', error);
    // Fallback to trial
    return {
      subscription: {
        user_id: userId,
        plan_type: 'trial',
        status: 'trialing',
        trial_ends_at: null,
        current_period_ends_at: null,
        pass_ends_at: null,
      },
      isAnonymous: false,
    };
  }
  
  return { subscription: data as UserSubscription, isAnonymous: false };
}

function isPlanExpired(subscription: UserSubscription): boolean {
  const now = new Date().toISOString();
  
  if (subscription.status === 'expired') return true;
  
  if (subscription.plan_type === 'trial' && subscription.trial_ends_at) {
    return now > subscription.trial_ends_at;
  }
  
  if (subscription.plan_type === 'monthly' && subscription.current_period_ends_at) {
    return now > subscription.current_period_ends_at;
  }
  
  if (subscription.plan_type === 'interviewPass' && subscription.pass_ends_at) {
    return now > subscription.pass_ends_at;
  }
  
  return false;
}

function getEffectivePlan(subscription: UserSubscription): PlanType {
  if (isPlanExpired(subscription)) {
    return 'trial';
  }
  return subscription.plan_type;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

async function getAIUsageStatus(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string | null,
  sessionId?: string
): Promise<AIUsageStatus> {
  if (!userId) {
    // Anonymous users have no persisted usage
    return {
      dailySessionCount: 0,
      dailyTurnCount: 0,
      currentSessionTurnCount: 0,
      hasActiveSession: false,
      activeSessionId: null,
    };
  }
  
  // Get daily session count
  const { data: sessionCount, error: countError } = await supabase
    .rpc('get_daily_session_count', { p_user_id: userId });
  
  if (countError) {
    console.error('Failed to get session count:', countError);
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: dailyTurnCount, error: turnCountError } = await supabase
    .from('ai_interview_turns')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString());

  if (turnCountError) {
    console.error('Failed to get daily turn count:', turnCountError);
  }
  
  // Get current session if provided
  let currentTurnCount = 0;
  let hasActiveSession = false;
  let activeSessionId = sessionId || null;
  
  if (sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from('ai_interview_sessions')
      .select('turn_count, status')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    
    if (!sessionError && session) {
      currentTurnCount = session.turn_count;
      hasActiveSession = session.status === 'active';
    }
  }
  
  return {
    dailySessionCount: sessionCount || 0,
    dailyTurnCount: dailyTurnCount || 0,
    currentSessionTurnCount: currentTurnCount,
    hasActiveSession,
    activeSessionId,
  };
}

async function createSession(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string | null,
  planType: PlanType,
  provider: AIProvider,
  modelId: string,
  mode: string,
  maxTurns: number
): Promise<string | null> {
  if (!userId) return null; // Anonymous sessions not persisted
  
  const { data, error } = await supabase
    .from('ai_interview_sessions')
    .insert({
      user_id: userId,
      plan_type: planType,
      provider,
      model_id: modelId,
      mode,
      max_turns: maxTurns,
      turn_count: 0,
      status: 'active',
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create session:', error);
    return null;
  }
  
  return data.id;
}

async function recordTurn(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string | null,
  sessionId: string | null,
  request: InterviewTurnRequest,
  response: InterviewTurnResponse['data']
): Promise<void> {
  if (!userId || !sessionId) return; // Don't record anonymous turns
  
  // Insert turn record
  const { error: turnError } = await supabase
    .from('ai_interview_turns')
    .insert({
      session_id: sessionId,
      user_id: userId,
      question_id: request.questionContext.id,
      turn_number: request.turnNumber,
      ai_question: response.followUpQuestion,
      user_answer: request.userAnswer,
      feedback_label: response.feedbackLabel,
      feedback_summary: response.feedbackSummary,
      suggested_review_topics: response.suggestedReviewTopics || [],
      provider: request.provider,
      model_id: request.modelId,
    });
  
  if (turnError) {
    console.error('Failed to record turn:', turnError);
  }
  
  // Update session turn count
  const { error: sessionError } = await supabase
    .from('ai_interview_sessions')
    .update({
      turn_count: request.turnNumber,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  
  if (sessionError) {
    console.error('Failed to update session:', sessionError);
  }
}

// ============================================================================
// PLAN ENFORCEMENT
// ============================================================================

interface EnforcementResult {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
    userMessage: string;
    upgradeRecommended?: boolean;
  };
  sessionId?: string;
  effectivePlan?: PlanType;
  turnsRemaining?: number;
}

async function enforcePlanLimits(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string | null,
  request: InterviewTurnRequest
): Promise<EnforcementResult> {
  // 1. Get user's subscription
  const { subscription, isAnonymous } = await getUserSubscription(supabase, userId);
  
  // 2. Determine effective plan (handle expiration)
  const effectivePlan = getEffectivePlan(subscription);
  
  // 3. Get plan configuration
  const planConfig = await getPlanConfig(supabase, effectivePlan);
  
  if (!planConfig) {
    return {
      allowed: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Plan configuration not found',
        userMessage: 'Unable to verify your plan. Please try again.',
      },
    };
  }
  
  // 4. Check if AI is enabled for this plan
  if (!planConfig.ai_enabled || !planConfig.can_use_ai) {
    return {
      allowed: false,
      error: {
        code: ERROR_CODES.AI_DISABLED,
        message: 'AI not enabled for plan',
        userMessage: 'AI interview practice is not available on your current plan. Please upgrade to continue.',
        upgradeRecommended: true,
      },
      effectivePlan,
    };
  }
  
  // 5. Check provider access
  if (!planConfig.can_choose_provider) {
    // Trial plan: only allow default provider (openai)
    if (request.provider !== 'openai') {
      return {
        allowed: false,
        error: {
          code: ERROR_CODES.PROVIDER_NOT_ALLOWED,
          message: 'Provider not allowed for trial plan',
          userMessage: 'Provider selection is available on premium plans. Please upgrade to access more AI providers.',
          upgradeRecommended: true,
        },
        effectivePlan,
      };
    }
  }
  
  // 6. Check model access
  if (!planConfig.can_choose_model) {
    // Trial plan: only allow specific models (gpt-5-mini)
    const allowedTrialModels = ['gpt-5-mini', 'deepseek-chat'];
    if (!allowedTrialModels.includes(request.modelId)) {
      return {
        allowed: false,
        error: {
          code: ERROR_CODES.MODEL_NOT_ALLOWED,
          message: 'Model not allowed for trial plan',
          userMessage: 'This AI model is available on premium plans. Please upgrade to access advanced models.',
          upgradeRecommended: true,
        },
        effectivePlan,
      };
    }
  }
  
  // 7. Get current usage status
  const usage = await getAIUsageStatus(supabase, userId, request.sessionId);
  
  // 8. Check daily Robin chat limit
  if (usage.dailyTurnCount >= planConfig.max_turns_per_session) {
    return {
      allowed: false,
      error: {
        code: ERROR_CODES.PLAN_LIMIT_REACHED,
        message: `Daily Robin chat limit reached (${planConfig.max_turns_per_session})`,
        userMessage: `You've reached your daily limit of ${planConfig.max_turns_per_session} Robin chats. Upgrade for more daily chats or try again tomorrow.`,
        upgradeRecommended: true,
      },
      effectivePlan,
    };
  }
  
  // 9. Check legacy per-session turn limit for the active interview UI
  const turnsRemaining = planConfig.max_turns_per_session - usage.dailyTurnCount - 1;
  
  if (request.turnNumber > planConfig.max_turns_per_session) {
    return {
      allowed: false,
      error: {
        code: ERROR_CODES.SESSION_LIMIT_REACHED,
        message: `Turn limit reached (${planConfig.max_turns_per_session})`,
        userMessage: `You've reached the daily limit of ${planConfig.max_turns_per_session} Robin chats. Upgrade for more daily chats or try again tomorrow.`,
        upgradeRecommended: true,
      },
      effectivePlan,
    };
  }
  
  // 10. Create new session if needed
  let sessionId = request.sessionId;
  if (!sessionId && userId) {
    sessionId = await createSession(
      supabase,
      userId,
      effectivePlan,
      request.provider,
      request.modelId,
      request.interviewMode,
      planConfig.max_turns_per_session
    );
  }
  
  return {
    allowed: true,
    sessionId: sessionId || undefined,
    effectivePlan,
    turnsRemaining: Math.max(0, turnsRemaining),
  };
}

// ============================================================================
// MODEL REGISTRY (Server-side)
// ============================================================================

const REGISTERED_MODELS = [
  // OpenAI Models
  { provider: 'openai' as const, modelId: 'gpt-5-mini', enabled: true, tier: 'standard' },
  { provider: 'openai' as const, modelId: 'gpt-5.4', enabled: true, tier: 'premium' },
  // Anthropic Models
  { provider: 'anthropic' as const, modelId: 'claude-sonnet-4-5-20251022', enabled: true, tier: 'premium' },
  { provider: 'anthropic' as const, modelId: 'claude-opus-4-5-20251101', enabled: true, tier: 'premium' },
  // DeepSeek Models
  { provider: 'deepseek' as const, modelId: 'deepseek-chat', enabled: true, tier: 'standard' },
  { provider: 'deepseek' as const, modelId: 'deepseek-reasoner', enabled: true, tier: 'premium' },
];

function isModelEnabled(provider: AIProvider, modelId: string): boolean {
  return REGISTERED_MODELS.some(
    (m) => m.provider === provider && m.modelId === modelId && m.enabled
  );
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(): string {
  return `You are a calm, supportive marriage-based green card interview practice coach.

YOUR ROLE:
- Help couples practice for their USCIS marriage interview
- Ask one question at a time, just like a real officer
- Provide gentle, constructive feedback
- Never judge, accuse, or use harsh grading language

TONE:
- Calm and professional
- Encouraging and supportive
- Clear and concise
- Patient with nervous users

IMPORTANT RULES:
- Ask ONE question at a time
- Wait for the user's answer before proceeding
- Provide brief, helpful feedback (2-3 sentences max)
- Follow up with a relevant next question
- Never guarantee legal outcomes
- Never accuse users of fraud or dishonesty
- Never use shaming language
- Keep responses concise (under 150 words when possible)

FEEDBACK GUIDELINES:
Use these feedback labels:
- "clear_and_natural": Answer sounds authentic and well-explained
- "could_use_more_detail": Suggest adding specific examples or dates
- "worth_reviewing_together": Recommend discussing with partner to align
- "a_little_vague": Encourage more specific details
- "review_gently": This topic may need more preparation

STRUCTURED OUTPUT:
Always respond with valid JSON in this format:
{
  "feedbackSummary": "Brief encouraging feedback (1-2 sentences)",
  "feedbackLabel": "one of: clear_and_natural, could_use_more_detail, worth_reviewing_together, a_little_vague, review_gently",
  "followUpQuestion": "The next interview question to ask",
  "suggestedReviewTopics": ["optional topic suggestions"],
  "explanation": "Brief context on why this question matters (optional)"
}`;
}

// ============================================================================
// USER PROMPT BUILDER
// ============================================================================

function buildUserPrompt(request: InterviewTurnRequest): string {
  const {
    questionContext,
    topicContext,
    categoryContext,
    userAnswer,
    previousTurns = [],
    userStoryContext,
    turnNumber,
    maxTurns,
  } = request;

  const parts: string[] = [];

  // Session context
  parts.push(`=== SESSION CONTEXT ===`);
  parts.push(`Turn: ${turnNumber} of ${maxTurns}`);
  parts.push(`Topic: ${topicContext.title}`);
  parts.push(`Category: ${categoryContext.name}`);
  parts.push('');

  // Current question grounding
  parts.push(`=== CURRENT QUESTION ===`);
  parts.push(`Question: "${questionContext.prompt}"`);
  if (questionContext.sampleAnswer) {
    parts.push(`Sample Answer: "${questionContext.sampleAnswer}"`);
  }
  if (questionContext.officerLookingFor && questionContext.officerLookingFor.length > 0) {
    parts.push(`What Officers Look For: ${questionContext.officerLookingFor.join('; ')}`);
  }
  if (questionContext.avoidThis && questionContext.avoidThis.length > 0) {
    parts.push(`Common Mistakes to Avoid: ${questionContext.avoidThis.join('; ')}`);
  }
  if (questionContext.explanation) {
    parts.push(`Why This Matters: ${questionContext.explanation}`);
  }
  parts.push('');

  // User's personal notes (if available)
  if (userStoryContext?.actualAnswer) {
    parts.push(`=== USER'S SAVED ANSWER (OUR STORY) ===`);
    parts.push(userStoryContext.actualAnswer);
    if (userStoryContext.keyDates) {
      parts.push(`Key Dates: ${userStoryContext.keyDates}`);
    }
    if (userStoryContext.keyPlaces) {
      parts.push(`Key Places: ${userStoryContext.keyPlaces}`);
    }
    parts.push('');
  }

  // Previous conversation context
  if (previousTurns.length > 0) {
    const recentTurns = previousTurns.slice(-2);
    parts.push(`=== PREVIOUS CONVERSATION ===`);
    for (const turn of recentTurns) {
      parts.push(`Q: ${turn.aiQuestion}`);
      parts.push(`A: ${turn.userAnswer}`);
      parts.push('');
    }
  }

  // Current user answer
  parts.push(`=== USER'S CURRENT ANSWER ===`);
  parts.push(userAnswer);
  parts.push('');

  // Instructions
  parts.push(`=== YOUR TASK ===`);
  parts.push(`The user has just answered the interview question.`);
  parts.push(`1. Provide brief, gentle feedback on their answer`);
  parts.push(`2. Select a relevant follow-up question based on their response`);
  parts.push(`3. If needed, suggest topics for them to review`);
  parts.push('');
  parts.push(`Remember: Respond ONLY with the JSON format specified in your system instructions.`);

  return parts.join('\n');
}

// ============================================================================
// PROVIDER ADAPTERS (Server-side only)
// ============================================================================

async function callOpenAI(
  modelId: string,
  systemPrompt: string,
  userMessage: string
): Promise<{ success: boolean; content: string; error?: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    return { success: false, content: '', error: 'OpenAI API key not configured' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        content: '',
        error: errorData.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0]?.message?.content || '',
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function callAnthropic(
  modelId: string,
  systemPrompt: string,
  userMessage: string
): Promise<{ success: boolean; content: string; error?: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    return { success: false, content: '', error: 'Anthropic API key not configured' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        content: '',
        error: errorData.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    let content = '';
    if (data.content && Array.isArray(data.content)) {
      content = data.content
        .filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('');
    }

    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function callDeepSeek(
  modelId: string,
  systemPrompt: string,
  userMessage: string
): Promise<{ success: boolean; content: string; error?: string }> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  
  if (!apiKey) {
    return { success: false, content: '', error: 'DeepSeek API key not configured' };
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        content: '',
        error: errorData.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0]?.message?.content || '',
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function validateFeedbackLabel(label: string | undefined): FeedbackLabel {
  const validLabels: FeedbackLabel[] = [
    'clear_and_natural',
    'could_use_more_detail',
    'worth_reviewing_together',
    'a_little_vague',
    'review_gently',
  ];
  
  if (label && validLabels.includes(label as FeedbackLabel)) {
    return label as FeedbackLabel;
  }
  
  return 'clear_and_natural';
}

function parseAIResponse(
  content: string,
  provider: AIProvider,
  modelId: string
): InterviewTurnResponse['data'] {
  try {
    const parsed = JSON.parse(content);
    
    return {
      feedbackSummary: parsed.feedbackSummary || 'Thanks for your answer.',
      feedbackLabel: validateFeedbackLabel(parsed.feedbackLabel),
      followUpQuestion: parsed.followUpQuestion || 'Can you tell me more about that?',
      suggestedReviewTopics: parsed.suggestedReviewTopics || [],
      suggestedQuestionIds: parsed.suggestedQuestionIds || [],
      explanation: parsed.explanation,
      rawProvider: provider,
      rawModel: modelId,
    };
  } catch (e) {
    // If JSON parsing fails, extract what we can from text
    const lines = content.split('\n').filter((l) => l.trim());
    const feedbackSummary = lines[0] || 'Thanks for your answer.';
    const followUpQuestion = lines.find((l) => l.includes('?')) || 'Can you tell me more about that?';
    
    return {
      feedbackSummary,
      feedbackLabel: 'clear_and_natural',
      followUpQuestion,
      suggestedReviewTopics: [],
      suggestedQuestionIds: [],
      rawProvider: provider,
      rawModel: modelId,
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: { 
          code: ERROR_CODES.INVALID_REQUEST, 
          message: 'Only POST requests allowed', 
          userMessage: 'Invalid request method' 
        },
      }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Initialize Supabase client
  const authHeader = req.headers.get('authorization');
  let supabase;
  try {
    supabase = createSupabaseClient(authHeader);
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { 
          code: ERROR_CODES.INTERNAL_ERROR, 
          message: 'Server configuration error', 
          userMessage: 'Service temporarily unavailable. Please try again.' 
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Parse request body first to get anonymousId
    let request: InterviewTurnRequest;
    try {
      request = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: { 
            code: ERROR_CODES.INVALID_REQUEST, 
            message: 'Invalid JSON body', 
            userMessage: 'Invalid request data. Please try again.' 
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Authenticate user (after parsing to get anonymousId)
    const { userId, isAnonymous } = await authenticateUser(supabase, authHeader, request.anonymousId);
    
    // 3. Validate required fields
    if (!request.provider || !request.modelId || !request.questionContext || !request.userAnswer) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { 
            code: ERROR_CODES.INVALID_REQUEST, 
            message: 'Missing required fields', 
            userMessage: 'Missing required information. Please try again.' 
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate provider and model are enabled globally
    if (!isModelEnabled(request.provider, request.modelId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { 
            code: ERROR_CODES.MODEL_DISABLED, 
            message: 'Provider or model not enabled', 
            userMessage: 'This AI model is not available. Please choose another.' 
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. ENFORCE PLAN LIMITS (server-side)
    const enforcement = await enforcePlanLimits(supabase, userId, request);
    
    if (!enforcement.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: enforcement.error,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(request);

    // 7. Call appropriate provider
    let providerResult: { success: boolean; content: string; error?: string };
    
    switch (request.provider) {
      case 'openai':
        providerResult = await callOpenAI(request.modelId, systemPrompt, userPrompt);
        break;
      case 'anthropic':
        providerResult = await callAnthropic(request.modelId, systemPrompt, userPrompt);
        break;
      case 'deepseek':
        providerResult = await callDeepSeek(request.modelId, systemPrompt, userPrompt);
        break;
      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: { 
              code: ERROR_CODES.INVALID_REQUEST, 
              message: 'Unknown provider', 
              userMessage: 'Invalid AI provider selected.' 
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 8. Handle provider error
    if (!providerResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { 
            code: ERROR_CODES.PROVIDER_ERROR, 
            message: providerResult.error || 'Provider call failed', 
            userMessage: 'AI interview is temporarily unavailable. Please try again or choose another provider.' 
          },
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 9. Parse and normalize response
    const normalizedResult = parseAIResponse(
      providerResult.content,
      request.provider,
      request.modelId
    );

    // 10. Record turn usage (async, don't block response)
    recordTurn(supabase, userId, enforcement.sessionId || null, request, normalizedResult)
      .catch(err => console.error('Failed to record turn:', err));

    // 11. Return success response with plan info
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...normalizedResult,
          sessionId: enforcement.sessionId,
          turnsRemaining: enforcement.turnsRemaining,
          planType: enforcement.effectivePlan,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: { 
          code: ERROR_CODES.INTERNAL_ERROR, 
          message: error instanceof Error ? error.message : 'Unknown error', 
          userMessage: 'Something went wrong. Please try again.' 
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
