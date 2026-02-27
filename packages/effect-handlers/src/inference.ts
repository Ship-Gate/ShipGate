// ============================================================================
// ISL Effect System - Effect Inference
// @isl-lang/effect-handlers/inference
// ============================================================================

import type { EffectSignature, EffectRow, Eff } from './types';

// ============================================================================
// EFFECT ROW TYPE UTILITIES
// ============================================================================

/**
 * Extract the effect row from an Eff type.
 */
export type ExtractEffects<T> = T extends Eff<infer E, any> ? E : never;

/**
 * Extract the result type from an Eff type.
 */
export type ExtractResult<T> = T extends Eff<any, infer A> ? A : never;

/**
 * Check if effect E is in row R.
 */
export type InRow<E extends EffectSignature<any>, R extends EffectRow> = 
  E extends R ? true : false;

/**
 * Get all effect names in a row.
 */
export type EffectNames<R extends EffectRow> = 
  R extends EffectSignature<any> ? R['name'] : never;

// ============================================================================
// EFFECT INFERENCE ENGINE
// ============================================================================

/**
 * Effect inference context.
 */
export interface InferenceContext {
  effects: Map<string, EffectSignature<any>>;
  handlers: Map<string, string[]>; // effect name -> handler names
  scopes: EffectScope[];
}

/**
 * An effect scope tracks which effects are available.
 */
export interface EffectScope {
  name: string;
  handledEffects: Set<string>;
  parentScope: string | null;
}

/**
 * Create a new inference context.
 */
export function createInferenceContext(): InferenceContext {
  return {
    effects: new Map(),
    handlers: new Map(),
    scopes: [],
  };
}

/**
 * Register an effect in the context.
 */
export function registerEffect(
  ctx: InferenceContext,
  effect: EffectSignature<any>
): void {
  ctx.effects.set(effect.name, effect);
}

/**
 * Enter a new effect scope.
 */
export function enterScope(
  ctx: InferenceContext,
  name: string,
  handledEffects: string[]
): void {
  const parentScope = ctx.scopes.length > 0 
    ? ctx.scopes[ctx.scopes.length - 1].name 
    : null;
  
  ctx.scopes.push({
    name,
    handledEffects: new Set(handledEffects),
    parentScope,
  });
}

/**
 * Exit the current effect scope.
 */
export function exitScope(ctx: InferenceContext): EffectScope | undefined {
  return ctx.scopes.pop();
}

/**
 * Check if an effect is handled in the current scope.
 */
export function isEffectHandled(
  ctx: InferenceContext,
  effectName: string
): boolean {
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    if (ctx.scopes[i].handledEffects.has(effectName)) {
      return true;
    }
  }
  return false;
}

/**
 * Get unhandled effects at current scope.
 */
export function getUnhandledEffects(
  ctx: InferenceContext,
  requiredEffects: string[]
): string[] {
  return requiredEffects.filter(e => !isEffectHandled(ctx, e));
}

// ============================================================================
// EFFECT INFERENCE RULES
// ============================================================================

/**
 * Inference rule: Pure computations have no effects.
 */
export function inferPure<A>(_value: A): EffectRow {
  return undefined as never;
}

/**
 * Inference rule: Effect operations have that effect.
 */
export function inferPerform<E extends EffectSignature<any>>(
  effect: E
): E {
  return effect;
}

/**
 * Inference rule: Sequencing combines effects.
 */
export function inferFlatMap<E1 extends EffectRow, E2 extends EffectRow>(
  _eff1: E1,
  _eff2: E2
): E1 | E2 {
  return undefined as E1 | E2;
}

/**
 * Inference rule: Handling removes an effect.
 */
export function inferHandle<E extends EffectSignature<any>, R extends EffectRow>(
  _handled: E,
  _row: R
): Exclude<R, E> {
  return undefined as Exclude<R, E>;
}

// ============================================================================
// EFFECT CONSTRAINT SOLVER
// ============================================================================

/**
 * An effect constraint.
 */
export type EffectConstraint =
  | { type: 'has'; effect: string; row: string }
  | { type: 'lacks'; effect: string; row: string }
  | { type: 'subset'; row1: string; row2: string }
  | { type: 'equal'; row1: string; row2: string };

/**
 * Constraint solver result.
 */
export interface SolverResult {
  success: boolean;
  solution: Map<string, Set<string>>; // row variable -> concrete effects
  errors: ConstraintError[];
}

export interface ConstraintError {
  constraint: EffectConstraint;
  message: string;
}

/**
 * Solve a set of effect constraints.
 */
export function solveConstraints(
  constraints: EffectConstraint[]
): SolverResult {
  const solution = new Map<string, Set<string>>();
  const errors: ConstraintError[] = [];
  
  // Initialize row variables
  for (const c of constraints) {
    if (c.type === 'has' || c.type === 'lacks') {
      if (!solution.has(c.row)) {
        solution.set(c.row, new Set());
      }
    } else {
      if (!solution.has(c.row1)) solution.set(c.row1, new Set());
      if (!solution.has(c.row2)) solution.set(c.row2, new Set());
    }
  }
  
  // Fixed-point iteration
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    for (const c of constraints) {
      switch (c.type) {
        case 'has': {
          const row = solution.get(c.row)!;
          if (!row.has(c.effect)) {
            row.add(c.effect);
            changed = true;
          }
          break;
        }
        
        case 'lacks': {
          const row = solution.get(c.row)!;
          if (row.has(c.effect)) {
            errors.push({
              constraint: c,
              message: `Row ${c.row} should lack effect ${c.effect} but has it`,
            });
          }
          break;
        }
        
        case 'subset': {
          const row1 = solution.get(c.row1)!;
          const row2 = solution.get(c.row2)!;
          for (const e of row1) {
            if (!row2.has(e)) {
              row2.add(e);
              changed = true;
            }
          }
          break;
        }
        
        case 'equal': {
          const row1 = solution.get(c.row1)!;
          const row2 = solution.get(c.row2)!;
          for (const e of row1) {
            if (!row2.has(e)) {
              row2.add(e);
              changed = true;
            }
          }
          for (const e of row2) {
            if (!row1.has(e)) {
              row1.add(e);
              changed = true;
            }
          }
          break;
        }
      }
    }
  }
  
  return {
    success: errors.length === 0,
    solution,
    errors,
  };
}

// ============================================================================
// EFFECT SUBTYPING
// ============================================================================

/**
 * Check if effect row E1 is a subtype of E2 (fewer effects).
 */
export function isSubtype(
  e1: Set<string>,
  e2: Set<string>
): boolean {
  for (const e of e1) {
    if (!e2.has(e)) {
      return false;
    }
  }
  return true;
}

/**
 * Compute the union of two effect rows.
 */
export function unionRows(
  e1: Set<string>,
  e2: Set<string>
): Set<string> {
  return new Set([...e1, ...e2]);
}

/**
 * Compute the difference of two effect rows.
 */
export function differenceRows(
  e1: Set<string>,
  e2: Set<string>
): Set<string> {
  const result = new Set<string>();
  for (const e of e1) {
    if (!e2.has(e)) {
      result.add(e);
    }
  }
  return result;
}

// ============================================================================
// EFFECT ANNOTATIONS
// ============================================================================

/**
 * Annotate a function with its effect signature.
 */
export function effectful<E extends EffectRow>() {
  return function <Args extends unknown[], R>(
    target: (...args: Args) => Eff<E, R>,
    _context: ClassMethodDecoratorContext | undefined
  ): (...args: Args) => Eff<E, R> {
    return target;
  };
}

/**
 * Mark a function as pure (no effects).
 */
export function pureFunction() {
  return function <Args extends unknown[], R>(
    target: (...args: Args) => R,
    _context: ClassMethodDecoratorContext | undefined
  ): (...args: Args) => R {
    return target;
  };
}

// ============================================================================
// EFFECT DOCUMENTATION
// ============================================================================

/**
 * Generate documentation for effects.
 */
export function documentEffect(effect: EffectSignature<any>): string {
  const lines: string[] = [];
  lines.push(`# Effect: ${effect.name}`);
  lines.push('');
  lines.push('## Operations');
  
  for (const [name, op] of Object.entries(effect.operations)) {
    lines.push(`### ${name}`);
    lines.push(`- Resumable: ${(op as any).resumable}`);
  }
  
  if (effect.laws && effect.laws.length > 0) {
    lines.push('');
    lines.push('## Laws');
    for (const law of effect.laws) {
      lines.push(`### ${law.name}`);
      lines.push(law.description);
    }
  }
  
  return lines.join('\n');
}
