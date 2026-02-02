/**
 * Remove Assert Mutator
 * 
 * Removes runtime assert statements that enforce preconditions/invariants.
 * This mutation should cause postcondition/invariant failures when the
 * verifier runs with inputs that would normally be rejected.
 */

import type { Mutator, MutatorContext, MutationResult } from '../types.js';

/**
 * Patterns that identify assert-like statements
 */
const ASSERT_PATTERNS = [
  // Standard assert
  /^\s*assert\s*\(.*\)\s*;?\s*$/,
  // console.assert
  /^\s*console\.assert\s*\(.*\)\s*;?\s*$/,
  // Node.js assert
  /^\s*assert\.(ok|equal|strictEqual|deepEqual|throws|rejects)\s*\(.*\)\s*;?\s*$/,
  // Custom assertion functions
  /^\s*(invariant|precondition|require|ensure)\s*\(.*\)\s*;?\s*$/,
  // Throw-based assertions
  /^\s*if\s*\(.*\)\s*throw\s+/,
];

/**
 * Check if a line contains an assert-like statement
 */
function isAssertLine(line: string): boolean {
  return ASSERT_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Remove Assert Mutator Implementation
 */
export const removeAssertMutator: Mutator = {
  type: 'remove-assert',

  canApply(ctx: MutatorContext): boolean {
    const lines = ctx.source.split('\n');
    const targetLine = lines[ctx.target.line - 1];
    
    if (!targetLine) return false;
    
    // Check if the pattern matches or line contains assertion
    if (ctx.target.pattern) {
      const pattern = typeof ctx.target.pattern === 'string'
        ? new RegExp(ctx.target.pattern)
        : ctx.target.pattern;
      return pattern.test(targetLine);
    }
    
    return isAssertLine(targetLine);
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
        changeDescription: 'No assert statement found at target line',
        affectedLines: [],
      };
    }

    // Handle multi-line assert statements
    let endLineIndex = lineIndex;
    let assertContent = originalLine;
    
    // Check for incomplete statements (missing closing paren/semicolon)
    let parenCount = (originalLine.match(/\(/g) || []).length - 
                     (originalLine.match(/\)/g) || []).length;
    
    while (parenCount > 0 && endLineIndex < lines.length - 1) {
      endLineIndex++;
      const nextLine = lines[endLineIndex]!;
      assertContent += '\n' + nextLine;
      parenCount += (nextLine.match(/\(/g) || []).length;
      parenCount -= (nextLine.match(/\)/g) || []).length;
    }

    // Get indentation for comment
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';
    
    // Replace assert with comment
    const mutatedLines = [...lines];
    mutatedLines[lineIndex] = `${indent}// MUTATION: Assert removed`;
    
    // Remove any continuation lines
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
      changeDescription: `Removed assert at line ${ctx.target.line}: ${originalLine.trim()}`,
      affectedLines,
    };
  },
};

export default removeAssertMutator;
