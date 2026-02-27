/**
 * Spec Implementation Verifier — Shared Types
 *
 * Types for the verification engine that checks whether code actually
 * implements what the inferred spec says it should.
 *
 * @module @isl-lang/spec-implementation-verifier
 */

// ============================================================================
// Finding — Result of a single verification check
// ============================================================================

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  /** Unique finding ID (e.g. `import-hallucinated-abc123`) */
  id: string;
  /** Checker that produced this finding */
  checker: string;
  /** Rule ID for categorization */
  ruleId: string;
  /** Severity level */
  severity: FindingSeverity;
  /** Human-readable message */
  message: string;
  /** File path where the issue was detected */
  file?: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Whether this finding blocks SHIP */
  blocking: boolean;
  /** Remediation suggestion */
  recommendation?: string;
  /** Code snippet for context */
  snippet?: string;
  /** Additional structured context */
  context?: Record<string, unknown>;
}

// ============================================================================
// Inferred Spec — What the spec CLAIMS the code does
// ============================================================================

/** Route declared in the inferred spec */
export interface SpecRoute {
  method: string;
  path: string;
  requiresAuth?: boolean;
  roles?: string[];
  inputValidation?: boolean;
  errorHandling?: boolean;
}

/** Entity type declared in the spec */
export interface SpecEntity {
  name: string;
  fields: Array<{ name: string; type: string }>;
}

/** Behavior declared in the spec (e.g. "create user → hash password → save") */
export interface SpecBehavior {
  name: string;
  /** Control flow steps the spec claims (e.g. ["hash password", "save to DB"]) */
  steps?: string[];
  /** Security requirements (e.g. "ownership check before delete") */
  securityRequirements?: string[];
}

/** Inferred spec — output of Prompt 1 / inference pipeline */
export interface InferredSpec {
  routes?: SpecRoute[];
  entities?: SpecEntity[];
  behaviors?: SpecBehavior[];
  /** Source file paths that were inferred from */
  sourceFiles?: string[];
}

// ============================================================================
// Verification Context — Input to checkers
// ============================================================================

export interface VerificationContext {
  /** Project root directory */
  projectRoot: string;
  /** Inferred spec (what the code CLAIMS to do) */
  spec: InferredSpec;
  /** Implementation source files (path → content) */
  implFiles: Map<string, string>;
  /** Resolved package.json dependencies (for import verification) */
  dependencies?: Record<string, string>;
}

// ============================================================================
// Checker Interface
// ============================================================================

export interface VerifierChecker {
  name: string;
  run(ctx: VerificationContext): Promise<Finding[]>;
}
