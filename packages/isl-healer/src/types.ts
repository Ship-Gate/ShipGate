/**
 * ISL Healer v2 - Type Definitions
 *
 * Concrete interfaces for the self-healing pipeline:
 * NL → ISL (locked) → code diff → gate → fix recipes → re-gate until SHIP
 *
 * @module @isl-lang/healer
 */

// ============================================================================
// Core Severity & Verdict Types
// ============================================================================

/**
 * Violation severity levels (immutable - healer cannot downgrade)
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Gate verdict - binary decision
 */
export type GateVerdict = 'SHIP' | 'NO_SHIP';

/**
 * Proof verdict with healing context
 */
export type ProofVerdict = 'PROVEN' | 'UNPROVEN' | 'VIOLATED' | 'HEALED';

/**
 * Heal termination reason
 */
export type HealReason =
  | 'ship'              // Success: all violations resolved
  | 'stuck'             // Failure: same fingerprint repeated
  | 'unknown_rule'      // Failure: no recipe for rule ID
  | 'max_iterations'    // Failure: iteration limit reached
  | 'weakening_detected'// Failure: patch would weaken intent
  | 'build_failed'      // Failure: code no longer compiles
  | 'test_failed';      // Failure: required tests fail

// ============================================================================
// Violation Types (Gate Output)
// ============================================================================

/**
 * Source span in a file
 */
export interface Span {
  /** Start line (1-indexed) */
  startLine: number;
  /** Start column (1-indexed) */
  startColumn: number;
  /** End line (1-indexed) */
  endLine: number;
  /** End column (1-indexed) */
  endColumn: number;
}

/**
 * Evidence attached to a violation
 */
export interface ViolationEvidence {
  /** Code snippet showing the violation */
  snippet?: string;
  /** Expected pattern/behavior */
  expected?: string;
  /** Actual pattern/behavior found */
  actual?: string;
  /** Related ISL clause */
  islClause?: string;
  /** Stack trace (if runtime) */
  stackTrace?: string;
}

/**
 * A single gate violation
 *
 * This is the normalized format - ingested from JSON or SARIF
 */
export interface Violation {
  /** Rule ID (e.g., "intent/rate-limit-required", "SEC001") */
  ruleId: string;

  /** File path (relative to project root) */
  file: string;

  /** Location span in the file */
  span: Span;

  /** Human-readable message */
  message: string;

  /** Severity level */
  severity: Severity;

  /** Supporting evidence */
  evidence: ViolationEvidence;

  /** Whether this violation has a known fix recipe */
  hasRecipe?: boolean;

  /** Suggested fix (from gate, may differ from recipe) */
  suggestion?: string;
}

// ============================================================================
// Gate Result Types (Input to Healer)
// ============================================================================

/**
 * SARIF-compatible location for interop
 */
export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId?: string;
    };
    region?: {
      startLine: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
      snippet?: { text: string };
    };
  };
}

/**
 * SARIF result for ingestion
 */
export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: SarifLocation[];
  fingerprints?: Record<string, string>;
  fixes?: Array<{
    description: { text: string };
    artifactChanges: Array<{
      artifactLocation: { uri: string };
      replacements: Array<{
        deletedRegion: { startLine: number; endLine?: number };
        insertedContent?: { text: string };
      }>;
    }>;
  }>;
}

/**
 * SARIF run for ingestion
 */
export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version?: string;
      rules?: Array<{
        id: string;
        name?: string;
        shortDescription?: { text: string };
        defaultConfiguration?: { level: string };
      }>;
    };
  };
  results: SarifResult[];
}

/**
 * Full SARIF report structure
 */
export interface SarifReport {
  $schema?: string;
  version: '2.1.0';
  runs: SarifRun[];
}

/**
 * Native JSON gate result format
 */
export interface GateResultJSON {
  /** Final verdict */
  verdict: GateVerdict;

  /** Score from 0-100 */
  score: number;

  /** All violations found */
  violations: Violation[];

  /** Deterministic fingerprint of violation set */
  fingerprint: string;

  /** Gate execution duration (ms) */
  durationMs: number;

  /** ISO timestamp */
  timestamp: string;

  /** Path to evidence artifacts */
  evidencePath?: string;

  /** Policy packs applied */
  policyPacks?: string[];
}

/**
 * Unified gate result (from JSON or SARIF)
 */
export interface GateResult {
  /** Source format */
  format: 'json' | 'sarif';

  /** Final verdict */
  verdict: GateVerdict;

  /** Score from 0-100 */
  score: number;

  /** Normalized violations */
  violations: Violation[];

  /** Deterministic fingerprint */
  fingerprint: string;

  /** Execution metadata */
  metadata: {
    tool: string;
    version?: string;
    durationMs: number;
    timestamp: string;
    policyPacks?: string[];
  };
}

// ============================================================================
// Fix Recipe Types
// ============================================================================

/**
 * Pattern for matching code to fix
 */
export interface MatchPattern {
  /** Match by AST node type */
  astType?: string;

  /** Match by text pattern (regex) */
  textPattern?: RegExp;

  /** Match by file glob */
  fileGlob?: string;

  /** Match by function/class name */
  symbolName?: string;

  /** Match context (e.g., "inside export function") */
  context?: string;
}

/**
 * Location strategy for finding fix target
 */
export interface LocateStrategy {
  /** Strategy type */
  type:
    | 'violation_span'     // Use span from violation
    | 'ast_query'          // Query AST for node
    | 'text_search'        // Search for text pattern
    | 'file_position'      // Specific file position
    | 'relative_to_match'; // Relative to matched pattern

  /** AST query (if type is ast_query) */
  query?: string;

  /** Text to search (if type is text_search) */
  search?: string | RegExp;

  /** Position relative to match */
  position?: 'before' | 'after' | 'replace' | 'wrap';

  /** Offset lines from match */
  offsetLines?: number;
}

/**
 * Patch operation to apply
 */
export interface PatchOperation {
  /** Operation type */
  type: 'insert' | 'replace' | 'delete' | 'wrap';

  /** Target file */
  file: string;

  /** Target span (if known) */
  span?: Span;

  /** Content to insert/replace */
  content: string;

  /** For wrap: prefix content */
  wrapPrefix?: string;

  /** For wrap: suffix content */
  wrapSuffix?: string;

  /** Human-readable description */
  description: string;
}

/**
 * Validation check after patch
 */
export interface PatchValidation {
  /** Validation type */
  type:
    | 'contains'       // File contains string
    | 'not_contains'   // File does not contain string
    | 'ast_has'        // AST has node matching query
    | 'compiles'       // Code compiles without errors
    | 'gate_passes'    // Specific rule passes gate
    | 'custom';        // Custom validation function

  /** Check value (string to check, query, etc.) */
  value?: string | RegExp;

  /** Custom validator (if type is custom) */
  validator?: (code: string, file: string) => boolean;

  /** Error message if validation fails */
  errorMessage: string;
}

/**
 * A fix recipe for a specific rule
 *
 * Recipe contract:
 * - MUST be deterministic (same input → same output)
 * - MUST NOT add suppression patterns
 * - MUST NOT downgrade severity
 * - MUST include validation
 */
export interface FixRecipe {
  /** Rule ID this recipe handles */
  ruleId: string;

  /** Human-readable name */
  name: string;

  /** Description of what this fix does */
  description: string;

  /** Priority when multiple recipes could apply */
  priority: number;

  /** Pattern to match violations this recipe handles */
  match: MatchPattern;

  /** Strategy to locate the fix target */
  locate: LocateStrategy;

  /** Generate patches for a violation */
  createPatches: (
    violation: Violation,
    context: FixContext
  ) => PatchOperation[];

  /** Validations to run after patching */
  validations: PatchValidation[];

  /** What to re-run after patching */
  rerunChecks: ('gate' | 'typecheck' | 'lint' | 'test')[];

  /** Framework-specific variants */
  frameworkVariants?: Record<string, Partial<FixRecipe>>;
}

/**
 * Context available when creating patches
 */
export interface FixContext {
  /** Frozen ISL AST (read-only) */
  readonly ast: Readonly<ISLAST>;

  /** Current code state */
  codeMap: Map<string, string>;

  /** Framework adapter */
  framework: FrameworkAdapter;

  /** Project root */
  projectRoot: string;

  /** Current iteration number */
  iteration: number;

  /** Previous patches in this session */
  previousPatches: PatchRecord[];
}

/**
 * Record of an applied patch
 */
export interface PatchRecord {
  /** Rule that triggered this patch */
  ruleId: string;

  /** Recipe that generated this patch */
  recipeName: string;

  /** File that was modified */
  file: string;

  /** Patch operation applied */
  operation: PatchOperation;

  /** Lines changed (positive = added, negative = removed) */
  linesChanged: number;

  /** Timestamp */
  timestamp: string;

  /** Validation results */
  validationResults: Array<{
    type: string;
    passed: boolean;
    message?: string;
  }>;
}

// ============================================================================
// Framework Adapter Types
// ============================================================================

/**
 * Supported frameworks
 */
export type SupportedFramework =
  | 'nextjs-app'      // Next.js 13+ App Router
  | 'nextjs-pages'    // Next.js Pages Router
  | 'express'         // Express.js
  | 'fastify'         // Fastify
  | 'hono'            // Hono
  | 'remix'           // Remix
  | 'sveltekit'       // SvelteKit
  | 'unknown';        // Fallback

/**
 * Framework detection result
 */
export interface FrameworkDetection {
  /** Detected framework */
  framework: SupportedFramework;

  /** Confidence level */
  confidence: number;

  /** Detection evidence */
  evidence: string[];

  /** Framework version (if detectable) */
  version?: string;
}

/**
 * Framework adapter for generating framework-specific code
 */
export interface FrameworkAdapter {
  /** Framework name */
  name: SupportedFramework;

  /** Detect if this framework is used in the project */
  detect(projectRoot: string): Promise<FrameworkDetection>;

  // ─────────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────────

  /** Import statement for rate limiting */
  getRateLimitImport(): string;

  /** Rate limit check code */
  getRateLimitCheck(options?: {
    limit?: number;
    window?: string;
    identifier?: string;
  }): string;

  /** Rate limit middleware setup (if applicable) */
  getRateLimitMiddleware?(): string;

  // ─────────────────────────────────────────────────────────────
  // Audit Logging
  // ─────────────────────────────────────────────────────────────

  /** Import statement for audit */
  getAuditImport(): string;

  /** Audit call for success path */
  getAuditSuccessCall(action: string, metadata?: Record<string, string>): string;

  /** Audit call for failure path */
  getAuditFailureCall(action: string, error?: string): string;

  // ─────────────────────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────────────────────

  /** Import statement for auth */
  getAuthImport(): string;

  /** Auth check code */
  getAuthCheck(options?: {
    required?: boolean;
    roles?: string[];
  }): string;

  // ─────────────────────────────────────────────────────────────
  // Input Validation
  // ─────────────────────────────────────────────────────────────

  /** Import statement for validation library */
  getValidationImport(): string;

  /** Generate Zod schema from ISL types */
  generateValidationSchema(types: ISLType[]): string;

  /** Validation check code */
  getValidationCheck(schemaName: string): string;

  // ─────────────────────────────────────────────────────────────
  // Intent Anchors
  // ─────────────────────────────────────────────────────────────

  /** Generate intent anchor export */
  getIntentAnchorsExport(intents: string[]): string;

  /** Generate intent comment */
  getIntentComment(intent: string): string;

  // ─────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────

  /** Generate error response */
  getErrorResponse(
    status: number,
    message: string,
    options?: {
      errorCode?: string;
      details?: Record<string, unknown>;
    }
  ): string;

  /** Generate success response */
  getSuccessResponse(data: string): string;

  // ─────────────────────────────────────────────────────────────
  // Code Structure
  // ─────────────────────────────────────────────────────────────

  /** Get route file pattern */
  getRouteFilePattern(): string;

  /** Get handler function signature */
  getHandlerSignature(method: string): string;

  /** Get request body accessor */
  getRequestBodyAccessor(): string;

  /** Get request headers accessor */
  getHeaderAccessor(name: string): string;
}

// ============================================================================
// Proof Bundle v2 Types
// ============================================================================

/**
 * Iteration snapshot for audit trail
 */
export interface IterationSnapshot {
  /** Iteration number (1-indexed) */
  iteration: number;

  /** Gate result at this iteration */
  gateResult: {
    verdict: GateVerdict;
    score: number;
    violationCount: number;
    fingerprint: string;
  };

  /** Violations at this iteration */
  violations: Violation[];

  /** Patches attempted */
  patchesAttempted: PatchRecord[];

  /** Patches successfully applied */
  patchesApplied: PatchRecord[];

  /** Code state hash (for determinism verification) */
  codeStateHash: string;

  /** Duration of this iteration (ms) */
  durationMs: number;

  /** Timestamp */
  timestamp: string;

  /** Unified diff from previous iteration (if any) */
  diff?: string;

  /** Per-file diffs from previous iteration */
  fileDiffs?: Map<string, string>;
}

/**
 * Build/compile proof
 */
export interface BuildProof {
  /** Build command executed */
  command: string;

  /** Exit code */
  exitCode: number;

  /** Build duration (ms) */
  durationMs: number;

  /** Stdout (truncated) */
  stdout?: string;

  /** Stderr (truncated) */
  stderr?: string;

  /** Artifact paths produced */
  artifacts?: string[];

  /** Timestamp */
  timestamp: string;
}

/**
 * Test execution proof
 */
export interface TestProof {
  /** Test framework */
  framework: 'vitest' | 'jest' | 'mocha' | 'playwright' | 'other';

  /** Test command executed */
  command: string;

  /** Total tests */
  total: number;

  /** Passed tests */
  passed: number;

  /** Failed tests */
  failed: number;

  /** Skipped tests */
  skipped: number;

  /** Duration (ms) */
  durationMs: number;

  /** Coverage percentage (if available) */
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };

  /** Individual test results */
  tests: Array<{
    name: string;
    file: string;
    status: 'pass' | 'fail' | 'skip';
    durationMs: number;
    error?: string;
    clausesCovered?: string[];
  }>;

  /** Timestamp */
  timestamp: string;
}

/**
 * Evidence linking ISL clause to code
 */
export interface ClauseEvidence {
  /** Clause identifier */
  clauseId: string;

  /** Clause type */
  type: 'precondition' | 'postcondition' | 'invariant' | 'intent';

  /** Original clause text from ISL */
  source: string;

  /** Behavior this clause belongs to */
  behavior: string;

  /** Evidence type */
  evidenceType: 'code' | 'test' | 'middleware' | 'config' | 'manual';

  /** Code location proving this clause */
  codeLocation?: {
    file: string;
    span: Span;
    snippet: string;
    hash: string;
  };

  /** Status */
  status: 'satisfied' | 'unsatisfied' | 'partial' | 'healed';

  /** If healed, which iteration fixed it */
  healedAtIteration?: number;

  /** Confidence score (0-1) */
  confidence: number;

  /** Notes */
  notes?: string;
}

/**
 * Proof chain entry for tamper detection
 */
export interface ProofChainEntry {
  /** Step number */
  step: number;

  /** Action taken */
  action:
    | 'init'
    | 'gate'
    | 'patch'
    | 'validate'
    | 'build'
    | 'test'
    | 'finalize';

  /** Input hash */
  inputHash: string;

  /** Output hash */
  outputHash: string;

  /** Timestamp */
  timestamp: string;

  /** Actor (healer version) */
  actor: string;
}

/**
 * ProofBundle v2 - includes healing iterations
 */
export interface ProofBundleV2 {
  /** Schema version */
  version: '2.0.0';

  /** Deterministic bundle ID (hash of contents) */
  bundleId: string;

  /** Creation timestamp */
  timestamp: string;

  // ─────────────────────────────────────────────────────────────
  // Source Information
  // ─────────────────────────────────────────────────────────────

  /** Source ISL specification */
  source: {
    /** Domain name */
    domain: string;
    /** Domain version */
    version: string;
    /** ISL content hash */
    hash: string;
    /** ISL file paths */
    files: string[];
  };

  // ─────────────────────────────────────────────────────────────
  // Healing Information
  // ─────────────────────────────────────────────────────────────

  /** Healing session info */
  healing: {
    /** Whether healing was performed */
    performed: boolean;
    /** Total iterations executed */
    iterations: number;
    /** Max iterations allowed */
    maxIterations: number;
    /** Termination reason */
    reason: HealReason;
    /** Total healing duration (ms) */
    durationMs: number;
    /** Full iteration history */
    history: IterationSnapshot[];
  };

  // ─────────────────────────────────────────────────────────────
  // Evidence
  // ─────────────────────────────────────────────────────────────

  /** Clause-level evidence */
  evidence: ClauseEvidence[];

  /** Final gate result */
  gate: {
    verdict: GateVerdict;
    score: number;
    violations: Violation[];
    fingerprint: string;
  };

  // ─────────────────────────────────────────────────────────────
  // Build & Test Proof (NEW in v2)
  // ─────────────────────────────────────────────────────────────

  /** Build proof */
  build?: BuildProof;

  /** Test proof */
  tests?: TestProof;

  // ─────────────────────────────────────────────────────────────
  // Audit & Integrity
  // ─────────────────────────────────────────────────────────────

  /** Overall verdict */
  verdict: ProofVerdict;

  /** Proof chain for tamper detection */
  chain: ProofChainEntry[];

  /** Cryptographic signature */
  signature?: {
    algorithm: 'HMAC-SHA256' | 'RSA-SHA256' | 'Ed25519';
    value: string;
    keyId?: string;
  };
}

// ============================================================================
// Heal Result Types
// ============================================================================

/**
 * Full heal result
 */
export interface HealResult {
  /** Whether healing succeeded */
  ok: boolean;

  /** Termination reason */
  reason: HealReason;

  /** Final gate result */
  gate: GateResult;

  /** Number of iterations executed */
  iterations: number;

  /** Full iteration history */
  history: IterationSnapshot[];

  /** Final code state */
  finalCode: Map<string, string>;

  /** Unknown rule IDs encountered (if reason is 'unknown_rule') */
  unknownRules?: string[];

  /** Stuck clauses that could not be resolved (if reason is 'stuck') */
  stuckClauses?: string[];

  /** Proof bundle */
  proof: ProofBundleV2;

  /** Total duration (ms) */
  durationMs: number;
}

/**
 * Healer configuration options
 */
export interface HealOptions {
  /** Maximum healing iterations (default: 8) */
  maxIterations: number;

  /** Stop after this many identical fingerprints (default: 2) */
  stopOnRepeat: number;

  /** Allow creating new files (default: false) */
  allowNewFiles: boolean;

  /** Run build after each iteration (default: false) */
  runBuild: boolean;

  /** Run tests after each iteration (default: false) */
  runTests: boolean;

  /** Require tests to pass for SHIP (default: false) */
  requireTests: boolean;

  /** Verbose logging */
  verbose: boolean;

  /** Custom fix recipes (merged with defaults) */
  customRecipes?: FixRecipe[];

  /** Framework override (skip detection) */
  framework?: SupportedFramework;

  /** Callback for each iteration */
  onIteration?: (snapshot: IterationSnapshot) => void;

  /** Callback on termination */
  onComplete?: (result: HealResult) => void;
}

// ============================================================================
// ISL AST Types (imported from @isl-lang/translator)
// ============================================================================

// These are simplified versions - actual types come from @isl-lang/translator

export interface ISLAST {
  kind: 'Domain';
  name: string;
  version: string;
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  invariants: ISLInvariant[];
  metadata: {
    generatedFrom: string;
    prompt: string;
    timestamp: string;
    confidence: number;
  };
}

export interface ISLEntity {
  name: string;
  fields: Array<{
    name: string;
    type: ISLType;
    optional: boolean;
  }>;
}

export interface ISLBehavior {
  name: string;
  preconditions: string[];
  postconditions: string[];
  intents: Array<{
    tag: string;
    description: string;
  }>;
  inputs: ISLType[];
  outputs: ISLType[];
  errors: string[];
}

export interface ISLInvariant {
  name: string;
  condition: string;
}

export interface ISLType {
  kind: 'primitive' | 'entity' | 'array' | 'union' | 'literal';
  name?: string;
  elementType?: ISLType;
  types?: ISLType[];
  value?: string | number | boolean;
}

// ============================================================================
// Recipe Registry Types
// ============================================================================

/**
 * Fix recipe registry
 */
export interface FixRecipeRegistry {
  /** Get recipe for a rule ID */
  get(ruleId: string): FixRecipe | undefined;

  /** Check if a rule has a recipe */
  has(ruleId: string): boolean;

  /** Get all registered rule IDs */
  ruleIds(): string[];

  /** Register a custom recipe */
  register(recipe: FixRecipe): void;

  /** Get unknown rules from violations */
  findUnknownRules(violations: Violation[]): string[];
}

// ============================================================================
// Weakening Guard Types
// ============================================================================

/**
 * Weakening pattern definition
 */
export interface WeakeningPattern {
  /** Pattern to match */
  pattern: RegExp;

  /** Human-readable description */
  description: string;

  /** Category of weakening */
  category: WeakeningCategory;
}

/**
 * Categories of forbidden weakening
 */
export type WeakeningCategory =
  | 'suppression'      // @ts-ignore, eslint-disable, shipgate-ignore, etc.
  | 'severity'         // Severity downgrade
  | 'auth_bypass'      // skipAuth, noAuth, etc.
  | 'allowlist'        // allowAll, permitAll, broad redirects
  | 'intent_removal'   // Removing intent declarations
  | 'pack_disable'     // Disabling policy packs
  | 'config_weaken';   // Weakening configuration

/**
 * Weakening check result
 */
export interface WeakeningCheckResult {
  /** Whether weakening was detected */
  detected: boolean;

  /** Patterns that matched */
  matches: Array<{
    pattern: WeakeningPattern;
    location: string;
    snippet: string;
  }>;
}

// ============================================================================
// Honesty Guard Types (Patch Inspection)
// ============================================================================

/**
 * Types of forbidden edits that cheating detection looks for
 */
export type ForbiddenEditType =
  | 'isl_spec_modification'      // Editing ISL spec files (removing intents)
  | 'suppression_insertion'      // Adding shipgate-ignore, @ts-ignore, etc.
  | 'pack_disable'               // Disabling policy packs in config
  | 'severity_downgrade'         // Lowering severity levels
  | 'allowlist_weaken'           // Broadening allowlists (e.g., redirect: '*')
  | 'auth_bypass'                // Adding skipAuth, noAuth patterns
  | 'gate_config_weaken';        // Weakening gate configuration

/**
 * A single diff hunk from a patch
 */
export interface DiffHunk {
  /** Original file path */
  oldPath: string;
  /** New file path (may differ for renames) */
  newPath: string;
  /** Line number in old file */
  oldStart: number;
  /** Number of lines removed */
  oldLines: number;
  /** Line number in new file */
  newStart: number;
  /** Number of lines added */
  newLines: number;
  /** Lines removed (prefixed with -) */
  removals: string[];
  /** Lines added (prefixed with +) */
  additions: string[];
  /** Context lines */
  context: string[];
}

/**
 * A file change in a patch set
 */
export interface PatchFile {
  /** File path */
  path: string;
  /** Change type */
  type: 'add' | 'modify' | 'delete' | 'rename';
  /** Old path (for renames) */
  oldPath?: string;
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Full new content (if available) */
  newContent?: string;
  /** Full old content (if available) */
  oldContent?: string;
}

/**
 * A set of patches to inspect
 */
export interface PatchSet {
  /** Source of the patch (git, healer, etc.) */
  source: 'git' | 'healer' | 'manual' | 'unknown';
  /** Commit SHA (if from git) */
  commitSha?: string;
  /** Author (if known) */
  author?: string;
  /** Changed files */
  files: PatchFile[];
  /** Raw unified diff (if available) */
  rawDiff?: string;
}

/**
 * A detected forbidden edit
 */
export interface ForbiddenEdit {
  /** Type of forbidden edit */
  type: ForbiddenEditType;
  /** File containing the forbidden edit */
  file: string;
  /** Line number (if applicable) */
  line?: number;
  /** The offending content */
  content: string;
  /** Human-readable description of the violation */
  description: string;
  /** Severity of this forbidden edit */
  severity: 'critical' | 'high';
  /** Suggested remediation */
  remediation: string;
}

/**
 * Result of inspecting a patch set for forbidden edits
 */
export interface PatchInspectionResult {
  /** Whether any forbidden edits were detected */
  forbidden: boolean;
  /** List of detected forbidden edits */
  edits: ForbiddenEdit[];
  /** Summary counts by type */
  counts: Record<ForbiddenEditType, number>;
  /** Files that were inspected */
  filesInspected: string[];
  /** Duration of inspection (ms) */
  durationMs: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Configuration for the Honesty Guard
 */
export interface HonestyGuardConfig {
  /** ISL spec file patterns to protect */
  islSpecPatterns: string[];
  /** Config file patterns to protect */
  configPatterns: string[];
  /** Enable strict mode (no edits to ISL specs at all) */
  strictMode: boolean;
  /** Custom forbidden patterns to detect */
  customPatterns?: WeakeningPattern[];
  /** Allowlist for specific suppressions (with justification) */
  allowedSuppressions?: Array<{
    pattern: string;
    justification: string;
    expires?: string; // ISO date
  }>;
}

/**
 * Honesty Guard verdict
 */
export type HonestyVerdict = 'CLEAN' | 'UNSAFE_PATCH_ATTEMPT';

/**
 * Full Honesty Guard result
 */
export interface HonestyGuardResult {
  /** Verdict */
  verdict: HonestyVerdict;
  /** Inspection result */
  inspection: PatchInspectionResult;
  /** Human-readable summary */
  summary: string;
  /** Whether to abort the operation */
  shouldAbort: boolean;
  /** Exit code recommendation */
  exitCode: number;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  // Re-export all types for convenience
};
