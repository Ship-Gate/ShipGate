/**
 * ISL Verifier
 * 
 * Main verification engine.
 */

import type {
  VerificationResult,
  VerificationTarget,
  VerifierConfig,
  defaultConfig,
  ISLSpecification,
  ISLBehavior,
  ISLInvariant,
  Formula,
  Counterexample,
  Proof,
} from './types';
import { SMTSolver } from './smt';
import { translateToFormula, translatePrecondition, translatePostcondition } from './contracts';

/**
 * ISL Specification Verifier
 */
export class Verifier {
  private solver: SMTSolver;
  private config: VerifierConfig;
  private cache = new Map<string, VerificationResult>();

  constructor(config: Partial<VerifierConfig> = {}) {
    this.config = { ...defaultConfig, ...config } as VerifierConfig;
    this.solver = new SMTSolver(this.config);
  }

  /**
   * Verify an entire ISL specification
   */
  async verifySpecification(spec: ISLSpecification): Promise<VerificationReport> {
    const results: VerificationResult[] = [];
    const start = Date.now();

    // Verify all behaviors
    for (const behavior of spec.behaviors) {
      const behaviorResults = await this.verifyBehavior(behavior, spec);
      results.push(...behaviorResults);
    }

    // Verify all invariants
    for (const invariant of spec.invariants) {
      const invariantResult = await this.verifyInvariant(invariant, spec);
      results.push(invariantResult);
    }

    // Verify type constraints are satisfiable
    for (const type of spec.types) {
      const typeResult = await this.verifyTypeConstraints(type.name, type.constraints, spec);
      results.push(typeResult);
    }

    const duration = Date.now() - start;

    return {
      specification: spec.domain,
      results,
      summary: {
        total: results.length,
        verified: results.filter((r) => r.status === 'verified').length,
        falsified: results.filter((r) => r.status === 'falsified').length,
        unknown: results.filter((r) => r.status === 'unknown').length,
        timeout: results.filter((r) => r.status === 'timeout').length,
        error: results.filter((r) => r.status === 'error').length,
      },
      duration,
    };
  }

  /**
   * Verify a single behavior
   */
  async verifyBehavior(
    behavior: ISLBehavior,
    spec: ISLSpecification
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    // 1. Verify preconditions are satisfiable
    for (const precond of behavior.preconditions) {
      const result = await this.verifySatisfiability(
        `${behavior.name}.precondition`,
        translatePrecondition(precond, behavior, spec)
      );
      results.push(result);
    }

    // 2. Verify postconditions follow from preconditions
    for (const postcond of behavior.postconditions) {
      const result = await this.verifyImplication(
        `${behavior.name}.postcondition`,
        behavior.preconditions.map((p) => translatePrecondition(p, behavior, spec)),
        translatePostcondition(postcond, behavior, spec)
      );
      results.push(result);
    }

    // 3. Verify invariants are maintained
    for (const invariant of behavior.invariants) {
      const result = await this.verifyInvariantPreservation(
        `${behavior.name}.invariant`,
        invariant,
        behavior,
        spec
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Verify an invariant holds globally
   */
  async verifyInvariant(
    invariant: ISLInvariant,
    spec: ISLSpecification
  ): Promise<VerificationResult> {
    const formulas = invariant.conditions.map((c) => 
      translateToFormula(c, { domain: spec.domain, assumptions: [], bindings: {} })
    );

    // Verify conjunction of all conditions is satisfiable
    const conjunction: Formula = {
      kind: 'and',
      args: formulas,
    };

    return this.verifySatisfiability(`invariant.${invariant.name}`, conjunction);
  }

  /**
   * Verify type constraints are satisfiable
   */
  async verifyTypeConstraints(
    typeName: string,
    constraints: { kind: string; value: unknown }[],
    spec: ISLSpecification
  ): Promise<VerificationResult> {
    // Build formula from constraints
    const formulas: Formula[] = [];

    for (const constraint of constraints) {
      const formula = this.constraintToFormula(constraint);
      if (formula) {
        formulas.push(formula);
      }
    }

    if (formulas.length === 0) {
      return {
        status: 'verified',
        proof: {
          property: `type.${typeName}`,
          method: 'smt',
          steps: [],
          assumptions: [],
          duration: 0,
        },
      };
    }

    const conjunction: Formula = {
      kind: 'and',
      args: formulas,
    };

    return this.verifySatisfiability(`type.${typeName}`, conjunction);
  }

  /**
   * Verify satisfiability of a formula
   */
  async verifySatisfiability(
    name: string,
    formula: Formula
  ): Promise<VerificationResult> {
    // Check cache
    const cacheKey = `sat:${name}:${JSON.stringify(formula)}`;
    if (this.config.cacheResults && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const start = Date.now();

    try {
      const result = await this.solver.checkSat(formula);
      const duration = Date.now() - start;

      let verificationResult: VerificationResult;

      if (result.sat) {
        verificationResult = {
          status: 'verified',
          proof: {
            property: name,
            method: 'smt',
            steps: [{ description: 'SMT satisfiability check', formula: '', result: 'valid' }],
            assumptions: [],
            duration,
          },
        };
      } else if (result.sat === false) {
        verificationResult = {
          status: 'falsified',
          counterexample: {
            property: name,
            values: result.model || {},
          },
        };
      } else {
        verificationResult = {
          status: 'unknown',
          reason: result.reason || 'Solver returned unknown',
        };
      }

      if (this.config.cacheResults) {
        this.cache.set(cacheKey, verificationResult);
      }

      return verificationResult;
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify an implication: assumptions => conclusion
   */
  async verifyImplication(
    name: string,
    assumptions: Formula[],
    conclusion: Formula
  ): Promise<VerificationResult> {
    // To prove A => B, we check that (A and not B) is unsatisfiable
    const negatedConclusion: Formula = { kind: 'not', arg: conclusion };
    const formula: Formula = {
      kind: 'and',
      args: [...assumptions, negatedConclusion],
    };

    const result = await this.verifySatisfiability(name, formula);

    // Invert the result - if (A and not B) is unsat, then A => B is valid
    if (result.status === 'falsified') {
      return {
        status: 'verified',
        proof: {
          property: name,
          method: 'smt',
          steps: [{ description: 'Implication verified via negation', formula: '', result: 'valid' }],
          assumptions: assumptions.map(() => ''),
          duration: 0,
        },
      };
    } else if (result.status === 'verified') {
      return {
        status: 'falsified',
        counterexample: {
          property: name,
          values: {},
        },
      };
    }

    return result;
  }

  /**
   * Verify an invariant is preserved by a behavior
   */
  async verifyInvariantPreservation(
    name: string,
    invariant: string,
    behavior: ISLBehavior,
    spec: ISLSpecification
  ): Promise<VerificationResult> {
    // Translate invariant
    const invariantFormula = translateToFormula(invariant, {
      domain: spec.domain,
      assumptions: [],
      bindings: {},
    });

    // Pre-state invariant
    const preInvariant = invariantFormula;

    // Post-state invariant (with primed variables)
    const postInvariant = primeVariables(invariantFormula);

    // Preconditions
    const preconditions = behavior.preconditions.map((p) =>
      translatePrecondition(p, behavior, spec)
    );

    // Verify: pre-invariant AND preconditions => post-invariant
    return this.verifyImplication(
      name,
      [preInvariant, ...preconditions],
      postInvariant
    );
  }

  /**
   * Convert ISL constraint to formula
   */
  private constraintToFormula(constraint: { kind: string; value: unknown }): Formula | null {
    const varFormula: Formula = { kind: 'var', name: 'x', sort: { kind: 'int' } };

    switch (constraint.kind) {
      case 'min':
        return {
          kind: 'ge',
          left: varFormula,
          right: { kind: 'const', value: constraint.value as number },
        };
      case 'max':
        return {
          kind: 'le',
          left: varFormula,
          right: { kind: 'const', value: constraint.value as number },
        };
      case 'min_length':
        return {
          kind: 'ge',
          left: { kind: 'app', func: 'str.len', args: [varFormula] },
          right: { kind: 'const', value: constraint.value as number },
        };
      case 'max_length':
        return {
          kind: 'le',
          left: { kind: 'app', func: 'str.len', args: [varFormula] },
          right: { kind: 'const', value: constraint.value as number },
        };
      default:
        return null;
    }
  }
}

/**
 * Prime variables in a formula (for post-state)
 */
function primeVariables(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
      return { ...formula, name: `${formula.name}'` };
    case 'not':
      return { kind: 'not', arg: primeVariables(formula.arg) };
    case 'and':
      return { kind: 'and', args: formula.args.map(primeVariables) };
    case 'or':
      return { kind: 'or', args: formula.args.map(primeVariables) };
    case 'implies':
      return {
        kind: 'implies',
        left: primeVariables(formula.left),
        right: primeVariables(formula.right),
      };
    case 'eq':
      return {
        kind: 'eq',
        left: primeVariables(formula.left),
        right: primeVariables(formula.right),
      };
    default:
      return formula;
  }
}

// ============================================
// Report Types
// ============================================

export interface VerificationReport {
  specification: string;
  results: VerificationResult[];
  summary: {
    total: number;
    verified: number;
    falsified: number;
    unknown: number;
    timeout: number;
    error: number;
  };
  duration: number;
}

/**
 * Create verifier instance
 */
export function createVerifier(config?: Partial<VerifierConfig>): Verifier {
  return new Verifier(config);
}
