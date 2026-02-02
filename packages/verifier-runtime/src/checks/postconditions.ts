// ============================================================================
// Postcondition Checker - Verify postconditions after execution
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { CheckResult, EvaluationContext, VerificationError } from '../types.js';
import { evaluate, expressionToString, EvaluationError } from '../expressions.js';

/**
 * Outcome type for postcondition checking
 */
export type Outcome = 'success' | 'error' | string;

/**
 * Determine the outcome based on execution result
 */
export function determineOutcome(
  result: unknown,
  error: VerificationError | undefined
): Outcome {
  if (error) {
    return error.code;
  }
  return 'success';
}

/**
 * Check all postconditions for a behavior based on outcome
 */
export function checkPostconditions(
  behavior: AST.Behavior,
  ctx: EvaluationContext,
  outcome: Outcome
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const block of behavior.postconditions) {
    // Determine if this block applies
    const blockApplies = postconditionBlockApplies(block, outcome);
    
    if (blockApplies) {
      for (let i = 0; i < block.predicates.length; i++) {
        const predicate = block.predicates[i]!;
        const result = checkPostcondition(predicate, block.condition, i, ctx);
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Determine if a postcondition block applies to the given outcome
 */
function postconditionBlockApplies(
  block: AST.PostconditionBlock,
  outcome: Outcome
): boolean {
  const condition = block.condition;

  // 'success' block applies when outcome is success
  if (condition === 'success') {
    return outcome === 'success';
  }

  // 'any_error' block applies when outcome is any error
  if (condition === 'any_error') {
    return outcome !== 'success';
  }

  // Named error block applies when outcome matches
  if (typeof condition === 'object' && condition.kind === 'Identifier') {
    return outcome === condition.name;
  }

  // Handle string condition
  return String(condition) === outcome;
}

/**
 * Check a single postcondition
 */
function checkPostcondition(
  expr: AST.Expression,
  blockCondition: AST.PostconditionBlock['condition'],
  index: number,
  ctx: EvaluationContext
): CheckResult {
  const startTime = performance.now();
  const expressionStr = expressionToString(expr);
  const conditionStr = getConditionString(blockCondition);
  const name = `postcondition_${conditionStr}_${index + 1}`;

  try {
    // Handle implies expressions specially
    if (expr.kind === 'BinaryExpr' && expr.operator === 'implies') {
      return checkImpliesPostcondition(expr, name, expressionStr, ctx, startTime);
    }

    const result = evaluate(expr, ctx);
    const passed = Boolean(result);
    const duration = performance.now() - startTime;

    return {
      type: 'postcondition',
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
      type: 'postcondition',
      name,
      expression: expressionStr,
      passed: false,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Handle implies expressions - these are conditional postconditions
 */
function checkImpliesPostcondition(
  expr: AST.BinaryExpr,
  name: string,
  expressionStr: string,
  ctx: EvaluationContext,
  startTime: number
): CheckResult {
  try {
    // Evaluate the antecedent (left side)
    const antecedent = evaluate(expr.left, ctx);
    
    // If antecedent is false, implies is trivially true
    if (!antecedent) {
      const duration = performance.now() - startTime;
      return {
        type: 'postcondition',
        name,
        expression: expressionStr,
        passed: true,
        expected: true,
        actual: true,
        duration,
      };
    }

    // Antecedent is true, so consequent must be true
    const consequent = evaluate(expr.right, ctx);
    const passed = Boolean(consequent);
    const duration = performance.now() - startTime;

    return {
      type: 'postcondition',
      name,
      expression: expressionStr,
      passed,
      expected: true,
      actual: consequent,
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
      type: 'postcondition',
      name,
      expression: expressionStr,
      passed: false,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Get string representation of condition
 */
function getConditionString(condition: AST.PostconditionBlock['condition']): string {
  if (condition === 'success') return 'success';
  if (condition === 'any_error') return 'any_error';
  if (typeof condition === 'object' && 'name' in condition) {
    return condition.name;
  }
  return String(condition);
}

/**
 * Check if all postconditions pass
 */
export function allPostconditionsPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.passed);
}

/**
 * Get failed postconditions
 */
export function getFailedPostconditions(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => !r.passed);
}

/**
 * Format postcondition check results for display
 */
export function formatPostconditionResults(results: CheckResult[]): string {
  const lines: string[] = ['Postcondition Checks:'];
  
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

/**
 * Group postcondition results by condition
 */
export function groupByCondition(
  results: CheckResult[]
): Map<string, CheckResult[]> {
  const groups = new Map<string, CheckResult[]>();

  for (const result of results) {
    // Extract condition from name (postcondition_<condition>_<index>)
    const match = result.name.match(/postcondition_(.+)_\d+/);
    const condition = match?.[1] ?? 'unknown';

    if (!groups.has(condition)) {
      groups.set(condition, []);
    }
    groups.get(condition)!.push(result);
  }

  return groups;
}
