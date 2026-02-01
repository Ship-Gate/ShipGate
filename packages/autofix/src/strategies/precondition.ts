/**
 * Precondition Fix Strategy
 * 
 * Adds missing precondition checks to implementations.
 */

import type { AnalysisResult, SourceLocation } from '../analyzer.js';
import type { Patch, PatchContext } from '../patcher.js';

export interface PreconditionFix {
  check: string;
  errorType: string;
  errorMessage: string;
  insertAfter?: string;
  insertBefore?: string;
}

/**
 * Generate patches to add missing precondition checks
 */
export function generatePreconditionPatches(
  analysis: AnalysisResult,
  context: PatchContext
): Patch[] {
  const patches: Patch[] = [];
  const { failure, relatedCode } = analysis;

  // Parse the predicate to understand what check is needed
  const fix = parsePreconditionPredicate(failure.predicate);
  
  if (!fix) {
    return patches;
  }

  // Find the best location to insert the check
  const insertLocation = findInsertLocation(context.implementation, relatedCode);
  
  if (!insertLocation) {
    return patches;
  }

  // Generate the check code
  const checkCode = generateCheckCode(fix, context);

  patches.push({
    type: 'insert',
    file: insertLocation.file,
    line: insertLocation.line,
    column: 0,
    content: checkCode,
    description: `Add precondition check: ${failure.predicate}`,
    confidence: analysis.confidence,
  });

  return patches;
}

/**
 * Parse precondition predicate to determine the check needed
 */
function parsePreconditionPredicate(predicate: string): PreconditionFix | null {
  // Handle entity existence checks
  // Pattern: not Entity.exists(field) or !Entity.exists(field)
  const notExistsMatch = predicate.match(/not\s+(\w+)\.exists\(([^)]+)\)/i);
  if (notExistsMatch) {
    const [, entity, field] = notExistsMatch;
    return {
      check: `await ${entity}Repository.exists(${field})`,
      errorType: `${entity!.toUpperCase()}_ALREADY_EXISTS`,
      errorMessage: `${entity} already exists`,
      insertBefore: 'create',
    };
  }

  // Pattern: Entity.exists(field)
  const existsMatch = predicate.match(/(\w+)\.exists\(([^)]+)\)/i);
  if (existsMatch) {
    const [, entity, field] = existsMatch;
    return {
      check: `await ${entity}Repository.exists(${field})`,
      errorType: `${entity!.toUpperCase()}_NOT_FOUND`,
      errorMessage: `${entity} not found`,
      insertBefore: 'lookup',
    };
  }

  // Handle comparison checks
  // Pattern: input.field >= value or field.length >= value
  const comparisonMatch = predicate.match(/(\w+(?:\.\w+)*)\s*(>=|<=|>|<|==|!=)\s*(\d+|\w+)/);
  if (comparisonMatch) {
    const [, field, operator, value] = comparisonMatch;
    const invertedOp = invertOperator(operator!);
    return {
      check: `${field} ${invertedOp} ${value}`,
      errorType: 'VALIDATION_ERROR',
      errorMessage: `${field} must be ${operator} ${value}`,
    };
  }

  // Handle is_valid checks
  // Pattern: input.field.is_valid
  const validMatch = predicate.match(/(\w+(?:\.\w+)*)\.is_valid/i);
  if (validMatch) {
    const [, field] = validMatch;
    return {
      check: `!isValid(${field})`,
      errorType: 'INVALID_INPUT',
      errorMessage: `Invalid ${field}`,
    };
  }

  // Handle length checks
  // Pattern: input.field.length >= value
  const lengthMatch = predicate.match(/(\w+(?:\.\w+)*)\.length\s*(>=|<=|>|<)\s*(\d+)/);
  if (lengthMatch) {
    const [, field, operator, value] = lengthMatch;
    const invertedOp = invertOperator(operator!);
    return {
      check: `${field}.length ${invertedOp} ${value}`,
      errorType: 'VALIDATION_ERROR',
      errorMessage: `${field} length must be ${operator} ${value}`,
    };
  }

  return null;
}

/**
 * Invert a comparison operator for the error condition
 */
function invertOperator(op: string): string {
  const inversions: Record<string, string> = {
    '>=': '<',
    '<=': '>',
    '>': '<=',
    '<': '>=',
    '==': '!=',
    '!=': '==',
  };
  return inversions[op] ?? op;
}

/**
 * Find the best location to insert the precondition check
 */
function findInsertLocation(
  implementation: string,
  relatedCode: Array<{ startLine: number; endLine: number }>
): SourceLocation | null {
  const lines = implementation.split('\n');

  // Look for function start
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    
    // Find async function or arrow function start
    if (/async\s+function\s+\w+\s*\(|=\s*async\s*\([^)]*\)\s*=>|=\s*async\s+function/.test(line)) {
      // Find the opening brace
      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j]!.includes('{')) {
          return {
            file: 'implementation',
            line: j + 2, // Insert after the opening brace
          };
        }
      }
    }
  }

  // Fall back to first related code location
  if (relatedCode.length > 0) {
    return {
      file: 'implementation',
      line: relatedCode[0]!.startLine,
    };
  }

  return null;
}

/**
 * Generate the check code
 */
function generateCheckCode(fix: PreconditionFix, context: PatchContext): string {
  const indent = context.indentation ?? '  ';
  
  // Determine if it's an async check
  const isAsync = fix.check.includes('await');
  
  // Generate appropriate error throwing
  const errorCode = context.useCustomErrors
    ? `throw new BehaviorError({ code: '${fix.errorType}', message: '${fix.errorMessage}', retriable: false });`
    : `throw new Error('${fix.errorMessage}');`;

  // Handle negated checks (entity should NOT exist)
  if (fix.check.startsWith('await') && fix.errorType.includes('ALREADY_EXISTS')) {
    return `${indent}// Precondition: ensure entity doesn't already exist
${indent}if (${fix.check}) {
${indent}${indent}${errorCode}
${indent}}
`;
  }

  // Handle existence checks (entity SHOULD exist)
  if (fix.check.startsWith('await') && fix.errorType.includes('NOT_FOUND')) {
    return `${indent}// Precondition: ensure entity exists
${indent}if (!(${fix.check})) {
${indent}${indent}${errorCode}
${indent}}
`;
  }

  // Handle validation checks
  return `${indent}// Precondition: ${fix.errorMessage}
${indent}if (${fix.check}) {
${indent}${indent}${errorCode}
${indent}}
`;
}

/**
 * Generate a complete precondition validation block
 */
export function generateValidationBlock(
  predicates: string[],
  context: PatchContext
): string {
  const indent = context.indentation ?? '  ';
  const lines: string[] = [];

  lines.push(`${indent}// Validate preconditions`);

  for (const predicate of predicates) {
    const fix = parsePreconditionPredicate(predicate);
    if (fix) {
      const checkCode = generateCheckCode(fix, context);
      lines.push(checkCode);
    }
  }

  return lines.join('\n');
}
