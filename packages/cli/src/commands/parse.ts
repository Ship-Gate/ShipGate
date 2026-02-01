/**
 * Parse Command
 * 
 * Parse an ISL file and display the AST.
 * Usage: isl parse <file>
 */

import { readFile, access } from 'fs/promises';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import { output, type DiagnosticError } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { findSimilarFiles, formatCodeSnippet } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParseOptions {
  /** Show verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
}

export interface ParseResult {
  success: boolean;
  file: string;
  ast: DomainDeclaration | null;
  errors: DiagnosticError[];
  source?: string;
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AST Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format AST for pretty printing
 */
function formatAST(ast: DomainDeclaration, indent = 0): string[] {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);
  
  lines.push(`${prefix}${chalk.cyan('Domain')} ${chalk.bold(ast.name.name)}`);
  
  // Entities
  if (ast.entities.length > 0) {
    lines.push(`${prefix}  ${chalk.gray('Entities:')}`);
    for (const entity of ast.entities) {
      lines.push(`${prefix}    ${chalk.green('•')} ${entity.name.name}`);
      if (entity.fields && entity.fields.length > 0) {
        for (const field of entity.fields) {
          const typeStr = field.type?.name ?? 'unknown';
          lines.push(`${prefix}      ${chalk.gray('-')} ${field.name.name}: ${chalk.yellow(typeStr)}`);
        }
      }
    }
  }
  
  // Behaviors
  if (ast.behaviors.length > 0) {
    lines.push(`${prefix}  ${chalk.gray('Behaviors:')}`);
    for (const behavior of ast.behaviors) {
      const inputs = behavior.inputs?.map(i => `${i.name.name}: ${i.type?.name ?? '?'}`).join(', ') ?? '';
      const output = behavior.output?.name ?? 'void';
      lines.push(`${prefix}    ${chalk.blue('•')} ${behavior.name.name}(${inputs}) -> ${chalk.yellow(output)}`);
      
      // Postconditions count
      const postCount = behavior.body?.postconditions?.length ?? 0;
      const scenarioCount = behavior.body?.scenarios?.length ?? 0;
      if (postCount > 0 || scenarioCount > 0) {
        const parts: string[] = [];
        if (postCount > 0) parts.push(`${postCount} postcondition${postCount === 1 ? '' : 's'}`);
        if (scenarioCount > 0) parts.push(`${scenarioCount} scenario${scenarioCount === 1 ? '' : 's'}`);
        lines.push(`${prefix}      ${chalk.gray(parts.join(', '))}`);
      }
    }
  }
  
  // Invariants
  if (ast.invariants && ast.invariants.length > 0) {
    lines.push(`${prefix}  ${chalk.gray('Invariants:')}`);
    for (const inv of ast.invariants) {
      const name = inv.name?.name ?? 'unnamed';
      lines.push(`${prefix}    ${chalk.magenta('•')} ${name}`);
    }
  }
  
  return lines;
}

/**
 * Convert AST to JSON-serializable format
 */
function astToJson(ast: DomainDeclaration): object {
  return {
    type: 'Domain',
    name: ast.name.name,
    entities: ast.entities.map(e => ({
      type: 'Entity',
      name: e.name.name,
      fields: e.fields?.map(f => ({
        name: f.name.name,
        type: f.type?.name ?? null,
        optional: f.optional ?? false,
      })) ?? [],
    })),
    behaviors: ast.behaviors.map(b => ({
      type: 'Behavior',
      name: b.name.name,
      inputs: b.inputs?.map(i => ({
        name: i.name.name,
        type: i.type?.name ?? null,
      })) ?? [],
      output: b.output?.name ?? null,
      postconditions: b.body?.postconditions?.length ?? 0,
      scenarios: b.body?.scenarios?.length ?? 0,
    })),
    invariants: ast.invariants?.map(i => ({
      type: 'Invariant',
      name: i.name?.name ?? null,
      description: i.description ?? null,
    })) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// File Existence Check
// ─────────────────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Parse Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an ISL file and return the AST
 */
export async function parse(file: string, options: ParseOptions = {}): Promise<ParseResult> {
  const startTime = Date.now();
  const filePath = resolve(file);
  const spinner = options.format !== 'json' ? ora('Parsing ISL file...').start() : null;
  
  // Check if file exists
  if (!await fileExists(filePath)) {
    spinner?.fail(`File not found: ${file}`);
    
    // Suggest similar files
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
      ast: null,
      errors: [{
        file: filePath,
        message: `File not found: ${file}`,
        severity: 'error',
      }],
      duration: Date.now() - startTime,
    };
  }
  
  const errors: DiagnosticError[] = [];
  
  try {
    const source = await readFile(filePath, 'utf-8');
    spinner && (spinner.text = 'Parsing...');
    
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
    
    const duration = Date.now() - startTime;
    
    if (errors.length > 0) {
      spinner?.fail(`Parse failed with ${errors.length} error${errors.length === 1 ? '' : 's'}`);
    } else {
      spinner?.succeed(`Parsed ${relative(process.cwd(), filePath)} (${duration}ms)`);
    }
    
    return {
      success: errors.length === 0,
      file: filePath,
      ast: ast ?? null,
      errors,
      source,
      duration,
    };
  } catch (err) {
    spinner?.fail('Parse failed');
    errors.push({
      file: filePath,
      message: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });
    
    return {
      success: false,
      file: filePath,
      ast: null,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print parse results to console
 */
export function printParseResult(result: ParseResult, options?: ParseOptions): void {
  // JSON output
  if (options?.format === 'json') {
    const jsonResult = {
      success: result.success,
      file: result.file,
      duration: result.duration,
      ast: result.ast ? astToJson(result.ast) : null,
      errors: result.errors.map(e => ({
        file: e.file,
        line: e.line,
        column: e.column,
        message: e.message,
      })),
    };
    console.log(JSON.stringify(jsonResult, null, 2));
    return;
  }
  
  // Quiet output
  if (options?.format === 'quiet') {
    if (!result.success) {
      for (const err of result.errors) {
        const loc = err.line ? `${err.file}:${err.line}:${err.column ?? 0}` : err.file;
        console.error(`${loc}: ${err.message}`);
      }
    }
    return;
  }
  
  console.log('');
  
  // Print errors with code context
  if (result.errors.length > 0 && result.source) {
    console.log(chalk.bold.red('Parse Errors:'));
    console.log('');
    
    for (const err of result.errors) {
      // Location header
      const location = err.line 
        ? `${relative(process.cwd(), err.file ?? '')}:${err.line}:${err.column ?? 0}`
        : relative(process.cwd(), err.file ?? '');
      console.log(chalk.red(`error: ${err.message}`));
      console.log(chalk.gray(`  --> ${location}`));
      console.log('');
      
      // Code snippet
      if (err.line && result.source) {
        const snippet = formatCodeSnippet(result.source, { line: err.line, column: err.column ?? 1 });
        for (const line of snippet) {
          console.log(line);
        }
        console.log('');
      }
    }
    return;
  }
  
  // Print AST
  if (result.ast) {
    console.log(chalk.bold('Abstract Syntax Tree:'));
    console.log('');
    const formatted = formatAST(result.ast);
    for (const line of formatted) {
      console.log(line);
    }
    console.log('');
    
    // Summary
    const stats = {
      entities: result.ast.entities.length,
      behaviors: result.ast.behaviors.length,
      invariants: result.ast.invariants?.length ?? 0,
    };
    
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(`  ${stats.entities} entities, ${stats.behaviors} behaviors, ${stats.invariants} invariants`));
    console.log(chalk.gray(`  Parsed in ${result.duration}ms`));
  }
}

/**
 * Get exit code for parse result
 */
export function getParseExitCode(result: ParseResult): number {
  if (result.success) return ExitCode.SUCCESS;
  
  // Check if it's a file not found error
  if (result.errors.some(e => e.message.includes('not found'))) {
    return ExitCode.USAGE_ERROR;
  }
  
  return ExitCode.ISL_ERROR;
}

export default parse;
