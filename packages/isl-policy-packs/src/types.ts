/**
 * ISL Policy Packs - Type Definitions
 * 
 * @module @isl-lang/policy-packs
 */

import type { Claim, Evidence, PolicyViolation, ConfidenceTier } from '@isl-lang/firewall';

// ============================================================================
// Policy Rule Types
// ============================================================================

/**
 * Policy rule severity
 */
export type PolicySeverity = 'error' | 'warning' | 'info';

/**
 * Policy rule definition
 */
export interface PolicyRule {
  /** Unique rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule severity */
  severity: PolicySeverity;
  /** Rule category (e.g., 'auth', 'payments', 'pii') */
  category: string;
  /** Tags for filtering */
  tags: string[];
  /** Evaluate function */
  evaluate: (context: RuleContext) => RuleViolation | null;
  /** Optional configuration */
  config?: Record<string, unknown>;
}

/**
 * Context passed to rule evaluation
 */
export interface RuleContext {
  /** Extracted claims */
  claims: Claim[];
  /** Resolved evidence */
  evidence: Evidence[];
  /** File being analyzed */
  filePath: string;
  /** File content */
  content: string;
  /** Truthpack data */
  truthpack: TruthpackData;
}

/**
 * Rule violation result
 */
export interface RuleViolation {
  /** Rule ID that was violated */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Severity */
  severity: PolicySeverity;
  /** Human-readable message */
  message: string;
  /** Confidence tier for blocking decisions */
  tier: ConfidenceTier;
  /** Related claim */
  claim?: Claim;
  /** File location */
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  /** Suggested fix */
  suggestion?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Policy Pack Types
// ============================================================================

/**
 * Policy pack definition
 */
export interface PolicyPack {
  /** Pack ID */
  id: string;
  /** Pack name */
  name: string;
  /** Pack description */
  description: string;
  /** Pack version */
  version: string;
  /** Rules in this pack */
  rules: PolicyRule[];
  /** Default configuration */
  defaultConfig?: PolicyPackConfig;
}

/**
 * Policy pack configuration
 */
export interface PolicyPackConfig {
  /** Enable/disable the entire pack */
  enabled: boolean;
  /** Rule-specific overrides */
  ruleOverrides?: Record<string, {
    enabled?: boolean;
    severity?: PolicySeverity;
    config?: Record<string, unknown>;
  }>;
}

// ============================================================================
// Truthpack Types
// ============================================================================

/**
 * Truthpack data structure
 */
export interface TruthpackData {
  /** Known routes */
  routes?: RouteDefinition[];
  /** Known environment variables */
  env?: EnvDefinition[];
  /** Auth configuration */
  auth?: AuthDefinition;
  /** Contract definitions */
  contracts?: ContractDefinition[];
}

export interface RouteDefinition {
  method: string;
  path: string;
  auth?: {
    required: boolean;
    roles?: string[];
  };
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface EnvDefinition {
  name: string;
  required: boolean;
  sensitive?: boolean;
  description?: string;
}

export interface AuthDefinition {
  providers: string[];
  protectedPaths: string[];
  publicPaths: string[];
}

export interface ContractDefinition {
  name: string;
  type: 'input' | 'output' | 'state';
  schema: Record<string, unknown>;
}

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Policy pack registry
 */
export interface PolicyPackRegistry {
  /** Get a pack by ID */
  getPack(id: string): PolicyPack | undefined;
  /** Get all packs */
  getAllPacks(): PolicyPack[];
  /** Register a custom pack */
  registerPack(pack: PolicyPack): void;
  /** Get all rules from enabled packs */
  getEnabledRules(config?: Record<string, PolicyPackConfig>): PolicyRule[];
}
