/**
 * Gate runner types
 */

import { AuthoritativeGateResult, VerificationSignal, SignalFinding } from '@isl-lang/gate';

export interface GateRunnerOptions {
  /** Repository root path */
  projectRoot: string;
  /** Path to ISL spec file */
  spec?: string;
  /** Implementation directory or file */
  implementation: string;
  /** Minimum score to pass */
  threshold: number;
  /** Files to check (for changed-only mode) */
  files?: string[];
  /** Config file path */
  configPath?: string;
  /** Skip policy checks */
  skipPolicy?: boolean;
  /** Policy file path */
  policyFile?: string;
}

export interface GateRunnerResult {
  /** Gate result */
  result: AuthoritativeGateResult;
  /** Processed findings */
  findings: ProcessedFinding[];
  /** Execution metrics */
  metrics: {
    durationMs: number;
    filesScanned: number;
    signalsProcessed: number;
  };
}

export interface ProcessedFinding {
  /** Unique identifier */
  id: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Rule or check that generated this finding */
  ruleId: string;
  /** Human-readable message */
  message: string;
  /** File path (relative to project root) */
  filePath?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Whether this finding blocks SHIP */
  blocking: boolean;
  /** Source of the finding */
  source: string;
  /** Original signal finding */
  original: SignalFinding;
}

export interface GateConfig {
  /** Threshold settings */
  thresholds: {
    minScore: number;
    minTestPassRate: number;
    minCoverage: number;
    maxCriticalFindings: number;
    maxHighFindings: number;
  };
  /** Include patterns */
  include: string[];
  /** Exclude patterns */
  exclude: string[];
  /** Enabled checks */
  checks: {
    parser: boolean;
    typechecker: boolean;
    verifier: boolean;
    security: boolean;
    hallucination: boolean;
    firewall: boolean;
  };
}
