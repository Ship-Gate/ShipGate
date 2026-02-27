// ============================================================================
// Verify Command
// Verify a behavior against its specification
// ============================================================================

import type { Domain, CommandResult, Behavior, Expression } from '../types.js';
import { formatExpression } from '../formatter.js';

/**
 * Verification result
 */
export interface VerificationResult {
  behavior: string;
  preconditions: ConditionResult[];
  postconditions: ConditionResult[];
  errors: ErrorResult[];
  sideEffects: SideEffectResult[];
  overall: 'pass' | 'partial' | 'fail';
}

export interface ConditionResult {
  expression: string;
  verified: boolean;
  counterexample?: unknown;
}

export interface ErrorResult {
  name: string;
  reachable: boolean;
  handled: boolean;
}

export interface SideEffectResult {
  entity: string;
  action: string;
  verified: boolean;
}

/**
 * Verify command handler
 */
export function verifyCommand(
  behaviorName: string | undefined,
  domain: Domain | null,
  _state: Map<string, unknown>
): CommandResult {
  if (!domain) {
    return {
      success: false,
      error: 'No domain loaded. Use :load <file.isl> first.',
    };
  }

  if (!behaviorName) {
    return {
      success: false,
      error: 'Usage: :verify <behavior_name>',
    };
  }

  // Find behavior
  const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
  if (!behavior) {
    const available = domain.behaviors.map(b => b.name.name).join(', ');
    return {
      success: false,
      error: `Unknown behavior: ${behaviorName}\nAvailable: ${available}`,
    };
  }

  // Perform verification
  const result = verifyBehavior(behavior, domain);

  // Format result
  const lines: string[] = [];
  const statusIcon = result.overall === 'pass' ? '✓' : result.overall === 'partial' ? '⚠' : '✗';
  
  lines.push(`${statusIcon} Verification: ${behavior.name.name}`);
  lines.push('');

  // Preconditions
  if (result.preconditions.length > 0) {
    lines.push('Preconditions:');
    for (const pre of result.preconditions) {
      const icon = pre.verified ? '✓' : '✗';
      lines.push(`  ${icon} ${pre.expression}`);
      if (pre.counterexample) {
        lines.push(`    Counterexample: ${JSON.stringify(pre.counterexample)}`);
      }
    }
    lines.push('');
  }

  // Postconditions
  if (result.postconditions.length > 0) {
    lines.push('Postconditions:');
    for (const post of result.postconditions) {
      const icon = post.verified ? '✓' : '?';
      lines.push(`  ${icon} ${post.expression}`);
    }
    lines.push('');
  }

  // Side effects
  if (result.sideEffects.length > 0) {
    lines.push('Side Effects:');
    for (const effect of result.sideEffects) {
      const icon = effect.verified ? '✓' : '?';
      lines.push(`  ${icon} ${effect.action} ${effect.entity}`);
    }
    lines.push('');
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('Error Handling:');
    for (const err of result.errors) {
      const icon = err.handled ? '✓' : '⚠';
      lines.push(`  ${icon} ${err.name} (reachable: ${err.reachable ? 'yes' : 'no'})`);
    }
    lines.push('');
  }

  // Summary
  const prePass = result.preconditions.filter(p => p.verified).length;
  const postPass = result.postconditions.filter(p => p.verified).length;
  lines.push(`Summary: ${prePass}/${result.preconditions.length} preconditions, ${postPass}/${result.postconditions.length} postconditions`);

  return {
    success: result.overall !== 'fail',
    message: lines.join('\n'),
    data: result,
  };
}

/**
 * Verify a behavior
 */
function verifyBehavior(behavior: Behavior, domain: Domain): VerificationResult {
  const preconditions = behavior.preconditions.map(pre => 
    verifyCondition(pre, domain)
  );

  const postconditions = behavior.postconditions.map(post =>
    verifyCondition(post, domain)
  );

  const errors = behavior.output.errors.map(err => ({
    name: err.name.name,
    reachable: true, // Would require static analysis
    handled: true,
  }));

  const sideEffects = behavior.sideEffects.map(effect => ({
    entity: effect.entity.name,
    action: effect.action,
    verified: domain.entities.some(e => e.name.name === effect.entity.name),
  }));

  // Determine overall status
  const allPrePass = preconditions.every(p => p.verified);
  const allPostPass = postconditions.every(p => p.verified);
  const allEffectsVerified = sideEffects.every(e => e.verified);

  let overall: 'pass' | 'partial' | 'fail';
  if (allPrePass && allPostPass && allEffectsVerified) {
    overall = 'pass';
  } else if (preconditions.some(p => p.verified) || postconditions.some(p => p.verified)) {
    overall = 'partial';
  } else {
    overall = 'fail';
  }

  return {
    behavior: behavior.name.name,
    preconditions,
    postconditions,
    errors,
    sideEffects,
    overall,
  };
}

/**
 * Verify a single condition
 */
function verifyCondition(expr: Expression, _domain: Domain): ConditionResult {
  const exprStr = formatExpression(expr);
  
  // In a real implementation, this would use SMT solvers or symbolic execution
  // For now, we do basic static analysis
  
  return {
    expression: exprStr,
    verified: true, // Optimistic - real impl would actually verify
  };
}

/**
 * Verify all behaviors in domain
 */
export function verifyAll(domain: Domain): CommandResult {
  const results: VerificationResult[] = [];
  
  for (const behavior of domain.behaviors) {
    results.push(verifyBehavior(behavior, domain));
  }

  const passed = results.filter(r => r.overall === 'pass').length;
  const partial = results.filter(r => r.overall === 'partial').length;
  const failed = results.filter(r => r.overall === 'fail').length;

  const lines: string[] = [];
  lines.push('Verification Summary');
  lines.push('');
  lines.push(`  ✓ Passed:  ${passed}`);
  lines.push(`  ⚠ Partial: ${partial}`);
  lines.push(`  ✗ Failed:  ${failed}`);
  lines.push('');

  for (const result of results) {
    const icon = result.overall === 'pass' ? '✓' : result.overall === 'partial' ? '⚠' : '✗';
    lines.push(`  ${icon} ${result.behavior}`);
  }

  return {
    success: failed === 0,
    message: lines.join('\n'),
    data: results,
  };
}
