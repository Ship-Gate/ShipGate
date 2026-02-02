// ============================================================================
// ISL Runtime Interpreter - Contract Checking
// @isl-lang/runtime-interpreter/contracts
// ============================================================================

import type {
  Value,
  Expression,
  Environment,
  ExecutionContext,
  BehaviorDefinition,
  EntityDefinition,
  InvariantDefinition,
  ContractMode,
} from './types';
import { evaluate } from './evaluator';
import { extendEnvironment } from './environment';
import { ContractViolationError } from './types';

// ============================================================================
// CONTRACT MODES (re-export from types for convenience)
// ============================================================================

export type { ContractMode };

export interface ContractConfig {
  mode: ContractMode;
  onViolation?: (violation: ContractViolation) => void;
  collectViolations?: boolean;
  maxViolations?: number;
}

export interface ContractViolation {
  kind: 'precondition' | 'postcondition' | 'invariant';
  expression: string;
  expectedValue?: Value;
  actualValue?: Value;
  context: Record<string, Value>;
  timestamp: Date;
}

// ============================================================================
// PRECONDITION CHECKING
// ============================================================================

/**
 * Check all preconditions for a behavior.
 */
export async function checkPreconditions(
  behavior: BehaviorDefinition,
  input: Map<string, Value>,
  env: Environment,
  ctx: ExecutionContext,
  config?: ContractConfig
): Promise<ContractCheckResult> {
  const mode = config?.mode ?? ctx.contractMode;
  if (mode === 'skip') {
    return { success: true, violations: [] };
  }

  const violations: ContractViolation[] = [];
  const checkEnv = extendEnvironment(env);
  
  // Bind input values
  for (const [name, value] of input) {
    checkEnv.bindings.set(name, value);
  }

  for (const precond of behavior.preconditions) {
    try {
      const result = await evaluate(precond, checkEnv, ctx);
      
      if (mode === 'assume') {
        // In assume mode, we trust preconditions are true
        continue;
      }
      
      if (result.tag !== 'boolean') {
        violations.push({
          kind: 'precondition',
          expression: expressionToString(precond),
          expectedValue: { tag: 'boolean', value: true },
          actualValue: result,
          context: Object.fromEntries(input),
          timestamp: new Date(),
        });
      } else if (!result.value) {
        violations.push({
          kind: 'precondition',
          expression: expressionToString(precond),
          expectedValue: { tag: 'boolean', value: true },
          actualValue: result,
          context: Object.fromEntries(input),
          timestamp: new Date(),
        });
      }
    } catch (error) {
      violations.push({
        kind: 'precondition',
        expression: expressionToString(precond),
        context: Object.fromEntries(input),
        timestamp: new Date(),
      });
    }

    if (config?.maxViolations && violations.length >= config.maxViolations) {
      break;
    }
  }

  if (violations.length > 0 && config?.onViolation) {
    for (const v of violations) {
      config.onViolation(v);
    }
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

// ============================================================================
// POSTCONDITION CHECKING
// ============================================================================

/**
 * Check all postconditions for a behavior.
 */
export async function checkPostconditions(
  behavior: BehaviorDefinition,
  result: Value,
  oldValues: Map<string, Value>,
  input: Map<string, Value>,
  env: Environment,
  ctx: ExecutionContext,
  config?: ContractConfig
): Promise<ContractCheckResult> {
  const mode = config?.mode ?? ctx.contractMode;
  if (mode === 'skip' || mode === 'assume') {
    return { success: true, violations: [] };
  }

  const violations: ContractViolation[] = [];
  const checkEnv = extendEnvironment(env);
  
  // Bind input values
  for (const [name, value] of input) {
    checkEnv.bindings.set(name, value);
  }
  
  // Bind result
  checkEnv.bindings.set('result', result);
  
  // Bind old values
  for (const [name, value] of oldValues) {
    checkEnv.bindings.set(`old_${name}`, value);
  }

  for (const postcond of behavior.postconditions) {
    try {
      // Substitute old() references
      const substituted = substituteOldReferences(postcond);
      const checkResult = await evaluate(substituted, checkEnv, ctx);
      
      if (checkResult.tag !== 'boolean' || !checkResult.value) {
        violations.push({
          kind: 'postcondition',
          expression: expressionToString(postcond),
          expectedValue: { tag: 'boolean', value: true },
          actualValue: checkResult,
          context: { ...Object.fromEntries(input), result },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      violations.push({
        kind: 'postcondition',
        expression: expressionToString(postcond),
        context: { ...Object.fromEntries(input), result },
        timestamp: new Date(),
      });
    }

    if (config?.maxViolations && violations.length >= config.maxViolations) {
      break;
    }
  }

  if (violations.length > 0 && config?.onViolation) {
    for (const v of violations) {
      config.onViolation(v);
    }
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

// ============================================================================
// INVARIANT CHECKING
// ============================================================================

/**
 * Check entity invariants.
 */
export async function checkEntityInvariants(
  entity: EntityDefinition,
  instance: Value,
  env: Environment,
  ctx: ExecutionContext,
  config?: ContractConfig
): Promise<ContractCheckResult> {
  const mode = config?.mode ?? ctx.contractMode;
  if (mode === 'skip') {
    return { success: true, violations: [] };
  }

  const violations: ContractViolation[] = [];
  const checkEnv = extendEnvironment(env);
  checkEnv.bindings.set('this', instance);

  for (const invariant of entity.invariants) {
    try {
      const result = await evaluate(invariant, checkEnv, ctx);
      
      if (result.tag !== 'boolean' || !result.value) {
        violations.push({
          kind: 'invariant',
          expression: expressionToString(invariant),
          expectedValue: { tag: 'boolean', value: true },
          actualValue: result,
          context: { entity: instance },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      violations.push({
        kind: 'invariant',
        expression: expressionToString(invariant),
        context: { entity: instance },
        timestamp: new Date(),
      });
    }
  }

  if (violations.length > 0 && config?.onViolation) {
    for (const v of violations) {
      config.onViolation(v);
    }
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

/**
 * Check global invariants.
 */
export async function checkInvariants(
  invariants: Map<string, InvariantDefinition>,
  env: Environment,
  ctx: ExecutionContext,
  config?: ContractConfig
): Promise<ContractCheckResult> {
  const mode = config?.mode ?? ctx.contractMode;
  if (mode === 'skip') {
    return { success: true, violations: [] };
  }

  const violations: ContractViolation[] = [];

  for (const [name, invariant] of invariants) {
    for (const expr of invariant.always) {
      try {
        const result = await evaluate(expr, env, ctx);
        
        if (result.tag !== 'boolean' || !result.value) {
          violations.push({
            kind: 'invariant',
            expression: `${name}: ${expressionToString(expr)}`,
            expectedValue: { tag: 'boolean', value: true },
            actualValue: result,
            context: {},
            timestamp: new Date(),
          });
        }
      } catch (error) {
        violations.push({
          kind: 'invariant',
          expression: `${name}: ${expressionToString(expr)}`,
          context: {},
          timestamp: new Date(),
        });
      }
    }
  }

  if (violations.length > 0 && config?.onViolation) {
    for (const v of violations) {
      config.onViolation(v);
    }
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

// ============================================================================
// CONTRACT RESULT
// ============================================================================

export interface ContractCheckResult {
  success: boolean;
  violations: ContractViolation[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function expressionToString(expr: Expression): string {
  switch (expr.tag) {
    case 'identifier':
      return expr.name;
    case 'literal':
      return JSON.stringify(expr.value);
    case 'binary':
      return `${expressionToString(expr.left)} ${expr.op} ${expressionToString(expr.right)}`;
    case 'unary':
      return `${expr.op}${expressionToString(expr.operand)}`;
    case 'call':
      return `${expressionToString(expr.fn)}(${expr.args.map(expressionToString).join(', ')})`;
    case 'member':
      return `${expressionToString(expr.object)}.${expr.field}`;
    case 'conditional':
      return `if ${expressionToString(expr.condition)} then ${expressionToString(expr.then)} else ${expressionToString(expr.else)}`;
    case 'quantifier':
      return `${expr.kind} ${expr.variable} in ${expressionToString(expr.domain)}: ${expressionToString(expr.body)}`;
    case 'old':
      return `old(${expressionToString(expr.expression)})`;
    case 'result':
      return 'result';
    default:
      return `[${expr.tag}]`;
  }
}

function substituteOldReferences(expr: Expression): Expression {
  if (expr.tag === 'old') {
    if (expr.expression.tag === 'identifier') {
      return { tag: 'identifier', name: `old_${expr.expression.name}` };
    }
    return expr;
  }

  // Recursively substitute in child expressions
  const result: any = { ...expr };
  for (const key of Object.keys(expr)) {
    const value = (expr as any)[key];
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        result[key] = value.map(v =>
          v && typeof v === 'object' && 'tag' in v ? substituteOldReferences(v) : v
        );
      } else if ('tag' in value) {
        result[key] = substituteOldReferences(value);
      }
    }
  }
  return result;
}

// ============================================================================
// CONTRACT ASSERTIONS
// ============================================================================

/**
 * Assert a condition holds.
 */
export async function assertContract(
  condition: Expression,
  message: string,
  env: Environment,
  ctx: ExecutionContext
): Promise<void> {
  if (ctx.contractMode === 'skip') {
    return;
  }

  const result = await evaluate(condition, env, ctx);
  
  if (result.tag !== 'boolean' || !result.value) {
    throw new ContractViolationError('invariant', message);
  }
}

/**
 * Assume a condition holds (for contract mode 'assume').
 */
export function assumeContract(
  _condition: Expression,
  _message: string,
  ctx: ExecutionContext
): void {
  if (ctx.contractMode !== 'assume') {
    return;
  }
  // In assume mode, we don't check - we trust the condition holds
}

// ============================================================================
// CONTRACT DECORATORS (for TypeScript interop)
// ============================================================================

/**
 * Decorator to add precondition checking to a function.
 */
export function requires(_condition: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      // Parse and check condition
      // Simplified - would need actual parsing
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

/**
 * Decorator to add postcondition checking to a function.
 */
export function ensures(_condition: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);
      // Parse and check condition with result
      return result;
    };
    return descriptor;
  };
}

/**
 * Decorator to add invariant checking to a class.
 */
export function invariant(_condition: string) {
  return function (constructor: Function) {
    // Add invariant checking to all methods
    return constructor;
  };
}
