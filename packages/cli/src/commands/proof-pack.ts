/**
 * Proof Pack Command
 * 
 * Pack artifacts into a deterministic, hashable, verifiable proof bundle.
 * 
 * Usage:
 *   shipgate proof pack --spec <file> --evidence <dir> --output <dir>
 *   shipgate proof pack --spec <file> --evidence <dir> --output <dir> --sign-secret <secret>
 */

import { existsSync, readFileSync } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, relative, basename } from 'path';
import chalk from 'chalk';
import {
  createBundle,
  serializeBundle,
  bundleHash,
  type CreateBundleInput,
  type BundleClaim,
  type BundleVerdictArtifact,
  type BundleTraceRef,
  type BundleEvidence,
  type ProofBundleV1,
  canonicalJsonStringify,
  calculateSpecHash,
} from '@isl-lang/proof';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput, isQuietOutput } from '../output.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofPackOptions {
  /** ISL spec file path */
  spec: string;
  /** Evidence directory (contains results.json, manifest.json, traces, etc.) */
  evidence?: string;
  /** Output directory for the proof bundle */
  output: string;
  /** HMAC secret for signing the bundle */
  signSecret?: string;
  /** Fixed timestamp for determinism (ISO 8601). Defaults to now. */
  timestamp?: string;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
}

export interface ProofPackResult {
  success: boolean;
  bundlePath: string;
  bundleHash: string;
  verdict: string;
  verdictReason: string;
  claimCount: number;
  signed: boolean;
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pack artifacts into a proof bundle
 */
export async function proofPack(options: ProofPackOptions): Promise<ProofPackResult> {
  const errors: string[] = [];

  try {
    // Resolve paths
    const specPath = resolve(options.spec);
    const outputDir = resolve(options.output);
    const evidenceDir = options.evidence ? resolve(options.evidence) : undefined;

    // Validate spec file
    if (!existsSync(specPath)) {
      errors.push(`Spec file not found: ${options.spec}`);
      return makeErrorResult(outputDir, errors);
    }

    const specContent = readFileSync(specPath, 'utf-8');
    const specHash = calculateSpecHash(specContent);

    // Extract domain/version from spec (simple heuristic)
    const { domain, version } = extractSpecMeta(specContent, specPath);

    // Load evidence artifacts
    const verdicts: BundleVerdictArtifact[] = [];
    const claims: BundleClaim[] = [];
    const traces: BundleTraceRef[] = [];
    const evidence: BundleEvidence[] = [];

    if (evidenceDir && existsSync(evidenceDir)) {
      loadEvidenceArtifacts(evidenceDir, { verdicts, claims, traces, evidence, errors });
    }

    // Determine timestamp
    const createdAt = options.timestamp || new Date().toISOString();

    // Create the bundle
    const input: CreateBundleInput = {
      spec: {
        domain,
        version,
        specHash,
        specPath: relative(outputDir, specPath),
      },
      verdicts,
      claims,
      traces,
      evidence,
      createdAt,
      signSecret: options.signSecret,
    };

    const bundle = createBundle(input);

    // Write output
    mkdirSync(outputDir, { recursive: true });

    const bundleJsonPath = resolve(outputDir, 'proof-bundle.json');
    writeFileSync(bundleJsonPath, serializeBundle(bundle), 'utf-8');

    // Copy spec into bundle dir
    const specCopyPath = resolve(outputDir, 'spec.isl');
    writeFileSync(specCopyPath, specContent, 'utf-8');

    return {
      success: true,
      bundlePath: bundleJsonPath,
      bundleHash: bundle.bundleHash,
      verdict: bundle.verdict,
      verdictReason: bundle.verdictReason,
      claimCount: bundle.claims.length,
      signed: !!bundle.signature,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    return makeErrorResult(resolve(options.output), errors);
  }
}

/**
 * Print proof pack result
 */
export function printProofPackResult(result: ProofPackResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const isJson = options.format === 'json' || isJsonOutput();
  const isQuiet = options.format === 'quiet' || isQuietOutput();

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (isQuiet) {
    if (result.success) {
      console.log(result.bundleHash);
    }
    return;
  }

  console.log('');
  console.log(chalk.bold('  Proof Bundle Pack'));
  console.log('  ' + '─'.repeat(50));

  if (result.success) {
    console.log(chalk.green('  ✓ Bundle created successfully'));
    console.log('');
    console.log(`  ${chalk.gray('Path:')}     ${result.bundlePath}`);
    console.log(`  ${chalk.gray('Hash:')}     ${result.bundleHash.slice(0, 16)}...`);
    console.log(`  ${chalk.gray('Verdict:')}  ${formatVerdict(result.verdict)}`);
    console.log(`  ${chalk.gray('Reason:')}   ${result.verdictReason}`);
    console.log(`  ${chalk.gray('Claims:')}   ${result.claimCount}`);
    console.log(`  ${chalk.gray('Signed:')}   ${result.signed ? chalk.green('yes') : chalk.gray('no')}`);
  } else {
    console.log(chalk.red('  ✗ Failed to create bundle'));
    if (result.errors) {
      for (const err of result.errors) {
        console.log(chalk.red(`    • ${err}`));
      }
    }
  }
  console.log('');
}

/**
 * Get exit code for proof pack result
 */
export function getProofPackExitCode(result: ProofPackResult): number {
  return result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeErrorResult(outputDir: string, errors: string[]): ProofPackResult {
  return {
    success: false,
    bundlePath: resolve(outputDir, 'proof-bundle.json'),
    bundleHash: '',
    verdict: 'UNPROVEN',
    verdictReason: 'Bundle creation failed',
    claimCount: 0,
    signed: false,
    errors,
  };
}

function extractSpecMeta(specContent: string, specPath: string): { domain: string; version: string } {
  // Try to parse domain name from spec content
  const domainMatch = specContent.match(/domain\s+(\w[\w\-]*)/);
  const versionMatch = specContent.match(/version\s+["']?([^"'\s]+)["']?/);

  return {
    domain: domainMatch?.[1] || basename(specPath, '.isl'),
    version: versionMatch?.[1] || '0.1.0',
  };
}

function loadEvidenceArtifacts(
  evidenceDir: string,
  ctx: {
    verdicts: BundleVerdictArtifact[];
    claims: BundleClaim[];
    traces: BundleTraceRef[];
    evidence: BundleEvidence[];
    errors: string[];
  },
): void {
  // Load results.json
  const resultsPath = resolve(evidenceDir, 'results.json');
  if (existsSync(resultsPath)) {
    try {
      const results = JSON.parse(readFileSync(resultsPath, 'utf-8'));

      // Extract gate verdict
      if (results.decision) {
        ctx.verdicts.push({
          phase: 'gate',
          verdict: results.decision === 'SHIP' ? 'SHIP' : 'NO_SHIP',
          score: results.trustScore ?? 0,
          details: {
            trustScore: results.trustScore,
            confidence: results.confidence,
            blockers: results.blockers ?? [],
          },
          timestamp: results.timestamp || new Date().toISOString(),
        });
      }

      // Extract clauses as claims
      if (Array.isArray(results.clauses)) {
        for (const clause of results.clauses) {
          ctx.claims.push({
            clauseId: clause.id || `clause-${ctx.claims.length}`,
            clauseType: mapClauseType(clause.type),
            status: mapClauseStatus(clause.status),
            reason: clause.error || clause.description,
          });

          ctx.evidence.push({
            clauseId: clause.id || `clause-${ctx.evidence.length}`,
            evidenceType: 'test',
            satisfied: clause.status === 'passed',
            confidence: clause.status === 'passed' ? 1.0 : clause.status === 'skipped' ? 0.0 : 0.0,
          });
        }
      }
    } catch (err) {
      ctx.errors.push(`Failed to load results.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Load manifest.json
  const manifestPath = resolve(evidenceDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      // Add build verdict if present
      if (manifest.buildResult) {
        ctx.verdicts.push({
          phase: 'build',
          verdict: manifest.buildResult.status || 'pass',
          details: manifest.buildResult,
          timestamp: manifest.buildResult.timestamp || manifest.timestamp || new Date().toISOString(),
        });
      }

      // Add test verdict if present
      if (manifest.testResult) {
        ctx.verdicts.push({
          phase: 'test',
          verdict: manifest.testResult.status || 'pass',
          score: manifest.testResult.passedTests ?? 0,
          details: {
            totalTests: manifest.testResult.totalTests ?? 0,
            passedTests: manifest.testResult.passedTests ?? 0,
            failedTests: manifest.testResult.failedTests ?? 0,
          },
          timestamp: manifest.testResult.timestamp || manifest.timestamp || new Date().toISOString(),
        });
      }
    } catch (err) {
      ctx.errors.push(`Failed to load manifest.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Load trace files (traces/*.json)
  const tracesDir = resolve(evidenceDir, 'traces');
  if (existsSync(tracesDir)) {
    try {
      const { readdirSync } = require('fs');
      const files: string[] = readdirSync(tracesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const trace = JSON.parse(readFileSync(resolve(tracesDir, file), 'utf-8'));
            ctx.traces.push({
              traceId: trace.id || basename(file, '.json'),
              behavior: trace.behavior || 'unknown',
              testName: trace.testName || file,
              tracePath: `traces/${file}`,
              eventCount: Array.isArray(trace.events) ? trace.events.length : 0,
            });
          } catch {
            // Skip invalid trace files
          }
        }
      }
    } catch {
      // Traces directory not readable
    }
  }
}

function mapClauseType(type: string | undefined): BundleClaim['clauseType'] {
  switch (type) {
    case 'precondition': return 'precondition';
    case 'postcondition': return 'postcondition';
    case 'invariant': return 'invariant';
    default: return 'intent';
  }
}

function mapClauseStatus(status: string | undefined): BundleClaim['status'] {
  switch (status) {
    case 'passed': return 'proven';
    case 'failed': return 'violated';
    case 'skipped': return 'unknown';
    default: return 'unknown';
  }
}

function formatVerdict(verdict: string): string {
  switch (verdict) {
    case 'PROVEN': return chalk.green('PROVEN');
    case 'INCOMPLETE_PROOF': return chalk.yellow('INCOMPLETE_PROOF');
    case 'VIOLATED': return chalk.red('VIOLATED');
    case 'UNPROVEN': return chalk.gray('UNPROVEN');
    default: return verdict;
  }
}
