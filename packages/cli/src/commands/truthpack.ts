/**
 * Truthpack Commands
 *
 * Commands for building and diffing truthpack v2.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import {
  buildTruthpackSmart,
  type BuildTruthpackOptions,
  type BuildTruthpackResult,
} from '@isl-lang/truthpack-v2';
import {
  detectDrift,
  loadTruthpackFromDir,
  type DriftReport,
} from '@isl-lang/truthpack-v2/drift';

export interface TruthpackBuildOptions {
  /** Repository root (default: current working directory) */
  repoRoot?: string;
  /** Output directory (default: .shipgate/truthpack) */
  outputDir?: string;
  /** Include patterns */
  includePatterns?: string[];
  /** Exclude patterns */
  excludePatterns?: string[];
  /** Include dependencies */
  includeDependencies?: boolean;
  /** Detect DB schema */
  detectDbSchema?: boolean;
  /** Detect auth model */
  detectAuth?: boolean;
  /** Detect runtime probes */
  detectRuntimeProbes?: boolean;
}

export interface TruthpackBuildResult {
  success: boolean;
  truthpackPath?: string;
  errors: string[];
  warnings: string[];
  stats: BuildTruthpackResult['stats'];
}

export interface TruthpackDiffOptions {
  /** Repository root */
  repoRoot?: string;
  /** Old truthpack directory */
  oldDir?: string;
  /** New truthpack directory (default: .shipgate/truthpack) */
  newDir?: string;
}

export interface TruthpackDiffResult {
  success: boolean;
  report?: DriftReport;
  errors: string[];
}

/**
 * Build truthpack
 */
export async function truthpackBuild(
  options: TruthpackBuildOptions = {}
): Promise<TruthpackBuildResult> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const outputDir = options.outputDir ?? path.join(repoRoot, '.shipgate', 'truthpack');

  const buildOptions: BuildTruthpackOptions = {
    repoRoot,
    outputDir,
    includePatterns: options.includePatterns,
    excludePatterns: options.excludePatterns,
    includeDependencies: options.includeDependencies,
    detectDbSchema: options.detectDbSchema,
    detectAuth: options.detectAuth,
    detectRuntimeProbes: options.detectRuntimeProbes,
  };

  const result = await buildTruthpackSmart(buildOptions);

  return {
    success: result.success,
    truthpackPath: result.success ? path.join(outputDir, 'truthpack.json') : undefined,
    errors: result.errors,
    warnings: result.warnings,
    stats: result.stats,
  };
}

/**
 * Diff truthpack
 */
export async function truthpackDiff(
  options: TruthpackDiffOptions = {}
): Promise<TruthpackDiffResult> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const newDir = options.newDir ?? path.join(repoRoot, '.shipgate', 'truthpack');
  const oldDir = options.oldDir ?? path.join(repoRoot, '.shipgate', 'truthpack', '.previous');

  try {
    // Load old truthpack
    const oldTruthpack = await loadTruthpackFromDir(oldDir);
    if (!oldTruthpack) {
      return {
        success: false,
        errors: [`Old truthpack not found at ${oldDir}. Run 'shipgate truthpack build' first.`],
      };
    }

    // Load new truthpack
    const newTruthpack = await loadTruthpackFromDir(newDir);
    if (!newTruthpack) {
      return {
        success: false,
        errors: [`New truthpack not found at ${newDir}. Run 'shipgate truthpack build' first.`],
      };
    }

    // Detect drift
    const report = detectDrift(oldTruthpack, newTruthpack);

    return {
      success: true,
      report,
      errors: [],
    };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

/**
 * Print build result
 */
export function printTruthpackBuildResult(
  result: TruthpackBuildResult,
  options: { format?: 'json' | 'text'; verbose?: boolean } = {}
): void {
  const { format = 'text', verbose = false } = options;

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    console.error('❌ Truthpack build failed');
    for (const error of result.errors) {
      console.error(`  Error: ${error}`);
    }
    return;
  }

  console.log('✅ Truthpack built successfully');
  console.log(`   Output: ${result.truthpackPath}`);
  console.log(`   Files scanned: ${result.stats.filesScanned}`);
  console.log(`   Routes found: ${result.stats.routesFound}`);
  console.log(`   Env vars found: ${result.stats.envVarsFound}`);
  console.log(`   Duration: ${result.stats.durationMs}ms`);

  if (verbose && result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const warning of result.warnings) {
      console.log(`   ${warning}`);
    }
  }
}

/**
 * Print diff result
 */
export function printTruthpackDiffResult(
  result: TruthpackDiffResult,
  options: { format?: 'json' | 'text'; verbose?: boolean } = {}
): void {
  const { format = 'json', verbose = false } = options;

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    console.error('❌ Truthpack diff failed');
    for (const error of result.errors) {
      console.error(`  Error: ${error}`);
    }
    return;
  }

  if (!result.report) {
    console.log('No drift report available');
    return;
  }

  const { report } = result;

  if (!report.hasDrift) {
    console.log('✅ No drift detected');
    return;
  }

  console.log('📊 Drift Report');
  console.log(`   Added: ${report.summary.added}`);
  console.log(`   Removed: ${report.summary.removed}`);
  console.log(`   Changed: ${report.summary.changed}`);
  console.log(`   Breaking: ${report.summary.breaking}`);

  if (verbose && report.changes.length > 0) {
    console.log('\n📝 Changes:');
    for (const change of report.changes) {
      const icon = change.impact === 'breaking' ? '🔴' :
                   change.impact === 'high' ? '🟠' :
                   change.impact === 'medium' ? '🟡' : '🟢';
      console.log(`   ${icon} [${change.category}] ${change.type}: ${change.item}`);
      console.log(`      Impact: ${change.impact}`);
      console.log(`      ${change.description}`);
    }
  }
}

/**
 * Get exit code for build result
 */
export function getTruthpackBuildExitCode(result: TruthpackBuildResult): number {
  return result.success ? 0 : 1;
}

/**
 * Get exit code for diff result
 */
export function getTruthpackDiffExitCode(result: TruthpackDiffResult): number {
  if (!result.success) return 1;
  if (!result.report) return 1;
  // Exit with non-zero if there are breaking changes
  return result.report.summary.breaking > 0 ? 1 : 0;
}
