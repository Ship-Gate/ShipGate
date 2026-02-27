/**
 * Pattern: Catch blocks that return success
 * Detects: catch { return { success: true } } or catch { return success }
 */

import * as ts from 'typescript';
import type {
  FakeSuccessClaim,
  CallChainEvidence,
  PatternType,
} from '../types.js';
import { getSourceText, getLineAndColumn } from '../utils/ast-utils.js';

/**
 * Detect catch blocks that return success
 */
export function detectCatchReturnsSuccess(
  sourceFile: ts.SourceFile,
  filePath: string,
  content: string
): FakeSuccessClaim[] {
  const claims: FakeSuccessClaim[] = [];

  function visit(node: ts.Node) {
    // Look for catch clauses
    if (ts.isCatchClause(node)) {
      const catchBlock = node.block;
      if (catchBlock && ts.isBlock(catchBlock)) {
        // Check all statements in catch block
        for (const statement of catchBlock.statements) {
          // Check for return statements
          if (ts.isReturnStatement(statement)) {
            const returnExpression = statement.expression;
            if (returnExpression) {
              const returnText = getSourceText(returnExpression, sourceFile);
              const isSuccessReturn = checkIfSuccessReturn(returnText);

              if (isSuccessReturn) {
                // Find the try statement parent
                let tryNode: ts.TryStatement | null = null;
                let parent: ts.Node | undefined = node.parent;
                while (parent) {
                  if (ts.isTryStatement(parent)) {
                    tryNode = parent;
                    break;
                  }
                  parent = parent.parent;
                }

                if (tryNode) {
                  const catchStart = getLineAndColumn(
                    node.getStart(sourceFile),
                    sourceFile
                  );
                  const catchEnd = getLineAndColumn(
                    node.getEnd(),
                    sourceFile
                  );
                  const returnStart = getLineAndColumn(
                    statement.getStart(sourceFile),
                    sourceFile
                  );

                  const callChain: CallChainEvidence = {
                    errorOrigin: {
                      line: catchStart.line,
                      column: catchStart.column,
                      type: 'catch',
                    },
                    successDisplay: {
                      line: returnStart.line,
                      column: returnStart.column,
                      type: 'return',
                    },
                  };

                  const snippet = extractSnippet(
                    content,
                    catchStart.line,
                    catchEnd.line
                  );

                  const claim: FakeSuccessClaim = {
                    id: `catch-returns-success-${filePath}-${catchStart.line}`,
                    patternType: 'catch-returns-success',
                    filePath,
                    startLine: catchStart.line,
                    endLine: catchEnd.line,
                    startColumn: catchStart.column,
                    endColumn: catchEnd.column,
                    framework: 'unknown', // Will be set by caller
                    callChain,
                    snippet,
                    swallowedError: {
                      line: catchStart.line,
                      column: catchStart.column,
                      type: 'Error',
                    },
                    confidence: 0.9,
                    metadata: {
                      returnText,
                    },
                  };

                  claims.push(claim);
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return claims;
}

/**
 * Check if a return expression indicates success
 */
function checkIfSuccessReturn(text: string): boolean {
  const trimmed = text.trim();
  
  // Direct success values
  if (/^(true|1|'success'|"success"|`success`|success)$/i.test(trimmed)) {
    return true;
  }
  
  // Success object patterns
  const successPatterns = [
    /\{\s*(success|successful|ok|succeeded|status)\s*[:=]\s*(true|1|'success'|"success")/i,
    /\{\s*(success|ok|status)\s*:\s*true/i,
    /(success|ok|status)\s*[:=]\s*(true|1)/i,
  ];

  return successPatterns.some(pattern => pattern.test(text));
}

/**
 * Extract code snippet
 */
function extractSnippet(
  content: string,
  startLine: number,
  endLine: number
): string {
  const lines = content.split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}
