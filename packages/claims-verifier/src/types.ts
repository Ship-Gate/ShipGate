// ============================================================================
// Claims Verification Agent - Type Definitions
// ============================================================================

/**
 * A source of truth for verifying claims.
 * Claims must be derived from one of these sources.
 */
export type ClaimSource =
  | CommandOutputSource
  | RepoMetadataSource
  | UserProvidedSource
  | ComputedSource;

/**
 * Claim derived from command output (e.g., `npx islstudio rules list`)
 */
export interface CommandOutputSource {
  type: 'command_output';
  /** The command that was run */
  command: string;
  /** The specific output field or pattern that contains the value */
  outputPath?: string;
  /** When the command was last run */
  lastVerified?: Date;
}

/**
 * Claim derived from repository metadata (package.json, file counts, etc.)
 */
export interface RepoMetadataSource {
  type: 'repo_metadata';
  /** File path relative to repo root */
  filePath: string;
  /** JSON path or pattern to extract the value */
  jsonPath?: string;
  /** Description of what was counted/extracted */
  description: string;
}

/**
 * Claim explicitly provided by user (e.g., company facts, known metrics)
 */
export interface UserProvidedSource {
  type: 'user_provided';
  /** Who provided this fact */
  providedBy: string;
  /** When it was provided */
  providedAt: Date;
  /** Reference or documentation link */
  reference?: string;
}

/**
 * Claim computed from other verified claims
 */
export interface ComputedSource {
  type: 'computed';
  /** IDs of claims this is derived from */
  derivedFrom: string[];
  /** Computation method description */
  computation: string;
}

/**
 * Methods to verify a claim
 */
export type VerificationMethod =
  | 'count_files'      // Count files matching a pattern
  | 'count_lines'      // Count lines in files
  | 'json_field'       // Extract from JSON file
  | 'command_output'   // Run command and parse output
  | 'regex_match'      // Match pattern in files
  | 'manual_check'     // Requires human verification
  | 'unverifiable';    // Cannot be verified automatically

/**
 * Result of attempting to verify a claim
 */
export type VerificationStatus =
  | 'verified'         // Claim matches source
  | 'outdated'         // Claim was verified but may be stale
  | 'mismatch'         // Claim doesn't match source value
  | 'unverifiable'     // Cannot be automatically verified
  | 'not_found'        // Source doesn't exist
  | 'error';           // Error during verification

/**
 * A claim is a numeric or quantitative assertion in documentation or copy
 */
export interface Claim {
  /** Unique identifier for the claim */
  id: string;
  
  /** The actual text containing the claim */
  text: string;
  
  /** The numeric or quantitative value being claimed */
  value: string | number;
  
  /** Unit or context (e.g., "rules", "%", "ms") */
  unit?: string;
  
  /** Where the claim appears */
  location: ClaimLocation;
  
  /** Source of truth for this claim */
  source?: ClaimSource;
  
  /** How to verify this claim */
  verificationMethod: VerificationMethod;
  
  /** Current verification status */
  status: VerificationStatus;
  
  /** Actual value from source (if verified) */
  actualValue?: string | number;
  
  /** When last verified */
  lastVerified?: Date;
  
  /** Confidence level 0-1 */
  confidence: number;
}

/**
 * Location of a claim in the codebase
 */
export interface ClaimLocation {
  /** File path */
  file: string;
  
  /** Line number (1-indexed) */
  line: number;
  
  /** Column number (1-indexed) */
  column?: number;
  
  /** Surrounding context */
  context?: string;
}

/**
 * A known fact that can be used to verify claims
 */
export interface KnownFact {
  /** Unique identifier */
  id: string;
  
  /** Description of the fact */
  description: string;
  
  /** The verified value */
  value: string | number;
  
  /** Unit or context */
  unit?: string;
  
  /** How this fact is sourced */
  source: ClaimSource;
  
  /** How to refresh this fact */
  refreshMethod?: RefreshMethod;
}

/**
 * Method to refresh a known fact
 */
export interface RefreshMethod {
  /** Type of refresh */
  type: 'command' | 'file_count' | 'json_read' | 'manual';
  
  /** Command to run or glob pattern */
  spec: string;
  
  /** Optional extraction pattern */
  extractPattern?: string;
}

/**
 * Result of linting content for unverifiable claims
 */
export interface LintResult {
  /** The file that was linted */
  file: string;
  
  /** Claims found in the file */
  claims: Claim[];
  
  /** Unverifiable claims (issues) */
  issues: LintIssue[];
  
  /** Summary statistics */
  summary: {
    total: number;
    verified: number;
    unverifiable: number;
    mismatched: number;
  };
}

/**
 * A linting issue (unverifiable or mismatched claim)
 */
export interface LintIssue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  
  /** Issue message */
  message: string;
  
  /** The problematic claim */
  claim: Claim;
  
  /** Suggested fix */
  suggestion?: string;
  
  /** Auto-fix available */
  fixable: boolean;
  
  /** The softened/rewritten text */
  softened?: string;
}

/**
 * Patterns to detect numeric claims in text
 */
export interface ClaimPattern {
  /** Name of the pattern */
  name: string;
  
  /** Regex to match the claim */
  pattern: RegExp;
  
  /** Group index for the value */
  valueGroup: number;
  
  /** Group index for the unit (optional) */
  unitGroup?: number;
  
  /** Whether this pattern typically needs verification */
  requiresVerification: boolean;
}

/**
 * Configuration for the claims verifier
 */
export interface VerifierConfig {
  /** Known facts to verify against */
  knownFacts: KnownFact[];
  
  /** Patterns to detect claims */
  patterns: ClaimPattern[];
  
  /** Files/patterns to lint */
  include: string[];
  
  /** Files/patterns to exclude */
  exclude: string[];
  
  /** Whether to auto-soften unverifiable claims */
  autoSoften: boolean;
  
  /** Severity for unverifiable claims */
  unverifiableSeverity: 'error' | 'warning' | 'info';
}
