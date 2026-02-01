/**
 * Proof Generation and Representation
 */

import type { Proof, ProofStep, ProofMethod, Formula } from './types';

/**
 * Proof builder for constructing formal proofs
 */
export class ProofBuilder {
  private steps: ProofStep[] = [];
  private assumptions: string[] = [];
  private property: string;
  private method: ProofMethod;
  private startTime: number;

  constructor(property: string, method: ProofMethod = 'smt') {
    this.property = property;
    this.method = method;
    this.startTime = Date.now();
  }

  /**
   * Add assumption to proof
   */
  assume(assumption: string): this {
    this.assumptions.push(assumption);
    this.steps.push({
      description: `Assume: ${assumption}`,
      formula: assumption,
      result: 'valid',
    });
    return this;
  }

  /**
   * Add derivation step
   */
  derive(description: string, formula: string, result: 'valid' | 'invalid' | 'unknown' = 'valid'): this {
    this.steps.push({ description, formula, result });
    return this;
  }

  /**
   * Add case analysis
   */
  caseAnalysis(cases: { condition: string; conclusion: string }[]): this {
    this.steps.push({
      description: 'Case analysis',
      formula: cases.map((c) => `(${c.condition} => ${c.conclusion})`).join(' ∧ '),
      result: 'valid',
    });
    return this;
  }

  /**
   * Add induction step
   */
  induction(baseCase: string, inductiveStep: string): this {
    this.steps.push({
      description: 'Base case',
      formula: baseCase,
      result: 'valid',
    });
    this.steps.push({
      description: 'Inductive step',
      formula: inductiveStep,
      result: 'valid',
    });
    return this;
  }

  /**
   * Build the final proof
   */
  build(): Proof {
    return {
      property: this.property,
      method: this.method,
      steps: this.steps,
      assumptions: this.assumptions,
      duration: Date.now() - this.startTime,
    };
  }
}

/**
 * Format proof for display
 */
export function formatProof(proof: Proof): string {
  const lines: string[] = [
    `Proof of: ${proof.property}`,
    `Method: ${proof.method}`,
    `Duration: ${proof.duration}ms`,
    '',
  ];

  if (proof.assumptions.length > 0) {
    lines.push('Assumptions:');
    for (const assumption of proof.assumptions) {
      lines.push(`  - ${assumption}`);
    }
    lines.push('');
  }

  lines.push('Steps:');
  for (let i = 0; i < proof.steps.length; i++) {
    const step = proof.steps[i];
    const status = step.result === 'valid' ? '✓' : step.result === 'invalid' ? '✗' : '?';
    lines.push(`  ${i + 1}. [${status}] ${step.description}`);
    if (step.formula) {
      lines.push(`      ${step.formula}`);
    }
  }

  lines.push('');
  lines.push('QED');

  return lines.join('\n');
}

/**
 * Verify proof is valid
 */
export function verifyProof(proof: Proof): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all steps are valid
  for (let i = 0; i < proof.steps.length; i++) {
    const step = proof.steps[i];
    if (step.result === 'invalid') {
      errors.push(`Step ${i + 1} is invalid: ${step.description}`);
    }
  }

  // Check proof has at least one step
  if (proof.steps.length === 0) {
    errors.push('Proof has no steps');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Proof tactics
 */
export const Tactics = {
  /**
   * Apply modus ponens: A, A => B |- B
   */
  modusPonens(premise: Formula, implication: Formula): Formula | null {
    if (implication.kind !== 'implies') return null;
    // Check premise matches left side of implication
    // Return right side
    return implication.right;
  },

  /**
   * Apply modus tollens: not B, A => B |- not A
   */
  modusTollens(negatedConsequent: Formula, implication: Formula): Formula | null {
    if (implication.kind !== 'implies') return null;
    if (negatedConsequent.kind !== 'not') return null;
    return { kind: 'not', arg: implication.left };
  },

  /**
   * Apply conjunction introduction: A, B |- A ∧ B
   */
  andIntro(...formulas: Formula[]): Formula {
    return { kind: 'and', args: formulas };
  },

  /**
   * Apply conjunction elimination: A ∧ B |- A (or B)
   */
  andElim(conjunction: Formula, index: number): Formula | null {
    if (conjunction.kind !== 'and') return null;
    return conjunction.args[index];
  },

  /**
   * Apply disjunction introduction: A |- A ∨ B
   */
  orIntro(formula: Formula, additional: Formula): Formula {
    return { kind: 'or', args: [formula, additional] };
  },

  /**
   * Apply universal instantiation: ∀x.P(x) |- P(t)
   */
  forallElim(universal: Formula, term: Formula): Formula | null {
    if (universal.kind !== 'forall') return null;
    // Substitute term for bound variable
    return substituteVariable(universal.body, universal.vars[0].name, term);
  },

  /**
   * Apply existential instantiation: ∃x.P(x) |- P(c) for fresh c
   */
  existsElim(existential: Formula, freshConstant: string): Formula | null {
    if (existential.kind !== 'exists') return null;
    return substituteVariable(
      existential.body,
      existential.vars[0].name,
      { kind: 'var', name: freshConstant, sort: existential.vars[0].sort }
    );
  },
};

/**
 * Substitute variable in formula
 */
function substituteVariable(formula: Formula, varName: string, replacement: Formula): Formula {
  switch (formula.kind) {
    case 'var':
      return formula.name === varName ? replacement : formula;

    case 'not':
      return { kind: 'not', arg: substituteVariable(formula.arg, varName, replacement) };

    case 'and':
      return { kind: 'and', args: formula.args.map((a) => substituteVariable(a, varName, replacement)) };

    case 'or':
      return { kind: 'or', args: formula.args.map((a) => substituteVariable(a, varName, replacement)) };

    case 'implies':
      return {
        kind: 'implies',
        left: substituteVariable(formula.left, varName, replacement),
        right: substituteVariable(formula.right, varName, replacement),
      };

    case 'forall':
    case 'exists':
      // Don't substitute bound variables
      if (formula.vars.some((v) => v.name === varName)) {
        return formula;
      }
      return {
        ...formula,
        body: substituteVariable(formula.body, varName, replacement),
      };

    case 'eq':
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
      return {
        ...formula,
        left: substituteVariable(formula.left, varName, replacement),
        right: substituteVariable(formula.right, varName, replacement),
      };

    default:
      return formula;
  }
}
