/**
 * Free-app subscription status compatibility.
 *
 * Legacy pages may still import these components, but the free app should not
 * show billing warnings, purchase-access states, or countdown CTAs.
 */

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EffectiveSubscription } from '@/lib/subscriptions';

interface SubscriptionStatusBannerProps {
  subscription: EffectiveSubscription;
  onManageBilling?: () => void;
  onViewPricing?: () => void;
  onDismiss?: () => void;
  className?: string;
  variant?: 'full' | 'compact';
}

export function SubscriptionStatusBanner(_props: SubscriptionStatusBannerProps) {
  return null;
}

export function SubscriptionStatusBadge(_props: { subscription: EffectiveSubscription }) {
  return (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
      <Sparkles className="mr-1 h-3 w-3" />
      Free app
    </Badge>
  );
}

export default SubscriptionStatusBanner;
