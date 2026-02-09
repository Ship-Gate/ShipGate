import type { LucideIcon } from 'lucide-react';
import { Zap, Users, Building2 } from 'lucide-react';

export type PlanId = 'free' | 'team' | 'enterprise';

export interface PricingPlan {
  id: PlanId;
  icon: LucideIcon;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    icon: Zap,
    name: 'Free',
    price: '0',
    period: 'forever',
    tagline: 'Everything you need to ship safely.',
    features: [
      '25 built-in rules',
      'GitHub/GitLab/Bitbucket integration',
      'CLI & VS Code extension',
      'Evidence bundles + HTML reports',
      'Unlimited repos & team members',
    ],
    cta: 'Get started',
    highlighted: false,
  },
  {
    id: 'team',
    icon: Users,
    name: 'Team',
    price: '29',
    period: '/user/mo',
    tagline: 'Governance for teams.',
    features: [
      'Everything in Free',
      'Custom rule authoring',
      'Private policy packs',
      'Suppressions with expiry',
      'Slack/Discord notifications',
      'Priority email support',
    ],
    cta: 'Start 14-day trial',
    highlighted: true,
  },
  {
    id: 'enterprise',
    icon: Building2,
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: 'Org-wide control.',
    features: [
      'Everything in Team',
      'Signed policy bundles',
      'SSO/SAML',
      'Compliance packs (SOC2, HIPAA)',
      'Multi-repo dashboard',
      'Dedicated support + SLA',
    ],
    cta: 'Contact sales',
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
    q: 'Why is Free so generous?',
    a: 'We want Shipgate on every repo. Usage = proof. Proof = enterprise customers.',
  },
  {
    q: 'Can I use Free forever?',
    a: 'Yes. The core gate is MIT licensed and always will be.',
  },
  {
    q: 'What counts as a "user"?',
    a: 'Anyone who commits to a repo with Shipgate enabled. Bots don\'t count.',
  },
  {
    q: 'Do I need Team for compliance?',
    a: 'You can achieve compliance with Free, but Team adds the audit trail and approval workflows auditors want.',
  },
  {
    q: 'Can I self-host?',
    a: 'Free and Team: Yes, it\'s all local-first. Enterprise: Optional cloud or on-prem.',
  },
];

export const CONTACT_EMAIL = 'team@shipgate.dev';
export const SUPPORT_EMAIL = 'support@shipgate.dev';
