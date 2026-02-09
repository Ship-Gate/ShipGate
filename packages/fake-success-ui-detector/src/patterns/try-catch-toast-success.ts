/**
 * Pattern: try { await } catch { toast.success }
 * Detects: try/catch blocks where catch shows success notification
 */

import * as ts from 'typescript';
import type {
  FakeSuccessClaim,
  CallChainEvidence,
  PatternType,
} from '../types.js';
import { getSourceText, getLineAndColumn } from '../utils/ast-utils.js';
import { isSuccessNotification } from '../frameworks/index.js';
import type { FrameworkType } from '../types.js';

/**
 * Detect try/catch with toast.success in catch
 */
export function detectTryCatchToastSuccess(
  sourceFile: ts.SourceFile,
  filePath: string,
  content: string,
  framework: FrameworkType,
  library?: string
): FakeSuccessClaim[] {
  const claims: FakeSuccessClaim[] = [];

  function visit(node: ts.Node) {
    if (ts.isTryStatement(node)) {
      const tryBlock = node.tryBlock;
      const catchClause = node.catchClause;

      if (catchClause && catchClause.block) {
        // Check catch block for success notifications
        const catchBlock = catchClause.block;
        const successCalls = findSuccessNotifications(
          catchBlock,
          sourceFile,
          framework,
          library
        );

        if (successCalls.length > 0) {
          // Check if try block has async operations
          const hasAsyncOperation = hasAsyncOperationInTry(tryBlock, sourceFile);

          if (hasAsyncOperation) {
            for (const successCall of successCalls) {
              const tryStart = getLineAndColumn(
                tryBlock.getStart(sourceFile),
                sourceFile
              );
              const catchStart = getLineAndColumn(
                catchClause.getStart(sourceFile),
                sourceFile
              );
              const catchEnd = getLineAndColumn(
                catchClause.getEnd(),
                sourceFile
              );

              const callChain: CallChainEvidence = {
                errorOrigin: {
                  line: catchStart.line,
                  column: catchStart.column,
                  type: 'catch',
                },
                successDisplay: {
                  line: successCall.line,
                  column: successCall.column,
                  type: 'toast',
                  method: successCall.method,
                },
              };

              const snippet = extractSnippet(
                content,
                tryStart.line,
                catchEnd.line
              );

              const claim: FakeSuccessClaim = {
                id: `try-catch-toast-success-${filePath}-${catchStart.line}-${successCall.line}`,
                patternType: 'try-catch-toast-success',
                filePath,
                startLine: tryStart.line,
                endLine: catchEnd.line,
                startColumn: tryStart.column,
                endColumn: catchEnd.column,
                framework,
                callChain,
                snippet,
                swallowedError: {
                  line: catchStart.line,
                  column: catchStart.column,
                  type: 'Error',
                },
                confidence: 0.95,
                metadata: {
                  successMethod: successCall.method,
                  library,
                },
              };

              claims.push(claim);
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
 * Find success notification calls in a node
 */
function findSuccessNotifications(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  framework: FrameworkType,
  library?: string
): Array<{ line: number; column: number; method: string }> {
  const notifications: Array<{
    line: number;
    column: number;
    method: string;
  }> = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const methodText = getSourceText(expression, sourceFile);

      if (isSuccessNotification(methodText, framework, library)) {
        const location = getLineAndColumn(
          node.getStart(sourceFile),
          sourceFile
        );
        notifications.push({
          line: location.line,
          column: location.column,
          method: methodText,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(node);
  return notifications;
}

/**
 * Check if try block has async operations
 */
function hasAsyncOperationInTry(
  tryBlock: ts.Block,
  sourceFile: ts.SourceFile
): boolean {
  let hasAsync = false;

  function visit(node: ts.Node) {
    // Check for await expressions
    if (ts.isAwaitExpression(node)) {
      hasAsync = true;
      return;
    }

    // Check for promise chains
    if (
      ts.isCallExpression(node) &&
      node.expression &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const propName = node.expression.name.text;
      if (propName === 'then' || propName === 'catch' || propName === 'finally') {
        hasAsync = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(tryBlock);
  return hasAsync;
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
