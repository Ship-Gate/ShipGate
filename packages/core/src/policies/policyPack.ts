/**
 * Policy Pack - Helpers for managing and filtering policies
 *
 * Provides utilities for retrieving, filtering, and working with policy definitions.
 */

import type {
  Policy,
  PolicyCategory,
  PolicyFilterOptions,
  PolicyPack,
  PolicySeverity,
  TechStack,
  BusinessDomain,
} from './policyTypes.js';

import {
  ALL_DEFAULT_POLICIES,
  PII_POLICIES,
  SECRETS_POLICIES,
  AUTH_POLICIES,
  LOGGING_POLICIES,
  POLICY_COUNTS,
} from './defaults.js';

/**
 * Current version of the policy pack
 */
export const POLICY_PACK_VERSION = '1.0.0';

/**
 * Get the complete default policy pack
 */
export function getDefaultPolicyPack(): PolicyPack {
  return {
    id: 'isl-default',
    name: 'ISL Default Policy Pack',
    version: POLICY_PACK_VERSION,
    description:
      'Default policies for PII protection, secrets management, authentication, and logging',
    policies: ALL_DEFAULT_POLICIES,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get default policies filtered by tech stack and business domain
 *
 * @param stack - Technology stack to filter for (or 'generic' for all)
 * @param domain - Business domain to filter for (or 'generic' for all)
 * @returns Filtered array of policies applicable to the given stack and domain
 *
 * @example
 * ```typescript
 * // Get all policies for a Node.js healthcare app
 * const policies = getDefaultPolicies('node', 'healthcare');
 *
 * // Get all policies for any stack in finance
 * const financePolicies = getDefaultPolicies('generic', 'finance');
 *
 * // Get all default policies
 * const allPolicies = getDefaultPolicies('generic', 'generic');
 * ```
 */
export function getDefaultPolicies(
  stack: TechStack = 'generic',
  domain: BusinessDomain = 'generic'
): Policy[] {
  return ALL_DEFAULT_POLICIES.filter((policy) => {
    const stackMatch =
      stack === 'generic' ||
      policy.stacks.includes('generic') ||
      policy.stacks.includes(stack);

    const domainMatch =
      domain === 'generic' ||
      policy.domains.includes('generic') ||
      policy.domains.includes(domain);

    return stackMatch && domainMatch;
  });
}

/**
 * Get policies with advanced filtering options
 *
 * @param options - Filter criteria
 * @returns Filtered array of policies
 *
 * @example
 * ```typescript
 * // Get all error-level PII policies for Node.js
 * const criticalPii = filterPolicies({
 *   categories: ['pii'],
 *   severities: ['error'],
 *   stack: 'node',
 *   enabledOnly: true,
 * });
 * ```
 */
export function filterPolicies(options: PolicyFilterOptions = {}): Policy[] {
  const {
    categories,
    severities,
    stack,
    domain,
    tags,
    enabledOnly,
    compliance,
  } = options;

  return ALL_DEFAULT_POLICIES.filter((policy) => {
    // Category filter
    if (categories && categories.length > 0) {
      if (!categories.includes(policy.category)) {
        return false;
      }
    }

    // Severity filter
    if (severities && severities.length > 0) {
      if (!severities.includes(policy.severity)) {
        return false;
      }
    }

    // Stack filter
    if (stack && stack !== 'generic') {
      if (!policy.stacks.includes('generic') && !policy.stacks.includes(stack)) {
        return false;
      }
    }

    // Domain filter
    if (domain && domain !== 'generic') {
      if (!policy.domains.includes('generic') && !policy.domains.includes(domain)) {
        return false;
      }
    }

    // Tags filter (any match)
    if (tags && tags.length > 0) {
      const hasMatchingTag = tags.some((tag) => policy.tags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    // Enabled only filter
    if (enabledOnly && !policy.enabledByDefault) {
      return false;
    }

    // Compliance filter
    if (compliance) {
      if (!policy.compliance || !policy.compliance.includes(compliance)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get policies by category
 */
export function getPoliciesByCategory(category: PolicyCategory): readonly Policy[] {
  switch (category) {
    case 'pii':
      return PII_POLICIES;
    case 'secrets':
      return SECRETS_POLICIES;
    case 'auth':
      return AUTH_POLICIES;
    case 'logging':
      return LOGGING_POLICIES;
    case 'general':
      return [];
  }
}

/**
 * Get a specific policy by ID
 */
export function getPolicyById(id: string): Policy | undefined {
  return ALL_DEFAULT_POLICIES.find((policy) => policy.id === id);
}

/**
 * Get policies by severity level
 */
export function getPoliciesBySeverity(severity: PolicySeverity): Policy[] {
  return ALL_DEFAULT_POLICIES.filter((policy) => policy.severity === severity);
}

/**
 * Get policies that satisfy a specific compliance framework
 */
export function getPoliciesByCompliance(framework: string): Policy[] {
  return ALL_DEFAULT_POLICIES.filter(
    (policy) => policy.compliance && policy.compliance.includes(framework)
  );
}

/**
 * Get policies that have specific tags
 */
export function getPoliciesByTags(tags: readonly string[]): Policy[] {
  return ALL_DEFAULT_POLICIES.filter((policy) =>
    tags.some((tag) => policy.tags.includes(tag))
  );
}

/**
 * Get all unique tags across all policies
 */
export function getAllPolicyTags(): string[] {
  const tagSet = new Set<string>();
  for (const policy of ALL_DEFAULT_POLICIES) {
    for (const tag of policy.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Get all supported compliance frameworks
 */
export function getAllComplianceFrameworks(): string[] {
  const frameworks = new Set<string>();
  for (const policy of ALL_DEFAULT_POLICIES) {
    if (policy.compliance) {
      for (const framework of policy.compliance) {
        frameworks.add(framework);
      }
    }
  }
  return Array.from(frameworks).sort();
}

/**
 * Get policy statistics
 */
export function getPolicyStats(): {
  total: number;
  byCategory: Record<PolicyCategory, number>;
  bySeverity: Record<PolicySeverity, number>;
  enabledByDefault: number;
  withCompliance: number;
} {
  const byCategory: Record<PolicyCategory, number> = {
    pii: 0,
    secrets: 0,
    auth: 0,
    logging: 0,
    general: 0,
  };

  const bySeverity: Record<PolicySeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };

  let enabledByDefault = 0;
  let withCompliance = 0;

  for (const policy of ALL_DEFAULT_POLICIES) {
    byCategory[policy.category]++;
    bySeverity[policy.severity]++;
    if (policy.enabledByDefault) enabledByDefault++;
    if (policy.compliance && policy.compliance.length > 0) withCompliance++;
  }

  return {
    total: ALL_DEFAULT_POLICIES.length,
    byCategory,
    bySeverity,
    enabledByDefault,
    withCompliance,
  };
}

/**
 * Serialize policies to a format suitable for context injection
 *
 * @param policies - Policies to serialize
 * @returns Machine-readable policy summary
 */
export function serializePoliciesForContext(policies: readonly Policy[]): string {
  const summary = policies.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    severity: p.severity,
    constraints: p.constraints.map((c) => c.description),
  }));

  return JSON.stringify(summary, null, 2);
}

/**
 * Create a compact policy summary for LLM context
 *
 * @param policies - Policies to summarize
 * @returns Compact string representation
 */
export function createPolicySummary(policies: readonly Policy[]): string {
  const lines: string[] = [
    `# Active Policies (${policies.length} total)`,
    '',
  ];

  const byCategory = new Map<PolicyCategory, Policy[]>();
  for (const policy of policies) {
    const list = byCategory.get(policy.category) || [];
    list.push(policy);
    byCategory.set(policy.category, list);
  }

  for (const [category, categoryPolicies] of byCategory) {
    lines.push(`## ${category.toUpperCase()}`);
    for (const policy of categoryPolicies) {
      const severityIcon =
        policy.severity === 'error' ? '🔴' : policy.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`- ${severityIcon} ${policy.id}: ${policy.name}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Re-export types and defaults for convenience
export type {
  Policy,
  PolicyPack,
  PolicyCategory,
  PolicySeverity,
  PolicyConstraint,
  PolicyFilterOptions,
  TechStack,
  BusinessDomain,
} from './policyTypes.js';

export {
  ALL_DEFAULT_POLICIES,
  PII_POLICIES,
  SECRETS_POLICIES,
  AUTH_POLICIES,
  LOGGING_POLICIES,
  POLICY_COUNTS,
} from './defaults.js';
