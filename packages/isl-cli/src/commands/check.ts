/**
 * Check Command
 * 
 * Validates ISL syntax and semantics with best-in-class error messages.
 */

import { readFile } from 'fs/promises';
import chalk from 'chalk';
import { parseISL } from '@isl-lang/isl-core';
import {
  formatDiagnostics,
  registerSource,
  clearSourceCache,
  type Diagnostic,
} from '@isl-lang/errors';

export interface CheckOptions {
  verbose?: boolean;
  noColor?: boolean;
}

export interface CheckResult {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  rawErrors?: string[]; // For backward compat
}

export async function check(filePath: string, options: CheckOptions = {}): Promise<CheckResult> {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  try {
    // Read file
    const source = await readFile(filePath, 'utf-8');

    // Register source for error formatting (shows code snippets)
    clearSourceCache();
    registerSource(filePath, source);

    // Parse
    const { ast, errors: parseErrors } = parseISL(source, filePath);

    // Convert parse errors to unified diagnostics
    for (const error of parseErrors) {
      const location = 'span' in error 
        ? {
            file: filePath,
            line: error.span.start.line,
            column: error.span.start.column,
            endLine: error.span.end.line,
            endColumn: error.span.end.column,
          }
        : {
            file: filePath,
            line: error.line ?? 1,
            column: error.column ?? 1,
            endLine: error.line ?? 1,
            endColumn: (error.column ?? 1) + 1,
          };

      const diag: Diagnostic = {
        code: error.code ?? 'E0100',
        category: 'parser',
        severity: error.severity ?? 'error',
        message: error.message,
        location,
        source: 'parser',
        notes: (error as unknown as { notes?: string[] }).notes,
        help: (error as unknown as { help?: string[] }).help,
      };

      if (diag.severity === 'error') {
        errors.push(diag);
      } else if (diag.severity === 'warning') {
        warnings.push(diag);
      }
    }

    if (ast && options.verbose) {
      console.log(chalk.gray(`  Domain: ${ast.name?.name ?? 'unknown'}`));
      console.log(chalk.gray(`  Entities: ${ast.entities?.length ?? 0}`));
      console.log(chalk.gray(`  Behaviors: ${ast.behaviors?.length ?? 0}`));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rawErrors: errors.map(e => `${e.location.line}:${e.location.column}: ${e.message}`),
    };
  } catch (error) {
    const errorDiag: Diagnostic = {
      code: 'E0700',
      category: 'io',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
      location: {
        file: filePath,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
      },
      source: 'cli',
    };
    errors.push(errorDiag);

    return {
      valid: false,
      errors,
      warnings,
      rawErrors: [errorDiag.message],
    };
  }
}

export function printCheckResult(result: CheckResult, filePath: string): void {
  const useColors = process.stdout.isTTY !== false;

  if (result.valid && result.warnings.length === 0) {
    // Success - no errors or warnings
    console.log(chalk.green('✓') + ` ${filePath}`);
    return;
  }

  // Combine errors and warnings for formatting
  const allDiagnostics = [...result.errors, ...result.warnings];
  
  // Use the beautiful formatter
  const output = formatDiagnostics(allDiagnostics, {
    colors: useColors,
    contextLines: 2,
    showCodes: true,
    showHelp: true,
    maxErrors: 10,
    showRelated: true,
  });

  console.log();
  console.log(output);
  console.log();

  // Show hint about explain command for first error
  if (result.errors.length > 0) {
    const firstCode = result.errors[0]!.code;
    console.log(chalk.gray(`For more information about this error, try 'isl explain ${firstCode}'`));
  }
}
