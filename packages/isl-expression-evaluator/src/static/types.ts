// ============================================================================
// ISL Static Analyzer - Type Definitions
// ============================================================================
// Types for the static analysis layer that proves/disproves ISL conditions
// WITHOUT executing code, using type-constraint propagation.
// ============================================================================

import type { Expression } from '@isl-lang/parser';

// ============================================================================
// TYPE CONSTRAINT SYSTEM
// ============================================================================

/**
 * Base type categories that ISL supports.
 * Used to identify the fundamental kind of a value for static analysis.
 */
export type BaseType =
  | 'string'
  | 'number'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null'
  | 'void'
  | 'unknown';

/**
 * Constraint information derived from ISL type declarations.
 *
 * Example ISL types and their constraint mappings:
 *   type Email = String { min_length: 1 }         → { baseType: 'string', constraints: { minLength: 1 } }
 *   type Age = Integer { min: 0, max: 150 }       → { baseType: 'integer', constraints: { min: 0, max: 150 } }
 *   type Status = String { enum: ["active","ban"] } → { baseType: 'string', constraints: { enumValues: ["active","ban"] } }
 */
export interface TypeConstraintInfo {
  /** The fundamental type category */
  baseType: BaseType;
  /** Refinement constraints on the type */
  constraints?: TypeConstraints;
}

/**
 * Refinement constraints that narrow a type's value space.
 * These constraints come from ISL type declarations and entity field definitions.
 */
export interface TypeConstraints {
  /** Minimum numeric value (inclusive) - for number/integer/float */
  min?: number;
  /** Maximum numeric value (inclusive) - for number/integer/float */
  max?: number;
  /** Minimum length (inclusive) - for string/array */
  minLength?: number;
  /** Maximum length (inclusive) - for string/array */
  maxLength?: number;
  /** Regex pattern the value must match - for string */
  pattern?: string;
  /** Whether the field/value can be null */
  nullable?: boolean;
  /** Enumerated allowed values */
  enumValues?: unknown[];
  /** Format constraint (email, uuid, url, etc.) - for string */
  format?: string;
  /** Element type - for arrays */
  elementType?: TypeConstraintInfo;
}

// ============================================================================
// ENTITY & FIELD DEFINITIONS
// ============================================================================

/**
 * Information about an entity field, as declared in ISL.
 */
export interface FieldInfo {
  /** Field name */
  name: string;
  /** Type constraint for this field */
  type: TypeConstraintInfo;
  /** Whether the field is required (must be present) */
  required: boolean;
}

/**
 * Information about an ISL entity declaration.
 * Entities define structured data types with required/optional fields.
 */
export interface EntityInfo {
  /** Entity name (e.g., "User", "Account") */
  name: string;
  /** Map of field name to field info */
  fields: Map<string, FieldInfo>;
}

// ============================================================================
// TYPE CONTEXT (from typechecker's symbol table)
// ============================================================================

/**
 * Type context for static analysis.
 * This is populated from the typechecker's symbol table and ISL declarations.
 * It provides the type information needed to prove/disprove conditions statically.
 */
export interface TypeContext {
  /**
   * Type alias definitions from ISL type declarations.
   * Maps type name to its constraint info.
   * Example: "Email" → { baseType: 'string', constraints: { minLength: 1, format: 'email' } }
   */
  types: Map<string, TypeConstraintInfo>;

  /**
   * Entity definitions from ISL entity declarations.
   * Maps entity name to its field definitions.
   * Example: "User" → { fields: { email: { type: Email, required: true }, ... } }
   */
  entities: Map<string, EntityInfo>;

  /**
   * Known variable bindings at analysis time.
   * Maps variable name to its type constraint info.
   * Example: "user" → entity type info, "count" → { baseType: 'integer', constraints: { min: 0 } }
   */
  bindings: Map<string, TypeConstraintInfo>;

  /**
   * Result type info for postcondition analysis.
   * Describes the return type of the behavior being checked.
   */
  resultType?: TypeConstraintInfo;

  /**
   * Result entity info for postcondition analysis.
   * When the result is a structured entity, this provides field-level info.
   */
  resultEntity?: EntityInfo;

  /**
   * Input parameter types for the behavior being checked.
   * Maps input parameter name to its type constraint info.
   */
  inputTypes?: Map<string, TypeConstraintInfo>;
}

// ============================================================================
// STATIC ANALYSIS RESULT (handoff interface for the gate)
// ============================================================================

/**
 * Verdict from static analysis.
 * - 'true': Provably satisfied from type constraints alone
 * - 'false': Provably violated (type mismatch, impossible condition)
 * - 'unknown': Cannot determine statically, needs runtime evaluation
 */
export type StaticVerdict = 'true' | 'false' | 'unknown';

/**
 * Result of static analysis on a single expression.
 * This is the handoff interface consumed by the gate.
 */
export interface StaticAnalysisResult {
  /** The source expression text (for diagnostics/logging) */
  expression: string;
  /** The tri-state verdict */
  verdict: StaticVerdict;
  /** Human-readable explanation of why this verdict was reached */
  reason: string;
  /**
   * Confidence level (0-1).
   * - 1.0: Absolute certainty (e.g., literal comparison, type system guarantee)
   * - 0.9: High confidence (e.g., type constraint implication)
   * - 0.5: Moderate (e.g., pattern-based heuristic)
   * - 0.0: No confidence (unknown, runtime-dependent)
   */
  confidence: number;
  /** The category of analysis that produced this result */
  category?: AnalysisCategory;
}

/**
 * Categories of static analysis that can produce verdicts.
 * Useful for diagnostics and understanding which analysis path was taken.
 */
export type AnalysisCategory =
  | 'literal'              // Direct literal evaluation
  | 'type-constraint'      // Type constraint propagation
  | 'type-mismatch'        // Incompatible type comparison
  | 'tautology'            // Always-true pattern (e.g., x == x)
  | 'contradiction'        // Always-false pattern (e.g., x != x)
  | 'field-existence'      // Required field existence check
  | 'range-analysis'       // Numeric range comparison
  | 'enum-analysis'        // Enum membership check
  | 'logical-simplification' // Boolean logic simplification
  | 'runtime-dependent'    // Needs runtime data
  | 'unsupported';         // Expression type not yet handled

// ============================================================================
// HELPER: Create empty TypeContext
// ============================================================================

/**
 * Create an empty TypeContext with no type information.
 * Useful for tests and as a starting point before populating.
 */
export function createTypeContext(partial?: Partial<TypeContext>): TypeContext {
  return {
    types: partial?.types ?? new Map(),
    entities: partial?.entities ?? new Map(),
    bindings: partial?.bindings ?? new Map(),
    resultType: partial?.resultType,
    resultEntity: partial?.resultEntity,
    inputTypes: partial?.inputTypes,
  };
}

/**
 * Create a TypeConstraintInfo from base type and optional constraints.
 */
export function typeInfo(baseType: BaseType, constraints?: TypeConstraints): TypeConstraintInfo {
  return constraints ? { baseType, constraints } : { baseType };
}

/**
 * Create a FieldInfo for entity field definitions.
 */
export function fieldInfo(name: string, type: TypeConstraintInfo, required = true): FieldInfo {
  return { name, type, required };
}

/**
 * Create an EntityInfo from a name and field definitions.
 */
export function entityInfo(name: string, fields: FieldInfo[]): EntityInfo {
  const fieldMap = new Map<string, FieldInfo>();
  for (const f of fields) {
    fieldMap.set(f.name, f);
  }
  return { name, fields: fieldMap };
}
