/**
 * Safe fallback for older payment success links.
 */

import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">You Are Ready to Practice</CardTitle>
          <CardDescription className="mx-auto max-w-sm">
            Spouse Interview is now a free app. If you arrived here from an older payment link,
            no purchase action is needed for core access.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
              <p className="text-sm text-emerald-800">
                Open your dashboard to use free practice questions, PDF study files, partner practice,
                messages, and daily Robin practice.
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => { window.location.href = '/dashboard'; }}>
            Open Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default BillingSuccessPage;
