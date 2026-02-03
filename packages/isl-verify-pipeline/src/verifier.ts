/**
 * ISL Verifier - Complete verification pipeline
 * 
 * Produces PROVEN / FAILED / INCOMPLETE_PROOF verdicts by:
 * 1. Using import-resolver to parse specs with imports
 * 2. Running tests or collecting traces
 * 3. Evaluating postconditions and invariants with tri-state logic
 * 4. Generating per-clause evaluation tables
 * 
 * @module @isl-lang/verify-pipeline
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import type {
  PipelineVerdict,
  TriState,
  ClauseStatus,
  VerificationResult,
  ClauseResult,
  UnknownReason,
  EvidenceRef,
  ExecutionTrace,
  TraceEvent,
  SourceLocation,
} from './types.js';
import { collectTraces, findTraceSlice, extractStateSnapshots } from './stages/trace-collector.js';

// ============================================================================
// Configuration
// ============================================================================

export interface VerifyConfig {
  /** Path to ISL spec file */
  specPath: string;
  
  /** Optional spec content (overrides file read) */
  specContent?: string;
  
  /** Base path for import resolution */
  basePath?: string;
  
  /** Path to trace directory */
  traceDir?: string;
  
  /** Pre-loaded traces (for testing) */
  traces?: ExecutionTrace[];
  
  /** Enable verbose logging */
  verbose?: boolean;
  
  /** Timeout per clause evaluation (ms) */
  timeoutPerClause?: number;
}

// ============================================================================
// Clause Extraction
// ============================================================================

interface ExtractedClause {
  id: string;
  type: 'postcondition' | 'invariant' | 'precondition';
  behavior?: string;
  outcome?: string;
  expression: string;
  expressionAst: unknown;
  sourceLocation?: SourceLocation;
}

/**
 * Extract all clauses (postconditions, invariants, preconditions) from a domain
 */
function extractClauses(domain: DomainDeclaration): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  
  // Extract from behaviors
  for (const behavior of domain.behaviors || []) {
    // Postconditions
    if (behavior.postconditions) {
      const postClauses = extractPostconditions(behavior);
      clauses.push(...postClauses);
    }
    
    // Behavior-level invariants
    if (behavior.invariants) {
      const invClauses = extractBehaviorInvariants(behavior);
      clauses.push(...invClauses);
    }
    
    // Preconditions
    if (behavior.preconditions) {
      const preClauses = extractPreconditions(behavior);
      clauses.push(...preClauses);
    }
  }
  
  // Domain-level invariants
  for (const invBlock of domain.invariants || []) {
    for (let i = 0; i < (invBlock.invariants || []).length; i++) {
      const inv = invBlock.invariants[i];
      clauses.push({
        id: `domain_inv_${inv.span?.start?.line || i}`,
        type: 'invariant',
        expression: formatExpression(inv.expression),
        expressionAst: inv.expression,
        sourceLocation: inv.span ? {
          file: inv.span.file,
          line: inv.span.start.line,
          column: inv.span.start.column,
        } : undefined,
      });
    }
  }
  
  // Entity-level invariants
  for (const entity of domain.entities || []) {
    if (!entity.invariants) continue;
    
    for (let i = 0; i < entity.invariants.length; i++) {
      const inv = entity.invariants[i];
      clauses.push({
        id: `${entity.name.value}_entity_inv_${inv.span?.start?.line || i}`,
        type: 'invariant',
        expression: formatExpression(inv.expression),
        expressionAst: inv.expression,
        sourceLocation: inv.span ? {
          file: inv.span.file,
          line: inv.span.start.line,
          column: inv.span.start.column,
        } : undefined,
      });
    }
  }
  
  return clauses;
}

function extractPostconditions(behavior: BehaviorDeclaration): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  
  for (const condition of behavior.postconditions?.conditions || []) {
    const outcome = getOutcomeFromTrigger(condition.trigger);
    
    for (let i = 0; i < (condition.statements || []).length; i++) {
      const stmt = condition.statements[i];
      const lineNum = stmt.span?.start?.line || i;
      
      clauses.push({
        id: `${behavior.name.value}_post_${outcome}_${lineNum}`,
        type: 'postcondition',
        behavior: behavior.name.value,
        outcome,
        expression: formatExpression(stmt.expression),
        expressionAst: stmt.expression,
        sourceLocation: stmt.span ? {
          file: stmt.span.file,
          line: stmt.span.start.line,
          column: stmt.span.start.column,
        } : undefined,
      });
    }
  }
  
  return clauses;
}

function extractBehaviorInvariants(behavior: BehaviorDeclaration): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  
  for (let i = 0; i < (behavior.invariants || []).length; i++) {
    const inv = behavior.invariants![i];
    
    clauses.push({
      id: `${behavior.name.value}_inv_${inv.span?.start?.line || i}`,
      type: 'invariant',
      behavior: behavior.name.value,
      expression: formatExpression(inv.expression),
      expressionAst: inv.expression,
      sourceLocation: inv.span ? {
        file: inv.span.file,
        line: inv.span.start.line,
        column: inv.span.start.column,
      } : undefined,
    });
  }
  
  return clauses;
}

function extractPreconditions(behavior: BehaviorDeclaration): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  
  for (let i = 0; i < (behavior.preconditions?.statements || []).length; i++) {
    const stmt = behavior.preconditions!.statements[i];
    
    clauses.push({
      id: `${behavior.name.value}_pre_${stmt.span?.start?.line || i}`,
      type: 'precondition',
      behavior: behavior.name.value,
      expression: formatExpression(stmt.expression),
      expressionAst: stmt.expression,
      sourceLocation: stmt.span ? {
        file: stmt.span.file,
        line: stmt.span.start.line,
        column: stmt.span.start.column,
      } : undefined,
    });
  }
  
  return clauses;
}

function getOutcomeFromTrigger(trigger: unknown): string {
  if (!trigger || typeof trigger !== 'object') return 'success';
  
  const t = trigger as { type?: string; code?: string };
  
  switch (t.type) {
    case 'success': return 'success';
    case 'any_error': 
    case 'failure': return 'failure';
    case 'error_code': return t.code || 'error';
    default: return 'success';
  }
}

// ============================================================================
// Expression Formatting
// ============================================================================

function formatExpression(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr);
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  switch (node.kind) {
    case 'Identifier':
      return node.name as string || node.value as string || 'identifier';
    
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
      return `${formatExpression(node.object)}.${formatPropertyName(node.property)}`;
    
    case 'CallExpr':
      const callee = formatExpression(node.callee);
      const args = Array.isArray(node.arguments) 
        ? node.arguments.map(formatExpression).join(', ')
        : '';
      return `${callee}(${args})`;
    
    case 'OldExpr':
      return `old(${formatExpression(node.expression)})`;
    
    case 'ResultExpr':
      return node.property ? `result.${formatPropertyName(node.property)}` : 'result';
    
    case 'InputExpr':
      return node.property ? `input.${formatPropertyName(node.property)}` : 'input';
    
    case 'QuantifierExpr':
      const varName = formatPropertyName(node.variable);
      return `${node.quantifier} ${varName} in ${formatExpression(node.collection)}: ${formatExpression(node.predicate)}`;
    
    case 'NeverLoggedExpr':
      return `${formatExpression(node.field)} never logged`;
    
    case 'NeverStoredPlaintextExpr':
      return `${formatExpression(node.field)} never stored in plaintext`;
    
    case 'ImpliesExpr':
      return `${formatExpression(node.antecedent)} implies ${formatExpression(node.consequent)}`;
    
    default:
      // Try to extract a reasonable string representation
      if (node.value !== undefined) return String(node.value);
      if (node.name !== undefined) return String(node.name);
      return `[${node.kind || 'unknown'}]`;
  }
}

function formatPropertyName(prop: unknown): string {
  if (!prop) return 'unknown';
  if (typeof prop === 'string') return prop;
  if (typeof prop === 'object') {
    const p = prop as { name?: string; value?: string };
    return p.name || p.value || 'unknown';
  }
  return String(prop);
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
  };
  oldState: Record<string, unknown>;
  newState: Record<string, unknown>;
  now: Date;
  variables: Map<string, unknown>;
}

function buildEvaluationContext(
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
    } : undefined,
    oldState: before,
    newState: after,
    now: new Date(trace.startTime),
    variables: new Map(),
  };
}

// ============================================================================
// Tri-State Expression Evaluation
// ============================================================================

function evaluateExpression(expr: unknown, ctx: EvaluationContext): TriState {
  if (!expr || typeof expr !== 'object') return 'unknown';
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  try {
    switch (node.kind) {
      case 'Identifier':
        return evaluateIdentifier(node, ctx);
      
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
      
      case 'ImpliesExpr':
        return evaluateImpliesExpr(node, ctx);
      
      case 'NeverLoggedExpr':
      case 'NeverStoredPlaintextExpr':
        // These require special handling - check trace events
        return evaluateSecurityInvariant(node, ctx);
      
      default:
        return 'unknown';
    }
  } catch (error) {
    return 'unknown';
  }
}

function evaluateIdentifier(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const name = (node.name as string) || (node.value as string);
  
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
  
  // Logical operators with short-circuit evaluation
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
    case '<': return Number(leftVal) < Number(rightVal);
    case '<=': return Number(leftVal) <= Number(rightVal);
    case '>': return Number(leftVal) > Number(rightVal);
    case '>=': return Number(leftVal) >= Number(rightVal);
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
  
  const prop = formatPropertyName(node.property);
  
  if (typeof objVal === 'object' && prop in (objVal as Record<string, unknown>)) {
    const val = (objVal as Record<string, unknown>)[prop];
    return val !== null && val !== undefined;
  }
  
  return 'unknown';
}

function evaluateCallExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const callee = node.callee as { kind?: string; object?: unknown; property?: unknown };
  
  // Handle Entity.exists(...) and Entity.lookup(...)
  if (callee?.kind === 'MemberExpr') {
    const method = formatPropertyName(callee.property);
    
    if (method === 'exists') {
      // Try to evaluate existence check
      return 'unknown'; // Requires entity lookup implementation
    }
    
    if (method === 'lookup') {
      // Try to evaluate lookup
      return 'unknown'; // Requires entity lookup implementation
    }
  }
  
  return 'unknown';
}

function evaluateOldExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  // Create context with old state
  const oldCtx: EvaluationContext = {
    ...ctx,
    newState: ctx.oldState,
  };
  
  return evaluateExpression(node.expression, oldCtx);
}

function evaluateResultExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  if (ctx.result === undefined || ctx.result === null) return false;
  
  if (node.property) {
    const prop = formatPropertyName(node.property);
    if (typeof ctx.result === 'object' && prop in (ctx.result as Record<string, unknown>)) {
      const val = (ctx.result as Record<string, unknown>)[prop];
      return val !== null && val !== undefined;
    }
    return 'unknown';
  }
  
  return true;
}

function evaluateInputExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const prop = formatPropertyName(node.property);
  if (prop in ctx.input) {
    return ctx.input[prop] !== null && ctx.input[prop] !== undefined;
  }
  return 'unknown';
}

function evaluateQuantifierExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const quantifier = node.quantifier as string;
  const variable = formatPropertyName(node.variable);
  const collection = extractValue(node.collection, ctx);
  
  if (collection === 'unknown' || !Array.isArray(collection)) return 'unknown';
  
  if (collection.length === 0) {
    return (quantifier === 'all' || quantifier === 'forall') ? true : false;
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

function evaluateImpliesExpr(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  const left = evaluateExpression(node.antecedent, ctx);
  if (left === false) return true;
  if (left === 'unknown') return 'unknown';
  return evaluateExpression(node.consequent, ctx);
}

function evaluateSecurityInvariant(node: { [key: string]: unknown }, ctx: EvaluationContext): TriState {
  // Security invariants require trace analysis
  // Look for explicit check events in the trace that confirm/deny
  return 'unknown';
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
      const name = (node.name as string) || (node.value as string);
      if (name === 'result') return ctx.result;
      if (ctx.variables.has(name)) return ctx.variables.get(name);
      if (name in ctx.input) return ctx.input[name];
      if (name in ctx.newState) return ctx.newState[name];
      return 'unknown';
    
    case 'MemberExpr':
      const objVal = extractValue(node.object, ctx);
      if (objVal === 'unknown' || objVal === null || objVal === undefined) return 'unknown';
      const prop = formatPropertyName(node.property);
      if (typeof objVal === 'object' && prop in (objVal as Record<string, unknown>)) {
        return (objVal as Record<string, unknown>)[prop];
      }
      return 'unknown';
    
    case 'ResultExpr':
      if (!ctx.result) return 'unknown';
      if (node.property) {
        const rprop = formatPropertyName(node.property);
        if (typeof ctx.result === 'object' && rprop in (ctx.result as Record<string, unknown>)) {
          return (ctx.result as Record<string, unknown>)[rprop];
        }
        return 'unknown';
      }
      return ctx.result;
    
    case 'InputExpr':
      const iprop = formatPropertyName(node.property);
      return ctx.input[iprop] ?? 'unknown';
    
    case 'OldExpr':
      const innerExpr = node.expression as { kind?: string; [key: string]: unknown };
      if (innerExpr?.kind === 'MemberExpr') {
        const entity = extractValue(innerExpr.object, ctx);
        if (typeof entity === 'string' && entity in ctx.oldState) {
          const field = formatPropertyName(innerExpr.property);
          const entityState = ctx.oldState[entity];
          if (typeof entityState === 'object' && entityState !== null) {
            return (entityState as Record<string, unknown>)[field];
          }
        }
      }
      return 'unknown';
    
    default:
      return 'unknown';
  }
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
  traceSlice: TraceEvent[],
  expectedOutcome: string
): boolean {
  const errorEvent = traceSlice.find(e => e.kind === 'handler_error');
  const returnEvent = traceSlice.find(e => e.kind === 'handler_return');
  
  if (expectedOutcome === 'success') {
    return !errorEvent && returnEvent !== undefined;
  }
  
  if (expectedOutcome === 'failure') {
    return errorEvent !== undefined;
  }
  
  // Specific error code
  return errorEvent?.error?.code === expectedOutcome;
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Run verification on an ISL spec
 * 
 * Returns a VerificationResult with:
 * - verdict: PROVEN | FAILED | INCOMPLETE_PROOF
 * - clauseResults: Per-clause evaluation results
 * - unknownReasons: Why certain clauses couldn't be proven
 * - evidenceRefs: References to supporting evidence
 */
export async function runVerification(config: VerifyConfig): Promise<VerificationResult> {
  const startTime = Date.now();
  const runId = generateRunId();
  
  // Initialize result
  const result: VerificationResult = {
    schemaVersion: '1.0.0',
    runId,
    timestamp: new Date().toISOString(),
    domain: 'Unknown',
    version: '0.0.0',
    verdict: 'INCOMPLETE_PROOF',
    verdictReason: 'Verification not complete',
    score: 0,
    clauseResults: [],
    unknownReasons: [],
    evidenceRefs: [],
    summary: {
      totalClauses: 0,
      proven: 0,
      violated: 0,
      unknown: 0,
      skipped: 0,
    },
    timing: {
      totalMs: 0,
    },
    exitCode: 2,
  };
  
  try {
    // Step 1: Parse spec using import-resolver
    const parseStart = Date.now();
    const domain = await parseSpec(config);
    result.timing.parseMs = Date.now() - parseStart;
    
    if (!domain) {
      result.verdict = 'FAILED';
      result.verdictReason = 'Failed to parse ISL spec';
      result.exitCode = 1;
      return result;
    }
    
    result.domain = domain.name?.value || 'Unknown';
    result.version = domain.version?.value || '0.0.0';
    
    // Step 2: Extract clauses
    const clauses = extractClauses(domain);
    result.summary.totalClauses = clauses.length;
    
    if (clauses.length === 0) {
      result.verdict = 'PROVEN';
      result.verdictReason = 'No clauses to verify';
      result.score = 100;
      result.exitCode = 0;
      return result;
    }
    
    // Step 3: Collect traces
    const traceStart = Date.now();
    let traces: ExecutionTrace[] = [];
    
    if (config.traces) {
      traces = config.traces;
    } else if (config.traceDir) {
      const traceResult = await collectTraces({ traceDir: config.traceDir });
      traces = traceResult.traces;
    }
    result.timing.traceCollectorMs = Date.now() - traceStart;
    
    // Step 4: Evaluate each clause
    const evalStart = Date.now();
    
    for (const clause of clauses) {
      const clauseResult = evaluateClause(clause, traces);
      result.clauseResults.push(clauseResult);
      
      // Track unknown reasons
      if (clauseResult.status === 'not_proven' && clauseResult.reason) {
        result.unknownReasons.push({
          clauseId: clause.id,
          category: categorizeUnknownReason(clauseResult.reason),
          message: clauseResult.reason,
        });
      }
      
      // Add evidence refs for proven/violated clauses
      if (clauseResult.status === 'proven' || clauseResult.status === 'violated') {
        const evidenceRef = findEvidence(clause, traces);
        if (evidenceRef) {
          result.evidenceRefs.push(evidenceRef);
        }
      }
      
      // Update summary
      switch (clauseResult.status) {
        case 'proven':
          result.summary.proven++;
          break;
        case 'violated':
          result.summary.violated++;
          break;
        case 'not_proven':
          result.summary.unknown++;
          break;
        case 'skipped':
          result.summary.skipped++;
          break;
      }
    }
    
    result.timing.evaluatorMs = Date.now() - evalStart;
    
    // Step 5: Calculate final verdict
    const { verdict, reason, score, exitCode } = calculateVerdict(result.summary);
    result.verdict = verdict;
    result.verdictReason = reason;
    result.score = score;
    result.exitCode = exitCode;
    
  } catch (error) {
    result.verdict = 'FAILED';
    result.verdictReason = `Verification error: ${error instanceof Error ? error.message : String(error)}`;
    result.exitCode = 1;
  }
  
  result.timing.totalMs = Date.now() - startTime;
  return result;
}

/**
 * Parse ISL spec using import-resolver
 */
async function parseSpec(config: VerifyConfig): Promise<DomainDeclaration | null> {
  try {
    // Try to use import-resolver
    const { resolveAndBundle, parseSingleFile } = await import('@isl-lang/import-resolver');
    
    if (config.specContent) {
      // Parse from content
      const result = parseSingleFile(config.specContent, config.specPath || 'input.isl');
      return result.success ? result.bundle : null;
    }
    
    // Resolve and bundle from file
    const result = await resolveAndBundle(config.specPath, {
      basePath: config.basePath || path.dirname(config.specPath),
      enableImports: true,
    });
    
    return result.success ? result.bundle : null;
  } catch (error) {
    // Fallback: Try direct parser
    try {
      const { parse } = await import('@isl-lang/parser');
      
      let content = config.specContent;
      if (!content && config.specPath) {
        content = await fs.readFile(config.specPath, 'utf-8');
      }
      
      if (!content) return null;
      
      const result = parse(content, config.specPath || 'input.isl');
      return result.success ? result.domain : null;
    } catch {
      return null;
    }
  }
}

/**
 * Evaluate a single clause
 */
function evaluateClause(clause: ExtractedClause, traces: ExecutionTrace[]): ClauseResult {
  const baseResult: ClauseResult = {
    clauseId: clause.id,
    type: clause.type,
    behavior: clause.behavior,
    outcome: clause.outcome,
    expression: clause.expression,
    status: 'not_proven',
    triStateResult: 'unknown',
    sourceLocation: clause.sourceLocation,
  };
  
  // Find relevant traces
  let relevantTraces = traces;
  if (clause.behavior) {
    relevantTraces = traces.filter(t => t.behavior === clause.behavior);
  }
  
  if (relevantTraces.length === 0) {
    return {
      ...baseResult,
      reason: `No traces available for ${clause.behavior ? `behavior: ${clause.behavior}` : 'verification'}`,
    };
  }
  
  // Evaluate against each trace
  let finalResult: TriState = 'unknown';
  let reason: string | undefined;
  
  for (const trace of relevantTraces) {
    const traceSlice = clause.behavior 
      ? findTraceSlice(trace, clause.behavior)
      : trace.events;
    
    if (traceSlice.length === 0) continue;
    
    // For postconditions, check if outcome matches
    if (clause.type === 'postcondition' && clause.outcome) {
      if (!matchesOutcome(traceSlice, clause.outcome)) {
        continue;
      }
    }
    
    // Build evaluation context
    const ctx = buildEvaluationContext(trace, traceSlice);
    if (!ctx) continue;
    
    // Evaluate expression
    finalResult = evaluateExpression(clause.expressionAst, ctx);
    
    if (finalResult === false) {
      reason = 'Clause evaluated to false';
      break;
    }
  }
  
  const status: ClauseStatus = 
    finalResult === true ? 'proven' :
    finalResult === false ? 'violated' : 'not_proven';
  
  return {
    ...baseResult,
    status,
    triStateResult: finalResult,
    reason,
  };
}

/**
 * Find evidence for a clause
 */
function findEvidence(clause: ExtractedClause, traces: ExecutionTrace[]): EvidenceRef | null {
  const relevantTraces = clause.behavior 
    ? traces.filter(t => t.behavior === clause.behavior)
    : traces;
  
  if (relevantTraces.length === 0) return null;
  
  const trace = relevantTraces[0];
  
  return {
    clauseId: clause.id,
    type: 'trace',
    ref: trace.id,
    summary: `Evaluated against trace ${trace.name || trace.id}`,
    location: {
      traceId: trace.id,
    },
  };
}

/**
 * Categorize unknown reason
 */
function categorizeUnknownReason(reason: string): UnknownReason['category'] {
  const lower = reason.toLowerCase();
  
  if (lower.includes('no trace')) return 'missing_trace';
  if (lower.includes('missing') || lower.includes('not found')) return 'missing_data';
  if (lower.includes('timeout')) return 'timeout';
  if (lower.includes('unsupported') || lower.includes('unknown expression')) return 'unsupported_expr';
  if (lower.includes('smt')) return 'smt_unknown';
  
  return 'evaluation_error';
}

/**
 * Calculate final verdict from summary
 */
function calculateVerdict(summary: VerificationResult['summary']): {
  verdict: PipelineVerdict;
  reason: string;
  score: number;
  exitCode: 0 | 1 | 2;
} {
  const { totalClauses, proven, violated, unknown, skipped } = summary;
  
  if (violated > 0) {
    const score = Math.max(0, Math.round((proven / totalClauses) * 100 - (violated / totalClauses) * 50));
    return {
      verdict: 'FAILED',
      reason: `${violated} clause(s) violated`,
      score,
      exitCode: 1,
    };
  }
  
  if (unknown > 0) {
    const score = Math.round((proven / totalClauses) * 100);
    return {
      verdict: 'INCOMPLETE_PROOF',
      reason: `${unknown} clause(s) could not be proven`,
      score,
      exitCode: 2,
    };
  }
  
  if (proven === totalClauses) {
    return {
      verdict: 'PROVEN',
      reason: `All ${proven} clause(s) proven`,
      score: 100,
      exitCode: 0,
    };
  }
  
  // All skipped
  return {
    verdict: 'INCOMPLETE_PROOF',
    reason: `All ${skipped} clause(s) skipped`,
    score: 0,
    exitCode: 2,
  };
}

/**
 * Generate unique run ID
 */
function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `verify-${timestamp}-${random}`;
}

// ============================================================================
// Exports
// ============================================================================

export { extractClauses, formatExpression, evaluateExpression };
