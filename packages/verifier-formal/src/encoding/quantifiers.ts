// ============================================================================
// Quantifier Encoding for SMT-LIB
// Handles universal and existential quantification
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import { encodeExpression, EncodingContext } from './expressions';
import { typeDefToSmt } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface QuantifierBinding {
  name: string;
  sort: string;
  constraint?: string;
}

// ============================================================================
// QUANTIFIER ENCODING
// ============================================================================

/**
 * Encode a universal quantifier
 * ∀ x ∈ Collection. P(x) → (forall ((x Sort)) (=> (in-collection x) P))
 */
export function encodeUniversal(
  bindings: QuantifierBinding[],
  body: AST.Expression,
  ctx: EncodingContext
): string {
  const bindingStr = bindings
    .map(b => `(${b.name} ${b.sort})`)
    .join(' ');
  
  const constraints = bindings
    .filter(b => b.constraint)
    .map(b => b.constraint!);
  
  const encodedBody = encodeExpression(body, {
    ...ctx,
    quantifierVars: new Map(bindings.map(b => [b.name, b.name])),
  });
  
  if (constraints.length > 0) {
    const premise = constraints.length === 1 
      ? constraints[0] 
      : `(and ${constraints.join(' ')})`;
    return `(forall (${bindingStr}) (=> ${premise} ${encodedBody}))`;
  }
  
  return `(forall (${bindingStr}) ${encodedBody})`;
}

/**
 * Encode an existential quantifier
 * ∃ x ∈ Collection. P(x) → (exists ((x Sort)) (and (in-collection x) P))
 */
export function encodeExistential(
  bindings: QuantifierBinding[],
  body: AST.Expression,
  ctx: EncodingContext
): string {
  const bindingStr = bindings
    .map(b => `(${b.name} ${b.sort})`)
    .join(' ');
  
  const constraints = bindings
    .filter(b => b.constraint)
    .map(b => b.constraint!);
  
  const encodedBody = encodeExpression(body, {
    ...ctx,
    quantifierVars: new Map(bindings.map(b => [b.name, b.name])),
  });
  
  if (constraints.length > 0) {
    return `(exists (${bindingStr}) (and ${constraints.join(' ')} ${encodedBody}))`;
  }
  
  return `(exists (${bindingStr}) ${encodedBody})`;
}

/**
 * Encode a bounded quantifier over a list
 * all(list, x => P(x)) → (forall ((i Int)) (=> (and (>= i 0) (< i (len list))) P(list[i])))
 */
export function encodeBoundedQuantifier(
  quantifier: 'all' | 'any' | 'none',
  collection: string,
  varName: string,
  predicate: AST.Expression,
  ctx: EncodingContext
): string {
  const indexVar = `idx-${varName}`;
  const elementAccess = `(select ${collection} ${indexVar})`;
  
  const newCtx: EncodingContext = {
    ...ctx,
    quantifierVars: new Map(ctx.quantifierVars),
  };
  newCtx.quantifierVars!.set(varName, elementAccess);
  
  const encodedPred = encodeExpression(predicate, newCtx);
  const bounds = `(and (>= ${indexVar} 0) (< ${indexVar} (len ${collection})))`;
  
  switch (quantifier) {
    case 'all':
      return `(forall ((${indexVar} Int)) (=> ${bounds} ${encodedPred}))`;
    case 'any':
      return `(exists ((${indexVar} Int)) (and ${bounds} ${encodedPred}))`;
    case 'none':
      return `(not (exists ((${indexVar} Int)) (and ${bounds} ${encodedPred})))`;
  }
}

/**
 * Encode entity quantification
 * all(Entity, e => P(e)) → (forall ((e Entity)) (=> (entity-exists e) P(e)))
 */
export function encodeEntityQuantifier(
  quantifier: 'all' | 'any' | 'none',
  entityName: string,
  varName: string,
  predicate: AST.Expression,
  ctx: EncodingContext
): string {
  const existsPred = `(${entityName.toLowerCase()}-exists ${varName})`;
  
  const newCtx: EncodingContext = {
    ...ctx,
    entityVar: varName,
    entityName: entityName,
    quantifierVars: new Map(ctx.quantifierVars),
  };
  newCtx.quantifierVars!.set(varName, varName);
  
  const encodedPred = encodeExpression(predicate, newCtx);
  
  switch (quantifier) {
    case 'all':
      return `(forall ((${varName} ${entityName})) (=> ${existsPred} ${encodedPred}))`;
    case 'any':
      return `(exists ((${varName} ${entityName})) (and ${existsPred} ${encodedPred}))`;
    case 'none':
      return `(not (exists ((${varName} ${entityName})) (and ${existsPred} ${encodedPred})))`;
  }
}

// ============================================================================
// AGGREGATION ENCODING
// ============================================================================

/**
 * Encode count aggregation
 * count(Collection, x => P(x)) - Count elements satisfying predicate
 */
export function encodeCount(
  collection: string,
  varName: string,
  predicate: AST.Expression | null,
  ctx: EncodingContext
): string {
  if (!predicate) {
    return `(len ${collection})`;
  }
  
  // For counting with predicate, we need to use a recursive definition
  // This is a simplified version using an uninterpreted function
  const indexVar = `idx-${varName}`;
  const elementAccess = `(select ${collection} ${indexVar})`;
  
  const newCtx: EncodingContext = {
    ...ctx,
    quantifierVars: new Map(ctx.quantifierVars),
  };
  newCtx.quantifierVars!.set(varName, elementAccess);
  
  const encodedPred = encodeExpression(predicate, newCtx);
  
  return `(count-if ${collection} (lambda ((${varName} Int)) ${encodedPred}))`;
}

/**
 * Encode sum aggregation
 * sum(Collection, x => f(x)) - Sum of f(x) for all x
 */
export function encodeSum(
  collection: string,
  varName: string,
  selector: AST.Expression,
  ctx: EncodingContext
): string {
  const indexVar = `idx-${varName}`;
  const elementAccess = `(select ${collection} ${indexVar})`;
  
  const newCtx: EncodingContext = {
    ...ctx,
    quantifierVars: new Map(ctx.quantifierVars),
  };
  newCtx.quantifierVars!.set(varName, elementAccess);
  
  const encodedSelector = encodeExpression(selector, newCtx);
  
  return `(sum-map ${collection} (lambda ((${varName} Int)) ${encodedSelector}))`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate SMT-LIB declarations for aggregation functions
 */
export function generateAggregationDeclarations(): string {
  return `
; Aggregation function declarations
(declare-fun len ((Array Int Int)) Int)
(declare-fun count-if ((Array Int Int) (Int) Bool) Int)
(declare-fun sum-map ((Array Int Int) (Int) Int) Int)

; Axioms for len
(assert (forall ((arr (Array Int Int)))
  (>= (len arr) 0)))

; Axioms for count-if
(assert (forall ((arr (Array Int Int)) (p (Int) Bool))
  (and (>= (count-if arr p) 0) (<= (count-if arr p) (len arr)))))
`;
}

/**
 * Create a quantifier binding from an ISL quantifier expression
 */
export function createBindingFromQuantifier(
  expr: AST.QuantifierExpr,
  ctx: EncodingContext
): QuantifierBinding {
  const varName = expr.variable.name;
  
  // Determine sort from collection
  // This is simplified - real implementation would need type inference
  let sort = 'Int';
  let constraint: string | undefined;
  
  if (expr.collection.kind === 'Identifier') {
    // Might be an entity name
    const name = expr.collection.name;
    if (name.charAt(0) === name.charAt(0).toUpperCase()) {
      sort = name;
      constraint = `(${name.toLowerCase()}-exists ${varName})`;
    }
  }
  
  return { name: varName, sort, constraint };
}

// ============================================================================
// QUANTIFIER PATTERN GENERATION
// ============================================================================

/**
 * Generate patterns for quantifier instantiation (E-matching)
 * Helps Z3 find relevant instantiations
 */
export function generateQuantifierPattern(
  bindings: QuantifierBinding[],
  body: string
): string {
  // Extract function applications from body for patterns
  const patterns: string[] = [];
  
  for (const binding of bindings) {
    // Simple pattern: any function applied to the variable
    const varPattern = new RegExp(`\\(\\w+-\\w+ ${binding.name}\\)`, 'g');
    const matches = body.match(varPattern);
    if (matches) {
      patterns.push(...matches.slice(0, 2)); // Limit patterns
    }
  }
  
  if (patterns.length > 0) {
    return `:pattern (${patterns.join(' ')})`;
  }
  
  return '';
}

/**
 * Generate skolem functions for existential quantifiers
 * (exists ((x T)) P) becomes (P[x/skolem_x]) where skolem_x is a fresh constant
 */
export function skolemize(
  bindings: QuantifierBinding[],
  body: AST.Expression,
  ctx: EncodingContext,
  prefix: string
): { declarations: string; body: string } {
  const declarations: string[] = [];
  const substitutions = new Map<string, string>();
  
  for (const binding of bindings) {
    const skolemName = `${prefix}-skolem-${binding.name}`;
    declarations.push(`(declare-const ${skolemName} ${binding.sort})`);
    
    if (binding.constraint) {
      declarations.push(`(assert ${binding.constraint.replace(binding.name, skolemName)})`);
    }
    
    substitutions.set(binding.name, skolemName);
  }
  
  const newCtx: EncodingContext = {
    ...ctx,
    quantifierVars: new Map([...(ctx.quantifierVars ?? []), ...substitutions]),
  };
  
  return {
    declarations: declarations.join('\n'),
    body: encodeExpression(body, newCtx),
  };
}
