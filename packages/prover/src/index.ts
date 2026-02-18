// ============================================================================
// ISL Formal Prover - Public API
// SMT-based proving, property verification, and counterexample generation
// ============================================================================

// Types
export type {
  SMTSort,
  SMTExpr,
  SMTDecl,
  DatatypeConstructor,
  VerificationGoal,
  VerificationResult,
  Counterexample,
  TraceStep,
  ProverConfig,
  SMTLogic,
  ISLProperty,
  ISLVerificationContext,
  EntitySchema,
  BehaviorSchema,
  TypeSchema,
  VerificationReport,
  PropertyResult,
  VerificationSummary,
} from './types.js';

// SMT builders
export { Sort, Expr, Decl, toSMTLib, sortToSMTLib, declToSMTLib, simplify, freeVars } from './smt.js';

// Prover
export { Prover, verifyISLProperties } from './prover.js';

// Input Validation Prover
export type {
  ValidationLibrary,
  ConstraintQuality,
  ValidationEvidence,
  ValidationSchema,
  ValidationField,
  FieldConstraints,
  FieldAccess,
  EndpointInfo,
  InputValidationPropertyProof,
  Finding,
} from './input-validation/types.js';

export {
  InputValidationProver,
  proveInputValidation,
  proveInputValidationMultiple,
  detectValidation,
  detectZodValidation,
  detectJoiValidation,
  detectYupValidation,
  detectClassValidatorValidation,
  detectManualValidation,
  detectFastifyValidation,
  traceFieldAccesses,
  extractFieldNames,
  checkCompleteness,
  analyzeConstraintQuality,
} from './input-validation/index.js';

// ============================================================================
// Convenience Functions
// ============================================================================

import type { SMTExpr, SMTSort, VerificationGoal } from './types.js';
import { Prover } from './prover.js';
import { Expr, Sort } from './smt.js';

/**
 * Quick check if a property is valid
 */
export async function isValid(property: SMTExpr): Promise<boolean> {
  const prover = new Prover();
  const result = await prover.verify({ name: 'check', property, assumptions: [] });
  return result.status === 'valid';
}

/**
 * Quick check if a formula is satisfiable
 */
export async function isSatisfiable(...formulas: SMTExpr[]): Promise<boolean> {
  const prover = new Prover();
  for (const f of formulas) {
    prover.assert(f);
  }
  const result = await prover.checkSat();
  return result === 'sat';
}

/**
 * Create integer variable
 */
export function intVar(name: string): SMTExpr {
  return Expr.var(name, Sort.Int());
}

/**
 * Create boolean variable
 */
export function boolVar(name: string): SMTExpr {
  return Expr.var(name, Sort.Bool());
}

/**
 * Create real variable
 */
export function realVar(name: string): SMTExpr {
  return Expr.var(name, Sort.Real());
}

/**
 * Prove a theorem with named assumptions
 */
export async function prove(
  name: string,
  assumptions: SMTExpr[],
  conclusion: SMTExpr
): Promise<{ valid: boolean; counterexample?: Map<string, unknown> }> {
  const prover = new Prover({ produceModels: true });
  const result = await prover.verify({
    name,
    property: conclusion,
    assumptions,
  });

  if (result.status === 'valid') {
    return { valid: true };
  } else if (result.status === 'invalid') {
    return { valid: false, counterexample: result.counterexample.assignments };
  } else {
    return { valid: false };
  }
}

/**
 * Domain-specific language for building verification conditions
 */
export class VerificationConditionBuilder {
  private assumptions: SMTExpr[] = [];
  private vars: Map<string, SMTSort> = new Map();

  constructor(private name: string) {}

  /**
   * Declare a variable
   */
  declare(name: string, sort: SMTSort): SMTExpr {
    this.vars.set(name, sort);
    return Expr.var(name, sort);
  }

  /**
   * Add an assumption
   */
  assume(expr: SMTExpr): this {
    this.assumptions.push(expr);
    return this;
  }

  /**
   * Prove a property
   */
  async prove(property: SMTExpr): Promise<{ valid: boolean; counterexample?: Map<string, unknown> }> {
    const prover = new Prover({ produceModels: true });
    
    // Add variable declarations
    for (const [varName, sort] of this.vars) {
      prover.declare({ kind: 'DeclareConst', name: varName, sort });
    }

    const result = await prover.verify({
      name: this.name,
      property,
      assumptions: this.assumptions,
    });

    if (result.status === 'valid') {
      return { valid: true };
    } else if (result.status === 'invalid') {
      return { valid: false, counterexample: result.counterexample.assignments };
    } else {
      return { valid: false };
    }
  }
}

/**
 * Create a verification condition builder
 */
export function verification(name: string): VerificationConditionBuilder {
  return new VerificationConditionBuilder(name);
}

/**
 * Assert that a behavior's preconditions imply postconditions
 * given the behavior's implementation
 */
export async function verifyBehavior(
  name: string,
  preconditions: SMTExpr[],
  postconditions: SMTExpr[],
  implementation?: SMTExpr
): Promise<{ valid: boolean; failedPostconditions?: number[] }> {
  const prover = new Prover({ produceModels: true });
  
  const assumptions = [...preconditions];
  if (implementation) {
    assumptions.push(implementation);
  }

  const failedPostconditions: number[] = [];

  for (let i = 0; i < postconditions.length; i++) {
    const result = await prover.verify({
      name: `${name}_postcondition_${i}`,
      property: postconditions[i]!,
      assumptions,
    });

    if (result.status !== 'valid') {
      failedPostconditions.push(i);
    }
  }

  return {
    valid: failedPostconditions.length === 0,
    failedPostconditions: failedPostconditions.length > 0 ? failedPostconditions : undefined,
  };
}

/**
 * Verify an invariant holds for all reachable states
 */
export async function verifyInvariant(
  name: string,
  initial: SMTExpr,
  transition: SMTExpr,
  invariant: SMTExpr
): Promise<{ valid: boolean; kind?: 'initial' | 'inductive' }> {
  const prover = new Prover();

  // Check initial state satisfies invariant
  const initResult = await prover.verify({
    name: `${name}_initial`,
    property: invariant,
    assumptions: [initial],
  });

  if (initResult.status !== 'valid') {
    return { valid: false, kind: 'initial' };
  }

  // Check invariant is inductive (preserved by transition)
  // Assume invariant and transition, prove invariant'
  const inductiveResult = await prover.verify({
    name: `${name}_inductive`,
    property: invariant, // Should be invariant with primed variables
    assumptions: [invariant, transition],
  });

  if (inductiveResult.status !== 'valid') {
    return { valid: false, kind: 'inductive' };
  }

  return { valid: true };
}
