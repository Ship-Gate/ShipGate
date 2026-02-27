/**
 * Invariant Violation Recorder
 * 
 * Records and analyzes invariant violations during chaos verification.
 * Maps violations to spec clauses for traceability.
 */

import type { SpecClauseRef, InvariantViolation, ChaosEvent } from './chaos-events.js';
import type { TimelineEvent } from './timeline.js';

/* ------------------------------------------------------------------ */
/*  Invariant Types                                                    */
/* ------------------------------------------------------------------ */

export type InvariantCategory = 
  | 'state_consistency'
  | 'data_integrity'
  | 'ordering'
  | 'timing'
  | 'idempotency'
  | 'atomicity'
  | 'isolation'
  | 'durability';

export type InvariantSeverity = 'warning' | 'error' | 'critical';

/* ------------------------------------------------------------------ */
/*  Invariant Definition                                               */
/* ------------------------------------------------------------------ */

export interface InvariantDef {
  /** Unique invariant ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this invariant checks */
  description: string;
  /** Category of invariant */
  category: InvariantCategory;
  /** Severity if violated */
  severity: InvariantSeverity;
  /** Spec clauses this invariant maps to */
  specClauses: SpecClauseRef[];
  /** Predicate function to check invariant */
  check: (context: InvariantContext) => InvariantCheckResult;
}

export interface InvariantContext {
  /** Current state snapshot */
  state: Record<string, unknown>;
  /** Previous state snapshot (if available) */
  previousState?: Record<string, unknown>;
  /** Current operation being executed */
  operation?: string;
  /** Operation arguments */
  args?: Record<string, unknown>;
  /** Operation result */
  result?: unknown;
  /** Any error that occurred */
  error?: Error;
  /** Timeline of events so far */
  timeline: TimelineEvent[];
  /** Chaos events that have been injected */
  chaosEvents: ChaosEvent[];
}

export interface InvariantCheckResult {
  /** Whether the invariant passed */
  passed: boolean;
  /** Violation details if failed */
  violation?: InvariantViolation;
  /** Additional context */
  context?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Violation Record                                                   */
/* ------------------------------------------------------------------ */

export interface ViolationRecord {
  /** Unique violation ID */
  id: string;
  /** Timestamp when violation was detected */
  timestamp: number;
  /** The invariant that was violated */
  invariant: InvariantDef;
  /** The violation details */
  violation: InvariantViolation;
  /** Chaos event that triggered this (if any) */
  triggeringEvent?: ChaosEvent;
  /** State at time of violation */
  stateSnapshot?: Record<string, unknown>;
  /** Stack trace if available */
  stackTrace?: string;
}

/* ------------------------------------------------------------------ */
/*  Violation Recorder                                                 */
/* ------------------------------------------------------------------ */

export class ViolationRecorder {
  private violations: ViolationRecord[] = [];
  private invariants: Map<string, InvariantDef> = new Map();
  private violationCounter = 0;

  /** Register an invariant to check */
  registerInvariant(invariant: InvariantDef): void {
    this.invariants.set(invariant.id, invariant);
  }

  /** Register multiple invariants */
  registerInvariants(invariants: InvariantDef[]): void {
    for (const inv of invariants) {
      this.registerInvariant(inv);
    }
  }

  /** Check all registered invariants */
  checkAll(context: InvariantContext): ViolationRecord[] {
    const newViolations: ViolationRecord[] = [];

    for (const invariant of this.invariants.values()) {
      const result = invariant.check(context);
      if (!result.passed && result.violation) {
        const record = this.recordViolation(
          invariant,
          result.violation,
          context.chaosEvents[context.chaosEvents.length - 1],
          context.state
        );
        newViolations.push(record);
      }
    }

    return newViolations;
  }

  /** Check specific invariant by ID */
  checkInvariant(
    invariantId: string,
    context: InvariantContext
  ): ViolationRecord | null {
    const invariant = this.invariants.get(invariantId);
    if (!invariant) return null;

    const result = invariant.check(context);
    if (!result.passed && result.violation) {
      return this.recordViolation(
        invariant,
        result.violation,
        context.chaosEvents[context.chaosEvents.length - 1],
        context.state
      );
    }

    return null;
  }

  /** Manually record a violation */
  recordViolation(
    invariant: InvariantDef,
    violation: InvariantViolation,
    triggeringEvent?: ChaosEvent,
    stateSnapshot?: Record<string, unknown>
  ): ViolationRecord {
    const record: ViolationRecord = {
      id: `violation_${++this.violationCounter}_${Date.now().toString(36)}`,
      timestamp: Date.now(),
      invariant,
      violation,
      triggeringEvent,
      stateSnapshot: stateSnapshot ? { ...stateSnapshot } : undefined,
      stackTrace: new Error().stack,
    };

    this.violations.push(record);
    return record;
  }

  /** Get all violations */
  getViolations(): ViolationRecord[] {
    return [...this.violations];
  }

  /** Get violations by severity */
  getViolationsBySeverity(severity: InvariantSeverity): ViolationRecord[] {
    return this.violations.filter(v => v.invariant.severity === severity);
  }

  /** Get violations by category */
  getViolationsByCategory(category: InvariantCategory): ViolationRecord[] {
    return this.violations.filter(v => v.invariant.category === category);
  }

  /** Get violations for specific spec clause */
  getViolationsForClause(behavior: string, clause: string): ViolationRecord[] {
    return this.violations.filter(v =>
      v.invariant.specClauses.some(
        sc => sc.behavior === behavior && sc.clause === clause
      )
    );
  }

  /** Get critical violations */
  getCriticalViolations(): ViolationRecord[] {
    return this.getViolationsBySeverity('critical');
  }

  /** Check if any critical violations exist */
  hasCriticalViolations(): boolean {
    return this.getCriticalViolations().length > 0;
  }

  /** Get violation count */
  count(): number {
    return this.violations.length;
  }

  /** Clear all violations */
  clear(): void {
    this.violations = [];
    this.violationCounter = 0;
  }

  /** Generate violation report */
  generateReport(): ViolationReport {
    const bySeverity: Record<InvariantSeverity, number> = {
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byCategory: Record<InvariantCategory, number> = {
      state_consistency: 0,
      data_integrity: 0,
      ordering: 0,
      timing: 0,
      idempotency: 0,
      atomicity: 0,
      isolation: 0,
      durability: 0,
    };

    const byInvariant: Map<string, number> = new Map();

    for (const v of this.violations) {
      bySeverity[v.invariant.severity]++;
      byCategory[v.invariant.category]++;
      byInvariant.set(
        v.invariant.id,
        (byInvariant.get(v.invariant.id) ?? 0) + 1
      );
    }

    return {
      totalViolations: this.violations.length,
      bySeverity,
      byCategory,
      byInvariant: Object.fromEntries(byInvariant),
      violations: this.violations.map(v => ({
        id: v.id,
        timestamp: v.timestamp,
        invariantId: v.invariant.id,
        invariantName: v.invariant.name,
        severity: v.invariant.severity,
        category: v.invariant.category,
        expected: v.violation.expected,
        actual: v.violation.actual,
        specClauses: v.invariant.specClauses,
        triggeringEventId: v.triggeringEvent?.id,
      })),
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Violation Report                                                   */
/* ------------------------------------------------------------------ */

export interface ViolationReport {
  totalViolations: number;
  bySeverity: Record<InvariantSeverity, number>;
  byCategory: Record<InvariantCategory, number>;
  byInvariant: Record<string, number>;
  violations: ViolationSummary[];
}

export interface ViolationSummary {
  id: string;
  timestamp: number;
  invariantId: string;
  invariantName: string;
  severity: InvariantSeverity;
  category: InvariantCategory;
  expected: unknown;
  actual: unknown;
  specClauses: SpecClauseRef[];
  triggeringEventId?: string;
}

/* ------------------------------------------------------------------ */
/*  Built-in Invariants                                                */
/* ------------------------------------------------------------------ */

export const STATE_CONSISTENCY_INVARIANTS: InvariantDef[] = [
  {
    id: 'no_partial_state',
    name: 'No Partial State Updates',
    description: 'State updates must be atomic - no partial writes visible',
    category: 'state_consistency',
    severity: 'critical',
    specClauses: [],
    check: (ctx) => {
      // Check if state has any undefined or null values that shouldn't be
      const invalidKeys = Object.entries(ctx.state)
        .filter(([_, v]) => v === undefined)
        .map(([k]) => k);

      if (invalidKeys.length > 0) {
        return {
          passed: false,
          violation: {
            invariant: 'no_partial_state',
            expected: 'All state fields should be defined',
            actual: `Undefined fields: ${invalidKeys.join(', ')}`,
          },
        };
      }
      return { passed: true };
    },
  },
  {
    id: 'monotonic_version',
    name: 'Monotonic Version Numbers',
    description: 'Version numbers must only increase',
    category: 'state_consistency',
    severity: 'error',
    specClauses: [],
    check: (ctx) => {
      const currentVersion = ctx.state.version as number | undefined;
      const previousVersion = ctx.previousState?.version as number | undefined;

      if (
        currentVersion !== undefined &&
        previousVersion !== undefined &&
        currentVersion < previousVersion
      ) {
        return {
          passed: false,
          violation: {
            invariant: 'monotonic_version',
            expected: `Version >= ${previousVersion}`,
            actual: currentVersion,
          },
        };
      }
      return { passed: true };
    },
  },
];

export const DATA_INTEGRITY_INVARIANTS: InvariantDef[] = [
  {
    id: 'referential_integrity',
    name: 'Referential Integrity',
    description: 'Foreign key references must be valid',
    category: 'data_integrity',
    severity: 'critical',
    specClauses: [],
    check: (ctx) => {
      // Generic check - implementations should customize
      const refs = ctx.state._references as Array<{ from: string; to: string }> | undefined;
      if (!refs) return { passed: true };

      const entities = ctx.state._entities as Set<string> | undefined;
      if (!entities) return { passed: true };

      const brokenRefs = refs.filter(r => !entities.has(r.to));
      if (brokenRefs.length > 0) {
        return {
          passed: false,
          violation: {
            invariant: 'referential_integrity',
            expected: 'All references point to existing entities',
            actual: `Broken references: ${brokenRefs.map(r => `${r.from} -> ${r.to}`).join(', ')}`,
          },
        };
      }
      return { passed: true };
    },
  },
];

export const IDEMPOTENCY_INVARIANTS: InvariantDef[] = [
  {
    id: 'idempotent_result',
    name: 'Idempotent Operation Result',
    description: 'Repeated operations with same ID must return same result',
    category: 'idempotency',
    severity: 'critical',
    specClauses: [],
    check: (ctx) => {
      const idempotencyKey = ctx.args?.idempotencyKey as string | undefined;
      if (!idempotencyKey) return { passed: true };

      const previousResults = ctx.state._idempotencyCache as Map<string, unknown> | undefined;
      if (!previousResults) return { passed: true };

      const previousResult = previousResults.get(idempotencyKey);
      if (previousResult !== undefined) {
        const currentResult = JSON.stringify(ctx.result);
        const cachedResult = JSON.stringify(previousResult);

        if (currentResult !== cachedResult) {
          return {
            passed: false,
            violation: {
              invariant: 'idempotent_result',
              expected: cachedResult,
              actual: currentResult,
              context: { idempotencyKey },
            },
          };
        }
      }
      return { passed: true };
    },
  },
];

export const TIMING_INVARIANTS: InvariantDef[] = [
  {
    id: 'causal_ordering',
    name: 'Causal Ordering',
    description: 'Events must respect causal dependencies',
    category: 'ordering',
    severity: 'error',
    specClauses: [],
    check: (ctx) => {
      // Check timeline for ordering violations
      let lastTimestamp = 0;
      for (const event of ctx.timeline) {
        if (event.timestamp < lastTimestamp) {
          return {
            passed: false,
            violation: {
              invariant: 'causal_ordering',
              expected: `Timestamp >= ${lastTimestamp}`,
              actual: event.timestamp,
              context: { eventId: event.id },
            },
          };
        }
        lastTimestamp = event.timestamp;
      }
      return { passed: true };
    },
  },
];

export const ATOMICITY_INVARIANTS: InvariantDef[] = [
  {
    id: 'all_or_nothing',
    name: 'All-or-Nothing Transactions',
    description: 'Transaction effects must be fully applied or fully rolled back',
    category: 'atomicity',
    severity: 'critical',
    specClauses: [],
    check: (ctx) => {
      const txnState = ctx.state._transaction as {
        started: boolean;
        committed: boolean;
        rolledBack: boolean;
        changes: string[];
      } | undefined;

      if (!txnState) return { passed: true };

      // If transaction failed but changes exist, that's a violation
      if (txnState.rolledBack && txnState.changes.length > 0) {
        return {
          passed: false,
          violation: {
            invariant: 'all_or_nothing',
            expected: 'No changes after rollback',
            actual: `Changes present: ${txnState.changes.join(', ')}`,
          },
        };
      }

      // If transaction not committed but changes visible
      if (!txnState.committed && !txnState.rolledBack && txnState.changes.length > 0) {
        return {
          passed: false,
          violation: {
            invariant: 'all_or_nothing',
            expected: 'No changes visible before commit',
            actual: `Uncommitted changes visible: ${txnState.changes.join(', ')}`,
          },
        };
      }

      return { passed: true };
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Invariant Registry                                                 */
/* ------------------------------------------------------------------ */

export class InvariantRegistry {
  private invariants: Map<string, InvariantDef> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    for (const inv of STATE_CONSISTENCY_INVARIANTS) {
      this.register(inv);
    }
    for (const inv of DATA_INTEGRITY_INVARIANTS) {
      this.register(inv);
    }
    for (const inv of IDEMPOTENCY_INVARIANTS) {
      this.register(inv);
    }
    for (const inv of TIMING_INVARIANTS) {
      this.register(inv);
    }
    for (const inv of ATOMICITY_INVARIANTS) {
      this.register(inv);
    }
  }

  register(invariant: InvariantDef): void {
    this.invariants.set(invariant.id, invariant);
  }

  get(id: string): InvariantDef | undefined {
    return this.invariants.get(id);
  }

  getByCategory(category: InvariantCategory): InvariantDef[] {
    return Array.from(this.invariants.values())
      .filter(inv => inv.category === category);
  }

  getBySeverity(severity: InvariantSeverity): InvariantDef[] {
    return Array.from(this.invariants.values())
      .filter(inv => inv.severity === severity);
  }

  all(): InvariantDef[] {
    return Array.from(this.invariants.values());
  }
}

/* ------------------------------------------------------------------ */
/*  Factory Functions                                                  */
/* ------------------------------------------------------------------ */

export function createViolationRecorder(): ViolationRecorder {
  const recorder = new ViolationRecorder();
  const registry = new InvariantRegistry();
  recorder.registerInvariants(registry.all());
  return recorder;
}

export function createInvariantRegistry(): InvariantRegistry {
  return new InvariantRegistry();
}

export function createCustomInvariant(
  id: string,
  name: string,
  description: string,
  category: InvariantCategory,
  severity: InvariantSeverity,
  check: (context: InvariantContext) => InvariantCheckResult,
  specClauses: SpecClauseRef[] = []
): InvariantDef {
  return {
    id,
    name,
    description,
    category,
    severity,
    specClauses,
    check,
  };
}

/* ------------------------------------------------------------------ */
/*  Violation Serialization                                            */
/* ------------------------------------------------------------------ */

export interface SerializedViolationRecord {
  id: string;
  timestamp: number;
  invariantId: string;
  invariantName: string;
  invariantCategory: InvariantCategory;
  invariantSeverity: InvariantSeverity;
  violation: InvariantViolation;
  triggeringEventId?: string;
  stackTrace?: string;
}

export function serializeViolation(record: ViolationRecord): SerializedViolationRecord {
  return {
    id: record.id,
    timestamp: record.timestamp,
    invariantId: record.invariant.id,
    invariantName: record.invariant.name,
    invariantCategory: record.invariant.category,
    invariantSeverity: record.invariant.severity,
    violation: record.violation,
    triggeringEventId: record.triggeringEvent?.id,
    stackTrace: record.stackTrace,
  };
}

export function serializeViolations(records: ViolationRecord[]): SerializedViolationRecord[] {
  return records.map(serializeViolation);
}
