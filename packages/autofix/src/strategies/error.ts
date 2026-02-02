/**
 * Error Handling Fix Strategy
 * 
 * Adds missing error handling for unhandled error cases.
 */

import type { AnalysisResult, CodeSegment } from '../analyzer.js';
import type { Patch, PatchContext } from '../patcher.js';

export interface ErrorFix {
  errorCode: string;
  errorMessage: string;
  condition?: string;
  retriable: boolean;
  retryAfter?: string;
}

/**
 * Generate patches to add missing error handling
 */
export function generateErrorPatches(
  analysis: AnalysisResult,
  context: PatchContext
): Patch[] {
  const patches: Patch[] = [];
  const { failure, relatedCode } = analysis;

  // Parse the predicate to understand what error handling is needed
  const fix = parseErrorPredicate(failure.predicate, failure.context);
  
  if (!fix) {
    return patches;
  }

  // Find the best location to add error handling
  const target = findErrorHandlingLocation(relatedCode, context.implementation, fix);

  if (!target) {
    return patches;
  }

  // Generate the error handling code
  const errorHandling = generateErrorHandler(fix, context);

  patches.push({
    type: target.type,
    file: target.file,
    line: target.line,
    column: target.column,
    content: errorHandling,
    original: target.original,
    replacement: target.replacement,
    description: `Add error handler for ${fix.errorCode}`,
    confidence: analysis.confidence,
  });

  return patches;
}

/**
 * Parse error predicate to determine the fix needed
 */
function parseErrorPredicate(
  predicate: string,
  _context?: { behaviorName?: string }
): ErrorFix | null {
  // Extract error code from predicate
  // Pattern: DUPLICATE_EMAIL, NOT_FOUND, INVALID_CREDENTIALS, etc.
  const errorCodeMatch = predicate.match(/([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)/);
  
  if (errorCodeMatch) {
    const errorCode = errorCodeMatch[1]!;
    return {
      errorCode,
      errorMessage: formatErrorMessage(errorCode),
      retriable: determineRetriable(errorCode),
      condition: extractCondition(predicate, errorCode),
    };
  }

  // Pattern: No handler for ErrorName
  const noHandlerMatch = predicate.match(/[Nn]o\s+handler\s+for\s+(\w+)/);
  if (noHandlerMatch) {
    const errorCode = noHandlerMatch[1]!;
    return {
      errorCode,
      errorMessage: formatErrorMessage(errorCode),
      retriable: determineRetriable(errorCode),
    };
  }

  // Pattern: missing error case: ErrorName
  const missingMatch = predicate.match(/missing\s+error\s+case:\s*(\w+)/i);
  if (missingMatch) {
    const errorCode = missingMatch[1]!;
    return {
      errorCode,
      errorMessage: formatErrorMessage(errorCode),
      retriable: determineRetriable(errorCode),
    };
  }

  return null;
}

/**
 * Format error code into a human-readable message
 */
function formatErrorMessage(errorCode: string): string {
  return errorCode
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Determine if an error is retriable based on its code
 */
function determineRetriable(errorCode: string): boolean {
  const nonRetriable = [
    'NOT_FOUND',
    'INVALID_CREDENTIALS',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'DUPLICATE',
    'ALREADY_EXISTS',
    'VALIDATION_ERROR',
  ];

  return !nonRetriable.some(code => errorCode.includes(code));
}

/**
 * Extract condition from predicate
 */
function extractCondition(predicate: string, errorCode: string): string | undefined {
  // Pattern: when: "condition"
  const whenMatch = predicate.match(/when:\s*["']([^"']+)["']/);
  if (whenMatch) {
    return whenMatch[1];
  }

  // Generate condition based on error code
  if (errorCode.includes('NOT_FOUND')) {
    return 'entity not found';
  }
  if (errorCode.includes('DUPLICATE') || errorCode.includes('ALREADY_EXISTS')) {
    return 'entity already exists';
  }
  if (errorCode.includes('INVALID')) {
    return 'validation failed';
  }

  return undefined;
}

/**
 * Find the best location to add error handling
 */
function findErrorHandlingLocation(
  relatedCode: CodeSegment[],
  implementation: string,
  _fix: ErrorFix
): { type: 'insert' | 'replace'; file: string; line: number; column?: number; original?: string; replacement?: string } | null {
  const lines = implementation.split('\n');

  // Look for existing try-catch blocks
  let inTryCatch = false;
  let catchLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (/\btry\s*{/.test(line)) {
      inTryCatch = true;
    }

    if (inTryCatch && /\bcatch\s*\(/.test(line)) {
      catchLine = i;
    }
  }

  // If there's a catch block, add specific error handling inside it
  if (catchLine > 0) {
    // Find the opening brace of catch
    for (let i = catchLine; i < Math.min(catchLine + 3, lines.length); i++) {
      if (lines[i]!.includes('{')) {
        return {
          type: 'insert',
          file: 'implementation',
          line: i + 2,
          column: 0,
        };
      }
    }
  }

  // Look for await statements that might throw
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Find await calls that likely need error handling
    if (/await\s+\w+/.test(line) && !inTryCatchScope(lines, i)) {
      return {
        type: 'insert',
        file: 'implementation',
        line: i + 1,
        column: 0,
      };
    }
  }

  // Look for async function to wrap
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (/async\s+function|=\s*async/.test(line)) {
      // Find the function body start
      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j]!.includes('{')) {
          return {
            type: 'insert',
            file: 'implementation',
            line: j + 2,
            column: 0,
          };
        }
      }
    }
  }

  // Default to first related code
  if (relatedCode.length > 0) {
    return {
      type: 'insert',
      file: relatedCode[0]!.file,
      line: relatedCode[0]!.startLine + 1,
      column: 0,
    };
  }

  return null;
}

/**
 * Check if a line is within a try-catch scope
 */
function inTryCatchScope(lines: string[], lineIndex: number): boolean {
  let depth = 0;
  let inTry = false;

  for (let i = 0; i <= lineIndex; i++) {
    const line = lines[i]!;

    if (/\btry\s*{/.test(line)) {
      inTry = true;
      depth++;
    }

    // Count braces
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;

    if (depth <= 0) {
      inTry = false;
    }
  }

  return inTry;
}

/**
 * Generate error handling code
 */
function generateErrorHandler(fix: ErrorFix, context: PatchContext): string {
  const indent = context.indentation ?? '  ';
  const lines: string[] = [];

  if (context.useCustomErrors) {
    lines.push(`${indent}// Handle ${fix.errorCode}`);
    lines.push(`${indent}if (error.code === '${fix.errorCode}') {`);
    lines.push(`${indent}${indent}throw new BehaviorError({`);
    lines.push(`${indent}${indent}${indent}code: '${fix.errorCode}',`);
    lines.push(`${indent}${indent}${indent}message: '${fix.errorMessage}',`);
    lines.push(`${indent}${indent}${indent}retriable: ${fix.retriable},`);
    if (fix.retryAfter) {
      lines.push(`${indent}${indent}${indent}retryAfter: ${fix.retryAfter},`);
    }
    lines.push(`${indent}${indent}});`);
    lines.push(`${indent}}`);
  } else {
    lines.push(`${indent}// Handle ${fix.errorCode}`);
    lines.push(`${indent}if (error.message?.includes('${fix.errorCode.toLowerCase().replace(/_/g, ' ')}')) {`);
    lines.push(`${indent}${indent}throw new Error('${fix.errorCode}: ${fix.errorMessage}');`);
    lines.push(`${indent}}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate a complete try-catch wrapper for a code block
 */
export function generateTryCatchWrapper(
  code: string,
  errorHandlers: ErrorFix[],
  context: PatchContext
): string {
  const indent = context.indentation ?? '  ';
  const lines: string[] = [];

  lines.push(`${indent}try {`);
  
  // Indent the original code
  for (const line of code.split('\n')) {
    lines.push(`${indent}${indent}${line}`);
  }

  lines.push(`${indent}} catch (error) {`);

  // Add specific error handlers
  for (const fix of errorHandlers) {
    lines.push(generateErrorHandler(fix, context));
  }

  // Add generic rethrow
  lines.push(`${indent}${indent}// Rethrow unexpected errors`);
  lines.push(`${indent}${indent}throw error;`);
  lines.push(`${indent}}`);

  return lines.join('\n');
}

/**
 * Suggest error handling additions for common patterns
 */
export function suggestErrorHandlers(implementation: string): ErrorFix[] {
  const suggestions: ErrorFix[] = [];

  // Check for database operations without error handling
  if (implementation.includes('Repository') || implementation.includes('.find') || implementation.includes('.create')) {
    if (!implementation.includes('NOT_FOUND')) {
      suggestions.push({
        errorCode: 'NOT_FOUND',
        errorMessage: 'Entity not found',
        retriable: false,
        condition: 'entity lookup returns null',
      });
    }

    if (implementation.includes('.create') && !implementation.includes('DUPLICATE')) {
      suggestions.push({
        errorCode: 'DUPLICATE_ENTRY',
        errorMessage: 'Entity already exists',
        retriable: false,
        condition: 'unique constraint violation',
      });
    }
  }

  // Check for authentication operations
  if (implementation.includes('password') || implementation.includes('login') || implementation.includes('auth')) {
    if (!implementation.includes('INVALID_CREDENTIALS')) {
      suggestions.push({
        errorCode: 'INVALID_CREDENTIALS',
        errorMessage: 'Invalid credentials',
        retriable: true,
        condition: 'authentication failed',
      });
    }
  }

  return suggestions;
}
