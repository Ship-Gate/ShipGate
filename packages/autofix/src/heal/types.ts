/**
 * Targeted Heal System Types
 *
 * Types for the root-cause-aware heal loop that sends only relevant context
 * to the AI instead of entire files.
 */

/** Root cause categories for verification failures */
export type RootCauseCategory =
  | 'IMPORT_ERROR'
  | 'TYPE_ERROR'
  | 'MISSING_IMPLEMENTATION'
  | 'AUTH_MISSING'
  | 'TEST_FAILURE'
  | 'SPEC_MISMATCH'
  | 'UNKNOWN';

/** Heal iteration phase (structural → types/impl → tests) */
export type HealPhase = 'structural' | 'types_impl' | 'tests';

/** Minimal verification failure input (CLI-agnostic) */
export interface VerificationFailureInput {
  file: string;
  blockers: string[];
  errors: string[];
  status?: string;
  score?: number;
  specFile?: string;
  sourceCode?: string;
}

/** Analyzed failure with root cause */
export interface AnalyzedFailure {
  file: string;
  category: RootCauseCategory;
  phase: HealPhase;
  message: string;
  location?: { line?: number; column?: number };
  /** Lines that are correct and should NOT be modified */
  doNotModifyLines?: number[];
  /** Relevant context to send (not entire file) */
  contextSnippet?: string;
  /** For IMPORT_ERROR: unresolved module path */
  unresolvedImport?: string;
  /** For TYPE_ERROR: relevant type definitions */
  typeContext?: string;
  /** For MISSING_IMPLEMENTATION: function signature + ISL behavior */
  implementationContext?: { signature: string; islBehavior?: string };
  /** For AUTH_MISSING: route path */
  routePath?: string;
  /** For TEST_FAILURE: test output */
  testOutput?: string;
  /** For SPEC_MISMATCH: ISL contract snippet */
  islContract?: string;
}

/** Group of failures by root cause, ordered for fix execution */
export interface HealPlanGroup {
  phase: HealPhase;
  category: RootCauseCategory;
  failures: AnalyzedFailure[];
  /** Suggested fix prompt template key */
  promptKey: string;
}

/** Surgical diff from AI (line-based or unified) */
export interface SurgicalDiff {
  file: string;
  /** Unified diff format or line replacements */
  diff: string;
  /** If AI returned full file, we treat as replacement */
  fullReplacement?: string;
}

/** Result of applying a surgical diff */
export interface ApplyDiffResult {
  success: boolean;
  file: string;
  applied: boolean;
  error?: string;
}

/** Heal iteration result */
export interface HealIterationResult {
  iteration: number;
  phase: HealPhase;
  fixesApplied: string[];
  failuresBefore: number;
  failuresAfter: number;
  tokensSpent?: { input: number; output: number };
}

/** Full heal report */
export interface HealReport {
  failuresBeforeHeal: number;
  failuresAfterHeal: number;
  iterations: HealIterationResult[];
  tokensSpentTotal?: { input: number; output: number };
  verdict: 'SHIP' | 'NO_SHIP';
}
