/**
 * Provenance Commands
 *
 * Full AI code provenance system — line-level attribution that maps every
 * line to its authoring agent (Claude, Copilot, Codex, Gemini, etc.),
 * the human operator, and timestamp.
 *
 * Usage:
 *   shipgate provenance                     # Project summary
 *   shipgate provenance src/api/users.ts    # File-level blame
 *   shipgate provenance init                # Install hook + create session
 *   shipgate provenance --format json       # JSON export
 *   shipgate provenance --format csv        # CSV export
 *   shipgate provenance --summary           # High-level stats only
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface ProvenanceInitOptions {
  directory?: string;
  force?: boolean;
  generator?: string;
  model?: string;
  /** Install pre-commit hook */
  hook?: boolean;
}

export interface ProvenanceInitResult {
  success: boolean;
  path?: string;
  hookInstalled?: boolean;
  hookMessage?: string;
  error?: string;
}

export interface ProvenanceScanCommandOptions {
  path?: string;
  format?: 'text' | 'json' | 'csv';
  summary?: boolean;
  since?: string;
  maxFiles?: number;
  include?: string;
  exclude?: string;
}

export interface ProvenanceScanResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Provenance Init
// ============================================================================

export async function provenanceInit(
  options: ProvenanceInitOptions = {}
): Promise<ProvenanceInitResult> {
  const dir = options.directory ?? process.cwd();

  try {
    const { initProvenanceSession, installHook, detectActiveTool } =
      await import('@isl-lang/code-provenance');

    const detected = detectActiveTool(dir);
    const generator = options.generator ?? detected?.tool ?? 'unknown';
    const model = options.model ?? detected?.model;

    const { path: sessionPath } = initProvenanceSession(dir, generator, model);

    let hookInstalled = false;
    let hookMessage = '';

    if (options.hook !== false) {
      const hookResult = installHook(dir);
      hookInstalled = hookResult.installed;
      hookMessage = hookResult.message;
    }

    return {
      success: true,
      path: sessionPath,
      hookInstalled,
      hookMessage,
    };
  } catch (err) {
    // Fallback if @isl-lang/code-provenance is not built yet
    const shipgateDir = join(dir, '.shipgate');
    const provenancePath = join(shipgateDir, 'provenance.json');

    if (existsSync(provenancePath) && !options.force) {
      return {
        success: false,
        error: `.shipgate/provenance.json already exists. Use --force to overwrite.`,
      };
    }

    await mkdir(shipgateDir, { recursive: true });

    const template = {
      generator: options.generator ?? 'cursor',
      model: options.model ?? 'claude-sonnet-4',
      operator: '',
      sessionStarted: new Date().toISOString(),
      autoDetected: false,
    };

    await writeFile(provenancePath, JSON.stringify(template, null, 2) + '\n', 'utf-8');

    return {
      success: true,
      path: provenancePath,
    };
  }
}

// ============================================================================
// Provenance Scan (project or file)
// ============================================================================

export async function provenanceScan(
  options: ProvenanceScanCommandOptions = {}
): Promise<ProvenanceScanResult> {
  try {
    const {
      buildProjectAttribution,
      buildSingleFileAttribution,
      formatSummaryReport,
      formatFileBlameReport,
      toJSON,
      toCSV,
      fileToJSON,
      fileToCSV,
    } = await import('@isl-lang/code-provenance');

    const cwd = process.cwd();
    const targetPath = options.path;

    if (targetPath && existsSync(resolve(cwd, targetPath)) && !isDirectory(resolve(cwd, targetPath))) {
      const fileAttr = buildSingleFileAttribution(targetPath, cwd);

      if (options.format === 'json') {
        return { success: true, output: fileToJSON(fileAttr), data: fileAttr };
      }
      if (options.format === 'csv') {
        return { success: true, output: fileToCSV(fileAttr), data: fileAttr };
      }
      return { success: true, output: formatFileBlameReport(fileAttr), data: fileAttr };
    }

    const include = options.include?.split(',').map((e) => `**/*.${e.trim()}`) ?? undefined;
    const exclude = options.exclude?.split(',').map((e) => `**/${e.trim()}/**`) ?? undefined;

    const projectAttr = buildProjectAttribution({
      cwd,
      include,
      exclude,
      since: options.since,
      maxFiles: options.maxFiles,
    });

    if (options.format === 'json') {
      const json = options.summary
        ? JSON.stringify(projectAttr.summary, null, 2)
        : toJSON(projectAttr);
      return { success: true, output: json, data: projectAttr };
    }

    if (options.format === 'csv') {
      return { success: true, output: toCSV(projectAttr), data: projectAttr };
    }

    return { success: true, output: formatSummaryReport(projectAttr), data: projectAttr };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function isDirectory(p: string): boolean {
  try {
    const { statSync } = require('fs');
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// ============================================================================
// Print helpers
// ============================================================================

export function printProvenanceInitResult(
  result: ProvenanceInitResult,
  options: { format?: string } = {}
): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(chalk.green('  Provenance initialized'));
    if (result.path) {
      console.log(chalk.gray(`  Session: ${result.path}`));
    }
    if (result.hookInstalled) {
      console.log(chalk.gray(`  Hook: ${result.hookMessage}`));
    }
    console.log('');
    console.log(chalk.gray('  AI commits will now be automatically tagged with:'));
    console.log(chalk.gray('    AI-Tool: <agent>/<model>'));
    console.log(chalk.gray('    AI-Session: <timestamp>'));
    console.log(chalk.gray('    AI-Operator: <email>'));
    console.log('');
    console.log(chalk.gray('  Override with env vars: SHIPGATE_AI_TOOL, SHIPGATE_AI_MODEL'));
  } else {
    console.error(chalk.red('Error:'), result.error);
  }
}

export function printProvenanceScanResult(
  result: ProvenanceScanResult,
  _options: { format?: string } = {}
): void {
  if (!result.success) {
    console.error(chalk.red('Error:'), result.error);
    return;
  }
  console.log(result.output);
}

export function getProvenanceScanExitCode(result: ProvenanceScanResult): number {
  return result.success ? 0 : 1;
}
