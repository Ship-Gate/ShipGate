export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanFeatures {
  dashboard: boolean;
  signedProofs: boolean;
  compliance: boolean;
  badge: boolean;
  apiAccess: boolean;
  sso: boolean;
  rbac: boolean;
  audit: boolean;
  selfHosted: boolean;
  maxScansPerMonth: number;
  proofChains: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: { dashboard: false, signedProofs: false, compliance: false, badge: false, apiAccess: false, sso: false, rbac: false, audit: false, selfHosted: false, maxScansPerMonth: 25, proofChains: false },
  pro: { dashboard: true, signedProofs: true, compliance: true, badge: true, apiAccess: false, sso: false, rbac: false, audit: false, selfHosted: false, maxScansPerMonth: -1, proofChains: false },
  enterprise: { dashboard: true, signedProofs: true, compliance: true, badge: true, apiAccess: true, sso: true, rbac: true, audit: true, selfHosted: true, maxScansPerMonth: -1, proofChains: true },
};

export const PLAN_PRICES: Record<PlanTier, { amount: number; label: string }> = {
  free: { amount: 0, label: 'Free forever' },
  pro: { amount: 49, label: '$49/mo' },
  enterprise: { amount: 149, label: '$149/mo' },
};

export function getPlanFeatures(plan: string | undefined): PlanFeatures {
  if (plan === 'enterprise') return PLAN_FEATURES.enterprise;
  if (plan === 'pro') return PLAN_FEATURES.pro;
  return PLAN_FEATURES.free;
}

export function canAccess(plan: string | undefined, feature: keyof PlanFeatures): boolean {
  const features = getPlanFeatures(plan);
  const value = features[feature];
  return typeof value === 'boolean' ? value : value > 0;
}

export function getUpgradeTier(currentPlan: string | undefined, feature: keyof PlanFeatures): PlanTier | null {
  if (canAccess(currentPlan, feature)) return null;
  if (canAccess('pro', feature)) return 'pro';
  if (canAccess('enterprise', feature)) return 'enterprise';
  return null;
}
