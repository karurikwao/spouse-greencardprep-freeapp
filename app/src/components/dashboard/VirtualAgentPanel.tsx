import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  Bot,
  BookOpen,
  CalendarDays,
  Clock,
  Loader2,
  Maximize2,
  MessageSquareText,
  Mic,
  MicOff,
  Send,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { RichMessageContent } from '@/components/messages/RichMessageContent';
import {
  askDashboardAgent,
  loadDashboardAgentHistory,
  type DashboardAgentEntry,
} from '@/lib/ai/dashboardAgent';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { cn } from '@/lib/utils';

interface VirtualAgentPanelProps {
  className?: string;
  mode?: 'card' | 'page';
  onOpenFullPage?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return 'Saved answers';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function VirtualAgentPanel({ className, mode = 'card', onOpenFullPage }: VirtualAgentPanelProps) {
  const { isAuthenticated } = useOptionalAuth();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<DashboardAgentEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DashboardAgentEntry | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [latestEntryId, setLatestEntryId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<'pending' | 'answer' | null>(null);
  const historyRegionRef = useRef<HTMLDivElement | null>(null);
  const pendingResponseRef = useRef<HTMLDivElement | null>(null);
  const latestAnswerRef = useRef<HTMLDivElement | null>(null);

  const isPageMode = mode === 'page';

  const appendSpeechTranscript = useCallback((transcript: string) => {
    setQuestion((current) => {
      const next = current.trim()
        ? `${current.trim()} ${transcript.trim()}`
        : transcript.trim();
      return next.slice(0, 1200);
    });
  }, []);

  const dictation = useSpeechDictation({
    onTranscript: appendSpeechTranscript,
  });

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      if (!isAuthenticated) {
        setHistory([]);
        return;
      }

      setIsLoadingHistory(true);
      const { data, error } = await loadDashboardAgentHistory(isPageMode ? 30 : 16);
      if (!isMounted) return;
      if (!error) {
        setHistory(data?.entries || []);
      }
      setIsLoadingHistory(false);
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isPageMode]);

  const usage = useMemo(() => {
    const today = new Date().toDateString();
    const todayEntries = history.filter((entry) => (
      entry.createdAt ? new Date(entry.createdAt).toDateString() === today : false
    ));
    const turnsRemaining = history.find((entry) => typeof entry.turnsRemaining === 'number')?.turnsRemaining ?? null;
    const dailyLimit = typeof turnsRemaining === 'number'
      ? Math.max(todayEntries.length + turnsRemaining, todayEntries.length || 1)
      : 10;

    return {
      todayChats: todayEntries.length,
      savedChats: history.length,
      turnsRemaining,
      dailyLimit,
      chatsRemaining: typeof turnsRemaining === 'number' ? Math.max(0, turnsRemaining) : Math.max(0, dailyLimit - todayEntries.length),
    };
  }, [history]);

  useEffect(() => {
    if (!scrollTarget) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const target = scrollTarget === 'pending' ? pendingResponseRef.current : latestAnswerRef.current;
      if (!target) return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
      const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
      const viewport = historyRegionRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');

      if (scrollTarget === 'answer') {
        viewport?.scrollTo({ top: 0, behavior });
      }

      target.scrollIntoView({
        behavior,
        block: isMobileViewport ? 'start' : 'nearest',
      });
      setScrollTarget(null);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [scrollTarget, history, isAsking]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    if (!isAuthenticated) {
      setError('Sign in to chat with Robin and save the answer to your memory bank.');
      return;
    }

    setIsAsking(true);
    setError(null);
    setLatestEntryId(null);
    setPendingQuestion(trimmed);
    setScrollTarget('pending');
    const { data, error } = await askDashboardAgent(trimmed, {
      page: isPageMode ? 'robin' : 'dashboard',
      agentName: 'Robin',
    });

    if (error) {
      setError(String(error.message || 'Robin is unavailable right now.'));
    } else if (data) {
      setHistory((current) => [data, ...current].slice(0, 30));
      setLatestEntryId(data.id);
      setScrollTarget('answer');
      setQuestion('');
    }

    setIsAsking(false);
    setPendingQuestion('');
  };

  const visibleHistory = history.slice(0, isPageMode ? 30 : 12);
  const chatProgress = Math.min(100, Math.round((usage.todayChats / Math.max(usage.dailyLimit, 1)) * 100));
  let previousDateLabel = '';

  return (
    <>
      <Card className={cn(
        'overflow-hidden border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/90 to-cyan-50/80 shadow-xl shadow-indigo-200/60',
        isPageMode && 'border-blue-200 shadow-blue-200/70',
        className
      )}>
        <div className="h-1.5 bg-gradient-to-r from-indigo-700 via-cyan-500 to-emerald-500" />
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-700 to-cyan-600 text-white shadow-lg shadow-indigo-200">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-extrabold text-slate-950">
                  Chat with Robin
                </CardTitle>
                <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-700">
                  Robin is your virtual immigration interview assistant. She helps with USCIS marriage interview
                  preparation, remembers this chat history, and keeps daily chat usage visible.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-emerald-100 text-emerald-800">
                <BookOpen className="mr-1 h-3.5 w-3.5" />
                Memory bank
              </Badge>
              {!isPageMode && onOpenFullPage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenFullPage}
                  className="border-indigo-200 bg-white font-extrabold text-indigo-800 hover:bg-indigo-50"
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Open Robin
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
                <MessageSquareText className="h-4 w-4" />
                Daily chats
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{usage.todayChats.toLocaleString()}</p>
              <p className="text-xs font-semibold text-slate-600">used today</p>
              <Progress value={chatProgress} className="mt-3 h-2 bg-indigo-100" />
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-cyan-700">
                <MessageSquareText className="h-4 w-4" />
                Chats remaining
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{usage.chatsRemaining.toLocaleString()}</p>
              <p className="text-xs font-semibold text-slate-600">daily free usage plus paid credits</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                <BookOpen className="h-4 w-4" />
                Saved chats
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{usage.savedChats.toLocaleString()}</p>
              <p className="text-xs font-semibold text-slate-600">organized by date</p>
            </div>
          </div>

          <div className={cn(
            'grid gap-5',
            isPageMode ? 'xl:grid-cols-[minmax(320px,0.62fr)_minmax(0,1.38fr)]' : 'xl:grid-cols-[minmax(0,0.78fr)_minmax(360px,1.22fr)]'
          )}>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask Robin about USCIS marriage interview prep, relationship questions, evidence practice, attorney resources, or what to rehearse next..."
                  rows={isPageMode ? 6 : 7}
                  maxLength={1200}
                  className="min-h-40 border-indigo-200 bg-white pr-14 text-base font-semibold text-slate-950 placeholder:text-slate-500 focus-visible:ring-indigo-500 lg:min-h-48"
                />
                {dictation.isSupported && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={dictation.toggle}
                    disabled={isAsking}
                    aria-label={dictation.isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                    title={dictation.isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                    className={cn(
                      'absolute right-3 top-3 border-indigo-200 bg-white text-indigo-800 shadow-sm hover:bg-indigo-50',
                      dictation.isListening && 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    )}
                  >
                    {dictation.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              {dictation.isSupported && (
                <p className="text-xs font-semibold text-slate-600">
                  {dictation.isListening ? 'Listening. Speak naturally, then tap the microphone to stop.' : 'Tap the microphone to dictate your question or answer to Robin.'}
                </p>
              )}
              {dictation.error && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{dictation.error}</span>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-600">
                  Robin remembers her name and saves useful answers to your indexed memory bank.
                </p>
                <Button
                  type="submit"
                  disabled={isAsking || !question.trim()}
                  className="bg-gradient-to-r from-indigo-700 to-cyan-700 font-extrabold text-white shadow-lg shadow-indigo-200 hover:from-indigo-800 hover:to-cyan-800"
                >
                  {isAsking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Ask Robin
                </Button>
              </div>
            </form>

            <div ref={historyRegionRef} className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-inner">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-700" />
                  <span className="text-sm font-extrabold text-slate-950">Robin chat history</span>
                </div>
                {isLoadingHistory && <Loader2 className="h-4 w-4 animate-spin text-indigo-700" />}
              </div>

              {(visibleHistory.length > 0 || isAsking) ? (
                <ScrollArea className={cn('pr-3', isPageMode ? 'h-[620px]' : 'h-[430px]')}>
                  <div className="space-y-4">
                    {isAsking && (
                      <div
                        ref={pendingResponseRef}
                        className="mr-auto max-w-[94%] rounded-2xl rounded-tl-md border border-cyan-200 bg-gradient-to-br from-white to-cyan-50/80 px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center gap-2 text-sm font-extrabold text-indigo-800">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Robin is answering
                        </div>
                        {pendingQuestion && (
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                            You asked: {pendingQuestion}
                          </p>
                        )}
                      </div>
                    )}
                    {visibleHistory.map((entry) => {
                      const dateLabel = formatDate(entry.createdAt);
                      const showDateLabel = dateLabel !== previousDateLabel;
                      const isLatestEntry = entry.id === latestEntryId;
                      previousDateLabel = dateLabel;

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          onDoubleClick={() => setSelectedEntry(entry)}
                          className="block w-full space-y-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          {showDateLabel && (
                            <div className="flex items-center justify-center">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                                {dateLabel}
                              </span>
                            </div>
                          )}
                          <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100/80">
                            <p className="text-sm font-extrabold text-slate-950">{entry.question}</p>
                          </div>
                          <div
                            ref={isLatestEntry ? latestAnswerRef : undefined}
                            className={cn(
                              'mr-auto scroll-mt-24 max-w-[94%] rounded-2xl rounded-tl-md border border-slate-200 bg-gradient-to-br from-white to-cyan-50/80 px-4 py-3 shadow-sm transition hover:border-cyan-200 hover:shadow-md',
                              isLatestEntry && 'border-cyan-300 ring-2 ring-cyan-200'
                            )}
                          >
                            {isLatestEntry && (
                              <span className="mb-2 inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-extrabold text-cyan-900">
                                Latest answer
                              </span>
                            )}
                            <RichMessageContent
                              content={entry.answer}
                              className="text-sm font-semibold leading-6 text-slate-800 [&_img]:max-h-32"
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {(entry.tags || []).slice(0, 5).map((tag) => (
                                <span key={tag} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                                  {tag}
                                </span>
                              ))}
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <BookOpen className="h-3 w-3" />
                                Saved to memory
                              </span>
                              {entry.createdAt && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(entry.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-8 text-center">
                  <Bot className="mx-auto h-8 w-8 text-indigo-700" />
                  <p className="mt-3 text-sm font-bold text-slate-950">No Robin chats yet</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    Your first saved conversation will appear here by date.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto border-2 border-indigo-200 bg-white p-0 shadow-2xl shadow-indigo-200/70 sm:max-w-4xl">
          {selectedEntry && (
            <>
              <div className="h-1.5 bg-gradient-to-r from-indigo-700 via-cyan-500 to-emerald-500" />
              <DialogHeader className="px-5 pt-5">
                <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-slate-950">
                  <Bot className="h-5 w-5 text-indigo-700" />
                  Full conversation with Robin
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(selectedEntry.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    Saved to your Robin memory bank
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-5 py-5">
                <div className="ml-auto max-w-3xl rounded-2xl rounded-tr-md border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <p className="text-sm font-extrabold text-slate-950">{selectedEntry.question}</p>
                </div>
                <div className="mr-auto max-w-3xl rounded-2xl rounded-tl-md border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 px-4 py-4">
                  <RichMessageContent
                    content={selectedEntry.answer}
                    className="text-base font-semibold leading-7 text-slate-900 [&_img]:max-h-96"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(selectedEntry.tags || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
