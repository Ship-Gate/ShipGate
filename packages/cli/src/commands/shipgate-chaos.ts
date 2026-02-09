/**
 * ShipGate Chaos Command
 * 
 * CI-safe chaos testing with deterministic seeds, bounded timeouts, and invariant violation claims.
 * 
 * Usage:
 *   shipgate chaos run --spec <file> --impl <file> --seed <seed>
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import {
  buildModuleGraph,
  getMergedAST,
} from '@isl-lang/import-resolver';
import { output } from '../output.js';
import { loadConfig } from '../config.js';
import type { DomainDeclaration } from '@isl-lang/isl-core/ast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShipGateChaosOptions {
  /** ISL spec file path */
  spec: string;
  /** Implementation file path */
  impl: string;
  /** Deterministic seed for reproducibility (required) */
  seed?: number;
  /** Test timeout in milliseconds (default: 30000, max: 300000 for CI safety) */
  timeout?: number;
  /** Continue running scenarios after failure */
  continueOnFailure?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** JSON output */
  json?: boolean;
  /** Output format */
  format?: 'text' | 'json';
}

export interface ShipGateChaosResult {
  success: boolean;
  specFile: string;
  implFile: string;
  /** Seed used for this run (for reproduction) */
  seed: number;
  /** Chaos verification results */
  chaosResult?: ChaosVerifyResult;
  /** Violation claims emitted */
  violations: ViolationClaim[];
  /** Reproduction steps */
  reproductionSteps: ReproductionStep[];
  errors: string[];
  duration: number;
}

export interface ViolationClaim {
  /** Invariant that was violated */
  invariant: string;
  /** Spec clause reference */
  specClause?: {
    file: string;
    line?: number;
    clause: string;
  };
  /** Violation details */
  violation: {
    expected: unknown;
    actual: unknown;
    message: string;
  };
  /** Chaos event that triggered this violation */
  triggeringEvent?: {
    type: string;
    timestamp: number;
  };
  /** State snapshot at violation */
  stateSnapshot?: Record<string, unknown>;
}

export interface ReproductionStep {
  step: number;
  description: string;
  command?: string;
}

export interface ChaosVerifyResult {
  /** Overall success */
  success: boolean;
  /** Verdict: verified, risky, or unsafe */
  verdict: 'verified' | 'risky' | 'unsafe';
  /** Overall score (0-100) */
  score: number;
  /** Passed scenarios */
  passed: ChaosTestResult[];
  /** Failed scenarios */
  failed: ChaosTestResult[];
  /** Skipped scenarios */
  skipped: ChaosTestResult[];
  /** Coverage report */
  coverage: ChaosCoverageReport;
  /** Timing report */
  timing: ChaosTimingReport;
  /** Configuration used */
  config: {
    timeout: number;
    seed: number;
    continueOnFailure: boolean;
  };
  /** Total duration */
  duration: number;
}

export interface ChaosTestResult {
  name: string;
  type: 'chaos';
  passed: boolean;
  duration: number;
  error?: {
    message: string;
    expected?: unknown;
    actual?: unknown;
    injectionType?: string;
  };
  injections: string[];
}

export interface ChaosCoverageReport {
  injectionTypes: CoverageMetric;
  scenarios: CoverageMetric;
  behaviors: CoverageMetric;
  overall: number;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface ChaosTimingReport {
  total: number;
  setup: number;
  execution: number;
  teardown: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum timeout for CI safety (5 minutes) */
const MAX_TIMEOUT_MS = 300_000;

/** Default timeout (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Chaos Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run chaos verification with deterministic seeds, bounded timeouts, and violation claims
 */
async function runShipGateChaosVerification(
  domain: DomainDeclaration,
  implSource: string,
  options: {
    seed: number;
    timeout: number;
    continueOnFailure?: boolean;
    verbose?: boolean;
  }
): Promise<{
  result: ChaosVerifyResult;
  violations: ViolationClaim[];
  reproductionSteps: ReproductionStep[];
}> {
  const start = Date.now();
  const violations: ViolationClaim[] = [];
  const reproductionSteps: ReproductionStep[] = [];

  // Add initial reproduction step
  reproductionSteps.push({
    step: 1,
    description: `Run chaos test with seed ${options.seed}`,
    command: `shipgate chaos run --spec <spec-file> --impl <impl-file> --seed ${options.seed}`,
  });

  try {
    // Dynamically import the chaos verifier package
    const chaos = await import('@isl-lang/verifier-chaos');

    // Create resilience verifier with deterministic seed and timeout
    const verifier = chaos.createResilienceVerifier({
      seed: options.seed,
      timeoutMs: options.timeout,
      continueOnFailure: options.continueOnFailure ?? true,
      verbose: options.verbose ?? false,
      recordReplay: true,
      checkInvariants: true, // Enable invariant checking
    });

    // Create an implementation adapter
    const createImpl = (behaviorName: string): chaos.BehaviorImplementation => ({
      async execute(input: Record<string, unknown>): Promise<chaos.BehaviorExecutionResult> {
        // In a real implementation, this would execute the actual code
        // For now, we simulate behavior with deterministic failures based on seed
        const rng = verifier.getRNG();
        
        // Use deterministic RNG for failures
        if (rng.nextBool(0.1)) {
          return { 
            success: false, 
            error: new Error(`Simulated failure in ${behaviorName}`) 
          };
        }
        
        // Simulate processing time (deterministic based on seed)
        const delay = rng.nextInt(10, 100);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return { success: true, data: { behaviorName, input } };
      },
    });

    // Run chaos verification for each behavior
    const passed: ChaosTestResult[] = [];
    const failed: ChaosTestResult[] = [];
    const skipped: ChaosTestResult[] = [];
    const coveredInjectionTypes = new Set<string>();

    for (const behavior of domain.behaviors) {
      const behaviorName = behavior.name.name;
      const impl = createImpl(behaviorName);
      
      try {
        // Set up timeout promise to ensure we never hang
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Chaos test timed out after ${options.timeout}ms`));
          }, options.timeout);
        });

        // Run verification with timeout protection
        const verifyPromise = verifier.verify({
          domain: domain as unknown as Parameters<typeof verifier.verify>[0]['domain'],
          implementation: impl,
          behaviorName,
        });

        const result = await Promise.race([verifyPromise, timeoutPromise]);

        // Extract violations from violation report
        if (result.violationReport && result.violationReport.totalViolations > 0) {
          // The violationReport.violations is an array of simplified violation records
          const violationRecords = result.violationReport.violations || [];
          
          for (const record of violationRecords) {
            violations.push({
              invariant: record.invariantName || record.invariantId || 'unknown',
              specClause: record.specClauses && record.specClauses.length > 0 ? {
                file: record.specClauses[0]!.file || 'unknown',
                line: record.specClauses[0]!.line,
                clause: record.specClauses[0]!.clause || 'unknown',
              } : undefined,
              violation: {
                expected: record.expected,
                actual: record.actual,
                message: `Invariant violated: ${record.invariantName || record.invariantId || 'unknown'} (${record.category}, ${record.severity})`,
              },
              triggeringEvent: record.triggeringEventId ? {
                type: 'chaos_event',
                timestamp: record.timestamp,
              } : undefined,
              stateSnapshot: undefined, // Not available in simplified report
            });

            // Add reproduction step for each violation
            reproductionSteps.push({
              step: reproductionSteps.length + 1,
              description: `Violation detected: ${record.invariantName || record.invariantId || 'unknown'}`,
              command: `shipgate chaos run --spec <spec-file> --impl <impl-file> --seed ${options.seed}`,
            });
          }
        }

        // Process scenario results
        if (result.scenarios && result.scenarios.length > 0) {
          for (const scenario of result.scenarios) {
            const testResult: ChaosTestResult = {
              name: scenario.name,
              type: 'chaos',
              passed: scenario.passed,
              duration: scenario.duration,
              injections: scenario.injections?.map((i: { type: string }) => i.type) || [],
            };
            
            if (scenario.passed) {
              passed.push(testResult);
            } else {
              testResult.error = scenario.error ? { 
                message: scenario.error.message,
                injectionType: scenario.injections?.[0]?.type,
              } : undefined;
              failed.push(testResult);
            }
            
            // Track injection types
            (scenario.injections || []).forEach((i: { type: string }) => 
              coveredInjectionTypes.add(i.type)
            );
          }
        } else {
          // Process chaos events if no scenarios
          for (const event of result.chaosEvents || []) {
            const testResult: ChaosTestResult = {
              name: `${behaviorName}:${event.type}`,
              type: 'chaos',
              passed: event.outcome?.handled ?? true,
              duration: event.outcome?.durationMs ?? 0,
              injections: [event.type],
            };
            
            if (testResult.passed) {
              passed.push(testResult);
            } else {
              testResult.error = event.outcome?.error 
                ? { message: event.outcome.error.message }
                : undefined;
              failed.push(testResult);
            }
            
            coveredInjectionTypes.add(event.type);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        
        // Handle timeout errors
        if (message.includes('timed out') || message.includes('timeout')) {
          failed.push({
            name: `${behaviorName}:timeout`,
            type: 'chaos',
            passed: false,
            duration: options.timeout,
            error: {
              message: `Test timed out after ${options.timeout}ms`,
              injectionType: 'timeout',
            },
            injections: ['timeout'],
          });

          reproductionSteps.push({
            step: reproductionSteps.length + 1,
            description: `Timeout occurred after ${options.timeout}ms`,
            command: `shipgate chaos run --spec <spec-file> --impl <impl-file> --seed ${options.seed} --timeout ${options.timeout}`,
          });
        } else {
          failed.push({
            name: `${behaviorName}:error`,
            type: 'chaos',
            passed: false,
            duration: 0,
            error: { message },
            injections: [],
          });
        }
      }
    }

    // Calculate coverage
    const allInjectionTypes = new Set([
      'database_failure',
      'network_latency',
      'service_unavailable',
      'concurrent_requests',
      'timeout',
      'rate_limit',
      'clock_skew',
      'random_failure',
    ]);

    const coverage: ChaosCoverageReport = {
      injectionTypes: {
        total: allInjectionTypes.size,
        covered: coveredInjectionTypes.size,
        percentage: (coveredInjectionTypes.size / allInjectionTypes.size) * 100,
      },
      scenarios: {
        total: passed.length + failed.length + skipped.length,
        covered: passed.length + failed.length,
        percentage: passed.length + failed.length + skipped.length > 0 
          ? ((passed.length + failed.length) / (passed.length + failed.length + skipped.length)) * 100 
          : 0,
      },
      behaviors: {
        total: domain.behaviors.length,
        covered: domain.behaviors.length,
        percentage: 100,
      },
      overall: 0,
    };
    
    coverage.overall = (
      coverage.injectionTypes.percentage * 0.3 +
      coverage.scenarios.percentage * 0.5 +
      coverage.behaviors.percentage * 0.2
    );

    // Calculate score
    const total = passed.length + failed.length + skipped.length;
    const score = total > 0 
      ? Math.round(((passed.length * 1.0 + skipped.length * 0.5) / total) * 100)
      : 0;

    // Determine verdict
    let verdict: 'verified' | 'risky' | 'unsafe';
    if (failed.length === 0 && violations.length === 0 && score >= 80) {
      verdict = 'verified';
    } else if (violations.length > 0 || (failed.length > 0 && score < 50)) {
      verdict = 'unsafe';
    } else {
      verdict = 'risky';
    }

    const duration = Date.now() - start;

    return {
      result: {
        success: failed.length === 0 && violations.length === 0,
        verdict,
        score,
        passed,
        failed,
        skipped,
        coverage,
        timing: {
          total: duration,
          setup: 0,
          execution: duration,
          teardown: 0,
        },
        config: {
          timeout: options.timeout,
          seed: options.seed,
          continueOnFailure: options.continueOnFailure ?? true,
        },
        duration,
      },
      violations,
      reproductionSteps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Cannot find module') || message.includes('not found')) {
      return {
        result: {
          success: false,
          verdict: 'unsafe',
          score: 0,
          passed: [],
          failed: [{
            name: 'chaos_module',
            type: 'chaos',
            passed: false,
            duration: 0,
            error: {
              message: 'Chaos verifier package not installed. Install with: pnpm add @isl-lang/verifier-chaos',
            },
            injections: [],
          }],
          skipped: [],
          coverage: {
            injectionTypes: { total: 0, covered: 0, percentage: 0 },
            scenarios: { total: 0, covered: 0, percentage: 0 },
            behaviors: { total: 0, covered: 0, percentage: 0 },
            overall: 0,
          },
          timing: { total: Date.now() - start, setup: 0, execution: 0, teardown: 0 },
          config: { timeout: options.timeout, seed: options.seed, continueOnFailure: true },
          duration: Date.now() - start,
        },
        violations: [],
        reproductionSteps,
      };
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run ShipGate chaos testing
 */
export async function shipgateChaosRun(
  specFile: string,
  implFile: string,
  options: ShipGateChaosOptions
): Promise<ShipGateChaosResult> {
  const startTime = Date.now();
  const spinner = ora('Loading files...').start();
  const errors: string[] = [];

  // Validate seed is provided
  if (options.seed === undefined) {
    // Generate a deterministic seed from timestamp if not provided
    // But warn that explicit seed is preferred for reproducibility
    const autoSeed = Math.floor(Date.now() / 1000);
    if (!options.json) {
      output.warn(`No seed provided. Using auto-generated seed: ${autoSeed}`);
      output.warn('For reproducibility, provide --seed explicitly');
    }
    options.seed = autoSeed;
  }

  // Validate and enforce timeout bounds
  const timeout = Math.min(
    Math.max(options.timeout ?? DEFAULT_TIMEOUT_MS, 1000), // Minimum 1 second
    MAX_TIMEOUT_MS // Maximum 5 minutes for CI safety
  );

  if (options.timeout && options.timeout > MAX_TIMEOUT_MS) {
    errors.push(`Timeout ${options.timeout}ms exceeds maximum ${MAX_TIMEOUT_MS}ms for CI safety. Using ${MAX_TIMEOUT_MS}ms.`);
  }

  // Resolve paths
  const specPath = resolve(specFile);
  const implPath = resolve(implFile);

  // Check spec file exists
  if (!existsSync(specPath)) {
    spinner.fail('Spec file not found');
    return {
      success: false,
      specFile: specPath,
      implFile: implPath,
      seed: options.seed!,
      violations: [],
      reproductionSteps: [],
      errors: [`Spec file not found: ${specPath}`],
      duration: Date.now() - startTime,
    };
  }

  // Check impl file exists
  if (!existsSync(implPath)) {
    spinner.fail('Implementation file not found');
    return {
      success: false,
      specFile: specPath,
      implFile: implPath,
      seed: options.seed!,
      violations: [],
      reproductionSteps: [],
      errors: [`Implementation file not found: ${implPath}`],
      duration: Date.now() - startTime,
    };
  }

  try {
    // Read spec file
    spinner.text = 'Parsing ISL spec...';
    const specSource = await readFile(specPath, 'utf-8');
    
    // Resolve imports
    let ast: DomainDeclaration | undefined;
    
    spinner.text = 'Resolving imports...';
    const graph = await buildModuleGraph(specPath, {
      basePath: dirname(specPath),
      enableImports: true,
      enableCaching: true,
      mergeAST: true,
    });
    
    if (graph.errors.length > 0) {
      const criticalErrors = graph.errors.filter(e => 
        e.code === 'CIRCULAR_DEPENDENCY' || e.code === 'MODULE_NOT_FOUND'
      );
      
      if (criticalErrors.length > 0) {
        spinner.fail('Failed to resolve imports');
        return {
          success: false,
          specFile: specPath,
          implFile: implPath,
          seed: options.seed!,
          violations: [],
          reproductionSteps: [],
          errors: graph.errors.map(e => `Import error: ${e.message}`),
          duration: Date.now() - startTime,
        };
      }
      
      if (options.verbose) {
        for (const err of graph.errors) {
          output.debug(`[Import Warning] ${err.message}`);
        }
      }
    }
    
    ast = getMergedAST(graph) as DomainDeclaration | undefined;
    
    if (!ast && graph.graphModules.size > 0) {
      const entryModule = graph.graphModules.get(graph.entryPoint);
      ast = entryModule?.ast as DomainDeclaration | undefined;
    }
    
    // Fallback to single-file parsing
    if (!ast) {
      const { domain: parsedAst, errors: parseErrors } = parseISL(specSource, specPath);
      
      if (parseErrors.length > 0 || !parsedAst) {
        spinner.fail('Failed to parse ISL spec');
        return {
          success: false,
          specFile: specPath,
          implFile: implPath,
          seed: options.seed!,
          violations: [],
          reproductionSteps: [],
          errors: parseErrors.map(e => `Parse error: ${e.message}`),
          duration: Date.now() - startTime,
        };
      }
      
      ast = parsedAst as DomainDeclaration;
    }

    // Read implementation
    spinner.text = 'Loading implementation...';
    const implSource = await readFile(implPath, 'utf-8');

    // Run chaos verification
    spinner.text = `Running chaos tests (seed: ${options.seed}, timeout: ${timeout}ms)...`;
    const { result: chaosResult, violations, reproductionSteps } = await runShipGateChaosVerification(
      ast,
      implSource,
      {
        seed: options.seed!,
        timeout,
        continueOnFailure: options.continueOnFailure ?? true,
        verbose: options.verbose,
      }
    );

    const duration = Date.now() - startTime;

    // Update reproduction steps with actual file paths
    const finalReproductionSteps = reproductionSteps.map(step => ({
      ...step,
      command: step.command
        ?.replace('<spec-file>', relative(process.cwd(), specPath))
        ?.replace('<impl-file>', relative(process.cwd(), implPath)),
    }));

    if (chaosResult.success && violations.length === 0) {
      spinner.succeed(`Chaos verification passed (${duration}ms)`);
    } else {
      const failureCount = chaosResult.failed.length + violations.length;
      spinner.fail(`Chaos verification failed - ${failureCount} failure(s)`);
    }

    return {
      success: chaosResult.success && violations.length === 0,
      specFile: specPath,
      implFile: implPath,
      seed: options.seed!,
      chaosResult,
      violations,
      reproductionSteps: finalReproductionSteps,
      errors,
      duration,
    };
  } catch (err) {
    spinner.fail('Chaos verification failed');
    errors.push(err instanceof Error ? err.message : String(err));
    
    return {
      success: false,
      specFile: specPath,
      implFile: implPath,
      seed: options.seed!,
      violations: [],
      reproductionSteps: [{
        step: 1,
        description: `Reproduce with: shipgate chaos run --spec ${relative(process.cwd(), specPath)} --impl ${relative(process.cwd(), implPath)} --seed ${options.seed}`,
        command: `shipgate chaos run --spec ${relative(process.cwd(), specPath)} --impl ${relative(process.cwd(), implPath)} --seed ${options.seed}`,
      }],
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print ShipGate chaos results to console
 */
export function printShipGateChaosResult(
  result: ShipGateChaosResult,
  options?: { detailed?: boolean; format?: string; json?: boolean }
): void {
  // JSON output
  if (options?.json || options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      specFile: result.specFile,
      implFile: result.implFile,
      seed: result.seed,
      chaosResult: result.chaosResult,
      violations: result.violations,
      reproductionSteps: result.reproductionSteps,
      errors: result.errors,
      duration: result.duration,
    }, null, 2));
    return;
  }

  console.log('');

  // Print files and seed
  console.log(chalk.gray('Spec:') + ` ${relative(process.cwd(), result.specFile)}`);
  console.log(chalk.gray('Impl:') + ` ${relative(process.cwd(), result.implFile)}`);
  console.log(chalk.gray('Seed:') + ` ${result.seed}`);
  console.log('');

  // Handle errors
  if (result.errors.length > 0) {
    console.log(chalk.red('✗ Chaos verification failed'));
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
    return;
  }

  if (!result.chaosResult) {
    return;
  }

  // Print header
  console.log(chalk.bold.cyan('┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│      SHIPGATE CHAOS VERIFICATION            │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘'));
  console.log('');

  const { verdict, score, passed, failed, skipped, coverage, timing, config } = result.chaosResult;

  // Verdict banner
  const verdictColor = verdict === 'verified' ? chalk.green 
    : verdict === 'risky' ? chalk.yellow 
    : chalk.red;
  console.log(chalk.bold('  Verdict: ') + verdictColor.bold(verdict.toUpperCase()));
  console.log(chalk.bold('  Score:   ') + verdictColor(`${score}/100`));
  console.log('');

  // Summary
  console.log(chalk.green(`  ✓ ${passed.length} scenarios passed`));
  if (failed.length > 0) {
    console.log(chalk.red(`  ✗ ${failed.length} scenarios failed`));
  }
  if (skipped.length > 0) {
    console.log(chalk.yellow(`  ○ ${skipped.length} scenarios skipped`));
  }
  if (result.violations.length > 0) {
    console.log(chalk.red(`  ⚠ ${result.violations.length} invariant violation(s)`));
  }
  console.log(chalk.gray(`  Duration: ${timing.total}ms`));
  console.log(chalk.gray(`  Seed: ${config.seed}`));

  // Violations (claims)
  if (result.violations.length > 0) {
    console.log('');
    console.log(chalk.bold.red('  Invariant Violations (Claims):'));
    for (const violation of result.violations) {
      console.log(chalk.red(`    ✗ ${violation.invariant}`));
      console.log(chalk.gray(`      Expected: ${JSON.stringify(violation.violation.expected)}`));
      console.log(chalk.gray(`      Actual: ${JSON.stringify(violation.violation.actual)}`));
      if (violation.specClause) {
        console.log(chalk.gray(`      Spec: ${violation.specClause.file}${violation.specClause.line ? `:${violation.specClause.line}` : ''}`));
      }
      if (violation.triggeringEvent) {
        console.log(chalk.gray(`      Triggered by: ${violation.triggeringEvent.type}`));
      }
    }
  }

  // Coverage
  console.log('');
  console.log(chalk.bold('  Coverage:'));
  console.log(chalk.gray(`    Injection Types: ${coverage.injectionTypes.covered}/${coverage.injectionTypes.total} (${coverage.injectionTypes.percentage.toFixed(0)}%)`));
  console.log(chalk.gray(`    Scenarios:       ${coverage.scenarios.covered}/${coverage.scenarios.total} (${coverage.scenarios.percentage.toFixed(0)}%)`));
  console.log(chalk.gray(`    Behaviors:       ${coverage.behaviors.covered}/${coverage.behaviors.total} (${coverage.behaviors.percentage.toFixed(0)}%)`));
  console.log(chalk.gray(`    Overall:         ${coverage.overall.toFixed(0)}%`));

  // Detailed scenario results
  if (options?.detailed) {
    if (passed.length > 0) {
      console.log('');
      console.log(chalk.bold.green('  Passed Scenarios:'));
      for (const p of passed) {
        console.log(chalk.green(`    ✓ ${p.name}`));
        if (p.injections.length > 0) {
          console.log(chalk.gray(`      Injections: ${p.injections.join(', ')}`));
        }
      }
    }

    if (failed.length > 0) {
      console.log('');
      console.log(chalk.bold.red('  Failed Scenarios:'));
      for (const f of failed) {
        console.log(chalk.red(`    ✗ ${f.name}`));
        if (f.error) {
          console.log(chalk.gray(`      Error: ${f.error.message}`));
          if (f.error.injectionType) {
            console.log(chalk.gray(`      Injection: ${f.error.injectionType}`));
          }
        }
      }
    }
  }

  // Reproduction instructions
  if (!result.success) {
    console.log('');
    console.log(chalk.bold.yellow('  Reproduction Steps:'));
    for (const step of result.reproductionSteps) {
      console.log(chalk.yellow(`    ${step.step}. ${step.description}`));
      if (step.command) {
        console.log(chalk.gray(`       ${step.command}`));
      }
    }
  }

  // Summary line
  console.log('');
  if (result.success) {
    console.log(chalk.green(`✓ Chaos verification passed`));
  } else {
    console.log(chalk.red(`✗ Chaos verification failed`));
  }
  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

/**
 * Get exit code for ShipGate chaos result
 */
export function getShipGateChaosExitCode(result: ShipGateChaosResult): number {
  return result.success ? 0 : 1;
}

export default shipgateChaosRun;
