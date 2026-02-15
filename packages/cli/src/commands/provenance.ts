/**
 * Provenance Commands
 *
 * AI provenance metadata for proof bundles.
 * Vendor-agnostic: cursor, copilot, claude, etc.
 *
 * Usage:
 *   shipgate provenance init   # Create .shipgate/provenance.json template
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { PROVENANCE_TEMPLATE } from '@isl-lang/proof';

// ============================================================================
// Types
// ============================================================================

export interface ProvenanceInitOptions {
  /** Project root (default: cwd) */
  directory?: string;
  /** Force overwrite existing provenance.json */
  force?: boolean;
}

export interface ProvenanceInitResult {
  success: boolean;
  path?: string;
  error?: string;
}

// ============================================================================
// Init
// ============================================================================

/**
 * Create a template .shipgate/provenance.json for AI provenance metadata.
 * Does not overwrite unless --force.
 */
export async function provenanceInit(
  options: ProvenanceInitOptions = {}
): Promise<ProvenanceInitResult> {
  const dir = options.directory ?? process.cwd();
  const shipgateDir = join(dir, '.shipgate');
  const provenancePath = join(shipgateDir, 'provenance.json');

  try {
    const { existsSync } = await import('fs');
    if (existsSync(provenancePath) && !options.force) {
      return {
        success: false,
        error: `.shipgate/provenance.json already exists. Use --force to overwrite.`,
      };
    }

    await mkdir(shipgateDir, { recursive: true });

    const template = { ...PROVENANCE_TEMPLATE };
    const contextLine = template.contextDigest
      ? `  "contextDigest": "${template.contextDigest}",\n`
      : '';

    const content = `{
  "generator": "${template.generator}",
  "model": "${template.model}",
  "promptDigest": "${template.promptDigest}",
${contextLine}  "generatedAt": "${template.generatedAt}"
}
`;
    await writeFile(provenancePath, content, 'utf-8');

    return {
      success: true,
      path: provenancePath,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Print provenance init result
 */
export function printProvenanceInitResult(
  result: ProvenanceInitResult,
  options: { format?: 'pretty' | 'json' } = {}
): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(chalk.green('Created'), result.path);
    console.log(chalk.gray('  Fill in generator, model, promptDigest. Or use env vars:'));
    console.log(chalk.gray('  SHIPGATE_AI_TOOL, SHIPGATE_AI_MODEL, SHIPGATE_PROMPT_SHA'));
  } else {
    console.error(chalk.red('Error:'), result.error);
  }
}
