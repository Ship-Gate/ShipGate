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

// Types
export interface GateOptions {
  impl: string;
  threshold?: number;
  output?: string;
  ci?: boolean;
  verbose?: boolean;
  format?: 'pretty' | 'json' | 'quiet';
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
  const {
    impl,
    threshold = 95,
    output,
    verbose = false,
  } = options;

  try {
    // Read spec file
    if (!existsSync(specPath)) {
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
    return await runLocalGate(specSource, implSource, threshold, output);
  } catch (error) {
    return {
      decision: 'NO-SHIP',
      exitCode: 1,
      trustScore: 0,
      confidence: 0,
      summary: `Gate error: ${error instanceof Error ? error.message : String(error)}`,
      error: 'INTERNAL_ERROR',
    };
  }
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
  let parse: typeof import('@isl-lang/parser').parse;
  let check: typeof import('@isl-lang/typechecker').check;
  let verify: typeof import('@isl-lang/isl-verify').verify;

  try {
    const parser = await import('@isl-lang/parser');
    const typechecker = await import('@isl-lang/typechecker');
    const verifier = await import('@isl-lang/isl-verify');
    
    parse = parser.parse;
    check = typechecker.check;
    verify = verifier.verify;
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
  const parseResult = parse(specSource, 'spec.isl');
  
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
  const typeResult = check(parseResult.domain);
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
    verifyResult = await verify(parseResult.domain, implSource, {
      runner: { framework: 'vitest' },
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
  let decision: 'SHIP' | 'NO-SHIP';
  let summary: string;

  if (failed > 0) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: ${failed} verification${failed > 1 ? 's' : ''} failed. Trust score: ${trustScore}%`;
  } else if (trustScore < threshold) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: Trust score ${trustScore}% below threshold ${threshold}%`;
  } else {
    decision = 'SHIP';
    summary = `SHIP: All ${passed} verifications passed. Trust score: ${trustScore}%`;
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
    // Minimal output for CI
    console.log(result.decision);
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

  console.log('');
}

/**
 * Get exit code from gate result
 */
export function getGateExitCode(result: GateResult): number {
  return result.exitCode;
}
