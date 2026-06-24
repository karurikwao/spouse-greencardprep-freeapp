/**
 * Entitlements Module
 * 
 * Supabase-backed plan and entitlement system.
 * Replaces localStorage-based plan enforcement.
 * 
 * Usage:
 * ```tsx
 * import { useEntitlements, usePlanStatus, PlanStatusPanel } from '@/lib/entitlements';
 * 
 * function MyComponent() {
 *   const { entitlements, isLoading } = useEntitlements();
 *   
 *   if (isLoading) return <Loading />;
 *   
 *   if (!entitlements.features.pdfDownloads.allowed) {
 *     return <UpgradePrompt />;
 *   }
 *   
 *   return <PDFDownload />;
 * }
 * ```
 */

// Types
export type {
  PlanType,
  SubscriptionStatus,
  SubscriptionState,
  AIServiceUsage,
  FeatureAccessCheck,
  EntitlementCheckResult,
  UserEntitlements,
  PlanStatusDisplay,
  AIUsageDisplay,
  AdminUserEntitlementView,
} from './types';

// API
export {
  getUserEntitlements,
  checkFeatureAccess,
  recordAISessionStart,
  recordAITurn,
  getAIUsageDisplay,
  startTrial,
} from './api';

// Hooks
export {
  useEntitlements,
  useFeatureAccess,
  useAISession,
  usePlanStatus,
  useAIUsageDisplay,
} from './hooks';
