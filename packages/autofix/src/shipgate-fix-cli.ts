/**
 * Shipgate Fix CLI
 * 
 * CLI command handler for `shipgate fix`
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import type { Finding } from '@isl-lang/gate';
import { suggestFixes } from './shipgate-fixes.js';
import { applyPatches, previewPatches } from './patch-engine.js';
import type { FixContext } from './shipgate-fixes.js';
import './fixers/index.js'; // Register fixers

// ============================================================================
// Types
// ============================================================================

export interface ShipgateFixOptions {
  /** Project root directory */
  projectRoot: string;
  /** Dry run mode (don't apply changes) */
  dryRun?: boolean;
  /** Apply changes */
  apply?: boolean;
  /** Only apply fixes for specific rules */
  only?: string[];
  /** Evidence bundle path (contains findings) */
  evidencePath?: string;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Output format */
  format?: 'pretty' | 'json';
}

// ============================================================================
// Main CLI Function
// ============================================================================

/**
 * Run shipgate fix command
 */
export async function runShipgateFix(
  options: ShipgateFixOptions
): Promise<{ success: boolean; exitCode: number }> {
  const {
    projectRoot,
    dryRun = false,
    apply = false,
    only = [],
    evidencePath,
    minConfidence = 0.6,
    format = 'pretty',
  } = options;

  try {
    // Load findings from evidence bundle or stdin
    const findings = await loadFindings(evidencePath, projectRoot);
    
    if (findings.length === 0) {
      if (format === 'json') {
        console.log(JSON.stringify({ success: true, suggestions: [], total: 0 }, null, 2));
      } else {
        console.log(chalk.green('✓ No findings to fix'));
      }
      return { success: true, exitCode: 0 };
    }

    // Load truthpack data
    const truthpack = await loadTruthpack(projectRoot);

    // Create fix context
    const context: FixContext = {
      projectRoot,
      truthpack,
      minConfidence,
      onlyRules: only.length > 0 ? only : undefined,
    };

    // Suggest fixes
    const result = await suggestFixes(findings, context);

    if (result.total === 0) {
      if (format === 'json') {
        console.log(JSON.stringify({ success: true, suggestions: [], total: 0 }, null, 2));
      } else {
        console.log(chalk.yellow('⚠ No fixes suggested (all below confidence threshold)'));
      }
      return { success: true, exitCode: 0 };
    }

    // Extract patches
    const patches = result.suggestions.map(s => s.patch);

    // Apply or preview patches
    if (apply && !dryRun) {
      const applyResult = await applyPatches(patches, {
        projectRoot,
        dryRun: false,
      });

      if (format === 'json') {
        console.log(JSON.stringify({
          success: applyResult.success,
          applied: applyResult.applied.length,
          failed: applyResult.failed.length,
          filesModified: applyResult.filesModified,
          diff: applyResult.diff,
        }, null, 2));
      } else {
        printApplyResult(applyResult, result);
      }

      return {
        success: applyResult.success,
        exitCode: applyResult.success ? 0 : 1,
      };
    } else {
      // Dry run - preview only
      const previewResult = await previewPatches(patches, {
        projectRoot,
        dryRun: true,
      });

      if (format === 'json') {
        console.log(JSON.stringify({
          success: true,
          dryRun: true,
          suggestions: result.suggestions.map(s => ({
            rule: s.rule,
            why: s.why,
            confidence: s.confidence,
            file: s.patch.file,
            line: s.patch.line,
          })),
          diff: previewResult.diff,
          total: result.total,
        }, null, 2));
      } else {
        printPreviewResult(previewResult, result);
      }

      return { success: true, exitCode: 0 };
    }
  } catch (error) {
    if (format === 'json') {
      console.error(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, null, 2));
    } else {
      console.error(chalk.red('✗ Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
    return { success: false, exitCode: 1 };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load findings from evidence bundle or stdin
 */
async function loadFindings(
  evidencePath: string | undefined,
  projectRoot: string
): Promise<Finding[]> {
  // Try evidence bundle first
  if (evidencePath) {
    const fullPath = resolve(projectRoot, evidencePath);
    if (existsSync(fullPath)) {
      const content = await readFile(fullPath, 'utf-8');
      const bundle = JSON.parse(content);
      return bundle.results?.findings || [];
    }
  }

  // Try default evidence bundle location
  const defaultPaths = [
    join(projectRoot, '.shipgate', 'evidence.json'),
    join(projectRoot, 'evidence.json'),
    join(projectRoot, '.vibecheck', 'evidence.json'),
  ];

  for (const path of defaultPaths) {
    if (existsSync(path)) {
      const content = await readFile(path, 'utf-8');
      const bundle = JSON.parse(content);
      return bundle.results?.findings || [];
    }
  }

  return [];
}

/**
 * Load truthpack data
 */
async function loadTruthpack(projectRoot: string): Promise<FixContext['truthpack']> {
  const truthpackDir = join(projectRoot, '.guardrail', 'truthpack');
  
  const routesPath = join(truthpackDir, 'routes.json');
  const envPath = join(truthpackDir, 'env.json');

  type TRoutes = NonNullable<FixContext['truthpack']>['routes'];
  type TEnv = NonNullable<FixContext['truthpack']>['env'];
  let routes: TRoutes = [];
  let env: TEnv = [];

  if (existsSync(routesPath)) {
    try {
      const content = await readFile(routesPath, 'utf-8');
      const data = JSON.parse(content) as { routes?: TRoutes };
      routes = (Array.isArray(data.routes) ? data.routes : []) as TRoutes;
    } catch {
      // Ignore
    }
  }

  if (existsSync(envPath)) {
    try {
      const content = await readFile(envPath, 'utf-8');
      const data = JSON.parse(content) as { variables?: TEnv };
      env = (Array.isArray(data.variables) ? data.variables : []) as TEnv;
    } catch {
      // Ignore
    }
  }

  return { routes, env };
}

/**
 * Print preview result
 */
function printPreviewResult(
  previewResult: Awaited<ReturnType<typeof previewPatches>>,
  suggestionsResult: Awaited<ReturnType<typeof suggestFixes>>
): void {
  console.log(chalk.bold.cyan('\n📋 Shipgate Fix Preview (Dry Run)\n'));
  
  console.log(chalk.gray(`Found ${suggestionsResult.total} fix suggestion(s)\n`));

  // Group by rule
  const byRule = new Map<string, typeof suggestionsResult.suggestions>();
  for (const suggestion of suggestionsResult.suggestions) {
    const existing = byRule.get(suggestion.rule) || [];
    existing.push(suggestion);
    byRule.set(suggestion.rule, existing);
  }

  for (const [rule, suggestions] of byRule) {
    console.log(chalk.bold(`Rule: ${rule}`));
    for (const suggestion of suggestions) {
      console.log(`  ${chalk.gray('→')} ${suggestion.why}`);
      console.log(`    File: ${suggestion.patch.file}:${suggestion.patch.line}`);
      console.log(`    Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
    }
    console.log('');
  }

  // Show diff
  if (previewResult.diff) {
    console.log(chalk.bold('\n📝 Diff Preview:\n'));
    console.log(previewResult.diff);
  }

  console.log(chalk.yellow('\n⚠ Run with --apply to apply these changes\n'));
}

/**
 * Print apply result
 */
function printApplyResult(
  applyResult: Awaited<ReturnType<typeof applyPatches>>,
  _suggestionsResult: Awaited<ReturnType<typeof suggestFixes>>
): void {
  console.log(chalk.bold.cyan('\n✅ Shipgate Fix Applied\n'));

  console.log(chalk.green(`✓ Applied ${applyResult.applied.length} patch(es)`));
  
  if (applyResult.failed.length > 0) {
    console.log(chalk.red(`✗ Failed ${applyResult.failed.length} patch(es)`));
    for (const failure of applyResult.failed) {
      console.log(`  - ${failure.patch.file}:${failure.patch.line} - ${failure.reason}`);
    }
  }

  if (applyResult.filesModified.length > 0) {
    console.log(chalk.gray(`\nModified files:`));
    for (const file of applyResult.filesModified) {
      console.log(`  - ${file}`);
    }
  }

  console.log('');
}
