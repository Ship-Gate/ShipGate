/**
 * Explain Command
 * 
 * Shows detailed explanations for ISL error codes.
 * 
 * Usage:
 *   isl explain E0200       # Show explanation for specific error
 *   isl explain --list      # List all error codes
 *   isl explain --category type  # List errors in category
 */

import chalk from 'chalk';
import {
  formatExplanation,
  formatErrorCodeList,
  getExplanation,
  getAllExplainedCodes,
  getErrorsByCategory,
  getErrorDef,
  hasExplanation,
  type ErrorCategory,
} from '@isl-lang/errors';

export interface ExplainOptions {
  /** List all error codes */
  list?: boolean;
  /** Filter by category */
  category?: string;
  /** Disable colors */
  noColor?: boolean;
}

/**
 * Show explanation for an error code
 */
export function explain(code: string | undefined, options: ExplainOptions = {}): void {
  const useColors = !options.noColor && process.stdout.isTTY;

  // List all error codes
  if (options.list) {
    console.log(formatErrorCodeList(useColors));
    return;
  }

  // List errors by category
  if (options.category) {
    const category = options.category.toLowerCase() as ErrorCategory;
    const validCategories = ['lexer', 'parser', 'type', 'semantic', 'eval', 'verify', 'config', 'io'];
    
    if (!validCategories.includes(category)) {
      console.error(chalk.red(`Invalid category: ${options.category}`));
      console.error(chalk.gray(`Valid categories: ${validCategories.join(', ')}`));
      return;
    }

    const errors = getErrorsByCategory(category);
    console.log(chalk.cyan.bold(`\n${capitalize(category)} Errors\n`));
    
    for (const err of errors) {
      const hasExp = hasExplanation(err.code);
      const expMarker = hasExp ? chalk.green('●') : chalk.gray('○');
      console.log(`  ${expMarker} ${chalk.yellow(err.code)}  ${err.title}`);
    }
    
    console.log();
    console.log(chalk.gray('● = has detailed explanation, ○ = basic info only'));
    console.log(chalk.gray(`Run 'isl explain <CODE>' for detailed information.`));
    return;
  }

  // Show explanation for specific code
  if (!code) {
    console.log(formatErrorCodeList(useColors));
    console.log();
    console.log(chalk.cyan('Usage:'));
    console.log(chalk.gray('  isl explain E0200       # Explain specific error'));
    console.log(chalk.gray('  isl explain --list      # List all error codes'));
    console.log(chalk.gray('  isl explain --category type  # Errors in category'));
    return;
  }

  // Normalize code format
  const normalizedCode = normalizeErrorCode(code);
  
  // Check if we have an explanation
  const explanation = getExplanation(normalizedCode);
  const errorDef = getErrorDef(normalizedCode);

  if (!explanation && !errorDef) {
    console.error(chalk.red(`Unknown error code: ${code}`));
    console.log();
    
    // Try to suggest similar codes
    const allCodes = getAllExplainedCodes();
    const similar = allCodes.filter(c => 
      c.toLowerCase().includes(code.toLowerCase()) ||
      code.toLowerCase().includes(c.toLowerCase().slice(1))
    ).slice(0, 3);
    
    if (similar.length > 0) {
      console.log(chalk.cyan('Did you mean?'));
      for (const s of similar) {
        console.log(chalk.gray(`  isl explain ${s}`));
      }
    } else {
      console.log(chalk.gray(`Run 'isl explain --list' to see all error codes.`));
    }
    return;
  }

  // Show explanation
  console.log();
  
  if (explanation) {
    console.log(formatExplanation(normalizedCode, useColors));
  } else if (errorDef) {
    // Basic explanation from error definition
    console.log(chalk.red.bold(`${normalizedCode}: ${errorDef.title}`));
    console.log();
    console.log(chalk.gray('No detailed explanation available for this error code.'));
    console.log(chalk.gray(`Category: ${errorDef.category}`));
    console.log();
    console.log(chalk.cyan('The error message template is:'));
    console.log(chalk.gray(`  ${errorDef.messageTemplate}`));
  }

  console.log();
}

/**
 * Normalize error code to standard format (E0XXX)
 */
function normalizeErrorCode(code: string): string {
  // Already in correct format
  if (/^E\d{4}$/.test(code)) {
    return code;
  }
  
  // Just a number
  if (/^\d+$/.test(code)) {
    return `E${code.padStart(4, '0')}`;
  }
  
  // Lowercase e
  if (/^e\d{4}$/i.test(code)) {
    return code.toUpperCase();
  }
  
  // Legacy format conversion
  const legacyMap: Record<string, string> = {
    'L001': 'E0001', 'L002': 'E0002', 'L003': 'E0003', 'L004': 'E0004', 'L005': 'E0005', 'L006': 'E0006',
    'P001': 'E0100', 'P002': 'E0101', 'P003': 'E0102', 'P004': 'E0103', 'P005': 'E0104',
    'P006': 'E0105', 'P007': 'E0106', 'P008': 'E0107', 'P009': 'E0108', 'P010': 'E0109',
    'P011': 'E0110', 'P012': 'E0111', 'P013': 'E0112', 'P014': 'E0113', 'P015': 'E0114',
    'TC001': 'E0201', 'TC002': 'E0301', 'TC003': 'E0202', 'TC004': 'E0300', 'TC005': 'E0302',
    'TC020': 'E0200', 'TC021': 'E0203', 'TC022': 'E0204', 'TC030': 'E0304', 'TC031': 'E0305',
  };
  
  return legacyMap[code.toUpperCase()] || code.toUpperCase();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Print a formatted error code table
 */
export function printErrorCodes(category?: string): void {
  if (category) {
    const errors = getErrorsByCategory(category as ErrorCategory);
    console.log(`\n${category.toUpperCase()} ERRORS\n`);
    console.log('Code     | Title');
    console.log('---------|-------------------------------------------');
    for (const err of errors) {
      console.log(`${err.code}    | ${err.title}`);
    }
  } else {
    console.log(formatErrorCodeList(true));
  }
}
