/**
 * Bypass Precondition Mutator
 * 
 * Short-circuits precondition validation functions to always return true.
 * This mutation should cause verification failures when the verifier
 * checks that preconditions are actually enforced.
 */

import type { Mutator, MutatorContext, MutationResult } from '../types.js';

/**
 * Patterns that identify precondition check functions
 */
const PRECONDITION_FUNCTION_PATTERNS = [
  // Functions named with precondition-like names
  /^(\s*)(export\s+)?(async\s+)?function\s+(check|validate|verify|ensure|require|assert|guard|precondition)\w*\s*\(/,
  // Arrow functions assigned to precondition-like names
  /^(\s*)(export\s+)?(const|let)\s+(check|validate|verify|ensure|require|guard|precondition)\w*\s*=\s*(async\s+)?\(/,
  // Method definitions
  /^(\s*)(private|public|protected)?\s*(async\s+)?(check|validate|verify|ensure|require|guard|precondition)\w*\s*\(/,
];

/**
 * Patterns that identify the body of a precondition function
 */
const PRECONDITION_BODY_PATTERNS = [
  // Return statements with boolean expressions
  /^\s*return\s+.*&&.*$/,
  /^\s*return\s+.*\|\|.*$/,
  /^\s*return\s+.*[<>=!].*$/,
  // If-throw patterns
  /^\s*if\s*\(.*\)\s*(throw|return\s+false)/,
];

/**
 * Check if a line is a precondition function definition
 */
function isPreconditionFunction(line: string): boolean {
  return PRECONDITION_FUNCTION_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Check if a line is inside a precondition function body
 */
function isPreconditionBody(line: string): boolean {
  return PRECONDITION_BODY_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Bypass Precondition Mutator Implementation
 */
export const bypassPreconditionMutator: Mutator = {
  type: 'bypass-precondition',

  canApply(ctx: MutatorContext): boolean {
    const lines = ctx.source.split('\n');
    const targetLine = lines[ctx.target.line - 1];
    
    if (!targetLine) return false;
    
    // Check if the pattern matches
    if (ctx.target.pattern) {
      const pattern = typeof ctx.target.pattern === 'string'
        ? new RegExp(ctx.target.pattern)
        : ctx.target.pattern;
      return pattern.test(targetLine);
    }
    
    // Check if it's a precondition function or body
    return isPreconditionFunction(targetLine) || isPreconditionBody(targetLine);
  },

  apply(ctx: MutatorContext): MutationResult {
    const lines = ctx.source.split('\n');
    const lineIndex = ctx.target.line - 1;
    const targetLine = lines[lineIndex];
    
    if (!targetLine) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'Target line not found',
        affectedLines: [],
      };
    }

    // Get indentation
    const indent = targetLine.match(/^(\s*)/)?.[1] || '';

    // Strategy 1: If this is a function definition, add early return
    if (isPreconditionFunction(targetLine)) {
      return this.bypassFunctionDefinition(ctx, lines, lineIndex, indent);
    }

    // Strategy 2: If this is a return statement, replace with return true
    if (targetLine.includes('return') && isPreconditionBody(targetLine)) {
      return this.bypassReturnStatement(ctx, lines, lineIndex, indent, targetLine);
    }

    // Strategy 3: If this is an if-throw, comment it out
    if (/^\s*if\s*\(.*\)\s*throw/.test(targetLine)) {
      return this.bypassIfThrow(ctx, lines, lineIndex, indent);
    }

    return {
      applied: false,
      mutatedSource: ctx.source,
      changeDescription: 'Could not determine how to bypass precondition',
      affectedLines: [],
    };
  },

  /**
   * Bypass by adding early return at start of function
   */
  bypassFunctionDefinition(
    ctx: MutatorContext,
    lines: string[],
    lineIndex: number,
    indent: string
  ): MutationResult {
    const mutatedLines = [...lines];
    
    // Find the opening brace
    let braceIndex = lineIndex;
    while (braceIndex < lines.length && !lines[braceIndex]!.includes('{')) {
      braceIndex++;
    }
    
    if (braceIndex >= lines.length) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'Could not find function body',
        affectedLines: [],
      };
    }
    
    // Insert early return after opening brace
    const functionIndent = indent + '  ';
    const earlyReturn = `${functionIndent}return true; // MUTATION: Precondition bypassed`;
    
    // Find the end of the line with the brace
    const braceLine = mutatedLines[braceIndex]!;
    if (braceLine.trimEnd().endsWith('{')) {
      // Insert on next line
      mutatedLines.splice(braceIndex + 1, 0, earlyReturn);
    } else {
      // Brace is inline, add after
      mutatedLines.splice(braceIndex + 1, 0, earlyReturn);
    }

    return {
      applied: true,
      mutatedSource: mutatedLines.join('\n'),
      changeDescription: `Bypassed precondition function at line ${ctx.target.line}`,
      affectedLines: [braceIndex + 2],
    };
  },

  /**
   * Bypass by replacing return statement with return true
   */
  bypassReturnStatement(
    ctx: MutatorContext,
    lines: string[],
    lineIndex: number,
    indent: string,
    originalLine: string
  ): MutationResult {
    const mutatedLines = [...lines];
    
    // Replace the return statement with return true
    mutatedLines[lineIndex] = `${indent}return true; // MUTATION: ${originalLine.trim()}`;

    return {
      applied: true,
      mutatedSource: mutatedLines.join('\n'),
      changeDescription: `Bypassed precondition return at line ${ctx.target.line}`,
      affectedLines: [ctx.target.line],
    };
  },

  /**
   * Bypass by commenting out if-throw
   */
  bypassIfThrow(
    ctx: MutatorContext,
    lines: string[],
    lineIndex: number,
    indent: string
  ): MutationResult {
    const mutatedLines = [...lines];
    const originalLine = lines[lineIndex]!;
    
    // Handle multi-line if-throw
    let endLineIndex = lineIndex;
    let braceCount = (originalLine.match(/\{/g) || []).length - 
                     (originalLine.match(/\}/g) || []).length;
    
    // If there's an opening brace, find the closing one
    if (braceCount > 0) {
      while (braceCount > 0 && endLineIndex < lines.length - 1) {
        endLineIndex++;
        const nextLine = lines[endLineIndex]!;
        braceCount += (nextLine.match(/\{/g) || []).length;
        braceCount -= (nextLine.match(/\}/g) || []).length;
      }
    }

    // Comment out all lines
    mutatedLines[lineIndex] = `${indent}// MUTATION: Precondition check bypassed`;
    for (let i = lineIndex; i <= endLineIndex; i++) {
      mutatedLines[i] = `${indent}// ${lines[i]?.trim()}`;
    }

    const affectedLines = [];
    for (let i = lineIndex; i <= endLineIndex; i++) {
      affectedLines.push(i + 1);
    }

    return {
      applied: true,
      mutatedSource: mutatedLines.join('\n'),
      changeDescription: `Bypassed if-throw precondition at line ${ctx.target.line}`,
      affectedLines,
    };
  },
};

export default bypassPreconditionMutator;
