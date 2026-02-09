/**
 * Chaos Events
 * 
 * Formalized chaos event definitions with spec clause mapping.
 * Events are bounded and repeatable for deterministic verification.
 */

import type { TimelineEvent } from './timeline.js';

/* ------------------------------------------------------------------ */
/*  Event Categories                                                   */
/* ------------------------------------------------------------------ */

export type ChaosEventCategory = 
  | 'timeout'
  | 'retry'
  | 'partial_failure'
  | 'network'
  | 'database'
  | 'resource'
  | 'concurrency';

export type ChaosEventSeverity = 'low' | 'medium' | 'high' | 'critical';

/* ------------------------------------------------------------------ */
/*  Spec Clause Mapping                                                */
/* ------------------------------------------------------------------ */

export interface SpecClauseRef {
  /** Behavior name from ISL spec */
  behavior: string;
  /** Specific clause identifier (e.g., "requires.1", "ensures.timeout") */
  clause: string;
  /** Human-readable description of the clause */
  description: string;
}

/* ------------------------------------------------------------------ */
/*  Chaos Event Definition                                             */
/* ------------------------------------------------------------------ */

export interface ChaosEventDef {
  /** Unique event type identifier */
  type: string;
  /** Event category */
  category: ChaosEventCategory;
  /** Severity level */
  severity: ChaosEventSeverity;
  /** Spec clauses this event tests */
  specClauses: SpecClauseRef[];
  /** Whether this event is bounded (deterministic duration) */
  bounded: boolean;
  /** Maximum duration in ms (for bounded events) */
  maxDurationMs?: number;
  /** Whether this event supports replay */
  replayable: boolean;
  /** Parameters schema for this event */
  parameters: ChaosEventParameter[];
}

export interface ChaosEventParameter {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'enum';
  required: boolean;
  default?: unknown;
  description: string;
  enumValues?: string[];
  min?: number;
  max?: number;
}

/* ------------------------------------------------------------------ */
/*  Chaos Event Instance                                               */
/* ------------------------------------------------------------------ */

export interface ChaosEvent {
  /** Unique event instance ID */
  id: string;
  /** Event type (from ChaosEventDef) */
  type: string;
  /** Timestamp when event was triggered */
  timestamp: number;
  /** Seed used for deterministic replay */
  seed: number;
  /** Event parameters */
  parameters: Record<string, unknown>;
  /** Spec clauses being tested */
  specClauses: SpecClauseRef[];
  /** Event outcome */
  outcome?: ChaosEventOutcome;
}

export interface ChaosEventOutcome {
  /** Whether the system handled the event correctly */
  handled: boolean;
  /** Duration of the event */
  durationMs: number;
  /** Recovery mechanism used (if any) */
  recoveryMechanism?: string;
  /** Any violations observed */
  violations: InvariantViolation[];
  /** Raw error if any */
  error?: Error;
}

export interface InvariantViolation {
  /** Which invariant was violated */
  invariant: string;
  /** Expected value/state */
  expected: unknown;
  /** Actual value/state */
  actual: unknown;
  /** Spec clause reference */
  specClause?: SpecClauseRef;
  /** Additional context */
  context?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Built-in Event Definitions                                         */
/* ------------------------------------------------------------------ */

export const TIMEOUT_EVENTS: ChaosEventDef[] = [
  {
    type: 'request_timeout',
    category: 'timeout',
    severity: 'medium',
    specClauses: [],
    bounded: true,
    maxDurationMs: 30000,
    replayable: true,
    parameters: [
      {
        name: 'timeoutMs',
        type: 'number',
        required: true,
        default: 5000,
        description: 'Timeout duration in milliseconds',
        min: 100,
        max: 60000,
      },
      {
        name: 'target',
        type: 'string',
        required: false,
        description: 'Target operation or endpoint',
      },
    ],
  },
  {
    type: 'connection_timeout',
    category: 'timeout',
    severity: 'high',
    specClauses: [],
    bounded: true,
    maxDurationMs: 10000,
    replayable: true,
    parameters: [
      {
        name: 'timeoutMs',
        type: 'number',
        required: true,
        default: 3000,
        description: 'Connection timeout in milliseconds',
        min: 100,
        max: 30000,
      },
    ],
  },
  {
    type: 'query_timeout',
    category: 'timeout',
    severity: 'high',
    specClauses: [],
    bounded: true,
    maxDurationMs: 30000,
    replayable: true,
    parameters: [
      {
        name: 'timeoutMs',
        type: 'number',
        required: true,
        default: 10000,
        description: 'Query timeout in milliseconds',
        min: 1000,
        max: 120000,
      },
    ],
  },
];

export const RETRY_EVENTS: ChaosEventDef[] = [
  {
    type: 'transient_failure',
    category: 'retry',
    severity: 'low',
    specClauses: [],
    bounded: true,
    maxDurationMs: 5000,
    replayable: true,
    parameters: [
      {
        name: 'failuresBeforeSuccess',
        type: 'number',
        required: true,
        default: 2,
        description: 'Number of failures before success',
        min: 1,
        max: 10,
      },
      {
        name: 'failureType',
        type: 'enum',
        required: false,
        default: 'network',
        description: 'Type of transient failure',
        enumValues: ['network', 'database', 'service'],
      },
    ],
  },
  {
    type: 'retry_exhaustion',
    category: 'retry',
    severity: 'high',
    specClauses: [],
    bounded: true,
    maxDurationMs: 30000,
    replayable: true,
    parameters: [
      {
        name: 'maxRetries',
        type: 'number',
        required: true,
        default: 3,
        description: 'Maximum retry attempts',
        min: 1,
        max: 10,
      },
      {
        name: 'backoffMs',
        type: 'number',
        required: false,
        default: 1000,
        description: 'Backoff delay between retries',
        min: 100,
        max: 10000,
      },
    ],
  },
  {
    type: 'idempotency_violation',
    category: 'retry',
    severity: 'critical',
    specClauses: [],
    bounded: true,
    maxDurationMs: 10000,
    replayable: true,
    parameters: [
      {
        name: 'duplicateCount',
        type: 'number',
        required: true,
        default: 2,
        description: 'Number of duplicate requests',
        min: 2,
        max: 5,
      },
    ],
  },
];

export const PARTIAL_FAILURE_EVENTS: ChaosEventDef[] = [
  {
    type: 'partial_success',
    category: 'partial_failure',
    severity: 'medium',
    specClauses: [],
    bounded: true,
    maxDurationMs: 10000,
    replayable: true,
    parameters: [
      {
        name: 'successRate',
        type: 'number',
        required: true,
        default: 0.5,
        description: 'Fraction of operations that succeed (0-1)',
        min: 0,
        max: 1,
      },
      {
        name: 'totalOperations',
        type: 'number',
        required: false,
        default: 10,
        description: 'Total number of operations',
        min: 2,
        max: 100,
      },
    ],
  },
  {
    type: 'cascade_failure',
    category: 'partial_failure',
    severity: 'critical',
    specClauses: [],
    bounded: true,
    maxDurationMs: 30000,
    replayable: true,
    parameters: [
      {
        name: 'initialFailurePoint',
        type: 'string',
        required: true,
        description: 'Service/component where failure originates',
      },
      {
        name: 'propagationDelayMs',
        type: 'number',
        required: false,
        default: 100,
        description: 'Delay before failure propagates',
        min: 0,
        max: 5000,
      },
    ],
  },
  {
    type: 'data_inconsistency',
    category: 'partial_failure',
    severity: 'critical',
    specClauses: [],
    bounded: true,
    maxDurationMs: 5000,
    replayable: true,
    parameters: [
      {
        name: 'inconsistencyType',
        type: 'enum',
        required: true,
        default: 'stale_read',
        description: 'Type of data inconsistency',
        enumValues: ['stale_read', 'dirty_write', 'lost_update', 'phantom_read'],
      },
    ],
  },
  {
    type: 'rollback_required',
    category: 'partial_failure',
    severity: 'high',
    specClauses: [],
    bounded: true,
    maxDurationMs: 15000,
    replayable: true,
    parameters: [
      {
        name: 'failurePoint',
        type: 'string',
        required: true,
        description: 'Point in transaction where failure occurs',
      },
      {
        name: 'compensationRequired',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Whether compensation actions are needed',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Event Registry                                                     */
/* ------------------------------------------------------------------ */

export class ChaosEventRegistry {
  private events: Map<string, ChaosEventDef> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    for (const event of TIMEOUT_EVENTS) {
      this.register(event);
    }
    for (const event of RETRY_EVENTS) {
      this.register(event);
    }
    for (const event of PARTIAL_FAILURE_EVENTS) {
      this.register(event);
    }
  }

  register(event: ChaosEventDef): void {
    this.events.set(event.type, event);
  }

  get(type: string): ChaosEventDef | undefined {
    return this.events.get(type);
  }

  getByCategory(category: ChaosEventCategory): ChaosEventDef[] {
    return Array.from(this.events.values()).filter(e => e.category === category);
  }

  getBySeverity(severity: ChaosEventSeverity): ChaosEventDef[] {
    return Array.from(this.events.values()).filter(e => e.severity === severity);
  }

  getReplayable(): ChaosEventDef[] {
    return Array.from(this.events.values()).filter(e => e.replayable);
  }

  getBounded(): ChaosEventDef[] {
    return Array.from(this.events.values()).filter(e => e.bounded);
  }

  all(): ChaosEventDef[] {
    return Array.from(this.events.values());
  }
}

/* ------------------------------------------------------------------ */
/*  Event Factory                                                      */
/* ------------------------------------------------------------------ */

let eventCounter = 0;

export function createChaosEvent(
  type: string,
  parameters: Record<string, unknown>,
  specClauses: SpecClauseRef[] = [],
  seed?: number
): ChaosEvent {
  const eventSeed = seed ?? Math.floor(Math.random() * 2147483647);
  
  return {
    id: `chaos_${++eventCounter}_${Date.now().toString(36)}`,
    type,
    timestamp: Date.now(),
    seed: eventSeed,
    parameters,
    specClauses,
  };
}

export function createTimeoutEvent(
  timeoutMs: number,
  target?: string,
  specClauses: SpecClauseRef[] = [],
  seed?: number
): ChaosEvent {
  return createChaosEvent(
    'request_timeout',
    { timeoutMs, target },
    specClauses,
    seed
  );
}

export function createRetryEvent(
  failuresBeforeSuccess: number,
  failureType: 'network' | 'database' | 'service' = 'network',
  specClauses: SpecClauseRef[] = [],
  seed?: number
): ChaosEvent {
  return createChaosEvent(
    'transient_failure',
    { failuresBeforeSuccess, failureType },
    specClauses,
    seed
  );
}

export function createPartialFailureEvent(
  successRate: number,
  totalOperations: number = 10,
  specClauses: SpecClauseRef[] = [],
  seed?: number
): ChaosEvent {
  return createChaosEvent(
    'partial_success',
    { successRate, totalOperations },
    specClauses,
    seed
  );
}

/* ------------------------------------------------------------------ */
/*  Spec Clause Binding                                                */
/* ------------------------------------------------------------------ */

export function bindSpecClause(
  event: ChaosEvent,
  behavior: string,
  clause: string,
  description: string
): ChaosEvent {
  return {
    ...event,
    specClauses: [
      ...event.specClauses,
      { behavior, clause, description },
    ],
  };
}

export function mapEventToSpec(
  eventDef: ChaosEventDef,
  behavior: string,
  clauseMappings: Array<{ clause: string; description: string }>
): ChaosEventDef {
  return {
    ...eventDef,
    specClauses: clauseMappings.map(m => ({
      behavior,
      clause: m.clause,
      description: m.description,
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Event Serialization                                                */
/* ------------------------------------------------------------------ */

export interface SerializedChaosEvent {
  id: string;
  type: string;
  timestamp: number;
  seed: number;
  parameters: Record<string, unknown>;
  specClauses: SpecClauseRef[];
  outcome?: {
    handled: boolean;
    durationMs: number;
    recoveryMechanism?: string;
    violations: InvariantViolation[];
    errorMessage?: string;
  };
}

export function serializeChaosEvent(event: ChaosEvent): SerializedChaosEvent {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    seed: event.seed,
    parameters: event.parameters,
    specClauses: event.specClauses,
    outcome: event.outcome ? {
      handled: event.outcome.handled,
      durationMs: event.outcome.durationMs,
      recoveryMechanism: event.outcome.recoveryMechanism,
      violations: event.outcome.violations,
      errorMessage: event.outcome.error?.message,
    } : undefined,
  };
}

export function deserializeChaosEvent(data: SerializedChaosEvent): ChaosEvent {
  return {
    id: data.id,
    type: data.type,
    timestamp: data.timestamp,
    seed: data.seed,
    parameters: data.parameters,
    specClauses: data.specClauses,
    outcome: data.outcome ? {
      handled: data.outcome.handled,
      durationMs: data.outcome.durationMs,
      recoveryMechanism: data.outcome.recoveryMechanism,
      violations: data.outcome.violations,
      error: data.outcome.errorMessage ? new Error(data.outcome.errorMessage) : undefined,
    } : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Singleton Registry                                                 */
/* ------------------------------------------------------------------ */

let globalRegistry: ChaosEventRegistry | null = null;

export function getEventRegistry(): ChaosEventRegistry {
  if (!globalRegistry) {
    globalRegistry = new ChaosEventRegistry();
  }
  return globalRegistry;
}
