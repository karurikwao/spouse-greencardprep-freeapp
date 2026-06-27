import { ArrowLeft, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RefundReason } from '@/lib/refunds';

interface RefundRequestFormProps {
  eligibility?: {
    daysSincePurchase: number;
    questionsCompleted: number;
    mockInterviewsCompleted: number;
    isEligible: boolean;
    reason: string;
  };
  planName?: string;
  amount?: number;
  onSubmit?: (reason: RefundReason, additionalComments: string) => Promise<void>;
  onBack: () => void;
}

export function RefundRequestForm({ onBack }: RefundRequestFormProps) {
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

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Sparkles className="h-8 w-8 text-emerald-700" />
            </div>
            <CardTitle className="text-2xl">The core app is free</CardTitle>
            <CardDescription className="text-base">
              There is no purchase request to submit for free app access. If a future optional
              Robin credit purchase needs manual review, contact Spouse Interview by email.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button asChild className="w-full bg-blue-700 hover:bg-blue-800" size="lg">
              <a href="mailto:support@spouseinterview.com">
                <Mail className="mr-2 h-4 w-4" />
                Email Spouse Interview
              </a>
            </Button>
            <Button onClick={onBack} variant="outline" className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
