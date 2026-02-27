// ============================================================================
// ISL Effect System - ISL Syntax Extensions
// Effect annotations and syntax for ISL
// ============================================================================

import type { AlgebraicEffect, EffectSet } from './types.js';

/**
 * ISL syntax for effect declarations
 * 
 * Example ISL:
 * ```isl
 * effect Database {
 *   query<T>(sql: String): T with IO, Async
 *   execute(sql: String): Int with IO, Async
 *   transaction<T>(fn: () -> T): T with IO
 * }
 * ```
 */
export interface ISLEffectDeclaration {
  kind: 'EffectDeclaration';
  name: string;
  operations: ISLEffectOperation[];
  description?: string;
}

export interface ISLEffectOperation {
  kind: 'EffectOperation';
  name: string;
  typeParams?: string[];
  params: ISLEffectParam[];
  returnType: string;
  effects?: string[];  // Other effects this operation uses
}

export interface ISLEffectParam {
  name: string;
  type: string;
  optional?: boolean;
}

/**
 * ISL syntax for effect-annotated functions
 * 
 * Example ISL:
 * ```isl
 * behavior CreateUser with IO, Database {
 *   input { ... }
 *   output { ... }
 * }
 * 
 * // Pure function (no effects)
 * pure function add(a: Int, b: Int): Int
 * 
 * // Effectful function with explicit effects
 * function fetchUser(id: UUID): User with Async, Database
 * ```
 */
export interface ISLEffectAnnotation {
  kind: 'EffectAnnotation';
  effects: string[];
  pure?: boolean;
}

/**
 * Parse ISL effect declaration
 */
export function parseEffectDeclaration(source: string): ISLEffectDeclaration | null {
  const effectMatch = source.match(/effect\s+(\w+)\s*\{([\s\S]*?)\}/);
  if (!effectMatch) return null;

  const name = effectMatch[1]!;
  const body = effectMatch[2]!;
  const operations = parseEffectOperations(body);

  return {
    kind: 'EffectDeclaration',
    name,
    operations,
  };
}

/**
 * Parse effect operations
 */
function parseEffectOperations(body: string): ISLEffectOperation[] {
  const operations: ISLEffectOperation[] = [];
  const opRegex = /(\w+)(?:<([^>]+)>)?\s*\(([^)]*)\)\s*:\s*(\w+(?:<[^>]+>)?)\s*(?:with\s+([^;\n]+))?/g;

  let match;
  while ((match = opRegex.exec(body)) !== null) {
    const [, name, typeParamsStr, paramsStr, returnType, effectsStr] = match;

    operations.push({
      kind: 'EffectOperation',
      name: name!,
      typeParams: typeParamsStr?.split(',').map(s => s.trim()),
      params: parseParams(paramsStr ?? ''),
      returnType: returnType!,
      effects: effectsStr?.split(',').map(s => s.trim()),
    });
  }

  return operations;
}

/**
 * Parse parameters
 */
function parseParams(paramsStr: string): ISLEffectParam[] {
  if (!paramsStr.trim()) return [];

  return paramsStr.split(',').map(p => {
    const match = p.trim().match(/(\w+)\s*:\s*(.+)/);
    if (!match) return { name: '', type: 'Any' };
    return {
      name: match[1]!,
      type: match[2]!.trim(),
    };
  });
}

/**
 * Parse effect annotation from function signature
 */
export function parseEffectAnnotation(signature: string): ISLEffectAnnotation | null {
  // Pure function
  if (signature.startsWith('pure ')) {
    return { kind: 'EffectAnnotation', effects: [], pure: true };
  }

  // Effectful function
  const withMatch = signature.match(/with\s+(.+)$/);
  if (withMatch) {
    const effects = withMatch[1]!.split(',').map(s => s.trim());
    return { kind: 'EffectAnnotation', effects, pure: false };
  }

  return null;
}

/**
 * Generate ISL syntax from Effect definition
 */
export function generateISLSyntax(effect: AlgebraicEffect): string {
  const lines: string[] = [];

  if (effect.description) {
    lines.push(`// ${effect.description}`);
  }

  lines.push(`effect ${effect.name} {`);

  for (const op of effect.operations) {
    const params = op.parameters
      .map(p => `${p.name}: ${formatType(p.type)}${p.optional ? '?' : ''}`)
      .join(', ');
    const returnStr = formatType(op.returnType);
    const opLine = `  ${op.name}(${params}): ${returnStr}`;
    lines.push(opLine);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Format effect type for ISL
 */
function formatType(type: { kind: string; name?: string; params?: unknown[] }): string {
  switch (type.kind) {
    case 'Primitive':
      return type.name ?? 'Unknown';
    case 'Generic':
      const params = (type.params as unknown[])?.map(p => formatType(p as typeof type)).join(', ');
      return params ? `${type.name}<${params}>` : type.name ?? 'Unknown';
    case 'Void':
      return 'Void';
    case 'Never':
      return 'Never';
    case 'Any':
      return 'Any';
    default:
      return 'Unknown';
  }
}

/**
 * Generate effect annotation for behavior
 */
export function generateBehaviorEffects(effects: EffectSet): string {
  if (effects.pure) return '';
  if (effects.effects.length === 0) return '';

  const effectNames = effects.effects.map(e => e.effect).join(', ');
  return `with ${effectNames}`;
}

/**
 * ISL handler syntax
 * 
 * Example:
 * ```isl
 * handle Database {
 *   query(sql) -> {
 *     // implementation
 *     return await db.query(sql)
 *   }
 *   execute(sql) -> {
 *     return await db.execute(sql)
 *   }
 * }
 * ```
 */
export interface ISLHandlerDeclaration {
  kind: 'HandlerDeclaration';
  effect: string;
  handlers: ISLHandlerImpl[];
}

export interface ISLHandlerImpl {
  operation: string;
  params: string[];
  body: string;
}

/**
 * Parse handler declaration
 */
export function parseHandlerDeclaration(source: string): ISLHandlerDeclaration | null {
  const match = source.match(/handle\s+(\w+)\s*\{([\s\S]*?)\}/);
  if (!match) return null;

  const effect = match[1]!;
  const body = match[2]!;
  const handlers = parseHandlerImpls(body);

  return {
    kind: 'HandlerDeclaration',
    effect,
    handlers,
  };
}

/**
 * Parse handler implementations
 */
function parseHandlerImpls(body: string): ISLHandlerImpl[] {
  const handlers: ISLHandlerImpl[] = [];
  const handlerRegex = /(\w+)\s*\(([^)]*)\)\s*->\s*\{([\s\S]*?)\}/g;

  let match;
  while ((match = handlerRegex.exec(body)) !== null) {
    handlers.push({
      operation: match[1]!,
      params: match[2]!.split(',').map(s => s.trim()).filter(s => s),
      body: match[3]!.trim(),
    });
  }

  return handlers;
}

/**
 * ISL effect-polymorphic function
 * 
 * Example:
 * ```isl
 * function map<T, U, E>(
 *   items: List<T>,
 *   fn: (T) -> U with E
 * ): List<U> with E
 * ```
 */
export interface ISLEffectPolymorphicFn {
  kind: 'EffectPolymorphicFn';
  name: string;
  typeParams: string[];
  effectParams: string[];  // Effect type variables
  params: ISLEffectParam[];
  returnType: string;
  effects: string[];
}

/**
 * ISL scoped effects
 * 
 * Example:
 * ```isl
 * scope DatabaseScope {
 *   handle Database with PostgresHandler
 *   handle Logging with ConsoleLogger
 *   
 *   // All code in this scope has these handlers
 *   CreateUser(...)
 *   UpdateUser(...)
 * }
 * ```
 */
export interface ISLEffectScope {
  kind: 'EffectScope';
  name: string;
  handlers: { effect: string; handler: string }[];
  body: string[];
}

/**
 * Generate TypeScript types from ISL effect declaration
 */
export function generateTypeScript(decl: ISLEffectDeclaration): string {
  const lines: string[] = [];

  lines.push(`// Effect: ${decl.name}`);
  lines.push(`export interface ${decl.name}Effect {`);

  for (const op of decl.operations) {
    const typeParams = op.typeParams ? `<${op.typeParams.join(', ')}>` : '';
    const params = op.params.map(p => `${p.name}: ${p.type}`).join(', ');
    lines.push(`  ${op.name}${typeParams}(${params}): Promise<${op.returnType}>;`);
  }

  lines.push('}');

  return lines.join('\n');
}
