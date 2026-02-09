/**
 * Heal Command
 * 
 * Automatically fix violations in code to pass the gate.
 * 
 * Usage:
 *   isl heal <pattern>                    # Heal files matching pattern
 *   isl heal <pattern> --spec <file>     # Use specific ISL spec
 *   isl heal <pattern> --max-iterations 8 # Limit iterations
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { parse as parseISL } from '@isl-lang/parser';
import { SemanticHealer, type RepoContext } from '@isl-lang/pipeline';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput, isQuietOutput } from '../output.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HealOptions {
  /** ISL spec file path (optional - auto-discovers if not provided) */
  spec?: string;
  /** Maximum healing iterations (default: 8) */
  maxIterations?: number;
  /** Stop after this many identical fingerprints (default: 2) */
  stopOnRepeat?: number;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
  /** Dry-run mode: preview patches without applying */
  dryRun?: boolean;
  /** Interactive mode: ask for confirmation per patch */
  interactive?: boolean;
  /** Output directory for dry-run patches */
  outputDir?: string;
}

export interface HealResult {
  success: boolean;
  reason: 'ship' | 'stuck' | 'unknown_rule' | 'max_iterations' | 'weakening_detected' | 'incomplete_proof';
  iterations: number;
  finalScore: number;
  finalVerdict: 'SHIP' | 'NO_SHIP';
  history: Array<{
    iteration: number;
    violations: Array<{
      ruleId: string;
      file: string;
      line?: number;
      message: string;
      severity: string;
    }>;
    patchesApplied: string[];
    fingerprint: string;
    duration: number;
  }>;
  files: string[];
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Heal Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find ISL spec file (auto-discovery)
 */
async function findSpecFile(pattern: string): Promise<string | null> {
  // Try common locations
  const commonPaths = [
    'specs/**/*.isl',
    '**/*.isl',
    '*.isl',
  ];

  for (const globPattern of commonPaths) {
    const files = await glob(globPattern, { ignore: ['node_modules/**', '.git/**'] });
    if (files.length > 0) {
      return files[0]!;
    }
  }

  return null;
}

/**
 * Find files matching pattern
 */
async function findFiles(pattern: string): Promise<string[]> {
  const files = await glob(pattern, {
    ignore: ['node_modules/**', '.git/**', '**/*.test.ts', '**/*.spec.ts'],
  });
  return files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
}

/**
 * Read code files into a map
 */
async function readCodeFiles(files: string[]): Promise<Map<string, string>> {
  const codeMap = new Map<string, string>();
  
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      codeMap.set(file, content);
    } catch (err) {
      // Skip files that can't be read
      if (!isQuietOutput()) {
        output.warn(`Skipping ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  
  return codeMap;
}

/**
 * Detect framework from code
 */
function detectFramework(codeMap: Map<string, string>): 'nextjs' | 'express' | 'fastify' {
  for (const code of codeMap.values()) {
    if (code.includes('NextResponse') || code.includes('next/server')) {
      return 'nextjs';
    }
    if (code.includes('express') || code.includes('req, res')) {
      return 'express';
    }
    if (code.includes('fastify')) {
      return 'fastify';
    }
  }
  return 'nextjs'; // Default
}

/**
 * Run heal command
 */
export async function heal(pattern: string, options: HealOptions = {}): Promise<HealResult> {
  const isJson = options.format === 'json' || isJsonOutput();
  const errors: string[] = [];

  try {
    // Find spec file
    let specPath = options.spec;
    if (!specPath) {
      specPath = await findSpecFile(pattern);
      if (!specPath) {
        const error = 'No ISL spec file found. Use --spec to specify one.';
        errors.push(error);
        return {
          success: false,
          reason: 'unknown_rule',
          iterations: 0,
          finalScore: 0,
          finalVerdict: 'NO_SHIP',
          history: [],
          files: [],
          errors,
        };
      }
    }

    if (!existsSync(specPath)) {
      const error = `Spec file not found: ${specPath}`;
      errors.push(error);
      return {
        success: false,
        reason: 'unknown_rule',
        iterations: 0,
        finalScore: 0,
        finalVerdict: 'NO_SHIP',
        history: [],
        files: [],
        errors,
      };
    }

    // Parse ISL spec
    const specContent = await readFile(specPath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(specContent, specPath);

    if (parseErrors.length > 0 || !ast) {
      const error = `Failed to parse ISL spec: ${parseErrors.map(e => 'message' in e ? e.message : String(e)).join(', ')}`;
      errors.push(error);
      return {
        success: false,
        reason: 'unknown_rule',
        iterations: 0,
        finalScore: 0,
        finalVerdict: 'NO_SHIP',
        history: [],
        files: [],
        errors,
      };
    }

    // Find files matching pattern
    const files = await findFiles(pattern);
    if (files.length === 0) {
      const error = `No files found matching pattern: ${pattern}`;
      errors.push(error);
      return {
        success: false,
        reason: 'unknown_rule',
        iterations: 0,
        finalScore: 0,
        finalVerdict: 'NO_SHIP',
        history: [],
        files: [],
        errors,
      };
    }

    // Read code files
    const codeMap = await readCodeFiles(files);
    if (codeMap.size === 0) {
      const error = 'No code files could be read';
      errors.push(error);
      return {
        success: false,
        reason: 'unknown_rule',
        iterations: 0,
        finalScore: 0,
        finalVerdict: 'NO_SHIP',
        history: [],
        files: [],
        errors,
      };
    }

    // Detect framework
    const framework = detectFramework(codeMap);
    const repoContext: RepoContext = {
      framework,
      validationLib: 'zod',
      routingStyle: framework === 'nextjs' ? 'file-based' : 'explicit',
      conventions: { apiPrefix: '/api' },
    };

    // Run semantic healer
    const healer = new SemanticHealer(
      ast,
      repoContext,
      codeMap,
      {
        maxIterations: options.maxIterations ?? 8,
        stopOnRepeat: options.stopOnRepeat ?? 2,
        verbose: options.verbose ?? !isJson,
        requireTests: false,
        failOnStubs: false,
      }
    );

    const result = await healer.heal();

    // Map history to our format
    const history: HealResult['history'] = result.history.map(iter => ({
      iteration: iter.iteration,
      violations: iter.violations.map(v => ({
        ruleId: v.ruleId,
        file: v.file,
        line: v.line,
        message: v.message,
        severity: v.severity,
      })),
      patchesApplied: iter.patchesApplied,
      fingerprint: iter.fingerprint,
      duration: iter.duration,
    }));

    return {
      success: result.ok,
      reason: result.reason,
      iterations: result.iterations,
      finalScore: result.finalScore,
      finalVerdict: result.finalVerdict,
      history,
      files: Array.from(codeMap.keys()),
      errors: result.unknownRules,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    return {
      success: false,
      reason: 'unknown_rule',
      iterations: 0,
      finalScore: 0,
      finalVerdict: 'NO_SHIP',
      history: [],
      files: [],
      errors,
    };
  }
}

/**
 * Print heal result
 */
export function printHealResult(result: HealResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const isJson = options.format === 'json' || isJsonOutput();
  const isQuiet = options.format === 'quiet' || isQuietOutput();

  if (isJson) {
    console.log(JSON.stringify({
      success: result.success,
      reason: result.reason,
      iterations: result.iterations,
      finalScore: result.finalScore,
      finalVerdict: result.finalVerdict,
      history: result.history,
      files: result.files,
      errors: result.errors,
    }, null, 2));
    return;
  }

  if (isQuiet) {
    return;
  }

  // Header
  console.log('');
  output.header('ISL Heal Results');
  console.log('');

  // Summary
  const verdictColor = result.finalVerdict === 'SHIP' ? chalk.green : chalk.red;
  console.log(`  Verdict: ${verdictColor(result.finalVerdict)}`);
  console.log(`  Score: ${output.score(result.finalScore)}`);
  console.log(`  Iterations: ${result.iterations}`);
  console.log(`  Files: ${result.files.length}`);
  console.log('');

  // Progress display (bounded loop)
  if (result.history.length > 0) {
    console.log(chalk.bold('  Healing Progress:'));
    console.log('');
    
    const maxDisplay = 10; // Show at most 10 iterations
    const toShow = result.history.slice(0, maxDisplay);
    const skipped = result.history.length - maxShow;

    for (const iter of toShow) {
      const iterColor = iter.violations.length === 0 ? chalk.green : chalk.yellow;
      const progressBar = output.progressBar(iter.iteration, result.iterations, 20);
      console.log(`  ${iterColor(`Iteration ${iter.iteration}`)} ${progressBar}`);
      
      if (iter.violations.length > 0) {
        console.log(`    Violations: ${iter.violations.length}`);
        for (const v of iter.violations.slice(0, 3)) {
          console.log(`      • [${v.severity}] ${v.ruleId}: ${v.message}`);
        }
        if (iter.violations.length > 3) {
          console.log(`      ... and ${iter.violations.length - 3} more`);
        }
      }
      
      if (iter.patchesApplied.length > 0) {
        console.log(`    Patches: ${iter.patchesApplied.length}`);
        for (const patch of iter.patchesApplied.slice(0, 3)) {
          console.log(`      ✓ ${patch}`);
        }
        if (iter.patchesApplied.length > 3) {
          console.log(`      ... and ${iter.patchesApplied.length - 3} more`);
        }
      }
      
      console.log(`    Duration: ${iter.duration}ms`);
      console.log('');
    }

    if (skipped > 0) {
      console.log(chalk.gray(`  ... ${skipped} more iteration(s) (use --verbose to see all)`));
      console.log('');
    }
  }

  // Errors
  if (result.errors && result.errors.length > 0) {
    console.log(chalk.red('  Errors:'));
    for (const error of result.errors) {
      console.log(`    • ${error}`);
    }
    console.log('');
  }

  // Next steps
  if (!result.success) {
    console.log(chalk.yellow('  Next Steps:'));
    if (result.reason === 'unknown_rule') {
      console.log('    • Some violations cannot be fixed automatically');
      console.log('    • Review the errors above and fix manually');
    } else if (result.reason === 'max_iterations') {
      console.log('    • Maximum iterations reached');
      console.log('    • Try increasing --max-iterations or fix remaining violations manually');
    } else if (result.reason === 'stuck') {
      console.log('    • Healing appears stuck (same violations repeating)');
      console.log('    • Review violations and fix manually');
    } else if (result.reason === 'weakening_detected') {
      console.log('    • A patch would weaken security - refused');
      console.log('    • Fix violations manually without weakening security');
    }
    console.log('');
  } else {
    console.log(chalk.green('  ✓ All violations fixed! Code is ready to ship.'));
    console.log('');
  }
}

/**
 * Get exit code for heal result
 */
export function getHealExitCode(result: HealResult): number {
  if (result.success) {
    return ExitCode.SUCCESS;
  }
  return ExitCode.ISL_ERROR;
}
