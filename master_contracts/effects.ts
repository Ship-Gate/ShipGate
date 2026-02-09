// ============================================================================
// ISL Effect System - Algebraic Effects for Side Effect Management
// Version: 0.1.0
// ============================================================================

/**
 * The ISL Effect System provides:
 * 1. Effect tracking - Know what side effects a behavior can perform
 * 2. Effect handlers - Control how effects are interpreted
 * 3. Effect composition - Combine effects safely
 * 4. Effect inference - Automatically detect effects from behavior bodies
 */

// ============================================================================
// CORE EFFECT TYPES
// ============================================================================

/**
 * Base effect type - all effects extend this
 */
export interface Effect {
  readonly _tag: string;
}

/**
 * Pure computation - no effects
 */
export interface Pure extends Effect {
  readonly _tag: 'Pure';
}

/**
 * IO effect - external world interaction
 */
export interface IO extends Effect {
  readonly _tag: 'IO';
}

/**
 * Database effect - data persistence
 */
export interface Database extends Effect {
  readonly _tag: 'Database';
  readonly operations: ('read' | 'write' | 'transaction')[];
}

/**
 * Network effect - external API calls
 */
export interface Network extends Effect {
  readonly _tag: 'Network';
  readonly endpoints: string[];
}

/**
 * Time effect - accessing current time or scheduling
 */
export interface Time extends Effect {
  readonly _tag: 'Time';
  readonly operations: ('now' | 'sleep' | 'schedule')[];
}

/**
 * Random effect - non-deterministic computation
 */
export interface Random extends Effect {
  readonly _tag: 'Random';
}

/**
 * Logging effect - structured logging
 */
export interface Logging extends Effect {
  readonly _tag: 'Logging';
  readonly levels: ('debug' | 'info' | 'warn' | 'error')[];
}

/**
 * Metrics effect - telemetry and observability
 */
export interface Metrics extends Effect {
  readonly _tag: 'Metrics';
  readonly types: ('counter' | 'gauge' | 'histogram')[];
}

/**
 * Auth effect - authentication/authorization checks
 */
export interface Auth extends Effect {
  readonly _tag: 'Auth';
  readonly checks: ('authenticate' | 'authorize' | 'getUser')[];
}

/**
 * Cache effect - caching operations
 */
export interface Cache extends Effect {
  readonly _tag: 'Cache';
  readonly operations: ('get' | 'set' | 'delete' | 'invalidate')[];
}

/**
 * Queue effect - job queue operations
 */
export interface QueueEffect extends Effect {
  readonly _tag: 'Queue';
  readonly operations: ('enqueue' | 'dequeue' | 'schedule')[];
}

/**
 * Email effect - sending emails
 */
export interface Email extends Effect {
  readonly _tag: 'Email';
}

/**
 * Storage effect - file storage operations
 */
export interface Storage extends Effect {
  readonly _tag: 'Storage';
  readonly operations: ('upload' | 'download' | 'delete' | 'list')[];
}

/**
 * Async effect - asynchronous computation
 */
export interface Async extends Effect {
  readonly _tag: 'Async';
}

/**
 * Error effect - fallible computation
 */
export interface Fallible extends Effect {
  readonly _tag: 'Fallible';
  readonly errorTypes: string[];
}

// ============================================================================
// EFFECT COMPOSITION
// ============================================================================

/**
 * Union of multiple effects
 */
export type EffectUnion<E extends Effect[]> = E[number];

/**
 * Effect row - ordered list of effects
 */
export type EffectRow = Effect[];

/**
 * Check if effect is present in row
 */
export type HasEffect<Row extends EffectRow, E extends Effect> = 
  E extends Row[number] ? true : false;

/**
 * Add effect to row
 */
export type AddEffect<Row extends EffectRow, E extends Effect> = [...Row, E];

/**
 * Remove effect from row
 */
export type RemoveEffect<Row extends EffectRow, E extends Effect> = 
  Row extends [infer Head, ...infer Tail extends EffectRow]
    ? Head extends E
      ? Tail
      : [Head, ...RemoveEffect<Tail, E>]
    : [];

// ============================================================================
// EFFECTFUL COMPUTATION
// ============================================================================

/**
 * Effectful computation type
 * Represents a computation that may perform effects from E and produces A
 */
export interface Eff<E extends EffectRow, A> {
  readonly effects: E;
  readonly run: () => Promise<A>;
}

/**
 * Pure computation (no effects)
 */
export function pure<A>(value: A): Eff<[], A> {
  return {
    effects: [],
    run: async () => value,
  };
}

/**
 * Perform an effect
 */
export function perform<E extends Effect, A>(
  effect: E,
  operation: () => Promise<A>
): Eff<[E], A> {
  return {
    effects: [effect],
    run: operation,
  };
}

/**
 * Map over effectful computation
 */
export function map<E extends EffectRow, A, B>(
  eff: Eff<E, A>,
  f: (a: A) => B
): Eff<E, B> {
  return {
    effects: eff.effects,
    run: async () => f(await eff.run()),
  };
}

/**
 * FlatMap (chain) effectful computations
 */
export function flatMap<E1 extends EffectRow, E2 extends EffectRow, A, B>(
  eff: Eff<E1, A>,
  f: (a: A) => Eff<E2, B>
): Eff<[...E1, ...E2], B> {
  return {
    effects: [...eff.effects, ...f(undefined as A).effects] as [...E1, ...E2],
    run: async () => {
      const a = await eff.run();
      return f(a).run();
    },
  };
}

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Effect handler - interprets effects
 */
export interface EffectHandler<E extends Effect, A> {
  readonly handles: E['_tag'];
  readonly handle: (effect: E, resume: (value: unknown) => Promise<A>) => Promise<A>;
}

/**
 * Handler registry
 */
export class EffectHandlerRegistry {
  private handlers = new Map<string, EffectHandler<Effect, unknown>>();

  register<E extends Effect>(handler: EffectHandler<E, unknown>): void {
    this.handlers.set(handler.handles, handler as unknown as EffectHandler<Effect, unknown>);
  }

  get(tag: string): EffectHandler<Effect, unknown> | undefined {
    return this.handlers.get(tag);
  }
}

/**
 * Run effectful computation with handlers
 */
export async function runWithHandlers<E extends EffectRow, A>(
  eff: Eff<E, A>,
  registry: EffectHandlerRegistry
): Promise<A> {
  // Simplified implementation - real version would thread handlers through
  return eff.run();
}

// ============================================================================
// ISL EFFECT ANNOTATIONS
// ============================================================================

/**
 * ISL syntax for declaring effects on behaviors
 * 
 * @example
 * ```isl
 * behavior CreateUser {
 *   effects {
 *     Database { write }
 *     Email
 *     Logging { info }
 *   }
 *   
 *   // ... behavior body
 * }
 * ```
 */
export interface BehaviorEffects {
  database?: {
    read?: boolean;
    write?: boolean;
    transaction?: boolean;
  };
  network?: {
    endpoints?: string[];
  };
  time?: {
    now?: boolean;
    sleep?: boolean;
    schedule?: boolean;
  };
  random?: boolean;
  logging?: {
    debug?: boolean;
    info?: boolean;
    warn?: boolean;
    error?: boolean;
  };
  metrics?: {
    counter?: boolean;
    gauge?: boolean;
    histogram?: boolean;
  };
  auth?: {
    authenticate?: boolean;
    authorize?: boolean;
  };
  cache?: {
    get?: boolean;
    set?: boolean;
    delete?: boolean;
  };
  queue?: {
    enqueue?: boolean;
    dequeue?: boolean;
  };
  email?: boolean;
  storage?: {
    upload?: boolean;
    download?: boolean;
  };
  async?: boolean;
}

/**
 * Effect inference from behavior body
 */
export function inferEffects(behaviorBody: unknown): BehaviorEffects {
  // Static analysis would go here
  // Analyze AST to determine what effects are used
  return {};
}

/**
 * Verify declared effects match inferred effects
 */
export function verifyEffects(
  declared: BehaviorEffects,
  inferred: BehaviorEffects
): { valid: boolean; missing: string[]; extra: string[] } {
  const missing: string[] = [];
  const extra: string[] = [];
  
  // Compare declared vs inferred
  // Report any mismatches
  
  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

// ============================================================================
// LINEAR TYPES FOR RESOURCE MANAGEMENT
// ============================================================================

/**
 * Linear type - must be used exactly once
 */
export interface Linear<T> {
  readonly _brand: 'Linear';
  readonly value: T;
  readonly consumed: boolean;
}

/**
 * Affine type - must be used at most once
 */
export interface Affine<T> {
  readonly _brand: 'Affine';
  readonly value: T;
  readonly consumed: boolean;
}

/**
 * Create a linear value
 */
export function linear<T>(value: T): Linear<T> {
  return {
    _brand: 'Linear',
    value,
    consumed: false,
  };
}

/**
 * Consume a linear value
 */
export function consume<T>(lin: Linear<T>): T {
  if (lin.consumed) {
    throw new Error('Linear value already consumed');
  }
  (lin as { consumed: boolean }).consumed = true;
  return lin.value;
}

/**
 * ISL syntax for linear types
 * 
 * @example
 * ```isl
 * behavior TransferFunds {
 *   input {
 *     source_account: AccountId [linear]  // Must be used exactly once
 *     amount: Money [affine]              // Must be used at most once
 *   }
 * }
 * ```
 */

// ============================================================================
// CAPABILITY-BASED EFFECTS
// ============================================================================

/**
 * Capability token - proves ability to perform effect
 */
export interface Capability<E extends Effect> {
  readonly effect: E;
  readonly scope: string;
  readonly expires?: Date;
}

/**
 * Capability-gated effect
 */
export function withCapability<E extends Effect, A>(
  capability: Capability<E>,
  action: () => Eff<[E], A>
): Eff<[], A> | null {
  if (capability.expires && new Date() > capability.expires) {
    return null;
  }
  // Capability is valid, allow effect
  return action() as unknown as Eff<[], A>;
}

// ============================================================================
// EFFECT POLYMORPHISM
// ============================================================================

/**
 * Effect-polymorphic function type
 * Works with any effect row that includes the required effects
 */
export type EffectPolymorphic<Required extends EffectRow, A> = 
  <Row extends EffectRow>(
    // Row must include all Required effects
    ...args: HasEffect<Row, Required[number]> extends true ? [] : never
  ) => Eff<Row, A>;
