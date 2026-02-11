/**
 * Policy Engine CLI Command
 *
 * Runs the DSL-based policy engine against a project directory.
 *
 * Usage:
 *   isl policy engine-check [dir]          # Run policy engine on directory
 *   isl policy engine-check --pack starter  # Only run starter pack
 *   isl policy engine-check --ci           # CI mode (JSON + exit code)
 */

import { readFile, readdir, stat } from 'fs/promises';
import { resolve, join, relative } from 'path';
import chalk from 'chalk';

import type {
  PolicyEngineResult,
  PolicyEvalInput,
  PolicyFileInput,
  PolicyEnginePack,
} from '@isl-lang/isl-policy-engine';
import {
  evaluate,
  formatTerminal,
  formatJSON,
  formatCILine,
  starterPolicyPack,
} from '@isl-lang/isl-policy-engine';

// ============================================================================
// Types
// ============================================================================

export interface PolicyEngineCheckOptions {
  /** Directory to check (default: cwd) */
  directory?: string;
  /** Only run specific pack IDs */
  packs?: string[];
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** CI mode */
  ci?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Glob patterns for files to include */
  include?: string[];
  /** Glob patterns for files to exclude */
  exclude?: string[];
}

export interface PolicyEngineCheckResult {
  /** Whether all policies passed */
  passed: boolean;
  /** The engine result */
  engineResult: PolicyEngineResult;
  /** Directory that was checked */
  directory: string;
}

// ============================================================================
// File Discovery
// ============================================================================

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'];
const DEFAULT_EXCLUDES = [
  'node_modules', 'dist', '.git', '.turbo', 'coverage',
  '__mocks__', '__fixtures__', 'test-fixtures', 'fixtures',
];

async function discoverFiles(
  dir: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
  excludeDirs: string[] = DEFAULT_EXCLUDES,
): Promise<PolicyFileInput[]> {
  const files: PolicyFileInput[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf('.'));
        if (!extensions.includes(ext)) continue;
        // Skip test files
        if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
        if (entry.name.endsWith('.d.ts')) continue;

        try {
          const content = await readFile(fullPath, 'utf-8');
          files.push({ path: fullPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(dir);
  return files;
}

// ============================================================================
// Claim Extraction (lightweight, pattern-based)
// ============================================================================

import type { Claim, Evidence } from '@isl-lang/isl-firewall';

function extractClaims(files: PolicyFileInput[], baseDir: string): Claim[] {
  const claims: Claim[] = [];
  let claimId = 0;

  for (const file of files) {
    const relPath = relative(baseDir, file.path);

    // Extract API endpoint claims
    const routePatterns = [
      /(?:app|router)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    ];
    for (const pattern of routePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(file.content)) !== null) {
        claims.push({
          id: `claim-${++claimId}`,
          type: 'api_endpoint',
          value: match[2],
          location: { line: lineAt(file.content, match.index), column: 0, length: match[0].length },
          confidence: 0.9,
          context: file.content.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50),
        });
      }
    }

    // Extract env variable claims
    const envPatterns = [
      /process\.env\.([A-Z_][A-Z0-9_]*)/g,
      /process\.env\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
    ];
    for (const pattern of envPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(file.content)) !== null) {
        const varName = match[1];
        if (['NODE_ENV', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL'].includes(varName)) continue;
        claims.push({
          id: `claim-${++claimId}`,
          type: 'env_variable',
          value: varName,
          location: { line: lineAt(file.content, match.index), column: 0, length: match[0].length },
          confidence: 0.95,
          context: file.content.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50),
        });
      }
    }
  }

  return claims;
}

function lineAt(content: string, index: number): number {
  return (content.slice(0, index).match(/\n/g) || []).length + 1;
}

// ============================================================================
// Pack Resolution
// ============================================================================

function resolvePacks(packIds?: string[]): PolicyEnginePack[] {
  // Built-in packs from the policy engine
  const available: PolicyEnginePack[] = [starterPolicyPack];

  if (!packIds || packIds.length === 0) {
    return available;
  }

  return available.filter(p => packIds.includes(p.id));
}

// ============================================================================
// Main Command
// ============================================================================

export async function policyEngineCheck(
  options: PolicyEngineCheckOptions = {},
): Promise<PolicyEngineCheckResult> {
  const dir = resolve(options.directory ?? process.cwd());

  // Discover files
  const files = await discoverFiles(dir);

  // Extract claims
  const claims = extractClaims(files, dir);

  // Build eval input
  const input: PolicyEvalInput = {
    claims,
    evidence: [], // No evidence resolver wired yet — claims are "unverified"
    files,
    verdict: undefined,
    confidence: claims.length > 0 ? 50 : 0,
    trustScore: undefined,
    existingViolations: [],
  };

  // Resolve packs
  const packs = resolvePacks(options.packs);

  // Evaluate
  const engineResult = evaluate(packs, input);

  return {
    passed: engineResult.allowed,
    engineResult,
    directory: dir,
  };
}

// ============================================================================
// Output Formatters
// ============================================================================

export function printPolicyEngineResult(
  result: PolicyEngineCheckResult,
  options: { format?: string; verbose?: boolean; ci?: boolean } = {},
): void {
  const { format = 'pretty', ci = false } = options;

  if (format === 'json' || ci) {
    console.log(formatJSON(result.engineResult));
    if (ci) {
      process.stderr.write(formatCILine(result.engineResult) + '\n');
    }
    return;
  }

  // Pretty print
  const r = result.engineResult;

  console.log('');
  if (r.allowed) {
    console.log(chalk.bold.green('  +-------------------------------------+'));
    console.log(chalk.bold.green('  |        POLICY CHECK: PASSED          |'));
    console.log(chalk.bold.green('  +-------------------------------------+'));
  } else {
    console.log(chalk.bold.red('  +-------------------------------------+'));
    console.log(chalk.bold.red('  |        POLICY CHECK: BLOCKED         |'));
    console.log(chalk.bold.red('  +-------------------------------------+'));
  }

  console.log('');
  console.log(chalk.gray(`  ${r.summary}`));
  console.log('');

  // Blockers
  if (r.blockers.length > 0) {
    console.log(chalk.red('  Blockers:'));
    for (const b of r.blockers) {
      console.log(chalk.red(`    [BLOCK] ${b.policyName} (${b.policyId})`));
      console.log(chalk.gray(`            ${b.explanation}`));
      if (b.evidenceRefs.length > 0) {
        console.log(chalk.gray(`            Evidence:`));
        for (const ref of b.evidenceRefs) {
          console.log(chalk.gray(`              - ${ref.label}: ${ref.detail}`));
        }
      }
      console.log('');
    }
  }

  // Warnings
  if (r.warnings.length > 0) {
    console.log(chalk.yellow('  Warnings:'));
    for (const w of r.warnings) {
      console.log(chalk.yellow(`    [WARN]  ${w.policyName} (${w.policyId})`));
      console.log(chalk.gray(`            ${w.explanation}`));
      console.log('');
    }
  }

  // Stats
  console.log(chalk.gray(`  Policies evaluated: ${r.metadata.policiesEvaluated}`));
  console.log(chalk.gray(`  Policies triggered: ${r.metadata.policiesTriggered}`));
  console.log(chalk.gray(`  Duration: ${r.durationMs}ms`));
  console.log(chalk.gray(`  Directory: ${result.directory}`));
  console.log('');
}

export function getPolicyEngineExitCode(result: PolicyEngineCheckResult): number {
  return result.passed ? 0 : 1;
}
