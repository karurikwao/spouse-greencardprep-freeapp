/**
 * Safe fallback for older payment cancel links.
 */

import { ArrowLeft, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BillingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <XCircle className="h-8 w-8 text-slate-500" />
          </div>
          <CardTitle className="text-2xl">No Payment Was Processed</CardTitle>
          <CardDescription className="mx-auto max-w-sm">
            You can continue using the free app. Core practice tools do not require a purchase.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" />
              <p className="text-sm text-blue-800">
                Optional Robin credit packs are one-time add-ons when enabled, and the current dashboard and study
                resources remain available as free app features.
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => { window.location.href = '/dashboard'; }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default BillingCancelPage;
