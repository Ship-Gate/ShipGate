/**
 * @isl-lang/app-primitives
 *
 * Business primitive ISL spec templates. Use with the spec-generator
 * as a starting point, or feed directly into codegen-fullstack.
 *
 * @example
 * ```ts
 * import { getTemplate, TEMPLATES } from '@isl-lang/app-primitives';
 * const islSpec = getTemplate('saas');
 * ```
 */

import {
  SAAS_TEMPLATE_ISL,
  MARKETPLACE_TEMPLATE_ISL,
  CRM_TEMPLATE_ISL,
  INTERNAL_TOOL_TEMPLATE_ISL,
} from './templates/isl-templates.js';
import { parseGeneratedISL } from '@isl-lang/spec-generator';
import type { GeneratedSpec, AppTemplate } from '@isl-lang/spec-generator';

export const TEMPLATES: Record<AppTemplate, { isl: string; displayName: string; description: string }> = {
  saas: {
    isl: SAAS_TEMPLATE_ISL,
    displayName: 'SaaS with Teams & Billing',
    description: 'Multi-tenant SaaS with organizations, memberships, Stripe subscriptions, and invites',
  },
  marketplace: {
    isl: MARKETPLACE_TEMPLATE_ISL,
    displayName: 'Two-Sided Marketplace',
    description: 'Buyer/seller marketplace with listings, orders, reviews, and Stripe Connect payments',
  },
  crm: {
    isl: CRM_TEMPLATE_ISL,
    displayName: 'CRM',
    description: 'Sales CRM with contacts, companies, deals, pipeline stages, and activity tracking',
  },
  'internal-tool': {
    isl: INTERNAL_TOOL_TEMPLATE_ISL,
    displayName: 'Internal Admin Tool',
    description: 'Role-based internal tool with resource management, audit logs, and data export',
  },
  booking: {
    isl: '',
    displayName: 'Booking & Scheduling',
    description: 'Service booking with availability slots, reservations, and payments',
  },
  'ai-agent-app': {
    isl: '',
    displayName: 'AI Agent App',
    description: 'AI agent orchestration with tasks, tools, message threads, and result tracking',
  },
  ecommerce: {
    isl: '',
    displayName: 'E-Commerce Store',
    description: 'Product catalog, cart, checkout, order management, and inventory tracking',
  },
  custom: {
    isl: '',
    displayName: 'Custom',
    description: 'Start from a natural language prompt',
  },
};

export function getTemplate(template: AppTemplate): string {
  return TEMPLATES[template]?.isl ?? '';
}

export function getTemplateSpec(template: AppTemplate): GeneratedSpec | null {
  const isl = getTemplate(template);
  if (!isl) return null;
  return parseGeneratedISL(isl, `${template} template`, 'template');
}

export function listTemplates(): Array<{ id: AppTemplate; displayName: string; description: string; available: boolean }> {
  return (Object.entries(TEMPLATES) as Array<[AppTemplate, typeof TEMPLATES[AppTemplate]]>).map(([id, t]) => ({
    id,
    displayName: t.displayName,
    description: t.description,
    available: t.isl.length > 0,
  }));
}

export type { AppTemplate };
