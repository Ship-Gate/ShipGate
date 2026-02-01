/**
 * Lint Command
 * 
 * Lint ISL files for best practices and common issues.
 * Usage: isl lint <file>
 */

import { readFile, access } from 'fs/promises';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import { output, type DiagnosticError } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { findSimilarFiles, formatCount } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LintOptions {
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Treat warnings as errors */
  strict?: boolean;
}

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface LintResult {
  success: boolean;
  file: string;
  issues: LintIssue[];
  stats: {
    errors: number;
    warnings: number;
    info: number;
  };
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lint Rules
// ─────────────────────────────────────────────────────────────────────────────

type LintRule = {
  id: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  check: (domain: DomainDeclaration, filePath: string) => LintIssue[];
};

const LINT_RULES: LintRule[] = [
  // Entity rules
  {
    id: 'entity-no-fields',
    name: 'Entity should have fields',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      for (const entity of domain.entities) {
        if (!entity.fields || entity.fields.length === 0) {
          issues.push({
            rule: 'entity-no-fields',
            severity: 'warning',
            message: `Entity '${entity.name.name}' has no fields`,
            file: filePath,
            suggestion: 'Add at least one field to the entity',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'entity-missing-id',
    name: 'Entity should have an ID field',
    severity: 'info',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      for (const entity of domain.entities) {
        const hasId = entity.fields?.some(f => 
          f.name.name.toLowerCase() === 'id' || 
          f.type?.name === 'ID'
        );
        if (!hasId) {
          issues.push({
            rule: 'entity-missing-id',
            severity: 'info',
            message: `Entity '${entity.name.name}' has no ID field`,
            file: filePath,
            suggestion: 'Consider adding an `id: ID` field',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'entity-pascal-case',
    name: 'Entity names should be PascalCase',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const pascalCase = /^[A-Z][a-zA-Z0-9]*$/;
      for (const entity of domain.entities) {
        if (!pascalCase.test(entity.name.name)) {
          issues.push({
            rule: 'entity-pascal-case',
            severity: 'warning',
            message: `Entity '${entity.name.name}' should be PascalCase`,
            file: filePath,
            suggestion: `Rename to '${toPascalCase(entity.name.name)}'`,
          });
        }
      }
      return issues;
    },
  },
  
  // Behavior rules
  {
    id: 'behavior-no-postconditions',
    name: 'Behavior should have postconditions',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      for (const behavior of domain.behaviors) {
        if (!behavior.body?.postconditions || behavior.body.postconditions.length === 0) {
          issues.push({
            rule: 'behavior-no-postconditions',
            severity: 'warning',
            message: `Behavior '${behavior.name.name}' has no postconditions`,
            file: filePath,
            suggestion: 'Add postconditions to specify expected outcomes',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'behavior-no-scenarios',
    name: 'Behavior should have test scenarios',
    severity: 'info',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      for (const behavior of domain.behaviors) {
        if (!behavior.body?.scenarios || behavior.body.scenarios.length === 0) {
          issues.push({
            rule: 'behavior-no-scenarios',
            severity: 'info',
            message: `Behavior '${behavior.name.name}' has no test scenarios`,
            file: filePath,
            suggestion: 'Add scenario blocks to define test cases',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'behavior-pascal-case',
    name: 'Behavior names should be PascalCase',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const pascalCase = /^[A-Z][a-zA-Z0-9]*$/;
      for (const behavior of domain.behaviors) {
        if (!pascalCase.test(behavior.name.name)) {
          issues.push({
            rule: 'behavior-pascal-case',
            severity: 'warning',
            message: `Behavior '${behavior.name.name}' should be PascalCase`,
            file: filePath,
            suggestion: `Rename to '${toPascalCase(behavior.name.name)}'`,
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'behavior-missing-output',
    name: 'Behavior should specify output type',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      for (const behavior of domain.behaviors) {
        if (!behavior.output) {
          issues.push({
            rule: 'behavior-missing-output',
            severity: 'warning',
            message: `Behavior '${behavior.name.name}' has no output type`,
            file: filePath,
            suggestion: 'Add an output type declaration',
          });
        }
      }
      return issues;
    },
  },
  
  // Domain rules
  {
    id: 'domain-no-invariants',
    name: 'Domain should have invariants',
    severity: 'info',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      if (!domain.invariants || domain.invariants.length === 0) {
        issues.push({
          rule: 'domain-no-invariants',
          severity: 'info',
          message: `Domain '${domain.name.name}' has no invariants`,
          file: filePath,
          suggestion: 'Consider adding invariants to specify domain rules',
        });
      }
      return issues;
    },
  },
  {
    id: 'domain-empty',
    name: 'Domain should not be empty',
    severity: 'error',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      if (domain.entities.length === 0 && domain.behaviors.length === 0) {
        issues.push({
          rule: 'domain-empty',
          severity: 'error',
          message: `Domain '${domain.name.name}' is empty`,
          file: filePath,
          suggestion: 'Add entities and behaviors to define the domain',
        });
      }
      return issues;
    },
  },
  
  // Field rules
  {
    id: 'field-camel-case',
    name: 'Field names should be camelCase',
    severity: 'info',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const camelCase = /^[a-z][a-zA-Z0-9]*$/;
      for (const entity of domain.entities) {
        if (entity.fields) {
          for (const field of entity.fields) {
            if (!camelCase.test(field.name.name) && field.name.name !== 'ID') {
              issues.push({
                rule: 'field-camel-case',
                severity: 'info',
                message: `Field '${field.name.name}' in '${entity.name.name}' should be camelCase`,
                file: filePath,
                suggestion: `Rename to '${toCamelCase(field.name.name)}'`,
              });
            }
          }
        }
      }
      return issues;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str.replace(/(?:^|[-_\s])(\w)/g, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Lint Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lint an ISL file for best practices
 */
export async function lint(file: string, options: LintOptions = {}): Promise<LintResult> {
  const startTime = Date.now();
  const filePath = resolve(file);
  const spinner = options.format !== 'json' ? ora('Linting ISL file...').start() : null;
  
  // Check if file exists
  if (!await fileExists(filePath)) {
    spinner?.fail(`File not found: ${file}`);
    
    const similar = await findSimilarFiles(filePath);
    if (similar.length > 0) {
      console.log('');
      console.log(chalk.gray('Did you mean:'));
      for (const s of similar) {
        console.log(chalk.gray(`  ${relative(process.cwd(), s)}`));
      }
    }
    
    return {
      success: false,
      file: filePath,
      issues: [{
        rule: 'file-not-found',
        severity: 'error',
        message: `File not found: ${file}`,
        file: filePath,
      }],
      stats: { errors: 1, warnings: 0, info: 0 },
      duration: Date.now() - startTime,
    };
  }
  
  try {
    const source = await readFile(filePath, 'utf-8');
    spinner && (spinner.text = 'Parsing...');
    
    const { ast, errors: parseErrors } = parseISL(source, filePath);
    
    if (parseErrors.length > 0 || !ast) {
      spinner?.fail('Parse failed - cannot lint invalid ISL');
      return {
        success: false,
        file: filePath,
        issues: parseErrors.map(e => ({
          rule: 'parse-error',
          severity: 'error' as const,
          message: e.message,
          file: filePath,
          line: 'line' in e ? e.line : undefined,
          column: 'column' in e ? e.column : undefined,
        })),
        stats: { errors: parseErrors.length, warnings: 0, info: 0 },
        duration: Date.now() - startTime,
      };
    }
    
    // Run lint rules
    spinner && (spinner.text = 'Running lint rules...');
    const allIssues: LintIssue[] = [];
    
    for (const rule of LINT_RULES) {
      const issues = rule.check(ast, filePath);
      allIssues.push(...issues);
    }
    
    // Calculate stats
    const stats = {
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      info: allIssues.filter(i => i.severity === 'info').length,
    };
    
    const duration = Date.now() - startTime;
    
    // Determine success
    const hasErrors = stats.errors > 0;
    const hasWarnings = stats.warnings > 0;
    const success = !hasErrors && (!options.strict || !hasWarnings);
    
    if (!success) {
      spinner?.fail(`Lint found ${formatCount(stats.errors, 'error')}, ${formatCount(stats.warnings, 'warning')}`);
    } else if (stats.warnings > 0 || stats.info > 0) {
      spinner?.warn(`Lint passed with ${formatCount(stats.warnings, 'warning')}, ${formatCount(stats.info, 'info issue')}`);
    } else {
      spinner?.succeed(`Lint passed (${duration}ms)`);
    }
    
    return {
      success,
      file: filePath,
      issues: allIssues,
      stats,
      duration,
    };
  } catch (err) {
    spinner?.fail('Lint failed');
    
    return {
      success: false,
      file: filePath,
      issues: [{
        rule: 'internal-error',
        severity: 'error',
        message: err instanceof Error ? err.message : String(err),
        file: filePath,
      }],
      stats: { errors: 1, warnings: 0, info: 0 },
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print lint results to console
 */
export function printLintResult(result: LintResult, options?: LintOptions): void {
  // JSON output
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      file: result.file,
      issues: result.issues,
      stats: result.stats,
      duration: result.duration,
    }, null, 2));
    return;
  }
  
  // Quiet output
  if (options?.format === 'quiet') {
    for (const issue of result.issues.filter(i => i.severity === 'error')) {
      const loc = issue.line ? `${issue.file}:${issue.line}:${issue.column ?? 0}` : issue.file;
      console.error(`${loc}: ${issue.message}`);
    }
    return;
  }
  
  console.log('');
  
  // Group issues by severity
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');
  
  const printIssue = (issue: LintIssue) => {
    const icon = issue.severity === 'error' ? chalk.red('✗')
      : issue.severity === 'warning' ? chalk.yellow('⚠')
      : chalk.blue('ℹ');
    
    const rule = chalk.gray(`[${issue.rule}]`);
    console.log(`  ${icon} ${issue.message} ${rule}`);
    
    if (issue.suggestion && options?.verbose) {
      console.log(chalk.gray(`    Suggestion: ${issue.suggestion}`));
    }
  };
  
  if (errors.length > 0) {
    console.log(chalk.bold.red('Errors:'));
    errors.forEach(printIssue);
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(chalk.bold.yellow('Warnings:'));
    warnings.forEach(printIssue);
    console.log('');
  }
  
  if (infos.length > 0 && options?.verbose) {
    console.log(chalk.bold.blue('Info:'));
    infos.forEach(printIssue);
    console.log('');
  }
  
  // Summary
  const parts: string[] = [];
  if (result.stats.errors > 0) parts.push(chalk.red(`${result.stats.errors} error${result.stats.errors === 1 ? '' : 's'}`));
  if (result.stats.warnings > 0) parts.push(chalk.yellow(`${result.stats.warnings} warning${result.stats.warnings === 1 ? '' : 's'}`));
  if (result.stats.info > 0) parts.push(chalk.blue(`${result.stats.info} info`));
  
  if (parts.length > 0) {
    console.log(parts.join(', '));
  }
  
  console.log(chalk.gray(`Completed in ${result.duration}ms`));
}

/**
 * Get exit code for lint result
 */
export function getLintExitCode(result: LintResult): number {
  if (result.success) return ExitCode.SUCCESS;
  
  if (result.issues.some(i => i.rule === 'file-not-found')) {
    return ExitCode.USAGE_ERROR;
  }
  
  return ExitCode.ISL_ERROR;
}

export default lint;
