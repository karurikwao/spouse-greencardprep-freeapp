/**
 * Pricing System Types
 * 
 * @deprecated This file is kept for backward compatibility.
 * New code should use types from @/lib/plans instead.
 * 
 * Migration guide:
 * - PlanType -> import from @/lib/plans
 * - PricingPlan -> use PlanConfig from @/lib/plans
 * - UserSubscription -> use UserSubscription from @/lib/plans
 * - FeatureAccess -> use PlanFeatures from @/lib/plans
 * - PLANS -> use PLAN_CONFIG from @/lib/plans
 */

import type { 
  PlanType as NewPlanType,
  PlanConfig,
  UserSubscription,
  PlanFeatures,
} from '@/lib/plans';
import { PLAN_CONFIG } from '@/lib/plans';

// Re-export types from the new plan system for backward compatibility
export type PlanType = NewPlanType;

/**
 * Legacy pricing plan interface
 * @deprecated Use PlanConfig from @/lib/plans
 */
export interface PricingPlan {
  id: PlanType;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[];
  disabledFeatures: string[];
  trialDays?: number;
}

/**
 * Legacy user subscription interface
 * @deprecated Use UserSubscription from @/lib/plans
 */
export interface LegacyUserSubscription {
  plan: PlanType;
  status: 'active' | 'expired' | 'cancelled' | 'trialing';
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  pdfDownloadsLocked: boolean;
}

/**
 * Re-export UserSubscription for backward compatibility
 */
export type { UserSubscription };

/**
 * Legacy feature access interface
 * @deprecated Use PlanFeatures from @/lib/plans
 */
export interface FeatureAccess {
  practice: boolean;
  mockInterview: boolean;
  coupleCompare: boolean;
  timelineBuilder: boolean;
  readinessCheck: boolean;
  pdfDownloads: boolean;
  printablePacks: boolean;
  futurePacks: boolean;
}

/**
 * Legacy plans configuration
 * @deprecated Use PLAN_CONFIG from @/lib/plans
 */
export const PLANS: Record<PlanType, PricingPlan> = {
  anonymous: {
    id: 'anonymous',
    name: 'Basic Access',
    price: 0,
    priceLabel: 'Free',
    description: 'Browse questions and topics. Sign up for full access.',
    trialDays: 0,
    features: [
      'Browse practice questions',
      'View topic details',
      'Basic readiness check',
    ],
    disabledFeatures: [
      'PDF downloads',
      'AI interview',
      'Couple compare',
      'Mock interview',
    ],
  },
  trial: {
    id: 'trial',
    name: PLAN_CONFIG.trial.name,
    price: 0,
    priceLabel: 'Free',
    description: PLAN_CONFIG.trial.description,
    trialDays: (PLAN_CONFIG.trial as { durationDays: number }).durationDays,
    features: [
      'All practice questions',
      'Mock interview mode',
      'Couple compare',
      'Timeline builder',
      'Readiness check',
      'PDF downloads',
    ],
    disabledFeatures: [],
  },
  monthly: {
    id: 'monthly',
    name: PLAN_CONFIG.monthly.name,
    price: PLAN_CONFIG.monthly.price,
    priceLabel: (PLAN_CONFIG.monthly as { priceLabel: string }).priceLabel,
    description: PLAN_CONFIG.monthly.description,
    features: [
      'Unlimited practice',
      'Mock interview',
      'Couple compare',
      'Timeline builder',
      'Readiness check',
    ],
    disabledFeatures: [],
  },
  lifetime: {
    id: 'lifetime',
    name: PLAN_CONFIG.lifetime.name,
    price: PLAN_CONFIG.lifetime.price,
    priceLabel: (PLAN_CONFIG.lifetime as { priceLabel: string }).priceLabel,
    description: PLAN_CONFIG.lifetime.description,
    features: [
      'Archived access record',
      'All PDF downloads',
      'Printable study packs',
      'Future question packs',
      'Support from the app team',
    ],
    disabledFeatures: [],
  },
  interviewPass: {
    id: 'interviewPass',
    name: PLAN_CONFIG.interviewPass.name,
    price: PLAN_CONFIG.interviewPass.price,
    priceLabel: (PLAN_CONFIG.interviewPass as { priceLabel: string }).priceLabel,
    description: PLAN_CONFIG.interviewPass.description,
    features: [
      'Archived 90-day access record',
      'All PDF downloads',
      'Robin interview practice',
      'Couple comparison',
      'Readiness checks',
    ],
    disabledFeatures: [],
  },
};

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Convert new PlanConfig to legacy PricingPlan format
 * @deprecated Migrate to using PlanConfig directly
 */
export function toLegacyPlan(plan: PlanConfig): PricingPlan {
  const features: string[] = [];
  const disabledFeatures: string[] = [];
  
  if (plan.features.practiceQuestions) {
    features.push('Practice questions');
  } else {
    disabledFeatures.push('Practice questions');
  }
  
  if (plan.features.aiInterview) {
    features.push('AI interview');
  } else {
    disabledFeatures.push('AI interview');
  }
  
  if (plan.features.readinessCheck) {
    features.push('Readiness check');
  } else {
    disabledFeatures.push('Readiness check');
  }
  
  if (plan.features.pdfDownloads) {
    features.push('PDF downloads');
  } else {
    disabledFeatures.push('PDF downloads');
  }
  
  if (plan.features.coupleCompare) {
    features.push('Couple comparison');
  } else {
    disabledFeatures.push('Couple comparison');
  }
  
  return {
    id: plan.id,
    name: plan.name,
    price: 'price' in plan ? (plan as { price: number }).price : 0,
    priceLabel: 'priceLabel' in plan ? (plan as { priceLabel: string }).priceLabel : 'Free',
    description: plan.description,
    features,
    disabledFeatures,
    trialDays: plan.id === 'trial' || plan.id === 'interviewPass' 
      ? (plan as { durationDays: number }).durationDays 
      : undefined,
  };
}

/**
 * Convert new PlanFeatures to legacy FeatureAccess format
 * @deprecated Migrate to using PlanFeatures directly
 */
export function toLegacyFeatureAccess(features: PlanFeatures): FeatureAccess {
  return {
    practice: features.practiceQuestions,
    mockInterview: features.aiInterview,
    coupleCompare: features.coupleCompare,
    timelineBuilder: true, // Always available
    readinessCheck: features.readinessCheck,
    pdfDownloads: features.pdfDownloads,
    printablePacks: features.pdfDownloads,
    futurePacks: features.pdfDownloads,
  };
}
