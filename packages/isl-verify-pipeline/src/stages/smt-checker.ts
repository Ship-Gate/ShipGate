/**
 * SMT Checker Stage (Optional)
 * 
 * Uses SMT solvers (Z3, CVC5) for formal verification of properties
 * that can be expressed as logical formulas.
 * 
 * This stage is optional and provides additional confidence
 * beyond runtime trace analysis.
 * 
 * @module @isl-lang/verify-pipeline
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type {
  SMTCheckerOutput,
  SMTCheckResult,
  SMTResult,
  ClauseEvidence,
  InvariantEvidence,
} from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface SMTCheckerConfig {
  /** Domain spec */
  domain: DomainDeclaration;
  /** Clauses to verify with SMT */
  clauses: Array<ClauseEvidence | InvariantEvidence>;
  /** SMT solver to use */
  solver?: 'z3' | 'cvc5';
  /** Timeout per check in ms */
  timeout?: number;
  /** Solver binary path */
  solverPath?: string;
}

// ============================================================================
// SMT Formula Generation
// ============================================================================

/**
 * Convert ISL expression to SMT-LIB format
 */
function toSMTFormula(expr: unknown): string | null {
  if (!expr || typeof expr !== 'object') return null;
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  switch (node.kind) {
    case 'Identifier':
      return sanitizeIdentifier(node.name as string);
    
    case 'BooleanLiteral':
      return node.value ? 'true' : 'false';
    
    case 'NumberLiteral':
      return String(node.value);
    
    case 'StringLiteral':
      return `"${node.value}"`;
    
    case 'BinaryExpr':
      return toSMTBinaryExpr(node);
    
    case 'UnaryExpr':
      return toSMTUnaryExpr(node);
    
    case 'MemberExpr':
      return toSMTMemberExpr(node);
    
    case 'CallExpr':
      return toSMTCallExpr(node);
    
    case 'QuantifierExpr':
      return toSMTQuantifierExpr(node);
    
    default:
      return null;
  }
}

function sanitizeIdentifier(name: string): string {
  // SMT-LIB identifiers can't start with numbers and have limited characters
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function toSMTBinaryExpr(node: { [key: string]: unknown }): string | null {
  const left = toSMTFormula(node.left);
  const right = toSMTFormula(node.right);
  
  if (!left || !right) return null;
  
  const op = node.operator as string;
  
  switch (op) {
    case '&&':
    case 'and':
      return `(and ${left} ${right})`;
    
    case '||':
    case 'or':
      return `(or ${left} ${right})`;
    
    case '=>':
    case 'implies':
      return `(=> ${left} ${right})`;
    
    case '==':
      return `(= ${left} ${right})`;
    
    case '!=':
      return `(not (= ${left} ${right}))`;
    
    case '<':
      return `(< ${left} ${right})`;
    
    case '<=':
      return `(<= ${left} ${right})`;
    
    case '>':
      return `(> ${left} ${right})`;
    
    case '>=':
      return `(>= ${left} ${right})`;
    
    case '+':
      return `(+ ${left} ${right})`;
    
    case '-':
      return `(- ${left} ${right})`;
    
    case '*':
      return `(* ${left} ${right})`;
    
    case '/':
      return `(div ${left} ${right})`;
    
    case '%':
      return `(mod ${left} ${right})`;
    
    default:
      return null;
  }
}

function toSMTUnaryExpr(node: { [key: string]: unknown }): string | null {
  const operand = toSMTFormula(node.operand);
  if (!operand) return null;
  
  const op = node.operator as string;
  
  switch (op) {
    case '!':
    case 'not':
      return `(not ${operand})`;
    
    case '-':
      return `(- ${operand})`;
    
    default:
      return null;
  }
}

function toSMTMemberExpr(node: { [key: string]: unknown }): string | null {
  const obj = toSMTFormula(node.object);
  if (!obj) return null;
  
  const prop = (node.property as { name: string }).name;
  
  // Use underscore notation for member access
  return `${obj}_${sanitizeIdentifier(prop)}`;
}

function toSMTCallExpr(node: { [key: string]: unknown }): string | null {
  // Most function calls can't be directly translated to SMT
  // Handle special cases
  return null;
}

function toSMTQuantifierExpr(node: { [key: string]: unknown }): string | null {
  const quantifier = node.quantifier as string;
  const variable = (node.variable as { name: string }).name;
  const predicate = toSMTFormula(node.predicate);
  
  if (!predicate) return null;
  
  const smtVar = sanitizeIdentifier(variable);
  
  switch (quantifier) {
    case 'all':
    case 'forall':
      return `(forall ((${smtVar} Int)) ${predicate})`;
    
    case 'any':
    case 'exists':
      return `(exists ((${smtVar} Int)) ${predicate})`;
    
    default:
      return null;
  }
}

// ============================================================================
// Variable Extraction
// ============================================================================

function extractVariables(expr: unknown, vars: Set<string>): void {
  if (!expr || typeof expr !== 'object') return;
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  switch (node.kind) {
    case 'Identifier':
      const name = node.name as string;
      if (name !== 'true' && name !== 'false' && name !== 'null') {
        vars.add(sanitizeIdentifier(name));
      }
      break;
    
    case 'MemberExpr':
      const memberVar = toSMTFormula(node);
      if (memberVar) vars.add(memberVar);
      break;
    
    case 'BinaryExpr':
    case 'UnaryExpr':
    case 'CallExpr':
    case 'QuantifierExpr':
      for (const key of Object.keys(node)) {
        if (key !== 'kind' && key !== 'location' && key !== 'span') {
          const value = node[key];
          if (Array.isArray(value)) {
            for (const item of value) {
              extractVariables(item, vars);
            }
          } else if (typeof value === 'object') {
            extractVariables(value, vars);
          }
        }
      }
      break;
  }
}

// ============================================================================
// SMT-LIB Query Generation
// ============================================================================

function generateSMTQuery(formula: string, variables: Set<string>): string {
  const declarations = Array.from(variables)
    .map(v => `(declare-const ${v} Int)`)
    .join('\n');
  
  return `
; SMT-LIB2 query generated by ISL Verify Pipeline
(set-logic ALL)

; Variable declarations
${declarations}

; Assert the negation of the property to check
; If UNSAT, the property is proven
; If SAT, we have a counterexample
(assert (not ${formula}))

(check-sat)
(get-model)
`.trim();
}

// ============================================================================
// Real SMT Solver Integration
// ============================================================================

/**
 * Import the actual SMT solver from isl-smt package
 */
let smtSolver: typeof import('@isl-lang/isl-smt') | null = null;

async function loadSMTSolver(): Promise<typeof import('@isl-lang/isl-smt') | null> {
  if (smtSolver !== null) return smtSolver;
  
  try {
    smtSolver = await import('@isl-lang/isl-smt');
    return smtSolver;
  } catch {
    // SMT package not available
    return null;
  }
}

/**
 * Execute actual SMT solving using the isl-smt package
 */
async function executeSMTSolver(
  query: string,
  formula: unknown,
  timeout: number
): Promise<{ result: SMTResult; model?: Record<string, unknown> }> {
  const smt = await loadSMTSolver();
  
  if (!smt) {
    // Fall back to unknown if SMT package not available
    return { result: 'unknown' };
  }
  
  try {
    // Create a solver with the configured timeout
    const solver = smt.createSolver({
      timeout,
      solver: 'builtin', // Use builtin solver with Z3 fallback
      verbose: false,
    });
    
    // If we have a parsed formula, use it directly
    if (formula && typeof formula === 'object') {
      const result = await solver.checkSat(formula as import('@isl-lang/prover').SMTExpr, []);
      
      switch (result.status) {
        case 'sat':
          return { result: 'sat', model: result.model };
        case 'unsat':
          return { result: 'unsat' };
        case 'timeout':
          return { result: 'timeout' };
        case 'unknown':
          return { result: 'unknown' };
        case 'error':
          return { result: 'error' };
      }
    }
    
    // If we only have the query string, return unknown
    // (would need to parse SMT-LIB to use it)
    return { result: 'unknown' };
  } catch (error) {
    return { result: 'error' };
  }
}

// ============================================================================
// SMT Execution
// ============================================================================

/**
 * Execute SMT check for a single clause
 */
async function executeCheck(
  clauseId: string,
  expressionAst: unknown,
  solver: 'z3' | 'cvc5',
  timeout: number
): Promise<SMTCheckResult> {
  const startTime = Date.now();
  
  // Convert expression to SMT formula string
  const formulaStr = toSMTFormula(expressionAst);
  
  if (!formulaStr) {
    return {
      clauseId,
      formula: '[not translatable]',
      result: 'error',
      durationMs: Date.now() - startTime,
      reason: 'Expression cannot be translated to SMT-LIB format',
    };
  }
  
  // Extract variables
  const variables = new Set<string>();
  extractVariables(expressionAst, variables);
  
  // Generate SMT query
  const query = generateSMTQuery(formulaStr, variables);
  
  try {
    // Try to load and use the real SMT solver
    const smt = await loadSMTSolver();
    
    if (smt) {
      // Try to encode the expression using the isl-smt encoder
      const ctx = smt.createContext();
      
      // Add variables to context (assume Int for now)
      for (const v of variables) {
        ctx.variables.set(v, smt.Sort.Int());
      }
      
      const encoded = smt.encodeExpression(expressionAst as import('@isl-lang/isl-core/ast').Expression, ctx);
      
      if (encoded.success) {
        const smtSolver = smt.createSolver({
          timeout,
          solver: 'builtin',
          verbose: false,
        });
        
        const result = await smtSolver.checkSat(encoded.expr, []);
        
        return {
          clauseId,
          formula: formulaStr,
          result: result.status === 'error' ? 'error' : result.status,
          durationMs: Date.now() - startTime,
          model: result.status === 'sat' ? result.model : undefined,
          counterexample: result.status === 'sat' ? result.model : undefined,
          reason: result.status === 'unknown' ? result.reason : 
                  result.status === 'error' ? result.message : undefined,
        };
      }
    }
    
    // Fall back to mock solver if encoding failed
    const { result, model } = await executeSMTSolver(query, null, timeout);
    
    return {
      clauseId,
      formula: formulaStr,
      result,
      durationMs: Date.now() - startTime,
      model,
      counterexample: result === 'sat' ? model : undefined,
    };
  } catch (error) {
    return {
      clauseId,
      formula: formulaStr,
      result: 'error',
      durationMs: Date.now() - startTime,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Main Checker
// ============================================================================

/**
 * Run SMT checks on clauses
 */
export async function checkWithSMT(
  config: SMTCheckerConfig
): Promise<SMTCheckerOutput> {
  const solver = config.solver || 'z3';
  const timeout = config.timeout || 30000;
  
  // Check if SMT is enabled (based on whether we have clauses to check)
  if (config.clauses.length === 0) {
    return {
      enabled: false,
      results: [],
      summary: {
        totalChecks: 0,
        proven: 0,
        refuted: 0,
        unknown: 0,
        timeout: 0,
        error: 0,
        totalDurationMs: 0,
      },
    };
  }
  
  const results: SMTCheckResult[] = [];
  let totalDurationMs = 0;
  
  // Run SMT checks
  for (const clause of config.clauses) {
    // Skip clauses that are already proven/violated by runtime checks
    if (clause.status === 'proven' || clause.status === 'violated') {
      continue;
    }
    
    // Try to extract expression AST from the clause
    // This depends on how the clause stores its expression
    const expressionAst = (clause as { expressionAst?: unknown }).expressionAst;
    
    if (!expressionAst) {
      continue;
    }
    
    const result = await executeCheck(clause.clauseId, expressionAst, solver, timeout);
    results.push(result);
    totalDurationMs += result.durationMs;
  }
  
  // Calculate summary
  const summary = {
    totalChecks: results.length,
    proven: results.filter(r => r.result === 'unsat').length,
    refuted: results.filter(r => r.result === 'sat').length,
    unknown: results.filter(r => r.result === 'unknown').length,
    timeout: results.filter(r => r.result === 'timeout').length,
    error: results.filter(r => r.result === 'error').length,
    totalDurationMs,
  };
  
  return {
    enabled: true,
    solver,
    solverVersion: '(mock)',
    results,
    summary,
  };
}

/**
 * Check if SMT solver is available
 */
export async function isSMTAvailable(solver: 'z3' | 'cvc5' = 'z3'): Promise<boolean> {
  // In a real implementation, this would check if the solver binary exists
  // For now, always return false since we're using a mock
  return false;
}
