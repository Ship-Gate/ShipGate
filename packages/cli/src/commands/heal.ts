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

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { SemanticHealer, type RepoContext, type SemanticHealResult, type SemanticHealIteration, type SemanticViolation } from '@isl-lang/pipeline';
import {
  HealPlanExecutor,
  type VerificationFailureInput,
} from '@isl-lang/autofix';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput, isQuietOutput } from '../output.js';
import { unifiedVerify, type UnifiedVerifyOptions, type FileVerifyResultEntry } from './verify.js';
import { loadConfig } from '../config.js';

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
  /** Use AI (LLM) to generate fixes */
  ai?: boolean;
  /** AI provider: anthropic or openai */
  provider?: 'anthropic' | 'openai';
  /** AI model override */
  model?: string;
}

export interface HealResult {
  success: boolean;
  reason: 'ship' | 'stuck' | 'unknown_rule' | 'max_iterations' | 'weakening_detected' | 'incomplete_proof' | 'ai_no_key';
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
  for (const code of Array.from(codeMap.values())) {
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
      specPath = await findSpecFile(pattern) ?? undefined;
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
    const { domain, errors: parseErrors } = parseISL(specContent, specPath);

    if (!domain || parseErrors.length > 0) {
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
      domain,
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
    const history: HealResult['history'] = result.history.map((iter: SemanticHealIteration) => ({
      iteration: iter.iteration,
      violations: iter.violations?.map((v: SemanticViolation) => ({
        ruleId: v.ruleId ?? 'unknown',
        file: v.file ?? '',
        line: v.line,
        message: v.message,
        severity: v.severity ?? 'medium',
      })) ?? [],
      patchesApplied: iter.patchesApplied ?? [],
      fingerprint: iter.fingerprint,
      duration: iter.duration,
    }));

    return {
      success: result.ok,
      reason: result.reason as HealResult['reason'],
      iterations: result.iterations,
      finalScore: result.finalScore,
      finalVerdict: result.finalVerdict,
      history,
      files: Array.from(codeMap.keys()),
      errors: [],
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

// ─────────────────────────────────────────────────────────────────────────────
// AI-Powered Heal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve AI API key from config or environment
 */
function resolveHealApiKey(provider: string, configApiKey?: string): string | null {
  if (configApiKey) {
    const envMatch = configApiKey.match(/^\$\{(\w+)\}$/);
    if (envMatch) {
      return process.env[envMatch[1]!] ?? null;
    }
    return configApiKey;
  }
  if (provider === 'anthropic') {
    return process.env['ANTHROPIC_API_KEY'] ?? process.env['ISL_ANTHROPIC_KEY'] ?? null;
  }
  if (provider === 'openai') {
    return process.env['OPENAI_API_KEY'] ?? process.env['ISL_OPENAI_KEY'] ?? null;
  }
  return null;
}

const HEAL_SYSTEM_PROMPT = `You are an expert TypeScript/JavaScript developer fixing code to comply with ISL (Intent Specification Language) contracts.

ISL defines:
- **Behaviors**: Functions with input/output types, preconditions, postconditions, invariants
- **Entities**: Data structures with fields and constraints
- **Invariants**: Rules that must always hold (e.g. never_throws_unhandled)

When fixing code:
- Match every behavior in the spec with a properly exported function
- Add input validation matching ISL preconditions
- Ensure return types match ISL output declarations
- Add error handling for ISL error declarations
- Satisfy all invariants (e.g. functions must not throw unhandled exceptions)
- Use proper TypeScript types — no 'any'

Return ONLY a surgical diff or JSON array: [{ "path": "file.ts", "content": "..." }] or [{ "path": "file.ts", "diff": "unified diff" }].
No explanations, no markdown fences, no comments about changes.`;

/**
 * Convert FileVerifyResultEntry to VerificationFailureInput for targeted heal
 */
async function toVerificationFailureInput(
  fileEntry: FileVerifyResultEntry,
  projectRoot: string,
): Promise<VerificationFailureInput> {
  const absPath = resolve(projectRoot, fileEntry.file);
  let sourceCode: string | undefined;
  if (existsSync(absPath)) {
    try {
      sourceCode = await readFile(absPath, 'utf-8');
    } catch {
      // ignore
    }
  }
  return {
    file: fileEntry.file,
    blockers: fileEntry.blockers,
    errors: fileEntry.errors,
    status: fileEntry.status,
    score: fileEntry.score,
    specFile: fileEntry.specFile,
    sourceCode,
  };
}

/**
 * AI-powered heal: targeted fix system
 * - Iteration 1: structural (imports, missing files)
 * - Iteration 2: types + implementation
 * - Iteration 3: test failures
 */
export async function aiHeal(targetPath: string, options: HealOptions = {}): Promise<HealResult> {
  const isJson = options.format === 'json' || isJsonOutput();
  const isQuiet = options.format === 'quiet' || isQuietOutput();
  const maxIterations = Math.min(options.maxIterations ?? 5, 3); // Cap at 3 for phased approach
  const errors: string[] = [];
  const history: HealResult['history'] = [];

  // Resolve AI config
  const { config } = await loadConfig();
  const configAi = config?.ai as Record<string, string> | undefined;
  const provider: 'anthropic' | 'openai' = (options.provider ?? configAi?.provider ?? 'anthropic') as 'anthropic' | 'openai';
  const providerDefault = provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
  const model = options.model ?? (options.provider ? providerDefault : (configAi?.model ?? providerDefault));
  const apiKey = resolveHealApiKey(provider, configAi?.apiKey);

  if (!apiKey) {
    const envVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    return {
      success: false,
      reason: 'ai_no_key',
      iterations: 0,
      finalScore: 0,
      finalVerdict: 'NO_SHIP',
      history: [],
      files: [],
      errors: [`No API key for ${provider}. Set ${envVar} or add ai.apiKey to .islrc.yaml`],
    };
  }

  const resolvedTarget = resolve(targetPath ?? '.');
  const projectRoot = process.cwd();
  const spinner = (!isJson && !isQuiet) ? ora('Running initial verification...').start() : null;

  // Initial verify
  spinner && (spinner.text = 'Verifying...');
  let verifyResult = await unifiedVerify(resolvedTarget, { verbose: false, timeout: 30000 });

  if (verifyResult.verdict === 'SHIP') {
    spinner?.succeed(chalk.green(`SHIP — score ${(verifyResult.score * 100).toFixed(0)}%`));
    return {
      success: true,
      reason: 'ship',
      iterations: 0,
      finalScore: verifyResult.score,
      finalVerdict: 'SHIP',
      history: [{ iteration: 0, violations: [], patchesApplied: ['SHIP'], fingerprint: 'ship', duration: 0 }],
      files: verifyResult.files.map(f => f.file),
    };
  }

  const failingFiles = verifyResult.files.filter(f => f.status === 'FAIL' || f.status === 'WARN');
  if (failingFiles.length === 0) {
    spinner?.warn(chalk.yellow(`No fixable files (score=${(verifyResult.score * 100).toFixed(0)}%)`));
    return {
      success: false,
      reason: 'stuck',
      iterations: 0,
      finalScore: verifyResult.score,
      finalVerdict: 'NO_SHIP',
      history: [],
      files: verifyResult.files.map(f => f.file),
    };
  }

  // Build failure entries with source code
  const entries: VerificationFailureInput[] = await Promise.all(
    failingFiles.map(f => toVerificationFailureInput(f, projectRoot)),
  );

  // Get ISL spec content for prompts (from first file with spec)
  let islContent: string | undefined;
  const firstWithSpec = failingFiles.find(f => f.specFile);
  if (firstWithSpec?.specFile) {
    const specPath = resolve(projectRoot, firstWithSpec.specFile);
    if (existsSync(specPath)) {
      try {
        islContent = await readFile(specPath, 'utf-8');
      } catch {
        // ignore
      }
    }
  }

  const callHealAI = createHealAICaller(provider, model, apiKey);

  const executor = new HealPlanExecutor({
    projectRoot,
    maxIterations,
    islContent,
    invokeAI: async (prompt) => callHealAI(prompt),
    verify: async () => {
      const result = await unifiedVerify(resolvedTarget, { verbose: false, timeout: 30000 });
      const failing = result.files.filter(f => f.status === 'FAIL' || f.status === 'WARN');
      return Promise.all(failing.map(f => toVerificationFailureInput(f, projectRoot)));
    },
  });

  if (!isJson && !isQuiet) {
    spinner && (spinner.text = 'Healing with targeted fixes...');
  }

  if (options.dryRun) {
    const { RootCauseAnalyzer } = await import('@isl-lang/autofix');
    const analyzer = new RootCauseAnalyzer();
    const analyzed = analyzer.analyzeAll(entries);
    const byCategory = new Map<string, number>();
    for (const a of analyzed) {
      byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + 1);
    }
    spinner?.info(chalk.yellow(`Dry run: would fix ${entries.length} file(s) — ${Array.from(byCategory).map(([c, n]) => `${c}: ${n}`).join(', ')}`));
    return {
      success: false,
      reason: 'stuck',
      iterations: 0,
      finalScore: verifyResult.score,
      finalVerdict: 'NO_SHIP',
      history: [{ iteration: 0, violations: entries.map(e => ({ ruleId: 'verify', file: e.file, message: e.blockers[0] ?? '', severity: 'high' })), patchesApplied: [`[dry-run] ${entries.length} file(s) would be analyzed`], fingerprint: 'dry', duration: 0 }],
      files: verifyResult.files.map(f => f.file),
    };
  }

  const report = await executor.execute(entries);

  const { report: healReport, fixesApplied } = report;

  // Map to HealResult history
  for await (const iter of healReport.iterations) {
    history.push({
      iteration: iter.iteration,
      violations: entries.map(e => ({
        ruleId: 'verify',
        file: e.file,
        message: e.blockers[0] ?? 'verification failed',
        severity: 'high',
      })),
      patchesApplied: iter.fixesApplied ?? [],
      fingerprint: `iter-${iter.iteration}`,
      duration: 0,
    });
  }

  if (healReport.verdict === 'SHIP') {
    spinner?.succeed(chalk.green(`SHIP — ${fixesApplied.length} fix(es) applied`));
    return {
      success: true,
      reason: 'ship',
      iterations: healReport.iterations.length,
      finalScore: 1,
      finalVerdict: 'SHIP',
      history,
      files: verifyResult.files.map(f => f.file),
    };
  }

  spinner?.fail(chalk.red(`NO_SHIP — ${healReport.failuresAfterHeal} failure(s) remain after ${healReport.iterations.length} iteration(s)`));
  return {
    success: false,
    reason: healReport.iterations.length >= maxIterations ? 'max_iterations' : 'stuck',
    iterations: healReport.iterations.length,
    finalScore: verifyResult.score,
    finalVerdict: 'NO_SHIP',
    history,
    files: verifyResult.files.map(f => f.file),
    errors: errors.length > 0 ? errors : undefined,
  };
}

function createHealAICaller(provider: string, model: string, apiKey: string): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        temperature: 0,
        system: HEAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      const content = response.content[0];
      return content?.type === 'text' ? content.text : '';
    }
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      max_tokens: 8192,
      temperature: 0,
      messages: [
        { role: 'system', content: HEAL_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0]?.message.content ?? '';
  };
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
    const skipped = result.history.length - maxDisplay;

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
    if (result.reason === 'max_iterations') {
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
