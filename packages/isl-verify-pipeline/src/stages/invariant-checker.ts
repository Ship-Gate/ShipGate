/**
 * Invariant Checker Stage
 * 
 * Checks ISL invariants (behavior, domain, entity) using execution traces.
 * Invariants are checked at appropriate points:
 * - Behavior invariants: during behavior execution
 * - Domain invariants: across all behaviors
 * - Entity invariants: for each entity instance
 * 
 * @module @isl-lang/verify-pipeline
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type {
  InvariantCheckerOutput,
  InvariantEvidence,
  ExecutionTrace,
  TraceEvent,
  TriState,
  ClauseStatus,
  InvariantScope,
  SourceLocation,
} from '../types.js';
import { flattenEvents, extractStateSnapshots } from './trace-collector.js';

// ============================================================================
// Types
// ============================================================================

export interface InvariantCheckerConfig {
  /** Domain spec */
  domain: DomainDeclaration;
  /** Execution traces */
  traces: ExecutionTrace[];
  /** Check invariants continuously (at every state change) */
  continuousCheck?: boolean;
}

interface ExtractedInvariant {
  id: string;
  scope: InvariantScope;
  behavior?: string;
  entity?: string;
  expression: string;
  expressionAst: unknown;
  sourceLocation?: SourceLocation;
}

// ============================================================================
// Invariant Extraction
// ============================================================================

/**
 * Extract all invariants from domain spec
 */
function extractInvariants(domain: DomainDeclaration): ExtractedInvariant[] {
  const invariants: ExtractedInvariant[] = [];
  
  // Extract behavior-level invariants
  for (const behavior of domain.behaviors) {
    if (!behavior.invariants) continue;
    
    for (const inv of behavior.invariants) {
      invariants.push({
        id: `${behavior.name.value}_inv_${inv.span.start.line}`,
        scope: 'behavior',
        behavior: behavior.name.value,
        expression: formatInvariantExpression(inv.expression),
        expressionAst: inv.expression,
        sourceLocation: inv.span ? {
          file: inv.span.file,
          line: inv.span.start.line,
          column: inv.span.start.column,
          endLine: inv.span.end.line,
          endColumn: inv.span.end.column,
        } : undefined,
      });
    }
  }
  
  // Extract domain-level invariants
  for (const invBlock of domain.invariants) {
    for (const inv of invBlock.invariants) {
      invariants.push({
        id: `domain_inv_${inv.span.start.line}`,
        scope: 'domain',
        expression: formatInvariantExpression(inv.expression),
        expressionAst: inv.expression,
        sourceLocation: inv.span ? {
          file: inv.span.file,
          line: inv.span.start.line,
          column: inv.span.start.column,
          endLine: inv.span.end.line,
          endColumn: inv.span.end.column,
        } : undefined,
      });
    }
  }
  
  // Extract entity-level invariants
  for (const entity of domain.entities) {
    if (!entity.invariants) continue;
    
    for (const inv of entity.invariants) {
      invariants.push({
        id: `${entity.name.value}_entity_inv_${inv.span.start.line}`,
        scope: 'entity',
        entity: entity.name.value,
        expression: formatInvariantExpression(inv.expression),
        expressionAst: inv.expression,
        sourceLocation: inv.span ? {
          file: inv.span.file,
          line: inv.span.start.line,
          column: inv.span.start.column,
          endLine: inv.span.end.line,
          endColumn: inv.span.end.column,
        } : undefined,
      });
    }
  }
  
  return invariants;
}

function formatInvariantExpression(expr: unknown): string {
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
      return `${formatInvariantExpression(node.left)} ${node.operator} ${formatInvariantExpression(node.right)}`;
    
    case 'UnaryExpr':
      return `${node.operator}${formatInvariantExpression(node.operand)}`;
    
    case 'MemberExpr':
      return `${formatInvariantExpression(node.object)}.${(node.property as { name: string }).name}`;
    
    case 'CallExpr':
      const callee = formatInvariantExpression(node.callee);
      const args = (node.arguments as unknown[]).map(formatInvariantExpression).join(', ');
      return `${callee}(${args})`;
    
    case 'QuantifierExpr':
      return `${node.quantifier} ${(node.variable as { name: string }).name} in ${formatInvariantExpression(node.collection)}: ${formatInvariantExpression(node.predicate)}`;
    
    case 'NeverLoggedExpr':
      return `${formatInvariantExpression(node.field)} never_logged`;
    
    case 'NeverStoredPlaintextExpr':
      return `${formatInvariantExpression(node.field)} never_stored_plaintext`;
    
    default:
      return JSON.stringify(node);
  }
}

// ============================================================================
// Evaluation Context
// ============================================================================

interface InvariantContext {
  state: Record<string, unknown>;
  entityInstance?: Record<string, unknown>;
  trace: ExecutionTrace;
  events: TraceEvent[];
  variables: Map<string, unknown>;
}

// ============================================================================
// Invariant Evaluation
// ============================================================================

function evaluateInvariant(expr: unknown, ctx: InvariantContext): TriState {
  if (!expr || typeof expr !== 'object') return 'unknown';
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  try {
    switch (node.kind) {
      case 'Identifier':
        return evaluateInvariantIdentifier(node.name as string, ctx);
      
      case 'BooleanLiteral':
        return node.value as boolean;
      
      case 'BinaryExpr':
        return evaluateInvariantBinaryExpr(node, ctx);
      
      case 'UnaryExpr':
        return evaluateInvariantUnaryExpr(node, ctx);
      
      case 'MemberExpr':
        return evaluateInvariantMemberExpr(node, ctx);
      
      case 'CallExpr':
        return evaluateInvariantCallExpr(node, ctx);
      
      case 'QuantifierExpr':
        return evaluateInvariantQuantifierExpr(node, ctx);
      
      case 'NeverLoggedExpr':
        return evaluateNeverLogged(node, ctx);
      
      case 'NeverStoredPlaintextExpr':
        return evaluateNeverStoredPlaintext(node, ctx);
      
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

function evaluateInvariantIdentifier(name: string, ctx: InvariantContext): TriState {
  if (name === 'true') return true;
  if (name === 'false') return false;
  
  if (ctx.variables.has(name)) {
    const val = ctx.variables.get(name);
    return val !== null && val !== undefined;
  }
  
  // Check entity instance (for entity-level invariants)
  if (ctx.entityInstance && name in ctx.entityInstance) {
    return ctx.entityInstance[name] !== null && ctx.entityInstance[name] !== undefined;
  }
  
  return 'unknown';
}

function evaluateInvariantBinaryExpr(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  const op = node.operator as string;
  
  // Logical operators
  if (op === 'and' || op === '&&') {
    const left = evaluateInvariant(node.left, ctx);
    if (left === false) return false;
    const right = evaluateInvariant(node.right, ctx);
    if (left === 'unknown' || right === 'unknown') return 'unknown';
    return left && right;
  }
  
  if (op === 'or' || op === '||') {
    const left = evaluateInvariant(node.left, ctx);
    if (left === true) return true;
    const right = evaluateInvariant(node.right, ctx);
    if (left === 'unknown' || right === 'unknown') return 'unknown';
    return left || right;
  }
  
  if (op === 'implies' || op === '=>') {
    const left = evaluateInvariant(node.left, ctx);
    if (left === false) return true;
    if (left === 'unknown') return 'unknown';
    return evaluateInvariant(node.right, ctx);
  }
  
  // Comparison operators
  const leftVal = extractInvariantValue(node.left, ctx);
  const rightVal = extractInvariantValue(node.right, ctx);
  
  if (leftVal === 'unknown' || rightVal === 'unknown') return 'unknown';
  
  switch (op) {
    case '==': return leftVal === rightVal;
    case '!=': return leftVal !== rightVal;
    case '<': return (leftVal as number) < (rightVal as number);
    case '<=': return (leftVal as number) <= (rightVal as number);
    case '>': return (leftVal as number) > (rightVal as number);
    case '>=': return (leftVal as number) >= (rightVal as number);
    default: return 'unknown';
  }
}

function evaluateInvariantUnaryExpr(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  const op = node.operator as string;
  const operand = evaluateInvariant(node.operand, ctx);
  
  if (operand === 'unknown') return 'unknown';
  
  switch (op) {
    case 'not':
    case '!':
      return !operand;
    default:
      return 'unknown';
  }
}

function evaluateInvariantMemberExpr(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  const objVal = extractInvariantValue(node.object, ctx);
  if (objVal === 'unknown' || objVal === null || objVal === undefined) return 'unknown';
  
  const prop = (node.property as { name: string }).name;
  
  if (typeof objVal === 'object' && prop in (objVal as Record<string, unknown>)) {
    const val = (objVal as Record<string, unknown>)[prop];
    return val !== null && val !== undefined;
  }
  
  return 'unknown';
}

function evaluateInvariantCallExpr(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  // Handle special invariant calls (Entity.exists, etc.)
  return 'unknown';
}

function evaluateInvariantQuantifierExpr(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  const quantifier = node.quantifier as 'all' | 'any' | 'forall' | 'exists';
  const variable = (node.variable as { name: string }).name;
  const collection = extractInvariantValue(node.collection, ctx);
  
  if (collection === 'unknown' || !Array.isArray(collection)) return 'unknown';
  
  if (collection.length === 0) {
    return quantifier === 'all' || quantifier === 'forall' ? true : false;
  }
  
  const results: TriState[] = [];
  for (const item of collection) {
    const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
    innerCtx.variables.set(variable, item);
    results.push(evaluateInvariant(node.predicate, innerCtx));
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

/**
 * Check that a field was never logged
 */
function evaluateNeverLogged(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  const field = formatInvariantExpression(node.field);
  
  // Check all trace events for any logging of the field
  for (const event of ctx.events) {
    // Check if any check event indicates the field was logged
    if (event.check?.category === 'invariant' && event.check.expression.includes(field)) {
      if (!event.check.passed) return false;
    }
    
    // Check nested events
    if (event.events) {
      const nestedCtx = { ...ctx, events: event.events };
      const nestedResult = evaluateNeverLogged(node, nestedCtx);
      if (nestedResult === false) return false;
    }
  }
  
  // If we have check events that confirm this, return true
  const hasConfirmation = ctx.events.some(e => 
    e.check?.category === 'invariant' && 
    e.check.expression.includes('never_logged') &&
    e.check.expression.includes(field) &&
    e.check.passed
  );
  
  return hasConfirmation ? true : 'unknown';
}

/**
 * Check that a field was never stored in plaintext
 */
function evaluateNeverStoredPlaintext(node: { [key: string]: unknown }, ctx: InvariantContext): TriState {
  const field = formatInvariantExpression(node.field);
  
  // Check state changes for the field
  for (const event of ctx.events) {
    if (event.stateChange && event.stateChange.path.includes(field)) {
      // Check if the new value looks like plaintext (not hashed)
      const newValue = event.stateChange.newValue;
      if (typeof newValue === 'string' && !looksLikeHash(newValue)) {
        return false;
      }
    }
    
    // Check nested events
    if (event.events) {
      const nestedCtx = { ...ctx, events: event.events };
      const nestedResult = evaluateNeverStoredPlaintext(node, nestedCtx);
      if (nestedResult === false) return false;
    }
  }
  
  // If we have check events that confirm this, return true
  const hasConfirmation = ctx.events.some(e => 
    e.check?.category === 'invariant' && 
    e.check.expression.includes('never_stored_plaintext') &&
    e.check.expression.includes(field) &&
    e.check.passed
  );
  
  return hasConfirmation ? true : 'unknown';
}

function looksLikeHash(value: string): boolean {
  // Common hash patterns
  const hashPatterns = [
    /^\$2[aby]?\$\d+\$/,  // bcrypt
    /^[a-f0-9]{64}$/i,    // SHA-256
    /^[a-f0-9]{128}$/i,   // SHA-512
    /^pbkdf2:/,           // PBKDF2
    /^argon2/,            // Argon2
  ];
  
  return hashPatterns.some(p => p.test(value));
}

function extractInvariantValue(expr: unknown, ctx: InvariantContext): unknown {
  if (!expr || typeof expr !== 'object') return expr;
  
  const node = expr as { kind?: string; [key: string]: unknown };
  
  switch (node.kind) {
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'BooleanLiteral':
      return node.value;
    
    case 'Identifier':
      const name = node.name as string;
      if (ctx.variables.has(name)) return ctx.variables.get(name);
      if (ctx.entityInstance && name in ctx.entityInstance) return ctx.entityInstance[name];
      return 'unknown';
    
    case 'MemberExpr':
      const objVal = extractInvariantValue(node.object, ctx);
      if (objVal === 'unknown' || objVal === null || objVal === undefined) return 'unknown';
      const prop = (node.property as { name: string }).name;
      if (typeof objVal === 'object' && prop in (objVal as Record<string, unknown>)) {
        return (objVal as Record<string, unknown>)[prop];
      }
      return 'unknown';
    
    default:
      return 'unknown';
  }
}

// ============================================================================
// Main Checker
// ============================================================================

/**
 * Check all invariants
 */
export async function checkInvariants(
  config: InvariantCheckerConfig
): Promise<InvariantCheckerOutput> {
  const invariants = extractInvariants(config.domain);
  const evidence: InvariantEvidence[] = [];
  
  const byScope: Record<InvariantScope, { total: number; proven: number; violated: number; notProven: number }> = {
    behavior: { total: 0, proven: 0, violated: 0, notProven: 0 },
    domain: { total: 0, proven: 0, violated: 0, notProven: 0 },
    entity: { total: 0, proven: 0, violated: 0, notProven: 0 },
  };
  
  for (const invariant of invariants) {
    byScope[invariant.scope].total++;
    
    // Determine which traces to check based on scope
    let tracesToCheck: ExecutionTrace[];
    
    if (invariant.scope === 'behavior' && invariant.behavior) {
      tracesToCheck = config.traces.filter(t => t.behavior === invariant.behavior);
    } else {
      tracesToCheck = config.traces;
    }
    
    if (tracesToCheck.length === 0) {
      evidence.push({
        clauseId: invariant.id,
        type: 'invariant',
        scope: invariant.scope,
        behavior: invariant.behavior,
        entity: invariant.entity,
        expression: invariant.expression,
        sourceLocation: invariant.sourceLocation,
        status: 'not_proven',
        triStateResult: 'unknown',
        reason: 'No traces available to check invariant',
        checkedAt: 'post',
      });
      byScope[invariant.scope].notProven++;
      continue;
    }
    
    // Check invariant against each trace
    let finalResult: TriState = true;
    let finalReason: string | undefined;
    let checkedAt: 'pre' | 'post' | 'continuous' = 'post';
    let traceSliceInfo: InvariantEvidence['traceSlice'];
    
    for (const trace of tracesToCheck) {
      const events = flattenEvents(trace.events);
      const { after } = extractStateSnapshots(events);
      
      const ctx: InvariantContext = {
        state: after,
        trace,
        events,
        variables: new Map(),
      };
      
      // For entity invariants, check each entity instance
      if (invariant.scope === 'entity' && invariant.entity) {
        const entities = after[invariant.entity];
        if (Array.isArray(entities)) {
          for (const instance of entities) {
            ctx.entityInstance = instance as Record<string, unknown>;
            const result = evaluateInvariant(invariant.expressionAst, ctx);
            
            if (result === false) {
              finalResult = false;
              finalReason = `Entity invariant violated for ${invariant.entity}[${(instance as Record<string, unknown>).id || 'unknown'}]`;
              break;
            } else if (result === 'unknown' && finalResult === true) {
              finalResult = 'unknown';
            }
          }
        }
      } else {
        const result = evaluateInvariant(invariant.expressionAst, ctx);
        
        if (result === false) {
          finalResult = false;
          finalReason = 'Invariant evaluated to false';
        } else if (result === 'unknown' && finalResult === true) {
          finalResult = 'unknown';
        }
      }
      
      traceSliceInfo = {
        traceId: trace.id,
        startTime: trace.startTime,
        endTime: trace.endTime || trace.startTime,
        eventCount: events.length,
      };
      
      if (finalResult === false) break;
    }
    
    const status: ClauseStatus = 
      finalResult === true ? 'proven' :
      finalResult === false ? 'violated' : 'not_proven';
    
    evidence.push({
      clauseId: invariant.id,
      type: 'invariant',
      scope: invariant.scope,
      behavior: invariant.behavior,
      entity: invariant.entity,
      expression: invariant.expression,
      sourceLocation: invariant.sourceLocation,
      status,
      triStateResult: finalResult,
      reason: finalReason,
      traceSlice: traceSliceInfo,
      checkedAt,
    });
    
    // Update counters
    if (status === 'proven') {
      byScope[invariant.scope].proven++;
    } else if (status === 'violated') {
      byScope[invariant.scope].violated++;
    } else {
      byScope[invariant.scope].notProven++;
    }
  }
  
  // Calculate summary
  const totalInvariants = evidence.length;
  const provenInvariants = evidence.filter(e => e.status === 'proven').length;
  const violatedInvariants = evidence.filter(e => e.status === 'violated').length;
  const notProvenInvariants = evidence.filter(e => e.status === 'not_proven').length;
  
  return {
    evidence,
    summary: {
      totalInvariants,
      provenInvariants,
      violatedInvariants,
      notProvenInvariants,
      byScope,
    },
  };
}

// Re-export for use in other modules
export function flattenEvents(events: TraceEvent[]): TraceEvent[] {
  const result: TraceEvent[] = [];
  for (const event of events) {
    result.push(event);
    if (event.events) {
      result.push(...flattenEvents(event.events));
    }
  }
  return result;
}
