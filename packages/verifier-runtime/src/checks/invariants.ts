// ============================================================================
// Invariant Checker - Verify invariants hold throughout execution
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import type { CheckResult, EvaluationContext } from '../types';
import { evaluate, expressionToString, EvaluationError } from '../expressions';

/**
 * Check all invariants for a behavior
 */
export function checkInvariants(
  behavior: AST.Behavior,
  ctx: EvaluationContext
): CheckResult[] {
  const results: CheckResult[] = [];

  // Check behavior-level invariants
  for (let i = 0; i < behavior.invariants.length; i++) {
    const invariant = behavior.invariants[i]!;
    const result = checkInvariant(invariant, `behavior_${i + 1}`, ctx);
    results.push(result);
  }

  return results;
}

/**
 * Check domain-level invariants
 */
export function checkDomainInvariants(
  domain: AST.Domain,
  ctx: EvaluationContext
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const block of domain.invariants) {
    for (let i = 0; i < block.predicates.length; i++) {
      const predicate = block.predicates[i]!;
      const name = `${block.name.name}_${i + 1}`;
      const result = checkInvariant(predicate, name, ctx);
      results.push(result);
    }
  }

  return results;
}

/**
 * Check entity invariants
 */
export function checkEntityInvariants(
  entity: AST.Entity,
  ctx: EvaluationContext
): CheckResult[] {
  const results: CheckResult[] = [];
  const entityName = entity.name.name;

  // Get all instances of this entity
  const instances = ctx.store.getAll(entityName);

  for (const instance of instances) {
    // Create a context with the instance bound
    const instanceCtx = {
      ...ctx,
      variables: new Map(ctx.variables),
    };
    instanceCtx.variables.set('this', instance);
    instanceCtx.variables.set(entityName.toLowerCase(), instance);

    for (let i = 0; i < entity.invariants.length; i++) {
      const invariant = entity.invariants[i]!;
      const name = `${entityName}_${instance.__id__}_invariant_${i + 1}`;
      const result = checkInvariant(invariant, name, instanceCtx);
      results.push(result);
    }
  }

  return results;
}

/**
 * Check a single invariant
 */
function checkInvariant(
  expr: AST.Expression,
  name: string,
  ctx: EvaluationContext
): CheckResult {
  const startTime = performance.now();
  const expressionStr = expressionToString(expr);

  try {
    const result = evaluate(expr, ctx);
    const passed = Boolean(result);
    const duration = performance.now() - startTime;

    return {
      type: 'invariant',
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
      type: 'invariant',
      name,
      expression: expressionStr,
      passed: false,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Check all invariants (behavior + domain + entities)
 */
export function checkAllInvariants(
  behavior: AST.Behavior,
  domain: AST.Domain,
  ctx: EvaluationContext
): CheckResult[] {
  const results: CheckResult[] = [];

  // Behavior invariants
  results.push(...checkInvariants(behavior, ctx));

  // Domain invariants
  results.push(...checkDomainInvariants(domain, ctx));

  // Entity invariants for all entities
  for (const entity of domain.entities) {
    results.push(...checkEntityInvariants(entity, ctx));
  }

  return results;
}

/**
 * Check if all invariants pass
 */
export function allInvariantsPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.passed);
}

/**
 * Get failed invariants
 */
export function getFailedInvariants(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => !r.passed);
}

/**
 * Format invariant check results for display
 */
export function formatInvariantResults(results: CheckResult[]): string {
  const lines: string[] = ['Invariant Checks:'];
  
  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    lines.push(`  ${status} [${result.name}] ${result.expression}`);
    
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
 * Group invariant results by type (behavior, domain, entity)
 */
export function groupInvariantsByType(
  results: CheckResult[]
): { behavior: CheckResult[]; domain: CheckResult[]; entity: CheckResult[] } {
  const behavior: CheckResult[] = [];
  const domain: CheckResult[] = [];
  const entity: CheckResult[] = [];

  for (const result of results) {
    if (result.name.startsWith('behavior_')) {
      behavior.push(result);
    } else if (result.name.includes('_invariant_')) {
      entity.push(result);
    } else {
      domain.push(result);
    }
  }

  return { behavior, domain, entity };
}
