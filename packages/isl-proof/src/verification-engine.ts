/**
 * ISL Verification Engine
 * 
 * End-to-end verification that checks ISL postconditions/invariants using:
 * - evaluator from @isl-lang/evaluator
 * - runtime trace events (from tests or proof bundle)
 * 
 * Fail-closed: if a postcondition cannot be evaluated (unknown), verdict is UNPROVEN (or INCOMPLETE_PROOF).
 * Must link each failed clause to code location + evidence.
 * 
 * @module @isl-lang/proof
 */

import type { Domain } from '@isl-lang/parser';
import type { SourceSpan } from '@isl-lang/isl-core';
import type { EvaluationContext, EntityStore, EntityStoreSnapshot } from '@isl-lang/evaluator';
import { Evaluator } from '@isl-lang/evaluator';
import { InMemoryEntityStore, SnapshotEntityStore, createSnapshotStore } from '@isl-lang/evaluator';

// ============================================================================
// Types
// ============================================================================

/**
 * Trace event from runtime execution
 */
export interface TraceEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: 'call' | 'return' | 'state_change' | 'check' | 'error';
  /** Timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, unknown>;
  /** Behavior name (if applicable) */
  behavior?: string;
  /** Input values (for call events) */
  input?: Record<string, unknown>;
  /** Output/result (for return events) */
  output?: unknown;
  /** Error (for error events) */
  error?: {
    code: string;
    message: string;
  };
  /** State snapshot before this event */
  stateBefore?: EntityStoreSnapshot;
  /** State snapshot after this event */
  stateAfter?: EntityStoreSnapshot;
}

// EntityStoreSnapshot is imported from @isl-lang/evaluator

/**
 * Trace slice - relevant events for evaluating a clause
 */
export interface TraceSlice {
  /** Events in this slice */
  events: TraceEvent[];
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Behavior name */
  behavior: string;
}

/**
 * Source span information
 */
export interface SourceSpanInfo {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Evaluation result for a clause
 */
export type EvaluationResult = 
  | { status: 'proven'; value: boolean }
  | { status: 'not_proven'; reason: string }
  | { status: 'failed'; expected: boolean; actual: boolean; error?: string };

/**
 * Evidence for a clause verification
 */
export interface ClauseEvidence {
  /** Unique clause identifier */
  clauseId: string;
  /** Clause type */
  type: 'postcondition' | 'invariant';
  /** Behavior name (if applicable) */
  behavior?: string;
  /** Source location */
  sourceSpan: SourceSpanInfo;
  /** Trace slice used for evaluation */
  traceSlice: TraceSlice;
  /** Evaluation result */
  evaluatedResult: EvaluationResult;
  /** Expression AST (for debugging) */
  expression?: unknown;
}

/**
 * Verification verdict
 */
export type VerificationVerdict = 
  | 'PROVEN'           // All clauses proven
  | 'UNPROVEN'       // Some clauses could not be evaluated
  | 'INCOMPLETE_PROOF' // Missing trace data
  | 'VIOLATED';        // Some clauses failed

/**
 * Verification result
 */
export interface VerificationResult {
  /** Overall verdict */
  verdict: VerificationVerdict;
  /** Evidence for each clause */
  evidence: ClauseEvidence[];
  /** Summary statistics */
  summary: {
    totalClauses: number;
    provenClauses: number;
    notProvenClauses: number;
    failedClauses: number;
    incompleteClauses: number;
  };
  /** Duration in milliseconds */
  durationMs: number;
}

// ============================================================================
// Verification Engine
// ============================================================================

export class VerificationEngine {
  private evaluator: Evaluator;
  private domain: Domain;
  private traces: TraceEvent[] = [];

  constructor(domain: Domain) {
    this.evaluator = new Evaluator();
    this.domain = domain;
  }

  /**
   * Load trace events from proof bundle or test execution
   */
  loadTraces(events: TraceEvent[]): this {
    this.traces = events;
    return this;
  }

  /**
   * Verify all postconditions and invariants
   */
  async verify(): Promise<VerificationResult> {
    const startTime = Date.now();
    const evidence: ClauseEvidence[] = [];

    // Extract all clauses to verify
    const clauses = this.extractClauses();

    // Group traces by behavior
    const tracesByBehavior = this.groupTracesByBehavior();

    // Verify each clause
    for (const clause of clauses) {
      const traceSlice = this.findTraceSlice(clause, tracesByBehavior);
      
      if (!traceSlice) {
        // No trace data available - fail-closed
        evidence.push({
          clauseId: clause.clauseId,
          type: clause.type,
          behavior: clause.behavior,
          sourceSpan: clause.sourceSpan,
          traceSlice: {
            events: [],
            startTime: 0,
            endTime: 0,
            behavior: clause.behavior || 'unknown',
          },
          evaluatedResult: {
            status: 'not_proven',
            reason: 'No trace data available for this clause',
          },
          expression: clause.expression,
        });
        continue;
      }

      // Evaluate the clause
      const result = await this.evaluateClause(clause, traceSlice);
      
      evidence.push({
        clauseId: clause.clauseId,
        type: clause.type,
        behavior: clause.behavior,
        sourceSpan: clause.sourceSpan,
        traceSlice,
        evaluatedResult: result,
        expression: clause.expression,
      });
    }

    // Calculate verdict
    const verdict = this.calculateVerdict(evidence);
    const summary = this.calculateSummary(evidence);

    return {
      verdict,
      evidence,
      summary,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // Clause Extraction
  // ============================================================================

  private extractClauses(): Array<{
    clauseId: string;
    type: 'postcondition' | 'invariant';
    behavior?: string;
    sourceSpan: SourceSpanInfo;
    expression: unknown;
  }> {
    const clauses: Array<{
      clauseId: string;
      type: 'postcondition' | 'invariant';
      behavior?: string;
      sourceSpan: SourceSpanInfo;
      expression: unknown;
    }> = [];

    // Extract postconditions from behaviors
    for (const behavior of this.domain.behaviors) {
      const postconditionBlocks = Array.isArray(behavior.postconditions)
        ? behavior.postconditions
        : behavior.postconditions
          ? [behavior.postconditions]
          : [];
      for (const postconditionBlock of postconditionBlocks) {
        const predicates = Array.isArray(postconditionBlock.predicates)
          ? postconditionBlock.predicates
          : postconditionBlock.predicates ? [postconditionBlock.predicates] : [];
        for (const predicate of predicates) {
          clauses.push({
            clauseId: `${behavior.name.name}_postcondition_${predicate.location.line}_${predicate.location.column}`,
            type: 'postcondition',
            behavior: behavior.name.name,
            sourceSpan: this.locationToInfo(predicate.location),
            expression: predicate,
          });
        }
      }

      // Extract invariants from behaviors
      const invariantList = Array.isArray(behavior.invariants)
        ? behavior.invariants
        : behavior.invariants
          ? [behavior.invariants]
          : [];
      for (const inv of invariantList) {
        clauses.push({
          clauseId: `${behavior.name.name}_invariant_${inv.location.line}_${inv.location.column}`,
          type: 'invariant',
          behavior: behavior.name.name,
          sourceSpan: this.locationToInfo(inv.location),
          expression: inv,
        });
      }
    }

    // Extract global invariants
    for (const invBlock of this.domain.invariants) {
      for (const inv of invBlock.predicates) {
        clauses.push({
          clauseId: `global_invariant_${inv.location.line}_${inv.location.column}`,
          type: 'invariant',
          sourceSpan: this.locationToInfo(inv.location),
          expression: inv,
        });
      }
    }

    return clauses;
  }

  private locationToInfo(location: { file?: string; line: number; column: number; endLine: number; endColumn: number }): SourceSpanInfo {
    return {
      file: location.file || 'unknown',
      startLine: location.line,
      startColumn: location.column,
      endLine: location.endLine,
      endColumn: location.endColumn,
    };
  }

  // ============================================================================
  // Trace Processing
  // ============================================================================

  private groupTracesByBehavior(): Map<string, TraceEvent[]> {
    const grouped = new Map<string, TraceEvent[]>();

    for (const event of this.traces) {
      const behavior = event.behavior || 'unknown';
      if (!grouped.has(behavior)) {
        grouped.set(behavior, []);
      }
      grouped.get(behavior)!.push(event);
    }

    // Sort events by timestamp
    for (const [behavior, events] of grouped) {
      events.sort((a, b) => a.timestamp - b.timestamp);
    }

    return grouped;
  }

  private findTraceSlice(
    clause: { behavior?: string; type: 'postcondition' | 'invariant' },
    tracesByBehavior: Map<string, TraceEvent[]>
  ): TraceSlice | null {
    const behavior = clause.behavior || 'unknown';
    const events = tracesByBehavior.get(behavior) || [];

    if (events.length === 0) {
      return null;
    }

    // For postconditions, find the return event for the behavior
    // For invariants, find all events for the behavior
    if (clause.type === 'postcondition') {
      const returnEvent = events.find(e => e.type === 'return');
      if (!returnEvent) {
        return null;
      }

      // Find the corresponding call event
      const callEvent = events.find(e => 
        e.type === 'call' && 
        e.timestamp <= returnEvent.timestamp
      );

      if (!callEvent) {
        return null;
      }

      return {
        events: events.filter(e => 
          e.timestamp >= callEvent.timestamp && 
          e.timestamp <= returnEvent.timestamp
        ),
        startTime: callEvent.timestamp,
        endTime: returnEvent.timestamp,
        behavior,
      };
    } else {
      // For invariants, use all events for the behavior
      return {
        events,
        startTime: events[0]?.timestamp || 0,
        endTime: events[events.length - 1]?.timestamp || 0,
        behavior,
      };
    }
  }

  // ============================================================================
  // Clause Evaluation
  // ============================================================================

  private async evaluateClause(
    clause: { expression: unknown; type: 'postcondition' | 'invariant' },
    traceSlice: TraceSlice
  ): Promise<EvaluationResult> {
    try {
      // Find the relevant state snapshots
      const returnEvent = traceSlice.events.find(e => e.type === 'return');
      const callEvent = traceSlice.events.find(e => e.type === 'call');

      if (!callEvent) {
        return {
          status: 'not_proven',
          reason: 'No call event found in trace slice',
        };
      }

      // Build evaluation context
      const context = this.buildEvaluationContext(
        callEvent,
        returnEvent,
        traceSlice
      );

      // Evaluate the expression
      const result = this.evaluator.evaluate(clause.expression, context);

      // Check if result is boolean
      if (typeof result !== 'boolean') {
        return {
          status: 'not_proven',
          reason: `Expression evaluated to non-boolean: ${typeof result}`,
        };
      }

      if (result === true) {
        return { status: 'proven', value: true };
      } else {
        return {
          status: 'failed',
          expected: true,
          actual: false,
        };
      }
    } catch (error) {
      // Evaluation error - fail-closed
      return {
        status: 'not_proven',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildEvaluationContext(
    callEvent: TraceEvent,
    returnEvent: TraceEvent | undefined,
    traceSlice: TraceSlice
  ): EvaluationContext {
    // Create entity store from state snapshots
    const store = this.createEntityStore(callEvent.stateBefore, returnEvent?.stateAfter);
    const oldStore = callEvent.stateBefore 
      ? this.createEntityStore(callEvent.stateBefore, undefined)
      : undefined;

    return {
      input: callEvent.input || {},
      result: returnEvent?.output,
      error: returnEvent?.error ? {
        code: returnEvent.error.code,
        message: returnEvent.error.message,
        retriable: false,
      } : undefined,
      store,
      oldState: oldStore ? this.snapshotFromStore(oldStore) : undefined,
      domain: {
        name: this.domain.name.name,
        entities: this.domain.entities.map(e => ({
          name: e.name.name,
          fields: e.fields.map(f => ({
            name: f.name.name,
            type: f.type,
            optional: f.optional,
          })),
        })),
      },
      now: new Date(callEvent.timestamp),
      variables: new Map(),
    };
  }

  private createEntityStore(
    before?: EntityStoreSnapshot,
    after?: EntityStoreSnapshot
  ): EntityStore {
    // Use after state if available, otherwise before
    const snapshot = after || before;
    
    if (!snapshot) {
      return new InMemoryEntityStore();
    }

    const store = new InMemoryEntityStore();
    
    // Restore entities from snapshot
    for (const [entityName, instances] of snapshot.entities) {
      for (const [id, instance] of instances) {
        try {
          // Create entity with the instance data
          store.create(entityName, { ...instance });
        } catch {
          // Entity might already exist, skip
        }
      }
    }

    return store;
  }

  private snapshotFromStore(store: EntityStore): EntityStoreSnapshot {
    return store.snapshot();
  }

  // ============================================================================
  // Verdict Calculation
  // ============================================================================

  private calculateVerdict(evidence: ClauseEvidence[]): VerificationVerdict {
    if (evidence.length === 0) {
      return 'INCOMPLETE_PROOF';
    }

    const hasFailed = evidence.some(e => e.evaluatedResult.status === 'failed');
    if (hasFailed) {
      return 'VIOLATED';
    }

    const hasNotProven = evidence.some(e => e.evaluatedResult.status === 'not_proven');
    if (hasNotProven) {
      return 'UNPROVEN';
    }

    const allProven = evidence.every(e => e.evaluatedResult.status === 'proven');
    if (allProven) {
      return 'PROVEN';
    }

    return 'INCOMPLETE_PROOF';
  }

  private calculateSummary(evidence: ClauseEvidence[]): VerificationResult['summary'] {
    let provenClauses = 0;
    let notProvenClauses = 0;
    let failedClauses = 0;
    let incompleteClauses = 0;

    for (const ev of evidence) {
      switch (ev.evaluatedResult.status) {
        case 'proven':
          provenClauses++;
          break;
        case 'not_proven':
          notProvenClauses++;
          break;
        case 'failed':
          failedClauses++;
          break;
      }

      if (ev.traceSlice.events.length === 0) {
        incompleteClauses++;
      }
    }

    return {
      totalClauses: evidence.length,
      provenClauses,
      notProvenClauses,
      failedClauses,
      incompleteClauses,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Verify a domain against trace events
 */
export async function verifyDomain(
  domain: Domain,
  traces: TraceEvent[]
): Promise<VerificationResult> {
  const engine = new VerificationEngine(domain);
  engine.loadTraces(traces);
  return engine.verify();
}
