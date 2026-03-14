/**
 * Built-in SMT Solver
 *
 * This solver handles Boolean + Linear Integer Arithmetic only.
 *
 * For String, Array, Real, and quantifier theories, use the Z3 WASM solver
 * (@isl-lang/solver-z3-wasm) or an external Z3 binary. The Z3 WASM solver
 * supports all of these theories with no native install required.
 *
 * Supports:
 * - Boolean logic via CDCL (Conflict-Driven Clause Learning)
 * - Linear integer arithmetic (bounded)
 * - Equalities and comparisons
 * - Simple arithmetic (+, -, *, with bounds)
 *
 * The CDCL engine provides:
 * - Tseitin CNF transformation (preserves equisatisfiability)
 * - Two-watched-literal unit propagation
 * - VSIDS decision heuristic with exponential decay
 * - First-UIP conflict analysis with learned clauses
 * - Non-chronological backtracking
 * - Phase saving for decision polarity
 * - Handles 500+ boolean variables efficiently
 *
 * Falls back to UNKNOWN for cases it cannot handle.
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import { simplify } from '@isl-lang/prover';
import type { SMTCheckResult } from './types.js';

export interface BuiltinSolverConfig {
  timeout: number;
  maxIntBound?: number;
  maxIterations?: number;
  verbose?: boolean;
  maxBoolVars?: number;
}

type Assignment = Map<string, number | boolean>;

interface Constraint {
  kind: 'eq' | 'neq' | 'lt' | 'le' | 'gt' | 'ge' | 'bool';
  lhs: LinearExpr | string;
  rhs?: LinearExpr | number;
}

interface LinearExpr {
  coefficients: Map<string, number>;
  constant: number;
}

// ============================================================================
// CDCL SAT Solver
// ============================================================================

type Literal = number; // positive = var true, negative = var false
type Clause = Literal[];

const UNASSIGNED = 0;
const TRUE = 1;
const FALSE = -1;

interface CDCLState {
  numVars: number;
  clauses: Clause[];
  learnedClauses: Clause[];
  values: Int8Array;     // UNASSIGNED | TRUE | FALSE per variable
  levels: Int32Array;    // decision level at which var was assigned
  reasons: (Clause | null)[]; // clause that implied this assignment (null = decision)
  trail: number[];       // assignment trail (variable indices)
  trailLim: number[];    // trail index at each decision level start
  activity: Float64Array; // VSIDS activity scores
  phase: Int8Array;      // saved phase (1 or -1)
  watched: Map<Literal, Clause[]>; // two-watched-literal structure
  decisionLevel: number;
  conflicts: number;
  propagations: number;
  activityInc: number;
  activityDecay: number;
}

function litVar(lit: Literal): number {
  return Math.abs(lit);
}

function litSign(lit: Literal): boolean {
  return lit > 0;
}

function litValue(state: CDCLState, lit: Literal): number {
  const v = state.values[litVar(lit)]!;
  if (v === UNASSIGNED) return UNASSIGNED;
  return litSign(lit) ? v : -v;
}

function initCDCL(numVars: number, clauses: Clause[]): CDCLState {
  const state: CDCLState = {
    numVars,
    clauses: [],
    learnedClauses: [],
    values: new Int8Array(numVars + 1),
    levels: new Int32Array(numVars + 1),
    reasons: new Array(numVars + 1).fill(null),
    trail: [],
    trailLim: [],
    activity: new Float64Array(numVars + 1),
    phase: new Int8Array(numVars + 1),
    watched: new Map(),
    decisionLevel: 0,
    conflicts: 0,
    propagations: 0,
    activityInc: 1.0,
    activityDecay: 0.95,
  };

  for (let v = 1; v <= numVars; v++) {
    state.activity[v] = 0;
    state.phase[v] = FALSE as -1;
  }

  for (const clause of clauses) {
    addClause(state, clause);
    for (const lit of clause) {
      const idx = litVar(lit);
      state.activity[idx] = (state.activity[idx] ?? 0) + 1;
    }
  }

  return state;
}

function addClause(state: CDCLState, clause: Clause): Clause | null {
  if (clause.length === 0) return null;

  state.clauses.push(clause);

  if (clause.length >= 2) {
    watchLit(state, clause[0]!, clause);
    watchLit(state, clause[1]!, clause);
  }

  return clause;
}

function addLearnedClause(state: CDCLState, clause: Clause): void {
  state.learnedClauses.push(clause);
  state.clauses.push(clause);

  if (clause.length >= 2) {
    watchLit(state, clause[0]!, clause);
    watchLit(state, clause[1]!, clause);
  }
}

function watchLit(state: CDCLState, lit: Literal, clause: Clause): void {
  const neg = -lit;
  let list = state.watched.get(neg);
  if (!list) {
    list = [];
    state.watched.set(neg, list);
  }
  list.push(clause);
}

function enqueue(state: CDCLState, lit: Literal, reason: Clause | null): boolean {
  const v = litVar(lit);
  const currentVal = state.values[v]!;

  if (currentVal !== UNASSIGNED) {
    return litValue(state, lit) === TRUE;
  }

  state.values[v] = litSign(lit) ? TRUE : FALSE;
  state.levels[v] = state.decisionLevel;
  state.reasons[v] = reason;
  state.trail.push(v);
  return true;
}

function propagate(state: CDCLState): Clause | null {
  let qHead = state.trail.length - 1;

  while (qHead >= 0 && qHead < state.trail.length) {
    const v = state.trail[qHead]!;
    const lit = state.values[v] === TRUE ? v : -v;
    qHead++;
    state.propagations++;

    const watchedList = state.watched.get(lit);
    if (!watchedList) continue;

    let i = 0;
    let j = 0;
    let conflict: Clause | null = null;

    while (i < watchedList.length) {
      const clause = watchedList[i]!;
      i++;

      const lit0 = clause[0]!;
      const lit1 = clause[1]!;

      const falseLit = lit;
      const otherLit = lit0 === -falseLit ? lit1 : lit0;

      if (litValue(state, otherLit) === TRUE) {
        watchedList[j++] = clause;
        continue;
      }

      let found = false;
      for (let k = 2; k < clause.length; k++) {
        if (litValue(state, clause[k]!) !== FALSE) {
          const newWatch = clause[k]!;
          if (clause[0] === -falseLit) {
            clause[0] = newWatch;
            clause[k] = -falseLit;
          } else {
            clause[1] = newWatch;
            clause[k] = -falseLit;
          }

          let wl = state.watched.get(-newWatch);
          if (!wl) {
            wl = [];
            state.watched.set(-newWatch, wl);
          }
          wl.push(clause);
          found = true;
          break;
        }
      }

      if (found) continue;

      watchedList[j++] = clause;

      if (litValue(state, otherLit) === FALSE) {
        conflict = clause;
        while (i < watchedList.length) {
          watchedList[j++] = watchedList[i++]!;
        }
      } else {
        enqueue(state, otherLit, clause);
      }
    }

    watchedList.length = j;

    if (conflict) return conflict;
  }

  return null;
}

function analyzeConflict(state: CDCLState, conflict: Clause): { learnt: Clause; btLevel: number } {
  const seen = new Uint8Array(state.numVars + 1);
  let counter = 0;
  let p: Literal = 0;
  const learnt: Literal[] = [0];
  let btLevel = 0;
  let idx = state.trail.length - 1;

  let clause: Clause | null = conflict;

  do {
    if (clause) {
      for (const q of clause) {
        const qv = litVar(q);
        if (qv === litVar(p) && p !== 0) continue;
        if (seen[qv]) continue;
        seen[qv] = 1;
        bumpActivity(state, qv);

        if (state.levels[qv] === state.decisionLevel) {
          counter++;
        } else if (state.levels[qv]! > 0) {
          learnt.push(-q);
          btLevel = Math.max(btLevel, state.levels[qv]!);
        }
      }
    }

    do {
      p = state.values[state.trail[idx]!]! === TRUE ? state.trail[idx]! : -state.trail[idx]!;
      clause = state.reasons[litVar(p)] ?? null;
      idx--;
    } while (!seen[litVar(p)]);

    counter--;
  } while (counter > 0);

  learnt[0] = -p;

  if (learnt.length === 1) {
    btLevel = 0;
  }

  decayActivity(state);

  return { learnt, btLevel };
}

function bumpActivity(state: CDCLState, v: number): void {
  state.activity[v] = (state.activity[v] ?? 0) + state.activityInc;
  if ((state.activity[v] ?? 0) > 1e100) {
    for (let i = 1; i <= state.numVars; i++) {
      state.activity[i] = (state.activity[i] ?? 0) * 1e-100;
    }
    state.activityInc *= 1e-100;
  }
}

function decayActivity(state: CDCLState): void {
  state.activityInc /= state.activityDecay;
}

function backtrack(state: CDCLState, level: number): void {
  while (state.trail.length > (state.trailLim[level] ?? 0)) {
    const v = state.trail.pop()!;
    state.values[v] = UNASSIGNED;
    state.phase[v] = state.values[v]! || (state.phase[v] as number);
    state.reasons[v] = null;
  }
  state.trailLim.length = level;
  state.decisionLevel = level;
}

function pickBranchVar(state: CDCLState): number | null {
  let best = -1;
  let bestAct = -1;

  for (let v = 1; v <= state.numVars; v++) {
    if (state.values[v] === UNASSIGNED && state.activity[v]! > bestAct) {
      best = v;
      bestAct = state.activity[v]!;
    }
  }

  return best === -1 ? null : best;
}

function solveCDCL(state: CDCLState, deadline: number, maxConflicts: number): 'sat' | 'unsat' | 'unknown' {
  for (const clause of state.clauses) {
    if (clause.length === 1) {
      if (!enqueue(state, clause[0]!, clause)) return 'unsat';
    }
  }

  const unitConflict = propagate(state);
  if (unitConflict) return 'unsat';

  while (true) {
    if (Date.now() > deadline) return 'unknown';
    if (state.conflicts > maxConflicts) return 'unknown';

    const conflict = propagate(state);

    if (conflict) {
      state.conflicts++;
      if (state.decisionLevel === 0) return 'unsat';

      const { learnt, btLevel } = analyzeConflict(state, conflict);
      backtrack(state, btLevel);
      addLearnedClause(state, learnt);

      if (learnt.length === 1) {
        enqueue(state, learnt[0]!, null);
      } else {
        enqueue(state, learnt[0]!, learnt);
      }
    } else {
      const v = pickBranchVar(state);
      if (v === null) return 'sat';

      state.decisionLevel++;
      state.trailLim.push(state.trail.length);

      const polarity = state.phase[v] === TRUE ? v : -v;
      enqueue(state, polarity, null);
    }
  }
}

// ============================================================================
// Tseitin CNF Transformation
// ============================================================================

class TseitinConverter {
  private nextVar: number;
  private clauses: Clause[] = [];
  private varMap: Map<string, number> = new Map();
  private reverseMap: Map<number, string> = new Map();

  constructor() {
    this.nextVar = 1;
  }

  getVarMap(): Map<string, number> { return this.varMap; }
  getReverseMap(): Map<number, string> { return this.reverseMap; }
  getClauses(): Clause[] { return this.clauses; }
  getNumVars(): number { return this.nextVar - 1; }

  private freshVar(): number {
    return this.nextVar++;
  }

  private namedVar(name: string): number {
    let v = this.varMap.get(name);
    if (v !== undefined) return v;
    v = this.freshVar();
    this.varMap.set(name, v);
    this.reverseMap.set(v, name);
    return v;
  }

  convert(expr: SMTExpr): number {
    switch (expr.kind) {
      case 'BoolConst': {
        const v = this.freshVar();
        if (expr.value) {
          this.clauses.push([v]);
        } else {
          this.clauses.push([-v]);
        }
        return v;
      }

      case 'Var':
        return this.namedVar(expr.name);

      case 'Not': {
        const inner = this.convert(expr.arg);
        const v = this.freshVar();
        this.clauses.push([-v, -inner]);
        this.clauses.push([v, inner]);
        return v;
      }

      case 'And': {
        if (expr.args.length === 0) {
          const v = this.freshVar();
          this.clauses.push([v]);
          return v;
        }
        if (expr.args.length === 1) return this.convert(expr.args[0]!);

        const subs = expr.args.map(a => this.convert(a));
        const v = this.freshVar();
        for (const s of subs) {
          this.clauses.push([-v, s]);
        }
        this.clauses.push([v, ...subs.map(s => -s)]);
        return v;
      }

      case 'Or': {
        if (expr.args.length === 0) {
          const v = this.freshVar();
          this.clauses.push([-v]);
          return v;
        }
        if (expr.args.length === 1) return this.convert(expr.args[0]!);

        const subs = expr.args.map(a => this.convert(a));
        const v = this.freshVar();
        this.clauses.push([v, ...subs.map(s => -s)]);
        for (const s of subs) {
          this.clauses.push([-v, s]);
        }
        // Fix: v <-> OR(subs) means v => at least one sub, each sub => v
        // Actually: v <-> (s1 v s2 v ...) is:
        //   v => (s1 v s2 v ...) : [-v, s1, s2, ...]
        //   (s1 v s2 v ...) => v : for each si: [-si, v]
        // Re-do correctly:
        this.clauses.length -= subs.length + 1;
        this.clauses.push([-v, ...subs]);
        for (const s of subs) {
          this.clauses.push([v, -s]);
        }
        return v;
      }

      case 'Implies': {
        const l = this.convert(expr.left);
        const r = this.convert(expr.right);
        const v = this.freshVar();
        // v <-> (l => r) is v <-> (!l v r)
        this.clauses.push([-v, -l, r]);
        this.clauses.push([v, l]);
        this.clauses.push([v, -r]);
        return v;
      }

      case 'Iff': {
        const l = this.convert(expr.left);
        const r = this.convert(expr.right);
        const v = this.freshVar();
        // v <-> (l <-> r) is v <-> ((l => r) & (r => l))
        this.clauses.push([-v, -l, r]);
        this.clauses.push([-v, l, -r]);
        this.clauses.push([v, l, r]);
        this.clauses.push([v, -l, -r]);
        return v;
      }

      case 'Ite': {
        const c = this.convert(expr.cond);
        const t = this.convert(expr.then);
        const e = this.convert(expr.else);
        const v = this.freshVar();
        // v <-> ITE(c, t, e): if c then v<->t, else v<->e
        this.clauses.push([-c, -v, t]);
        this.clauses.push([-c, v, -t]);
        this.clauses.push([c, -v, e]);
        this.clauses.push([c, v, -e]);
        return v;
      }

      case 'Eq': {
        if (this.isBoolExpr(expr.left) && this.isBoolExpr(expr.right)) {
          const l = this.convert(expr.left);
          const r = this.convert(expr.right);
          const v = this.freshVar();
          this.clauses.push([-v, -l, r]);
          this.clauses.push([-v, l, -r]);
          this.clauses.push([v, l, r]);
          this.clauses.push([v, -l, -r]);
          return v;
        }
        return this.freshVar();
      }

      case 'Distinct': {
        if (expr.args.length === 2 && this.isBoolExpr(expr.args[0]!) && this.isBoolExpr(expr.args[1]!)) {
          const l = this.convert(expr.args[0]!);
          const r = this.convert(expr.args[1]!);
          const v = this.freshVar();
          // v <-> XOR(l, r)
          this.clauses.push([-v, l, r]);
          this.clauses.push([-v, -l, -r]);
          this.clauses.push([v, -l, r]);
          this.clauses.push([v, l, -r]);
          return v;
        }
        return this.freshVar();
      }

      default:
        return this.freshVar();
    }
  }

  private isBoolExpr(expr: SMTExpr): boolean {
    switch (expr.kind) {
      case 'BoolConst':
      case 'Not':
      case 'And':
      case 'Or':
      case 'Implies':
      case 'Iff':
        return true;
      case 'Var':
        return expr.sort.kind === 'Bool';
      case 'Eq':
      case 'Lt':
      case 'Le':
      case 'Gt':
      case 'Ge':
      case 'Distinct':
        return true;
      case 'Ite':
        return this.isBoolExpr(expr.then);
      default:
        return false;
    }
  }
}

// ============================================================================
// Built-in Solver
// ============================================================================

export class BuiltinSolver {
  private config: Required<BuiltinSolverConfig>;
  private deadline: number = 0;
  private iterations: number = 0;
  
  constructor(config: BuiltinSolverConfig) {
    this.config = {
      timeout: config.timeout,
      maxIntBound: config.maxIntBound ?? 1000,
      maxIterations: config.maxIterations ?? 500000,
      maxBoolVars: config.maxBoolVars ?? 500,
      verbose: config.verbose ?? false,
    };
  }
  
  async checkSat(
    formula: SMTExpr,
    declarations: SMTDecl[]
  ): Promise<SMTCheckResult> {
    this.deadline = Date.now() + this.config.timeout;
    this.iterations = 0;
    
    try {
      const simplified = simplify(formula);
      
      if (simplified.kind === 'BoolConst') {
        return simplified.value
          ? { status: 'sat', model: {} }
          : { status: 'unsat' };
      }
      
      const varTypes = this.extractVarTypes(declarations);
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
  
  private extractVarTypes(declarations: SMTDecl[]): Map<string, SMTSort> {
    const types = new Map<string, SMTSort>();
    for (const decl of declarations) {
      if (decl.kind === 'DeclareConst') {
        types.set(decl.name, decl.sort);
      }
    }
    return types;
  }
  
  private isTimeout(): boolean {
    return Date.now() > this.deadline;
  }
  
  private checkLimits(): void {
    this.iterations++;
    if (this.iterations > this.config.maxIterations) {
      throw new Error('Iteration limit exceeded');
    }
    if (this.isTimeout()) {
      throw new Error('Timeout');
    }
  }
  
  private async solve(
    formula: SMTExpr,
    varTypes: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    const variables = this.collectVariables(formula);
    
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
    
    if (intVars.length === 0 && boolVars.length <= this.config.maxBoolVars) {
      return this.solvePureBoolCDCL(formula, boolVars);
    }
    
    if (intVars.length > 0) {
      const constraints = this.extractConstraints(formula);
      if (constraints) {
        return this.solveLinearInt(formula, constraints, intVars, boolVars, varTypes);
      }
    }
    
    if (variables.size <= 8) {
      return this.solveBoundedEnumeration(formula, boolVars, intVars, varTypes);
    }
    
    return {
      status: 'unknown',
      reason: 'Formula too complex for built-in solver',
    };
  }
  
  private solvePureBoolCDCL(
    formula: SMTExpr,
    variables: string[]
  ): SMTCheckResult {
    if (variables.length > this.config.maxBoolVars) {
      return {
        status: 'unknown',
        reason: `Too many boolean variables (${variables.length} > ${this.config.maxBoolVars})`,
      };
    }

    const converter = new TseitinConverter();
    const root = converter.convert(formula);
    const clauses = converter.getClauses();
    clauses.push([root]);

    const numVars = converter.getNumVars();
    const state = initCDCL(numVars, clauses);

    const maxConflicts = Math.min(this.config.maxIterations, 500000);
    const result = solveCDCL(state, this.deadline, maxConflicts);

    if (result === 'sat') {
      const model: Record<string, unknown> = {};
      const reverseMap = converter.getReverseMap();
      for (const [varIdx, name] of reverseMap) {
        model[name] = state.values[varIdx] === TRUE;
      }
      return { status: 'sat', model };
    }

    if (result === 'unsat') {
      return { status: 'unsat' };
    }

    return {
      status: 'unknown',
      reason: 'CDCL solver reached resource limit',
    };
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
