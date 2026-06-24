/**
 * Paywall Components
 * 
 * Components for handling premium features and upgrade prompts.
 */

export {
  UpgradePrompt,
  InlineUpgradePrompt,
  FeatureGate,
  TrialBanner,
} from './UpgradePrompt';

// NEW: Supabase-backed entitlement gates (USE THESE for all premium features)
export { EntitlementFeatureGate, useFeatureGate } from './FeatureGate';
export { SecurePDFDownload } from './SecurePDFDownload';
