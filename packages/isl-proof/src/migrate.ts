/**
 * ISL Proof Bundle Migration Tool
 * 
 * Migrates proof bundles from v1 to v2 format.
 * 
 * V2 format includes fail-closed verification fields:
 * - importGraphHash, importGraph
 * - stdlibVersions
 * - verifyResults
 * - traceRefs
 * - testsSummary
 * 
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ProofBundleManifest,
  BuildResult,
  TestResult,
  ManifestGateResult,
  VerificationEvaluationResult,
  ImportGraph,
  StdlibVersion,
  VerifyResults,
  TraceRef,
  TestsSummary,
} from './manifest.js';
import {
  calculateBundleId,
  calculateSpecHash,
  calculateVerdictV2,
  signManifest,
} from './manifest.js';
import type { ProofBundle as ProofBundleV1 } from './proof-bundle.js';

// ============================================================================
// Migration Types
// ============================================================================

export interface MigrationOptions {
  /** Output directory for migrated bundle */
  outputDir?: string;
  /** Sign the migrated bundle with this secret */
  signSecret?: string;
  /** Key ID for signature */
  signKeyId?: string;
  /** ISL Studio version */
  islStudioVersion?: string;
  /** Mark as incomplete proof (v1 bundles lack v2 verification data) */
  markIncomplete?: boolean;
  /** Include placeholder v2 fields */
  includePlaceholderV2Fields?: boolean;
}

export interface MigrationResult {
  /** Success status */
  success: boolean;
  /** Path to migrated bundle */
  bundlePath?: string;
  /** Bundle ID of migrated bundle */
  bundleId?: string;
  /** Final verdict after migration */
  verdict?: string;
  /** Errors encountered */
  errors: string[];
  /** Warnings */
  warnings: string[];
  /** Fields that need manual update for PROVEN status */
  missingForProven: string[];
}

// ============================================================================
// Migration Implementation
// ============================================================================

/**
 * Migrate a v1 proof bundle to v2 format
 */
export async function migrateV1ToV2(
  v1BundlePath: string,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Load v1 bundle
    const v1ManifestPath = path.join(v1BundlePath, 'bundle.json');
    let v1Bundle: ProofBundleV1 | null = null;

    try {
      const content = await fs.readFile(v1ManifestPath, 'utf-8');
      v1Bundle = JSON.parse(content);
    } catch (err) {
      // Try alternative locations
      const altPaths = [
        path.join(v1BundlePath, 'manifest.json'),
        path.join(v1BundlePath, 'proof-bundle.json'),
      ];
      
      let found = false;
      for (const altPath of altPaths) {
        try {
          const content = await fs.readFile(altPath, 'utf-8');
          v1Bundle = JSON.parse(content);
          found = true;
          break;
        } catch {
          // Try next
        }
      }

      if (!found || !v1Bundle) {
        return {
          success: false,
          errors: [`Could not find v1 bundle manifest: ${err instanceof Error ? err.message : String(err)}`],
          warnings: [],
          missingForProven: [],
        };
      }
    }

    if (!v1Bundle) {
      return {
        success: false,
        errors: [`Failed to load v1 bundle from ${v1BundlePath}`],
        warnings: [],
        missingForProven: [],
      };
    }

    // Validate v1 bundle
    if (v1Bundle.version !== '1.0.0') {
      return {
        success: false,
        errors: [`Unsupported bundle version: ${v1Bundle.version}. Expected 1.0.0`],
        warnings: [],
        missingForProven: [],
      };
    }

    // Read spec file if available
    let specContent = '';
    const specPaths = [
      path.join(v1BundlePath, 'spec.isl'),
      path.join(v1BundlePath, 'source.isl'),
      path.join(v1BundlePath, 'domain.isl'),
    ];

    for (const specPath of specPaths) {
      try {
        specContent = await fs.readFile(specPath, 'utf-8');
        break;
      } catch {
        // Try next
      }
    }

    if (!specContent) {
      warnings.push('Spec file not found, using placeholder');
      specContent = `domain ${v1Bundle.source.domain} version "${v1Bundle.source.version}" {}`;
    }

    const specHash = calculateSpecHash(specContent);

    // Convert gate evidence to manifest gate result
    const gateResult: ManifestGateResult = {
      verdict: v1Bundle.gate.verdict === 'SHIP' ? 'SHIP' : 'NO_SHIP',
      score: v1Bundle.gate.score,
      fingerprint: v1Bundle.gate.runId || `gate-${Date.now()}`,
      blockers: v1Bundle.gate.violations.filter(v => v.severity === 'critical' || v.severity === 'high').length,
      warnings: v1Bundle.gate.violations.filter(v => v.severity === 'low' || v.severity === 'medium').length,
      violations: v1Bundle.gate.violations.map(v => ({
        ruleId: v.ruleId,
        file: v.file,
        line: v.line,
        message: v.message,
        tier: v.severity === 'critical' || v.severity === 'high' ? 'hard_block' : 'warn',
      })),
      policyBundleVersion: '1.0.0', // Default for v1 bundles
      rulepackVersions: [],
      timestamp: v1Bundle.timestamp,
    };

    // Convert test evidence to test result
    const testResult: TestResult = {
      framework: 'unknown',
      frameworkVersion: 'unknown',
      status: v1Bundle.tests.length === 0 ? 'no_tests' : 
              v1Bundle.tests.some(t => t.result === 'fail') ? 'fail' : 'pass',
      totalTests: v1Bundle.tests.length,
      passedTests: v1Bundle.tests.filter(t => t.result === 'pass').length,
      failedTests: v1Bundle.tests.filter(t => t.result === 'fail').length,
      skippedTests: v1Bundle.tests.filter(t => t.result === 'skip').length,
      durationMs: v1Bundle.tests.reduce((sum, t) => sum + t.duration, 0),
      timestamp: v1Bundle.timestamp,
    };

    // Create default build result (v1 didn't have this)
    const buildResult: BuildResult = {
      tool: 'unknown',
      toolVersion: 'unknown',
      status: 'skipped',
      errorCount: 0,
      warningCount: 0,
      durationMs: 0,
      timestamp: v1Bundle.timestamp,
    };

    // Convert verification evaluation if evidence exists
    let verificationEvaluation: VerificationEvaluationResult | undefined;
    if (v1Bundle.evidence && v1Bundle.evidence.length > 0) {
      const satisfied = v1Bundle.evidence.filter(e => e.status === 'satisfied').length;
      const total = v1Bundle.evidence.length;
      const confidence = total > 0 ? satisfied / total : 0;

      verificationEvaluation = {
        status: v1Bundle.verdict === 'PROVEN' ? 'verified' :
                v1Bundle.verdict === 'VIOLATED' ? 'unsafe' : 'risky',
        score: Math.round(confidence * 100),
        coverage: {
          preconditions: v1Bundle.evidence.filter(e => e.clause.type === 'precondition').length / Math.max(total, 1) * 100,
          postconditions: v1Bundle.evidence.filter(e => e.clause.type === 'postcondition').length / Math.max(total, 1) * 100,
          invariants: v1Bundle.evidence.filter(e => e.clause.type === 'invariant').length / Math.max(total, 1) * 100,
          temporal: 0, // v1 didn't track temporal
        },
        behaviorsVerified: new Set(v1Bundle.evidence.map(e => e.clause.behavior)).size,
        totalBehaviors: new Set(v1Bundle.evidence.map(e => e.clause.behavior)).size,
        durationMs: 0, // v1 didn't track duration
        errors: v1Bundle.evidence
          .filter(e => e.status === 'unsatisfied')
          .map(e => ({
            behavior: e.clause.behavior,
            clause: e.clause.id,
            message: e.notes || 'Unsatisfied',
            severity: 'error' as const,
          })),
        timestamp: v1Bundle.timestamp,
      };
    }

    // Track missing v2 fields for PROVEN status
    const missingForProven: string[] = [];

    // V2 fields - v1 bundles don't have these, so mark as incomplete
    let importGraph: ImportGraph | undefined;
    let stdlibVersions: StdlibVersion[] | undefined;
    let verifyResults: VerifyResults | undefined;
    let traceRefs: TraceRef[] | undefined;
    let testsSummary: TestsSummary | undefined;

    if (options.includePlaceholderV2Fields) {
      // Create placeholder import graph (empty - will cause INCOMPLETE_PROOF)
      importGraph = {
        imports: [],
        graphHash: 'placeholder-v1-migration',
        allResolved: true, // Assume resolved if no imports
        unresolvedCount: 0,
      };
      
      // Placeholder verify results (marked as incomplete)
      verifyResults = {
        verdict: 'INCOMPLETE_PROOF',
        clauses: [],
        summary: {
          totalClauses: 0,
          provenClauses: 0,
          notProvenClauses: 0,
          unknownClauses: 0,
          violatedClauses: 0,
        },
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };

      // Placeholder tests summary
      testsSummary = {
        totalTests: testResult.totalTests,
        passedTests: testResult.passedTests,
        failedTests: testResult.failedTests,
        skippedTests: testResult.skippedTests,
        hasTests: testResult.totalTests > 0,
        framework: testResult.framework,
        frameworkVersion: testResult.frameworkVersion,
        timestamp: testResult.timestamp,
      };
    } else {
      missingForProven.push('importGraph');
      missingForProven.push('stdlibVersions');
      missingForProven.push('verifyResults');
      missingForProven.push('traceRefs');
    }

    warnings.push('V1 bundles lack v2 verification fields. Verdict may be INCOMPLETE_PROOF.');

    // Calculate verdict using v2 fail-closed rules
    const verdictResult = calculateVerdictV2({
      gateResult,
      buildResult,
      testResult,
      verifyResults,
      importGraph,
      stdlibVersions,
    });

    // If markIncomplete is set, force INCOMPLETE_PROOF for v1 bundles
    const finalVerdict = options.markIncomplete ? 'INCOMPLETE_PROOF' : verdictResult.verdict;
    const finalReason = options.markIncomplete 
      ? `Migrated from v1: ${verdictResult.reason}. Missing v2 verification data.`
      : verdictResult.reason;

    // Build v2 manifest
    const manifestBase: Omit<ProofBundleManifest, 'bundleId' | 'signature'> = {
      schemaVersion: '2.0.0',
      generatedAt: new Date().toISOString(),
      spec: {
        domain: v1Bundle.source.domain,
        version: v1Bundle.source.version,
        specHash,
      },
      policyVersion: {
        bundleVersion: '1.0.0',
        islStudioVersion: options.islStudioVersion || '0.1.0',
        packs: [],
      },
      // V2 fields
      importGraphHash: importGraph?.graphHash,
      importGraph,
      stdlibVersions,
      verifyResults,
      traceRefs,
      testsSummary,
      // Original fields
      gateResult,
      buildResult,
      testResult,
      verificationEvaluation,
      iterations: [], // v1 didn't have iterations
      verdict: finalVerdict,
      verdictReason: finalReason,
      files: [],
      project: {
        root: path.dirname(v1BundlePath),
      },
    };

    // Calculate bundle ID
    const bundleId = calculateBundleId(manifestBase);

    let manifest: ProofBundleManifest = {
      ...manifestBase,
      bundleId,
    };

    // Sign if secret provided
    if (options.signSecret) {
      manifest = signManifest(manifest, options.signSecret, options.signKeyId);
    }

    // Create output directory
    const outputDir = options.outputDir || path.join(path.dirname(v1BundlePath), 'migrated');
    const bundleDir = path.join(
      outputDir,
      `proof-v2-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`
    );
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'results'), { recursive: true });

    // Write manifest
    await fs.writeFile(
      path.join(bundleDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    manifest.files.push('manifest.json');

    // Write spec
    await fs.writeFile(path.join(bundleDir, 'spec.isl'), specContent);
    manifest.files.push('spec.isl');

    // Write results
    await fs.writeFile(
      path.join(bundleDir, 'results', 'gate.json'),
      JSON.stringify(gateResult, null, 2)
    );
    manifest.files.push('results/gate.json');

    await fs.writeFile(
      path.join(bundleDir, 'results', 'build.json'),
      JSON.stringify(buildResult, null, 2)
    );
    manifest.files.push('results/build.json');

    await fs.writeFile(
      path.join(bundleDir, 'results', 'tests.json'),
      JSON.stringify(testResult, null, 2)
    );
    manifest.files.push('results/tests.json');

    if (verificationEvaluation) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'verification.json'),
        JSON.stringify(verificationEvaluation, null, 2)
      );
      manifest.files.push('results/verification.json');
    }

    // Update manifest with file list and recalculate bundle ID
    const finalManifest: ProofBundleManifest = {
      ...manifest,
      files: manifest.files,
    };
    const finalBundleId = calculateBundleId(finalManifest);
    finalManifest.bundleId = finalBundleId;

    // Re-sign if needed
    let finalManifestSigned = finalManifest;
    if (options.signSecret) {
      finalManifestSigned = signManifest(finalManifest, options.signSecret, options.signKeyId);
    }

    // Write final manifest
    await fs.writeFile(
      path.join(bundleDir, 'manifest.json'),
      JSON.stringify(finalManifestSigned, null, 2)
    );

    return {
      success: true,
      bundlePath: bundleDir,
      bundleId: finalBundleId,
      verdict: finalManifestSigned.verdict,
      errors: [],
      warnings,
      missingForProven,
    };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings,
      missingForProven: [],
    };
  }
}
