// ============================================================================
// ISL Agent Verification Types
// ============================================================================

/**
 * Status of a clause verification
 */
export type ClauseStatus = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Evidence type for how a clause was verified
 */
export type EvidenceType = 'bindings' | 'heuristic';

/**
 * Binding entry parsed from @isl-bindings block
 */
export interface BindingEntry {
  /** The ISL clause ID (e.g., "CreateUser.pre.1") */
  clauseId: string;
  /** Target type: guard, assert, test */
  type: 'guard' | 'assert' | 'test';
  /** Location in code (line number or function name) */
  location: string;
  /** Optional description */
  description?: string;
}

/**
 * Parsed bindings block
 */
export interface ParsedBindings {
  /** Domain/spec file this relates to */
  specFile?: string;
  /** Map of clauseId to binding entries */
  bindings: Map<string, BindingEntry[]>;
  /** Raw source for debugging */
  raw: string;
}

/**
 * Note attached to a verification result
 */
export interface VerificationNote {
  level: 'info' | 'warning' | 'error';
  message: string;
  location?: string;
}

/**
 * Result of verifying a single clause
 */
export interface ClauseResult {
  /** The ISL clause ID */
  clauseId: string;
  /** Verification status */
  status: ClauseStatus;
  /** How evidence was gathered */
  evidence: EvidenceType;
  /** Additional notes about the verification */
  notes: VerificationNote[];
  /** Binding entries found for this clause */
  bindings?: BindingEntry[];
  /** Heuristic matches if using fallback */
  heuristicMatches?: HeuristicMatch[];
}

/**
 * Heuristic match when bindings are not available
 */
export interface HeuristicMatch {
  /** Type of match */
  type: 'guard' | 'assert' | 'test' | 'unknown';
  /** Line number in source */
  line: number;
  /** Matched code snippet */
  code: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Complete verification result
 */
export interface VerificationResult {
  /** Overall verification passed */
  success: boolean;
  /** Per-clause results */
  clauseResults: ClauseResult[];
  /** Whether bindings were found */
  hasBindings: boolean;
  /** Parsed bindings if available */
  parsedBindings?: ParsedBindings;
  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
    boundClauses: number;
    heuristicClauses: number;
  };
}

/**
 * Options for verification
 */
export interface VerifyOptions {
  /** Skip heuristic fallback entirely */
  requireBindings?: boolean;
  /** Minimum confidence for heuristic matches */
  heuristicConfidenceThreshold?: number;
  /** Include verbose notes */
  verbose?: boolean;
}
