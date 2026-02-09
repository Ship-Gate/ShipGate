/**
 * ISL Policy Engine - Type Definitions
 *
 * Policy DSL for expressing conditions over claims, verdicts,
 * confidence, and blast radius.
 *
 * @module @isl-lang/isl-policy-engine
 */

import type { Claim, Evidence, ConfidenceTier, ClaimType } from '@isl-lang/firewall';
import type { RuleViolation, PolicySeverity } from '@isl-lang/policy-packs';

// ============================================================================
// Policy DSL - Condition Primitives
// ============================================================================

/** Comparison operators for numeric conditions */
export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/** String match operators */
export type StringMatchOp = 'equals' | 'contains' | 'matches' | 'startsWith' | 'endsWith';

/** Logical combinators */
export type LogicOp = 'and' | 'or' | 'not';

/** A verdict condition */
export interface VerdictCondition {
  kind: 'verdict';
  verdict: 'SHIP' | 'NO_SHIP';
}

/** A confidence threshold condition */
export interface ConfidenceCondition {
  kind: 'confidence';
  op: ComparisonOp;
  threshold: number;
}

/** Blast radius condition (number of files/claims/violations affected) */
export interface BlastRadiusCondition {
  kind: 'blast_radius';
  op: ComparisonOp;
  threshold: number;
  measure: 'files' | 'claims' | 'violations';
}

/** A claim-type filter condition */
export interface ClaimTypeCondition {
  kind: 'claim_type';
  types: ClaimType[];
}

/** A claim field string match condition */
export interface ClaimFieldCondition {
  kind: 'claim_field';
  field: 'value' | 'type' | 'context';
  op: StringMatchOp;
  value: string;
}

/** A numeric comparison on a named metric */
export interface MetricCondition {
  kind: 'metric';
  metric: 'trust_score' | 'confidence' | 'claim_count' | 'violation_count' | 'file_count';
  op: ComparisonOp;
  value: number;
}

/** Presence check — does a truthpack field exist */
export interface PresenceCondition {
  kind: 'presence';
  field: string;
  present: boolean;
}

/** Composite logical condition */
export interface LogicCondition {
  kind: 'logic';
  op: LogicOp;
  conditions: PolicyCondition[];
}

/** Union of all condition types */
export type PolicyCondition =
  | VerdictCondition
  | ConfidenceCondition
  | BlastRadiusCondition
  | ClaimTypeCondition
  | ClaimFieldCondition
  | MetricCondition
  | PresenceCondition
  | LogicCondition;

// ============================================================================
// Policy Definition
// ============================================================================

/** Action to take when policy matches */
export type PolicyAction = 'block' | 'allow' | 'warn';

/** A single policy rule in the DSL */
export interface PolicyDef {
  /** Unique policy ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the policy enforces */
  description: string;
  /** Severity when triggered */
  severity: PolicySeverity;
  /** Confidence tier for blocking decisions */
  tier: ConfidenceTier;
  /** Condition that triggers this policy */
  when: PolicyCondition;
  /** Action to take when condition matches */
  action: PolicyAction;
  /** Explanation template — use {field} placeholders */
  explanation: string;
  /** Evidence references to include */
  evidenceRefs?: string[];
  /** Tags for filtering */
  tags?: string[];
  /** Whether this policy is enabled (default true) */
  enabled?: boolean;
}

/** A policy pack containing multiple policies */
export interface PolicyEnginePack {
  id: string;
  name: string;
  version: string;
  description: string;
  policies: PolicyDef[];
}

// ============================================================================
// Evaluation Context
// ============================================================================

/** Input to the policy engine evaluator */
export interface PolicyEvalInput {
  /** Claims extracted from code */
  claims: Claim[];
  /** Evidence for/against claims */
  evidence: Evidence[];
  /** Gate verdict if available */
  verdict?: 'SHIP' | 'NO_SHIP';
  /** Overall confidence percentage (0-100) */
  confidence?: number;
  /** Trust score (0-100) */
  trustScore?: number;
  /** Files being evaluated */
  files: PolicyFileInput[];
  /** Violations already found by other checks */
  existingViolations?: RuleViolation[];
}

/** A file being evaluated */
export interface PolicyFileInput {
  path: string;
  content: string;
}

// ============================================================================
// Evaluation Output
// ============================================================================

/** Reference to evidence that supports a decision */
export interface EvidenceRef {
  type: 'claim' | 'evidence' | 'violation' | 'file' | 'metric';
  id: string;
  label: string;
  detail: string;
}

/** A single policy decision */
export interface PolicyDecisionEntry {
  policyId: string;
  policyName: string;
  action: PolicyAction;
  severity: PolicySeverity;
  tier: ConfidenceTier;
  /** Human-readable explanation of WHY this decision was made */
  explanation: string;
  /** Evidence references supporting the decision */
  evidenceRefs: EvidenceRef[];
  /** Related claim IDs */
  relatedClaims: string[];
  /** File that triggered this (if applicable) */
  file?: string;
  timestamp: string;
}

/** Overall result from the policy engine */
export interface PolicyEngineResult {
  /** Final decision: blocked or allowed */
  allowed: boolean;
  /** All individual decisions */
  decisions: PolicyDecisionEntry[];
  /** Blocking decisions only */
  blockers: PolicyDecisionEntry[];
  /** Warning decisions only */
  warnings: PolicyDecisionEntry[];
  /** Summary explanation */
  summary: string;
  /** Evaluation duration in ms */
  durationMs: number;
  /** Evaluation metadata */
  metadata: {
    policiesEvaluated: number;
    policiesTriggered: number;
    blockerCount: number;
    warningCount: number;
    allowCount: number;
    timestamp: string;
  };
}
