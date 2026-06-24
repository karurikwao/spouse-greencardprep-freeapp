/**
 * Main Dashboard
 * Central hub for the app
 */

import { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  BookOpen, 
  AlertCircle, 
  Calendar, 
  Users, 
  Mic, 
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  CheckCircle2,
  Loader2,
  Settings,
  Download,
  Trophy,
  ShieldCheck,
  MessageSquare,
  ClipboardCheck,
  Bell,
  Bookmark,
  Bot
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useReadiness } from '@/hooks/useReadiness';
import { usePractice } from '@/lib/practice';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { normalizeAllTopics } from '@/lib/practice/normalize';
import type { ComfortStatus, PracticeTopic } from '@/lib/practice/types';
import { SecurePDFDownload } from '@/components/paywall/SecurePDFDownload';
import { apiClient } from '@/lib/apiClient';
import { compareProgress, getPartnerConnection, getPartnerProgress, syncProgressWithPartner } from '@/lib/practice/partnerSync';
import { topics } from '@/data/topics';
import { cn } from '@/lib/utils';
import type { UserNotification } from '@/lib/notifications';
import { getUserNotifications } from '@/lib/notifications/api';

interface DashboardProps {
  onPracticeTopic: (topic: PracticeTopic) => void;
  onStartQuickPractice: () => void;
  onStartMockInterview: () => void;
  onStartReadinessCheck: () => void;
  onViewSaved: () => void;
  onViewProgress: () => void;
  onViewTimeline: () => void;
  onViewCouplePractice: () => void;
  onOpenMessagesPage?: () => void;
  onOpenRobinPage?: () => void;
  onOpenPDFLibrary?: () => void;
  onViewAdmin?: () => void;
  canViewAdmin?: boolean;
}

interface PartnerDashboardSummary {
  status: 'loading' | 'none' | 'connected';
  partnerEmail?: string;
  currentTopic?: string | null;
  lastUpdated?: string | null;
  bothNeedPractice: number;
  aligned: number;
  partnerNeedsPractice: number;
}

function getPlainMessagePreview(message: string) {
  return message
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function Dashboard({
  onPracticeTopic,
  onStartQuickPractice,
  onStartMockInterview,
  onStartReadinessCheck,
  onViewSaved,
  onViewProgress,
  onViewTimeline,
  onViewCouplePractice,
  onOpenMessagesPage,
  onOpenRobinPage,
  onOpenPDFLibrary,
  onViewAdmin,
  canViewAdmin = false,
}: DashboardProps) {
  const { result: readinessResult } = useReadiness();
  const { getComfortStatus, isSavedForLater } = usePractice();
  const [lastTopic] = useLocalStorage<string | null>('interview-last-topic', null);
  const [milestones] = useLocalStorage('interview-timeline-v2', []);
  const [partnerSummary, setPartnerSummary] = useState<PartnerDashboardSummary>({
    status: 'loading',
    bothNeedPractice: 0,
    aligned: 0,
    partnerNeedsPractice: 0,
  });
  const [dashboardNotifications, setDashboardNotifications] = useState<UserNotification[]>([]);
  const [messageToastDismissed, setMessageToastDismissed] = useState(false);
  
  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);

  const practiceSummary = useMemo(() => {
    let reviewed = 0;
    let understood = 0;
    let needsPractice = 0;
    let nervous = 0;
    let saved = 0;

    normalizedTopics.forEach(topic => {
      topic.questions.forEach(q => {
        const comfortStatus = getComfortStatus(q.id);
        if (comfortStatus) {
          reviewed++;
        }
        if (comfortStatus === 'understood') {
          understood++;
        }
        if (comfortStatus === 'needs-practice') {
          needsPractice++;
        }
        if (comfortStatus === 'nervous') {
          nervous++;
        }
        if (isSavedForLater(q.id)) {
          saved++;
        }
      });
    });

    const totalQuestions = normalizedTopics.reduce((sum, topic) => sum + topic.questions.length, 0);
    return {
      reviewed,
      understood,
      needsPractice,
      nervous,
      saved,
      totalQuestions,
      reviewedPercent: totalQuestions ? Math.round((reviewed / totalQuestions) * 100) : 0,
    };
  }, [normalizedTopics, getComfortStatus, isSavedForLater]);

  const localQuestionStates = useMemo(() => {
    const states: Record<string, { comfortStatus: ComfortStatus; isSavedForLater: boolean }> = {};
    normalizedTopics.forEach(topic => {
      topic.questions.forEach(q => {
        const comfortStatus = getComfortStatus(q.id);
        const saved = isSavedForLater(q.id);
        if (comfortStatus || saved) {
          states[q.id] = { comfortStatus, isSavedForLater: saved };
        }
      });
    });
    return states;
  }, [normalizedTopics, getComfortStatus, isSavedForLater]);

  // Get nervous/stress questions
  const stressQuestions = useMemo(() => {
    const nervous: { topicId: string; questionId: string; prompt: string }[] = [];
    normalizedTopics.forEach(topic => {
      topic.questions.forEach(q => {
        if (getComfortStatus(q.id) === 'nervous') {
          nervous.push({ topicId: topic.id, questionId: q.id, prompt: q.prompt });
        }
      });
    });
    return nervous.slice(0, 5);
  }, [normalizedTopics, getComfortStatus]);

  const savedForLaterItems = useMemo(() => {
    const savedItems: {
      topicId: string;
      questionId: string;
      topicTitle: string;
      prompt: string;
      questionIndex: number;
    }[] = [];

    normalizedTopics.forEach(topic => {
      topic.questions.forEach((question, questionIndex) => {
        if (isSavedForLater(question.id)) {
          savedItems.push({
            topicId: topic.id,
            questionId: question.id,
            topicTitle: topic.title,
            prompt: question.prompt,
            questionIndex: questionIndex + 1,
          });
        }
      });
    });

    return savedItems;
  }, [normalizedTopics, isSavedForLater]);

  useEffect(() => {
    let isMounted = true;

    const loadPartnerSummary = async () => {
      const connection = await getPartnerConnection();
      if (!isMounted) return;

      if (!connection) {
        setPartnerSummary({
          status: 'none',
          bothNeedPractice: 0,
          aligned: 0,
          partnerNeedsPractice: 0,
        });
        return;
      }

      const { data: user } = await apiClient.auth.getUser();
      const partnerId = user?.id === connection.partnerId ? connection.userId : connection.partnerId;
      const partnerProgress = partnerId ? await getPartnerProgress(partnerId) : null;
      const comparison = partnerProgress
        ? compareProgress(localQuestionStates, partnerProgress.questionStates)
        : null;

      if (!isMounted) return;

      setPartnerSummary({
        status: 'connected',
        partnerEmail: connection.partnerEmail,
        currentTopic: partnerProgress?.currentTopic ?? null,
        lastUpdated: partnerProgress?.lastUpdated ?? null,
        bothNeedPractice: comparison?.bothNeedPractice.length ?? 0,
        aligned: comparison?.bothComfortable.length ?? 0,
        partnerNeedsPractice: comparison?.partnerNeedsPractice.length ?? 0,
      });
    };

    loadPartnerSummary();

    return () => {
      isMounted = false;
    };
  }, [localQuestionStates]);

  useEffect(() => {
    if (Object.keys(localQuestionStates).length === 0) return;
    syncProgressWithPartner(localQuestionStates, lastTopic);
  }, [localQuestionStates, lastTopic]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardNotifications = async () => {
      const result = await getUserNotifications();
      if (!isMounted) return;
      if (result.success && result.data) {
        setDashboardNotifications(result.data);
        setMessageToastDismissed(false);
      }
    };

    void loadDashboardNotifications();
    const handleRefresh = () => {
      void loadDashboardNotifications();
    };
    window.addEventListener('dashboard-messages-refresh', handleRefresh);
    const interval = window.setInterval(handleRefresh, 45000);

    return () => {
      isMounted = false;
      window.removeEventListener('dashboard-messages-refresh', handleRefresh);
      window.clearInterval(interval);
    };
  }, []);

  // Get recommended topics based on readiness
  const recommendedTopics = useMemo(() => {
    if (!readinessResult) {
      return ['relationship-timeline', 'daily-routine', 'kitchen-household'];
    }
    
    const topics: string[] = [];
    const sortedCategories = Object.entries(readinessResult.categoryScores)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);

    sortedCategories.forEach(([cat]) => {
      switch (cat) {
        case 'relationship-story':
          topics.push('relationship-timeline', 'wedding-celebrations');
          break;
        case 'timeline-clarity':
          topics.push('relationship-timeline', 'address-history');
          break;
        case 'daily-life':
          topics.push('daily-routine', 'kitchen-household');
          break;
        case 'family-knowledge':
          topics.push('family-inlaws');
          break;
        case 'sensitive-questions':
          topics.push('red-flag');
          break;
        case 'document-prep':
          topics.push('evidence-shared-life');
          break;
      }
    });

    return [...new Set(topics)].slice(0, 4);
  }, [readinessResult]);

  // Get last practiced topic
  const lastPracticedTopic = useMemo(() => {
    if (!lastTopic) return null;
    return normalizedTopics.find(t => t.id === lastTopic);
  }, [lastTopic, normalizedTopics]);

  // Timeline completion
  const timelineCompletion = useMemo(() => {
    if (!Array.isArray(milestones) || milestones.length === 0) return 0;
    const filled = milestones.filter((m: { date: string }) => m.date).length;
    return Math.round((filled / milestones.length) * 100);
  }, [milestones]);

  const featureTiles = [
    { label: 'PDF library', enabled: true },
    { label: 'Partner sync', enabled: true },
    { label: 'Practice with Robin', enabled: true },
    { label: 'Dashboard messages', enabled: true },
  ];
  const reviewQueueCount = practiceSummary.saved + practiceSummary.needsPractice + practiceSummary.nervous;
  const prepPlanItems = useMemo(() => {
    const items: {
      label: string;
      detail: string;
      action: string;
      icon: LucideIcon;
      onClick: () => void;
    }[] = [];

    items.push(readinessResult
      ? {
        label: 'Review readiness details',
        detail: `${readinessResult.overallScore}% readiness score`,
        action: 'Open score',
        icon: ShieldCheck,
        onClick: onStartReadinessCheck,
      }
      : {
        label: 'Take readiness check',
        detail: 'Set your baseline before practice',
        action: 'Start check',
        icon: Sparkles,
        onClick: onStartReadinessCheck,
      });

    if (reviewQueueCount > 0) {
      items.push({
        label: 'Clear review queue',
        detail: `${reviewQueueCount} saved or difficult items`,
        action: 'Review now',
        icon: AlertCircle,
        onClick: onViewSaved,
      });
    } else {
      items.push({
        label: 'Start focused practice',
        detail: 'Build momentum with a short session',
        action: 'Practice',
        icon: ClipboardCheck,
        onClick: onStartQuickPractice,
      });
    }

    items.push(timelineCompletion < 100
      ? {
        label: 'Strengthen your timeline',
        detail: `${timelineCompletion}% complete`,
        action: 'Open timeline',
        icon: Calendar,
        onClick: onViewTimeline,
      }
      : {
        label: 'Rehearse timeline answers',
        detail: 'Use your finished milestones',
        action: 'Mock interview',
        icon: Mic,
        onClick: onStartMockInterview,
      });

    items.push(partnerSummary.status === 'connected'
      ? {
        label: 'Compare spouse progress',
        detail: `${partnerSummary.bothNeedPractice} shared review points`,
        action: 'Open sync',
        icon: Users,
        onClick: onViewCouplePractice,
      }
      : {
        label: 'Invite spouse to sync',
        detail: 'Compare answers before the interview',
        action: 'Invite',
        icon: Users,
        onClick: onViewCouplePractice,
      });

    return items;
  }, [
    onStartMockInterview,
    onStartQuickPractice,
    onStartReadinessCheck,
    onViewCouplePractice,
    onViewProgress,
    onViewSaved,
    onViewTimeline,
    partnerSummary.bothNeedPractice,
    partnerSummary.status,
    readinessResult,
    reviewQueueCount,
    timelineCompletion,
  ]);
  const pdfLibraryTopics = useMemo(
    () => normalizedTopics.filter(topic => topic.pdfFileName).slice(0, 4),
    [normalizedTopics]
  );
  const achievementTiles = [
    {
      label: 'Readiness check',
      detail: readinessResult ? `${readinessResult.overallScore}% score` : 'Not started',
      complete: Boolean(readinessResult),
      icon: ShieldCheck,
    },
    {
      label: 'Practice momentum',
      detail: `${practiceSummary.reviewed} questions reviewed`,
      complete: practiceSummary.reviewed > 0,
      icon: ClipboardCheck,
    },
    {
      label: 'Review list',
      detail: `${practiceSummary.saved + practiceSummary.needsPractice + practiceSummary.nervous} items to revisit`,
      complete: practiceSummary.saved > 0 || practiceSummary.needsPractice > 0 || practiceSummary.nervous > 0,
      icon: Trophy,
    },
  ];
  const unreadNotifications = dashboardNotifications.filter(notification => !notification.isRead);
  const latestUnreadNotification = unreadNotifications[0];
  const openMessageCenter = () => {
    setMessageToastDismissed(true);
    if (onOpenMessagesPage) {
      onOpenMessagesPage();
      return;
    }
    document.getElementById('dashboard-messages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openRobin = () => {
    if (onOpenRobinPage) {
      onOpenRobinPage();
      return;
    }
    document.getElementById('dashboard-robin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openPDFLibrary = () => {
    if (onOpenPDFLibrary) {
      onOpenPDFLibrary();
      return;
    }
    document.getElementById('dashboard-pdf-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const cardClass = 'border-2 border-blue-200 bg-white shadow-xl shadow-slate-200/70';
  const surfaceClass = 'rounded-xl border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-4 shadow-md shadow-blue-100/70';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-slate-50 to-amber-50/40 pb-28 text-slate-900 md:pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/95 shadow-sm shadow-blue-100/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-6 w-6 text-blue-700" />
              <h1 className="text-xl font-extrabold text-slate-950">Your Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openRobin}
                title="Chat with Robin"
                className="border-indigo-200 bg-white font-bold text-indigo-800 hover:bg-indigo-50"
              >
                <Bot className="w-4 h-4 sm:mr-2" />
                <span className="hidden whitespace-nowrap sm:inline">Chat with Robin</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openMessageCenter}
                className="relative border-emerald-200 bg-white font-bold text-emerald-800 hover:bg-emerald-50"
              >
                <Bell className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Messages</span>
                {unreadNotifications.length > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-extrabold text-white shadow-md">
                    {unreadNotifications.length}
                  </span>
                )}
              </Button>
              {canViewAdmin && onViewAdmin && (
                <Button variant="outline" size="sm" onClick={onViewAdmin}>
                  <Settings className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome + Readiness Score */}
        <Card className={cn(cardClass, 'overflow-hidden')}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">Preparation center</p>
                <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Welcome back</h2>
                <p className="mt-1 font-medium text-slate-700">Track progress, free app access, spouse practice, Robin usage, and admin messages from one place.</p>
              </div>
              
              {readinessResult ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 px-4 py-3 text-left shadow-sm sm:text-right">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-blue-700">Readiness Score</div>
                    <div className="flex items-end gap-2 sm:justify-end">
                      <span className={cn(
                        'text-3xl font-bold leading-none',
                        readinessResult.overallScore >= 80 ? 'text-emerald-700' :
                        readinessResult.overallScore >= 60 ? 'text-amber-700' : 'text-rose-700'
                      )}>
                        {readinessResult.overallScore}%
                      </span>
                      <span className="text-xs text-slate-500 pb-1">overall</span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={onStartReadinessCheck}>
                    Details
                  </Button>
                </div>
              ) : (
                <Button onClick={onStartReadinessCheck} className="bg-gradient-to-r from-blue-700 to-cyan-700 font-bold shadow-lg shadow-blue-200 hover:from-blue-800 hover:to-cyan-800">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Take Readiness Check
                </Button>
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Reviewed</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{practiceSummary.reviewedPercent}%</p>
              </div>
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Comfortable</p>
                <p className="mt-1 text-xl font-semibold text-emerald-700">{practiceSummary.understood}</p>
              </div>
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Needs review</p>
                <p className="mt-1 text-xl font-semibold text-amber-700">{practiceSummary.needsPractice}</p>
              </div>
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Saved</p>
                <p className="mt-1 text-xl font-semibold text-blue-700">{practiceSummary.saved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prep Plan */}
        <Card className={cardClass}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-slate-950">
                  <ClipboardCheck className="w-4 h-4 text-slate-600" />
                  Today's Prep Plan
                </CardTitle>
                <p className="text-sm text-slate-700 mt-1">
                  A short path based on readiness, review items, timeline progress, and spouse sync.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={onStartMockInterview}>
                <Mic className="w-4 h-4 mr-2" />
                Mock Interview
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {prepPlanItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.label}-${index}`}
                    type="button"
                    onClick={item.onClick}
                    className="group rounded-xl border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/60 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-lg hover:shadow-blue-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-200">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-extrabold text-slate-950">{item.label}</p>
                    <p className="mt-1 min-h-10 text-sm font-medium text-slate-700">{item.detail}</p>
                    <span className="mt-3 inline-flex items-center text-sm font-bold text-blue-800 group-hover:text-blue-950">
                      {item.action}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(cardClass, 'overflow-hidden bg-gradient-to-br from-white via-blue-50/70 to-amber-50/70')}>
          <CardHeader className="border-b border-blue-100/80 bg-gradient-to-r from-blue-50 via-white to-amber-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-slate-950">
                  <Bookmark className="w-4 h-4 text-blue-700" />
                  Saved for Later
                </CardTitle>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Questions you bookmark during practice live here, ready for review.
                </p>
              </div>
              <Badge className="w-fit border-0 bg-blue-100 text-blue-800">
                {savedForLaterItems.length} saved
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {savedForLaterItems.length > 0 ? (
              <div className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-3">
                  {savedForLaterItems.slice(0, 3).map((item) => {
                    const topic = normalizedTopics.find(t => t.id === item.topicId);
                    return (
                      <button
                        key={item.questionId}
                        type="button"
                        onClick={() => topic && onPracticeTopic(topic)}
                        className="group rounded-xl border-2 border-blue-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-extrabold text-blue-800">
                            Question {item.questionIndex}
                          </span>
                          <ArrowRight className="h-4 w-4 text-blue-700 transition group-hover:translate-x-1" />
                        </div>
                        <p className="line-clamp-2 text-sm font-extrabold text-slate-950">{item.prompt}</p>
                        <p className="mt-2 line-clamp-1 text-xs font-bold text-slate-600">{item.topicTitle}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={onViewSaved} className="border-blue-200 bg-white font-bold text-blue-800 hover:bg-blue-50">
                    Open full review list
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-white/80 p-6 text-center">
                <Bookmark className="mx-auto h-8 w-8 text-blue-700" />
                <p className="mt-3 font-extrabold text-slate-950">No saved questions yet</p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Tap Save to review later while practicing, and those questions will appear here.
                </p>
                <Button variant="outline" size="sm" onClick={onViewSaved} className="mt-4 border-blue-200 bg-white font-bold text-blue-800 hover:bg-blue-50">
                  View review list
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          id="dashboard-robin"
          className="overflow-hidden border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/90 to-cyan-50/80 shadow-xl shadow-indigo-200/60"
        >
          <div className="h-1.5 bg-gradient-to-r from-indigo-700 via-cyan-500 to-emerald-500" />
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-700 to-cyan-600 text-white shadow-lg shadow-indigo-200">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950">Chat with Robin</h3>
                  <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-700">
                    Ask Robin about USCIS interview prep, relationship practice, evidence preparation, attorney resources,
                    and what to rehearse next. She keeps conversations grouped by date, tracks daily chat usage, and saves useful answers to the memory bank.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={openRobin}
                className="w-fit bg-gradient-to-r from-indigo-700 to-cyan-700 font-extrabold text-white shadow-lg shadow-indigo-200 hover:from-indigo-800 hover:to-cyan-800"
              >
                <Bot className="mr-2 h-4 w-4" />
                Open Robin Chat
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Free app access */}
        <Card className={cardClass}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Free App Access
                </CardTitle>
                <p className="text-sm text-slate-700 mt-1">
                  Spouse Interview is being prepared as a free, ad-supported app. Ads stay hidden until the admin enables active placements.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
                Free access
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Access type</p>
                <p className="mt-1 font-extrabold text-slate-950">Free app</p>
              </div>
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Robin usage</p>
                <p className="mt-1 font-extrabold text-slate-950">Daily free limit</p>
              </div>
              <div className={surfaceClass}>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Ads</p>
                <p className="mt-1 font-extrabold text-slate-950">Hidden until active</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {featureTiles.map((feature) => (
                <div
                  key={feature.label}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold shadow-sm',
                    feature.enabled
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-blue-200 bg-white text-slate-900'
                  )}
                >
                  {feature.enabled ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-blue-700" />
                  )}
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button onClick={openRobin} className="bg-gradient-to-r from-blue-700 to-cyan-700 font-bold shadow-lg shadow-blue-200 hover:from-blue-800 hover:to-cyan-800">
                <Bot className="w-4 h-4 mr-2" />
                Open Robin
              </Button>
              <Button variant="outline" onClick={openPDFLibrary}>
                <Download className="w-4 h-4 mr-2" />
                Open PDF Library
              </Button>
              <Button variant="outline" onClick={onViewCouplePractice}>
                <Users className="w-4 h-4 mr-2" />
                Open Partner Sync
              </Button>
              <Button variant="outline" onClick={openMessageCenter}>
                <Bell className="w-4 h-4 mr-2" />
                Open Messages
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card id="dashboard-pdf-library" className={cn(cardClass, 'bg-gradient-to-br from-white to-blue-50/60')}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 text-slate-950">
                    <Download className="w-4 h-4 text-slate-600" />
                    PDF Library
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-700">
                    Download practice packs by topic with a simple study-materials disclaimer.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPDFLibrary}
                  className="shrink-0 border-blue-200 bg-white font-bold text-blue-800 hover:bg-blue-50"
                >
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pdfLibraryTopics.map(topic => (
                <div key={topic.id} className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/60 px-3 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-950">{topic.title}</p>
                    <p className="text-xs text-slate-600">{topic.questionCount} questions</p>
                  </div>
                  <SecurePDFDownload
                    pdfFileName={topic.pdfFileName}
                    pdfTitle={topic.title}
                    topicId={topic.id}
                    categoryId={topic.categoryId}
                    source="direct_link"
                    size="sm"
                    label="Download"
                    className="shrink-0"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openPDFLibrary}
                className="w-full font-extrabold text-blue-800 hover:bg-blue-50 hover:text-blue-950"
              >
                Open full PDF library
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-950">
                <Trophy className="w-4 h-4 text-amber-600" />
                Achievements
              </CardTitle>
              <p className="text-sm text-slate-700">Milestones based on real preparation activity.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {achievementTiles.map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <div
                    key={achievement.label}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-3 shadow-sm',
                      achievement.complete
                        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-900'
                        : 'border-blue-100 bg-gradient-to-br from-white to-blue-50/70 text-slate-800'
                    )}
                  >
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border bg-white',
                      achievement.complete ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{achievement.label}</p>
                      <p className="text-xs opacity-80">{achievement.detail}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className={cn(cardClass, 'bg-gradient-to-br from-white to-blue-50/60')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-950">
                <MessageSquare className="w-4 h-4 text-slate-600" />
                Spouse Interaction
              </CardTitle>
              <p className="text-sm text-slate-700">Partner sync status and shared review pressure points.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {partnerSummary.status === 'loading' ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking partner activity...
                </div>
              ) : partnerSummary.status === 'connected' ? (
                <>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <p className="text-sm font-semibold text-emerald-900">Connected</p>
                    <p className="text-xs text-emerald-800">{partnerSummary.partnerEmail}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={surfaceClass}>
                      <p className="text-xs text-slate-500">Aligned</p>
                      <p className="font-semibold text-slate-950">{partnerSummary.aligned}</p>
                    </div>
                    <div className={surfaceClass}>
                      <p className="text-xs text-slate-500">Both review</p>
                      <p className="font-semibold text-amber-700">{partnerSummary.bothNeedPractice}</p>
                    </div>
                    <div className={surfaceClass}>
                      <p className="text-xs text-slate-500">Partner</p>
                      <p className="font-semibold text-blue-700">{partnerSummary.partnerNeedsPractice}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  No spouse account is connected yet. Invite them when you are ready to compare progress.
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onViewCouplePractice} className="w-full">
                <Users className="w-4 h-4 mr-2" />
                Open Partner Sync
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Continue Practicing */}
          {lastPracticedTopic && (
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  Continue Practicing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-4">{lastPracticedTopic.title}</p>
                <Button 
                  onClick={() => onPracticeTopic(lastPracticedTopic)}
                  className="w-full bg-gradient-to-r from-blue-700 to-cyan-700 font-bold shadow-md shadow-blue-200 hover:from-blue-800 hover:to-cyan-800"
                >
                  Resume
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Practice */}
          <Card className={cn(cardClass, 'bg-gradient-to-br from-white to-blue-50/60')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Quick Practice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-4">
                10-minute session with important questions from different topics
              </p>
              <Button 
                onClick={onStartQuickPractice}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 font-bold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-cyan-700"
              >
                Start 10-Minute Session
              </Button>
            </CardContent>
          </Card>

          {/* Recommended Topics */}
          <Card className={cn(cardClass, 'bg-gradient-to-br from-white to-amber-50/70')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                Recommended Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recommendedTopics.map(topicId => {
                  const topic = normalizedTopics.find(t => t.id === topicId);
                  if (!topic) return null;
                  return (
                    <button
                      key={topicId}
                      onClick={() => onPracticeTopic(topic)}
                      className="w-full rounded-xl border border-amber-100 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 hover:shadow-md"
                    >
                      <div className="font-extrabold text-slate-950">{topic.title}</div>
                      <div className="text-xs font-bold text-amber-700">{topic.questionCount} questions</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Stress Review */}
          <Card className={cn(cardClass, 'bg-gradient-to-br from-white to-rose-50/50')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                Topics to Review Gently
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stressQuestions.length > 0 ? (
                <div className="space-y-2">
                  {stressQuestions.map((q, idx) => (
                    <div key={idx} className="rounded-xl border border-rose-100 bg-white/85 p-3 shadow-sm">
                      <p className="line-clamp-2 text-sm font-medium text-slate-800">{q.prompt}</p>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={onViewSaved} className="w-full">
                    View All
                  </Button>
                </div>
              ) : (
                <p className="text-slate-600 text-center py-4">
                  No questions marked as difficult yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline Progress */}
          <Card className={cn(cardClass, 'bg-gradient-to-br from-white to-emerald-50/60')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                Relationship Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">Completion</span>
                  <span className="text-slate-800 font-medium">{timelineCompletion}%</span>
                </div>
                <Progress value={timelineCompletion} className="h-2" />
                <Button variant="outline" size="sm" onClick={onViewTimeline} className="w-full border-emerald-200 bg-white font-bold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50">
                  Continue Building
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Couple Practice */}
          <Card className={cn(cardClass, 'bg-gradient-to-br from-white to-cyan-50/60')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                Couple Practice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-4">
                Invite your spouse to study together and compare answers
              </p>
              <Button variant="outline" size="sm" onClick={onViewCouplePractice} className="w-full border-cyan-200 bg-white font-bold text-cyan-800 hover:border-cyan-400 hover:bg-cyan-50">
                Invite Partner
              </Button>
            </CardContent>
          </Card>

          {/* Mock Interview */}
          <Card className={cn(cardClass, 'bg-gradient-to-br from-white via-blue-50/70 to-cyan-50/70 md:col-span-2')}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-200">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-950">Mock Interview</h3>
                  <p className="text-sm font-medium text-slate-700">
                    Practice with a simulated interview experience
                  </p>
                </div>
              </div>
              <Button onClick={onStartMockInterview} className="bg-gradient-to-r from-blue-700 to-cyan-700 font-bold shadow-lg shadow-blue-200 hover:from-blue-800 hover:to-cyan-800">
                Start Mock Interview
              </Button>
            </CardContent>
          </Card>

          {/* AI Usage and Plan Limits */}
          <div
            id="dashboard-messages"
            className="md:col-span-2 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-white via-emerald-50/80 to-cyan-50/70 p-5 shadow-xl shadow-emerald-100/60"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-200">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950">Message Center</h3>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    Open your dedicated inbox for admin messages, sponsored resources, account notices, and helpful updates.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={openMessageCenter}
                className="w-fit bg-gradient-to-r from-emerald-700 to-cyan-700 font-extrabold text-white shadow-lg shadow-emerald-200 hover:from-emerald-800 hover:to-cyan-800"
              >
                <Bell className="mr-2 h-4 w-4" />
                Open Messages
                {unreadNotifications.length > 0 && (
                  <Badge className="ml-2 border-0 bg-rose-600 text-white">
                    {unreadNotifications.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-blue-100 bg-white/95 px-2 py-2 shadow-2xl shadow-blue-200/60 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={onStartQuickPractice}
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold text-slate-700 hover:bg-blue-50 hover:text-blue-800"
          >
            <ClipboardCheck className="h-5 w-5" />
            Practice
          </button>
          <button
            type="button"
            onClick={openRobin}
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold text-slate-700 hover:bg-indigo-50 hover:text-indigo-800"
          >
            <Bot className="h-5 w-5" />
            Robin
          </button>
          <button
            type="button"
            onClick={openPDFLibrary}
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold text-slate-700 hover:bg-cyan-50 hover:text-cyan-800"
          >
            <Download className="h-5 w-5" />
            PDFs
          </button>
          <button
            type="button"
            onClick={openMessageCenter}
            className="relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Bell className="h-5 w-5" />
            Messages
            {unreadNotifications.length > 0 && (
              <span className="absolute right-3 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold leading-none text-white">
                {unreadNotifications.length}
              </span>
            )}
          </button>
        </div>
      </nav>
      {latestUnreadNotification && !messageToastDismissed && (
        <button
          type="button"
          onClick={openMessageCenter}
          className="fixed bottom-24 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border-2 border-emerald-200 bg-white p-4 text-left shadow-2xl shadow-emerald-200/70 transition hover:-translate-y-0.5 hover:border-emerald-400 md:bottom-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600 text-white shadow-md shadow-emerald-200">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">New message</p>
                <Badge className="border-0 bg-rose-600 text-white">{unreadNotifications.length}</Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-sm font-extrabold text-slate-950">{latestUnreadNotification.title}</p>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">{getPlainMessagePreview(latestUnreadNotification.message)}</p>
              <span className="mt-2 inline-flex items-center text-sm font-extrabold text-blue-800">
                Open message center
                <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
