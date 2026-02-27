/**
 * Delete Expectation Mutator
 * 
 * Removes test assertions/expectations from test files.
 * This mutation should cause the verification to report
 * missing or unchecked postconditions.
 */

import type { Mutator, MutatorContext, MutationResult } from '../types.js';

/**
 * Patterns that identify test expectations
 */
const EXPECTATION_PATTERNS = [
  // Jest/Vitest expect
  /^\s*expect\s*\(.*\)\.(toBe|toEqual|toStrictEqual|toBeDefined|toBeNull|toBeUndefined|toBeTruthy|toBeFalsy|toContain|toHaveLength|toHaveProperty|toThrow|toMatch)/,
  // Assert statements in tests
  /^\s*assert\.(ok|equal|strictEqual|deepEqual|notEqual|throws|doesNotThrow)\s*\(/,
  // Chai assertions
  /^\s*(expect|should|assert)\(.*\)\.(to|be|have|include|equal|eql|deep)/,
  // Custom verify calls
  /^\s*verify\s*\(.*\)\s*;?\s*$/,
  // ISL verification assertions
  /^\s*(checkPostcondition|checkPrecondition|checkInvariant|assertClause)\s*\(/,
];

/**
 * Check if a line contains a test expectation
 */
function isExpectationLine(line: string): boolean {
  return EXPECTATION_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Delete Expectation Mutator Implementation
 */
export const deleteExpectationMutator: Mutator = {
  type: 'delete-expectation',

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
    
    return isExpectationLine(targetLine);
  },

  apply(ctx: MutatorContext): MutationResult {
    const lines = ctx.source.split('\n');
    const lineIndex = ctx.target.line - 1;
    const originalLine = lines[lineIndex];
    
    if (!originalLine) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'Target line not found',
        affectedLines: [],
      };
    }

    if (!this.canApply(ctx)) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'No expectation found at target line',
        affectedLines: [],
      };
    }

    // Handle chained expectations (e.g., expect().toBe().and.toBe())
    let endLineIndex = lineIndex;
    let expectationContent = originalLine;
    
    // Check for incomplete statements (chained calls, multi-line)
    let parenCount = (originalLine.match(/\(/g) || []).length - 
                     (originalLine.match(/\)/g) || []).length;
    
    // Also check for trailing dot (chained call)
    let endsWithDot = originalLine.trimEnd().endsWith('.');
    
    while ((parenCount > 0 || endsWithDot) && endLineIndex < lines.length - 1) {
      endLineIndex++;
      const nextLine = lines[endLineIndex]!;
      expectationContent += '\n' + nextLine;
      parenCount += (nextLine.match(/\(/g) || []).length;
      parenCount -= (nextLine.match(/\)/g) || []).length;
      endsWithDot = nextLine.trimEnd().endsWith('.');
    }

    // Get indentation for comment
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';
    
    // Replace expectation with comment
    const mutatedLines = [...lines];
    mutatedLines[lineIndex] = `${indent}// MUTATION: Expectation deleted`;
    
    // Comment out any continuation lines
    for (let i = lineIndex + 1; i <= endLineIndex; i++) {
      mutatedLines[i] = `${indent}// ${lines[i]?.trim()}`;
    }

    const affectedLines = [];
    for (let i = lineIndex; i <= endLineIndex; i++) {
      affectedLines.push(i + 1);
    }

    return {
      applied: true,
      mutatedSource: mutatedLines.join('\n'),
      changeDescription: `Deleted expectation at line ${ctx.target.line}: ${originalLine.trim()}`,
      affectedLines,
    };
  },
};

export default deleteExpectationMutator;
