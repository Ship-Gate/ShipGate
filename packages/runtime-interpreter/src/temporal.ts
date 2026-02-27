// ============================================================================
// ISL Runtime Interpreter - Temporal Property Checking
// @isl-lang/runtime-interpreter/temporal
// ============================================================================

import type { Value, Expression, Environment, ExecutionContext } from './types.js';
import { evaluate } from './evaluator.js';
import { extendEnvironment } from './environment.js';

// ============================================================================
// TEMPORAL PROPERTY TYPES
// ============================================================================

/**
 * Temporal property specification.
 */
export type TemporalProperty =
  | { tag: 'always'; condition: Expression }
  | { tag: 'eventually'; condition: Expression; within?: Duration }
  | { tag: 'until'; condition: Expression; until: Expression }
  | { tag: 'since'; condition: Expression; since: Expression }
  | { tag: 'next'; condition: Expression }
  | { tag: 'sequence'; properties: TemporalProperty[] }
  | { tag: 'response'; trigger: Expression; response: Expression; within?: Duration }
  | { tag: 'precedence'; first: Expression; second: Expression }
  | { tag: 'bounded_response'; trigger: Expression; response: Expression; min?: Duration; max?: Duration };

export interface Duration {
  value: number;
  unit: 'ms' | 's' | 'm' | 'h' | 'd';
}

// ============================================================================
// TEMPORAL CHECKER
// ============================================================================

/**
 * Temporal property checker using runtime monitoring.
 */
export class TemporalChecker {
  private properties: Map<string, TemporalPropertyState>;
  private events: TemporalEvent[];
  private maxEvents: number;

  constructor(options: TemporalCheckerOptions = {}) {
    this.properties = new Map();
    this.events = [];
    this.maxEvents = options.maxEvents ?? 10000;
  }

  /**
   * Register a temporal property to monitor.
   */
  register(name: string, property: TemporalProperty): void {
    this.properties.set(name, {
      property,
      status: 'pending',
      activations: [],
      violations: [],
    });
  }

  /**
   * Record an event for temporal checking.
   */
  recordEvent(
    event: string,
    data: Value,
    env: Environment,
    ctx: ExecutionContext
  ): void {
    const timestamp = Date.now();
    
    // Add to event history
    this.events.push({ timestamp, event, data });
    
    // Trim old events if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents / 2);
    }

    // Check all registered properties
    for (const [name, state] of this.properties) {
      this.checkProperty(name, state, { timestamp, event, data }, env, ctx);
    }
  }

  /**
   * Check if all registered properties are satisfied.
   */
  checkAll(): TemporalCheckResult {
    const results: Map<string, PropertyResult> = new Map();
    
    for (const [name, state] of this.properties) {
      results.set(name, {
        status: state.status,
        violations: state.violations,
        activations: state.activations.length,
      });
    }

    const allSatisfied = Array.from(this.properties.values())
      .every(s => s.status !== 'violated');

    return {
      satisfied: allSatisfied,
      results,
    };
  }

  /**
   * Get pending obligations (eventualities that need to be fulfilled).
   */
  getPendingObligations(): PendingObligation[] {
    const obligations: PendingObligation[] = [];

    for (const [name, state] of this.properties) {
      for (const activation of state.activations) {
        if (!activation.fulfilled) {
          obligations.push({
            property: name,
            activatedAt: activation.timestamp,
            deadline: activation.deadline,
            remaining: activation.deadline 
              ? activation.deadline - Date.now()
              : undefined,
          });
        }
      }
    }

    return obligations;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async checkProperty(
    name: string,
    state: TemporalPropertyState,
    event: TemporalEvent,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    const { property } = state;

    switch (property.tag) {
      case 'always':
        await this.checkAlways(name, state, property, event, env, ctx);
        break;

      case 'eventually':
        await this.checkEventually(name, state, property, event, env, ctx);
        break;

      case 'response':
        await this.checkResponse(name, state, property, event, env, ctx);
        break;

      case 'precedence':
        await this.checkPrecedence(name, state, property, event, env, ctx);
        break;

      case 'sequence':
        await this.checkSequence(name, state, property, event, env, ctx);
        break;
    }
  }

  private async checkAlways(
    _name: string,
    state: TemporalPropertyState,
    property: Extract<TemporalProperty, { tag: 'always' }>,
    event: TemporalEvent,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    const checkEnv = extendEnvironment(env);
    checkEnv.bindings.set('event', event.data);
    checkEnv.bindings.set('event_name', { tag: 'string', value: event.event });
    checkEnv.bindings.set('timestamp', { tag: 'int', value: BigInt(event.timestamp) });

    try {
      const result = await evaluate(property.condition, checkEnv, ctx);
      
      if (result.tag === 'boolean' && !result.value) {
        state.status = 'violated';
        state.violations.push({
          timestamp: event.timestamp,
          event: event.event,
          message: `Always property violated`,
        });
      }
    } catch (error) {
      // Evaluation error - property doesn't apply to this event
    }
  }

  private async checkEventually(
    _name: string,
    state: TemporalPropertyState,
    property: Extract<TemporalProperty, { tag: 'eventually' }>,
    event: TemporalEvent,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    const checkEnv = extendEnvironment(env);
    checkEnv.bindings.set('event', event.data);

    try {
      const result = await evaluate(property.condition, checkEnv, ctx);
      
      if (result.tag === 'boolean' && result.value) {
        // Condition satisfied - mark all activations as fulfilled
        for (const activation of state.activations) {
          activation.fulfilled = true;
        }
        state.status = 'satisfied';
      }
    } catch {
      // Evaluation error
    }

    // Check for deadline violations
    if (property.within) {
      const deadline = durationToMs(property.within);
      for (const activation of state.activations) {
        if (!activation.fulfilled && event.timestamp - activation.timestamp > deadline) {
          state.status = 'violated';
          state.violations.push({
            timestamp: event.timestamp,
            event: event.event,
            message: `Eventually property deadline exceeded`,
          });
        }
      }
    }
  }

  private async checkResponse(
    _name: string,
    state: TemporalPropertyState,
    property: Extract<TemporalProperty, { tag: 'response' }>,
    event: TemporalEvent,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    const checkEnv = extendEnvironment(env);
    checkEnv.bindings.set('event', event.data);

    // Check if trigger condition is met
    try {
      const triggerResult = await evaluate(property.trigger, checkEnv, ctx);
      
      if (triggerResult.tag === 'boolean' && triggerResult.value) {
        // Create new activation
        const deadline = property.within 
          ? event.timestamp + durationToMs(property.within)
          : undefined;
        
        state.activations.push({
          timestamp: event.timestamp,
          deadline,
          fulfilled: false,
        });
      }
    } catch {
      // Trigger doesn't apply to this event
    }

    // Check if response condition is met
    try {
      const responseResult = await evaluate(property.response, checkEnv, ctx);
      
      if (responseResult.tag === 'boolean' && responseResult.value) {
        // Find unfulfilled activations and mark them as fulfilled
        for (const activation of state.activations) {
          if (!activation.fulfilled) {
            activation.fulfilled = true;
          }
        }
      }
    } catch {
      // Response doesn't apply to this event
    }

    // Check for deadline violations
    for (const activation of state.activations) {
      if (!activation.fulfilled && activation.deadline && event.timestamp > activation.deadline) {
        state.status = 'violated';
        state.violations.push({
          timestamp: event.timestamp,
          event: event.event,
          message: `Response property deadline exceeded`,
        });
      }
    }
  }

  private async checkPrecedence(
    _name: string,
    state: TemporalPropertyState,
    property: Extract<TemporalProperty, { tag: 'precedence' }>,
    event: TemporalEvent,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<void> {
    const checkEnv = extendEnvironment(env);
    checkEnv.bindings.set('event', event.data);

    // Check if first condition was ever met
    let firstOccurred = state.activations.length > 0;

    try {
      const firstResult = await evaluate(property.first, checkEnv, ctx);
      if (firstResult.tag === 'boolean' && firstResult.value) {
        if (!firstOccurred) {
          state.activations.push({
            timestamp: event.timestamp,
            fulfilled: false,
          });
        }
        firstOccurred = true;
      }
    } catch {
      // First doesn't apply
    }

    // Check second condition - should only occur after first
    try {
      const secondResult = await evaluate(property.second, checkEnv, ctx);
      if (secondResult.tag === 'boolean' && secondResult.value && !firstOccurred) {
        state.status = 'violated';
        state.violations.push({
          timestamp: event.timestamp,
          event: event.event,
          message: `Precedence property violated: second occurred before first`,
        });
      }
    } catch {
      // Second doesn't apply
    }
  }

  private async checkSequence(
    _name: string,
    _state: TemporalPropertyState,
    _property: Extract<TemporalProperty, { tag: 'sequence' }>,
    _event: TemporalEvent,
    _env: Environment,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Simplified sequence checking
    // Real implementation would track position in sequence
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface TemporalCheckerOptions {
  maxEvents?: number;
}

interface TemporalEvent {
  timestamp: number;
  event: string;
  data: Value;
}

interface TemporalPropertyState {
  property: TemporalProperty;
  status: 'pending' | 'satisfied' | 'violated';
  activations: PropertyActivation[];
  violations: PropertyViolation[];
}

interface PropertyActivation {
  timestamp: number;
  deadline?: number;
  fulfilled: boolean;
}

interface PropertyViolation {
  timestamp: number;
  event: string;
  message: string;
}

interface TemporalCheckResult {
  satisfied: boolean;
  results: Map<string, PropertyResult>;
}

interface PropertyResult {
  status: 'pending' | 'satisfied' | 'violated';
  violations: PropertyViolation[];
  activations: number;
}

interface PendingObligation {
  property: string;
  activatedAt: number;
  deadline?: number;
  remaining?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function durationToMs(duration: Duration): number {
  const { value, unit } = duration;
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value;
  }
}

// ============================================================================
// LTL OPERATORS (for specification)
// ============================================================================

/**
 * Create an "always" (G) property.
 */
export function always(condition: Expression): TemporalProperty {
  return { tag: 'always', condition };
}

/**
 * Create an "eventually" (F) property.
 */
export function eventually(condition: Expression, within?: Duration): TemporalProperty {
  return { tag: 'eventually', condition, within };
}

/**
 * Create an "until" (U) property.
 */
export function until(condition: Expression, untilCond: Expression): TemporalProperty {
  return { tag: 'until', condition, until: untilCond };
}

/**
 * Create a "response" (cause -> effect) property.
 */
export function response(
  trigger: Expression,
  responseExpr: Expression,
  within?: Duration
): TemporalProperty {
  return { tag: 'response', trigger, response: responseExpr, within };
}

/**
 * Create a "precedence" property.
 */
export function precedence(first: Expression, second: Expression): TemporalProperty {
  return { tag: 'precedence', first, second };
}

/**
 * Create a bounded response property.
 */
export function boundedResponse(
  trigger: Expression,
  responseExpr: Expression,
  min?: Duration,
  max?: Duration
): TemporalProperty {
  return { tag: 'bounded_response', trigger, response: responseExpr, min, max };
}
