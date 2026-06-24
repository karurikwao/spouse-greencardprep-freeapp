/**
 * Free App Access Page
 *
 * Kept as a safe fallback if an old /pricing link is opened or restored later.
 */

import { ArrowLeft, Bell, Bot, Check, FileText, Gift, Heart, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PricingPageProps {
  onBack?: () => void;
}

const INCLUDED_FEATURES = [
  {
    icon: FileText,
    title: 'PDF study library',
    description: 'Topic-by-topic study files are included for signed-in users.',
  },
  {
    icon: Users,
    title: 'Partner practice',
    description: 'Practice together, compare progress, and prepare as a couple.',
  },
  {
    icon: Bell,
    title: 'Dashboard messages',
    description: 'Receive app updates, sponsor resources, and helpful reminders.',
  },
  {
    icon: Bot,
    title: 'Daily Robin practice',
    description: 'Use Robin within the daily free message limit set by Admin.',
  },
];

export function PricingPage({ onBack }: PricingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <button
            onClick={onBack || (() => { window.location.href = '/'; })}
            className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            <span className="font-bold text-slate-800">Spouse Interview</span>
          </div>
        </div>
      </header>

      <main className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <Badge className="mb-4 border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              100% free core access
            </Badge>
            <h1 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
              Spouse Interview Is a Free Practice App
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-600">
              The core app is free and may be supported by ads, sponsors, affiliate resources,
              and optional Robin credit packs in the future.
            </p>
          </div>

          <div className="mb-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {INCLUDED_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                    <Icon className="h-6 w-6 text-blue-700" />
                  </div>
                  <h3 className="mb-2 font-semibold text-slate-900">{feature.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{feature.description}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">Included Now</h2>
              </div>
              <ul className="space-y-3 text-slate-700">
                {[
                  'Practice questions and preparation tools',
                  'PDF library with simple study-materials disclaimer',
                  'Partner sync in the free dashboard',
                  'Hidden ad placements until Admin enables active ads',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Gift className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Optional Robin Credits</h2>
              </div>
              <p className="leading-7 text-slate-600">
                Admin can define Robin credit pack templates with message amounts, prices, expiration,
                and rollover settings. When Stripe checkout is configured, those packs become optional
                one-time purchases for users who need more than the daily free Robin limit.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Button onClick={() => { window.location.href = '/dashboard'; }} className="bg-blue-700 text-white hover:bg-blue-800">
              Open Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PricingPage;
