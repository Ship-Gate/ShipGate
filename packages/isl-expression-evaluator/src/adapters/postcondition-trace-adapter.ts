// ============================================================================
// ISL Expression Evaluator - Postcondition Trace Adapter
// ============================================================================
//
// Extended trace adapter that supports postcondition evaluation by providing:
// - Before/after state access for field comparisons
// - Entity creation tracking
// - Trace event analysis
//
// ============================================================================

import type { TraceEvent, Trace, StateChangeEvent, HandlerReturnEvent } from '@isl-lang/trace-format';
import type { EvalKind } from '../v1/types.js';
import type { EvalAdapter } from '../v1/types.js';
import type {
  PostconditionAdapter,
} from '../v1/postcondition-evaluator.js';
import type {
  FieldReference,
  TraceEventData,
  SimpleFieldPath,
  MethodCallField,
} from '../v1/postcondition-types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for creating a postcondition trace adapter
 */
export interface PostconditionTraceAdapterOptions {
  /** Traces to analyze */
  traces?: Trace[];
  /** Events to analyze (alternative to full traces) */
  events?: TraceEvent[];
  /** State snapshot before behavior execution */
  beforeState?: Record<string, unknown>;
  /** State snapshot after behavior execution */
  afterState?: Record<string, unknown>;
  /** Entity types to track */
  entities?: string[];
  /** Correlation ID filter */
  correlationId?: string;
  /** Behavior execution start timestamp */
  startTimestamp?: string;
  /** Behavior execution end timestamp */
  endTimestamp?: string;
}

/**
 * Indexed entity creation event
 */
interface EntityCreationEvent {
  entityType: string;
  entityId?: string;
  timestamp: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

/**
 * Indexed field state change
 */
interface FieldStateChange {
  path: string[];
  beforeValue: unknown;
  afterValue: unknown;
  timestamp: string;
}

// ============================================================================
// POSTCONDITION TRACE ADAPTER
// ============================================================================

/**
 * Trace adapter extended for postcondition evaluation
 * 
 * Provides:
 * - getBeforeValue(field) - Get field value before behavior execution
 * - getAfterValue(field) - Get field value after behavior execution
 * - wasEntityCreated(entityType) - Check if entity was created
 * - getCreatedEntityCount(entityType) - Get count of created entities
 * - getCreationEvents(entityType) - Get all creation events
 */
export class PostconditionTraceAdapter implements PostconditionAdapter {
  /** Entity types to handle */
  private readonly entities: Set<string>;
  
  /** Before state snapshot */
  private beforeState: Record<string, unknown>;
  
  /** After state snapshot */
  private afterState: Record<string, unknown>;
  
  /** Indexed entity creation events */
  private creationEvents: Map<string, EntityCreationEvent[]> = new Map();
  
  /** Indexed field state changes */
  private fieldChanges: Map<string, FieldStateChange> = new Map();
  
  /** Indexed function call results */
  private functionResults: Map<string, { before: unknown; after: unknown }> = new Map();
  
  /** Correlation ID filter */
  private correlationId?: string;
  
  /** Time boundaries */
  private startTimestamp?: string;
  private endTimestamp?: string;

  constructor(options: PostconditionTraceAdapterOptions = {}) {
    this.entities = new Set(options.entities ?? [
      'User', 'Session', 'Token', 'ApiKey', 'Account', 'Order', 'Payment',
    ]);
    
    this.beforeState = options.beforeState ?? {};
    this.afterState = options.afterState ?? {};
    
    this.correlationId = options.correlationId;
    this.startTimestamp = options.startTimestamp;
    this.endTimestamp = options.endTimestamp;
    
    if (options.traces) {
      this.loadTraces(options.traces);
    }
    
    if (options.events) {
      this.loadEvents(options.events);
    }
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Set the before state snapshot
   */
  setBeforeState(state: Record<string, unknown>): void {
    this.beforeState = state;
  }

  /**
   * Set the after state snapshot
   */
  setAfterState(state: Record<string, unknown>): void {
    this.afterState = state;
  }

  /**
   * Set both before and after states
   */
  setStates(before: Record<string, unknown>, after: Record<string, unknown>): void {
    this.beforeState = before;
    this.afterState = after;
  }

  // ============================================================================
  // TRACE LOADING
  // ============================================================================

  /**
   * Load traces and index their events
   */
  loadTraces(traces: Trace[]): void {
    for (const trace of traces) {
      // Merge initial state as before state
      if (trace.initialState) {
        this.beforeState = { ...this.beforeState, ...trace.initialState };
        // Also use as initial after state (will be updated by events)
        this.afterState = { ...this.afterState, ...trace.initialState };
      }
      
      this.loadEvents(trace.events);
    }
  }

  /**
   * Load and index events
   */
  loadEvents(events: TraceEvent[]): void {
    for (const event of events) {
      if (!this.passesFilters(event)) {
        continue;
      }

      this.indexEvent(event);

      // Recursively process nested events
      if (event.events && event.events.length > 0) {
        this.loadEvents(event.events);
      }
    }
  }

  private passesFilters(event: TraceEvent): boolean {
    if (this.correlationId && event.correlationId !== this.correlationId) {
      return false;
    }
    if (this.startTimestamp && event.time < this.startTimestamp) {
      return false;
    }
    if (this.endTimestamp && event.time > this.endTimestamp) {
      return false;
    }
    return true;
  }

  private indexEvent(event: TraceEvent): void {
    switch (event.kind) {
      case 'handler_return':
        // Check if this is an entity creation handler
        if (this.isEntityCreationHandler(event.handler)) {
          this.indexEntityCreation(event);
        }
        this.indexHandlerReturn(event as HandlerReturnEvent);
        break;
      case 'state_change':
        this.indexStateChange(event as StateChangeEvent);
        // Update after state with the new value
        const path = (event as StateChangeEvent).inputs?.path as string[] | undefined;
        if (path && path.length > 0) {
          const newValue = (event as StateChangeEvent).outputs?.newValue;
          this.updateAfterState(path, newValue);
        }
        break;
      default:
        // Other event kinds are not indexed for postcondition evaluation
        break;
    }
  }

  private isEntityCreationHandler(handler: string): boolean {
    return /^create[A-Z]/.test(handler) || handler.includes('.create');
  }

  private updateAfterState(path: string[], value: unknown): void {
    let current: Record<string, unknown> = this.afterState;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
  }

  private indexEntityCreation(event: TraceEvent): void {
    const entityType = event.inputs?.entityType as string ?? this.extractEntityFromHandler(event.handler);
    if (!entityType) return;
    
    const creation: EntityCreationEvent = {
      entityType,
      entityId: event.inputs?.id as string ?? event.outputs?.id as string,
      timestamp: event.time,
      correlationId: event.correlationId,
      data: event.outputs as Record<string, unknown>,
    };
    
    if (!this.creationEvents.has(entityType)) {
      this.creationEvents.set(entityType, []);
    }
    this.creationEvents.get(entityType)!.push(creation);
  }

  private indexStateChange(event: StateChangeEvent): void {
    const path = event.inputs?.path as string[];
    if (!path || path.length === 0) return;
    
    const pathKey = path.join('.');
    const existing = this.fieldChanges.get(pathKey);
    
    if (existing) {
      // Update after value if newer
      existing.afterValue = event.outputs?.newValue;
    } else {
      this.fieldChanges.set(pathKey, {
        path,
        beforeValue: event.inputs?.oldValue,
        afterValue: event.outputs?.newValue,
        timestamp: event.time,
      });
    }
  }

  private indexHandlerReturn(event: HandlerReturnEvent): void {
    const parsed = this.parseHandlerName(event.handler);
    if (!parsed) return;
    
    const { entity, method } = parsed;
    const key = `${entity}.${method}`;
    
    // Build unique key including args for lookup
    const argsKey = this.buildArgsKey(event.inputs);
    const fullKey = argsKey ? `${key}:${argsKey}` : key;
    
    const existing = this.functionResults.get(fullKey);
    if (existing) {
      // Later result becomes "after"
      existing.after = event.outputs?.result;
    } else {
      this.functionResults.set(fullKey, {
        before: event.outputs?.result,
        after: event.outputs?.result,
      });
    }
  }

  private extractEntityFromHandler(handler: string): string | undefined {
    // Parse "createUser" -> "User", "createSession" -> "Session"
    const match = handler.match(/^create([A-Z][a-zA-Z]*)$/);
    return match?.[1];
  }

  private parseHandlerName(handler: string): { entity: string; method: string } | null {
    // Parse "User.lookup_by_email" -> { entity: "User", method: "lookup_by_email" }
    const dotMatch = handler.match(/^([A-Z][a-zA-Z]*)\.(.+)$/);
    if (dotMatch) {
      return { entity: dotMatch[1], method: dotMatch[2] };
    }
    return null;
  }

  private buildArgsKey(inputs: Record<string, unknown>): string {
    if (!inputs || Object.keys(inputs).length === 0) return '';
    return JSON.stringify(inputs);
  }

  // ============================================================================
  // POSTCONDITION ADAPTER INTERFACE
  // ============================================================================

  /**
   * Get the value of a field before behavior execution
   */
  getBeforeValue(field: FieldReference): unknown | 'unknown' {
    return this.getFieldValue(field, 'before');
  }

  /**
   * Get the value of a field after behavior execution
   */
  getAfterValue(field: FieldReference): unknown | 'unknown' {
    return this.getFieldValue(field, 'after');
  }

  private getFieldValue(field: FieldReference, when: 'before' | 'after'): unknown | 'unknown' {
    switch (field.kind) {
      case 'simple_path':
        return this.resolveSimplePath(field.path, when);
      
      case 'method_call':
        return this.resolveMethodCall(field, when);
      
      case 'expression':
        return 'unknown';
      
      default:
        return 'unknown';
    }
  }

  private resolveSimplePath(path: string[], when: 'before' | 'after'): unknown | 'unknown' {
    const pathKey = path.join('.');
    
    // Check indexed field changes first
    const change = this.fieldChanges.get(pathKey);
    if (change) {
      return when === 'before' ? change.beforeValue : change.afterValue;
    }
    
    // Fall back to state snapshots
    const state = when === 'before' ? this.beforeState : this.afterState;
    return this.getNestedValue(state, path);
  }

  private resolveMethodCall(field: MethodCallField, when: 'before' | 'after'): unknown | 'unknown' {
    const { entity, method, args, propertyPath } = field;
    const key = `${entity}.${method}`;
    
    // Build args key for lookup
    const argsKey = args.length > 0 ? JSON.stringify(args) : '';
    const fullKey = argsKey ? `${key}:${argsKey}` : key;
    
    // Check indexed function results
    const results = this.functionResults.get(fullKey);
    if (results) {
      const value = when === 'before' ? results.before : results.after;
      
      // If there's a property path, resolve it
      if (propertyPath.length > 0 && typeof value === 'object' && value !== null) {
        return this.getNestedValue(value as Record<string, unknown>, propertyPath);
      }
      
      return value;
    }
    
    // Try without args key
    const simpleResults = this.functionResults.get(key);
    if (simpleResults) {
      const value = when === 'before' ? simpleResults.before : simpleResults.after;
      
      if (propertyPath.length > 0 && typeof value === 'object' && value !== null) {
        return this.getNestedValue(value as Record<string, unknown>, propertyPath);
      }
      
      return value;
    }
    
    return 'unknown';
  }

  private getNestedValue(obj: Record<string, unknown>, path: string[]): unknown | 'unknown' {
    let current: unknown = obj;
    
    for (const key of path) {
      if (current === null || current === undefined) {
        return 'unknown';
      }
      if (typeof current !== 'object') {
        return 'unknown';
      }
      current = (current as Record<string, unknown>)[key];
    }
    
    return current !== undefined ? current : 'unknown';
  }

  /**
   * Check if an entity of the given type was created during behavior execution
   */
  wasEntityCreated(entityType: string): boolean | 'unknown' {
    const events = this.creationEvents.get(entityType);
    if (events && events.length > 0) {
      return true;
    }
    
    // Check after state for new entities
    const afterEntities = this.afterState[entityType];
    const beforeEntities = this.beforeState[entityType];
    
    if (afterEntities && typeof afterEntities === 'object') {
      // Check if there are new entities in after state
      if (!beforeEntities) {
        return Object.keys(afterEntities).length > 0;
      }
      
      const afterKeys = new Set(Object.keys(afterEntities));
      const beforeKeys = new Set(Object.keys(beforeEntities as Record<string, unknown>));
      
      for (const key of afterKeys) {
        if (!beforeKeys.has(key)) {
          return true;
        }
      }
    }
    
    // If we have both states, we can definitively say no creation occurred
    if (Object.keys(this.beforeState).length > 0 && Object.keys(this.afterState).length > 0) {
      return false;
    }
    
    // Cannot determine
    return 'unknown';
  }

  /**
   * Get the count of entities created during behavior execution
   */
  getCreatedEntityCount(entityType: string): number | 'unknown' {
    const events = this.creationEvents.get(entityType);
    if (events) {
      return events.length;
    }
    
    // Count from state diff
    const afterEntities = this.afterState[entityType];
    const beforeEntities = this.beforeState[entityType];
    
    if (afterEntities && typeof afterEntities === 'object') {
      const afterKeys = new Set(Object.keys(afterEntities));
      const beforeKeys = beforeEntities && typeof beforeEntities === 'object'
        ? new Set(Object.keys(beforeEntities))
        : new Set<string>();
      
      let count = 0;
      for (const key of afterKeys) {
        if (!beforeKeys.has(key)) {
          count++;
        }
      }
      return count;
    }
    
    return 0;
  }

  /**
   * Get all creation events for an entity type
   */
  getCreationEvents(entityType: string): TraceEventData[] {
    const events = this.creationEvents.get(entityType) ?? [];
    return events.map(e => ({
      kind: 'entity_created' as const,
      entityType: e.entityType,
      entityId: e.entityId,
      timestamp: e.timestamp,
      data: e.data ?? {},
    }));
  }

  // Legacy method - kept for compatibility but should use getCreationEvents
  private getCreationEventsLegacy(entityType: string): TraceEventData[] {
    const events = this.creationEvents.get(entityType) ?? [];
    return events.map(e => ({
      kind: 'entity_created',
      timestamp: e.timestamp,
      entityType: e.entityType,
      entityId: e.entityId,
      data: e.data,
    }));
  }

  // ============================================================================
  // STANDARD EVAL ADAPTER INTERFACE
  // ============================================================================

  isValid(value: unknown): EvalKind {
    if (value === null || value === undefined) return 'false';
    if (typeof value === 'string') return value.length > 0 ? 'true' : 'false';
    if (Array.isArray(value)) return value.length > 0 ? 'true' : 'false';
    return 'true';
  }

  length(value: unknown): number | 'unknown' {
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length;
    return 'unknown';
  }

  exists(entityName: string, criteria?: Record<string, unknown>): EvalKind {
    // Check after state
    const entities = this.afterState[entityName];
    if (!entities || typeof entities !== 'object') return 'unknown';
    
    if (!criteria) {
      return Object.keys(entities).length > 0 ? 'true' : 'false';
    }
    
    // Search for matching entity
    for (const value of Object.values(entities)) {
      if (typeof value === 'object' && value !== null) {
        const entity = value as Record<string, unknown>;
        let matches = true;
        for (const [key, val] of Object.entries(criteria)) {
          if (entity[key] !== val) {
            matches = false;
            break;
          }
        }
        if (matches) return 'true';
      }
    }
    
    return 'false';
  }

  lookup(entityName: string, criteria?: Record<string, unknown>): unknown | 'unknown' {
    // Check after state
    const entities = this.afterState[entityName];
    if (!entities || typeof entities !== 'object') return 'unknown';
    
    if (!criteria) {
      const values = Object.values(entities);
      return values.length > 0 ? values[0] : 'unknown';
    }
    
    // Search for matching entity
    for (const value of Object.values(entities)) {
      if (typeof value === 'object' && value !== null) {
        const entity = value as Record<string, unknown>;
        let matches = true;
        for (const [key, val] of Object.entries(criteria)) {
          if (entity[key] !== val) {
            matches = false;
            break;
          }
        }
        if (matches) return entity;
      }
    }
    
    return 'unknown';
  }

  getProperty(object: unknown, property: string): unknown | 'unknown' {
    if (object === null || object === undefined) return 'unknown';
    if (typeof object !== 'object') return 'unknown';
    
    const value = (object as Record<string, unknown>)[property];
    return value !== undefined ? value : 'unknown';
  }

  now(): number | string {
    return Date.now();
  }

  isValidFormat(value: unknown, format: string): EvalKind {
    if (typeof value !== 'string') return 'false';
    const patterns: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      url: /^https?:\/\/[^\s]+$/,
    };
    const pattern = patterns[format];
    if (pattern) {
      return pattern.test(value) ? 'true' : 'false';
    }
    return 'unknown';
  }

  regex(value: unknown, pattern: string): EvalKind {
    if (typeof value !== 'string') return 'false';
    try {
      const re = new RegExp(pattern);
      return re.test(value) ? 'true' : 'false';
    } catch {
      return 'unknown';
    }
  }

  contains(collection: unknown, value: unknown): EvalKind {
    if (Array.isArray(collection)) {
      return collection.includes(value) ? 'true' : 'false';
    }
    if (typeof collection === 'string' && typeof value === 'string') {
      return collection.includes(value) ? 'true' : 'false';
    }
    return 'unknown';
  }

  // ============================================================================
  // DEBUG HELPERS
  // ============================================================================

  /**
   * Get adapter statistics
   */
  getStats(): {
    creationEvents: number;
    fieldChanges: number;
    functionResults: number;
    entities: string[];
  } {
    return {
      creationEvents: Array.from(this.creationEvents.values()).reduce((sum, arr) => sum + arr.length, 0),
      fieldChanges: this.fieldChanges.size,
      functionResults: this.functionResults.size,
      entities: Array.from(this.entities),
    };
  }

  /**
   * Get all indexed creation events
   */
  getAllCreationEvents(): Map<string, EntityCreationEvent[]> {
    return new Map(this.creationEvents);
  }

  /**
   * Get all indexed field changes
   */
  getAllFieldChanges(): Map<string, FieldStateChange> {
    return new Map(this.fieldChanges);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a postcondition trace adapter
 */
export function createPostconditionTraceAdapter(
  options: PostconditionTraceAdapterOptions
): PostconditionTraceAdapter {
  return new PostconditionTraceAdapter(options);
}

/**
 * Create a postcondition trace adapter from before/after state snapshots
 */
export function createFromStateSnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): PostconditionTraceAdapter {
  return new PostconditionTraceAdapter({
    beforeState: before,
    afterState: after,
  });
}

/**
 * Create a postcondition trace adapter with explicit entity field states
 * 
 * Convenient for testing with specific before/after values for fields
 */
export function createFromFieldStates(
  fieldStates: Record<string, { before: unknown; after: unknown }>
): PostconditionTraceAdapter {
  const adapter = new PostconditionTraceAdapter();
  
  // Convert field states to nested state objects
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  
  for (const [path, { before: beforeVal, after: afterVal }] of Object.entries(fieldStates)) {
    setNestedValue(before, path.split('.'), beforeVal);
    setNestedValue(after, path.split('.'), afterVal);
  }
  
  adapter.setStates(before, after);
  return adapter;
}

/**
 * Helper to set a nested value in an object
 */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[path[path.length - 1]] = value;
}
