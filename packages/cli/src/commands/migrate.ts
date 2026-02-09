// ============================================================================
// ISL Migration Command
// ============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { parse } from '@isl-lang/parser';
import {
  migrateISL,
  getMigrationWarnings,
  CURRENT_ISL_VERSION,
  areVersionsCompatible,
  type ISLVersion,
} from '@isl-lang/parser';
import path from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface MigrateOptions {
  /** Input ISL file path */
  input: string;
  /** Output file path (defaults to input file, overwrites) */
  output?: string;
  /** Target ISL version (defaults to current) */
  targetVersion?: ISLVersion;
  /** Dry run - don't write files */
  dryRun?: boolean;
  /** Show warnings */
  verbose?: boolean;
}

export interface MigrateResult {
  success: boolean;
  inputFile: string;
  outputFile?: string;
  sourceVersion?: string;
  targetVersion: ISLVersion;
  migrated: boolean;
  appliedRules: string[];
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Migration Command
// ============================================================================

/**
 * Migrate an ISL file to a newer version
 */
export async function migrate(
  inputFile: string,
  options: Partial<MigrateOptions> = {}
): Promise<MigrateResult> {
  const {
    output,
    targetVersion = CURRENT_ISL_VERSION,
    dryRun = false,
    verbose = false,
  } = options;

  const result: MigrateResult = {
    success: false,
    inputFile,
    targetVersion,
    migrated: false,
    appliedRules: [],
    warnings: [],
    errors: [],
  };

  try {
    // Read input file
    const content = await readFile(inputFile, 'utf-8');

    // Parse to detect current version
    const parseResult = parse(content, inputFile);
    const sourceVersion = parseResult.islVersion;

    result.sourceVersion = sourceVersion;

    // Check for parse errors
    if (!parseResult.success && parseResult.errors.length > 0) {
      result.errors.push(
        ...parseResult.errors.map(e => `${e.message} (${e.location.line}:${e.location.column})`)
      );
      // Continue anyway - might still be migratable
    }

    // Get migration warnings
    const warnings = getMigrationWarnings(sourceVersion, targetVersion);
    result.warnings = warnings;

    if (verbose && warnings.length > 0) {
      // Warnings already collected
    }

    // Check if migration is needed
    if (areVersionsCompatible(sourceVersion, targetVersion) && sourceVersion === targetVersion) {
      result.success = true;
      result.migrated = false;
      return result;
    }

    // Perform migration
    const migration = migrateISL(content, sourceVersion, targetVersion);
    result.appliedRules = migration.appliedRules;
    result.migrated = migration.appliedRules.length > 0;

    // Determine output file
    const outputFile = output || inputFile;
    result.outputFile = outputFile;

    if (dryRun) {
      result.success = true;
      return result;
    }

    // Write migrated content
    await writeFile(outputFile, migration.migrated, 'utf-8');
    result.success = true;

    return result;
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : String(error)
    );
    return result;
  }
}

/**
 * Print migration result
 */
export function printMigrateResult(result: MigrateResult): void {
  const { success, inputFile, outputFile, sourceVersion, targetVersion, migrated, appliedRules, warnings, errors } = result;

  if (errors.length > 0) {
    console.error('❌ Migration failed:');
    for (const error of errors) {
      console.error(`   ${error}`);
    }
    return;
  }

  if (!success) {
    console.error('❌ Migration failed');
    return;
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    for (const warning of warnings) {
      console.warn(`   ${warning}`);
    }
  }

  if (!migrated) {
    console.log(`✓ File is already at version ${targetVersion}`);
    if (sourceVersion) {
      console.log(`  Source version: ${sourceVersion}`);
    }
    return;
  }

  console.log(`✓ Migrated ${inputFile} from ${sourceVersion || 'unknown'} to ${targetVersion}`);
  
  if (appliedRules.length > 0) {
    console.log('  Applied rules:');
    for (const rule of appliedRules) {
      console.log(`    - ${rule}`);
    }
  }

    if (outputFile && outputFile !== inputFile) {
      console.log(`  Output: ${outputFile}`);
    } else if (!dryRun) {
      console.log('  File updated in place');
    } else {
      console.log('  (dry run - no changes written)');
    }
}

/**
 * Get exit code for migration result
 */
export function getMigrateExitCode(result: MigrateResult): number {
  if (!result.success || result.errors.length > 0) {
    return 1;
  }
  return 0;
}
