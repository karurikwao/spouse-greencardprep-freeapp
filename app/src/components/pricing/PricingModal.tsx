/**
 * Free-app access modal.
 *
 * This component intentionally keeps the old PricingModal export so legacy
 * triggers do not open purchase checkout in the free app.
 */

import { Bot, Check, FileText, MessageSquare, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlanType } from '@/lib/plans';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: PlanType;
  onUpgrade: (plan: PlanType) => void;
  trialDaysLeft?: number;
  context?: 'trial_ended' | 'feature_limit' | 'upgrade_prompt';
}

const INCLUDED_FEATURES = [
  {
    icon: FileText,
    title: 'PDF study library',
    description: 'Download practice materials as part of free app access.',
  },
  {
    icon: Users,
    title: 'Partner practice',
    description: 'Use spouse-sync practice tools without a purchase gate.',
  },
  {
    icon: Bot,
    title: 'Daily Robin practice',
    description: 'Practice with Robin within the Admin-set daily free usage limit.',
  },
  {
    icon: MessageSquare,
    title: 'Dashboard messages',
    description: 'Receive app updates, welcome messages, and sponsored resources.',
  },
];

export function PricingModal({
  isOpen,
  onClose,
  onUpgrade,
}: PricingModalProps) {
  if (!isOpen) return null;

  const handleContinue = () => {
    onUpgrade('trial');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/70 p-4 backdrop-blur-sm">
      <Card className="relative w-full max-w-3xl border-slate-200 bg-white opacity-100 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close free access details"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="pr-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <Badge className="mx-auto w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Free App Access
          </Badge>
          <CardTitle className="text-2xl font-extrabold text-slate-950">
            No purchase is required
          </CardTitle>
          <CardDescription className="mx-auto max-w-xl text-base text-slate-600">
            Spouse Interview is being prepared as a free app supported by ads, sponsor resources,
            affiliate links, and optional Robin credit packs.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            {INCLUDED_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-950">{feature.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <div className="flex items-start gap-2">
              <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                If paid Robin credit packs are enabled later, they should be shown as optional add-ons,
                not as a required subscription for the core app.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleContinue} className="bg-blue-700 hover:bg-blue-800">
              Continue to free app
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
