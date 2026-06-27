/**
 * Paywall Components
 * 
 * Components for handling free-app access prompts.
 */

export {
  UpgradePrompt,
  InlineUpgradePrompt,
  FeatureGate,
  TrialBanner,
} from './UpgradePrompt';

// Free-app entitlement gates retained for import compatibility.
export { EntitlementFeatureGate, useFeatureGate } from './FeatureGate';
export { SecurePDFDownload } from './SecurePDFDownload';
