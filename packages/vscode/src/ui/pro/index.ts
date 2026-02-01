/**
 * Pro UI Components
 * 
 * Reusable components for Pro feature gating in the VS Code extension.
 */

// Core gating components
export {
  renderProGate,
  renderInlineProGate,
  renderFullProGate,
  buildProGateStyles,
  type ProGateOptions,
} from './ProGate';

// Upsell card component
export {
  renderUpsellCard,
  buildUpsellStyles,
  type UpsellCardOptions,
} from './UpsellCard';

// Copy and messaging
export {
  FeatureNames,
  GateReasonMessages,
  Headlines,
  ValueProps,
  CTAs,
  FeatureDescriptions,
  getGateMessage,
  getFeatureDescription,
  formatFeatureName,
  getHeadline,
  getCTA,
  type GateReason,
  type FeatureName,
} from './proCopy';

// Billing URL handlers
export {
  BillingUrls,
  openBilling,
  openPlans,
  openUpgrade,
  openCheckout,
  openPortal,
  openContact,
  createBillingCommand,
  createUpgradeCommand,
} from './openBilling';
