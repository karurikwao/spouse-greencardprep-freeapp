/**
 * Free app purchase policy page.
 */

import { ArrowLeft, Bot, CreditCard, HelpCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RefundPolicyProps {
  onBack: () => void;
}

export function RefundPolicy({ onBack }: RefundPolicyProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-medium text-slate-800">Free App Access</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Shield className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-slate-800 sm:text-4xl">
            Free App Access and Optional Purchases
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Spouse Interview is currently offered as a free app. This page explains how free access
            and optional Robin credits work.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Free Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              There is no fee for the core app. Practice questions, progress tools,
              partner practice, dashboard messages, and PDF study files are part of the free app.
            </p>
            <p className="text-slate-600">
              Because free access does not require a purchase, there is no refund process for using
              the free app itself.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              Robin Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Robin may have daily free usage limits because AI messages can create operating costs.
              If optional paid Robin credit packs are introduced, each pack should clearly show its
              message amount, price, expiration period, rollover rule, and whether it is active before purchase.
            </p>
            <p className="text-slate-600">
              Future paid Robin credits should be reviewed separately from free app access. Unused,
              accidental, duplicate, or unclear purchases may be eligible for manual review. Used AI
              credits generally cannot be restored once consumed because provider costs may already
              have been incurred.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              No Recurring Billing Unless Clearly Stated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              The free-app version should not create recurring billing. If any paid feature is added
              later, checkout should clearly state whether it is a one-time credit pack, a time-limited
              add-on, or another purchase type before payment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-600">
              For payment questions about any future optional purchase, contact{' '}
              <a href="mailto:support@spouseinterview.com" className="text-blue-600 hover:underline">
                support@spouseinterview.com
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-sm text-slate-500">
          Last updated: June 13, 2026
        </p>
      </main>
    </div>
  );
}
