// ============================================================================
// ISL Formal Prover - Prover Implementation
// ============================================================================

import type {
  SMTExpr,
  SMTDecl,
  SMTSort,
  VerificationGoal,
  VerificationResult,
  Counterexample,
  ProverConfig,
  ISLProperty,
  ISLVerificationContext,
  VerificationReport,
  PropertyResult,
} from './types.js';
import { Expr, Decl, Sort, toSMTLib, declToSMTLib, simplify } from './smt.js';

/**
 * Prover class - performs verification
 */
export class Prover {
  private config: ProverConfig;
  private declarations: SMTDecl[] = [];
  private assertions: SMTExpr[] = [];

  constructor(config: ProverConfig = { solver: 'builtin' }) {
    this.config = {
      timeout: 5000,
      produceModels: true,
      produceProofs: false,
      ...config,
    };
  }

  /**
   * Add a declaration
   */
  declare(decl: SMTDecl): void {
    this.declarations.push(decl);
  }

  /**
   * Add an assertion
   */
  assert(expr: SMTExpr): void {
    this.assertions.push(expr);
    this.declarations.push(Decl.assert(expr));
  }

  /**
   * Check satisfiability
   */
  async checkSat(): Promise<'sat' | 'unsat' | 'unknown'> {
    const result = await this.solve(this.assertions);
    return result.status === 'invalid' ? 'sat' : 
           result.status === 'valid' ? 'unsat' : 'unknown';
  }

  /**
   * Verify a property (prove unsatisfiability of negation)
   */
  async verify(goal: VerificationGoal): Promise<VerificationResult> {
    const start = Date.now();
    
    try {
      // Build formula: assumptions => property
      // We want to prove: forall x. assumptions(x) => property(x)
      // This is valid iff NOT(assumptions AND NOT property) is unsat
      
      const assumptions = goal.assumptions.length > 0 
        ? Expr.and(...goal.assumptions)
        : Expr.bool(true);
      
      const negatedProperty = Expr.not(goal.property);
      const formula = Expr.and(assumptions, negatedProperty);
      
      const simplified = simplify(formula);
      
      // Check if the negation is satisfiable
      const result = await this.solve([simplified], goal.timeout);
      
      // If negation is UNSAT, original is VALID
      // If negation is SAT, original is INVALID (with counterexample)
      switch (result.status) {
        case 'valid':
          return { status: 'invalid', counterexample: result.counterexample! };
        case 'invalid':
          return { status: 'valid' };
        default:
          return result;
      }
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Core solve function
   */
  private async solve(
    formulas: SMTExpr[],
    timeout?: number
  ): Promise<VerificationResult> {
    const timeoutMs = timeout ?? this.config.timeout ?? 5000;
    
    if (this.config.solver === 'builtin') {
      return this.solveBuiltin(formulas, timeoutMs);
    }
    
    // For external solvers, generate SMT-LIB and call solver
    return this.solveExternal(formulas, timeoutMs);
  }

  /**
   * Built-in solver (simple cases only)
   */
  private async solveBuiltin(
    formulas: SMTExpr[],
    timeout: number
  ): Promise<VerificationResult> {
    const deadline = Date.now() + timeout;
    
    // Simplify formulas
    const simplified = formulas.map(simplify);
    
    // Check for trivial cases
    for (const f of simplified) {
      if (f.kind === 'BoolConst') {
        if (f.value) {
          // True is satisfiable
          return { status: 'invalid', counterexample: { assignments: new Map() } };
        } else {
          // False is unsatisfiable
          return { status: 'valid' };
        }
      }
    }

    // Combine into conjunction
    const combined = Expr.and(...simplified);
    const finalSimplified = simplify(combined);
    
    if (finalSimplified.kind === 'BoolConst') {
      if (finalSimplified.value) {
        return { status: 'invalid', counterexample: { assignments: new Map() } };
      } else {
        return { status: 'valid' };
      }
    }

    // Try to find a satisfying assignment via simple enumeration
    // This is only effective for small propositional formulas
    const result = this.tryEnumerate(finalSimplified, deadline);
    return result;
  }

  /**
   * Try to find satisfying assignment by enumeration
   */
  private tryEnumerate(
    formula: SMTExpr,
    deadline: number
  ): VerificationResult {
    // Collect boolean variables
    const boolVars = this.collectBoolVars(formula);
    
    if (boolVars.length > 20) {
      // Too many variables for enumeration
      return { status: 'unknown', reason: 'Too many variables for built-in solver' };
    }

    // Try all assignments
    const numAssignments = 1 << boolVars.length;
    for (let i = 0; i < numAssignments; i++) {
      if (Date.now() > deadline) {
        return { status: 'timeout' };
      }

      const assignment = new Map<string, boolean>();
      for (let j = 0; j < boolVars.length; j++) {
        assignment.set(boolVars[j]!, Boolean((i >> j) & 1));
      }

      if (this.evaluate(formula, assignment)) {
        return {
          status: 'invalid',
          counterexample: { 
            assignments: new Map(Array.from(assignment.entries())) 
          },
        };
      }
    }

    return { status: 'valid' };
  }

  /**
   * Collect boolean variables from expression
   */
  private collectBoolVars(expr: SMTExpr): string[] {
    const vars = new Set<string>();
    
    function collect(e: SMTExpr): void {
      switch (e.kind) {
        case 'Var':
          if (e.sort.kind === 'Bool') vars.add(e.name);
          break;
        case 'Not':
          collect(e.arg);
          break;
        case 'And':
        case 'Or':
          for (const arg of e.args) collect(arg);
          break;
        case 'Implies':
        case 'Iff':
        case 'Eq':
          collect(e.left);
          collect(e.right);
          break;
        case 'Ite':
          collect(e.cond);
          collect(e.then);
          collect(e.else);
          break;
      }
    }
    
    collect(expr);
    return Array.from(vars);
  }

  /**
   * Evaluate boolean expression with assignment
   */
  private evaluate(expr: SMTExpr, assignment: Map<string, boolean>): boolean {
    switch (expr.kind) {
      case 'BoolConst':
        return expr.value;
      case 'Var':
        return assignment.get(expr.name) ?? false;
      case 'Not':
        return !this.evaluate(expr.arg, assignment);
      case 'And':
        return expr.args.every(a => this.evaluate(a, assignment));
      case 'Or':
        return expr.args.some(a => this.evaluate(a, assignment));
      case 'Implies':
        return !this.evaluate(expr.left, assignment) || this.evaluate(expr.right, assignment);
      case 'Iff':
        return this.evaluate(expr.left, assignment) === this.evaluate(expr.right, assignment);
      case 'Ite':
        return this.evaluate(expr.cond, assignment)
          ? this.evaluate(expr.then, assignment)
          : this.evaluate(expr.else, assignment);
      default:
        // For non-boolean expressions, return true (unknown)
        return true;
    }
  }

  /**
   * Solve using external SMT solver
   */
  private async solveExternal(
    formulas: SMTExpr[],
    timeout: number
  ): Promise<VerificationResult> {
    // Generate SMT-LIB script
    const script = this.generateSMTLib(formulas);
    
    // In a real implementation, this would call z3/cvc5/yices
    // For now, return unknown
    return { 
      status: 'unknown', 
      reason: `External solver ${this.config.solver} not available` 
    };
  }

  /**
   * Generate SMT-LIB script
   */
  generateSMTLib(formulas: SMTExpr[]): string {
    const lines: string[] = [];
    
    // Set logic
    if (this.config.logicMode) {
      lines.push(`(set-logic ${this.config.logicMode})`);
    }
    
    // Set options
    if (this.config.produceModels) {
      lines.push('(set-option :produce-models true)');
    }
    if (this.config.produceProofs) {
      lines.push('(set-option :produce-proofs true)');
    }
    
    // Declarations
    for (const decl of this.declarations) {
      lines.push(declToSMTLib(decl));
    }
    
    // Additional assertions
    for (const f of formulas) {
      lines.push(`(assert ${toSMTLib(f)})`);
    }
    
    // Check-sat and get-model
    lines.push('(check-sat)');
    if (this.config.produceModels) {
      lines.push('(get-model)');
    }
    
    return lines.join('\n');
  }

  /**
   * Reset the prover state
   */
  reset(): void {
    this.declarations = [];
    this.assertions = [];
  }

  /**
   * Push a new assertion scope
   */
  push(): void {
    this.declarations.push({ kind: 'Assert', expr: Expr.bool(true) }); // placeholder
  }

  /**
   * Pop assertion scope
   */
  pop(): void {
    // In a real implementation, would restore to previous state
  }
}

/**
 * Verify ISL properties
 */
export async function verifyISLProperties(
  context: ISLVerificationContext,
  properties: ISLProperty[],
  config?: ProverConfig
): Promise<VerificationReport> {
  const prover = new Prover(config);
  const start = Date.now();
  const results: PropertyResult[] = [];

  // Add entity declarations
  for (const [name, entity] of context.entities) {
    // Declare entity sort
    prover.declare(Decl.sort(name));
    
    // Declare field functions
    for (const field of entity.fields) {
      prover.declare(Decl.fun(
        `${name}_${field.name}`,
        [Sort.Uninterpreted(name)],
        islTypeToSort(field.type)
      ));
    }
  }

  // Verify each property
  for (const prop of properties) {
    const propStart = Date.now();
    
    // Translate ISL expression to SMT
    const smtExpr = translateISLToSMT(prop.expression, context);
    
    const goal: VerificationGoal = {
      name: prop.name,
      property: smtExpr,
      assumptions: [],
    };
    
    const result = await prover.verify(goal);
    
    results.push({
      property: prop,
      result,
      duration: Date.now() - propStart,
    });
  }

  const summary = {
    total: results.length,
    valid: results.filter(r => r.result.status === 'valid').length,
    invalid: results.filter(r => r.result.status === 'invalid').length,
    unknown: results.filter(r => r.result.status === 'unknown').length,
    timeout: results.filter(r => r.result.status === 'timeout').length,
    error: results.filter(r => r.result.status === 'error').length,
  };

  return {
    timestamp: new Date(),
    duration: Date.now() - start,
    results,
    summary,
  };
}

/**
 * Translate ISL type to SMT sort
 */
function islTypeToSort(type: string): SMTSort {
  switch (type.toLowerCase()) {
    case 'int':
    case 'integer':
      return Sort.Int();
    case 'decimal':
    case 'real':
    case 'float':
      return Sort.Real();
    case 'bool':
    case 'boolean':
      return Sort.Bool();
    case 'string':
      return Sort.String();
    default:
      return Sort.Uninterpreted(type);
  }
}

/**
 * Translate ISL expression to SMT
 */
function translateISLToSMT(
  expr: string,
  context: ISLVerificationContext
): SMTExpr {
  // Simple expression parser
  const trimmed = expr.trim();
  
  // Constants
  if (trimmed === 'true') return Expr.bool(true);
  if (trimmed === 'false') return Expr.bool(false);
  if (/^-?\d+$/.test(trimmed)) return Expr.int(parseInt(trimmed));
  if (/^-?\d+\.\d+$/.test(trimmed)) return Expr.real(parseFloat(trimmed));
  
  // Binary operations
  if (trimmed.includes(' and ')) {
    const parts = trimmed.split(' and ');
    return Expr.and(...parts.map(p => translateISLToSMT(p, context)));
  }
  if (trimmed.includes(' or ')) {
    const parts = trimmed.split(' or ');
    return Expr.or(...parts.map(p => translateISLToSMT(p, context)));
  }
  if (trimmed.includes(' implies ')) {
    const [left, right] = trimmed.split(' implies ');
    return Expr.implies(
      translateISLToSMT(left!, context),
      translateISLToSMT(right!, context)
    );
  }
  
  // Comparisons
  const compOps = ['>=', '<=', '==', '!=', '>', '<'];
  for (const op of compOps) {
    if (trimmed.includes(op)) {
      const idx = trimmed.indexOf(op);
      const left = trimmed.slice(0, idx).trim();
      const right = trimmed.slice(idx + op.length).trim();
      const leftExpr = translateISLToSMT(left, context);
      const rightExpr = translateISLToSMT(right, context);
      
      switch (op) {
        case '==': return Expr.eq(leftExpr, rightExpr);
        case '!=': return Expr.neq(leftExpr, rightExpr);
        case '<': return Expr.lt(leftExpr, rightExpr);
        case '<=': return Expr.le(leftExpr, rightExpr);
        case '>': return Expr.gt(leftExpr, rightExpr);
        case '>=': return Expr.ge(leftExpr, rightExpr);
      }
    }
  }

  // Negation
  if (trimmed.startsWith('not ')) {
    return Expr.not(translateISLToSMT(trimmed.slice(4), context));
  }

  // Variable reference
  return Expr.var(trimmed, Sort.Bool());
}
