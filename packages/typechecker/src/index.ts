// ============================================================================
// ISL Type Checker - Public API
// ============================================================================

export { TypeChecker, type TypeCheckResult } from './checker';
export type { SymbolTable, Scope } from './symbols';
export { SymbolTableBuilder } from './symbols';
export { TypeResolver } from './resolver';
export { ExpressionChecker, type ExpressionContext } from './expressions';
export { ImportGraphResolver, type ImportGraph, type ImportGraphNode } from './import-resolver';

// Type exports
export type {
  ResolvedType,
  PrimitiveResolvedType,
  EntityResolvedType,
  EnumResolvedType,
  StructResolvedType,
  ListResolvedType,
  MapResolvedType,
  OptionalResolvedType,
  UnionResolvedType,
  FunctionResolvedType,
  BehaviorResolvedType,
  ErrorResolvedType,
  UnknownResolvedType,
  VoidResolvedType,
  ResolvedConstraint,
  Symbol,
  SymbolKind,
  SymbolModifier,
  SourceLocation,
  ASTNode,
} from './types';

export {
  typeToString,
  typesEqual,
  isAssignableTo,
  isPrimitiveTypeName,
  createPrimitiveType,
  BOOLEAN_TYPE,
  STRING_TYPE,
  INT_TYPE,
  DECIMAL_TYPE,
  TIMESTAMP_TYPE,
  UUID_TYPE,
  DURATION_TYPE,
  UNKNOWN_TYPE,
  VOID_TYPE,
  PRIMITIVE_TYPES,
} from './types';

// Error exports
export type { Diagnostic, DiagnosticSeverity, RelatedInformation } from './errors';
export { ErrorCodes, createError, createWarning } from './errors';

// ============================================================================
// Main API Function
// ============================================================================

import { TypeChecker } from './checker';

/**
 * Type check an ISL Domain AST
 * 
 * @param domain - The parsed Domain AST node
 * @returns TypeCheckResult with success status, diagnostics, symbol table, and type map
 * 
 * @example
 * ```typescript
 * import { check } from '@isl-lang/typechecker';
 * 
 * const result = check(domainAST);
 * if (!result.success) {
 *   for (const diag of result.diagnostics) {
 *     console.error(`${diag.code}: ${diag.message} at ${diag.location.file}:${diag.location.line}`);
 *   }
 * }
 * ```
 */
export function check(domain: unknown): import('./checker').TypeCheckResult {
  const checker = new TypeChecker();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return checker.check(domain as any);
}
