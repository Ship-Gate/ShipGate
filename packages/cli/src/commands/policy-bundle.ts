/**
 * ISL CLI - Policy Bundle Commands
 * 
 * Commands for creating and verifying policy bundles.
 * 
 * @module @isl-lang/cli/commands/policy-bundle
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import type { ExitCode } from '../exit-codes.js';
import { ExitCode as ExitCodeEnum } from '../exit-codes.js';
import {
  createBundle,
  validateBundle,
  serializeBundle,
  deserializeBundle,
  checkBundleCompatibility,
  type PolicyBundle,
  type BundleValidationResult,
} from '@isl-lang/policy-packs';
import { registry, loadBuiltinPacks } from '@isl-lang/policy-packs';

// ============================================================================
// Types
// ============================================================================

export interface CreateBundleOptions {
  /** Output file path */
  output?: string;
  /** Description for bundle */
  description?: string;
  /** Minimum severity to include */
  minSeverity?: 'error' | 'warning' | 'info';
  /** Pack configuration file */
  config?: string;
  /** Verbose output */
  verbose?: boolean;
}

export interface CreateBundleResult {
  success: boolean;
  bundlePath?: string;
  bundle?: PolicyBundle;
  error?: string;
}

export interface VerifyBundleOptions {
  /** Bundle file path */
  bundle: string;
  /** Whether to check compatibility */
  checkCompatibility?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface VerifyBundleResult {
  success: boolean;
  valid: boolean;
  validation?: BundleValidationResult;
  compatibility?: ReturnType<typeof checkBundleCompatibility>;
  error?: string;
}

// ============================================================================
// Create Bundle Command
// ============================================================================

/**
 * Create a policy bundle from current pack registry
 */
export async function createPolicyBundle(
  options: CreateBundleOptions = {}
): Promise<CreateBundleResult> {
  try {
    // Load built-in packs
    await loadBuiltinPacks(registry);
    const packs = registry.getAllPacks();

    if (packs.length === 0) {
      return {
        success: false,
        error: 'No policy packs available in registry',
      };
    }

    // Load config if provided
    let packConfig: Record<string, any> | undefined;
    if (options.config) {
      try {
        const configContent = await fs.readFile(options.config, 'utf-8');
        packConfig = JSON.parse(configContent);
      } catch (error) {
        return {
          success: false,
          error: `Failed to load config file: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Create bundle
    const bundle = createBundle(packs, packConfig, {
      description: options.description,
      minSeverity: options.minSeverity,
    });

    // Serialize bundle
    const bundleJson = serializeBundle(bundle);

    // Write to file or stdout
    if (options.output) {
      await fs.writeFile(options.output, bundleJson, 'utf-8');
      
      if (options.verbose) {
        console.log(chalk.green(`✓ Bundle created: ${options.output}`));
        console.log(chalk.gray(`  Packs: ${bundle.packs.length}`));
        console.log(chalk.gray(`  Format version: ${bundle.metadata.formatVersion}`));
      }

      return {
        success: true,
        bundlePath: options.output,
        bundle,
      };
    } else {
      // Output to stdout
      console.log(bundleJson);
      return {
        success: true,
        bundle,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print create bundle result
 */
export function printCreateBundleResult(
  result: CreateBundleResult,
  options: { verbose?: boolean } = {}
): void {
  if (result.success) {
    if (result.bundlePath) {
      console.log(chalk.green(`✓ Policy bundle created: ${result.bundlePath}`));
      
      if (options.verbose && result.bundle) {
        console.log('');
        console.log(chalk.bold('Bundle Summary:'));
        console.log(chalk.gray(`  Format version: ${result.bundle.metadata.formatVersion}`));
        console.log(chalk.gray(`  Created: ${result.bundle.metadata.createdAt}`));
        console.log(chalk.gray(`  Packs: ${result.bundle.packs.length}`));
        
        for (const pack of result.bundle.packs) {
          const status = pack.enabled ? chalk.green('✓') : chalk.gray('○');
          console.log(`  ${status} ${pack.packId}@${pack.version}`);
        }
      }
    }
  } else {
    console.error(chalk.red(`✗ Failed to create bundle: ${result.error}`));
  }
}

/**
 * Get exit code for create bundle result
 */
export function getCreateBundleExitCode(result: CreateBundleResult): number {
  return result.success ? ExitCodeEnum.SUCCESS : ExitCodeEnum.ISL_ERROR;
}

// ============================================================================
// Verify Bundle Command
// ============================================================================

/**
 * Verify a policy bundle
 */
export async function verifyPolicyBundle(
  options: VerifyBundleOptions
): Promise<VerifyBundleResult> {
  try {
    // Read bundle file
    const bundleContent = await fs.readFile(options.bundle, 'utf-8');
    const bundle = deserializeBundle(bundleContent);

    // Load available packs
    await loadBuiltinPacks(registry);
    const packs = registry.getAllPacks();

    // Build pack version map
    const packMap = new Map<string, typeof packs>();
    for (const pack of packs) {
      const versions = packMap.get(pack.id) || [];
      versions.push(pack);
      packMap.set(pack.id, versions);
    }

    // Validate bundle
    const validation = validateBundle(bundle, packMap);

    // Check compatibility if requested
    let compatibility: ReturnType<typeof checkBundleCompatibility> | undefined;
    if (options.checkCompatibility !== false) {
      compatibility = checkBundleCompatibility(bundle, packMap);
    }

    return {
      success: true,
      valid: validation.valid,
      validation,
      compatibility,
    };
  } catch (error) {
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print verify bundle result
 */
export function printVerifyBundleResult(
  result: VerifyBundleResult,
  options: { verbose?: boolean } = {}
): void {
  if (!result.success) {
    console.error(chalk.red(`✗ Failed to verify bundle: ${result.error}`));
    return;
  }

  if (result.valid) {
    console.log(chalk.green('✓ Bundle is valid'));
  } else {
    console.log(chalk.red('✗ Bundle validation failed'));
  }

  if (result.validation) {
    const { errors, warnings, deprecations } = result.validation;

    if (errors.length > 0) {
      console.log('');
      console.log(chalk.red('Errors:'));
      for (const error of errors) {
        console.log(chalk.red(`  • ${error}`));
      }
    }

    if (warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow('Warnings:'));
      for (const warning of warnings) {
        console.log(chalk.yellow(`  • ${warning}`));
      }
    }

    if (deprecations.length > 0) {
      console.log('');
      console.log(chalk.yellow('Deprecations:'));
      for (const dep of deprecations) {
        const replacement = dep.replacementId 
          ? chalk.gray(` → Use ${dep.replacementId} instead`)
          : '';
        console.log(chalk.yellow(`  • ${dep.id} (deprecated since ${dep.deprecatedSince})${replacement}`));
        if (options.verbose && dep.message) {
          console.log(chalk.gray(`    ${dep.message}`));
        }
      }
    }
  }

  if (result.compatibility) {
    const { compatible, missingPacks, outdatedVersions, deprecations } = result.compatibility;

    if (compatible) {
      console.log('');
      console.log(chalk.green('✓ Bundle is compatible with current packs'));
    } else {
      console.log('');
      console.log(chalk.yellow('⚠ Bundle compatibility issues:'));
      
      if (missingPacks.length > 0) {
        console.log(chalk.red('  Missing packs:'));
        for (const packId of missingPacks) {
          console.log(chalk.red(`    • ${packId}`));
        }
      }

      if (outdatedVersions.length > 0) {
        console.log(chalk.yellow('  Outdated versions:'));
        for (const { packId, requested, available } of outdatedVersions) {
          console.log(chalk.yellow(`    • ${packId}: requested ${requested}, available ${available}`));
        }
      }
    }

    if (deprecations.length > 0 && options.verbose) {
      console.log('');
      console.log(chalk.yellow('  Deprecations:'));
      for (const dep of deprecations) {
        console.log(chalk.yellow(`    • ${dep.id}: ${dep.message}`));
      }
    }
  }
}

/**
 * Get exit code for verify bundle result
 */
export function getVerifyBundleExitCode(result: VerifyBundleResult): number {
  if (!result.success) {
    return ExitCodeEnum.ISL_ERROR;
  }
  return result.valid ? ExitCodeEnum.SUCCESS : ExitCodeEnum.ISL_ERROR;
}
