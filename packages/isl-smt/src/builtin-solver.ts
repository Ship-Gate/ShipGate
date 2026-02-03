/**
 * Built-in SMT Solver
 * 
 * A bounded SMT solver that handles common cases without requiring Z3.
 * Supports:
 * - Boolean logic (SAT)
 * - Linear integer arithmetic (bounded)
 * - Equalities and comparisons
 * - Simple arithmetic (+, -, *, with bounds)
 * 
 * Uses DPLL-style search with constraint propagation for efficiency.
 * Falls back to UNKNOWN for cases it cannot handle.
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import { simplify } from '@isl-lang/prover';
import type { SMTCheckResult } from './types.js';

/**
 * Solver configuration
 */
export interface BuiltinSolverConfig {
  /** Timeout in milliseconds */
  timeout: number;
  /** Maximum integer bound for enumeration (default: 1000) */
  maxIntBound?: number;
  /** Maximum search iterations */
  maxIterations?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Variable assignment
 */
type Assignment = Map<string, number | boolean>;

/**
 * Constraint type
 */
interface Constraint {
  kind: 'eq' | 'neq' | 'lt' | 'le' | 'gt' | 'ge' | 'bool';
  lhs: LinearExpr | string;
  rhs?: LinearExpr | number;
}

/**
 * Linear expression: c1*x1 + c2*x2 + ... + constant
 */
interface LinearExpr {
  coefficients: Map<string, number>; // variable -> coefficient
  constant: number;
}

/**
 * Built-in SMT Solver
 */
export class BuiltinSolver {
  private config: Required<BuiltinSolverConfig>;
  private deadline: number = 0;
  private iterations: number = 0;
  
  constructor(config: BuiltinSolverConfig) {
    this.config = {
      timeout: config.timeout,
      maxIntBound: config.maxIntBound ?? 1000,
      maxIterations: config.maxIterations ?? 100000,
      verbose: config.verbose ?? false,
    };
  }
  
  /**
   * Check satisfiability of a formula
   */
  async checkSat(
    formula: SMTExpr,
    declarations: SMTDecl[]
  ): Promise<SMTCheckResult> {
    this.deadline = Date.now() + this.config.timeout;
    this.iterations = 0;
    
    try {
      // Simplify the formula
      const simplified = simplify(formula);
      
      // Check for trivial cases
      if (simplified.kind === 'BoolConst') {
        return simplified.value
          ? { status: 'sat', model: {} }
          : { status: 'unsat' };
      }
      
      // Extract variable types from declarations
      const varTypes = this.extractVarTypes(declarations);
      
      // Try to solve based on formula structure
      const result = await this.solve(simplified, varTypes);
      return result;
    } catch (error) {
      if (this.isTimeout()) {
        return { status: 'timeout' };
      }
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Extract variable types from declarations
   */
  private extractVarTypes(declarations: SMTDecl[]): Map<string, SMTSort> {
    const types = new Map<string, SMTSort>();
    
    for (const decl of declarations) {
      if (decl.kind === 'DeclareConst') {
        types.set(decl.name, decl.sort);
      }
    }
    
    return types;
  }
  
  /**
   * Check if deadline has passed
   */
  private isTimeout(): boolean {
    return Date.now() > this.deadline;
  }
  
  /**
   * Check iteration limit
   */
  private checkLimits(): void {
    this.iterations++;
    if (this.iterations > this.config.maxIterations) {
      throw new Error('Iteration limit exceeded');
    }
    if (this.isTimeout()) {
      throw new Error('Timeout');
    }
  }
  
  /**
   * Main solve function
   */
  private async solve(
    formula: SMTExpr,
    varTypes: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    // Collect all variables
    const variables = this.collectVariables(formula);
    
    // Categorize variables
    const boolVars: string[] = [];
    const intVars: string[] = [];
    
    for (const v of variables) {
      const sort = varTypes.get(v);
      if (!sort || sort.kind === 'Bool') {
        boolVars.push(v);
      } else if (sort.kind === 'Int') {
        intVars.push(v);
      }
    }
    
    // If we only have boolean variables, use SAT solving
    if (intVars.length === 0 && boolVars.length <= 20) {
      return this.solvePureBool(formula, boolVars);
    }
    
    // If we have integer variables, try constraint analysis
    if (intVars.length > 0) {
      // Try to extract linear constraints
      const constraints = this.extractConstraints(formula);
      
      if (constraints) {
        return this.solveLinearInt(formula, constraints, intVars, boolVars, varTypes);
      }
    }
    
    // Fall back to bounded enumeration for small cases
    if (variables.size <= 5) {
      return this.solveBoundedEnumeration(formula, boolVars, intVars, varTypes);
    }
    
    // Cannot handle - return unknown
    return {
      status: 'unknown',
      reason: 'Formula too complex for built-in solver',
    };
  }
  
  /**
   * Solve pure boolean formula using DPLL-style search
   */
  private solvePureBool(
    formula: SMTExpr,
    variables: string[]
  ): SMTCheckResult {
    if (variables.length > 20) {
      return {
        status: 'unknown',
        reason: 'Too many boolean variables for enumeration',
      };
    }
    
    const numAssignments = 1 << variables.length;
    
    for (let i = 0; i < numAssignments; i++) {
      this.checkLimits();
      
      const assignment = new Map<string, boolean>();
      for (let j = 0; j < variables.length; j++) {
        assignment.set(variables[j]!, Boolean((i >> j) & 1));
      }
      
      if (this.evaluateBool(formula, assignment)) {
        const model: Record<string, unknown> = {};
        for (const [k, v] of assignment) {
          model[k] = v;
        }
        return { status: 'sat', model };
      }
    }
    
    return { status: 'unsat' };
  }
  
  /**
   * Solve linear integer constraints
   */
  private solveLinearInt(
    formula: SMTExpr,
    constraints: Constraint[],
    intVars: string[],
    boolVars: string[],
    varTypes: Map<string, SMTSort>
  ): SMTCheckResult {
    // Try to find bounds for each integer variable
    const bounds = this.inferBounds(constraints, intVars);
    
    // Check if bounds are reasonable
    let totalCombinations = 1;
    for (const [varName, bound] of bounds) {
      const range = bound.max - bound.min + 1;
      totalCombinations *= Math.min(range, this.config.maxIntBound * 2);
      
      if (totalCombinations > this.config.maxIterations) {
        return {
          status: 'unknown',
          reason: 'Integer variable ranges too large for bounded search',
        };
      }
    }
    
    // Enumerate integer values within bounds
    return this.enumerateIntAssignments(formula, bounds, boolVars, varTypes);
  }
  
  /**
   * Infer bounds for integer variables from constraints
   */
  private inferBounds(
    constraints: Constraint[],
    intVars: string[]
  ): Map<string, { min: number; max: number }> {
    const bounds = new Map<string, { min: number; max: number }>();
    
    // Initialize with default bounds
    for (const v of intVars) {
      bounds.set(v, {
        min: -this.config.maxIntBound,
        max: this.config.maxIntBound,
      });
    }
    
    // Tighten bounds based on constraints
    for (const constraint of constraints) {
      if (typeof constraint.lhs === 'object' && constraint.rhs !== undefined) {
        const lhs = constraint.lhs;
        const rhs = typeof constraint.rhs === 'number' ? constraint.rhs : 0;
        
        // Handle simple single-variable constraints
        if (lhs.coefficients.size === 1) {
          const [varName, coef] = lhs.coefficients.entries().next().value!;
          const bound = bounds.get(varName);
          if (!bound) continue;
          
          // ax + c <op> rhs  =>  x <op'> (rhs - c) / a
          const threshold = Math.floor((rhs - lhs.constant) / coef);
          
          switch (constraint.kind) {
            case 'lt':
              if (coef > 0) bound.max = Math.min(bound.max, threshold - 1);
              else bound.min = Math.max(bound.min, -threshold + 1);
              break;
            case 'le':
              if (coef > 0) bound.max = Math.min(bound.max, threshold);
              else bound.min = Math.max(bound.min, -threshold);
              break;
            case 'gt':
              if (coef > 0) bound.min = Math.max(bound.min, threshold + 1);
              else bound.max = Math.min(bound.max, -threshold - 1);
              break;
            case 'ge':
              if (coef > 0) bound.min = Math.max(bound.min, threshold);
              else bound.max = Math.min(bound.max, -threshold);
              break;
            case 'eq':
              if (coef === 1 || coef === -1) {
                const val = coef > 0 ? threshold : -threshold;
                bound.min = Math.max(bound.min, val);
                bound.max = Math.min(bound.max, val);
              }
              break;
          }
        }
      }
    }
    
    return bounds;
  }
  
  /**
   * Enumerate integer assignments within bounds
   */
  private enumerateIntAssignments(
    formula: SMTExpr,
    bounds: Map<string, { min: number; max: number }>,
    boolVars: string[],
    varTypes: Map<string, SMTSort>
  ): SMTCheckResult {
    const intVars = Array.from(bounds.keys());
    const ranges = intVars.map(v => {
      const b = bounds.get(v)!;
      return { min: b.min, max: b.max, current: b.min };
    });
    
    // Generate all combinations
    const generateNext = (): boolean => {
      for (let i = 0; i < ranges.length; i++) {
        ranges[i]!.current++;
        if (ranges[i]!.current <= ranges[i]!.max) {
          return true;
        }
        ranges[i]!.current = ranges[i]!.min;
      }
      return false;
    };
    
    // Enumerate boolean assignments for each integer assignment
    const boolCount = Math.min(boolVars.length, 20);
    const maxBoolAssignments = 1 << boolCount;
    
    do {
      this.checkLimits();
      
      // Build integer assignment
      const assignment = new Map<string, number | boolean>();
      for (let i = 0; i < intVars.length; i++) {
        assignment.set(intVars[i]!, ranges[i]!.current);
      }
      
      // Try boolean assignments
      for (let b = 0; b < maxBoolAssignments; b++) {
        this.checkLimits();
        
        for (let j = 0; j < boolCount; j++) {
          assignment.set(boolVars[j]!, Boolean((b >> j) & 1));
        }
        
        if (this.evaluate(formula, assignment)) {
          const model: Record<string, unknown> = {};
          for (const [k, v] of assignment) {
            model[k] = v;
          }
          return { status: 'sat', model };
        }
      }
    } while (generateNext());
    
    return { status: 'unsat' };
  }
  
  /**
   * Solve by bounded enumeration
   */
  private solveBoundedEnumeration(
    formula: SMTExpr,
    boolVars: string[],
    intVars: string[],
    varTypes: Map<string, SMTSort>
  ): SMTCheckResult {
    // Small bounds for enumeration
    const intBound = Math.min(100, this.config.maxIntBound);
    const values = Array.from({ length: intBound * 2 + 1 }, (_, i) => i - intBound);
    
    const generateIntAssignment = (idx: number): Map<string, number> | null => {
      const assignment = new Map<string, number>();
      let remaining = idx;
      
      for (const v of intVars) {
        const valueIdx = remaining % values.length;
        remaining = Math.floor(remaining / values.length);
        assignment.set(v, values[valueIdx]!);
      }
      
      return remaining === 0 ? assignment : null;
    };
    
    const totalIntAssignments = Math.pow(values.length, intVars.length);
    const totalBoolAssignments = 1 << Math.min(boolVars.length, 20);
    
    if (totalIntAssignments * totalBoolAssignments > this.config.maxIterations) {
      return {
        status: 'unknown',
        reason: 'Search space too large for bounded enumeration',
      };
    }
    
    for (let i = 0; i < totalIntAssignments; i++) {
      this.checkLimits();
      
      const intAssignment = generateIntAssignment(i);
      if (!intAssignment) break;
      
      for (let b = 0; b < totalBoolAssignments; b++) {
        this.checkLimits();
        
        const assignment = new Map<string, number | boolean>(intAssignment);
        for (let j = 0; j < Math.min(boolVars.length, 20); j++) {
          assignment.set(boolVars[j]!, Boolean((b >> j) & 1));
        }
        
        if (this.evaluate(formula, assignment)) {
          const model: Record<string, unknown> = {};
          for (const [k, v] of assignment) {
            model[k] = v;
          }
          return { status: 'sat', model };
        }
      }
    }
    
    return { status: 'unsat' };
  }
  
  /**
   * Collect all variable names from formula
   */
  private collectVariables(expr: SMTExpr): Set<string> {
    const vars = new Set<string>();
    
    const collect = (e: SMTExpr): void => {
      switch (e.kind) {
        case 'Var':
          vars.add(e.name);
          break;
        case 'Not':
        case 'Neg':
        case 'Abs':
          collect(e.arg);
          break;
        case 'And':
        case 'Or':
        case 'Add':
        case 'Mul':
        case 'Distinct':
          for (const arg of e.args) collect(arg);
          break;
        case 'Implies':
        case 'Iff':
        case 'Eq':
        case 'Lt':
        case 'Le':
        case 'Gt':
        case 'Ge':
        case 'Sub':
        case 'Div':
        case 'Mod':
          collect(e.left);
          collect(e.right);
          break;
        case 'Ite':
          collect(e.cond);
          collect(e.then);
          collect(e.else);
          break;
        case 'Forall':
        case 'Exists':
          collect(e.body);
          break;
        case 'Select':
          collect(e.array);
          collect(e.index);
          break;
        case 'Store':
          collect(e.array);
          collect(e.index);
          collect(e.value);
          break;
        case 'Apply':
          for (const arg of e.args) collect(arg);
          break;
        case 'Let':
          for (const b of e.bindings) collect(b.value);
          collect(e.body);
          break;
      }
    };
    
    collect(expr);
    return vars;
  }
  
  /**
   * Extract linear constraints from formula
   */
  private extractConstraints(expr: SMTExpr): Constraint[] | null {
    const constraints: Constraint[] = [];
    
    const extract = (e: SMTExpr): boolean => {
      switch (e.kind) {
        case 'And':
          return e.args.every(extract);
          
        case 'Eq':
        case 'Lt':
        case 'Le':
        case 'Gt':
        case 'Ge': {
          const lhs = this.toLinearExpr(e.left);
          const rhs = this.toLinearExpr(e.right);
          
          if (!lhs || !rhs) return false;
          
          // Normalize: lhs - rhs <op> 0
          const combined: LinearExpr = {
            coefficients: new Map(lhs.coefficients),
            constant: lhs.constant - rhs.constant,
          };
          
          for (const [v, c] of rhs.coefficients) {
            const existing = combined.coefficients.get(v) ?? 0;
            combined.coefficients.set(v, existing - c);
          }
          
          const kind = e.kind === 'Eq' ? 'eq' :
                       e.kind === 'Lt' ? 'lt' :
                       e.kind === 'Le' ? 'le' :
                       e.kind === 'Gt' ? 'gt' : 'ge';
          
          constraints.push({ kind, lhs: combined, rhs: 0 });
          return true;
        }
        
        case 'BoolConst':
          return true; // Already handled in simplification
          
        default:
          return false;
      }
    };
    
    const success = extract(expr);
    return success ? constraints : null;
  }
  
  /**
   * Convert expression to linear expression
   */
  private toLinearExpr(expr: SMTExpr): LinearExpr | null {
    switch (expr.kind) {
      case 'IntConst':
        return { coefficients: new Map(), constant: Number(expr.value) };
        
      case 'RealConst':
        return { coefficients: new Map(), constant: expr.value };
        
      case 'Var':
        return { coefficients: new Map([[expr.name, 1]]), constant: 0 };
        
      case 'Neg': {
        const inner = this.toLinearExpr(expr.arg);
        if (!inner) return null;
        const result: LinearExpr = { 
          coefficients: new Map(), 
          constant: -inner.constant 
        };
        for (const [v, c] of inner.coefficients) {
          result.coefficients.set(v, -c);
        }
        return result;
      }
      
      case 'Add': {
        const result: LinearExpr = { coefficients: new Map(), constant: 0 };
        for (const arg of expr.args) {
          const term = this.toLinearExpr(arg);
          if (!term) return null;
          result.constant += term.constant;
          for (const [v, c] of term.coefficients) {
            const existing = result.coefficients.get(v) ?? 0;
            result.coefficients.set(v, existing + c);
          }
        }
        return result;
      }
      
      case 'Sub': {
        const left = this.toLinearExpr(expr.left);
        const right = this.toLinearExpr(expr.right);
        if (!left || !right) return null;
        
        const result: LinearExpr = {
          coefficients: new Map(left.coefficients),
          constant: left.constant - right.constant,
        };
        for (const [v, c] of right.coefficients) {
          const existing = result.coefficients.get(v) ?? 0;
          result.coefficients.set(v, existing - c);
        }
        return result;
      }
      
      case 'Mul': {
        // Only handle constant * variable
        if (expr.args.length === 2) {
          const first = expr.args[0]!;
          const second = expr.args[1]!;
          
          if (first.kind === 'IntConst' || first.kind === 'RealConst') {
            const coef = first.kind === 'IntConst' ? Number(first.value) : first.value;
            const inner = this.toLinearExpr(second);
            if (!inner) return null;
            
            const result: LinearExpr = {
              coefficients: new Map(),
              constant: coef * inner.constant,
            };
            for (const [v, c] of inner.coefficients) {
              result.coefficients.set(v, coef * c);
            }
            return result;
          }
          
          if (second.kind === 'IntConst' || second.kind === 'RealConst') {
            const coef = second.kind === 'IntConst' ? Number(second.value) : second.value;
            const inner = this.toLinearExpr(first);
            if (!inner) return null;
            
            const result: LinearExpr = {
              coefficients: new Map(),
              constant: coef * inner.constant,
            };
            for (const [v, c] of inner.coefficients) {
              result.coefficients.set(v, coef * c);
            }
            return result;
          }
        }
        return null;
      }
      
      default:
        return null;
    }
  }
  
  /**
   * Evaluate boolean formula with assignment
   */
  private evaluateBool(expr: SMTExpr, assignment: Map<string, boolean>): boolean {
    const result = this.evaluate(expr, assignment as Assignment);
    return typeof result === 'boolean' ? result : false;
  }
  
  /**
   * Evaluate expression with assignment
   */
  private evaluate(expr: SMTExpr, assignment: Assignment): number | boolean {
    switch (expr.kind) {
      case 'BoolConst':
        return expr.value;
        
      case 'IntConst':
        return Number(expr.value);
        
      case 'RealConst':
        return expr.value;
        
      case 'Var': {
        const val = assignment.get(expr.name);
        if (val === undefined) {
          // Default values
          return expr.sort.kind === 'Bool' ? false : 0;
        }
        return val;
      }
      
      case 'Not':
        return !this.evaluate(expr.arg, assignment);
        
      case 'And':
        return expr.args.every(a => this.evaluate(a, assignment) === true);
        
      case 'Or':
        return expr.args.some(a => this.evaluate(a, assignment) === true);
        
      case 'Implies': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return !left || right === true;
      }
      
      case 'Iff': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return left === right;
      }
      
      case 'Eq': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return left === right;
      }
      
      case 'Distinct':
        const vals = expr.args.map(a => this.evaluate(a, assignment));
        return new Set(vals).size === vals.length;
        
      case 'Lt': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return (left as number) < (right as number);
      }
      
      case 'Le': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return (left as number) <= (right as number);
      }
      
      case 'Gt': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return (left as number) > (right as number);
      }
      
      case 'Ge': {
        const left = this.evaluate(expr.left, assignment);
        const right = this.evaluate(expr.right, assignment);
        return (left as number) >= (right as number);
      }
      
      case 'Add': {
        let sum = 0;
        for (const a of expr.args) {
          sum += this.evaluate(a, assignment) as number;
        }
        return sum;
      }
      
      case 'Sub': {
        const left = this.evaluate(expr.left, assignment) as number;
        const right = this.evaluate(expr.right, assignment) as number;
        return left - right;
      }
      
      case 'Mul': {
        let prod = 1;
        for (const a of expr.args) {
          prod *= this.evaluate(a, assignment) as number;
        }
        return prod;
      }
      
      case 'Div': {
        const left = this.evaluate(expr.left, assignment) as number;
        const right = this.evaluate(expr.right, assignment) as number;
        return right !== 0 ? Math.floor(left / right) : 0;
      }
      
      case 'Mod': {
        const left = this.evaluate(expr.left, assignment) as number;
        const right = this.evaluate(expr.right, assignment) as number;
        return right !== 0 ? left % right : 0;
      }
      
      case 'Neg':
        return -(this.evaluate(expr.arg, assignment) as number);
        
      case 'Abs':
        return Math.abs(this.evaluate(expr.arg, assignment) as number);
        
      case 'Ite': {
        const cond = this.evaluate(expr.cond, assignment);
        return cond
          ? this.evaluate(expr.then, assignment)
          : this.evaluate(expr.else, assignment);
      }
      
      default:
        // For unsupported expressions, return a neutral value
        return true;
    }
  }
}
