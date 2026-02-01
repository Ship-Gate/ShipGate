/**
 * Pro Copy - Premium messaging for Pro features
 * 
 * Short, premium, professional copy for Pro-gating UI.
 * All strings are designed to be non-cringe and value-focused.
 */

// ============================================================================
// Feature Names
// ============================================================================

export const FeatureNames = {
  UNLIMITED_SPECS: 'Unlimited Specifications',
  ADVANCED_VERIFICATION: 'Advanced Verification',
  TEAM_COLLABORATION: 'Team Collaboration',
  PRIORITY_SUPPORT: 'Priority Support',
  CUSTOM_POLICIES: 'Custom Policies',
  CI_INTEGRATION: 'CI/CD Integration',
  AUDIT_HISTORY: 'Audit History',
  BULK_OPERATIONS: 'Bulk Operations',
  EXPORT_REPORTS: 'Export Reports',
  API_ACCESS: 'API Access',
} as const;

export type FeatureName = (typeof FeatureNames)[keyof typeof FeatureNames];

// ============================================================================
// Gate Reasons
// ============================================================================

export type GateReason =
  | 'limit_reached'
  | 'pro_feature'
  | 'trial_expired'
  | 'team_required'
  | 'upgrade_required';

export const GateReasonMessages: Record<GateReason, string> = {
  limit_reached: 'You\'ve reached your plan limit',
  pro_feature: 'This is a Pro feature',
  trial_expired: 'Your trial has ended',
  team_required: 'Team plan required',
  upgrade_required: 'Upgrade to continue',
};

// ============================================================================
// Headlines
// ============================================================================

export const Headlines = {
  UPGRADE: 'Upgrade to Pro',
  UNLOCK: 'Unlock More',
  GO_PRO: 'Go Pro',
  TRY_PRO: 'Try Pro',
} as const;

// ============================================================================
// Value Propositions
// ============================================================================

export const ValueProps = {
  UNLIMITED: 'No limits. Ship faster.',
  VERIFICATION: 'Deeper verification. Higher confidence.',
  TEAMS: 'Built for teams that ship.',
  SUPPORT: 'We\'ve got your back.',
  POLICIES: 'Your rules. Enforced everywhere.',
} as const;

// ============================================================================
// CTAs (Call to Action)
// ============================================================================

export const CTAs = {
  UPGRADE_NOW: 'Upgrade Now',
  VIEW_PLANS: 'View Plans',
  START_TRIAL: 'Start Free Trial',
  LEARN_MORE: 'Learn More',
  MANAGE_BILLING: 'Manage Billing',
  CONTACT_SALES: 'Contact Sales',
} as const;

// ============================================================================
// Feature Descriptions
// ============================================================================

export const FeatureDescriptions: Record<keyof typeof FeatureNames, string> = {
  UNLIMITED_SPECS: 'Create as many specifications as your project needs.',
  ADVANCED_VERIFICATION: 'Property-based testing and formal verification.',
  TEAM_COLLABORATION: 'Share specs, sync evidence, review together.',
  PRIORITY_SUPPORT: 'Direct access to the team when you need it.',
  CUSTOM_POLICIES: 'Define and enforce your own contract policies.',
  CI_INTEGRATION: 'Verify on every commit. Block bad merges.',
  AUDIT_HISTORY: 'Full history of all verification runs.',
  BULK_OPERATIONS: 'Generate and verify across your entire codebase.',
  EXPORT_REPORTS: 'PDF and JSON exports for stakeholders.',
  API_ACCESS: 'Programmatic access for custom workflows.',
};

// ============================================================================
// Copy Helpers
// ============================================================================

/**
 * Get the gate message for a given reason
 */
export function getGateMessage(reason: GateReason): string {
  return GateReasonMessages[reason];
}

/**
 * Get a short description for a feature
 */
export function getFeatureDescription(feature: keyof typeof FeatureNames): string {
  return FeatureDescriptions[feature];
}

/**
 * Format a feature name for display
 */
export function formatFeatureName(feature: string): string {
  return feature
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get the appropriate headline based on context
 */
export function getHeadline(reason: GateReason): string {
  switch (reason) {
    case 'trial_expired':
      return Headlines.UPGRADE;
    case 'limit_reached':
      return Headlines.UNLOCK;
    case 'team_required':
      return Headlines.GO_PRO;
    default:
      return Headlines.UPGRADE;
  }
}

/**
 * Get the appropriate CTA based on context
 */
export function getCTA(reason: GateReason): string {
  switch (reason) {
    case 'trial_expired':
      return CTAs.UPGRADE_NOW;
    case 'limit_reached':
      return CTAs.VIEW_PLANS;
    case 'team_required':
      return CTAs.CONTACT_SALES;
    default:
      return CTAs.UPGRADE_NOW;
  }
}
