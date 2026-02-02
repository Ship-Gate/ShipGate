/**
 * Fmt Command
 * 
 * Format ISL files.
 * Usage: isl fmt <file>
 */

import { readFile, writeFile, access } from 'fs/promises';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL, type Domain as DomainDeclaration } from '@isl-lang/parser';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { findSimilarFiles } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FmtOptions {
  /** Write changes to file (default: true) */
  write?: boolean;
  /** Check formatting only, don't write */
  check?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
}

export interface FmtResult {
  success: boolean;
  file: string;
  formatted: boolean;
  diff?: string;
  errors: string[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Configuration
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_CONFIG = {
  indentSize: 2,
  maxLineLength: 100,
  blankLinesBetweenBlocks: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// AST Formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a domain declaration to ISL source
 */
function formatDomain(domain: DomainDeclaration): string {
  const lines: string[] = [];
  const indent = ' '.repeat(FORMAT_CONFIG.indentSize);
  
  // Domain header with description
  if (domain.description) {
    lines.push('/**');
    lines.push(` * ${domain.description}`);
    lines.push(' */');
  }
  
  lines.push(`domain ${domain.name.name} {`);
  
  // Entities
  if (domain.entities.length > 0) {
    for (let i = 0; i < domain.entities.length; i++) {
      const entity = domain.entities[i];
      
      if (i > 0) lines.push('');
      
      // Entity documentation
      if (entity.description) {
        lines.push(`${indent}/**`);
        lines.push(`${indent} * ${entity.description}`);
        lines.push(`${indent} */`);
      }
      
      lines.push(`${indent}entity ${entity.name.name} {`);
      
      if (entity.fields) {
        for (const field of entity.fields) {
          const optional = field.optional ? '?' : '';
          const type = field.type?.name ?? 'unknown';
          lines.push(`${indent}${indent}${field.name.name}${optional}: ${type}`);
        }
      }
      
      lines.push(`${indent}}`);
    }
  }
  
  // Blank line before behaviors
  if (domain.entities.length > 0 && domain.behaviors.length > 0) {
    lines.push('');
  }
  
  // Behaviors
  if (domain.behaviors.length > 0) {
    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      
      if (i > 0) lines.push('');
      
      // Behavior documentation
      if (behavior.description) {
        lines.push(`${indent}/**`);
        lines.push(`${indent} * ${behavior.description}`);
        lines.push(`${indent} */`);
      }
      
      lines.push(`${indent}behavior ${behavior.name.name} {`);
      
      // Input
      if (behavior.inputs && behavior.inputs.length > 0) {
        lines.push(`${indent}${indent}input {`);
        for (const input of behavior.inputs) {
          const type = input.type?.name ?? 'unknown';
          lines.push(`${indent}${indent}${indent}${input.name.name}: ${type}`);
        }
        lines.push(`${indent}${indent}}`);
        lines.push('');
      }
      
      // Output
      if (behavior.output) {
        lines.push(`${indent}${indent}output ${behavior.output.name}`);
        lines.push('');
      }
      
      // Preconditions
      if (behavior.body?.preconditions && behavior.body.preconditions.length > 0) {
        lines.push(`${indent}${indent}preconditions {`);
        for (const pre of behavior.body.preconditions) {
          if (pre.description) {
            lines.push(`${indent}${indent}${indent}require ${pre.description}`);
          }
        }
        lines.push(`${indent}${indent}}`);
        lines.push('');
      }
      
      // Postconditions
      if (behavior.body?.postconditions && behavior.body.postconditions.length > 0) {
        lines.push(`${indent}${indent}postconditions {`);
        for (const post of behavior.body.postconditions) {
          if (post.description) {
            lines.push(`${indent}${indent}${indent}ensure ${post.description}`);
          }
        }
        lines.push(`${indent}${indent}}`);
      }
      
      // Scenarios
      if (behavior.body?.scenarios && behavior.body.scenarios.length > 0) {
        lines.push('');
        for (const scenario of behavior.body.scenarios) {
          lines.push(`${indent}${indent}scenario "${scenario.name}" {`);
          
          if (scenario.given) {
            lines.push(`${indent}${indent}${indent}given ${JSON.stringify(scenario.given)}`);
          }
          if (scenario.when) {
            lines.push(`${indent}${indent}${indent}when ${JSON.stringify(scenario.when)}`);
          }
          if (scenario.then) {
            lines.push(`${indent}${indent}${indent}then ${JSON.stringify(scenario.then)}`);
          }
          
          lines.push(`${indent}${indent}}`);
        }
      }
      
      lines.push(`${indent}}`);
    }
  }
  
  // Blank line before invariants
  if ((domain.entities.length > 0 || domain.behaviors.length > 0) && domain.invariants && domain.invariants.length > 0) {
    lines.push('');
  }
  
  // Invariants
  if (domain.invariants && domain.invariants.length > 0) {
    for (const inv of domain.invariants) {
      const name = inv.name?.name ? `"${inv.name.name}"` : '';
      lines.push(`${indent}invariant ${name} {`);
      if (inv.description) {
        lines.push(`${indent}${indent}${inv.description}`);
      }
      lines.push(`${indent}}`);
    }
  }
  
  lines.push('}');
  
  return lines.join('\n') + '\n';
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
// Diff Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a simple diff between two strings
 */
function simpleDiff(original: string, formatted: string): string | null {
  const origLines = original.split('\n');
  const fmtLines = formatted.split('\n');
  
  if (original === formatted) return null;
  
  const diff: string[] = [];
  const maxLen = Math.max(origLines.length, fmtLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i] ?? '';
    const fmtLine = fmtLines[i] ?? '';
    
    if (origLine !== fmtLine) {
      if (origLine) diff.push(chalk.red(`- ${origLine}`));
      if (fmtLine) diff.push(chalk.green(`+ ${fmtLine}`));
    }
  }
  
  return diff.length > 0 ? diff.join('\n') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Fmt Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an ISL file
 */
export async function fmt(file: string, options: FmtOptions = {}): Promise<FmtResult> {
  const startTime = Date.now();
  const filePath = resolve(file);
  const spinner = options.format !== 'json' ? ora('Formatting ISL file...').start() : null;
  
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
      formatted: false,
      errors: [`File not found: ${file}`],
      duration: Date.now() - startTime,
    };
  }
  
  const errors: string[] = [];
  
  try {
    const source = await readFile(filePath, 'utf-8');
    spinner && (spinner.text = 'Parsing...');
    
    const { domain: ast, errors: parseErrors } = parseISL(source, filePath);
    
    if (parseErrors.length > 0 || !ast) {
      spinner?.fail('Parse failed - cannot format invalid ISL');
      return {
        success: false,
        file: filePath,
        formatted: false,
        errors: parseErrors.map(e => e.message),
        duration: Date.now() - startTime,
      };
    }
    
    spinner && (spinner.text = 'Formatting...');
    const formatted = formatDomain(ast);
    const diff = simpleDiff(source, formatted);
    const needsFormatting = diff !== null;
    
    const duration = Date.now() - startTime;
    
    // Check mode - just report if formatting needed
    if (options.check) {
      if (needsFormatting) {
        spinner?.fail(`${relative(process.cwd(), filePath)} needs formatting`);
      } else {
        spinner?.succeed(`${relative(process.cwd(), filePath)} is formatted`);
      }
      
      return {
        success: !needsFormatting,
        file: filePath,
        formatted: !needsFormatting,
        diff: diff ?? undefined,
        errors,
        duration,
      };
    }
    
    // Write mode
    if (needsFormatting && options.write !== false) {
      await writeFile(filePath, formatted);
      spinner?.succeed(`Formatted ${relative(process.cwd(), filePath)} (${duration}ms)`);
    } else if (needsFormatting) {
      spinner?.info(`${relative(process.cwd(), filePath)} would be reformatted`);
    } else {
      spinner?.succeed(`${relative(process.cwd(), filePath)} already formatted (${duration}ms)`);
    }
    
    return {
      success: true,
      file: filePath,
      formatted: needsFormatting,
      diff: diff ?? undefined,
      errors,
      duration,
    };
  } catch (err) {
    spinner?.fail('Formatting failed');
    errors.push(err instanceof Error ? err.message : String(err));
    
    return {
      success: false,
      file: filePath,
      formatted: false,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print fmt results to console
 */
export function printFmtResult(result: FmtResult, options?: FmtOptions): void {
  // JSON output
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      file: result.file,
      formatted: result.formatted,
      errors: result.errors,
      duration: result.duration,
    }, null, 2));
    return;
  }
  
  // Quiet output
  if (options?.format === 'quiet') {
    if (!result.success) {
      for (const err of result.errors) {
        console.error(err);
      }
    }
    return;
  }
  
  // Verbose mode - show diff
  if (options?.verbose && result.diff) {
    console.log('');
    console.log(chalk.bold('Changes:'));
    console.log(result.diff);
  }
}

/**
 * Get exit code for fmt result
 */
export function getFmtExitCode(result: FmtResult): number {
  if (result.success) return ExitCode.SUCCESS;
  
  if (result.errors.some(e => e.includes('not found'))) {
    return ExitCode.USAGE_ERROR;
  }
  
  return ExitCode.ISL_ERROR;
}

export default fmt;
