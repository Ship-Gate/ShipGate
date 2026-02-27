/**
 * @isl-lang/verifier-security Types
 * 
 * Type definitions for security verification including
 * token entropy, approved sources, and runtime checks.
 */

// ============================================================================
// SECURITY RULE TYPES
// ============================================================================

/**
 * Severity levels for security violations
 */
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * A security violation found during static analysis
 */
export interface SecurityViolation {
  /** Unique rule identifier */
  ruleId: string;
  /** File path where violation was found */
  file: string;
  /** Line number of the violation */
  line: number;
  /** Human-readable message */
  message: string;
  /** Severity of the violation */
  severity: SecuritySeverity;
  /** Evidence (code snippet) */
  evidence: string;
  /** Suggested fix */
  fix?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for security rules
 */
export interface SecurityRuleConfig {
  /** Custom approved token sources */
  approvedSources?: ApprovedTokenSource[];
  /** Minimum token length in characters (default: 64 for 256-bit) */
  minTokenLength?: number;
  /** Minimum entropy bits required (default: 256) */
  minEntropyBits?: number;
  /** File patterns to skip */
  skipPatterns?: string[];
}

/**
 * A security rule definition for static code analysis
 */
export interface SecurityRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Run the security check on code (static analysis) */
  check: (code: string, file: string, config?: SecurityRuleConfig) => SecurityViolation[];
}

/**
 * A domain security rule for ISL domain analysis
 */
export interface DomainSecurityRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category of the rule */
  category: string;
  /** Default severity */
  severity: SecuritySeverity;
  /** Human-readable description */
  description: string;
  /** Run the security check on ISL domain */
  check: (context: RuleContext) => SecurityFinding[];
}

// ============================================================================
// APPROVED TOKEN SOURCE TYPES
// ============================================================================

/**
 * An approved cryptographic token source
 */
export interface ApprovedTokenSource {
  /** Name of the approved source */
  name: string;
  /** Module/package that provides this source */
  module: string;
  /** Function or method name */
  functionName: string;
  /** Pattern to match in code */
  pattern: RegExp;
  /** Minimum byte length for this source */
  minByteLength: number;
  /** Description of why this source is approved */
  rationale: string;
}

/**
 * Result of checking a token source
 */
export interface TokenSourceCheckResult {
  /** Whether the source is approved */
  approved: boolean;
  /** Name of the detected source */
  sourceName?: string;
  /** Byte length if detectable */
  byteLength?: number;
  /** Why it was approved or rejected */
  reason: string;
}

// ============================================================================
// RUNTIME CHECK TYPES
// ============================================================================

/**
 * A trace event for runtime verification
 */
export interface SecurityTraceEvent {
  /** Event type */
  type: 'token_created' | 'token_used' | 'token_validated' | 'token_revoked';
  /** Timestamp of the event */
  timestamp: number;
  /** Token length (NOT the token itself) */
  tokenLength: number;
  /** Token entropy source (for creation events) */
  entropySource?: string;
  /** Whether the token was validated */
  validated?: boolean;
  /** Hash of the token for correlation (NOT the token) */
  tokenHash?: string;
  /** Additional safe metadata */
  metadata?: SafeTokenMetadata;
}

/**
 * Metadata that is safe to log about a token
 * NEVER includes the actual token value
 */
export interface SafeTokenMetadata {
  /** Length in characters */
  length: number;
  /** Length in bytes */
  byteLength: number;
  /** Character set used (hex, base64, etc.) */
  encoding?: 'hex' | 'base64' | 'base64url' | 'unknown';
  /** Estimated entropy bits */
  estimatedEntropyBits: number;
  /** Whether length meets minimum */
  meetsLengthRequirement: boolean;
  /** Whether entropy meets minimum */
  meetsEntropyRequirement: boolean;
  /** Timestamp created */
  createdAt?: number;
  /** Expires at timestamp */
  expiresAt?: number;
  /** Request ID for correlation */
  requestId?: string;
}

/**
 * Result of a runtime token verification
 */
export interface RuntimeTokenCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Check name */
  checkName: string;
  /** Safe metadata about the token (NO actual token) */
  metadata: SafeTokenMetadata;
  /** Why it passed or failed */
  reason: string;
  /** Severity if failed */
  severity?: SecuritySeverity;
}

// ============================================================================
// VERIFICATION RESULT TYPES
// ============================================================================

/**
 * Verdict for security verification
 */
export type SecurityVerdict = 'secure' | 'risky' | 'insecure';

/**
 * Result of security verification
 */
export interface SecurityVerifyResult {
  /** Overall success */
  success: boolean;
  /** Security verdict */
  verdict: SecurityVerdict;
  /** Score 0-100 */
  score: number;
  /** Static analysis violations */
  staticViolations: SecurityViolation[];
  /** Runtime check results */
  runtimeChecks: RuntimeTokenCheckResult[];
  /** Coverage information */
  coverage: SecurityCoverageInfo;
  /** Timing information */
  timing: SecurityTimingInfo;
}

/**
 * Coverage information for security checks
 */
export interface SecurityCoverageInfo {
  /** Static rules checked */
  staticRules: { total: number; passed: number; failed: number };
  /** Runtime checks performed */
  runtimeChecks: { total: number; passed: number; failed: number };
  /** Files analyzed */
  filesAnalyzed: number;
  /** Trace events processed */
  traceEventsProcessed: number;
}

/**
 * Timing information for security verification
 */
export interface SecurityTimingInfo {
  /** Total verification time in ms */
  total: number;
  /** Static analysis time in ms */
  staticAnalysis: number;
  /** Runtime verification time in ms */
  runtimeVerification: number;
}

// ============================================================================
// CLAUSE EVALUATION TYPES
// ============================================================================

/**
 * A security clause to evaluate
 */
export interface SecurityClause {
  /** Unique clause ID */
  id: string;
  /** Clause type */
  type: 'token_entropy' | 'token_length' | 'token_source' | 'token_expiry';
  /** Human-readable expression */
  expression: string;
  /** Required value (e.g., min length, min entropy) */
  requiredValue: number;
  /** Unit of the value */
  unit: 'bits' | 'bytes' | 'characters' | 'seconds';
}

/**
 * Result of evaluating a security clause
 */
export interface ClauseEvaluationResult {
  /** Clause that was evaluated */
  clause: SecurityClause;
  /** Whether it passed */
  passed: boolean;
  /** Actual value found */
  actualValue?: number;
  /** Evidence supporting the result */
  evidence: string;
  /** Error if evaluation failed */
  error?: string;
}

// ============================================================================
// ISL DOMAIN SECURITY TYPES (for rule-based security analysis)
// ============================================================================

/**
 * A security finding from ISL domain analysis
 */
export interface SecurityFinding {
  /** Unique finding identifier */
  id: string;
  /** Category of the finding */
  category: string;
  /** Severity level */
  severity: SecuritySeverity;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Location in the ISL domain */
  location: {
    domain: string;
    behavior?: string;
    file?: string;
    line?: number;
  };
  /** Recommendation for fixing */
  recommendation: string;
  /** CWE identifier if applicable */
  cweId?: string;
  /** OWASP identifier if applicable */
  owaspId?: string;
  /** Evidence code */
  evidence?: string;
}

/**
 * Field definition with validation info
 */
export interface FieldDefinition {
  type: string;
  sensitive?: boolean;
  encrypted?: boolean;
  pii?: boolean;
  validation?: string[];
  [key: string]: unknown;
}

/**
 * Entity definition for domain analysis
 */
export interface Entity {
  /** Entity name */
  name: string;
  /** Properties/fields of the entity */
  properties: Record<string, FieldDefinition>;
}

/**
 * ISL Behavior definition (simplified for security analysis)
 */
export interface Behavior {
  /** Behavior name */
  name: string;
  /** Preconditions */
  preconditions?: string[];
  /** Postconditions */
  postconditions?: string[];
  /** Inputs (singular alias) */
  input?: Record<string, FieldDefinition>;
  /** Inputs (plural) */
  inputs?: Record<string, FieldDefinition>;
  /** Output (singular alias) */
  output?: Record<string, FieldDefinition>;
  /** Outputs (plural) */
  outputs?: Record<string, FieldDefinition>;
  /** Authentication requirements */
  auth?: {
    required?: boolean;
    methods?: string[];
    tokenValidation?: boolean;
  };
}

/**
 * ISL Domain definition (simplified for security analysis)
 */
export interface Domain {
  /** Domain name */
  name: string;
  /** Behaviors in this domain */
  behaviors: Behavior[];
  /** Entities in this domain */
  entities?: Entity[];
  /** Domain configuration */
  config?: {
    authentication?: {
      required?: boolean;
      methods?: string[];
      tokenValidation?: boolean;
    };
    authorization?: {
      enabled?: boolean;
      policies?: unknown[];
    };
  };
}

/**
 * Context passed to security rules for ISL domain analysis
 */
export interface RuleContext {
  /** The domain being analyzed */
  domain: Domain;
  /** Optional specific behavior being analyzed */
  behavior?: Behavior;
  /** Source code if available */
  code?: string;
  /** File path if available */
  file?: string;
}

// Type aliases for backwards compatibility
export type DomainDefinition = Domain;
export type BehaviorDefinition = Behavior;
export type EntityDefinition = Entity;

/**
 * ISL domain security rule (for analyzing domain definitions)
 * Different from code-based SecurityRule - analyzes ISL structure
 */
export interface DomainSecurityRule {
  /** Rule ID (e.g., SEC001) */
  id: string;
  /** Rule name */
  name: string;
  /** Category (authentication, data-exposure, etc.) */
  category: string;
  /** Severity level */
  severity: SecuritySeverity;
  /** Description of what the rule checks */
  description: string;
  /** Check function that returns findings */
  check: (context: RuleContext) => SecurityFinding[];
}
