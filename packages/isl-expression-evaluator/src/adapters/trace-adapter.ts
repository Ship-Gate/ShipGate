// ============================================================================
// ISL Expression Evaluator - Trace-Driven Domain Adapter
// ============================================================================
//
// Adapter that pulls values from proof bundle traces for offline verification.
//
// Key features:
// - Extract function call results from handler_return events
// - Extract property values from state_change events
// - Index trace data for fast lookups
// - Support for correlation ID scoping
//
// ============================================================================

import type { TraceEvent, Trace, StateChangeEvent, HandlerReturnEvent } from '@isl-lang/trace-format';
import {
  BaseDomainAdapter,
  type FunctionResolution,
  type PropertyResolution,
  type AdapterValue,
} from '../domain-adapter.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Indexed function call from trace
 */
interface TracedFunctionCall {
  /** Entity type (e.g., 'User') */
  entity: string;
  /** Method name (e.g., 'exists') */
  method: string;
  /** Function arguments */
  args: unknown[];
  /** Return value */
  result: unknown;
  /** Event timestamp */
  timestamp: string;
  /** Correlation ID */
  correlationId: string;
  /** Handler that made the call */
  handler: string;
}

/**
 * Indexed property value from trace
 */
interface TracedPropertyValue {
  /** Property path (e.g., ['User', 'current', 'email']) */
  path: string[];
  /** Current value */
  value: unknown;
  /** Previous value (if from state_change) */
  previousValue?: unknown;
  /** Event timestamp */
  timestamp: string;
  /** Correlation ID */
  correlationId: string;
}

/**
 * Entity state snapshot from trace
 */
interface TracedEntityState {
  /** Entity type */
  entity: string;
  /** Entity ID (if available) */
  id?: string;
  /** Entity data */
  data: Record<string, unknown>;
  /** Timestamp of this snapshot */
  timestamp: string;
}

/**
 * Options for trace adapter
 */
export interface TraceAdapterOptions {
  /** Traces to load */
  traces?: Trace[];
  /** Events to load (alternative to full traces) */
  events?: TraceEvent[];
  /** Initial state snapshot */
  initialState?: Record<string, unknown>;
  /** Correlation ID filter (only use events with this ID) */
  correlationId?: string;
  /** Timestamp filter (only use events before this time) */
  beforeTimestamp?: string;
  /** Timestamp filter (only use events after this time) */
  afterTimestamp?: string;
  /** Entity types to handle */
  entities?: string[];
}

// ============================================================================
// TRACE ADAPTER
// ============================================================================

/**
 * Trace-driven adapter that extracts values from proof bundle traces
 * 
 * @example
 * ```typescript
 * const trace: Trace = {
 *   id: 'trace-1',
 *   name: 'Login flow',
 *   domain: 'auth',
 *   events: [
 *     {
 *       kind: 'handler_return',
 *       handler: 'User.exists',
 *       inputs: { id: 'user-123' },
 *       outputs: { result: true },
 *       ...
 *     }
 *   ],
 *   ...
 * };
 * 
 * const adapter = new TraceDrivenAdapter({ traces: [trace] });
 * 
 * // User.exists({ id: 'user-123' }) -> true (from trace)
 * ```
 */
export class TraceDrivenAdapter extends BaseDomainAdapter {
  readonly domain = 'trace';
  protected readonly entities: Set<string>;

  /** Indexed function calls by key */
  private functionCalls: Map<string, TracedFunctionCall[]> = new Map();
  
  /** Indexed property values by path */
  private propertyValues: Map<string, TracedPropertyValue[]> = new Map();
  
  /** Entity state snapshots */
  private entityStates: Map<string, TracedEntityState[]> = new Map();
  
  /** Initial state */
  private initialState: Record<string, unknown> = {};
  
  /** Correlation ID filter */
  private correlationId?: string;
  
  /** Timestamp filters */
  private beforeTimestamp?: string;
  private afterTimestamp?: string;

  constructor(options: TraceAdapterOptions = {}) {
    super();
    this.entities = new Set(options.entities ?? ['User', 'Session', 'ApiKey', 'Account', 'Order', 'Payment']);
    
    if (options.initialState) {
      this.initialState = options.initialState;
    }
    
    this.correlationId = options.correlationId;
    this.beforeTimestamp = options.beforeTimestamp;
    this.afterTimestamp = options.afterTimestamp;
    
    if (options.traces) {
      this.loadTraces(options.traces);
    }
    
    if (options.events) {
      this.loadEvents(options.events);
    }
  }

  /**
   * Load traces and index their events
   */
  loadTraces(traces: Trace[]): void {
    for (const trace of traces) {
      if (trace.initialState) {
        this.mergeInitialState(trace.initialState);
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

      switch (event.kind) {
        case 'handler_return':
          this.indexHandlerReturn(event as HandlerReturnEvent);
          break;
        case 'state_change':
          this.indexStateChange(event as StateChangeEvent);
          break;
        case 'handler_call':
          this.indexHandlerCall(event);
          break;
      }

      // Recursively process nested events
      if (event.events && event.events.length > 0) {
        this.loadEvents(event.events);
      }
    }
  }

  /**
   * Clear all indexed data
   */
  clearData(): void {
    this.functionCalls.clear();
    this.propertyValues.clear();
    this.entityStates.clear();
    this.initialState = {};
  }

  /**
   * Set correlation ID filter
   */
  setCorrelationId(correlationId: string | undefined): void {
    this.correlationId = correlationId;
  }

  /**
   * Add an entity type to handle
   */
  addEntity(entity: string): void {
    this.entities.add(entity);
  }

  // ============================================================================
  // INDEXING
  // ============================================================================

  private passesFilters(event: TraceEvent): boolean {
    // Correlation ID filter
    if (this.correlationId && event.correlationId !== this.correlationId) {
      return false;
    }

    // Timestamp filters
    if (this.beforeTimestamp && event.time > this.beforeTimestamp) {
      return false;
    }
    if (this.afterTimestamp && event.time < this.afterTimestamp) {
      return false;
    }

    return true;
  }

  private indexHandlerReturn(event: HandlerReturnEvent): void {
    // Parse handler name to extract entity and method
    const parsed = this.parseHandlerName(event.handler);
    if (!parsed || !this.canHandle(parsed.entity)) {
      return;
    }

    const { entity, method } = parsed;
    const args = this.extractArgs(event.inputs);
    const result = event.outputs.result;

    const call: TracedFunctionCall = {
      entity,
      method,
      args,
      result,
      timestamp: event.time,
      correlationId: event.correlationId,
      handler: event.handler,
    };

    const key = this.makeFunctionKey(entity, method, args);
    if (!this.functionCalls.has(key)) {
      this.functionCalls.set(key, []);
    }
    this.functionCalls.get(key)!.push(call);

    // Also index by entity+method only for fuzzy matching
    const fuzzyKey = `${entity}.${method}`;
    if (!this.functionCalls.has(fuzzyKey)) {
      this.functionCalls.set(fuzzyKey, []);
    }
    this.functionCalls.get(fuzzyKey)!.push(call);
  }

  private indexHandlerCall(event: TraceEvent): void {
    // Index handler calls to track which entities are accessed
    const parsed = this.parseHandlerName(event.handler);
    if (!parsed || !this.canHandle(parsed.entity)) {
      return;
    }

    // Store entity state from inputs if available
    if (event.inputs && typeof event.inputs === 'object') {
      for (const [key, value] of Object.entries(event.inputs)) {
        if (typeof value === 'object' && value !== null && 'id' in value) {
          const state: TracedEntityState = {
            entity: parsed.entity,
            id: String((value as Record<string, unknown>).id),
            data: value as Record<string, unknown>,
            timestamp: event.time,
          };
          
          const stateKey = `${parsed.entity}:${state.id}`;
          if (!this.entityStates.has(stateKey)) {
            this.entityStates.set(stateKey, []);
          }
          this.entityStates.get(stateKey)!.push(state);
        }
      }
    }
  }

  private indexStateChange(event: StateChangeEvent): void {
    const path = event.inputs.path;
    if (!Array.isArray(path) || path.length === 0) {
      return;
    }

    // Check if this is a domain entity property
    const entity = path[0];
    if (!this.canHandle(entity)) {
      return;
    }

    const tracedValue: TracedPropertyValue = {
      path,
      value: event.outputs.newValue,
      previousValue: event.inputs.oldValue,
      timestamp: event.time,
      correlationId: event.correlationId,
    };

    const pathKey = path.join('.');
    if (!this.propertyValues.has(pathKey)) {
      this.propertyValues.set(pathKey, []);
    }
    this.propertyValues.get(pathKey)!.push(tracedValue);
  }

  private mergeInitialState(state: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(state)) {
      if (this.canHandle(key) && typeof value === 'object' && value !== null) {
        this.initialState[key] = {
          ...((this.initialState[key] as Record<string, unknown>) ?? {}),
          ...(value as Record<string, unknown>),
        };
      } else {
        this.initialState[key] = value;
      }
    }
  }

  // ============================================================================
  // FUNCTION RESOLUTION
  // ============================================================================

  resolveFunction(entity: string, method: string, args: unknown[]): FunctionResolution {
    if (!this.canHandle(entity)) {
      return this.unhandled(`Entity ${entity} not handled by trace adapter`);
    }

    // Try exact match first
    const exactKey = this.makeFunctionKey(entity, method, args);
    const exactCalls = this.functionCalls.get(exactKey);
    if (exactCalls && exactCalls.length > 0) {
      // Return most recent call result
      const mostRecent = exactCalls[exactCalls.length - 1];
      return this.resolved(mostRecent.result, `From trace: ${mostRecent.handler}`);
    }

    // Try fuzzy match (entity.method without args)
    const fuzzyKey = `${entity}.${method}`;
    const fuzzyCalls = this.functionCalls.get(fuzzyKey);
    if (fuzzyCalls && fuzzyCalls.length > 0) {
      // Find best matching call
      const matching = this.findBestMatch(fuzzyCalls, args);
      if (matching) {
        return this.resolved(matching.result, `From trace (fuzzy): ${matching.handler}`);
      }
    }

    // Try to infer from entity state for common methods
    const inferred = this.inferFromState(entity, method, args);
    if (inferred.handled) {
      return inferred;
    }

    // Try initial state
    const fromInitial = this.resolveFromInitialState(entity, method, args);
    if (fromInitial.handled) {
      return fromInitial;
    }

    return this.resolved('unknown', `No trace data for ${entity}.${method}`);
  }

  private findBestMatch(calls: TracedFunctionCall[], targetArgs: unknown[]): TracedFunctionCall | undefined {
    if (targetArgs.length === 0 && calls.length > 0) {
      return calls[calls.length - 1];
    }

    // Try to match by criteria object
    const targetCriteria = this.extractCriteria(targetArgs);
    if (!targetCriteria) {
      return calls[calls.length - 1];
    }

    // Find call with matching criteria
    for (let i = calls.length - 1; i >= 0; i--) {
      const call = calls[i];
      const callCriteria = this.extractCriteria(call.args);
      if (callCriteria && this.criteriaMatch(callCriteria, targetCriteria)) {
        return call;
      }
    }

    return undefined;
  }

  private extractCriteria(args: unknown[]): Record<string, unknown> | null {
    if (args.length === 0) return null;
    const first = args[0];
    if (typeof first === 'string') return { id: first };
    if (typeof first === 'object' && first !== null) return first as Record<string, unknown>;
    return null;
  }

  private criteriaMatch(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    // Check if b's criteria are a subset of a
    for (const [key, value] of Object.entries(b)) {
      if (a[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private inferFromState(entity: string, method: string, args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);

    if (method === 'exists') {
      if (!criteria) {
        // Check if any entities of this type exist
        for (const key of this.entityStates.keys()) {
          if (key.startsWith(`${entity}:`)) {
            return this.resolved(true, 'Inferred from entity state');
          }
        }
        return this.unhandled();
      }

      // Check for specific entity
      if (criteria.id) {
        const stateKey = `${entity}:${criteria.id}`;
        if (this.entityStates.has(stateKey)) {
          return this.resolved(true, 'Entity found in state');
        }
      }
    }

    if (method === 'lookup') {
      if (!criteria) {
        return this.unhandled('No criteria for lookup');
      }

      // Try to find entity by ID
      if (criteria.id) {
        const stateKey = `${entity}:${criteria.id}`;
        const states = this.entityStates.get(stateKey);
        if (states && states.length > 0) {
          const latest = states[states.length - 1];
          return this.resolved(latest.data, 'From entity state');
        }
      }
    }

    return this.unhandled();
  }

  private resolveFromInitialState(entity: string, method: string, args: unknown[]): FunctionResolution {
    const entityState = this.initialState[entity];
    if (!entityState || typeof entityState !== 'object') {
      return this.unhandled();
    }

    const criteria = this.extractCriteria(args);
    const entities = entityState as Record<string, unknown>;

    if (method === 'exists') {
      if (!criteria) {
        return this.resolved(Object.keys(entities).length > 0, 'From initial state');
      }

      if (criteria.id && typeof criteria.id === 'string' && criteria.id in entities) {
        return this.resolved(true, 'Found in initial state');
      }

      // Search entities
      for (const value of Object.values(entities)) {
        if (typeof value === 'object' && value !== null) {
          const entity = value as Record<string, unknown>;
          if (this.objectMatchesCriteria(entity, criteria)) {
            return this.resolved(true, 'Found matching entity in initial state');
          }
        }
      }

      return this.resolved(false, 'Not found in initial state');
    }

    if (method === 'lookup') {
      if (!criteria) {
        return this.unhandled('No criteria for lookup');
      }

      if (criteria.id && typeof criteria.id === 'string' && criteria.id in entities) {
        return this.resolved(entities[criteria.id], 'From initial state');
      }

      // Search entities
      for (const value of Object.values(entities)) {
        if (typeof value === 'object' && value !== null) {
          const entity = value as Record<string, unknown>;
          if (this.objectMatchesCriteria(entity, criteria)) {
            return this.resolved(entity, 'Found matching entity in initial state');
          }
        }
      }

      return this.resolved(null, 'Not found in initial state');
    }

    return this.unhandled();
  }

  private objectMatchesCriteria(obj: Record<string, unknown>, criteria: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(criteria)) {
      if (obj[key] !== value) {
        return false;
      }
    }
    return true;
  }

  // ============================================================================
  // PROPERTY RESOLUTION
  // ============================================================================

  resolveProperty(path: string[]): PropertyResolution {
    if (path.length < 2) {
      return { value: 'unknown', handled: false };
    }

    const entity = path[0];
    if (!this.canHandle(entity)) {
      return { value: 'unknown', handled: false };
    }

    // Try trace data
    const pathKey = path.join('.');
    const tracedValues = this.propertyValues.get(pathKey);
    if (tracedValues && tracedValues.length > 0) {
      const latest = tracedValues[tracedValues.length - 1];
      return this.resolvedProperty(latest.value, 'From trace state_change');
    }

    // Try initial state
    const fromInitial = this.resolvePropertyFromInitialState(path);
    if (fromInitial.handled) {
      return fromInitial;
    }

    // Try to find in entity states
    if (path[1] === 'current' && path.length > 2) {
      // Entity.current.property -> look for a "current" entity
      const currentKey = `${entity}:current`;
      const states = this.entityStates.get(currentKey);
      if (states && states.length > 0) {
        const latest = states[states.length - 1];
        const propertyPath = path.slice(2);
        const value = this.getNestedProperty(latest.data, propertyPath);
        if (value !== undefined) {
          return this.resolvedProperty(value, 'From current entity state');
        }
      }
    }

    return { value: 'unknown', handled: false, diagnostic: `No trace data for ${pathKey}` };
  }

  private resolvePropertyFromInitialState(path: string[]): PropertyResolution {
    let current: unknown = this.initialState;
    
    for (const key of path) {
      if (current === null || current === undefined) {
        return { value: 'unknown', handled: false };
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (current !== undefined) {
      return this.resolvedProperty(current, 'From initial state');
    }

    return { value: 'unknown', handled: false };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private parseHandlerName(handler: string): { entity: string; method: string } | null {
    // Parse handlers like "User.exists", "User.lookup", "createUser"
    const dotMatch = handler.match(/^([A-Z][a-zA-Z]*)\.(exists|lookup|count|getAll|create|update|delete)$/);
    if (dotMatch) {
      return { entity: dotMatch[1], method: dotMatch[2] };
    }

    // Parse handlers like "createUser" -> { entity: 'User', method: 'create' }
    const methodMatch = handler.match(/^(create|update|delete|get|find)([A-Z][a-zA-Z]*)$/);
    if (methodMatch) {
      return { entity: methodMatch[2], method: methodMatch[1] };
    }

    return null;
  }

  /**
   * Extract function arguments from event inputs
   * Converts the inputs object to an array format for matching
   */
  private extractArgs(inputs: Record<string, unknown>): unknown[] {
    // If inputs is empty, return empty array
    if (!inputs || Object.keys(inputs).length === 0) {
      return [];
    }

    // If inputs has a single key, it might be the criteria object
    const keys = Object.keys(inputs);
    if (keys.length === 1) {
      const value = inputs[keys[0]];
      // If it's a primitive (id), wrap in criteria object
      if (typeof value === 'string' || typeof value === 'number') {
        return [{ [keys[0]]: value }];
      }
      // If it's already an object, use it directly
      if (typeof value === 'object' && value !== null) {
        return [value];
      }
      return [{ [keys[0]]: value }];
    }

    // Multiple keys - treat the whole inputs as criteria
    return [inputs];
  }

  private makeFunctionKey(entity: string, method: string, args: unknown[]): string {
    const argsHash = JSON.stringify(args);
    return `${entity}.${method}:${argsHash}`;
  }

  private getNestedProperty(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  // ============================================================================
  // DEBUG HELPERS
  // ============================================================================

  /**
   * Get statistics about indexed data
   */
  getStats(): {
    functionCalls: number;
    propertyValues: number;
    entityStates: number;
    entities: string[];
  } {
    return {
      functionCalls: this.functionCalls.size,
      propertyValues: this.propertyValues.size,
      entityStates: this.entityStates.size,
      entities: Array.from(this.entities),
    };
  }

  /**
   * Get all indexed function calls for debugging
   */
  getIndexedCalls(): Map<string, TracedFunctionCall[]> {
    return new Map(this.functionCalls);
  }
}

/**
 * Create a trace-driven adapter from traces
 */
export function createTraceAdapter(options: TraceAdapterOptions): TraceDrivenAdapter {
  return new TraceDrivenAdapter(options);
}

/**
 * Create a trace-driven adapter from a proof bundle
 */
export function createAdapterFromProofBundle(bundle: {
  traces?: Trace[];
  initialState?: Record<string, unknown>;
}): TraceDrivenAdapter {
  return new TraceDrivenAdapter({
    traces: bundle.traces ?? [],
    initialState: bundle.initialState,
  });
}
