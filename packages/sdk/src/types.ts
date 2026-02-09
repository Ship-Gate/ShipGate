/**
 * @shipgate/sdk — Stable Public Types
 *
 * All types in this file are part of the public contract.
 * Breaking changes require a major version bump.
 *
 * STABILITY RULES:
 * - AST internals are NOT part of the public contract
 * - Only documented fields are stable
 * - Returned objects MUST be treated as read-only
 *
 * @module @shipgate/sdk
 */

// ============================================================================
// Gate Verdict
// ============================================================================

/**
 * Gate decision verdict.
 *
 * - `SHIP`    — All checks passed; safe to deploy
 * - `WARN`    — Borderline; review recommended before deploy
 * - `NO_SHIP` — Critical issues found; do NOT deploy
 */
export type GateVerdict = 'SHIP' | 'WARN' | 'NO_SHIP';

// ============================================================================
// Domain & Behavior Summaries (no AST internals)
// ============================================================================

/**
 * Summarized behavior from a parsed ISL domain.
 * Conditions are rendered as human-readable strings, not raw AST nodes.
 */
export interface BehaviorSummary {
  /** Behavior name */
  readonly name: string;
  /** Precondition expressions as readable strings */
  readonly preconditions: readonly string[];
  /** Postcondition expressions as readable strings */
  readonly postconditions: readonly string[];
  /** Invariant expressions as readable strings */
  readonly invariants: readonly string[];
}

/**
 * Summarized domain from a parsed ISL specification.
 * Contains only stable, documented fields — no AST internals.
 */
export interface DomainSummary {
  /** Domain name */
  readonly name: string;
  /** Domain version string */
  readonly version: string;
  /** Behaviors defined in this domain */
  readonly behaviors: readonly BehaviorSummary[];
  /** Entity names defined in this domain */
  readonly entities: readonly string[];
  /** Domain-level invariant names */
  readonly invariants: readonly string[];
}

// ============================================================================
// Parse Result
// ============================================================================

/**
 * Result of parsing ISL source code.
 * On success, `domain` is populated with a stable summary.
 * On failure, `errors` contains parse diagnostics.
 */
export interface ParseResult {
  /** Whether parsing succeeded without errors */
  readonly success: boolean;
  /** Parsed domain summary (undefined when parse fails) */
  readonly domain?: DomainSummary;
  /** Parse errors (empty array on success) */
  readonly errors: ReadonlyArray<{
    /** Human-readable error message */
    readonly message: string;
    /** Line number (1-based) */
    readonly line?: number;
    /** Column number (1-based) */
    readonly column?: number;
    /** Machine-readable error code */
    readonly code?: string;
  }>;
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Options for behavioral verification.
 */
export interface VerifyOptions {
  /** Path to the ISL spec file */
  readonly specPath: string;
  /** Path to the implementation file or directory */
  readonly implPath: string;
  /** Project root directory (defaults to process.cwd()) */
  readonly projectRoot?: string;
  /** Custom score thresholds for gate decisions */
  readonly thresholds?: {
    /** Minimum score for SHIP verdict (default: 80) */
    readonly ship?: number;
    /** Minimum score for WARN verdict (default: 50) */
    readonly warn?: number;
  };
}

/**
 * Result of behavioral verification against an ISL spec.
 * Contains the verdict, score, and actionable information.
 */
export interface VerifyResult {
  /** The gate verdict: SHIP, WARN, or NO_SHIP */
  readonly verdict: GateVerdict;
  /** Overall quality score (0–100) */
  readonly score: number;
  /** Whether verification passed (score meets SHIP threshold) */
  readonly passed: boolean;
  /** Human-readable summary of the verification */
  readonly summary: string;
  /** Reasons contributing to the verdict */
  readonly reasons: ReadonlyArray<{
    /** Reason description */
    readonly label: string;
    /** Impact severity */
    readonly impact: 'critical' | 'high' | 'medium' | 'low';
  }>;
  /** Actionable suggestions for improvement */
  readonly suggestions: readonly string[];
  /** Verification duration in milliseconds */
  readonly durationMs: number;
}

// ============================================================================
// Spec Generation
// ============================================================================

/**
 * Result of generating an ISL spec from source code analysis.
 */
export interface GeneratedSpec {
  /** Generated ISL source code */
  readonly isl: string;
  /** Confidence level (0–1) indicating generation quality */
  readonly confidence: number;
  /** Warnings about the generated spec */
  readonly warnings: readonly string[];
}

// ============================================================================
// Quality Report
// ============================================================================

/**
 * Quality report from linting an ISL specification.
 * Scores each of five quality dimensions on a 0–100 scale.
 */
export interface QualityReport {
  /** Overall composite score (0–100) */
  readonly score: number;
  /** Per-dimension quality scores */
  readonly dimensions: {
    /** How complete the spec is (entities, behaviors, conditions) */
    readonly completeness: { readonly score: number; readonly findings: readonly string[] };
    /** How specific the conditions are (concrete vs. vague) */
    readonly specificity: { readonly score: number; readonly findings: readonly string[] };
    /** Whether security concerns are addressed */
    readonly security: { readonly score: number; readonly findings: readonly string[] };
    /** How testable the spec is (clear postconditions, scenarios) */
    readonly testability: { readonly score: number; readonly findings: readonly string[] };
    /** Internal consistency (naming, style, patterns) */
    readonly consistency: { readonly score: number; readonly findings: readonly string[] };
  };
  /** Actionable suggestions for improving spec quality */
  readonly suggestions: ReadonlyArray<{
    /** Quality dimension this suggestion relates to */
    readonly dimension: string;
    /** Severity: info, warning, or critical */
    readonly severity: 'info' | 'warning' | 'critical';
    /** Human-readable suggestion */
    readonly message: string;
  }>;
}
