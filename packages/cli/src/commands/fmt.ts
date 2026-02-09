/**
 * Fmt Command
 * 
 * Format ISL files using AST-based formatting that preserves comments.
 * Usage: isl fmt <file> [--check] [--write]
 */

import { readFile, writeFile, access } from 'fs/promises';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL, type Domain as DomainDeclaration } from '@isl-lang/parser';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { findSimilarFiles } from '../utils.js';
import { Formatter } from './fmt/formatter.js';
import { CommentExtractor } from './fmt/comments.js';

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
 * Format an ISL file using AST-based formatting
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
    
    const parseResult = parseISL(source, filePath);
    
    if (!parseResult.success || !parseResult.domain) {
      spinner?.fail('Parse failed - cannot format invalid ISL');
      const parseErrors = Array.isArray(parseResult.errors) ? parseResult.errors : [];
      return {
        success: false,
        file: filePath,
        formatted: false,
        errors: parseErrors.map((e: unknown) => {
          if (typeof e === 'string') return e;
          if (typeof e === 'object' && e !== null) {
            if ('message' in e) return String(e.message);
            if ('code' in e) {
              const code = String(e.code);
              const message = 'message' in e ? String(e.message) : 'Parse error';
              return `[${code}] ${message}`;
            }
          }
          return String(e);
        }),
        duration: Date.now() - startTime,
      };
    }
    
    spinner && (spinner.text = 'Formatting...');
    
    // Extract comments from source
    const commentExtractor = new CommentExtractor(source);
    const comments = commentExtractor.extract();
    
    // Format AST
    const formatter = new Formatter();
    const formatted = formatter.format(parseResult.domain, comments);
    
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
