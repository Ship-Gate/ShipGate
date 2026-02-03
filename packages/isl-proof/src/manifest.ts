/**
 * ISL Proof Bundle Manifest
 * 
 * Enhanced proof bundles where "PROVEN" means more than just gate pass.
 * 
 * Requirements for PROVEN:
 * - Gate verdict: SHIP
 * - Build/typecheck: PASS
 * - Tests: PASS AND testCount > 0 (unless domain declares none)
 * - Policy bundle versions included
 * - Iteration diffs included
 * 
 * @module @isl-lang/proof
 */

import * as crypto from 'crypto';

// ============================================================================
// Manifest Schema v2
// ============================================================================

/**
 * Proof bundle verdicts
 * 
 * PROVEN: All requirements met (gate SHIP, build pass, tests pass with count > 0)
 * INCOMPLETE_PROOF: Gate passed but tests == 0 (unless explicitly declared)
 * VIOLATED: Gate failed or tests failed
 * UNPROVEN: Manual review required
 */
export type ProofVerdict = 'PROVEN' | 'INCOMPLETE_PROOF' | 'VIOLATED' | 'UNPROVEN';

/**
 * Build/typecheck result
 */
export interface BuildResult {
  /** Build tool used (tsc, esbuild, swc, etc.) */
  tool: string;
  /** Version of the build tool */
  toolVersion: string;
  /** Build status */
  status: 'pass' | 'fail' | 'skipped';
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Build duration in milliseconds */
  durationMs: number;
  /** Error messages (if any) */
  errors?: string[];
  /** Timestamp */
  timestamp: string;
}

/**
 * Test result summary
 */
export interface TestResult {
  /** Test framework used (vitest, jest, etc.) */
  framework: string;
  /** Framework version */
  frameworkVersion: string;
  /** Test status */
  status: 'pass' | 'fail' | 'skipped' | 'no_tests';
  /** Total test count */
  totalTests: number;
  /** Passed test count */
  passedTests: number;
  /** Failed test count */
  failedTests: number;
  /** Skipped test count */
  skippedTests: number;
  /** Test duration in milliseconds */
  durationMs: number;
  /** Coverage percentage (if available) */
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  /** Individual test file results */
  testFiles?: TestFileResult[];
  /** Timestamp */
  timestamp: string;
}

/**
 * Individual test file result
 */
export interface TestFileResult {
  file: string;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  /** Failed test names and errors */
  failures?: { name: string; error: string }[];
}

/**
 * Gate result in manifest format
 */
export interface ManifestGateResult {
  /** Final verdict */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Score 0-100 */
  score: number;
  /** Fingerprint of violations */
  fingerprint: string;
  /** Number of blockers */
  blockers: number;
  /** Number of warnings */
  warnings: number;
  /** Violation details */
  violations: ManifestViolation[];
  /** Policy bundle version used */
  policyBundleVersion: string;
  /** Rulepack versions */
  rulepackVersions: RulepackVersion[];
  /** Timestamp */
  timestamp: string;
}

/**
 * Violation in manifest format
 */
export interface ManifestViolation {
  ruleId: string;
  file: string;
  line?: number;
  message: string;
  tier: 'hard_block' | 'soft_block' | 'warn';
}

/**
 * Rulepack version info
 */
export interface RulepackVersion {
  id: string;
  version: string;
  rulesCount: number;
}

/**
 * Stdlib version record for verification reproducibility
 * 
 * Records exactly which version of a stdlib module was used during verification.
 * This enables:
 * - Reproducible verification results
 * - Detection of tampered stdlib modules
 * - Audit trail for compliance
 */
export interface StdlibVersion {
  /** Module short name (e.g., "stdlib-auth") */
  module: string;
  /** NPM package name (e.g., "@isl-lang/stdlib-auth") */
  packageName?: string;
  /** Semantic version */
  version: string;
  /** SHA-256 hash of all module files (aggregate hash) */
  moduleHash: string;
  /** Entry point path (relative to stdlib root) */
  entryPoint: string;
  /** Individual file hashes (for detailed verification) */
  fileHashes?: Array<{ path: string; hash: string }>;
}

/**
 * Import resolution status
 */
export interface ImportResolution {
  /** Import path as written in spec */
  importPath: string;
  /** Resolved module path */
  resolvedPath: string;
  /** Whether import was successfully resolved */
  resolved: boolean;
  /** Error message if not resolved */
  error?: string;
  /** Module type */
  moduleType: 'stdlib' | 'local' | 'external';
}

/**
 * Import graph for the spec
 */
export interface ImportGraph {
  /** All imports in the spec */
  imports: ImportResolution[];
  /** Hash of the import graph (for verification) */
  graphHash: string;
  /** Whether all imports are resolved */
  allResolved: boolean;
  /** Unresolved import count */
  unresolvedCount: number;
}

/**
 * Trace reference for verification evidence
 */
export interface TraceRef {
  /** Trace ID */
  traceId: string;
  /** Behavior name */
  behavior: string;
  /** Test name that generated the trace */
  testName: string;
  /** Path to trace file (relative to bundle) */
  tracePath: string;
  /** Number of events in trace */
  eventCount: number;
  /** Whether trace was used in verification */
  usedInVerification: boolean;
}

/**
 * Verify result for a single clause
 */
export interface ClauseVerifyResult {
  /** Clause identifier */
  clauseId: string;
  /** Clause type */
  clauseType: 'precondition' | 'postcondition' | 'invariant';
  /** Behavior name (if applicable) */
  behavior?: string;
  /** Verification status */
  status: 'proven' | 'not_proven' | 'unknown' | 'violated';
  /** Evidence trace IDs used */
  traceIds: string[];
  /** Reason for status */
  reason?: string;
  /** Source location */
  sourceLocation?: {
    file: string;
    line: number;
    column: number;
  };
}

/**
 * Aggregated verify results
 */
export interface VerifyResults {
  /** Overall verification verdict */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'VIOLATED';
  /** Individual clause results */
  clauses: ClauseVerifyResult[];
  /** Summary */
  summary: {
    totalClauses: number;
    provenClauses: number;
    notProvenClauses: number;
    unknownClauses: number;
    violatedClauses: number;
  };
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Tests summary (enhanced version of TestResult for manifest v2)
 */
export interface TestsSummary {
  /** Total test count */
  totalTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Whether tests exist */
  hasTests: boolean;
  /** Coverage percentage (if available) */
  coveragePercent?: number;
  /** Test framework */
  framework: string;
  /** Framework version */
  frameworkVersion: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Iteration record for healing/fix cycles
 */
export interface IterationRecord {
  /** Iteration number (1-indexed) */
  iteration: number;
  /** Fingerprint of violations at this iteration */
  fingerprint: string;
  /** Number of violations */
  violationCount: number;
  /** Violation details */
  violations: ManifestViolation[];
  /** Patches applied in this iteration */
  patches: PatchRecord[];
  /** Path to diff file (relative to bundle root) */
  diffPath?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Verdict at this iteration */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Score at this iteration */
  score: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Patch record
 */
export interface PatchRecord {
  ruleId: string;
  file: string;
  description: string;
  linesChanged: number;
}

/**
 * Domain test declaration
 */
export interface DomainTestDeclaration {
  /** Whether domain explicitly declares no tests needed */
  noTestsRequired: boolean;
  /** Reason for no tests (if applicable) */
  reason?: string;
}

/**
 * Verification evaluation result
 * 
 * Results from running ISL verification against the implementation.
 */
export interface VerificationEvaluationResult {
  /** Overall verification status */
  status: 'verified' | 'risky' | 'unsafe' | 'unchecked';
  /** Verification score (0-100) */
  score: number;
  /** Coverage metrics */
  coverage: {
    /** Precondition coverage percentage */
    preconditions: number;
    /** Postcondition coverage percentage */
    postconditions: number;
    /** Invariant coverage percentage */
    invariants: number;
    /** Temporal property coverage percentage */
    temporal: number;
  };
  /** Number of behaviors verified */
  behaviorsVerified: number;
  /** Total number of behaviors */
  totalBehaviors: number;
  /** Verification duration in milliseconds */
  durationMs: number;
  /** Errors found during verification */
  errors: Array<{
    behavior: string;
    clause: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Chaos test result
 * 
 * Results from running chaos engineering scenarios against the implementation.
 */
export interface ChaosTestResult {
  /** Overall chaos test status */
  status: 'pass' | 'fail' | 'skipped';
  /** Total chaos scenarios executed */
  totalScenarios: number;
  /** Passed scenarios */
  passedScenarios: number;
  /** Failed scenarios */
  failedScenarios: number;
  /** Skipped scenarios */
  skippedScenarios: number;
  /** Test duration in milliseconds */
  durationMs: number;
  /** Chaos configuration used */
  config: ChaosConfig;
  /** Individual scenario results */
  scenarios: ChaosScenarioResult[];
  /** Timestamp */
  timestamp: string;
}

/**
 * Chaos configuration
 */
export interface ChaosConfig {
  /** Global retry count */
  globalRetries: number;
  /** Global timeout in milliseconds */
  globalTimeoutMs: number;
  /** Injection types used */
  injectionTypes: string[];
  /** Seed for deterministic randomness (if used) */
  seed?: string;
}

/**
 * Individual chaos scenario result
 */
export interface ChaosScenarioResult {
  /** Scenario name */
  name: string;
  /** Behavior being tested */
  behavior: string;
  /** Whether scenario passed */
  passed: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Injection results */
  injections: ChaosInjectionResult[];
  /** Assertion results */
  assertions: ChaosAssertionResult[];
  /** Error if scenario failed */
  error?: string;
  /** Timeline summary */
  timeline?: {
    events: number;
    errors: number;
    recoveries: number;
  };
}

/**
 * Chaos injection result
 */
export interface ChaosInjectionResult {
  /** Injection type */
  type: string;
  /** Whether injection was activated */
  activated: boolean;
  /** Whether injection was deactivated cleanly */
  deactivated: boolean;
  /** Injection statistics */
  stats: Record<string, unknown>;
}

/**
 * Chaos assertion result
 */
export interface ChaosAssertionResult {
  /** Assertion type */
  type: string;
  /** Whether assertion passed */
  passed: boolean;
  /** Expected value */
  expected: unknown;
  /** Actual value (if available) */
  actual?: unknown;
  /** Assertion message */
  message?: string;
}

/**
 * Postcondition/invariant verification result from verification engine
 * 
 * Results from evaluating postconditions and invariants using trace events.
 */
export interface PostconditionVerificationResult {
  /** Overall verdict */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'VIOLATED';
  /** Evidence for each clause */
  evidence: Array<{
    /** Clause identifier */
    clauseId: string;
    /** Clause type */
    type: 'postcondition' | 'invariant';
    /** Behavior name (if applicable) */
    behavior?: string;
    /** Source location */
    sourceSpan: {
      file: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    /** Evaluation result */
    evaluatedResult: {
      status: 'proven' | 'not_proven' | 'failed';
      value?: boolean;
      reason?: string;
      expected?: boolean;
      actual?: boolean;
      error?: string;
    };
  }>;
  /** Summary statistics */
  summary: {
    totalClauses: number;
    provenClauses: number;
    notProvenClauses: number;
    failedClauses: number;
    incompleteClauses: number;
  };
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Proof Bundle Manifest v2
 * 
 * Enhanced manifest that includes all requirements for PROVEN status.
 * 
 * PROVEN requires:
 * - gate verdict: SHIP
 * - verify verdict: PROVEN
 * - tests > 0 (unless explicitly declared)
 * - all imports resolved
 * - stdlib versions recorded
 * 
 * If tests == 0 or any clause unknown => INCOMPLETE_PROOF (fail-closed)
 */
export interface ProofBundleManifest {
  /** Schema version */
  schemaVersion: '2.0.0';
  
  /** Bundle ID (deterministic hash of contents) */
  bundleId: string;
  
  /** Generation timestamp */
  generatedAt: string;
  
  /** Spec information */
  spec: {
    /** Domain name */
    domain: string;
    /** Spec version */
    version: string;
    /** SHA-256 hash of the spec content */
    specHash: string;
    /** Path to spec file (relative to project root) */
    specPath?: string;
  };
  
  /** Policy version information */
  policyVersion: {
    /** Main policy bundle version */
    bundleVersion: string;
    /** ISL Studio version */
    islStudioVersion: string;
    /** Individual pack versions */
    packs: RulepackVersion[];
  };
  
  // ============================================================================
  // V2 Fields - Import Graph & Stdlib Versions
  // ============================================================================
  
  /** Import graph hash - hash of all resolved imports */
  importGraphHash?: string;
  
  /** Import graph details */
  importGraph?: ImportGraph;
  
  /** Stdlib versions used in the spec */
  stdlibVersions?: StdlibVersion[];
  
  /** Verification results (fail-closed: unknown => INCOMPLETE_PROOF) */
  verifyResults?: VerifyResults;
  
  /** Trace references for verification evidence */
  traceRefs?: TraceRef[];
  
  /** Enhanced tests summary */
  testsSummary?: TestsSummary;
  
  // ============================================================================
  // Original Fields
  // ============================================================================
  
  /** Gate result */
  gateResult: ManifestGateResult;
  
  /** Build/typecheck result */
  buildResult: BuildResult;
  
  /** Test result */
  testResult: TestResult;
  
  /** Domain test declaration (if no tests required) */
  testDeclaration?: DomainTestDeclaration;
  
  /** Verification evaluation result */
  verificationEvaluation?: VerificationEvaluationResult;
  
  /** Postcondition/invariant verification results (from verification engine) */
  postconditionVerification?: PostconditionVerificationResult;
  
  /** Chaos test results (optional) */
  chaosResult?: ChaosTestResult;
  
  /** Healing iterations (if any) */
  iterations: IterationRecord[];
  
  /** Overall proof verdict */
  verdict: ProofVerdict;
  
  /** Verdict explanation */
  verdictReason: string;
  
  /** Files included in bundle */
  files: string[];
  
  /** Project context */
  project: {
    root: string;
    repository?: string;
    branch?: string;
    commit?: string;
    author?: string;
  };
  
  /** Signature (for tamper-proofing) */
  signature?: {
    algorithm: 'hmac-sha256' | 'ed25519';
    value: string;
    keyId?: string;
  };
}

// ============================================================================
// Manifest Calculation
// ============================================================================

/**
 * Extended verdict options for fail-closed verification
 */
export interface VerdictOptions {
  /** Gate result (required) */
  gateResult: ManifestGateResult;
  /** Build result (required) */
  buildResult: BuildResult;
  /** Test result (required) */
  testResult: TestResult;
  /** Test declaration (optional - for no-tests-required) */
  testDeclaration?: DomainTestDeclaration;
  /** Verify results (optional - for fail-closed verification) */
  verifyResults?: VerifyResults;
  /** Import graph (optional - for import resolution check) */
  importGraph?: ImportGraph;
  /** Stdlib versions (optional - for stdlib tracking) */
  stdlibVersions?: StdlibVersion[];
}

/**
 * Calculate the proof verdict based on all inputs (v2 - fail-closed)
 * 
 * PROVEN requires ALL of:
 * - gate verdict: SHIP
 * - verify verdict: PROVEN (if verifyResults provided)
 * - tests > 0 (unless explicitly declared noTestsRequired)
 * - all imports resolved (if importGraph provided)
 * - stdlib versions recorded (if stdlib imports exist)
 * 
 * Fail-closed: if tests == 0 or any clause unknown => INCOMPLETE_PROOF
 */
export function calculateVerdictV2(options: VerdictOptions): { verdict: ProofVerdict; reason: string; details: string[] } {
  const details: string[] = [];
  
  // Gate must be SHIP
  if (options.gateResult.verdict !== 'SHIP') {
    return {
      verdict: 'VIOLATED',
      reason: `Gate verdict is NO_SHIP (score: ${options.gateResult.score}, blockers: ${options.gateResult.blockers})`,
      details: [`Gate blocked: ${options.gateResult.blockers} blockers, ${options.gateResult.warnings} warnings`],
    };
  }
  details.push('✓ Gate: SHIP');
  
  // Build must pass (or be skipped)
  if (options.buildResult.status === 'fail') {
    return {
      verdict: 'VIOLATED',
      reason: `Build failed with ${options.buildResult.errorCount} errors`,
      details: [...details, `✗ Build failed: ${options.buildResult.errorCount} errors`],
    };
  }
  details.push(`✓ Build: ${options.buildResult.status}`);
  
  // Tests must pass (if there are any)
  if (options.testResult.status === 'fail') {
    return {
      verdict: 'VIOLATED',
      reason: `Tests failed: ${options.testResult.failedTests} of ${options.testResult.totalTests} tests failed`,
      details: [...details, `✗ Tests failed: ${options.testResult.failedTests}/${options.testResult.totalTests}`],
    };
  }
  
  // FAIL-CLOSED: Check for test count
  if (options.testResult.totalTests === 0) {
    // Check if domain explicitly declares no tests needed
    if (options.testDeclaration?.noTestsRequired) {
      details.push(`✓ Tests: none required (${options.testDeclaration.reason || 'explicitly declared'})`);
    } else {
      return {
        verdict: 'INCOMPLETE_PROOF',
        reason: 'Gate SHIP and build pass, but testCount = 0. Add tests or declare noTestsRequired.',
        details: [...details, '✗ Tests: 0 tests (fail-closed: tests required for PROVEN)'],
      };
    }
  } else {
    details.push(`✓ Tests: ${options.testResult.passedTests}/${options.testResult.totalTests} passed`);
  }
  
  // FAIL-CLOSED: Check verify results (if provided)
  if (options.verifyResults) {
    if (options.verifyResults.verdict === 'VIOLATED') {
      return {
        verdict: 'VIOLATED',
        reason: `Verification violated: ${options.verifyResults.summary.violatedClauses} clauses violated`,
        details: [...details, `✗ Verify: ${options.verifyResults.summary.violatedClauses} violations`],
      };
    }
    
    // FAIL-CLOSED: any unknown clause => INCOMPLETE_PROOF
    if (options.verifyResults.summary.unknownClauses > 0) {
      return {
        verdict: 'INCOMPLETE_PROOF',
        reason: `Verification incomplete: ${options.verifyResults.summary.unknownClauses} clauses unknown (fail-closed)`,
        details: [...details, `✗ Verify: ${options.verifyResults.summary.unknownClauses} unknown clauses`],
      };
    }
    
    if (options.verifyResults.verdict !== 'PROVEN') {
      return {
        verdict: 'INCOMPLETE_PROOF',
        reason: `Verification not proven: ${options.verifyResults.summary.notProvenClauses} clauses not proven`,
        details: [...details, `✗ Verify: ${options.verifyResults.summary.notProvenClauses} not proven`],
      };
    }
    
    details.push(`✓ Verify: PROVEN (${options.verifyResults.summary.provenClauses} clauses)`);
  }
  
  // Check import resolution (if provided)
  if (options.importGraph) {
    if (!options.importGraph.allResolved) {
      return {
        verdict: 'INCOMPLETE_PROOF',
        reason: `Imports not resolved: ${options.importGraph.unresolvedCount} unresolved imports`,
        details: [...details, `✗ Imports: ${options.importGraph.unresolvedCount} unresolved`],
      };
    }
    details.push(`✓ Imports: ${options.importGraph.imports.length} resolved`);
  }
  
  // Check stdlib versions (if stdlib imports exist)
  if (options.importGraph) {
    const stdlibImports = options.importGraph.imports.filter(i => i.moduleType === 'stdlib');
    if (stdlibImports.length > 0) {
      if (!options.stdlibVersions || options.stdlibVersions.length === 0) {
        return {
          verdict: 'INCOMPLETE_PROOF',
          reason: `Stdlib versions not recorded: ${stdlibImports.length} stdlib imports without version tracking`,
          details: [...details, `✗ Stdlib: ${stdlibImports.length} imports without version tracking`],
        };
      }
      details.push(`✓ Stdlib: ${options.stdlibVersions.length} versions recorded`);
    }
  }
  
  // All checks passed
  return {
    verdict: 'PROVEN',
    reason: `All requirements met: Gate SHIP, Verify PROVEN, ${options.testResult.totalTests} tests, imports resolved`,
    details,
  };
}

/**
 * Calculate the proof verdict based on all inputs (legacy v1 compatibility)
 */
export function calculateVerdict(
  gateResult: ManifestGateResult,
  buildResult: BuildResult,
  testResult: TestResult,
  testDeclaration?: DomainTestDeclaration
): { verdict: ProofVerdict; reason: string } {
  // Use v2 calculation for fail-closed behavior
  const result = calculateVerdictV2({
    gateResult,
    buildResult,
    testResult,
    testDeclaration,
  });
  return { verdict: result.verdict, reason: result.reason };
}

/**
 * Calculate deterministic bundle ID from manifest contents
 */
export function calculateBundleId(manifest: Omit<ProofBundleManifest, 'bundleId' | 'signature'>): string {
  const hash = crypto.createHash('sha256');
  
  // Include key fields in deterministic order
  hash.update(`spec:${manifest.spec.specHash}\n`);
  hash.update(`policy:${manifest.policyVersion.bundleVersion}\n`);
  hash.update(`gate:${manifest.gateResult.fingerprint}\n`);
  hash.update(`build:${manifest.buildResult.status}\n`);
  hash.update(`tests:${manifest.testResult.status}:${manifest.testResult.totalTests}\n`);
  
  // Include stdlib versions for reproducibility
  if (manifest.stdlibVersions && manifest.stdlibVersions.length > 0) {
    const sortedStdlib = [...manifest.stdlibVersions].sort((a, b) => a.module.localeCompare(b.module));
    for (const lib of sortedStdlib) {
      hash.update(`stdlib:${lib.module}:${lib.version}:${lib.moduleHash}\n`);
    }
  }
  
  // Include import graph hash if available
  if (manifest.importGraphHash) {
    hash.update(`imports:${manifest.importGraphHash}\n`);
  }
  
  if (manifest.verificationEvaluation) {
    hash.update(`verification:${manifest.verificationEvaluation.status}:${manifest.verificationEvaluation.score}\n`);
  }
  if (manifest.chaosResult) {
    hash.update(`chaos:${manifest.chaosResult.status}:${manifest.chaosResult.passedScenarios}/${manifest.chaosResult.totalScenarios}\n`);
  }
  hash.update(`verdict:${manifest.verdict}\n`);
  hash.update(`iterations:${manifest.iterations.length}\n`);
  
  // Include iteration fingerprints
  for (const iter of manifest.iterations) {
    hash.update(`iter-${iter.iteration}:${iter.fingerprint}\n`);
  }
  
  return hash.digest('hex').slice(0, 32);
}

/**
 * Calculate spec hash from content
 */
export function calculateSpecHash(specContent: string): string {
  return crypto.createHash('sha256').update(specContent).digest('hex');
}

/**
 * Create a StdlibVersion record from module info
 * 
 * Used when building proof bundles to record which stdlib versions were used.
 */
export function createStdlibVersion(
  moduleName: string,
  version: string,
  moduleHash: string,
  entryPoint: string,
  packageName?: string,
  fileHashes?: Array<{ path: string; hash: string }>
): StdlibVersion {
  return {
    module: moduleName,
    packageName,
    version,
    moduleHash,
    entryPoint,
    fileHashes,
  };
}

/**
 * Calculate combined hash of all stdlib versions
 * 
 * Used for quick verification that stdlib hasn't changed.
 */
export function calculateStdlibManifestHash(versions: StdlibVersion[]): string {
  const sorted = [...versions].sort((a, b) => a.module.localeCompare(b.module));
  const content = sorted.map(v => `${v.module}:${v.version}:${v.moduleHash}`).join('\n');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
}

/**
 * Sign a manifest
 */
export function signManifest(
  manifest: ProofBundleManifest,
  secret: string,
  keyId?: string
): ProofBundleManifest {
  const payload = JSON.stringify({
    bundleId: manifest.bundleId,
    spec: manifest.spec,
    verdict: manifest.verdict,
    generatedAt: manifest.generatedAt,
  });
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return {
    ...manifest,
    signature: {
      algorithm: 'hmac-sha256',
      value: signature,
      keyId,
    },
  };
}

/**
 * Verify a signed manifest
 */
export function verifyManifestSignature(
  manifest: ProofBundleManifest,
  secret: string
): { valid: boolean; error?: string } {
  if (!manifest.signature) {
    return { valid: false, error: 'Manifest is not signed' };
  }
  
  if (manifest.signature.algorithm !== 'hmac-sha256') {
    return { valid: false, error: `Unsupported algorithm: ${manifest.signature.algorithm}` };
  }
  
  const payload = JSON.stringify({
    bundleId: manifest.bundleId,
    spec: manifest.spec,
    verdict: manifest.verdict,
    generatedAt: manifest.generatedAt,
  });
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (manifest.signature.value !== expected) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  return { valid: true };
}
