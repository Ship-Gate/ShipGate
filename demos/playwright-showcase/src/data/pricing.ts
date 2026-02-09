import type { LucideIcon } from 'lucide-react';
import { Zap, Rocket, Building2 } from 'lucide-react';

export type PlanId = 'free' | 'pro' | 'enterprise';

export interface PricingPlan {
  id: PlanId;
  icon: LucideIcon;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  ctaAction: 'install' | 'upgrade' | 'contact';
  highlighted: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    icon: Zap,
    name: 'Free',
    price: '0',
    period: 'forever',
    tagline: 'CLI + spec-less verification.',
    features: [
      'Full CLI access',
      'Spec-less verification (25+ rules)',
      'Up to 3 repos',
      'GitHub/GitLab integration',
      'Evidence bundles + HTML reports',
    ],
    cta: 'Install CLI',
    ctaAction: 'install',
    highlighted: false,
  },
  {
    id: 'pro',
    icon: Rocket,
    name: 'Pro',
    price: '49',
    period: '/mo',
    tagline: 'Unlimited repos. AI-powered specs.',
    features: [
      'Everything in Free',
      'Unlimited repos',
      'AI "shadow specs" (auto-generated ISL)',
      'Verification dashboard',
      'Custom rule authoring',
      'Priority support',
    ],
    cta: 'Upgrade',
    ctaAction: 'upgrade',
    highlighted: true,
  },
  {
    id: 'enterprise',
    icon: Building2,
    name: 'Enterprise',
    price: '149',
    period: '/mo',
    tagline: 'Governance for your whole org.',
    features: [
      'Everything in Pro',
      'Team policies & RBAC',
      'Full audit log',
      'SSO / SAML',
      'Compliance packs (SOC2, HIPAA)',
      'Dedicated support + SLA',
    ],
    cta: 'Talk to sales',
    ctaAction: 'contact',
    highlighted: false,
  },
];

export interface PricingFaqItem {
  q: string;
  a: string;
}

export const PRICING_FAQ: PricingFaqItem[] = [
  {
    q: 'Can Shipgate stop AI from shipping bad code to production?',
    a: 'Yes. Run the gate in CI in enforce mode: if the gate returns NO_SHIP (blocking issues, failed checks, or policy violations), the build fails and the PR cannot be merged. The spec gate catches missing preconditions and intent violations when you have an ISL spec; the firewall catches 25+ security and policy rules (auth, PII, payments, rate-limit) on every scan.',
  },
  {
    q: 'What\'s the difference between Free and Pro?',
    a: 'Free gives you the full CLI, spec-less verification, and up to 3 repos. Pro unlocks unlimited repos, AI-generated shadow specs, and a verification dashboard for full visibility across all your projects.',
  },
  {
    q: 'Can I use Free forever?',
    a: 'Yes. The core gate is MIT licensed and always will be.',
  },
  {
    q: 'What are "shadow specs"?',
    a: 'Shadow specs are ISL behavioral specs that Shipgate auto-generates from your codebase using AI. They capture intended behavior without you writing a single spec by hand.',
  },
  {
    q: 'Do I need Enterprise for compliance?',
    a: 'You can achieve basic compliance with Pro, but Enterprise adds the audit trail, RBAC, and approval workflows auditors want.',
  },
  {
    q: 'Can I self-host?',
    a: 'Free and Pro: Yes, it\'s all local-first. Enterprise: Optional cloud or on-prem.',
  },
];

export const CONTACT_EMAIL = 'team@shipgate.dev';
export const SUPPORT_EMAIL = 'support@shipgate.dev';
