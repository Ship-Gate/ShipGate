/**
 * ShipGate ISL Verify — GitHub Action Types
 *
 * Shared type definitions for the action, verification runner,
 * and PR comment renderer.
 *
 * @module @isl-lang/gate-action/types
 */

// ---------------------------------------------------------------------------
// Action inputs / outputs
// ---------------------------------------------------------------------------

/** Verification mode selector */
export type VerificationMode = 'auto' | 'strict' | 'specless';

/** Failure threshold that determines exit code */
export type FailOnLevel = 'error' | 'warning' | 'unspecced';

/** Top-level verdict */
export type Verdict = 'SHIP' | 'WARN' | 'NO_SHIP';

/** Per-file verification status */
export type FileStatus = 'PASS' | 'WARN' | 'FAIL';

/** How a file was verified */
export type FileMethod = 'ISL' | 'Specless' | 'Skipped';

/** Parsed action inputs */
export interface ActionInputs {
  /** Path to verify (default: entire repo) */
  path: string;
  /** Verification mode */
  mode: VerificationMode;
  /** Failure threshold */
  failOn: FailOnLevel;
  /** Optional path to .shipgate.yml */
  configPath?: string;
}

// ---------------------------------------------------------------------------
// Per-file result
// ---------------------------------------------------------------------------

export interface FileResult {
  /** Relative path from repo root */
  file: string;
  /** PASS / WARN / FAIL */
  status: FileStatus;
  /** How this file was verified */
  method: FileMethod;
  /** Normalised score 0.00 – 1.00 */
  score: number;
  /** ISL spec file that covered this file (if any) */
  specFile?: string;
  /** Human-readable blocker messages */
  blockers: string[];
  /** Duration in ms */
  duration: number;
}

// ---------------------------------------------------------------------------
// Overall verification result
// ---------------------------------------------------------------------------

export interface VerifyResult {
  /** SHIP / WARN / NO_SHIP */
  verdict: Verdict;
  /** Overall score 0.00 – 1.00 */
  score: number;
  /** Human-readable one-line summary */
  summary: string;
  /** Per-file results */
  files: FileResult[];
  /** Aggregated blockers */
  blockers: string[];
  /** Suggested next steps */
  recommendations: string[];
  /** ISL spec coverage */
  coverage: { specced: number; total: number };
  /** Duration in ms */
  duration: number;
  /** Path to the written JSON report */
  reportPath?: string;
}

// ---------------------------------------------------------------------------
// Config file schema (.shipgate.yml)
// ---------------------------------------------------------------------------

export interface ShipGateConfig {
  /** Minimum trust score to SHIP (0–100) */
  minScore?: number;
  /** Verification mode override */
  mode?: VerificationMode;
  /** Failure threshold override */
  failOn?: FailOnLevel;
  /** Paths to exclude from verification */
  exclude?: string[];
  /** Spec discovery directories */
  specDirs?: string[];
}
