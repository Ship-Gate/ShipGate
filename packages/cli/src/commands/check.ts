/**
 * Check Command
 * 
 * Parse and type check ISL files.
 * Usage: isl check <files...>
 */

import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL } from '@isl-lang/isl-core';
import { output, type DiagnosticError } from '../output.js';
import { loadConfig, type ISLConfig } from '../config.js';

// Built-in types that don't need to be defined
const BUILTIN_TYPES = new Set([
  'String', 'Int', 'Float', 'Decimal', 'Boolean', 'Bool',
  'UUID', 'Timestamp', 'DateTime', 'Date', 'Time', 'Duration',
  'Bytes', 'JSON', 'Any', 'Void', 'Never',
  // Common aliases
  'Integer', 'Number', 'Double',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckOptions {
  /** Show verbose output */
  verbose?: boolean;
  /** Watch mode */
  watch?: boolean;
  /** Config file path */
  config?: string;
  /** Quiet mode - only show errors */
  quiet?: boolean;
}

export interface FileCheckResult {
  file: string;
  valid: boolean;
  errors: DiagnosticError[];
  warnings: DiagnosticError[];
  stats?: {
    entities: number;
    behaviors: number;
    invariants: number;
  };
}

export interface CheckResult {
  success: boolean;
  files: FileCheckResult[];
  totalErrors: number;
  totalWarnings: number;
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check a single ISL file
 */
async function checkFile(filePath: string, verbose: boolean): Promise<FileCheckResult> {
  const errors: DiagnosticError[] = [];
  const warnings: DiagnosticError[] = [];

  try {
    const source = await readFile(filePath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(source, filePath);

    // Convert parse errors to diagnostics
    for (const error of parseErrors) {
      const line = 'span' in error ? error.span.start.line : error.line;
      const column = 'span' in error ? error.span.start.column : error.column;
      
      errors.push({
        file: filePath,
        line,
        column,
        message: error.message,
        severity: 'error',
      });
    }

    // If parsing succeeded, run type checks and collect stats
    let stats: FileCheckResult['stats'];
    if (ast) {
      stats = {
        entities: ast.entities.length,
        behaviors: ast.behaviors.length,
        invariants: ast.invariants?.length ?? 0,
      };

      // Collect all defined types in this domain
      const definedTypes = new Set<string>();
      for (const entity of ast.entities) {
        definedTypes.add(entity.name.name);
      }
      for (const typeDef of ast.types ?? []) {
        definedTypes.add(typeDef.name.name);
      }

      // Helper to check if a type is valid
      const isValidType = (typeName: string): boolean => {
        return BUILTIN_TYPES.has(typeName) || definedTypes.has(typeName);
      };

      // Helper to get type name from type node (handles various AST shapes)
      const getTypeName = (typeNode: unknown): string | null => {
        if (!typeNode || typeof typeNode !== 'object') return null;
        const node = typeNode as Record<string, unknown>;
        
        // Direct name property (string)
        if (typeof node.name === 'string') {
          return node.name;
        }
        
        // TypeReference with name object
        if (node.kind === 'TypeReference' && node.name) {
          const name = node.name as Record<string, unknown>;
          if (typeof name.name === 'string') return name.name;
        }
        
        // Identifier kind
        if (node.kind === 'Identifier' && typeof node.name === 'string') {
          return node.name;
        }
        
        // Nested name.name
        if (node.name && typeof node.name === 'object') {
          const inner = node.name as Record<string, unknown>;
          if (typeof inner.name === 'string') return inner.name;
        }
        
        // Type property with nested structure
        if (node.type && typeof node.type === 'object') {
          return getTypeName(node.type);
        }
        
        return null;
      };

      // Check entity fields for undefined types
      for (const entity of ast.entities) {
        for (const field of entity.fields ?? []) {
          const typeName = getTypeName(field.type);
          if (typeName && !isValidType(typeName)) {
            errors.push({
              file: filePath,
              line: field.location?.start?.line,
              column: field.location?.start?.column,
              message: `Type '${typeName}' is not defined`,
              severity: 'error',
              code: 'E0100',
              help: [`Did you mean to define entity '${typeName}'?`],
            });
          }
        }
      }

      // Check behavior inputs/outputs for undefined types
      for (const behavior of ast.behaviors) {
        // Check input fields (behavior.input.fields)
        const inputBlock = behavior.input as { fields?: Array<{ type?: unknown; location?: { start?: { line?: number; column?: number } } }> } | undefined;
        for (const field of inputBlock?.fields ?? []) {
          const typeName = getTypeName(field.type);
          if (typeName && !isValidType(typeName)) {
            errors.push({
              file: filePath,
              line: field.location?.start?.line,
              column: field.location?.start?.column,
              message: `Type '${typeName}' is not defined`,
              severity: 'error',
              code: 'E0100',
              help: [`Define '${typeName}' as an entity or type, or use a built-in type`],
            });
          }
        }

        // Check output type (behavior.output.success)
        const outputBlock = behavior.output as { success?: unknown } | undefined;
        if (outputBlock?.success) {
          const typeName = getTypeName(outputBlock.success);
          if (typeName && !isValidType(typeName)) {
            errors.push({
              file: filePath,
              message: `Output type '${typeName}' is not defined in behavior '${behavior.name.name}'`,
              severity: 'error',
              code: 'E0100',
            });
          }
        }
      }

      // Check for empty behaviors (postconditions are top-level, not under body)
      for (const behavior of ast.behaviors) {
        const postconds = behavior.postconditions as { conditions?: unknown[] } | undefined;
        const scenarios = behavior.scenarios as unknown[] | undefined;
        if (!postconds?.conditions?.length && !scenarios?.length) {
          warnings.push({
            file: filePath,
            message: `Behavior '${behavior.name.name}' has no postconditions or scenarios`,
            severity: 'warning',
          });
        }
      }

      // Check for entities without fields
      for (const entity of ast.entities) {
        if (!entity.fields?.length) {
          warnings.push({
            file: filePath,
            message: `Entity '${entity.name.name}' has no fields`,
            severity: 'warning',
          });
        }
      }
    }

    return {
      file: filePath,
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  } catch (err) {
    errors.push({
      file: filePath,
      message: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });

    return {
      file: filePath,
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Resolve file patterns to actual file paths
 */
async function resolveFiles(patterns: string[], config?: ISLConfig): Promise<string[]> {
  const files = new Set<string>();
  
  for (const pattern of patterns) {
    // If it's a direct file path
    if (pattern.endsWith('.isl')) {
      files.add(resolve(pattern));
    } else {
      // Glob pattern
      const matches = await glob(pattern, {
        cwd: process.cwd(),
        ignore: config?.exclude ?? ['node_modules/**', 'dist/**'],
      });
      for (const match of matches) {
        if (match.endsWith('.isl')) {
          files.add(resolve(match));
        }
      }
    }
  }

  return Array.from(files);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Check Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check ISL files for syntax and semantic errors
 */
export async function check(filePatterns: string[], options: CheckOptions = {}): Promise<CheckResult> {
  const startTime = Date.now();
  const spinner = !options.quiet ? ora('Checking ISL files...').start() : null;

  // Load config
  const { config } = await loadConfig();

  // Configure output
  output.configure({
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  });

  // Resolve files
  const files = await resolveFiles(
    filePatterns.length > 0 ? filePatterns : config?.include ?? ['**/*.isl'],
    config ?? undefined
  );

  if (files.length === 0) {
    spinner?.warn('No ISL files found');
    return {
      success: true,
      files: [],
      totalErrors: 0,
      totalWarnings: 0,
      duration: Date.now() - startTime,
    };
  }

  if (spinner) spinner.text = `Checking ${files.length} file${files.length === 1 ? '' : 's'}...`;

  // Check all files
  const results: FileCheckResult[] = [];
  for (const file of files) {
    const result = await checkFile(file, options.verbose ?? false);
    results.push(result);
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const duration = Date.now() - startTime;

  if (totalErrors > 0) {
    spinner?.fail(`Check failed with ${totalErrors} error${totalErrors === 1 ? '' : 's'}`);
  } else {
    spinner?.succeed(`Checked ${files.length} file${files.length === 1 ? '' : 's'} (${duration}ms)`);
  }

  return {
    success: totalErrors === 0,
    files: results,
    totalErrors,
    totalWarnings,
    duration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print check results to console
 */
export function printCheckResult(result: CheckResult): void {
  console.log('');

  // Print file-by-file results
  for (const file of result.files) {
    const relPath = relative(process.cwd(), file.file);
    
    if (file.valid) {
      console.log(chalk.green('✓') + ` ${relPath}`);
      
      if (file.stats) {
        output.debug(`  Entities: ${file.stats.entities}, Behaviors: ${file.stats.behaviors}`);
      }
    } else {
      console.log(chalk.red('✗') + ` ${relPath}`);
    }

    // Print errors
    for (const err of file.errors) {
      output.diagnostic(err);
    }

    // Print warnings
    for (const warn of file.warnings) {
      output.diagnostic(warn);
    }
  }

  // Print summary
  console.log('');
  if (result.success) {
    if (result.totalWarnings > 0) {
      console.log(chalk.green(`✓ All ${result.files.length} file${result.files.length === 1 ? '' : 's'} passed`) + 
        chalk.yellow(` (${result.totalWarnings} warning${result.totalWarnings === 1 ? '' : 's'})`));
    } else {
      console.log(chalk.green(`✓ All ${result.files.length} file${result.files.length === 1 ? '' : 's'} passed`));
    }
  } else {
    console.log(chalk.red(`✗ ${result.totalErrors} error${result.totalErrors === 1 ? '' : 's'}`) +
      (result.totalWarnings > 0 ? chalk.yellow(` ${result.totalWarnings} warning${result.totalWarnings === 1 ? '' : 's'}`) : ''));
  }

  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

export default check;
