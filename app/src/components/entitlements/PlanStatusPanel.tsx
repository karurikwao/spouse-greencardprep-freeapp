/**
 * Free-app status panel.
 *
 * This replaces the older purchase-status panel while keeping the same export.
 */

import { Bot, CheckCircle, Download, MessageSquare, Sparkles, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAIUsageDisplay } from '@/lib/entitlements';

interface PlanStatusPanelProps {
  onUpgrade?: () => void;
  showDetails?: boolean;
  className?: string;
}

const FREE_APP_ITEMS = [
  { icon: Download, label: 'PDF downloads included' },
  { icon: Users, label: 'Partner practice included' },
  { icon: MessageSquare, label: 'Dashboard messages included' },
  { icon: Bot, label: 'Robin uses daily free limits' },
];

export function PlanStatusPanel({
  showDetails = true,
  className = '',
}: PlanStatusPanelProps) {
  const { usage: aiUsage } = useAIUsageDisplay();

  return (
    <Card className={cn('border-slate-200 bg-white', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base text-slate-950">Free App Access</CardTitle>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Active
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
          Core practice tools are available without a paid subscription. Robin can still have an
          Admin-set daily free usage limit because AI messages have operating costs.
        </div>

        {aiUsage && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Bot className="h-4 w-4 text-blue-700" />
              Robin Practice Today
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {aiUsage.turnsUsed} used, {aiUsage.turnsRemaining} remaining.
            </p>
            {aiUsage.hasReachedLimit && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Daily free usage is used up for now. Extra credit packs can be enabled later.
              </p>
            )}
          </div>
        )}

        {showDetails && (
          <div className="space-y-2">
            {FREE_APP_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <Icon className="h-4 w-4 text-slate-400" />
                  {item.label}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
