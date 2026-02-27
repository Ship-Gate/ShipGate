/**
 * Evidence Types
 *
 * Core TypeScript types for ISL verification evidence.
 * These types represent the structured output of contract verification runs.
 */

/**
 * Overall verification verdict
 */
export type Verdict = 'SHIP' | 'NO_SHIP';

/**
 * Individual clause verification status
 */
export type ClauseStatus = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Source location reference for evidence
 */
export interface SourceLocation {
  /** File path relative to project root */
  file: string;
  /** 1-indexed line number */
  line: number;
  /** Optional 1-indexed column number */
  column?: number;
  /** Optional source code snippet */
  snippet?: string;
}

/**
 * Evidence item supporting a clause result
 */
export interface EvidenceItem {
  /** Type of evidence */
  type: 'assertion' | 'invariant' | 'precondition' | 'postcondition' | 'trace' | 'log';
  /** Human-readable description */
  description: string;
  /** Source location where evidence was collected */
  location?: SourceLocation;
  /** Raw value or data associated with evidence */
  value?: unknown;
  /** Timestamp when evidence was collected (ISO 8601) */
  collectedAt?: string;
}

/**
 * Result of verifying a single clause
 */
export interface ClauseResult {
  /** Unique identifier for the clause */
  id: string;
  /** Human-readable clause name */
  name: string;
  /** Verification status */
  status: ClauseStatus;
  /** Detailed description of what was verified */
  description?: string;
  /** Evidence supporting the result */
  evidence: EvidenceItem[];
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Assumption made during verification
 */
export interface Assumption {
  /** Unique identifier */
  id: string;
  /** Description of the assumption */
  description: string;
  /** Why this assumption was necessary */
  rationale?: string;
  /** Risk level if assumption is wrong */
  risk: 'low' | 'medium' | 'high';
}

/**
 * Open question identified during verification
 */
export interface OpenQuestion {
  /** Unique identifier */
  id: string;
  /** The question */
  question: string;
  /** Context or background */
  context?: string;
  /** Suggested actions to resolve */
  suggestedActions?: string[];
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
}

/**
 * Command to reproduce the verification
 */
export interface ReproCommand {
  /** Human-readable description */
  description: string;
  /** The command to run */
  command: string;
  /** Working directory (relative to project root) */
  workingDirectory?: string;
  /** Environment variables needed */
  env?: Record<string, string>;
}

/**
 * Summary statistics for the verification run
 */
export interface VerificationSummary {
  /** Total number of clauses */
  totalClauses: number;
  /** Number of passing clauses */
  passedClauses: number;
  /** Number of partially passing clauses */
  partialClauses: number;
  /** Number of failing clauses */
  failedClauses: number;
  /** Pass rate as percentage (0-100) */
  passRate: number;
  /** Total verification duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Metadata about the verification run
 */
export interface VerificationMetadata {
  /** Name of the contract being verified */
  contractName: string;
  /** Contract file path */
  contractFile?: string;
  /** Version of the verifier */
  verifierVersion: string;
  /** Git commit hash if available */
  gitCommit?: string;
  /** Git branch if available */
  gitBranch?: string;
  /** CI/CD build ID if available */
  buildId?: string;
  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Complete evidence report for a verification run
 */
export interface EvidenceReport {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0.0';
  /** Overall verdict */
  verdict: Verdict;
  /** Summary statistics */
  summary: VerificationSummary;
  /** Verification metadata */
  metadata: VerificationMetadata;
  /** Individual clause results */
  clauses: ClauseResult[];
  /** Assumptions made during verification */
  assumptions: Assumption[];
  /** Open questions identified */
  openQuestions: OpenQuestion[];
  /** Commands to reproduce the verification */
  reproCommands: ReproCommand[];
}
