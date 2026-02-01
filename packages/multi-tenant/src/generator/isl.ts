/**
 * Tenant-Aware ISL Generator
 * 
 * Transforms ISL domains to be multi-tenant aware.
 */

import type { IsolationStrategy, PlanType } from '../tenant.js';

// ============================================================================
// Types
// ============================================================================

export interface MultiTenantConfig {
  isolation: IsolationStrategy;
  identifier: string;
  tenantEntity?: boolean;
  autoInjectTenantId?: boolean;
  scopedUniques?: boolean;
  tenantRateLimits?: boolean;
}

export interface TenantAwareTransform {
  entities: EntityTransform[];
  behaviors: BehaviorTransform[];
  types: string[];
  tenant: string;
}

export interface EntityTransform {
  name: string;
  addFields: string[];
  modifyUniques: string[];
  addInvariants: string[];
}

export interface BehaviorTransform {
  name: string;
  addPreconditions: string[];
  addPostconditions: string[];
  addSecurity: string[];
}

// ============================================================================
// ISL Generator
// ============================================================================

/**
 * Generate tenant-aware ISL domain
 */
export function generateTenantAwareISL(
  domainName: string,
  config: MultiTenantConfig
): TenantAwareTransform {
  const { isolation, identifier, tenantEntity = true, autoInjectTenantId = true } = config;

  const result: TenantAwareTransform = {
    entities: [],
    behaviors: [],
    types: [],
    tenant: '',
  };

  // Add Tenant types
  result.types.push(...generateTenantTypes());

  // Add Tenant entity if enabled
  if (tenantEntity) {
    result.tenant = generateTenantEntity(identifier);
  }

  return result;
}

/**
 * Generate tenant-related types
 */
function generateTenantTypes(): string[] {
  return [
    `enum PlanType { FREE, STARTER, PRO, ENTERPRISE }`,
    `enum TenantStatus { ACTIVE, SUSPENDED, DELETED, PENDING }`,
    `type TenantLimits = {
    max_users: Int
    max_storage_mb: Int
    max_api_calls_per_month: Int
    max_behaviors_per_minute: Int
  }`,
  ];
}

/**
 * Generate Tenant entity
 */
function generateTenantEntity(identifier: string): string {
  return `entity Tenant {
    id: UUID [immutable, unique]
    name: String { max_length: 100 }
    slug: String { pattern: /^[a-z0-9-]+$/ } [unique]
    plan: PlanType
    limits: TenantLimits
    status: TenantStatus
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      slug.length >= 2
      slug.length <= 63
    }
    
    lifecycle {
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> DELETED
      SUSPENDED -> DELETED
    }
  }`;
}

/**
 * Transform an entity to be tenant-aware
 */
export function transformEntity(
  entityName: string,
  fields: string[],
  config: MultiTenantConfig
): EntityTransform {
  const { identifier, scopedUniques = true } = config;

  const transform: EntityTransform = {
    name: entityName,
    addFields: [],
    modifyUniques: [],
    addInvariants: [],
  };

  // Add tenant_id field
  transform.addFields.push(
    `${identifier}: UUID [immutable, references: Tenant.id, auto_inject, indexed]`
  );

  // Find unique fields and scope them to tenant
  if (scopedUniques) {
    for (const field of fields) {
      if (field.includes('[unique]') || field.includes('unique]')) {
        // Extract field name
        const match = field.match(/^(\w+):/);
        if (match) {
          transform.modifyUniques.push(
            `${match[1]}: ... [unique per ${identifier}]`
          );
        }
      }
    }
  }

  // Add invariant for tenant relationship
  transform.addInvariants.push(
    `${identifier} != null`
  );

  return transform;
}

/**
 * Transform a behavior to be tenant-aware
 */
export function transformBehavior(
  behaviorName: string,
  config: MultiTenantConfig
): BehaviorTransform {
  const { identifier, tenantRateLimits = true } = config;

  const transform: BehaviorTransform = {
    name: behaviorName,
    addPreconditions: [],
    addPostconditions: [],
    addSecurity: [],
  };

  // Add tenant status check
  transform.addPreconditions.push(
    `Tenant.current.status == ACTIVE`
  );

  // Add postcondition for tenant ID
  transform.addPostconditions.push(
    `success implies { result.${identifier} == Tenant.current.id }`
  );

  // Add tenant-scoped rate limiting
  if (tenantRateLimits) {
    transform.addSecurity.push(
      `rate_limit 100/minute per ${identifier}`
    );
  }

  return transform;
}

/**
 * Generate complete tenant-aware ISL domain string
 */
export function generateFullTenantAwareISL(
  domainSource: string,
  config: MultiTenantConfig
): string {
  const lines: string[] = [];
  const { isolation, identifier } = config;

  // Add multi-tenant annotation
  lines.push(`@multi_tenant(`);
  lines.push(`  isolation: "${isolation}",`);
  lines.push(`  identifier: "${identifier}"`);
  lines.push(`)`);

  // Parse and transform domain (simplified - actual implementation would use parser)
  const domainMatch = domainSource.match(/domain\s+(\w+)\s*{/);
  if (!domainMatch) {
    throw new Error('Could not find domain declaration');
  }

  // Insert tenant types before domain
  lines.push('');
  lines.push('// Tenant Types');
  lines.push(...generateTenantTypes());
  lines.push('');

  // Insert domain with modifications
  lines.push(domainSource);

  // Add Tenant entity at the end (before closing brace)
  const closingBraceIndex = lines.lastIndexOf('}');
  if (closingBraceIndex > 0) {
    lines.splice(closingBraceIndex, 0, '');
    lines.splice(closingBraceIndex + 1, 0, '  // Auto-generated Tenant entity');
    lines.splice(closingBraceIndex + 2, 0, generateTenantEntity(identifier));
  }

  return lines.join('\n');
}

/**
 * Generate ISL precondition for tenant limit check
 */
export function generateLimitCheck(
  limitName: string,
  currentCountExpression: string
): string {
  return `${currentCountExpression} < Tenant.current.limits.${limitName}`;
}

/**
 * Generate ISL annotation for tenant isolation
 */
export function generateTenantIsolationAnnotation(): string {
  return `@tenant_isolated`;
}

/**
 * Generate ISL for tenant context access
 */
export function generateTenantContextAccess(): string {
  return `// Access current tenant
Tenant.current         // Current tenant entity
Tenant.current.id      // Current tenant ID
Tenant.current.plan    // Current tenant plan
Tenant.current.limits  // Current tenant limits
Tenant.current.status  // Current tenant status`;
}
