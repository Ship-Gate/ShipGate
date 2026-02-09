// ============================================================================
// ISL Bind Command - Automatic implementation discovery
// ============================================================================

import { discover, writeBindingsFile } from '@isl-lang/isl-discovery';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import type { DiscoveryResult } from '@isl-lang/isl-discovery';

export interface BindOptions {
  /** Spec file(s) to bind */
  spec: string | string[];
  /** Implementation directory */
  impl?: string;
  /** Output file path */
  output?: string;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Code directories to search */
  codeDirs?: string[];
  /** Include patterns */
  include?: string[];
  /** Exclude patterns */
  exclude?: string[];
  /** Verbose output */
  verbose?: boolean;
  /** Format */
  format?: 'pretty' | 'json';
}

export interface BindResult {
  success: boolean;
  bindingsFile?: string;
  result?: DiscoveryResult;
  error?: string;
}

/**
 * Bind ISL specs to implementation code
 */
export async function bind(options: BindOptions): Promise<BindResult> {
  const {
    spec,
    impl = '.',
    output,
    minConfidence = 0.3,
    codeDirs,
    include,
    exclude,
    verbose = false,
    format = 'pretty',
  } = options;

  try {
    // Resolve paths
    const rootDir = resolve(impl);
    const specFiles = Array.isArray(spec) ? spec : [spec];
    const resolvedSpecFiles = specFiles.map(s => resolve(s));

    // Validate spec files exist
    for (const specFile of resolvedSpecFiles) {
      if (!existsSync(specFile)) {
        return {
          success: false,
          error: `Spec file not found: ${specFile}`,
        };
      }
    }

    // Determine output file
    const bindingsFilePath = output
      ? resolve(output)
      : join(rootDir, '.shipgate.bindings.json');

    if (verbose && format === 'pretty') {
      console.log(chalk.bold.cyan('\n🔗 ISL Bind - Discovery Engine\n'));
      console.log(chalk.gray(`  Spec files: ${resolvedSpecFiles.join(', ')}`));
      console.log(chalk.gray(`  Root directory: ${rootDir}`));
      console.log(chalk.gray(`  Output: ${bindingsFilePath}\n`));
    }

    // Run discovery
    const result = await discover({
      rootDir,
      specFiles: resolvedSpecFiles,
      codeDirs,
      includePatterns: include,
      excludePatterns: exclude,
      minConfidence,
      verbose,
    });

    // Write bindings file
    await writeBindingsFile(bindingsFilePath, result, resolvedSpecFiles);

    if (format === 'json') {
      console.log(JSON.stringify({
        success: true,
        bindingsFile: bindingsFilePath,
        stats: result.stats,
        bindings: result.bindings.map(b => ({
          isl: {
            type: b.islSymbol.type,
            name: b.islSymbol.name,
            domain: b.islSymbol.domain,
          },
          code: {
            type: b.codeSymbol.type,
            name: b.codeSymbol.name,
            file: b.codeSymbol.file,
          },
          confidence: b.confidence,
          strategy: b.strategy,
        })),
        unboundSymbols: result.unboundSymbols.map(s => ({
          type: s.type,
          name: s.name,
          domain: s.domain,
        })),
      }, null, 2));
    } else {
      printBindResult({
        success: true,
        bindingsFile: bindingsFilePath,
        result,
      }, { verbose });
    }

    return {
      success: true,
      bindingsFile: bindingsFilePath,
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Print bind result
 */
export function printBindResult(result: BindResult, options: { verbose?: boolean } = {}): void {
  if (!result.success) {
    console.error(chalk.red(`\n✗ Bind failed: ${result.error}\n`));
    return;
  }

  if (!result.result) {
    return;
  }

  const { result: discoveryResult, bindingsFile } = result;
  const { stats, bindings, unboundSymbols } = discoveryResult;

  console.log(chalk.bold.green('\n✓ Bindings generated successfully\n'));
  console.log(chalk.gray(`  Output: ${bindingsFile}\n`));

  // Statistics
  console.log(chalk.bold('Statistics:'));
  console.log(`  ISL symbols: ${stats.totalISLSymbols}`);
  console.log(`  Code symbols: ${stats.totalCodeSymbols}`);
  console.log(`  Bindings: ${stats.boundCount}`);
  console.log(`  Coverage: ${stats.totalISLSymbols > 0 ? ((stats.boundCount / stats.totalISLSymbols) * 100).toFixed(1) : 0}%`);
  console.log(`  Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%\n`);

  // Strategy breakdown
  if (Object.keys(stats.strategyBreakdown).length > 0) {
    console.log(chalk.bold('Strategy breakdown:'));
    for (const [strategy, count] of Object.entries(stats.strategyBreakdown)) {
      console.log(`  ${strategy}: ${count}`);
    }
    console.log('');
  }

  // High confidence bindings
  const highConfidence = bindings.filter(b => b.confidence >= 0.8);
  if (highConfidence.length > 0) {
    console.log(chalk.bold.green(`High confidence bindings (≥80%): ${highConfidence.length}\n`));
    for (const binding of highConfidence.slice(0, 10)) {
      console.log(`  ${chalk.cyan(binding.islSymbol.name)} → ${chalk.yellow(binding.codeSymbol.name)}`);
      console.log(`    ${chalk.gray(binding.codeSymbol.file)}`);
      console.log(`    Confidence: ${(binding.confidence * 100).toFixed(1)}% (${binding.strategy})\n`);
    }
    if (highConfidence.length > 10) {
      console.log(chalk.gray(`  ... and ${highConfidence.length - 10} more\n`));
    }
  }

  // Unbound symbols
  if (unboundSymbols.length > 0) {
    console.log(chalk.bold.yellow(`Unbound symbols: ${unboundSymbols.length}\n`));
    for (const symbol of unboundSymbols.slice(0, 10)) {
      console.log(`  ${chalk.yellow(symbol.type)} ${chalk.cyan(symbol.name)} (${symbol.domain})`);
    }
    if (unboundSymbols.length > 10) {
      console.log(chalk.gray(`  ... and ${unboundSymbols.length - 10} more\n`));
    }
  }

  if (options.verbose) {
    // All bindings
    console.log(chalk.bold('\nAll bindings:\n'));
    for (const binding of bindings) {
      console.log(`  ${chalk.cyan(`${binding.islSymbol.domain}.${binding.islSymbol.name}`)}`);
      console.log(`    → ${chalk.yellow(`${binding.codeSymbol.type}:${binding.codeSymbol.name}`)}`);
      console.log(`    ${chalk.gray(binding.codeSymbol.file)}`);
      console.log(`    Confidence: ${(binding.confidence * 100).toFixed(1)}%`);
      if (binding.evidence.length > 0) {
        console.log(`    Evidence:`);
        for (const ev of binding.evidence) {
          console.log(`      - ${ev.description} (${(ev.confidence * 100).toFixed(0)}%)`);
        }
      }
      console.log('');
    }
  }
}

/**
 * Get exit code for bind command
 */
export function getBindExitCode(result: BindResult): number {
  if (!result.success) return 1;
  if (!result.result) return 1;

  // Consider it a success if we bound at least 50% of symbols
  const coverage = result.result.stats.totalISLSymbols > 0
    ? result.result.stats.boundCount / result.result.stats.totalISLSymbols
    : 0;

  return coverage >= 0.5 ? 0 : 1;
}
