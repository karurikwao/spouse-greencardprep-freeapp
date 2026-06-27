/**
 * Free-app feature gate compatibility layer.
 *
 * The old app used live entitlements to blur or block some features. In the
 * free-app version, core feature access is open; cost control belongs in the
 * Robin daily-limit and optional credit-pack logic instead.
 */

import type { ReactNode } from 'react';
import type { FeatureKey, PlanType } from '@/lib/plans';

interface EntitlementFeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  onUpgrade?: (plan: PlanType) => void;
  fallback?: ReactNode;
  context?: 'trial_limit' | 'ai_limit' | 'feature_locked' | 'pdf_locked';
  inline?: boolean;
  loadingComponent?: ReactNode;
  lockedWhileLoading?: boolean;
}

export function EntitlementFeatureGate({ children }: EntitlementFeatureGateProps) {
  return <>{children}</>;
}

export function useFeatureGate(_feature: FeatureKey) {
  return {
    hasAccess: true,
    isLoading: false,
    reason: undefined,
    requiresUpgrade: false,
    currentPlan: 'trial' as const,
    effectiveStatus: 'active' as const,
  };
}

export default EntitlementFeatureGate;
