/**
 * Postcondition Evaluator Stage
 * 
 * Evaluates ISL postconditions using execution traces with tri-state logic.
 * - true: postcondition verified
 * - false: postcondition violated
 * - 'unknown': cannot be evaluated (missing data, evaluation error)
 * 
 * @module @isl-lang/verify-pipeline
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type {
  PostconditionEvaluatorOutput,
  ClauseEvidence,
  ExecutionTrace,
  TraceEvent,
  TriState,
  ClauseStatus,
  SourceLocation,
} from '../types.js';
import { findTraceSlice, extractStateSnapshots } from './trace-collector.js';

// ============================================================================
// Types
// ============================================================================

export interface PostconditionEvaluatorConfig {
  /** Domain spec */
  domain: DomainDeclaration;
  /** Execution traces */
  traces: ExecutionTrace[];
  /** Maximum evaluation time per clause (ms) */
  timeoutPerClause?: number;
  /** Enable detailed diagnostics */
  diagnostics?: boolean;
}

interface ExtractedClause {
  id: string;
  behavior: string;
  outcome?: string; // 'success', 'any_error', or specific error code
  expression: string;
  expressionAst: unknown;
  sourceLocation?: SourceLocation;
}

// ============================================================================
// Postcondition Extraction
// ============================================================================

/**
 * Extract postconditions from domain spec
 */
function extractPostconditions(domain: DomainDeclaration): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  
  for (const behavior of domain.behaviors) {
    if (!behavior.postconditions) continue;
    
    for (const condition of behavior.postconditions.conditions) {
      // Determine outcome from condition trigger
      const outcome = condition.trigger?.type === 'success' ? 'success'
        : condition.trigger?.type === 'any_error' ? 'any_error'
        : condition.trigger?.type === 'error_code' ? condition.trigger.code
        : 'success'; // Default to success
      
      for (const stmt of condition.statements) {
        const clauseId = `${behavior.name.value}_post_${outcome}_${stmt.span.start.line}`;
        
        clauses.push({
          id: clauseId,
          behavior: behavior.name.value,
          outcome,
          expression: formatExpression(stmt.expression),
          expressionAst: stmt.expression,
          sourceLocation: stmt.span ? {
            file: stmt.span.file,
            line: stmt.span.start.line,
            column: stmt.span.start.column,
            endLine: stmt.span.end.line,
            endColumn: stmt.span.end.column,
          } : undefined,
        });
      }
    }
  }
  
  return clauses;
}

// ============================================================================
// Expression Formatting
// ============================================================================

function formatExpression(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr);
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  switch (node.kind) {
    case 'Identifier':
      return node.name as string;
    
    case 'StringLiteral':
      return JSON.stringify(node.value);
    
    case 'NumberLiteral':
      return String(node.value);
    
    case 'BooleanLiteral':
      return String(node.value);
    
    case 'BinaryExpr':
      return `${formatExpression(node.left)} ${node.operator} ${formatExpression(node.right)}`;
    
    case 'UnaryExpr':
      return `${node.operator}${formatExpression(node.operand)}`;
    
    case 'MemberExpr':
      return `${formatExpression(node.object)}.${(node.property as { name: string }).name}`;
    
    case 'CallExpr':
      const callee = formatExpression(node.callee);
      const args = (node.arguments as unknown[]).map(formatExpression).join(', ');
      return `${callee}(${args})`;
    
    case 'OldExpr':
      return `old(${formatExpression(node.expression)})`;
    
    case 'ResultExpr':
      if (node.property) {
        return `result.${(node.property as { name: string }).name}`;
      }
      return 'result';
    
    case 'InputExpr':
      return `input.${(node.property as { name: string }).name}`;
    
    case 'QuantifierExpr':
      return `${node.quantifier} ${(node.variable as { name: string }).name} in ${formatExpression(node.collection)}: ${formatExpression(node.predicate)}`;
    
    default:
      return JSON.stringify(node);
  }
}

// ============================================================================
// Evaluation Context
// ============================================================================

interface EvaluationContext {
  input: Record<string, unknown>;
  result: unknown;
  error?: {
    code: string;
    message: string;
    retriable: boolean;
  };
  oldState: Record<string, unknown>;
  newState: Record<string, unknown>;
  now: Date;
  variables: Map<string, unknown>;
  entityLookup: (entity: string, criteria: Record<string, unknown>) => unknown;
  entityExists: (entity: string, criteria: Record<string, unknown>) => boolean;
}

function buildContext(
  trace: ExecutionTrace,
  traceSlice: TraceEvent[]
): EvaluationContext | null {
  const callEvent = traceSlice.find(e => e.kind === 'handler_call');
  const returnEvent = traceSlice.find(e => e.kind === 'handler_return');
  const errorEvent = traceSlice.find(e => e.kind === 'handler_error');
  
  if (!callEvent) return null;
  
  const { before, after } = extractStateSnapshots(traceSlice);
  
  return {
    input: callEvent.inputs || {},
    result: returnEvent?.outputs,
    error: errorEvent?.error ? {
      code: errorEvent.error.code || 'UNKNOWN',
      message: errorEvent.error.message,
      retriable: false,
    } : undefined,
    oldState: before,
    newState: after,
    now: new Date(trace.startTime),
    variables: new Map(),
    entityLookup: (entity, criteria) => {
      // Simple lookup from state
      const entities = after[entity];
      if (!Array.isArray(entities)) return undefined;
      return entities.find(e => 
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
    entityExists: (entity, criteria) => {
      const entities = after[entity];
      if (!Array.isArray(entities)) return false;
      return entities.some(e => 
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
  };
}

// ============================================================================
// Expression Evaluation (Tri-State)
// ============================================================================

function evaluateExpression(expr: unknown, ctx: EvaluationContext): TriState {
  if (!expr || typeof expr !== 'object') return 'unknown';
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  try {
    switch (node.kind) {
      case 'Identifier':
        return evaluateIdentifier(node.name as string, ctx);
      
      case 'BooleanLiteral':
        return node.value as boolean;
      
      case 'BinaryExpr':
        return evaluateBinaryExpr(node, ctx);
      
      case 'UnaryExpr':
        return evaluateUnaryExpr(node, ctx);
      
      case 'MemberExpr':
        return evaluateMemberExpr(node, ctx);
      
      case 'CallExpr':
        return evaluateCallExpr(node, ctx);
      
      case 'OldExpr':
        return evaluateOldExpr(node, ctx);
      
      case 'ResultExpr':
        return evaluateResultExpr(node, ctx);
      
      case 'InputExpr':
        return evaluateInputExpr(node, ctx);
      
      case 'QuantifierExpr':
        return evaluateQuantifierExpr(node, ctx);
      
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

function evaluateIdentifier(name: string, ctx: EvaluationContext): TriState {
  if (name === 'true') return true;
  if (name === 'false') return false;
  if (name === 'result') return ctx.result !== undefined && ctx.result !== null;
  if (ctx.variables.has(name)) {
    const val = ctx.variables.get(name);
    return val !== null && val !== undefined;
  }
  if (name in ctx.input) {
    return ctx.input[name] !== null && ctx.input[name] !== undefined;
  }
  return 'unknown';
}

function evaluateBinaryExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const op = node.operator as string;
  
  // Logical operators with short-circuit
  if (op === 'and' || op === '&&') {
    const left = evaluateExpression(node.left, ctx);
    if (left === false) return false;
    const right = evaluateExpression(node.right, ctx);
    if (left === 'unknown' || right === 'unknown') return 'unknown';
    return left && right;
  }
  
  if (op === 'or' || op === '||') {
    const left = evaluateExpression(node.left, ctx);
    if (left === true) return true;
    const right = evaluateExpression(node.right, ctx);
    if (left === 'unknown' || right === 'unknown') return 'unknown';
    return left || right;
  }
  
  if (op === 'implies' || op === '=>') {
    const left = evaluateExpression(node.left, ctx);
    if (left === false) return true;
    if (left === 'unknown') return 'unknown';
    return evaluateExpression(node.right, ctx);
  }
  
  // Comparison operators
  const leftVal = extractValue(node.left, ctx);
  const rightVal = extractValue(node.right, ctx);
  
  if (leftVal === 'unknown' || rightVal === 'unknown') return 'unknown';
  
  switch (op) {
    case '==': return deepEqual(leftVal, rightVal);
    case '!=': return !deepEqual(leftVal, rightVal);
    case '<': return (leftVal as number) < (rightVal as number);
    case '<=': return (leftVal as number) <= (rightVal as number);
    case '>': return (leftVal as number) > (rightVal as number);
    case '>=': return (leftVal as number) >= (rightVal as number);
    default: return 'unknown';
  }
}

function evaluateUnaryExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const op = node.operator as string;
  const operand = evaluateExpression(node.operand, ctx);
  
  if (operand === 'unknown') return 'unknown';
  
  switch (op) {
    case 'not':
    case '!':
      return !operand;
    default:
      return 'unknown';
  }
}

function evaluateMemberExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const objVal = extractValue(node.object, ctx);
  if (objVal === 'unknown' || objVal === null || objVal === undefined) return 'unknown';
  
  const prop = (node.property as { name: string }).name;
  
  if (typeof objVal === 'object' && prop in (objVal as Record<string, unknown>)) {
    const val = (objVal as Record<string, unknown>)[prop];
    return val !== null && val !== undefined;
  }
  
  return 'unknown';
}

function evaluateCallExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const callee = node.callee as { kind: string; [key: string]: unknown };
  
  // Handle Entity.exists(...) and Entity.lookup(...)
  if (callee.kind === 'MemberExpr') {
    const obj = callee.object as { kind: string; name?: string };
    const method = (callee.property as { name: string }).name;
    
    if (obj.kind === 'Identifier' && obj.name) {
      const entityName = obj.name;
      const args = node.arguments as unknown[];
      
      if (method === 'exists') {
        const criteria = extractCriteria(args, ctx);
        if (criteria === 'unknown') return 'unknown';
        return ctx.entityExists(entityName, criteria);
      }
      
      if (method === 'lookup') {
        const criteria = extractCriteria(args, ctx);
        if (criteria === 'unknown') return 'unknown';
        const result = ctx.entityLookup(entityName, criteria);
        return result !== undefined && result !== null;
      }
    }
  }
  
  return 'unknown';
}

function evaluateOldExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  // Create context with old state
  const oldCtx: EvaluationContext = {
    ...ctx,
    newState: ctx.oldState,
    entityLookup: (entity, criteria) => {
      const entities = ctx.oldState[entity];
      if (!Array.isArray(entities)) return undefined;
      return entities.find(e => 
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
    entityExists: (entity, criteria) => {
      const entities = ctx.oldState[entity];
      if (!Array.isArray(entities)) return false;
      return entities.some(e => 
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
  };
  
  return evaluateExpression(node.expression, oldCtx);
}

function evaluateResultExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  if (ctx.result === undefined || ctx.result === null) return false;
  
  if (node.property) {
    const prop = (node.property as { name: string }).name;
    if (typeof ctx.result === 'object' && prop in (ctx.result as Record<string, unknown>)) {
      const val = (ctx.result as Record<string, unknown>)[prop];
      return val !== null && val !== undefined;
    }
    return 'unknown';
  }
  
  return true;
}

function evaluateInputExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const prop = (node.property as { name: string }).name;
  if (prop in ctx.input) {
    return ctx.input[prop] !== null && ctx.input[prop] !== undefined;
  }
  return 'unknown';
}

function evaluateQuantifierExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const quantifier = node.quantifier as 'all' | 'any' | 'forall' | 'exists';
  const variable = (node.variable as { name: string }).name;
  const collection = extractValue(node.collection, ctx);
  
  if (collection === 'unknown' || !Array.isArray(collection)) return 'unknown';
  
  if (collection.length === 0) {
    return quantifier === 'all' || quantifier === 'forall' ? true : false;
  }
  
  const results: TriState[] = [];
  for (const item of collection) {
    const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
    innerCtx.variables.set(variable, item);
    results.push(evaluateExpression(node.predicate, innerCtx));
  }
  
  if (quantifier === 'all' || quantifier === 'forall') {
    if (results.some(r => r === false)) return false;
    if (results.some(r => r === 'unknown')) return 'unknown';
    return true;
  } else {
    if (results.some(r => r === true)) return true;
    if (results.some(r => r === 'unknown')) return 'unknown';
    return false;
  }
}

// ============================================================================
// Value Extraction
// ============================================================================

function extractValue(expr: unknown, ctx: EvaluationContext): unknown {
  if (!expr || typeof expr !== 'object') return expr;
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  switch (node.kind) {
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'BooleanLiteral':
      return node.value;
    
    case 'Identifier':
      const name = node.name as string;
      if (name === 'result') return ctx.result;
      if (ctx.variables.has(name)) return ctx.variables.get(name);
      if (name in ctx.input) return ctx.input[name];
      return 'unknown';
    
    case 'MemberExpr':
      const objVal = extractValue(node.object, ctx);
      if (objVal === 'unknown' || objVal === null || objVal === undefined) return 'unknown';
      const prop = (node.property as { name: string }).name;
      if (typeof objVal === 'object' && prop in (objVal as Record<string, unknown>)) {
        return (objVal as Record<string, unknown>)[prop];
      }
      return 'unknown';
    
    case 'ResultExpr':
      if (node.property) {
        const rprop = (node.property as { name: string }).name;
        if (ctx.result && typeof ctx.result === 'object' && rprop in (ctx.result as Record<string, unknown>)) {
          return (ctx.result as Record<string, unknown>)[rprop];
        }
        return 'unknown';
      }
      return ctx.result;
    
    case 'InputExpr':
      const iprop = (node.property as { name: string }).name;
      return ctx.input[iprop] ?? 'unknown';
    
    case 'OldExpr':
      // Extract from old state
      const innerExpr = node.expression as { kind?: string; [key: string]: unknown };
      if (innerExpr.kind === 'MemberExpr') {
        const entity = extractValue(innerExpr.object, ctx) as string;
        const field = (innerExpr.property as { name: string }).name;
        const entityState = ctx.oldState[entity];
        if (typeof entityState === 'object' && entityState !== null) {
          return (entityState as Record<string, unknown>)[field];
        }
      }
      return 'unknown';
    
    case 'CallExpr':
      // Handle Entity.lookup
      const callee = node.callee as { kind: string; object?: unknown; property?: { name: string } };
      if (callee.kind === 'MemberExpr' && callee.property?.name === 'lookup') {
        const entityName = extractValue(callee.object, ctx) as string;
        const criteria = extractCriteria(node.arguments as unknown[], ctx);
        if (criteria !== 'unknown') {
          return ctx.entityLookup(entityName, criteria);
        }
      }
      return 'unknown';
    
    default:
      return 'unknown';
  }
}

function extractCriteria(args: unknown[], ctx: EvaluationContext): Record<string, unknown> | 'unknown' {
  if (args.length === 0) return {};
  
  // If first arg is an object, use it as criteria
  const firstArg = args[0];
  if (firstArg && typeof firstArg === 'object') {
    const node = firstArg as { kind?: string; [key: string]: unknown };
    if (node.kind === 'ObjectExpr' || node.kind === 'RecordExpr') {
      const criteria: Record<string, unknown> = {};
      const props = node.properties as Array<{ key: { name: string }; value: unknown }>;
      for (const prop of props) {
        const val = extractValue(prop.value, ctx);
        if (val === 'unknown') return 'unknown';
        criteria[prop.key.name] = val;
      }
      return criteria;
    }
  }
  
  // Single value - assume it's an ID
  const val = extractValue(firstArg, ctx);
  if (val === 'unknown') return 'unknown';
  return { id: val };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => 
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }
  
  return false;
}

// ============================================================================
// Outcome Matching
// ============================================================================

function matchesOutcome(
  trace: ExecutionTrace,
  traceSlice: TraceEvent[],
  expectedOutcome: string
): boolean {
  const errorEvent = traceSlice.find(e => e.kind === 'handler_error');
  const returnEvent = traceSlice.find(e => e.kind === 'handler_return');
  
  if (expectedOutcome === 'success') {
    return !errorEvent && returnEvent !== undefined;
  }
  
  if (expectedOutcome === 'any_error') {
    return errorEvent !== undefined;
  }
  
  // Specific error code
  return errorEvent?.error?.code === expectedOutcome;
}

// ============================================================================
// Main Evaluator
// ============================================================================

/**
 * Evaluate all postconditions
 */
export async function evaluatePostconditions(
  config: PostconditionEvaluatorConfig
): Promise<PostconditionEvaluatorOutput> {
  const clauses = extractPostconditions(config.domain);
  const evidence: ClauseEvidence[] = [];
  
  const byBehavior: Record<string, { totalClauses: number; proven: number; violated: number; notProven: number }> = {};
  const byOutcome: Record<string, { totalClauses: number; proven: number; violated: number; notProven: number }> = {};
  
  for (const clause of clauses) {
    // Find traces for this behavior
    const behaviorTraces = config.traces.filter(t => t.behavior === clause.behavior);
    
    // Initialize counters
    if (!byBehavior[clause.behavior]) {
      byBehavior[clause.behavior] = { totalClauses: 0, proven: 0, violated: 0, notProven: 0 };
    }
    if (clause.outcome && !byOutcome[clause.outcome]) {
      byOutcome[clause.outcome] = { totalClauses: 0, proven: 0, violated: 0, notProven: 0 };
    }
    
    byBehavior[clause.behavior].totalClauses++;
    if (clause.outcome) byOutcome[clause.outcome].totalClauses++;
    
    if (behaviorTraces.length === 0) {
      // No traces for this behavior - NOT_PROVEN
      evidence.push({
        clauseId: clause.id,
        type: 'postcondition',
        behavior: clause.behavior,
        outcome: clause.outcome,
        expression: clause.expression,
        sourceLocation: clause.sourceLocation,
        status: 'not_proven',
        triStateResult: 'unknown',
        reason: `No traces available for behavior: ${clause.behavior}`,
      });
      byBehavior[clause.behavior].notProven++;
      if (clause.outcome) byOutcome[clause.outcome].notProven++;
      continue;
    }
    
    // Evaluate against each matching trace
    let evaluated = false;
    let finalResult: TriState = 'unknown';
    let finalReason: string | undefined;
    let traceSliceInfo: ClauseEvidence['traceSlice'];
    
    for (const trace of behaviorTraces) {
      const traceSlice = findTraceSlice(trace, clause.behavior);
      
      if (traceSlice.length === 0) continue;
      
      // Check if this trace matches the expected outcome
      if (clause.outcome && !matchesOutcome(trace, traceSlice, clause.outcome)) {
        continue;
      }
      
      // Build evaluation context
      const ctx = buildContext(trace, traceSlice);
      if (!ctx) continue;
      
      evaluated = true;
      finalResult = evaluateExpression(clause.expressionAst, ctx);
      
      traceSliceInfo = {
        traceId: trace.id,
        startTime: traceSlice[0]?.time || trace.startTime,
        endTime: traceSlice[traceSlice.length - 1]?.time || trace.endTime || trace.startTime,
        eventCount: traceSlice.length,
      };
      
      if (finalResult === false) {
        finalReason = 'Postcondition evaluated to false';
        break; // Stop on first violation
      }
    }
    
    if (!evaluated) {
      evidence.push({
        clauseId: clause.id,
        type: 'postcondition',
        behavior: clause.behavior,
        outcome: clause.outcome,
        expression: clause.expression,
        sourceLocation: clause.sourceLocation,
        status: 'skipped',
        triStateResult: 'unknown',
        reason: `No traces matched outcome: ${clause.outcome}`,
      });
      continue;
    }
    
    const status: ClauseStatus = 
      finalResult === true ? 'proven' :
      finalResult === false ? 'violated' : 'not_proven';
    
    evidence.push({
      clauseId: clause.id,
      type: 'postcondition',
      behavior: clause.behavior,
      outcome: clause.outcome,
      expression: clause.expression,
      sourceLocation: clause.sourceLocation,
      status,
      triStateResult: finalResult,
      reason: finalReason,
      traceSlice: traceSliceInfo,
    });
    
    // Update counters
    if (status === 'proven') {
      byBehavior[clause.behavior].proven++;
      if (clause.outcome) byOutcome[clause.outcome].proven++;
    } else if (status === 'violated') {
      byBehavior[clause.behavior].violated++;
      if (clause.outcome) byOutcome[clause.outcome].violated++;
    } else {
      byBehavior[clause.behavior].notProven++;
      if (clause.outcome) byOutcome[clause.outcome].notProven++;
    }
  }
  
  // Calculate summary
  const totalClauses = evidence.length;
  const provenClauses = evidence.filter(e => e.status === 'proven').length;
  const violatedClauses = evidence.filter(e => e.status === 'violated').length;
  const notProvenClauses = evidence.filter(e => e.status === 'not_proven').length;
  const skippedClauses = evidence.filter(e => e.status === 'skipped').length;
  const coveragePercent = totalClauses > 0 
    ? Math.round((provenClauses / totalClauses) * 100) 
    : 0;
  
  return {
    evidence,
    summary: {
      totalClauses,
      provenClauses,
      violatedClauses,
      notProvenClauses,
      skippedClauses,
      coveragePercent,
    },
    byBehavior,
    byOutcome,
  };
}
