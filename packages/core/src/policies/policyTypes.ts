/**
 * Policy Types for ISL Policy Pack
 *
 * Machine-readable policy definitions for PII, secrets, auth, and logging constraints.
 * These types are designed to be injected into context packers for AI-assisted development.
 */

/**
 * Policy severity levels
 */
export type PolicySeverity = 'error' | 'warning' | 'info';

/**
 * Policy categories for organization
 */
export type PolicyCategory = 'pii' | 'secrets' | 'auth' | 'logging' | 'general';

/**
 * Technology stacks that policies can target
 */
export type TechStack =
  | 'node'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'generic';

/**
 * Business domains that may have specific policy requirements
 */
export type BusinessDomain =
  | 'healthcare'
  | 'finance'
  | 'ecommerce'
  | 'social'
  | 'enterprise'
  | 'government'
  | 'generic';

/**
 * A constraint that must be satisfied for a policy to pass
 */
export interface PolicyConstraint {
  /** Unique identifier for this constraint */
  readonly id: string;

  /** Human-readable description */
  readonly description: string;

  /** Pattern to detect violations (regex or AST pattern) */
  readonly pattern?: string;

  /** Fields or identifiers this constraint applies to */
  readonly appliesTo?: readonly string[];

  /** Example of compliant code */
  readonly goodExample?: string;

  /** Example of non-compliant code */
  readonly badExample?: string;
}

/**
 * A remediation action for policy violations
 */
export interface PolicyRemediation {
  /** Short description of the fix */
  readonly action: string;

  /** Detailed steps to remediate */
  readonly steps?: readonly string[];

  /** Link to documentation */
  readonly docUrl?: string;
}

/**
 * Core policy definition
 */
export interface Policy {
  /** Unique identifier (e.g., 'PII-001', 'SEC-002') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Detailed description of the policy */
  readonly description: string;

  /** Policy category */
  readonly category: PolicyCategory;

  /** Severity level */
  readonly severity: PolicySeverity;

  /** Technology stacks this policy applies to */
  readonly stacks: readonly TechStack[];

  /** Business domains this policy is relevant for */
  readonly domains: readonly BusinessDomain[];

  /** Constraints that define this policy */
  readonly constraints: readonly PolicyConstraint[];

  /** Remediation guidance */
  readonly remediation: PolicyRemediation;

  /** Tags for filtering and search */
  readonly tags: readonly string[];

  /** Whether this policy is enabled by default */
  readonly enabledByDefault: boolean;

  /** Related policy IDs */
  readonly relatedPolicies?: readonly string[];

  /** Compliance frameworks this policy helps satisfy */
  readonly compliance?: readonly string[];
}

/**
 * A collection of policies with metadata
 */
export interface PolicyPack {
  /** Unique identifier for this pack */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Version of this policy pack */
  readonly version: string;

  /** Description of the pack */
  readonly description: string;

  /** All policies in this pack */
  readonly policies: readonly Policy[];

  /** Last updated timestamp */
  readonly updatedAt: string;
}

/**
 * Options for filtering policies
 */
export interface PolicyFilterOptions {
  /** Filter by category */
  readonly categories?: readonly PolicyCategory[];

  /** Filter by severity */
  readonly severities?: readonly PolicySeverity[];

  /** Filter by tech stack */
  readonly stack?: TechStack;

  /** Filter by business domain */
  readonly domain?: BusinessDomain;

  /** Filter by tags */
  readonly tags?: readonly string[];

  /** Include only enabled-by-default policies */
  readonly enabledOnly?: boolean;

  /** Filter by compliance framework */
  readonly compliance?: string;
}

/**
 * Result of policy evaluation
 */
export interface PolicyEvaluationResult {
  /** The policy that was evaluated */
  readonly policy: Policy;

  /** Whether the policy passed */
  readonly passed: boolean;

  /** Violations found (if any) */
  readonly violations: readonly PolicyViolation[];

  /** Timestamp of evaluation */
  readonly evaluatedAt: string;
}

/**
 * A specific policy violation
 */
export interface PolicyViolation {
  /** The constraint that was violated */
  readonly constraintId: string;

  /** Description of the violation */
  readonly message: string;

  /** Location in source (if applicable) */
  readonly location?: {
    readonly file?: string;
    readonly line?: number;
    readonly column?: number;
  };

  /** The violating code snippet */
  readonly snippet?: string;
}
