import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RefundInterceptScreenProps {
  onContinueToRefund?: () => void;
  onTryMockInterview: () => void;
  onBack: () => void;
}

export function RefundInterceptScreen({
  onTryMockInterview,
  onBack,
}: RefundInterceptScreenProps) {
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
            <CardTitle className="text-2xl">No payment is required</CardTitle>
            <CardDescription className="text-base">
              Spouse Interview is being prepared as a free app. Core practice tools,
              PDFs, partner practice, and daily Robin usage do not require a purchase.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button onClick={onTryMockInterview} className="w-full bg-blue-700 hover:bg-blue-800" size="lg">
              Practice with Robin
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
