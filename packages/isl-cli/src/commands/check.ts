/**
 * Check Command
 * 
 * Validates ISL syntax and semantics.
 */

import { readFile } from 'fs/promises';
import chalk from 'chalk';
import { parseISL } from '@intentos/isl-core';

export interface CheckOptions {
  verbose?: boolean;
}

export interface CheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function check(filePath: string, options: CheckOptions = {}): Promise<CheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Read file
    const source = await readFile(filePath, 'utf-8');

    // Parse
    const { ast, errors: parseErrors } = parseISL(source, filePath);

    // Collect errors
    for (const error of parseErrors) {
      const location = 'span' in error 
        ? `${error.span.start.line}:${error.span.start.column}`
        : `${error.line}:${error.column}`;
      errors.push(`${location}: ${error.message}`);
    }

    if (ast && options.verbose) {
      console.log(chalk.gray(`  Domain: ${ast.name.name}`));
      console.log(chalk.gray(`  Entities: ${ast.entities.length}`));
      console.log(chalk.gray(`  Behaviors: ${ast.behaviors.length}`));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push(String(error));
    }
    return { valid: false, errors, warnings };
  }
}

export function printCheckResult(result: CheckResult, filePath: string): void {
  if (result.valid) {
    console.log(chalk.green('✓') + ` ${filePath}`);
  } else {
    console.log(chalk.red('✗') + ` ${filePath}`);
    for (const error of result.errors) {
      console.log(chalk.red(`  Error: ${error}`));
    }
  }
  for (const warning of result.warnings) {
    console.log(chalk.yellow(`  Warning: ${warning}`));
  }
}
