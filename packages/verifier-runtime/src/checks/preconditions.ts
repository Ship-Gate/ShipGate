// ============================================================================
// Precondition Checker - Verify preconditions before execution
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import type { CheckResult, EvaluationContext } from '../types';
import { evaluate, expressionToString, EvaluationError } from '../expressions';

/**
 * Check all preconditions for a behavior
 */
export function checkPreconditions(
  behavior: AST.Behavior,
  ctx: EvaluationContext
): CheckResult[] {
  const results: CheckResult[] = [];

  for (let i = 0; i < behavior.preconditions.length; i++) {
    const precondition = behavior.preconditions[i]!;
    const result = checkPrecondition(precondition, i, ctx);
    results.push(result);
  }

  return results;
}

/**
 * Check a single precondition
 */
function checkPrecondition(
  expr: AST.Expression,
  index: number,
  ctx: EvaluationContext
): CheckResult {
  const startTime = performance.now();
  const expressionStr = expressionToString(expr);
  const name = `precondition_${index + 1}`;

  try {
    const result = evaluate(expr, ctx);
    const passed = Boolean(result);
    const duration = performance.now() - startTime;

    return {
      type: 'precondition',
      name,
      expression: expressionStr,
      passed,
      expected: true,
      actual: result,
      duration,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof EvaluationError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

    return {
      type: 'precondition',
      name,
      expression: expressionStr,
      passed: false,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Check if all preconditions pass
 */
export function allPreconditionsPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.passed);
}

/**
 * Get failed preconditions
 */
export function getFailedPreconditions(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => !r.passed);
}

/**
 * Format precondition check results for display
 */
export function formatPreconditionResults(results: CheckResult[]): string {
  const lines: string[] = ['Precondition Checks:'];
  
  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    lines.push(`  ${status} ${result.expression}`);
    
    if (!result.passed) {
      if (result.error) {
        lines.push(`      Error: ${result.error}`);
      } else {
        lines.push(`      Expected: true`);
        lines.push(`      Actual: ${JSON.stringify(result.actual)}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  lines.push(`  ${passed}/${results.length} passed`);

  return lines.join('\n');
}
