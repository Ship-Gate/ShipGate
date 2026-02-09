/**
 * ISL Gate Command
 * 
 * SHIP/NO-SHIP decision maker with evidence bundle.
 * 
 * Usage:
 *   isl gate <spec> --impl <file>           # Gate implementation against spec
 *   isl gate <spec> --impl <file> --threshold 90   # Custom threshold
 *   isl gate <spec> --impl <file> --ci      # CI mode (exit code only)
 */

import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { withSpan, ISL_ATTR } from '@isl-lang/observability';
import { checkPolicyAgainstGate } from './policy-check.js';

// Types
export interface GateOptions {
  impl: string;
  threshold?: number;
  output?: string;
  ci?: boolean;
  verbose?: boolean;
  format?: 'pretty' | 'json' | 'quiet';
  skipPolicy?: boolean;
  policyFile?: string;
  policyProfile?: 'strict' | 'standard' | 'lenient';
}

export interface GateResult {
  decision: 'SHIP' | 'NO-SHIP';
  exitCode: 0 | 1;
  trustScore: number;
  confidence: number;
  summary: string;
  bundlePath?: string;
  manifest?: {
    fingerprint: string;
    specHash: string;
    implHash: string;
    timestamp: string;
  };
  results?: {
    clauses: Array<{
      id: string;
      type: string;
      description: string;
      status: 'passed' | 'failed' | 'skipped';
      error?: string;
    }>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
    };
    blockers: Array<{
      clause: string;
      reason: string;
      severity: string;
    }>;
  };
  error?: string;
  suggestion?: string;
}

/**
 * Run the gate command
 */
export async function gate(specPath: string, options: GateOptions): Promise<GateResult> {
  return await withSpan('cli.gate', {
    attributes: {
      [ISL_ATTR.COMMAND]: 'gate',
      [ISL_ATTR.SPEC_FILE]: specPath,
      [ISL_ATTR.IMPL_FILE]: options.impl,
    },
  }, async (gateSpan) => {
    const {
      impl,
      threshold = 95,
      output,
      verbose = false,
    } = options;

    gateSpan.setAttribute('isl.gate.threshold', threshold);

    try {
      // Read spec file
      if (!existsSync(specPath)) {
        gateSpan.setError('Spec file not found');
        return {
          decision: 'NO-SHIP',
          exitCode: 1,
          trustScore: 0,
          confidence: 0,
          summary: `Spec file not found: ${specPath}`,
          error: 'SPEC_NOT_FOUND',
        };
      }

      const specSource = await readFile(specPath, 'utf-8');

      // Read implementation file
      if (!existsSync(impl)) {
        gateSpan.setError('Implementation file not found');
        return {
          decision: 'NO-SHIP',
          exitCode: 1,
          trustScore: 0,
          confidence: 0,
          summary: `Implementation file not found: ${impl}`,
          error: 'IMPL_NOT_FOUND',
        };
      }

      let implSource: string;
      const implStats = await stat(impl);
      
      if (implStats.isDirectory()) {
        // Read all .ts/.js files in directory
        const { readdir } = await import('fs/promises');
        const entries = await readdir(impl, { withFileTypes: true });
        const files: string[] = [];
        
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
            if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.endsWith('.d.ts')) {
              continue;
            }
            const content = await readFile(join(impl, entry.name), 'utf-8');
            files.push(`// === ${entry.name} ===\n${content}`);
          }
        }
        implSource = files.join('\n\n');
      } else {
        implSource = await readFile(impl, 'utf-8');
      }

      // Run local gate implementation
      const result = await runLocalGate(specSource, implSource, threshold, output, gateSpan);
      
      // Run policy checks if not skipped
      if (!options.skipPolicy) {
        try {
          const policyResult = await checkPolicyAgainstGate(result, {
            directory: process.cwd(),
            policyFile: options.policyFile,
            profile: options.policyProfile,
            verbose: verbose,
          });

          // If policy check failed, override decision to NO-SHIP
          if (!policyResult.passed) {
            const policyViolations = policyResult.violations.filter(v => v.severity === 'error');
            if (policyViolations.length > 0) {
              result.decision = 'NO-SHIP';
              result.exitCode = 1;
              result.summary = `NO-SHIP: Policy violation - ${policyViolations.map(v => v.message).join('; ')}`;
              result.error = 'POLICY_VIOLATION';
              result.suggestion = `Fix policy violations: ${policyViolations.map(v => v.rule).join(', ')}`;
              
              // Add policy violations to blockers
              if (!result.results) {
                result.results = {
                  clauses: [],
                  summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
                  blockers: [],
                };
              }
              result.results.blockers.push(...policyViolations.map(v => ({
                clause: v.rule,
                reason: v.message,
                severity: v.severity === 'error' ? 'critical' : 'high',
              })));
            }
          }
        } catch (policyError) {
          // If policy check fails to load, log but don't fail gate
          if (verbose) {
            console.warn(chalk.yellow(`Warning: Policy check failed: ${policyError instanceof Error ? policyError.message : String(policyError)}`));
          }
        }
      }
      
      // Set span attributes from result
      gateSpan.setAttribute(ISL_ATTR.VERIFY_VERDICT, result.decision);
      gateSpan.setAttribute(ISL_ATTR.VERIFY_SCORE, result.trustScore);
      gateSpan.setAttribute(ISL_ATTR.EXIT_CODE, result.exitCode);
      if (result.error) {
        gateSpan.setAttribute(ISL_ATTR.ERROR_TYPE, result.error);
      }
      
      return result;
    } catch (error) {
      gateSpan.setError(error instanceof Error ? error.message : String(error));
      return {
        decision: 'NO-SHIP',
        exitCode: 1,
        trustScore: 0,
        confidence: 0,
        summary: `Gate error: ${error instanceof Error ? error.message : String(error)}`,
        error: 'INTERNAL_ERROR',
      };
    }
  });
}

/**
 * Local gate implementation (fallback if MCP server not available)
 */
async function runLocalGate(
  specSource: string,
  implSource: string,
  threshold: number,
  outputDir?: string
): Promise<GateResult> {
  const { createHash } = await import('crypto');
  const { mkdir, writeFile } = await import('fs/promises');
  
  // Hash inputs for fingerprinting
  const hashContent = (content: string) => 
    createHash('sha256').update(content, 'utf-8').digest('hex');
  
  const specHash = hashContent(specSource);
  const implHash = hashContent(implSource);

  // Try to import core packages
  let parseFn: typeof import('@isl-lang/parser').parse;
  let checkFn: typeof import('@isl-lang/typechecker').check;
  let verifyFn: typeof import('@isl-lang/isl-verify').verify;

  try {
    const parser = await import('@isl-lang/parser');
    const typechecker = await import('@isl-lang/typechecker');
    const verifier = await import('@isl-lang/isl-verify');
    
    parseFn = parser.parse;
    checkFn = typechecker.check;
    verifyFn = verifier.verify;
  } catch (error) {
    return {
      decision: 'NO-SHIP',
      exitCode: 1,
      trustScore: 0,
      confidence: 0,
      summary: 'Required ISL packages not available',
      error: 'MISSING_PACKAGES',
      suggestion: 'Install @isl-lang/parser, @isl-lang/typechecker, @isl-lang/isl-verify',
    };
  }

  // Parse spec
  const parseResult = await withSpan('gate.parse', {
    attributes: { [ISL_ATTR.COMMAND]: 'parse' },
  }, async (parseSpan) => {
    const result = parseFn(specSource, 'spec.isl');
    parseSpan.setAttribute('isl.parse.error_count', result.errors?.length ?? 0);
    if (!result.success || result.errors?.length) {
      parseSpan.setError(result.errors?.map(e => e.message).join('; ') ?? 'Parse failed');
    }
    return result;
  });
  
  if (!parseResult.success || !parseResult.domain) {
    const errors = parseResult.errors?.map(e => e.message).join('; ') ?? 'Parse failed';
    return {
      decision: 'NO-SHIP',
      exitCode: 1,
      trustScore: 0,
      confidence: 100,
      summary: `NO-SHIP: Spec parse error - ${errors}`,
      error: 'PARSE_ERROR',
    };
  }

  // Type check
  const typeResult = await withSpan('gate.check', {
    attributes: { [ISL_ATTR.COMMAND]: 'check' },
  }, async (checkSpan) => {
    const result = checkFn(parseResult.domain);
    const errorCount = result.diagnostics.filter(d => d.severity === 'error').length;
    checkSpan.setAttribute('isl.check.error_count', errorCount);
    if (errorCount > 0) {
      checkSpan.setError(`${errorCount} type errors`);
    }
    return result;
  });
  
  const typeErrors = typeResult.diagnostics.filter(d => d.severity === 'error');
  
  if (typeErrors.length > 0) {
    const errors = typeErrors.map(e => e.message).join('; ');
    return {
      decision: 'NO-SHIP',
      exitCode: 1,
      trustScore: 0,
      confidence: 100,
      summary: `NO-SHIP: Spec type error - ${errors}`,
      error: 'TYPE_ERROR',
    };
  }

  // Run verification
  let verifyResult;
  try {
    verifyResult = await withSpan('gate.verify', {
      attributes: { [ISL_ATTR.COMMAND]: 'verify' },
    }, async (verifySpan) => {
      const result = await verifyFn(parseResult.domain, implSource, {
        runner: { framework: 'vitest' },
      });
      verifySpan.setAttribute(ISL_ATTR.VERIFY_SCORE, result.trustScore.overall);
      verifySpan.setAttribute('isl.verify.passed', result.testResult.passed);
      verifySpan.setAttribute('isl.verify.failed', result.testResult.failed);
      return result;
    });
  } catch (error) {
    return {
      decision: 'NO-SHIP',
      exitCode: 1,
      trustScore: 0,
      confidence: 50,
      summary: `NO-SHIP: Verification error - ${error instanceof Error ? error.message : 'unknown'}`,
      error: 'VERIFICATION_ERROR',
    };
  }

  // Calculate results
  const trustScore = verifyResult.trustScore.overall;
  const confidence = verifyResult.trustScore.confidence;
  const passed = verifyResult.testResult.passed;
  const failed = verifyResult.testResult.failed;
  const skipped = verifyResult.testResult.skipped;
  const total = passed + failed + skipped;

  // Build clause results
  const clauses = verifyResult.trustScore.details.map(detail => ({
    id: `${detail.category}-${detail.name}`.replace(/\s+/g, '-').toLowerCase(),
    type: detail.category,
    description: detail.name,
    status: detail.status as 'passed' | 'failed' | 'skipped',
    error: detail.message,
  }));

  const blockers = verifyResult.trustScore.details
    .filter(d => d.status === 'failed')
    .map(d => ({
      clause: d.name,
      reason: d.message ?? 'Verification failed',
      severity: d.impact === 'critical' ? 'critical' : d.impact === 'high' ? 'high' : 'medium',
    }));

  // Make decision
  // POLICY FIX: Block SHIP when confidence is too low (< 20%) to prevent
  // shipping with insufficient evidence, even if trust score is high
  const MIN_CONFIDENCE_FOR_SHIP = 20;
  
  let decision: 'SHIP' | 'NO-SHIP';
  let summary: string;

  if (failed > 0) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: ${failed} verification${failed > 1 ? 's' : ''} failed. Trust score: ${trustScore}%`;
  } else if (trustScore < threshold) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: Trust score ${trustScore}% below threshold ${threshold}%`;
  } else if (confidence < MIN_CONFIDENCE_FOR_SHIP) {
    // New policy: require minimum confidence to SHIP
    decision = 'NO-SHIP';
    summary = `NO-SHIP: Confidence ${confidence}% below minimum ${MIN_CONFIDENCE_FOR_SHIP}%. Need more evidence (${total} tests run, need at least 2).`;
  } else if (total === 0) {
    // New policy: cannot SHIP with zero tests
    decision = 'NO-SHIP';
    summary = `NO-SHIP: No tests executed. Cannot verify implementation without evidence.`;
  } else {
    decision = 'SHIP';
    summary = `SHIP: All ${passed} verifications passed. Trust score: ${trustScore}%, Confidence: ${confidence}%`;
  }

  // Generate fingerprint
  const resultsStr = JSON.stringify({ trustScore, passed, failed, skipped, clauses });
  const resultsHash = hashContent(resultsStr);
  const fingerprint = hashContent(`${specHash}:${implHash}:${resultsHash}:0.1.0`).slice(0, 16);

  // Write evidence bundle if output specified
  let bundlePath: string | undefined;
  if (outputDir) {
    const evidenceDir = join(outputDir, 'evidence');
    await mkdir(evidenceDir, { recursive: true });
    await mkdir(join(evidenceDir, 'artifacts'), { recursive: true });

    // Write manifest
    const manifest = {
      fingerprint,
      islVersion: '0.1.0',
      specHash,
      implHash,
      timestamp: new Date().toISOString(),
      inputs: { spec: specHash, implementation: implHash },
    };
    await writeFile(join(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Write results
    const results = {
      decision,
      trustScore,
      confidence,
      clauses,
      summary: { total, passed, failed, skipped },
      blockers,
    };
    await writeFile(join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));

    // Write spec
    await writeFile(join(evidenceDir, 'artifacts', 'spec.isl'), specSource);

    bundlePath = 'evidence/';
  }

  return {
    decision,
    exitCode: decision === 'SHIP' ? 0 : 1,
    trustScore,
    confidence,
    summary,
    bundlePath,
    manifest: {
      fingerprint,
      specHash,
      implHash,
      timestamp: new Date().toISOString(),
    },
    results: {
      clauses,
      summary: { total, passed, failed, skipped },
      blockers,
    },
    suggestion: decision === 'NO-SHIP' && blockers.length > 0
      ? `Fix the ${blockers.length} blocking issue${blockers.length > 1 ? 's' : ''}: ${blockers.map(b => b.clause).join(', ')}`
      : undefined,
  };
}

/**
 * Print gate result
 */
export function printGateResult(result: GateResult, options: { format?: string; verbose?: boolean; ci?: boolean } = {}) {
  const { format = 'pretty', verbose = false, ci = false } = options;

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (ci) {
    // CI mode: JSON to stdout, one-line summary to stderr
    console.log(JSON.stringify(result, null, 2));
    const blockerCount = result.results?.blockers?.length ?? 0;
    if (result.decision === 'SHIP') {
      process.stderr.write(`Shipgate: SHIP (score: ${result.trustScore}/100)\n`);
    } else {
      process.stderr.write(`Shipgate: NO_SHIP (score: ${result.trustScore}/100, ${blockerCount} blockers)\n`);
    }
    return;
  }

  console.log('');
  
  // Big decision banner
  if (result.decision === 'SHIP') {
    console.log(chalk.bold.green('  ┌─────────────────────────────────────┐'));
    console.log(chalk.bold.green('  │            ✓  SHIP                  │'));
    console.log(chalk.bold.green('  └─────────────────────────────────────┘'));
  } else {
    console.log(chalk.bold.red('  ┌─────────────────────────────────────┐'));
    console.log(chalk.bold.red('  │           ✗  NO-SHIP                │'));
    console.log(chalk.bold.red('  └─────────────────────────────────────┘'));
  }
  
  console.log('');
  console.log(chalk.gray(`  ${result.summary}`));
  console.log('');

  // Score
  const scoreColor = result.trustScore >= 95 ? chalk.green : 
                    result.trustScore >= 70 ? chalk.yellow : chalk.red;
  console.log(`  Trust Score: ${scoreColor(`${result.trustScore}%`)}`);
  console.log(`  Confidence:  ${chalk.gray(`${result.confidence}%`)}`);
  
  if (result.results) {
    const { summary } = result.results;
    console.log('');
    console.log(`  Tests: ${chalk.green(`${summary.passed} passed`)} ${chalk.red(`${summary.failed} failed`)} ${chalk.gray(`${summary.skipped} skipped`)}`);
  }

  // Blockers
  if (result.results?.blockers && result.results.blockers.length > 0) {
    console.log('');
    console.log(chalk.red('  Blocking Issues:'));
    for (const blocker of result.results.blockers) {
      const severityColor = blocker.severity === 'critical' ? chalk.red : 
                           blocker.severity === 'high' ? chalk.yellow : chalk.gray;
      console.log(`    ${severityColor('•')} ${blocker.clause}`);
      console.log(`      ${chalk.gray(blocker.reason)}`);
    }
  }

  // Suggestion
  if (result.suggestion) {
    console.log('');
    console.log(chalk.yellow(`  Suggestion: ${result.suggestion}`));
  }

  // Evidence bundle
  if (result.bundlePath) {
    console.log('');
    console.log(chalk.gray(`  Evidence: ${result.bundlePath}`));
  }

  // Fingerprint
  if (result.manifest?.fingerprint) {
    console.log(chalk.gray(`  Fingerprint: ${result.manifest.fingerprint}`));
  }

  // Trace ID for correlation
  const traceId = getCurrentTraceId();
  if (traceId) {
    console.log(chalk.gray(`  Trace ID: ${traceId.slice(0, 16)}...`));
  }

  // Verified badge - only shown when SHIP
  if (result.decision === 'SHIP') {
    console.log('');
    console.log(chalk.bold.green('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.green('  Verified by Shipgate ✓'));
    console.log(chalk.bold.green('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  }

  console.log('');
}

/**
 * Get exit code from gate result
 */
export function getGateExitCode(result: GateResult): number {
  return result.exitCode;
}
