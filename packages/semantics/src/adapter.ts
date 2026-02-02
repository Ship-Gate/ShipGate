// ============================================================================
// Semantics Adapter API
// 
// This module provides integration adapters for evaluator/compiler packages.
// Other packages should use these adapters rather than implementing their own
// semantic evaluation to ensure consistent behavior across versions.
// ============================================================================

import type {
  Value,
  BinaryOperator,
  UnaryOperator,
  Quantifier,
  TemporalOperator,
  VersionedSemantics,
  TemporalOperatorSemantics,
} from './types.js';
import { getSemantics } from './registry.js';

// ============================================================================
// EVALUATOR ADAPTER
// ============================================================================

/**
 * Options for creating an evaluator adapter
 */
export interface EvaluatorAdapterOptions {
  /** ISL version string (e.g., "1.0.0") */
  version?: string;
  /** Whether to throw on unknown operators (default: true) */
  strict?: boolean;
}

/**
 * Adapter for expression evaluators to use versioned semantics
 * 
 * @example
 * ```typescript
 * import { createEvaluatorAdapter } from '@isl-lang/semantics/adapter';
 * 
 * const adapter = createEvaluatorAdapter({ version: '1.0.0' });
 * 
 * // In your evaluator:
 * const result = adapter.evaluateBinary('==', left, right);
 * ```
 */
export interface EvaluatorAdapter {
  /** The semantics version being used */
  readonly version: string;
  
  /** Evaluate a binary expression */
  evaluateBinary(op: BinaryOperator, left: Value, right: Value): Value;
  
  /** Evaluate a unary expression */
  evaluateUnary(op: UnaryOperator, operand: Value): Value;
  
  /** Evaluate a quantifier expression */
  evaluateQuantifier(
    q: Quantifier,
    collection: Value[],
    predicate: (item: Value) => Value
  ): Value;
  
  /** Check if binary operator uses short-circuit evaluation */
  isShortCircuit(op: BinaryOperator): boolean;
  
  /** Get operator precedence */
  getPrecedence(op: BinaryOperator | UnaryOperator): number;
  
  /** Get the underlying semantics */
  getSemantics(): VersionedSemantics;
}

/**
 * Create an evaluator adapter for a specific version
 */
export function createEvaluatorAdapter(options: EvaluatorAdapterOptions = {}): EvaluatorAdapter {
  const version = options.version ?? '1.0.0';
  const strict = options.strict ?? true;
  
  const semantics = getSemantics(version);
  if (!semantics) {
    throw new Error(`Unsupported semantics version: ${version}`);
  }

  return {
    version: semantics.versionString,

    evaluateBinary(op: BinaryOperator, left: Value, right: Value): Value {
      const opSemantics = semantics.getBinaryOperator(op);
      if (!opSemantics) {
        if (strict) {
          throw new Error(`Unknown binary operator: ${op}`);
        }
        return undefined;
      }
      return opSemantics.evaluate(left, right);
    },

    evaluateUnary(op: UnaryOperator, operand: Value): Value {
      const opSemantics = semantics.getUnaryOperator(op);
      if (!opSemantics) {
        if (strict) {
          throw new Error(`Unknown unary operator: ${op}`);
        }
        return undefined;
      }
      return opSemantics.evaluate(operand);
    },

    evaluateQuantifier(
      q: Quantifier,
      collection: Value[],
      predicate: (item: Value) => Value
    ): Value {
      const qSemantics = semantics.getQuantifier(q);
      if (!qSemantics) {
        if (strict) {
          throw new Error(`Unknown quantifier: ${q}`);
        }
        return undefined;
      }
      return qSemantics.evaluate(collection, predicate);
    },

    isShortCircuit(op: BinaryOperator): boolean {
      const opSemantics = semantics.getBinaryOperator(op);
      return opSemantics?.shortCircuit ?? false;
    },

    getPrecedence(op: BinaryOperator | UnaryOperator): number {
      const binOp = semantics.getBinaryOperator(op as BinaryOperator);
      if (binOp) return binOp.precedence;
      
      const unOp = semantics.getUnaryOperator(op as UnaryOperator);
      if (unOp) return unOp.precedence;
      
      return 0;
    },

    getSemantics(): VersionedSemantics {
      return semantics;
    },
  };
}

// ============================================================================
// COMPILER ADAPTER
// ============================================================================

/**
 * Options for creating a compiler adapter
 */
export interface CompilerAdapterOptions {
  /** ISL version string */
  version?: string;
  /** Target language for code generation hints */
  targetLanguage?: 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
}

/**
 * Information about an operator for code generation
 */
export interface OperatorInfo {
  /** The operator symbol */
  operator: string;
  /** Operator precedence for parenthesization */
  precedence: number;
  /** Whether it's associative */
  associative: boolean;
  /** Whether it's commutative */
  commutative: boolean;
  /** Whether short-circuit evaluation is needed */
  shortCircuit: boolean;
  /** Expected result type */
  resultType: string;
  /** Description for documentation */
  description: string;
}

/**
 * Adapter for compilers to understand operator semantics
 */
export interface CompilerAdapter {
  /** The semantics version being used */
  readonly version: string;
  
  /** Get information about a binary operator */
  getBinaryOperatorInfo(op: BinaryOperator): OperatorInfo | undefined;
  
  /** Get information about a unary operator */
  getUnaryOperatorInfo(op: UnaryOperator): OperatorInfo | undefined;
  
  /** Get information about a quantifier */
  getQuantifierInfo(q: Quantifier): {
    quantifier: string;
    resultType: string;
    shortCircuit: boolean;
    description: string;
  } | undefined;
  
  /** Get information about a temporal operator */
  getTemporalOperatorInfo(op: TemporalOperator): TemporalOperatorSemantics | undefined;
  
  /** Get all binary operators */
  getAllBinaryOperators(): BinaryOperator[];
  
  /** Get all unary operators */
  getAllUnaryOperators(): UnaryOperator[];
  
  /** Get all quantifiers */
  getAllQuantifiers(): Quantifier[];
  
  /** Get all temporal operators */
  getAllTemporalOperators(): TemporalOperator[];
}

/**
 * Create a compiler adapter for a specific version
 */
export function createCompilerAdapter(options: CompilerAdapterOptions = {}): CompilerAdapter {
  const version = options.version ?? '1.0.0';
  
  const semantics = getSemantics(version);
  if (!semantics) {
    throw new Error(`Unsupported semantics version: ${version}`);
  }

  return {
    version: semantics.versionString,

    getBinaryOperatorInfo(op: BinaryOperator): OperatorInfo | undefined {
      const opSemantics = semantics.getBinaryOperator(op);
      if (!opSemantics) return undefined;
      
      return {
        operator: opSemantics.operator,
        precedence: opSemantics.precedence,
        associative: opSemantics.associative,
        commutative: opSemantics.commutative,
        shortCircuit: opSemantics.shortCircuit,
        resultType: opSemantics.resultType,
        description: opSemantics.description,
      };
    },

    getUnaryOperatorInfo(op: UnaryOperator): OperatorInfo | undefined {
      const opSemantics = semantics.getUnaryOperator(op);
      if (!opSemantics) return undefined;
      
      return {
        operator: opSemantics.operator,
        precedence: opSemantics.precedence,
        associative: false,
        commutative: false,
        shortCircuit: false,
        resultType: opSemantics.resultType,
        description: opSemantics.description,
      };
    },

    getQuantifierInfo(q: Quantifier) {
      const qSemantics = semantics.getQuantifier(q);
      if (!qSemantics) return undefined;
      
      return {
        quantifier: qSemantics.quantifier,
        resultType: qSemantics.resultType,
        shortCircuit: qSemantics.shortCircuit,
        description: qSemantics.description,
      };
    },

    getTemporalOperatorInfo(op: TemporalOperator): TemporalOperatorSemantics | undefined {
      return semantics.getTemporalOperator(op);
    },

    getAllBinaryOperators(): BinaryOperator[] {
      return Array.from(semantics.binaryOperators.keys());
    },

    getAllUnaryOperators(): UnaryOperator[] {
      return Array.from(semantics.unaryOperators.keys());
    },

    getAllQuantifiers(): Quantifier[] {
      return Array.from(semantics.quantifiers.keys());
    },

    getAllTemporalOperators(): TemporalOperator[] {
      return Array.from(semantics.temporalOperators.keys());
    },
  };
}

// ============================================================================
// TYPE CHECKING ADAPTER
// ============================================================================

/**
 * Adapter for type checkers to validate expressions
 */
export interface TypeCheckAdapter {
  /** The semantics version being used */
  readonly version: string;
  
  /** Check if operand types are valid for a binary operator */
  checkBinaryOperandTypes(
    op: BinaryOperator,
    leftType: string,
    rightType: string
  ): { valid: boolean; error?: string };
  
  /** Check if operand type is valid for a unary operator */
  checkUnaryOperandType(
    op: UnaryOperator,
    operandType: string
  ): { valid: boolean; error?: string };
  
  /** Get the result type of a binary operator */
  getBinaryResultType(op: BinaryOperator): string | undefined;
  
  /** Get the result type of a unary operator */
  getUnaryResultType(op: UnaryOperator): string | undefined;
  
  /** Get the result type of a quantifier */
  getQuantifierResultType(q: Quantifier): string | undefined;
}

/**
 * Create a type checking adapter for a specific version
 */
export function createTypeCheckAdapter(version: string = '1.0.0'): TypeCheckAdapter {
  const semantics = getSemantics(version);
  if (!semantics) {
    throw new Error(`Unsupported semantics version: ${version}`);
  }

  const typeMatches = (actual: string, expected: readonly string[]): boolean => {
    if (expected.includes('any')) return true;
    return expected.includes(actual);
  };

  return {
    version: semantics.versionString,

    checkBinaryOperandTypes(
      op: BinaryOperator,
      leftType: string,
      rightType: string
    ): { valid: boolean; error?: string } {
      const opSemantics = semantics.getBinaryOperator(op);
      if (!opSemantics) {
        return { valid: false, error: `Unknown binary operator: ${op}` };
      }

      // For now, simplified type checking
      // A full implementation would check each constraint
      const constraints = opSemantics.operandTypes;
      for (const constraint of constraints) {
        if (typeMatches(leftType, constraint.types) && 
            typeMatches(rightType, constraint.types)) {
          return { valid: true };
        }
      }

      return {
        valid: false,
        error: `Operator '${op}' does not accept operands of types ${leftType} and ${rightType}`,
      };
    },

    checkUnaryOperandType(
      op: UnaryOperator,
      operandType: string
    ): { valid: boolean; error?: string } {
      const opSemantics = semantics.getUnaryOperator(op);
      if (!opSemantics) {
        return { valid: false, error: `Unknown unary operator: ${op}` };
      }

      const constraints = opSemantics.operandTypes;
      for (const constraint of constraints) {
        if (typeMatches(operandType, constraint.types)) {
          return { valid: true };
        }
      }

      return {
        valid: false,
        error: `Operator '${op}' does not accept operand of type ${operandType}`,
      };
    },

    getBinaryResultType(op: BinaryOperator): string | undefined {
      return semantics.getBinaryOperator(op)?.resultType;
    },

    getUnaryResultType(op: UnaryOperator): string | undefined {
      return semantics.getUnaryOperator(op)?.resultType;
    },

    getQuantifierResultType(q: Quantifier): string | undefined {
      return semantics.getQuantifier(q)?.resultType;
    },
  };
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Default evaluator adapter using v1 semantics
 */
export const defaultEvaluatorAdapter = createEvaluatorAdapter();

/**
 * Default compiler adapter using v1 semantics
 */
export const defaultCompilerAdapter = createCompilerAdapter();

/**
 * Default type check adapter using v1 semantics
 */
export const defaultTypeCheckAdapter = createTypeCheckAdapter();
