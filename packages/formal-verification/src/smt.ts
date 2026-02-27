/**
 * SMT Solver Interface
 * 
 * Interface to SMT solvers (Z3, CVC5, etc.)
 * 
 * Modes:
 * - REAL: Uses actual SMT solver via @isl-lang/isl-smt (recommended)
 * - DEMO: Uses simulateSolve() for basic demos (explicitly labeled, no formal guarantees)
 * 
 * The DEMO mode is ONLY for:
 * - Quick demos without solver installation
 * - Development/testing of the verification pipeline
 * - Fallback when no solver is available
 * 
 * For production verification, ALWAYS use REAL mode with Z3 or CVC5.
 */

import type { Formula, Sort, VerifierConfig, Variable } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SMTResult {
  sat: boolean | null;
  model?: Record<string, unknown>;
  reason?: string;
  stats?: SMTStats;
  /** Whether this result came from a real solver or simulation */
  source: 'real_solver' | 'demo_simulation';
  /** Solver used (if real) */
  solver?: 'z3' | 'cvc5' | 'builtin';
}

export interface SMTStats {
  decisions: number;
  conflicts: number;
  propagations: number;
  memoryUsed: number;
  timeElapsed: number;
}

/**
 * SMT solver mode
 */
export type SolverMode = 'real' | 'demo';

/**
 * Extended config with solver mode
 */
export interface SMTSolverConfig extends Omit<VerifierConfig, 'solver'> {
  solver: 'z3' | 'cvc5' | 'builtin' | 'auto';
  /** 
   * Solver mode: 
   * - 'real': Use actual SMT solver (recommended for production)
   * - 'demo': Use simulateSolve (for demos only, no formal guarantees)
   */
  mode?: SolverMode;
}

// ============================================================================
// Real Solver Integration
// ============================================================================

/**
 * Lazy-loaded isl-smt module
 */
let islSmt: typeof import('@isl-lang/isl-smt') | null = null;

/**
 * Load the isl-smt module
 */
async function loadIslSmt(): Promise<typeof import('@isl-lang/isl-smt') | null> {
  if (islSmt !== null) return islSmt;
  
  try {
    islSmt = await import('@isl-lang/isl-smt');
    return islSmt;
  } catch {
    // Module not available
    return null;
  }
}

/**
 * Convert local Formula type to SMT expression
 */
function formulaToSMTExpr(
  formula: Formula,
  smt: typeof import('@isl-lang/isl-smt')
): import('@isl-lang/prover').SMTExpr {
  const { Expr, Sort } = smt;
  
  const sortToSmtSort = (s: Sort): import('@isl-lang/prover').SMTSort => {
    switch (s.kind) {
      case 'bool': return Sort.Bool();
      case 'int': return Sort.Int();
      case 'real': return Sort.Real();
      case 'string': return Sort.String();
      case 'bitvec': return Sort.BitVec(s.width);
      case 'array': return Sort.Array(sortToSmtSort(s.index), sortToSmtSort(s.element));
      default: return Sort.Int(); // Default to Int
    }
  };
  
  const convert = (f: Formula): import('@isl-lang/prover').SMTExpr => {
    switch (f.kind) {
      case 'const':
        if (typeof f.value === 'boolean') return Expr.bool(f.value);
        if (typeof f.value === 'number') {
          return Number.isInteger(f.value) ? Expr.int(BigInt(f.value)) : Expr.real(f.value);
        }
        return Expr.string(String(f.value));
      
      case 'var':
        return Expr.var(f.name, sortToSmtSort(f.sort));
      
      case 'not':
        return Expr.not(convert(f.arg));
      
      case 'and':
        if (f.args.length === 0) return Expr.bool(true);
        if (f.args.length === 1 && f.args[0]) return convert(f.args[0]);
        return Expr.and(...f.args.map(convert));
      
      case 'or':
        if (f.args.length === 0) return Expr.bool(false);
        if (f.args.length === 1 && f.args[0]) return convert(f.args[0]);
        return Expr.or(...f.args.map(convert));
      
      case 'implies':
        return Expr.implies(convert(f.left), convert(f.right));
      
      case 'iff':
        return Expr.iff(convert(f.left), convert(f.right));
      
      case 'forall':
        return Expr.forall(
          f.vars.map(v => ({ name: v.name, sort: sortToSmtSort(v.sort) })),
          convert(f.body)
        );
      
      case 'exists':
        return Expr.exists(
          f.vars.map(v => ({ name: v.name, sort: sortToSmtSort(v.sort) })),
          convert(f.body)
        );
      
      case 'eq':
        return Expr.eq(convert(f.left), convert(f.right));
      
      case 'lt':
        return Expr.lt(convert(f.left), convert(f.right));
      
      case 'le':
        return Expr.le(convert(f.left), convert(f.right));
      
      case 'gt':
        return Expr.gt(convert(f.left), convert(f.right));
      
      case 'ge':
        return Expr.ge(convert(f.left), convert(f.right));
      
      case 'add':
        if (f.args.length === 0) return Expr.int(0n);
        if (f.args.length === 1 && f.args[0]) return convert(f.args[0]);
        return Expr.add(...f.args.map(convert));
      
      case 'sub':
        return Expr.sub(convert(f.left), convert(f.right));
      
      case 'mul':
        if (f.args.length === 0) return Expr.int(1n);
        if (f.args.length === 1 && f.args[0]) return convert(f.args[0]);
        return Expr.mul(...f.args.map(convert));
      
      case 'div':
        return Expr.div(convert(f.left), convert(f.right));
      
      case 'mod':
        return Expr.mod(convert(f.left), convert(f.right));
      
      case 'ite':
        return Expr.ite(convert(f.cond), convert(f.then), convert(f.else));
      
      case 'select':
        return Expr.select(convert(f.array), convert(f.index));
      
      case 'store':
        return Expr.store(convert(f.array), convert(f.index), convert(f.value));
      
      case 'app':
        return Expr.apply(f.func, f.args.map(convert));
      
      default:
        return Expr.bool(true);
    }
  };
  
  return convert(formula);
}

/**
 * Check satisfiability using real SMT solver
 */
async function checkSatReal(
  formula: Formula,
  config: SMTSolverConfig
): Promise<SMTResult> {
  const smt = await loadIslSmt();
  
  if (!smt) {
    // Fall back to demo mode if isl-smt not available
    return {
      sat: null,
      reason: 'isl-smt module not available, falling back to demo mode',
      source: 'demo_simulation',
    };
  }
  
  const startTime = Date.now();
  
  try {
    // Determine which solver to use
    let solver: 'builtin' | 'z3' | 'cvc5' = 'builtin';
    
    if (config.solver === 'auto') {
      const availability = await smt.getSolverAvailability();
      solver = availability.bestAvailable === 'builtin' ? 'builtin' : availability.bestAvailable;
    } else if (config.solver !== 'builtin') {
      // Check if requested solver is available
      const isAvailable = config.solver === 'z3' 
        ? await smt.isZ3Available()
        : await smt.isCVC5Available();
      
      if (isAvailable) {
        solver = config.solver;
      } else if (config.verbose) {
        console.log(`[SMT] ${config.solver.toUpperCase()} not available, using builtin solver`);
      }
    }
    
    // Convert formula to SMT expression
    const smtExpr = formulaToSMTExpr(formula, smt);
    
    // Create solver and check
    const smtSolver = smt.createSolver({
      timeout: config.timeout,
      solver,
      verbose: config.verbose,
      produceModels: true,
    });
    
    const result = await smtSolver.checkSat(smtExpr, []);
    
    const elapsed = Date.now() - startTime;
    
    // Convert result
    switch (result.status) {
      case 'sat':
        return {
          sat: true,
          model: result.model,
          source: 'real_solver',
          solver,
          stats: {
            decisions: 0,
            conflicts: 0,
            propagations: 0,
            memoryUsed: 0,
            timeElapsed: elapsed,
          },
        };
      
      case 'unsat':
        return {
          sat: false,
          source: 'real_solver',
          solver,
          stats: {
            decisions: 0,
            conflicts: 0,
            propagations: 0,
            memoryUsed: 0,
            timeElapsed: elapsed,
          },
        };
      
      case 'timeout':
        return {
          sat: null,
          reason: 'Solver timeout',
          source: 'real_solver',
          solver,
          stats: {
            decisions: 0,
            conflicts: 0,
            propagations: 0,
            memoryUsed: 0,
            timeElapsed: elapsed,
          },
        };
      
      case 'unknown':
        return {
          sat: null,
          reason: result.reason || 'Solver returned unknown',
          source: 'real_solver',
          solver,
          stats: {
            decisions: 0,
            conflicts: 0,
            propagations: 0,
            memoryUsed: 0,
            timeElapsed: elapsed,
          },
        };
      
      case 'error':
        return {
          sat: null,
          reason: `Solver error: ${result.message}`,
          source: 'real_solver',
          solver,
        };
    }
  } catch (error) {
    return {
      sat: null,
      reason: `Solver error: ${error instanceof Error ? error.message : String(error)}`,
      source: 'real_solver',
    };
  }
}

// ============================================================================
// SMT Solver Wrapper
// ============================================================================

/**
 * SMT Solver wrapper
 * 
 * Provides a unified interface to SMT solving with:
 * - Real solver mode (uses Z3/CVC5 via isl-smt)
 * - Demo mode (uses simulateSolve for basic demos)
 */
export class SMTSolver {
  private config: SMTSolverConfig;
  private mode: SolverMode;

  constructor(config: VerifierConfig | SMTSolverConfig) {
    // Convert VerifierConfig to SMTSolverConfig
    this.config = {
      ...config,
      solver: 'solver' in config ? 
        (config.solver === 'yices' ? 'z3' : config.solver) as 'z3' | 'cvc5' | 'builtin' | 'auto' :
        'auto',
      mode: 'mode' in config ? (config as SMTSolverConfig).mode : 'real',
    };
    this.mode = this.config.mode ?? 'real';
  }

  /**
   * Check satisfiability of a formula
   */
  async checkSat(formula: Formula): Promise<SMTResult> {
    const smtlib = this.toSMTLIB(formula);

    if (this.config.verbose) {
      console.log('[SMT] Query:', smtlib);
      console.log('[SMT] Mode:', this.mode);
    }

    // Use real solver in real mode
    if (this.mode === 'real') {
      const result = await checkSatReal(formula, this.config);
      
      // If real solver failed to load, fall back to demo with warning
      if (result.reason?.includes('not available') && this.config.verbose) {
        console.warn('[SMT] WARNING: Using demo simulation - results have no formal guarantees');
        return this.simulateSolve(formula);
      }
      
      return result;
    }

    // Demo mode - explicitly requested simulation
    if (this.config.verbose) {
      console.warn('[SMT] WARNING: Demo mode - results have no formal guarantees');
    }
    return this.simulateSolve(formula);
  }

  /**
   * Check validity (formula is true for all assignments)
   */
  async checkValid(formula: Formula): Promise<SMTResult> {
    // Valid iff negation is unsat
    const negated: Formula = { kind: 'not', arg: formula };
    const result = await this.checkSat(negated);

    return {
      ...result,
      sat: result.sat === false ? true : result.sat === true ? false : null,
    };
  }

  /**
   * Get a model (satisfying assignment)
   */
  async getModel(formula: Formula): Promise<Record<string, unknown> | null> {
    const result = await this.checkSat(formula);
    return result.sat ? result.model || {} : null;
  }

  /**
   * Convert formula to SMT-LIB format
   */
  toSMTLIB(formula: Formula): string {
    const declarations = this.collectDeclarations(formula);
    const assertions = this.formulaToSMTLIB(formula);

    return [
      '; ISL Verification Query',
      '(set-logic ALL)',
      '',
      '; Declarations',
      ...declarations,
      '',
      '; Assertions',
      `(assert ${assertions})`,
      '',
      '(check-sat)',
      '(get-model)',
    ].join('\n');
  }

  /**
   * Convert formula to SMT-LIB expression
   */
  private formulaToSMTLIB(formula: Formula): string {
    switch (formula.kind) {
      case 'const':
        if (typeof formula.value === 'boolean') {
          return formula.value ? 'true' : 'false';
        }
        if (typeof formula.value === 'number') {
          return formula.value.toString();
        }
        return `"${formula.value}"`;

      case 'var':
        return formula.name;

      case 'not':
        return `(not ${this.formulaToSMTLIB(formula.arg)})`;

      case 'and':
        if (formula.args.length === 0) return 'true';
        if (formula.args.length === 1 && formula.args[0]) return this.formulaToSMTLIB(formula.args[0]);
        return `(and ${formula.args.map((a) => this.formulaToSMTLIB(a)).join(' ')})`;

      case 'or':
        if (formula.args.length === 0) return 'false';
        if (formula.args.length === 1 && formula.args[0]) return this.formulaToSMTLIB(formula.args[0]);
        return `(or ${formula.args.map((a) => this.formulaToSMTLIB(a)).join(' ')})`;

      case 'implies':
        return `(=> ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'iff':
        return `(= ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'forall':
        const forallVars = formula.vars.map((v) => `(${v.name} ${this.sortToSMTLIB(v.sort)})`).join(' ');
        return `(forall (${forallVars}) ${this.formulaToSMTLIB(formula.body)})`;

      case 'exists':
        const existsVars = formula.vars.map((v) => `(${v.name} ${this.sortToSMTLIB(v.sort)})`).join(' ');
        return `(exists (${existsVars}) ${this.formulaToSMTLIB(formula.body)})`;

      case 'eq':
        return `(= ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'lt':
        return `(< ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'le':
        return `(<= ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'gt':
        return `(> ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'ge':
        return `(>= ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'add':
        return `(+ ${formula.args.map((a) => this.formulaToSMTLIB(a)).join(' ')})`;

      case 'sub':
        return `(- ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'mul':
        return `(* ${formula.args.map((a) => this.formulaToSMTLIB(a)).join(' ')})`;

      case 'div':
        return `(div ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'mod':
        return `(mod ${this.formulaToSMTLIB(formula.left)} ${this.formulaToSMTLIB(formula.right)})`;

      case 'ite':
        return `(ite ${this.formulaToSMTLIB(formula.cond)} ${this.formulaToSMTLIB(formula.then)} ${this.formulaToSMTLIB(formula.else)})`;

      case 'select':
        return `(select ${this.formulaToSMTLIB(formula.array)} ${this.formulaToSMTLIB(formula.index)})`;

      case 'store':
        return `(store ${this.formulaToSMTLIB(formula.array)} ${this.formulaToSMTLIB(formula.index)} ${this.formulaToSMTLIB(formula.value)})`;

      case 'app':
        if (formula.args.length === 0) return formula.func;
        return `(${formula.func} ${formula.args.map((a) => this.formulaToSMTLIB(a)).join(' ')})`;

      default:
        return 'true';
    }
  }

  /**
   * Convert sort to SMT-LIB
   */
  private sortToSMTLIB(sort: Sort): string {
    switch (sort.kind) {
      case 'bool':
        return 'Bool';
      case 'int':
        return 'Int';
      case 'real':
        return 'Real';
      case 'string':
        return 'String';
      case 'bitvec':
        return `(_ BitVec ${sort.width})`;
      case 'array':
        return `(Array ${this.sortToSMTLIB(sort.index)} ${this.sortToSMTLIB(sort.element)})`;
      case 'datatype':
      case 'uninterpreted':
        return sort.name;
      default:
        return 'Int';
    }
  }

  /**
   * Collect variable declarations from formula
   */
  private collectDeclarations(formula: Formula): string[] {
    const vars = new Map<string, Sort>();
    this.collectVariables(formula, vars);

    return Array.from(vars.entries()).map(
      ([name, sort]) => `(declare-const ${name} ${this.sortToSMTLIB(sort)})`
    );
  }

  /**
   * Recursively collect variables
   */
  private collectVariables(formula: Formula, vars: Map<string, Sort>): void {
    switch (formula.kind) {
      case 'var':
        vars.set(formula.name, formula.sort);
        break;
      case 'not':
        this.collectVariables(formula.arg, vars);
        break;
      case 'and':
      case 'or':
        formula.args.forEach((a) => this.collectVariables(a, vars));
        break;
      case 'implies':
      case 'iff':
      case 'eq':
      case 'lt':
      case 'le':
      case 'gt':
      case 'ge':
      case 'sub':
      case 'div':
      case 'mod':
        this.collectVariables(formula.left, vars);
        this.collectVariables(formula.right, vars);
        break;
      case 'add':
      case 'mul':
        formula.args.forEach((a) => this.collectVariables(a, vars));
        break;
      case 'forall':
      case 'exists':
        // Bound variables are not free
        this.collectVariables(formula.body, vars);
        formula.vars.forEach((v) => vars.delete(v.name));
        break;
      case 'ite':
        this.collectVariables(formula.cond, vars);
        this.collectVariables(formula.then, vars);
        this.collectVariables(formula.else, vars);
        break;
      case 'app':
        formula.args.forEach((a) => this.collectVariables(a, vars));
        break;
    }
  }

  /**
   * Simulate solving (DEMO MODE ONLY)
   * 
   * ⚠️ WARNING: This is for DEMO purposes only!
   * - Results have NO formal guarantees
   * - Only handles trivial cases
   * - NOT suitable for production verification
   * 
   * For real verification, use mode: 'real' with Z3 or CVC5 installed.
   */
  private simulateSolve(formula: Formula): SMTResult {
    // Simple simulation - in reality would call actual solver
    
    // Check for trivially true/false
    if (formula.kind === 'const') {
      return {
        sat: formula.value as boolean,
        model: {},
        source: 'demo_simulation',
      };
    }

    // Check for simple contradictions
    if (formula.kind === 'and') {
      for (const arg of formula.args) {
        if (arg.kind === 'const' && arg.value === false) {
          return { sat: false, source: 'demo_simulation' };
        }
      }
    }

    // Check for satisfiable constraints
    if (formula.kind === 'and') {
      const model: Record<string, unknown> = {};
      let sat = true;

      for (const arg of formula.args) {
        if (arg.kind === 'ge' && arg.left.kind === 'var' && arg.right.kind === 'const') {
          model[arg.left.name] = (arg.right.value as number) + 1;
        }
        if (arg.kind === 'le' && arg.left.kind === 'var' && arg.right.kind === 'const') {
          const current = model[arg.left.name] as number | undefined;
          if (current !== undefined && current > (arg.right.value as number)) {
            sat = false;
          }
        }
      }

      return { sat, model, source: 'demo_simulation' };
    }

    // Default: assume satisfiable (NOT SAFE - demo only!)
    return { 
      sat: true, 
      model: {}, 
      source: 'demo_simulation',
      reason: 'Demo mode default - no actual solving performed',
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create an SMT solver with real solver enabled
 */
export function createRealSolver(config?: Partial<SMTSolverConfig>): SMTSolver {
  return new SMTSolver({
    solver: config?.solver ?? 'auto',
    timeout: config?.timeout ?? 30000,
    memoryLimit: config?.memoryLimit ?? 4096,
    parallel: config?.parallel ?? true,
    maxWorkers: config?.maxWorkers ?? 4,
    cacheResults: config?.cacheResults ?? true,
    generateProofs: config?.generateProofs ?? true,
    verbose: config?.verbose ?? false,
    mode: 'real',
  });
}

/**
 * Create an SMT solver in demo mode (FOR DEMOS ONLY)
 * 
 * ⚠️ WARNING: Demo mode provides NO formal guarantees!
 */
export function createDemoSolver(config?: Partial<SMTSolverConfig>): SMTSolver {
  return new SMTSolver({
    solver: config?.solver ?? 'builtin',
    timeout: config?.timeout ?? 30000,
    memoryLimit: config?.memoryLimit ?? 4096,
    parallel: config?.parallel ?? false,
    maxWorkers: config?.maxWorkers ?? 1,
    cacheResults: config?.cacheResults ?? false,
    generateProofs: config?.generateProofs ?? false,
    verbose: config?.verbose ?? false,
    mode: 'demo',
  });
}
