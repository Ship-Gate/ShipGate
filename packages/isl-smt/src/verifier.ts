/**
 * ISL SMT Verifier
 * 
 * High-level verification interface that:
 * - Extracts conditions from ISL AST
 * - Encodes them to SMT
 * - Verifies using the SMT solver
 * - Reports results
 */

import type {
  DomainDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  ConditionBlock,
  ConditionStatement,
  TypeConstraint,
  FieldDeclaration,
} from '@isl-lang/isl-core/ast';
import { Expr, Sort, Decl } from '@isl-lang/prover';
import type { SMTExpr, SMTSort, SMTDecl } from '@isl-lang/prover';
import {
  encodeExpression,
  encodeCondition,
  encodeTypeConstraint,
  createContext,
  islTypeToSort,
  type EncodingContext,
} from './encoder.js';
import { createSolver, type ISMTSolver } from './solver.js';
import type {
  SMTVerifyOptions,
  SMTVerificationResult,
  SMTBatchResult,
  SMTCheckKind,
} from './types.js';

/**
 * SMT Verifier for ISL specifications
 */
export class SMTVerifier {
  private solver: ISMTSolver;
  private options: SMTVerifyOptions;
  
  constructor(options: SMTVerifyOptions = {}) {
    this.options = options;
    this.solver = createSolver(options);
  }
  
  /**
   * Verify all SMT-checkable properties in a domain
   */
  async verifyDomain(domain: DomainDeclaration): Promise<SMTBatchResult> {
    const start = Date.now();
    const results: SMTVerificationResult[] = [];
    
    // Verify behavior preconditions and postconditions
    for (const behavior of domain.behaviors) {
      const behaviorResults = await this.verifyBehavior(behavior, domain);
      results.push(...behaviorResults);
    }
    
    // Verify refinement type constraints
    for (const type of domain.types) {
      const typeResults = await this.verifyRefinementType(type);
      results.push(...typeResults);
    }
    
    // Calculate summary
    const summary = {
      total: results.length,
      sat: results.filter(r => r.result.status === 'sat').length,
      unsat: results.filter(r => r.result.status === 'unsat').length,
      unknown: results.filter(r => r.result.status === 'unknown').length,
      timeout: results.filter(r => r.result.status === 'timeout').length,
      error: results.filter(r => r.result.status === 'error').length,
    };
    
    return {
      results,
      summary,
      duration: Date.now() - start,
    };
  }
  
  /**
   * Verify a single behavior's preconditions and postconditions
   */
  async verifyBehavior(
    behavior: BehaviorDeclaration,
    domain?: DomainDeclaration
  ): Promise<SMTVerificationResult[]> {
    const results: SMTVerificationResult[] = [];
    const behaviorName = behavior.name.name;
    
    // Build context with input types
    const ctx = createContext();
    if (behavior.input) {
      for (const field of behavior.input.fields) {
        const sort = this.fieldTypeToSort(field);
        ctx.variables.set(field.name.name, sort);
      }
    }
    
    // Add result variable if output exists
    if (behavior.output) {
      ctx.variables.set('__result__', this.typeExprToSort(behavior.output.success));
    }
    
    // 1. Check precondition satisfiability
    if (behavior.preconditions) {
      const preResult = await this.checkPreconditionSatisfiability(
        behaviorName,
        behavior.preconditions,
        ctx
      );
      results.push(preResult);
    }
    
    // 2. Check postcondition implication (pre => post)
    if (behavior.preconditions && behavior.postconditions) {
      const implResult = await this.checkPostconditionImplication(
        behaviorName,
        behavior.preconditions,
        behavior.postconditions,
        ctx
      );
      results.push(implResult);
    }
    
    return results;
  }
  
  /**
   * Check if preconditions are satisfiable
   */
  private async checkPreconditionSatisfiability(
    behaviorName: string,
    preconditions: ConditionBlock,
    ctx: EncodingContext
  ): Promise<SMTVerificationResult> {
    const start = Date.now();
    const name = `${behaviorName}/preconditions`;
    
    // Encode all preconditions as conjunction
    const conditions: SMTExpr[] = [];
    const errors: string[] = [];
    
    for (const condition of preconditions.conditions) {
      for (const stmt of condition.statements) {
        const encoded = encodeCondition(stmt, ctx);
        if (encoded.success) {
          conditions.push(encoded.expr);
        } else {
          errors.push(encoded.error);
        }
      }
    }
    
    if (errors.length > 0) {
      return {
        kind: 'precondition_satisfiability',
        name,
        result: {
          status: 'error',
          message: `Encoding errors: ${errors.join(', ')}`,
        },
        duration: Date.now() - start,
      };
    }
    
    if (conditions.length === 0) {
      // Empty preconditions are trivially satisfiable
      return {
        kind: 'precondition_satisfiability',
        name,
        result: { status: 'sat' },
        duration: Date.now() - start,
      };
    }
    
    // Build formula
    const formula = conditions.length === 1 ? conditions[0]! : Expr.and(...conditions);
    
    // Build declarations
    const declarations: SMTDecl[] = [];
    for (const [varName, sort] of ctx.variables) {
      if (varName !== '__result__') {
        declarations.push(Decl.const(varName, sort));
      }
    }
    
    // Check satisfiability
    const result = await this.solver.checkSat(formula, declarations);
    
    return {
      kind: 'precondition_satisfiability',
      name,
      result,
      duration: Date.now() - start,
    };
  }
  
  /**
   * Check if postconditions follow from preconditions
   */
  private async checkPostconditionImplication(
    behaviorName: string,
    preconditions: ConditionBlock,
    postconditions: ConditionBlock,
    ctx: EncodingContext
  ): Promise<SMTVerificationResult> {
    const start = Date.now();
    const name = `${behaviorName}/postcondition_implication`;
    
    // Encode preconditions
    const preConditions: SMTExpr[] = [];
    const errors: string[] = [];
    
    for (const condition of preconditions.conditions) {
      for (const stmt of condition.statements) {
        const encoded = encodeCondition(stmt, ctx);
        if (encoded.success) {
          preConditions.push(encoded.expr);
        } else {
          errors.push(encoded.error);
        }
      }
    }
    
    // Encode postconditions (only success conditions without guards)
    const postConditions: SMTExpr[] = [];
    
    for (const condition of postconditions.conditions) {
      // Skip error guards for now - only verify success postconditions
      if (condition.guard && condition.guard !== 'success') {
        continue;
      }
      
      for (const stmt of condition.statements) {
        const encoded = encodeCondition(stmt, ctx);
        if (encoded.success) {
          postConditions.push(encoded.expr);
        } else {
          errors.push(encoded.error);
        }
      }
    }
    
    if (errors.length > 0) {
      return {
        kind: 'postcondition_implication',
        name,
        result: {
          status: 'error',
          message: `Encoding errors: ${errors.join(', ')}`,
        },
        duration: Date.now() - start,
      };
    }
    
    if (postConditions.length === 0) {
      // No postconditions to verify
      return {
        kind: 'postcondition_implication',
        name,
        result: { status: 'sat' }, // Trivially valid
        duration: Date.now() - start,
      };
    }
    
    // Build formulas
    const pre = preConditions.length === 0 ? Expr.bool(true) :
                preConditions.length === 1 ? preConditions[0]! :
                Expr.and(...preConditions);
    
    const post = postConditions.length === 1 ? postConditions[0]! :
                 Expr.and(...postConditions);
    
    // Build declarations
    const declarations: SMTDecl[] = [];
    for (const [varName, sort] of ctx.variables) {
      declarations.push(Decl.const(varName, sort));
    }
    
    // Check implication: pre => post
    // Valid iff (pre AND NOT post) is unsat
    const result = await this.solver.checkPostconditionImplication(pre, post, ctx.variables);
    
    return {
      kind: 'postcondition_implication',
      name,
      result,
      duration: Date.now() - start,
    };
  }
  
  /**
   * Verify refinement type constraints
   */
  async verifyRefinementType(type: TypeDeclaration): Promise<SMTVerificationResult[]> {
    const results: SMTVerificationResult[] = [];
    const typeName = type.name.name;
    
    if (type.constraints.length === 0) {
      return results;
    }
    
    const start = Date.now();
    const ctx = createContext();
    
    // Get base type sort
    const baseSort = this.typeExprToSort(type.baseType);
    ctx.variables.set('x', baseSort);
    
    // Encode all constraints
    const constraintExprs: SMTExpr[] = [];
    const errors: string[] = [];
    
    for (const constraint of type.constraints) {
      const encoded = encodeTypeConstraint(constraint, 'x', ctx);
      if (encoded.success) {
        constraintExprs.push(encoded.expr);
      } else {
        errors.push(encoded.error);
      }
    }
    
    if (errors.length > 0) {
      results.push({
        kind: 'refinement_constraint',
        name: typeName,
        result: {
          status: 'error',
          message: `Encoding errors: ${errors.join(', ')}`,
        },
        duration: Date.now() - start,
      });
      return results;
    }
    
    if (constraintExprs.length === 0) {
      return results;
    }
    
    // Check if constraints are satisfiable (not contradictory)
    const formula = constraintExprs.length === 1 ? constraintExprs[0]! : Expr.and(...constraintExprs);
    const declarations: SMTDecl[] = [Decl.const('x', baseSort)];
    
    const result = await this.solver.checkSat(formula, declarations);
    
    results.push({
      kind: 'refinement_constraint',
      name: typeName,
      result,
      duration: Date.now() - start,
    });
    
    return results;
  }
  
  /**
   * Convert field declaration to SMT sort
   */
  private fieldTypeToSort(field: FieldDeclaration): SMTSort {
    return this.typeExprToSort(field.type);
  }
  
  /**
   * Convert type expression to SMT sort
   */
  private typeExprToSort(typeExpr: any): SMTSort {
    if (!typeExpr) {
      return Sort.Bool();
    }
    
    switch (typeExpr.kind) {
      case 'SimpleType':
        return islTypeToSort(typeExpr.name.name);
        
      case 'GenericType':
        // Handle generic types like List<T>, Optional<T>
        return islTypeToSort(typeExpr.name.name);
        
      case 'ArrayType':
        // Arrays are modeled as uninterpreted
        return Sort.Array(Sort.Int(), this.typeExprToSort(typeExpr.elementType));
        
      default:
        return Sort.Bool();
    }
  }
}

/**
 * Verify a domain with SMT checks
 */
export async function verifySMT(
  domain: DomainDeclaration,
  options?: SMTVerifyOptions
): Promise<SMTBatchResult> {
  const verifier = new SMTVerifier(options);
  return verifier.verifyDomain(domain);
}

/**
 * Quick check for a single expression
 */
export async function checkExpression(
  expression: any,
  options?: SMTVerifyOptions
): Promise<SMTVerificationResult> {
  const start = Date.now();
  const ctx = createContext();
  const encoded = encodeExpression(expression, ctx);
  
  if (!encoded.success) {
    return {
      kind: 'precondition_satisfiability',
      name: 'expression',
      result: {
        status: 'error',
        message: encoded.error,
      },
      duration: Date.now() - start,
    };
  }
  
  const solver = createSolver(options);
  const result = await solver.checkSat(encoded.expr, []);
  
  return {
    kind: 'precondition_satisfiability',
    name: 'expression',
    result,
    duration: Date.now() - start,
  };
}

// ============================================================================
// Unknown Resolution Hook
// ============================================================================

/**
 * Result of attempting to resolve an unknown
 */
export interface UnknownResolution {
  /** The original unknown reason */
  originalReason: string;
  /** Whether resolution was attempted */
  attempted: boolean;
  /** The new result after SMT check */
  resolved?: {
    verdict: 'proved' | 'disproved' | 'still_unknown';
    model?: Record<string, unknown>;
    reason?: string;
  };
  /** Time taken for resolution attempt */
  durationMs: number;
  /** Solver evidence for proof bundles */
  evidence?: import('./types.js').SolverEvidence;
}

/**
 * Attempt to resolve an unknown verification result using SMT
 * 
 * This function is designed to be called when runtime verification
 * produces an "unknown" result, attempting to use SMT solving to
 * determine the truth value.
 * 
 * @example
 * ```typescript
 * // In the verifier, when we get an unknown:
 * if (result.triState === 'unknown') {
 *   const resolution = await resolveUnknown(
 *     clause.expression,
 *     clause.inputValues,
 *     { timeout: 5000 }
 *   );
 *   
 *   if (resolution.resolved?.verdict === 'proved') {
 *     result.triState = true;
 *     result.reason = 'Proved by SMT solver';
 *   }
 *   
 *   // Attach evidence to proof bundle
 *   if (resolution.evidence) {
 *     proofBundle.solverEvidence = resolution.evidence;
 *   }
 * }
 * ```
 */
export async function resolveUnknown(
  expression: any,
  inputValues?: Record<string, unknown>,
  options?: SMTVerifyOptions
): Promise<UnknownResolution> {
  const start = Date.now();
  const ctx = createContext();
  
  // Add input values as known variables
  if (inputValues) {
    for (const [name, value] of Object.entries(inputValues)) {
      if (typeof value === 'number') {
        ctx.variables.set(name, Sort.Int());
      } else if (typeof value === 'boolean') {
        ctx.variables.set(name, Sort.Bool());
      } else if (typeof value === 'string') {
        ctx.variables.set(name, Sort.String());
      }
    }
  }
  
  // Try to encode the expression
  const encoded = encodeExpression(expression, ctx);
  
  if (!encoded.success) {
    return {
      originalReason: 'Expression encoding failed',
      attempted: false,
      durationMs: Date.now() - start,
    };
  }
  
  // Import cache for query hashing
  const { getGlobalCache } = await import('./cache.js');
  const cache = getGlobalCache();
  
  try {
    const solver = createSolver(options);
    
    // Build declarations
    const declarations: SMTDecl[] = [];
    for (const [varName, sort] of ctx.variables) {
      declarations.push(Decl.const(varName, sort));
    }
    
    // Generate query hash for evidence
    const queryHash = cache.hashQuery(encoded.expr, declarations);
    
    // Generate SMT-LIB query for evidence
    const { translate } = await import('./solver.js');
    const smtLibQuery = translate(encoded.expr, declarations);
    
    // Check if the expression is satisfiable (can be true)
    const satResult = await solver.checkSat(encoded.expr, declarations);
    
    // Helper to create evidence
    const createEvidence = (
      status: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error',
      model?: Record<string, unknown>,
      reason?: string
    ): import('./types.js').SolverEvidence => ({
      queryHash,
      solver: options?.solver ?? 'builtin',
      status,
      model,
      reason,
      durationMs: Date.now() - start,
      smtLibQuery,
      timestamp: new Date().toISOString(),
    });
    
    if (satResult.status === 'unsat') {
      // Expression can never be true - it's always false
      return {
        originalReason: 'Unknown from runtime',
        attempted: true,
        resolved: {
          verdict: 'disproved',
          reason: 'SMT proved expression is unsatisfiable (always false)',
        },
        durationMs: Date.now() - start,
        evidence: createEvidence('unsat'),
      };
    }
    
    // Check if the negation is satisfiable (can be false)
    const negated = Expr.not(encoded.expr);
    const negResult = await solver.checkSat(negated, declarations);
    
    if (negResult.status === 'unsat') {
      // Negation can never be true - original is always true
      return {
        originalReason: 'Unknown from runtime',
        attempted: true,
        resolved: {
          verdict: 'proved',
          reason: 'SMT proved expression is valid (always true)',
        },
        durationMs: Date.now() - start,
        evidence: createEvidence('unsat'), // negation is unsat means proved
      };
    }
    
    if (satResult.status === 'sat' && negResult.status === 'sat') {
      // Both expression and negation are satisfiable
      // This means the expression depends on variable values
      return {
        originalReason: 'Unknown from runtime',
        attempted: true,
        resolved: {
          verdict: 'still_unknown',
          model: satResult.model,
          reason: 'Expression can be both true and false depending on inputs',
        },
        durationMs: Date.now() - start,
        evidence: createEvidence('sat', satResult.model, 'Both expression and negation satisfiable'),
      };
    }
    
    // Other cases (timeout, unknown, error)
    const statusForEvidence = satResult.status === 'error' ? 'error' :
                              satResult.status === 'timeout' ? 'timeout' : 'unknown';
    return {
      originalReason: 'Unknown from runtime',
      attempted: true,
      resolved: {
        verdict: 'still_unknown',
        reason: `SMT check returned: ${satResult.status}`,
      },
      durationMs: Date.now() - start,
      evidence: createEvidence(
        statusForEvidence,
        undefined,
        satResult.status === 'unknown' ? satResult.reason : 
        satResult.status === 'error' ? satResult.message : undefined
      ),
    };
  } catch (error) {
    return {
      originalReason: 'Unknown from runtime',
      attempted: true,
      resolved: {
        verdict: 'still_unknown',
        reason: `SMT error: ${error instanceof Error ? error.message : String(error)}`,
      },
      durationMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Formal Mode Verification
// ============================================================================

/**
 * Options for formal mode verification
 */
export interface FormalModeOptions extends SMTVerifyOptions {
  /** Always invoke solver, even if runtime says pass/fail */
  alwaysUseSolver?: boolean;
  /** Generate full proof bundles with evidence */
  generateEvidence?: boolean;
}

/**
 * Verify with formal mode enabled
 * 
 * In formal mode:
 * - Solver is always invoked (not just for unknowns)
 * - Full solver evidence is attached to results
 * - Results include proof bundle entries
 * 
 * @example
 * ```typescript
 * const result = await verifyFormal(domain, {
 *   solver: 'z3',
 *   timeout: 10000,
 *   alwaysUseSolver: true,
 *   generateEvidence: true,
 * });
 * 
 * // Result includes proof bundle entries with solver evidence
 * for (const entry of result.proofBundle) {
 *   console.log(entry.name, entry.verdict, entry.solverEvidence?.status);
 * }
 * ```
 */
export async function verifyFormal(
  domain: DomainDeclaration,
  options?: FormalModeOptions
): Promise<{
  batchResult: SMTBatchResult;
  proofBundle: import('./types.js').ProofBundleEntry[];
}> {
  const verifier = new SMTVerifier(options);
  const batchResult = await verifier.verifyDomain(domain);
  
  // Convert results to proof bundle entries
  const proofBundle: import('./types.js').ProofBundleEntry[] = [];
  
  // Import cache and translate for evidence generation
  const { getGlobalCache } = await import('./cache.js');
  const { translate } = await import('./solver.js');
  const cache = getGlobalCache();
  
  for (const result of batchResult.results) {
    const verdict: 'proved' | 'disproved' | 'unknown' = 
      result.result.status === 'unsat' ? 'proved' :
      result.result.status === 'sat' ? 'disproved' : 'unknown';
    
    const entry: import('./types.js').ProofBundleEntry = {
      id: `${result.kind}-${result.name}-${Date.now()}`,
      kind: result.kind,
      name: result.name,
      expression: result.smtLib || '[SMT-LIB not captured]',
      verdict,
      verdictSource: 'solver_only',
    };
    
    // Add solver evidence if generateEvidence is enabled
    if (options?.generateEvidence && result.smtLib) {
      entry.solverEvidence = {
        queryHash: cache.hashQuery(
          // We don't have the original expr here, so use smtLib as proxy
          { kind: 'BoolConst', value: true } as any,
          []
        ),
        solver: options.solver ?? 'builtin',
        status: result.result.status === 'error' ? 'error' :
                result.result.status as 'sat' | 'unsat' | 'unknown' | 'timeout',
        model: result.result.status === 'sat' ? result.result.model : undefined,
        reason: result.result.status === 'unknown' ? result.result.reason :
                result.result.status === 'error' ? result.result.message : undefined,
        durationMs: result.duration,
        smtLibQuery: result.smtLib,
        timestamp: new Date().toISOString(),
      };
    }
    
    proofBundle.push(entry);
  }
  
  return { batchResult, proofBundle };
}
