/**
 * Proof Bundle Verification CLI
 * 
 * CLI command: `isl proof verify <bundleDir>`
 * 
 * Enforces fail-closed verification rules:
 * - Gate must be SHIP
 * - Verify must be PROVEN
 * - Tests > 0 (unless explicitly declared)
 * - All imports resolved
 * - Stdlib versions recorded
 * 
 * If tests == 0 or any clause unknown => INCOMPLETE_PROOF (fail-closed)
 * 
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@isl-lang/isl-core/parser';
import { verifyDomain, type TraceEvent } from './verification-engine.js';
import type { VerificationResult } from './verification-engine.js';
import type { 
  ProofBundleManifest, 
  ProofVerdict,
  VerifyResults,
  ImportGraph,
  StdlibVersion,
} from './manifest.js';
import { calculateVerdictV2 } from './manifest.js';

// ============================================================================
// Types
// ============================================================================

export interface ProofVerifyOptions {
  /** Proof bundle directory path */
  bundleDir: string;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json';
  /** Strict mode - fail on any incomplete evidence */
  strict?: boolean;
  /** Skip trace verification (only check manifest) */
  skipTraceVerification?: boolean;
}

export interface ProofVerifyResult {
  /** Overall success (PROVEN only in non-strict, PROVEN in strict) */
  success: boolean;
  /** Final verdict */
  verdict: ProofVerdict;
  /** Verification result from trace analysis */
  verification?: VerificationResult;
  /** Manifest from bundle */
  manifest: ProofBundleManifest;
  /** Detailed checks performed */
  checks: ProofVerifyCheck[];
  /** Summary of fail-closed requirements */
  failClosedSummary: FailClosedSummary;
}

export interface ProofVerifyCheck {
  /** Check name */
  name: string;
  /** Check passed */
  passed: boolean;
  /** Required for PROVEN */
  required: boolean;
  /** Check message */
  message: string;
  /** Additional details */
  details?: string[];
}

export interface FailClosedSummary {
  /** Gate is SHIP */
  gateShip: boolean;
  /** Verify is PROVEN (or not required) */
  verifyProven: boolean | 'not_required';
  /** Tests > 0 (or declared not required) */
  testsExist: boolean | 'declared_not_required';
  /** All imports resolved (or no imports) */
  importsResolved: boolean | 'no_imports';
  /** Stdlib versions recorded (or no stdlib imports) */
  stdlibVersionsRecorded: boolean | 'no_stdlib';
  /** Any unknown clauses (fail-closed trigger) */
  hasUnknownClauses: boolean;
  /** Final assessment */
  allRequirementsMet: boolean;
}

// ============================================================================
// Proof Bundle Verification
// ============================================================================

/**
 * Verify a proof bundle with fail-closed rules
 * 
 * PROVEN requires ALL of:
 * - Gate verdict: SHIP
 * - Verify verdict: PROVEN (if verifyResults present)
 * - Tests > 0 (unless noTestsRequired declared)
 * - All imports resolved (if importGraph present)
 * - Stdlib versions recorded (if stdlib imports exist)
 * 
 * INCOMPLETE_PROOF if:
 * - Tests == 0 (without declaration)
 * - Any clause has unknown status
 * - Imports not resolved
 * - Stdlib versions not recorded
 */
export async function verifyProof(
  bundleDir: string,
  options: Partial<ProofVerifyOptions> = {}
): Promise<ProofVerifyResult> {
  const checks: ProofVerifyCheck[] = [];
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const specPath = path.join(bundleDir, 'spec.isl');
  const tracesPath = path.join(bundleDir, 'traces.json');

  // Load manifest
  let manifest: ProofBundleManifest;
  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestContent);
    checks.push({
      name: 'manifest_load',
      passed: true,
      required: true,
      message: 'Manifest loaded successfully',
    });
  } catch (err) {
    throw new Error(`Failed to load manifest: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check schema version
  checks.push({
    name: 'schema_version',
    passed: manifest.schemaVersion === '2.0.0',
    required: false,
    message: manifest.schemaVersion === '2.0.0' 
      ? 'Schema version is 2.0.0'
      : `Schema version ${manifest.schemaVersion} (expected 2.0.0)`,
  });

  // ============================================================================
  // Fail-Closed Rule 1: Gate must be SHIP
  // ============================================================================
  const gateShip = manifest.gateResult.verdict === 'SHIP';
  checks.push({
    name: 'gate_ship',
    passed: gateShip,
    required: true,
    message: gateShip 
      ? `Gate: SHIP (score: ${manifest.gateResult.score})`
      : `Gate: NO_SHIP (score: ${manifest.gateResult.score}, blockers: ${manifest.gateResult.blockers})`,
    details: gateShip ? undefined : manifest.gateResult.violations.slice(0, 5).map(v => 
      `${v.ruleId}: ${v.message} (${v.file})`
    ),
  });

  // ============================================================================
  // Fail-Closed Rule 2: Tests > 0
  // ============================================================================
  const hasTests = manifest.testResult.totalTests > 0;
  const testsNotRequired = manifest.testDeclaration?.noTestsRequired === true;
  const testsExist = hasTests || testsNotRequired;
  
  checks.push({
    name: 'tests_exist',
    passed: testsExist,
    required: true,
    message: hasTests 
      ? `Tests: ${manifest.testResult.passedTests}/${manifest.testResult.totalTests} passed`
      : testsNotRequired
        ? `Tests: not required (${manifest.testDeclaration?.reason || 'declared'})`
        : 'Tests: 0 tests found (FAIL-CLOSED: tests required for PROVEN)',
  });

  // ============================================================================
  // Fail-Closed Rule 3: Verify must be PROVEN
  // ============================================================================
  let verifyProven: boolean | 'not_required' = 'not_required';
  let hasUnknownClauses = false;
  
  if (manifest.verifyResults) {
    verifyProven = manifest.verifyResults.verdict === 'PROVEN';
    hasUnknownClauses = manifest.verifyResults.summary.unknownClauses > 0;
    
    checks.push({
      name: 'verify_proven',
      passed: verifyProven === true && !hasUnknownClauses,
      required: true,
      message: verifyProven
        ? hasUnknownClauses
          ? `Verify: ${manifest.verifyResults.summary.unknownClauses} unknown clauses (FAIL-CLOSED)`
          : `Verify: PROVEN (${manifest.verifyResults.summary.provenClauses} clauses)`
        : `Verify: ${manifest.verifyResults.verdict} (${manifest.verifyResults.summary.notProvenClauses} not proven, ${manifest.verifyResults.summary.violatedClauses} violated)`,
    });
  }

  // ============================================================================
  // Fail-Closed Rule 4: All imports resolved
  // ============================================================================
  let importsResolved: boolean | 'no_imports' = 'no_imports';
  
  if (manifest.importGraph) {
    importsResolved = manifest.importGraph.allResolved;
    
    checks.push({
      name: 'imports_resolved',
      passed: importsResolved === true,
      required: true,
      message: importsResolved
        ? `Imports: ${manifest.importGraph.imports.length} resolved`
        : `Imports: ${manifest.importGraph.unresolvedCount} unresolved (FAIL-CLOSED)`,
      details: importsResolved ? undefined : manifest.importGraph.imports
        .filter(i => !i.resolved)
        .map(i => `${i.importPath}: ${i.error || 'unresolved'}`),
    });
  }

  // ============================================================================
  // Fail-Closed Rule 5: Stdlib versions recorded
  // ============================================================================
  let stdlibVersionsRecorded: boolean | 'no_stdlib' = 'no_stdlib';
  
  if (manifest.importGraph) {
    const stdlibImports = manifest.importGraph.imports.filter(i => i.moduleType === 'stdlib');
    if (stdlibImports.length > 0) {
      stdlibVersionsRecorded = manifest.stdlibVersions !== undefined && manifest.stdlibVersions.length > 0;
      
      checks.push({
        name: 'stdlib_versions',
        passed: stdlibVersionsRecorded === true,
        required: true,
        message: stdlibVersionsRecorded
          ? `Stdlib: ${manifest.stdlibVersions!.length} versions recorded`
          : `Stdlib: ${stdlibImports.length} imports without version tracking (FAIL-CLOSED)`,
      });
    }
  }

  // ============================================================================
  // Optional: Run trace verification
  // ============================================================================
  let verification: VerificationResult | undefined;
  
  if (!options.skipTraceVerification) {
    try {
      const specContent = await fs.readFile(specPath, 'utf-8');
      const { domain: ast, errors: parseErrors } = parse(specContent, specPath);

      if (parseErrors.length > 0 || !ast) {
        checks.push({
          name: 'spec_parse',
          passed: false,
          required: false,
          message: `Spec parse failed: ${parseErrors.map(e => e.message).join(', ')}`,
        });
      } else {
        // Load traces
        let traces: TraceEvent[] = [];
        try {
          const tracesContent = await fs.readFile(tracesPath, 'utf-8');
          traces = JSON.parse(tracesContent);
        } catch {
          if (options.verbose) {
            checks.push({
              name: 'traces_load',
              passed: false,
              required: false,
              message: 'No traces.json found - verification will be incomplete',
            });
          }
        }

        // Run verification
        verification = await verifyDomain(ast, traces);
        
        checks.push({
          name: 'trace_verification',
          passed: verification.verdict === 'PROVEN',
          required: false,
          message: `Trace verification: ${verification.verdict} (${verification.summary.provenClauses}/${verification.summary.totalClauses} proven)`,
        });
      }
    } catch (err) {
      if (options.verbose) {
        checks.push({
          name: 'trace_verification',
          passed: false,
          required: false,
          message: `Trace verification error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // ============================================================================
  // Calculate final verdict using fail-closed rules
  // ============================================================================
  const failClosedSummary: FailClosedSummary = {
    gateShip,
    verifyProven,
    testsExist: hasTests ? true : testsNotRequired ? 'declared_not_required' : false,
    importsResolved,
    stdlibVersionsRecorded,
    hasUnknownClauses,
    allRequirementsMet: gateShip && 
      testsExist && 
      (verifyProven === 'not_required' || (verifyProven && !hasUnknownClauses)) &&
      (importsResolved === 'no_imports' || importsResolved) &&
      (stdlibVersionsRecorded === 'no_stdlib' || stdlibVersionsRecorded),
  };

  // Use calculateVerdictV2 for final verdict
  const verdictResult = calculateVerdictV2({
    gateResult: manifest.gateResult,
    buildResult: manifest.buildResult,
    testResult: manifest.testResult,
    testDeclaration: manifest.testDeclaration,
    verifyResults: manifest.verifyResults,
    importGraph: manifest.importGraph,
    stdlibVersions: manifest.stdlibVersions,
  });

  const success = verdictResult.verdict === 'PROVEN';

  return {
    success,
    verdict: verdictResult.verdict,
    verification,
    manifest,
    checks,
    failClosedSummary,
  };
}

/**
 * Format verification result for output
 */
export function formatVerificationResult(
  result: ProofVerifyResult,
  options: { format?: 'pretty' | 'json' } = {}
): string {
  if (options.format === 'json') {
    return JSON.stringify({
      success: result.success,
      verdict: result.verdict,
      failClosedSummary: result.failClosedSummary,
      checks: result.checks,
      verification: result.verification ? {
        verdict: result.verification.verdict,
        summary: result.verification.summary,
      } : undefined,
    }, null, 2);
  }

  // Pretty format
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push(' ISL Proof Bundle Verification (Fail-Closed)');
  lines.push('═'.repeat(60));
  lines.push('');

  // Verdict
  const verdictIcon = {
    PROVEN: '✓',
    NOT_PROVEN: '⚠',
    INCOMPLETE_PROOF: '○',
    VIOLATED: '✗',
  }[result.verdict];

  const verdictColor = {
    PROVEN: '\x1b[32m',      // green
    NOT_PROVEN: '\x1b[33m',   // yellow
    INCOMPLETE_PROOF: '\x1b[36m', // cyan
    VIOLATED: '\x1b[31m',     // red
  }[result.verdict];

  lines.push(`Verdict: ${verdictColor}${verdictIcon} ${result.verdict}\x1b[0m`);
  lines.push('');

  // Fail-Closed Requirements
  lines.push('─'.repeat(60));
  lines.push(' Fail-Closed Requirements');
  lines.push('─'.repeat(60));
  
  const fcs = result.failClosedSummary;
  lines.push(`  Gate SHIP:            ${fcs.gateShip ? '✓ Yes' : '✗ No'}`);
  lines.push(`  Tests > 0:            ${fcs.testsExist === true ? '✓ Yes' : fcs.testsExist === 'declared_not_required' ? '○ Not Required' : '✗ No'}`);
  lines.push(`  Verify PROVEN:        ${fcs.verifyProven === true ? '✓ Yes' : fcs.verifyProven === 'not_required' ? '○ Not Required' : '✗ No'}`);
  lines.push(`  Imports Resolved:     ${fcs.importsResolved === true ? '✓ Yes' : fcs.importsResolved === 'no_imports' ? '○ No Imports' : '✗ No'}`);
  lines.push(`  Stdlib Versions:      ${fcs.stdlibVersionsRecorded === true ? '✓ Yes' : fcs.stdlibVersionsRecorded === 'no_stdlib' ? '○ No Stdlib' : '✗ No'}`);
  lines.push(`  Unknown Clauses:      ${fcs.hasUnknownClauses ? '✗ Yes (fail-closed)' : '✓ No'}`);
  lines.push('');
  lines.push(`  All Requirements:     ${fcs.allRequirementsMet ? '\x1b[32m✓ MET\x1b[0m' : '\x1b[31m✗ NOT MET\x1b[0m'}`);
  lines.push('');

  // Checks
  lines.push('─'.repeat(60));
  lines.push(' Verification Checks');
  lines.push('─'.repeat(60));

  for (const check of result.checks) {
    const icon = check.passed ? '✓' : check.required ? '✗' : '⚠';
    const color = check.passed ? '\x1b[32m' : check.required ? '\x1b[31m' : '\x1b[33m';
    lines.push(`  ${color}${icon}\x1b[0m ${check.name}: ${check.message}`);
    if (check.details) {
      for (const detail of check.details.slice(0, 3)) {
        lines.push(`      ${detail}`);
      }
      if (check.details.length > 3) {
        lines.push(`      ... and ${check.details.length - 3} more`);
      }
    }
  }
  lines.push('');

  // Manifest info
  lines.push('─'.repeat(60));
  lines.push(' Bundle Info');
  lines.push('─'.repeat(60));
  lines.push(`  Bundle ID:  ${result.manifest.bundleId}`);
  lines.push(`  Domain:     ${result.manifest.spec.domain} v${result.manifest.spec.version}`);
  lines.push(`  Generated:  ${result.manifest.generatedAt}`);
  lines.push(`  Gate Score: ${result.manifest.gateResult.score}`);
  lines.push(`  Tests:      ${result.manifest.testResult.passedTests}/${result.manifest.testResult.totalTests}`);
  lines.push('');

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
