/**
 * Pattern: .catch(() => defaultSuccess)
 * Detects: Promise chains where catch handler returns/defaults to success
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
 * Detect promise catch with default success
 */
export function detectPromiseCatchDefaultSuccess(
  sourceFile: ts.SourceFile,
  filePath: string,
  content: string,
  framework: FrameworkType,
  library?: string
): FakeSuccessClaim[] {
  const claims: FakeSuccessClaim[] = [];

  function visit(node: ts.Node) {
    // Look for property access expressions (e.g., promise.catch)
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'catch'
    ) {
      // Check if parent is a call expression
      const parent = node.parent;
      if (parent && ts.isCallExpression(parent)) {
        const catchHandler = parent.arguments[0];

        if (catchHandler) {
          const handlerText = getSourceText(catchHandler, sourceFile);
          const returnsSuccess = checkIfReturnsSuccess(
            catchHandler,
            sourceFile,
            framework,
            library
          );

          if (returnsSuccess) {
            // Find the promise call chain start
            const promiseStart = findPromiseStart(node, sourceFile);
            const catchStart = getLineAndColumn(
              parent.getStart(sourceFile),
              sourceFile
            );
            const catchEnd = getLineAndColumn(parent.getEnd(), sourceFile);

            const callChain: CallChainEvidence = {
              errorOrigin: {
                line: catchStart.line,
                column: catchStart.column,
                type: 'promise-catch',
              },
              successDisplay: returnsSuccess.successDisplay,
            };

            const snippet = extractSnippet(
              content,
              promiseStart?.line || catchStart.line,
              catchEnd.line
            );

            const claim: FakeSuccessClaim = {
              id: `promise-catch-default-success-${filePath}-${catchStart.line}`,
              patternType: 'promise-catch-default-success',
              filePath,
              startLine: promiseStart?.line || catchStart.line,
              endLine: catchEnd.line,
              startColumn: promiseStart?.column || catchStart.column,
              endColumn: catchEnd.column,
              framework,
              callChain,
              snippet,
              swallowedError: {
                line: catchStart.line,
                column: catchStart.column,
                type: 'Error',
              },
              confidence: 0.9,
              metadata: {
                handlerText,
                library,
              },
            };

            claims.push(claim);
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
 * Check if catch handler returns success
 */
function checkIfReturnsSuccess(
  handler: ts.Node,
  sourceFile: ts.SourceFile,
  framework: FrameworkType,
  library?: string
): {
  isSuccess: boolean;
  successDisplay: CallChainEvidence['successDisplay'];
} | null {
  let successFound = false;
  let successDisplay: CallChainEvidence['successDisplay'] | undefined;

  function visit(node: ts.Node) {
    // Check for return statements with success values
    if (ts.isReturnStatement(node) && node.expression) {
      const returnText = getSourceText(node.expression, sourceFile);
      if (isSuccessValue(returnText)) {
        successFound = true;
        const location = getLineAndColumn(
          node.getStart(sourceFile),
          sourceFile
        );
        successDisplay = {
          line: location.line,
          column: location.column,
          type: 'return',
        };
        return;
      }
    }

    // Check for success notification calls
    if (ts.isCallExpression(node)) {
      const methodText = getSourceText(node.expression, sourceFile);
      if (isSuccessNotification(methodText, framework, library)) {
        successFound = true;
        const location = getLineAndColumn(
          node.getStart(sourceFile),
          sourceFile
        );
        successDisplay = {
          line: location.line,
          column: location.column,
          type: 'toast',
          method: methodText,
        };
        return;
      }
    }

    // Check for arrow function that implicitly returns success
    if (ts.isArrowFunction(node) && node.body) {
      if (!ts.isBlock(node.body)) {
        // Single expression arrow function
        const bodyText = getSourceText(node.body, sourceFile);
        if (isSuccessValue(bodyText)) {
          successFound = true;
          const location = getLineAndColumn(
            node.body.getStart(sourceFile),
            sourceFile
          );
          successDisplay = {
            line: location.line,
            column: location.column,
            type: 'return',
          };
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(handler);

  if (successFound && successDisplay) {
    return { isSuccess: true, successDisplay };
  }

  return null;
}

/**
 * Check if a value/text indicates success
 */
function isSuccessValue(text: string): boolean {
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
 * Find the start of the promise chain
 */
function findPromiseStart(
  catchNode: ts.PropertyAccessExpression,
  sourceFile: ts.SourceFile
): { line: number; column: number } | null {
  let current: ts.Node = catchNode.expression;

  // Walk up the chain to find the initial promise call
  while (current) {
    if (ts.isCallExpression(current)) {
      return getLineAndColumn(current.getStart(sourceFile), sourceFile);
    }
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
    } else {
      break;
    }
  }

  return getLineAndColumn(catchNode.getStart(sourceFile), sourceFile);
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
