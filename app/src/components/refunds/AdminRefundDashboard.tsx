import { FileText, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminRefundDashboard() {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base text-slate-950">Free-App Purchase Review</CardTitle>
            <CardDescription>
              The legacy automated payment-return workflow is retired for the free app.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6 text-slate-700">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-950">
          Core app access is free. For optional Robin credit packs, review duplicate,
          accidental, or unused-credit questions manually before taking any payment action.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="mailto:support@spouseinterview.com">
              <Mail className="mr-2 h-4 w-4" />
              Contact Inbox
            </a>
          </Button>
          <Button variant="outline" disabled>
            <FileText className="mr-2 h-4 w-4" />
            Credit-pack review templates
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
