/**
 * AI Interview Page
 * 
 * Main interface for the AI-powered mock interview experience.
 * Text-only, grounded in master content, multi-provider support.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  ChevronRight,
  Sparkles,
  MessageSquare,
  BookOpen,
  X,
  Info,
  Loader2,
  Hand,
  Mic,
  MicOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { usePricing, useAISession } from '@/hooks/usePricing';
import { SubscriptionStatusBanner } from '@/components/subscription';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { fireAndForgetCapture } from '@/lib/answer-candidates';
import type { AIInterviewSession, AIInterviewTurn, InterviewMode, AIProvider, FeedbackLabel } from '@/lib/ai';
import {
  createInterviewSession,
  selectInitialQuestion,
  conductTurn,
  completeSession,
  saveSession,
  loadSession,
  clearSession,
  isSessionComplete,
  getSessionSummary,
  FEEDBACK_LABELS,
  getEnabledModels,
  getModelsForProvider,
  getDefaultInterviewModel,
  getAIFeatureAccess,
} from '@/lib/ai';
import {
  getPlanAiLimits,
  type PlanType,
} from '@/lib/plans';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import type { MasterQuestion, MasterTopic, MasterCategory } from '@/lib/content';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface AIInterviewPageProps {
  mode?: InterviewMode;
  topicId?: string;
  onExit?: () => void;
}

type InterviewPhase = 'setup' | 'interview' | 'feedback' | 'complete' | 'error';

// Key for tracking if user has seen Robin greeting
const ROBIN_GREETING_KEY = 'robin-greeting-shown-v1';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIInterviewPage({ mode = 'standard', topicId, onExit }: AIInterviewPageProps) {
  // Pricing context
  const { subscription, currentPlan, effectiveSubscription, manageSubscription } = usePricing();
  const { user } = useOptionalAuth();
  
  // NEW: AI session tracking with server-side enforcement
  const { 
    canStartSession, 
    canContinueSession, 
    usageDisplay,
    isLoading: isLoadingAIUsage 
  } = useAISession();
  
  // Interview state
  const [phase, setPhase] = useState<InterviewPhase>('setup');
  
  // Greeting state - check if first time
  const [showGreeting, setShowGreeting] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasSeenGreeting = localStorage.getItem(ROBIN_GREETING_KEY);
    return !hasSeenGreeting;
  });
  const [session, setSession] = useState<AIInterviewSession | null>(null);
  const [turns, setTurns] = useState<AIInterviewTurn[]>([]);
  const [currentTurn, setCurrentTurn] = useState<AIInterviewTurn | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<{ question: MasterQuestion; topic: MasterTopic; category: MasterCategory } | null>(null);
  
  // User input
  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appendAnswerTranscript = useCallback((transcript: string) => {
    setUserAnswer((current) => {
      const next = current.trim()
        ? `${current.trim()} ${transcript.trim()}`
        : transcript.trim();
      return next.slice(0, 3000);
    });
  }, []);

  const answerDictation = useSpeechDictation({
    onTranscript: appendAnswerTranscript,
  });
  
  // Truthfulness reminder state
  const [truthfulnessAcknowledged, setTruthfulnessAcknowledged] = useState(false);
  
  // AI settings
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
  const [selectedModel, setSelectedModel] = useState<string>('');
  // Settings UI removed - all providers available via secure edge function
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  const [errorUpgradeRecommended, setErrorUpgradeRecommended] = useState(false);
  
  // Get plan access using new plan system
  const planAccess = useMemo(() => {
    // Use effective plan (considering expiration)
    const effectivePlan = (subscription.status === 'expired') ? 'trial' : subscription.plan;
    return getAIFeatureAccess(effectivePlan as PlanType);
  }, [subscription.plan, subscription.status]);
  
  // Initialize available models
  const availableModels = useMemo(() => getEnabledModels(), []);
  const availableProviders = useMemo(() => {
    const providers = new Set<AIProvider>();
    availableModels.forEach(m => {
      // All enabled providers are available - key check happens server-side
      providers.add(m.provider);
    });
    return Array.from(providers);
  }, [availableModels]);
  
  // Set default model on mount
  useEffect(() => {
    if (!selectedModel && availableModels.length > 0) {
      const defaultModel = getDefaultInterviewModel();
      if (defaultModel) {
        setSelectedProvider(defaultModel.provider);
        setSelectedModel(defaultModel.modelId);
      } else {
        // Find first available
        const firstAvailable = availableModels[0];
        if (firstAvailable) {
          setSelectedProvider(firstAvailable.provider);
          setSelectedModel(firstAvailable.modelId);
        }
      }
    }
  }, [availableModels, selectedModel]);
  
  // Load saved session on mount
  useEffect(() => {
    const { session: savedSession } = loadSession();
    if (savedSession && savedSession.status === 'active' && savedSession.mode === mode) {
      // Offer to resume? For now, clear and start fresh
      clearSession();
    }
  }, [mode]);
  
  // NEW: Client-side check using Supabase-backed entitlements
  // Server-side enforcement provides the ultimate authority
  useEffect(() => {
    // If we're still loading entitlements, wait
    if (isLoadingAIUsage) return;
    
    // Check if user can start a session using server-tracked usage
    if (!canStartSession) {
      setError('Daily free Robin practice limit reached. Please try again tomorrow.');
      setErrorUpgradeRecommended(true);
      setPhase('error');
    }
  }, [canStartSession, isLoadingAIUsage]);
  
  // Start interview
  const startInterview = useCallback(async () => {
    // NEW: Check if user can start session using server-side tracked usage
    if (!canStartSession) {
      setError('Daily free Robin practice limit reached. Please try again tomorrow.');
      setErrorUpgradeRecommended(true);
      setPhase('error');
      return;
    }
    
    // Note: All plan enforcement now happens server-side in the edge function
    // The edge function will return a structured error if limits are exceeded
    
    // Get effective plan and limits
    const effectivePlan = (subscription.status === 'expired') ? 'trial' : subscription.plan;
    const aiLimits = getPlanAiLimits(effectivePlan as PlanType);
    
    // Create local session
    const newSession = createInterviewSession({
      provider: selectedProvider,
      modelId: selectedModel,
      mode,
      topicId,
      maxTurns: aiLimits.maxTurnsPerSession,
    });
    
    // Select initial question
    const questionData = selectInitialQuestion(mode, topicId);
    if (!questionData) {
      setError('No questions available for this mode');
      setPhase('error');
      return;
    }
    
    setSession(newSession);
    setCurrentQuestion(questionData);
    setPhase('interview');
    
    // First AI turn (ask initial question)
    setIsSubmitting(true);
    try {
      const result = await conductTurn({
        session: newSession,
        question: questionData.question,
        topic: questionData.topic,
        category: questionData.category,
        previousTurns: [],
      });
      
      // Handle server-side enforcement errors
      if (result.error) {
        console.error('[AIInterviewPage] Server returned error:', result.error);
        setError(result.error.message);
        setErrorUpgradeRecommended(result.error.upgradeRecommended || false);
        setPhase('error');
        return;
      }
      
      setCurrentTurn(result.turn);
      setTurns([result.turn]);
      saveSession(newSession, [result.turn]);
    } catch (e) {
      console.error('Failed to start interview:', e);
      setError('Failed to start interview. Please try again.');
      setPhase('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProvider, selectedModel, mode, topicId, subscription.plan, subscription.status, canStartSession]);
  
  // Submit answer
  const submitAnswer = useCallback(async () => {
    if (!session || !currentQuestion || !userAnswer.trim()) return;
    
    // NEW: Check if user can continue this session
    if (!canContinueSession) {
      setError('Daily free Robin practice limit reached. Please try again tomorrow.');
      setErrorUpgradeRecommended(true);
      setPhase('error');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Conduct turn with user's answer
      // Server-side enforcement happens in the edge function
      const result = await conductTurn({
        session,
        question: currentQuestion.question,
        topic: currentQuestion.topic,
        category: currentQuestion.category,
        previousTurns: turns,
        userAnswer: userAnswer.trim(),
      });
      
      // Handle server-side enforcement errors
      if (result.error) {
        console.error('[AIInterviewPage] Server returned error:', result.error);
        setError(result.error.message);
        setErrorUpgradeRecommended(result.error.upgradeRecommended || false);
        setPhase('error');
        return;
      }
      
      const updatedTurns = [...turns, result.turn];
      setTurns(updatedTurns);
      setCurrentTurn(result.turn);
      setPhase('feedback');
      
      // Save session
      saveSession(session, updatedTurns);
      
      // Capture answer for potential educational examples (fire-and-forget, non-blocking)
      if (user?.id && currentQuestion?.question) {
        fireAndForgetCapture({
          userId: user.id,
          questionId: currentQuestion.question.id,
          questionSlug: currentQuestion.topic?.id,
          questionPrompt: currentQuestion.question.prompt,
          originalAnswer: userAnswer.trim(),
          sessionId: session.id,
          turnNumber: turns.length + 1,
        });
      }
      
      // Select next question for follow-up
      const usedIds = updatedTurns.map(t => t.questionId).filter((id): id is string => !!id);
      const nextQuestionData = selectInitialQuestion(mode, topicId, [...usedIds, currentQuestion.question.id]);
      if (nextQuestionData) {
        setCurrentQuestion(nextQuestionData);
      }
    } catch (e) {
      console.error('Failed to process answer:', e);
      setError('Failed to process your answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [session, currentQuestion, userAnswer, turns, canContinueSession]);
  
  // Continue to next question
  const continueInterview = useCallback(() => {
    if (session && isSessionComplete({ ...session, turnCount: turns.length })) {
      // Complete session
      const completedSession = completeSession(session);
      setSession(completedSession);
      setPhase('complete');
      clearSession();
    } else {
      setUserAnswer('');
      setPhase('interview');
    }
  }, [session, turns.length]);
  
  // Exit interview
  const exitInterview = useCallback(() => {
    if (session) {
      const completedSession = completeSession(session);
      setSession(completedSession);
      clearSession();
    }
    onExit?.();
  }, [session, onExit]);
  
  // Get feedback label style
  const getFeedbackStyle = (label: FeedbackLabel) => {
    return FEEDBACK_LABELS[label]?.color || 'text-slate-600 bg-slate-50';
  };
  
  // Check if user can choose provider/model
  const canChooseProvider = planAccess.canChooseProvider && availableProviders.length > 1;
  const canChooseModel = planAccess.canChooseModel && availableModels.length > 1;
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Error state
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-2xl mx-auto pt-12">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            {errorUpgradeRecommended && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                Daily free practice resets automatically. Extra Robin credits are available when token packs are enabled.
              </div>
            )}
            <Button variant="outline" onClick={onExit}>
              Exit
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Setup phase
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <span className="font-medium">Robin, your virtual interview coach</span>
                <p className="text-xs text-slate-500">Practice with Robin before your USCIS marriage interview</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onExit}>
              <X className="w-4 h-4 mr-1" />
              Exit
            </Button>
          </div>
        </header>
        
        {/* Subscription Status Banner */}
        {effectiveSubscription && ['grace_period', 'past_due', 'canceled'].includes(effectiveSubscription.effectiveStatus) && (
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <SubscriptionStatusBanner
              subscription={effectiveSubscription}
              onManageBilling={manageSubscription}
              variant="compact"
            />
          </div>
        )}
        
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          {/* Robin Greeting - shown on first visit */}
          {showGreeting && (
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 animate-in fade-in slide-in-from-top-2 duration-500">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Hand className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">Hi, I'm Robin.</p>
                        <p className="text-slate-600 mt-1 leading-relaxed">
                          I'll ask questions similar to what USCIS officers may ask during a marriage interview. 
                          Take your time answering — this is a safe place to practice.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowGreeting(false);
                          localStorage.setItem(ROBIN_GREETING_KEY, 'true');
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Button
                      size="sm"
                      className="mt-4 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        setShowGreeting(false);
                        localStorage.setItem(ROBIN_GREETING_KEY, 'true');
                      }}
                    >
                      Got it, let's practice
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Practice with Robin</CardTitle>
              <CardDescription className="space-y-1">
                <p>Robin is your virtual interview coach for marriage interview practice.</p>
                <p className="text-xs text-slate-400">Robin will ask follow-up questions similar to what USCIS officers may ask.</p>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Plan info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Your Plan</span>
                  <Badge variant="secondary">{currentPlan.name}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600">Daily Robin chats</span>
                  <span className="font-medium">{planAccess.maxTurns}</span>
                </div>
                {/* NEW: Show server-tracked AI usage */}
                {usageDisplay && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Chats used today</span>
                    <span className={cn(
                      "font-medium",
                      usageDisplay.turnsRemaining === 0 ? "text-red-600" : "text-slate-700"
                    )}>
                      {usageDisplay.turnsUsed} / {usageDisplay.turnsTotal}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Provider/Model Selection */}
              {(canChooseProvider || canChooseModel) && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600">
                    <span>AI Provider</span>
                  </div>
                  
                  {canChooseProvider && (
                    <div className="grid grid-cols-3 gap-2">
                      {availableProviders.map(provider => (
                        <button
                          key={provider}
                          onClick={() => {
                            setSelectedProvider(provider);
                            // Set default model for this provider
                            const models = getModelsForProvider(provider);
                            if (models.length > 0) {
                              setSelectedModel(models[0].modelId);
                            }
                          }}
                          className={cn(
                            'p-2 rounded-lg border text-sm font-medium transition-colors',
                            selectedProvider === provider
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          {provider.charAt(0).toUpperCase() + provider.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {canChooseModel && (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      {getModelsForProvider(selectedProvider).map(model => (
                        <option key={model.modelId} value={model.modelId}>
                          {model.displayName} ({model.tier})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              
              {/* Truthfulness Reminder */}
              <Alert className="bg-amber-50 border-amber-200">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <p className="font-medium mb-1">Important Reminder</p>
                  <p className="text-sm">
                    This tool helps you practice common USCIS marriage interview questions.
                    During your real USCIS interview you must always answer truthfully and accurately
                    based on your real relationship and circumstances.
                  </p>
                </AlertDescription>
              </Alert>
              
              {/* Optional Checkbox */}
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Checkbox
                  id="truthfulness-check"
                  checked={truthfulnessAcknowledged}
                  onCheckedChange={(checked) => setTruthfulnessAcknowledged(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="truthfulness-check" className="text-sm text-slate-600 cursor-pointer">
                  I understand that I must answer truthfully during my real USCIS interview.
                </label>
              </div>
              
              {/* Start Button */}
              <Button 
                onClick={startInterview}
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Practice Interview
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-slate-500">
                Practice with Robin before your USCIS marriage interview.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Interview phase (asking question)
  if (phase === 'interview' && currentTurn) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <span className="font-medium">AI Interview</span>
              <Badge variant="secondary" className="text-xs">
                {turns.length} / {session?.maxTurns}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={exitInterview}>
              End Session
            </Button>
          </div>
          <Progress value={(turns.length / (session?.maxTurns || 10)) * 100} className="h-1 rounded-none" />
        </header>
        
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* AI Question */}
          <Card className="mb-6 border-blue-200 bg-blue-50/30">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500 mb-1">Interview Officer asks:</p>
                  <p className="text-lg font-medium text-slate-900">
                    {currentTurn.followUpQuestion || currentQuestion?.question.prompt}
                  </p>
                  {currentQuestion?.topic && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {currentQuestion.topic.title}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* User Answer Input */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500 mb-2">Your Answer:</p>
                  <div className="relative">
                    <Textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="min-h-[120px] resize-none pr-14"
                      disabled={isSubmitting}
                    />
                    {answerDictation.isSupported && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={answerDictation.toggle}
                        disabled={isSubmitting}
                        aria-label={answerDictation.isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                        title={answerDictation.isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                        className={cn(
                          'absolute right-3 top-3 border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50',
                          answerDictation.isListening && 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        )}
                      >
                        {answerDictation.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  {answerDictation.isSupported && (
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {answerDictation.isListening ? 'Listening. Speak your answer, then tap the microphone to stop.' : 'Tap the microphone to dictate your practice answer.'}
                    </p>
                  )}
                  {answerDictation.error && (
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{answerDictation.error}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-xs text-slate-500">
                      Be specific and answer as you would in the real interview.
                    </p>
                    <Button 
                      onClick={submitAnswer}
                      disabled={!userAnswer.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Submit Answer
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Feedback phase
  if (phase === 'feedback' && currentTurn) {
    const feedbackStyle = getFeedbackStyle(currentTurn.feedbackLabel);
    const feedbackInfo = FEEDBACK_LABELS[currentTurn.feedbackLabel];
    
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <span className="font-medium">AI Interview</span>
              <Badge variant="secondary" className="text-xs">
                {turns.length} / {session?.maxTurns}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={exitInterview}>
              End Session
            </Button>
          </div>
          <Progress value={(turns.length / (session?.maxTurns || 10)) * 100} className="h-1 rounded-none" />
        </header>
        
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Feedback Card */}
          <Card className={cn('mb-6 border', feedbackStyle)}>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', feedbackStyle)}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <Badge className={cn('mb-2', feedbackStyle)}>
                    {feedbackInfo?.label}
                  </Badge>
                  <p className="text-slate-700">{currentTurn.feedbackSummary}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Next Question Preview */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500 mb-1">Next Question:</p>
                  <p className="text-lg font-medium text-slate-900">
                    {currentTurn.followUpQuestion}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Suggested Topics */}
          {currentTurn.suggestedReviewTopics && currentTurn.suggestedReviewTopics.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 mb-2">Topics to Review:</p>
                    <ul className="space-y-1">
                      {currentTurn.suggestedReviewTopics.map((topic, i) => (
                        <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                          <ChevronRight className="w-3 h-3" />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={continueInterview} className="flex-1" size="lg">
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={exitInterview}>
              End Session
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Complete phase
  if (phase === 'complete' && session) {
    const summary = getSessionSummary(session, turns);
    
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl">Practice Session Complete!</CardTitle>
              <CardDescription>
                Great job practicing. Here's how you did:
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900">{summary.totalTurns}</div>
                  <div className="text-sm text-slate-600">Questions</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {Math.round(summary.duration / 60000)}m
                  </div>
                  <div className="text-sm text-slate-600">Duration</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {summary.feedbackCounts['clear_and_natural'] || 0}
                  </div>
                  <div className="text-sm text-slate-600">Great Answers</div>
                </div>
              </div>
              
              {/* Feedback Breakdown */}
              <div className="text-left bg-slate-50 rounded-lg p-4">
                <p className="font-medium text-slate-700 mb-3">Feedback Summary:</p>
                <div className="space-y-2">
                  {Object.entries(summary.feedbackCounts).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {FEEDBACK_LABELS[label as FeedbackLabel]?.label || label}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Tips */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Review your answers with your partner to ensure you're both consistent on key details.
                </AlertDescription>
              </Alert>
              
              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => window.location.reload()} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start New Session
                </Button>
                <Button variant="outline" onClick={onExit}>
                  Exit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Fallback
  return null;
}
