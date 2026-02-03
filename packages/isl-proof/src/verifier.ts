/**
 * ISL Proof Bundle Verifier
 * 
 * Verifies that a proof bundle is valid and checks:
 * - Schema version compatibility
 * - Bundle ID integrity
 * - Signature validity (if signed)
 * - Verdict calculation consistency
 * - File completeness
 * 
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ProofBundleManifest,
  ProofVerdict,
} from './manifest.js';
import {
  calculateVerdict,
  calculateBundleId,
  calculateSpecHash,
  verifyManifestSignature,
} from './manifest.js';

// ============================================================================
// Types
// ============================================================================

export type VerificationSeverity = 'error' | 'warning' | 'info';

export interface VerificationIssue {
  severity: VerificationSeverity;
  code: string;
  message: string;
  details?: string;
}

export interface VerificationResult {
  /** Overall verification status */
  valid: boolean;
  /** Manifest verdict */
  verdict: ProofVerdict;
  /** Whether the bundle is complete (all files present) */
  complete: boolean;
  /** Whether the signature is valid (if present) */
  signatureValid: boolean | null;
  /** Issues found during verification */
  issues: VerificationIssue[];
  /** Parsed manifest */
  manifest?: ProofBundleManifest;
  /** Summary statistics */
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warnings: number;
  };
}

export interface VerifyOptions {
  /** Secret for signature verification */
  signSecret?: string;
  /** Skip file completeness check */
  skipFileCheck?: boolean;
  /** Skip signature verification */
  skipSignatureCheck?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

// ============================================================================
// Verifier Implementation
// ============================================================================

/**
 * Verify a proof bundle from a directory path
 */
export async function verifyProofBundle(
  bundlePath: string,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // Load manifest
  const manifestPath = path.join(bundlePath, 'manifest.json');
  let manifest: ProofBundleManifest;

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
    totalChecks++;
    passedChecks++;
  } catch (err) {
    issues.push({
      severity: 'error',
      code: 'MANIFEST_MISSING',
      message: 'Failed to read manifest.json',
      details: err instanceof Error ? err.message : String(err),
    });
    return {
      valid: false,
      verdict: 'UNPROVEN',
      complete: false,
      signatureValid: null,
      issues,
      summary: { totalChecks: 1, passedChecks: 0, failedChecks: 1, warnings: 0 },
    };
  }

  // Check schema version
  totalChecks++;
  if (manifest.schemaVersion !== '2.0.0') {
    if (manifest.schemaVersion?.startsWith('1.')) {
      issues.push({
        severity: 'warning',
        code: 'SCHEMA_VERSION_OLD',
        message: `Schema version ${manifest.schemaVersion} is outdated, expected 2.0.0`,
        details: 'Bundle may be missing new fields',
      });
      passedChecks++;
    } else {
      issues.push({
        severity: 'error',
        code: 'SCHEMA_VERSION_INVALID',
        message: `Unsupported schema version: ${manifest.schemaVersion}`,
      });
    }
  } else {
    passedChecks++;
  }

  // Verify bundle ID integrity
  totalChecks++;
  const expectedBundleId = calculateBundleId({
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    spec: manifest.spec,
    policyVersion: manifest.policyVersion,
    gateResult: manifest.gateResult,
    buildResult: manifest.buildResult,
    testResult: manifest.testResult,
    testDeclaration: manifest.testDeclaration,
    iterations: manifest.iterations,
    verdict: manifest.verdict,
    verdictReason: manifest.verdictReason,
    files: manifest.files,
    project: manifest.project,
  });

  if (manifest.bundleId !== expectedBundleId) {
    issues.push({
      severity: 'error',
      code: 'BUNDLE_ID_MISMATCH',
      message: 'Bundle ID does not match content hash',
      details: `Expected: ${expectedBundleId}, Got: ${manifest.bundleId}`,
    });
  } else {
    passedChecks++;
  }

  // Verify verdict calculation
  totalChecks++;
  const { verdict: expectedVerdict, reason: expectedReason } = calculateVerdict(
    manifest.gateResult,
    manifest.buildResult,
    manifest.testResult,
    manifest.testDeclaration
  );

  if (manifest.verdict !== expectedVerdict) {
    issues.push({
      severity: 'error',
      code: 'VERDICT_MISMATCH',
      message: `Verdict mismatch: manifest says ${manifest.verdict}, but should be ${expectedVerdict}`,
      details: expectedReason,
    });
  } else {
    passedChecks++;
  }

  // Verify spec hash
  totalChecks++;
  const specPath = path.join(bundlePath, 'spec.isl');
  try {
    const specContent = await fs.readFile(specPath, 'utf-8');
    const computedHash = calculateSpecHash(specContent);
    
    if (manifest.spec.specHash !== computedHash) {
      issues.push({
        severity: 'error',
        code: 'SPEC_HASH_MISMATCH',
        message: 'Spec hash does not match content',
        details: `Expected: ${manifest.spec.specHash}, Got: ${computedHash}`,
      });
    } else {
      passedChecks++;
    }
  } catch {
    issues.push({
      severity: 'warning',
      code: 'SPEC_FILE_MISSING',
      message: 'spec.isl file not found in bundle',
    });
  }

  // Check file completeness
  let complete = true;
  if (!options.skipFileCheck) {
    for (const file of manifest.files) {
      totalChecks++;
      const filePath = path.join(bundlePath, file);
      try {
        await fs.access(filePath);
        passedChecks++;
      } catch {
        complete = false;
        issues.push({
          severity: 'error',
          code: 'FILE_MISSING',
          message: `File listed in manifest is missing: ${file}`,
        });
      }
    }
  }

  // Verify signature
  let signatureValid: boolean | null = null;
  if (manifest.signature && !options.skipSignatureCheck) {
    totalChecks++;
    if (options.signSecret) {
      const sigResult = verifyManifestSignature(manifest, options.signSecret);
      signatureValid = sigResult.valid;
      if (sigResult.valid) {
        passedChecks++;
      } else {
        issues.push({
          severity: 'error',
          code: 'SIGNATURE_INVALID',
          message: 'Signature verification failed',
          details: sigResult.error,
        });
      }
    } else {
      issues.push({
        severity: 'warning',
        code: 'SIGNATURE_NOT_VERIFIED',
        message: 'Bundle is signed but no secret provided for verification',
      });
      passedChecks++;
    }
  }

  // Check for INCOMPLETE_PROOF specific issues
  if (manifest.verdict === 'INCOMPLETE_PROOF') {
    issues.push({
      severity: 'warning',
      code: 'INCOMPLETE_PROOF',
      message: 'Proof is incomplete: tests required but none found',
      details: 'Add tests or declare noTestsRequired in the domain spec',
    });
  }

  // Additional consistency checks
  totalChecks++;
  if (manifest.gateResult.verdict === 'SHIP' && manifest.verdict === 'VIOLATED') {
    // This shouldn't happen - investigate
    issues.push({
      severity: 'warning',
      code: 'VERDICT_INCONSISTENCY',
      message: 'Gate passed but overall verdict is VIOLATED',
      details: 'Check build or test results',
    });
  } else {
    passedChecks++;
  }

  // Check iteration continuity
  if (manifest.iterations.length > 0) {
    totalChecks++;
    let iterationsValid = true;
    for (let i = 0; i < manifest.iterations.length; i++) {
      if (manifest.iterations[i].iteration !== i + 1) {
        iterationsValid = false;
        issues.push({
          severity: 'warning',
          code: 'ITERATION_GAP',
          message: `Iteration sequence gap at position ${i}`,
          details: `Expected iteration ${i + 1}, got ${manifest.iterations[i].iteration}`,
        });
      }
    }
    if (iterationsValid) {
      passedChecks++;
    }
  }

  const failedChecks = totalChecks - passedChecks;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const errors = issues.filter(i => i.severity === 'error').length;

  return {
    valid: errors === 0,
    verdict: manifest.verdict,
    complete,
    signatureValid,
    issues,
    manifest,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks,
      warnings,
    },
  };
}

/**
 * Format verification result for terminal output
 */
export function formatVerificationResult(result: VerificationResult): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push(' Proof Bundle Verification');
  lines.push('═'.repeat(60));
  lines.push('');

  // Status
  const statusIcon = result.valid ? '✓' : '✗';
  const statusColor = result.valid ? 'VALID' : 'INVALID';
  lines.push(`Status: ${statusIcon} ${statusColor}`);
  lines.push(`Verdict: ${result.verdict}`);
  lines.push(`Complete: ${result.complete ? 'Yes' : 'No'}`);
  
  if (result.signatureValid !== null) {
    lines.push(`Signature: ${result.signatureValid ? 'Valid' : 'Invalid'}`);
  }
  lines.push('');

  // Summary
  lines.push('─'.repeat(60));
  lines.push(` Checks: ${result.summary.passedChecks}/${result.summary.totalChecks} passed`);
  if (result.summary.warnings > 0) {
    lines.push(` Warnings: ${result.summary.warnings}`);
  }
  lines.push('─'.repeat(60));
  lines.push('');

  // Issues
  if (result.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      lines.push(`  ${icon} [${issue.code}] ${issue.message}`);
      if (issue.details) {
        lines.push(`    ${issue.details}`);
      }
    }
    lines.push('');
  }

  // Manifest info (if available)
  if (result.manifest) {
    lines.push('Bundle Info:');
    lines.push(`  ID: ${result.manifest.bundleId}`);
    lines.push(`  Domain: ${result.manifest.spec.domain} v${result.manifest.spec.version}`);
    lines.push(`  Generated: ${result.manifest.generatedAt}`);
    lines.push(`  Gate: ${result.manifest.gateResult.verdict} (score: ${result.manifest.gateResult.score})`);
    lines.push(`  Build: ${result.manifest.buildResult.status}`);
    lines.push(`  Tests: ${result.manifest.testResult.passedTests}/${result.manifest.testResult.totalTests}`);
    if (result.manifest.iterations.length > 0) {
      lines.push(`  Iterations: ${result.manifest.iterations.length}`);
    }
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

/**
 * Quick check if a bundle is valid (returns boolean)
 */
export async function isValidBundle(bundlePath: string): Promise<boolean> {
  try {
    const result = await verifyProofBundle(bundlePath, { skipFileCheck: true });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Check if a bundle verdict is "proven enough" based on requirements
 */
export function isProvenEnough(
  verdict: ProofVerdict,
  options: { allowIncomplete?: boolean } = {}
): boolean {
  if (verdict === 'PROVEN') return true;
  if (verdict === 'INCOMPLETE_PROOF' && options.allowIncomplete) return true;
  return false;
}
