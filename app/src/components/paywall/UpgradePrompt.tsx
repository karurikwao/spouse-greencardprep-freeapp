/**
 * Free-app access prompts.
 *
 * These exports replace the older access-gate components while preserving
 * import compatibility for legacy feature-gate callers.
 */

import React from 'react';
import { Bot, Check, Clock, FileText, MessageSquare, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FeatureKey, PlanType } from '@/lib/plans';

interface ProgressStats {
  questionsPracticed?: number;
  readinessScore?: number;
  streakDays?: number;
}

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanType;
  feature: FeatureKey;
  title?: string;
  message?: string;
  onUpgrade?: (plan: PlanType) => void;
  size?: 'sm' | 'md' | 'lg';
  context?: 'trial_limit' | 'ai_limit' | 'feature_locked' | 'pdf_locked';
  progressStats?: ProgressStats;
}

function getFeatureName(feature: FeatureKey): string {
  const featureNames: Record<FeatureKey, string> = {
    practiceQuestions: 'Practice questions',
    readinessCheck: 'Readiness check',
    aiInterview: 'Robin interview practice',
    pdfDownloads: 'PDF downloads',
    coupleCompare: 'Partner comparison',
    canChooseProvider: 'AI provider controls',
    canChooseModel: 'AI model controls',
  };
  return featureNames[feature];
}

function getPromptCopy(
  context: UpgradePromptProps['context'],
  featureName: string,
  progressStats?: ProgressStats
) {
  const practiced = progressStats?.questionsPracticed || 0;
  const progressLine = practiced > 0 ? `You have practiced ${practiced} questions so far. ` : '';

  if (context === 'ai_limit' || context === 'trial_limit') {
    return {
      title: 'Daily free Robin usage',
      message: `${progressLine}Robin is available with an Admin-set daily free usage limit. Optional paid credit packs can add more messages without locking the core app.`,
      badge: 'Daily Free Usage',
    };
  }

  if (context === 'pdf_locked') {
    return {
      title: 'PDF access is included',
      message: 'PDF study materials are part of the free app. Downloads may still require sign-in and may be logged for basic analytics and abuse prevention.',
      badge: 'Free PDF Access',
    };
  }

  return {
    title: `${featureName} is included`,
    message: `${progressLine}This feature belongs in the free app experience. If any limit is needed, it should be handled as a usage limit rather than a purchase gate.`,
    badge: 'Free App Feature',
  };
}

const FREE_APP_FEATURES = [
  { icon: FileText, label: 'PDF library' },
  { icon: Users, label: 'Partner practice' },
  { icon: Bot, label: 'Daily Robin usage' },
  { icon: MessageSquare, label: 'Dashboard messages' },
];

export function UpgradePrompt({
  isOpen,
  onClose,
  feature,
  title,
  message,
  onUpgrade,
  context = 'feature_locked',
  progressStats,
}: UpgradePromptProps) {
  if (!isOpen) return null;

  const featureName = getFeatureName(feature);
  const copy = getPromptCopy(context, featureName, progressStats);

  const handleContinue = () => {
    onUpgrade?.('trial');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/70 p-4 backdrop-blur-sm">
      <Card className="relative w-full max-w-2xl border-slate-200 bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close free app notice"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="pr-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <Badge className="mx-auto w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            {copy.badge}
          </Badge>
          <CardTitle className="text-2xl font-extrabold text-slate-950">
            {title || copy.title}
          </CardTitle>
          <CardDescription className="mx-auto max-w-lg text-base text-slate-600">
            {message || copy.message}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {FREE_APP_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  <Icon className="h-4 w-4 text-blue-700" />
                  {item.label}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <div className="flex items-start gap-2">
              <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                Keep this surface free-app friendly. Future paid Robin credits should be optional add-ons
                for extra messages, not a blocker for core study tools.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleContinue} className="bg-blue-700 hover:bg-blue-800">
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface InlineUpgradePromptProps {
  feature: FeatureKey;
  onUpgrade?: () => void;
  className?: string;
  context?: 'trial_limit' | 'ai_limit' | 'feature_locked';
  progressStats?: ProgressStats;
}

export function InlineUpgradePrompt({
  feature,
  onUpgrade,
  className,
  context = 'feature_locked',
  progressStats,
}: InlineUpgradePromptProps) {
  const copy = getPromptCopy(context, getFeatureName(feature), progressStats);

  return (
    <div className={cn('rounded-lg border border-blue-200 bg-blue-50 p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-950">{copy.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-700">{copy.message}</p>
          {onUpgrade && (
            <Button size="sm" className="mt-3 bg-blue-700 hover:bg-blue-800" onClick={onUpgrade}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface TrialBannerProps {
  daysRemaining: number;
  onUpgrade?: () => void;
  className?: string;
}

export function TrialBanner({ daysRemaining, onUpgrade, className }: TrialBannerProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4', className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-950">Daily free app access</p>
          <p className="text-sm leading-6 text-slate-700">
            Archived account data shows {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining, but the free app should stay available.
          </p>
        </div>
      </div>
      {onUpgrade && (
        <Button size="sm" variant="outline" onClick={onUpgrade}>
          Details
        </Button>
      )}
    </div>
  );
}

interface FeatureGateProps {
  feature: FeatureKey;
  currentPlan: PlanType;
  children: React.ReactNode;
  onUpgrade?: (plan: PlanType) => void;
  fallback?: React.ReactNode;
  context?: 'trial_limit' | 'ai_limit' | 'feature_locked';
}

export function FeatureGate({ children }: FeatureGateProps) {
  return <>{children}</>;
}
