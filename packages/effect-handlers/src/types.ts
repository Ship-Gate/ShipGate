// ============================================================================
// ISL Effect System - Core Types
// @intentos/effect-handlers/types
// ============================================================================

// ============================================================================
// EFFECT SIGNATURES
// ============================================================================

/**
 * An effect signature defines the operations an effect provides.
 */
export interface EffectSignature<Ops extends Record<string, EffectOperation<any, any>>> {
  readonly name: string;
  readonly operations: Ops;
  readonly laws?: EffectLaw[];
}

/**
 * An effect operation is a single effectful action.
 */
export interface EffectOperation<Input, Output> {
  readonly name: string;
  readonly _input: Input;
  readonly _output: Output;
  readonly resumable: boolean;
}

/**
 * Effect laws define algebraic properties.
 */
export interface EffectLaw {
  readonly name: string;
  readonly description: string;
  readonly check: () => boolean;
}

// ============================================================================
// EFFECTFUL COMPUTATIONS
// ============================================================================

/**
 * Eff<E, A> represents an effectful computation that:
 * - May perform effects from the effect row E
 * - Eventually returns a value of type A
 */
export type Eff<E extends EffectRow, A> = {
  readonly _tag: 'Eff';
  readonly _effects: E;
  readonly _result: A;
  
  // Monadic operations
  map<B>(f: (a: A) => B): Eff<E, B>;
  flatMap<E2 extends EffectRow, B>(f: (a: A) => Eff<E2, B>): Eff<E | E2, B>;
  
  // Run the computation (internal)
  run(): Generator<EffectRequest<any, any>, A, any>;
};

/**
 * Effect row - the set of effects a computation may perform.
 */
export type EffectRow = EffectSignature<any> | never;

/**
 * Pure<A> is a computation with no effects.
 */
export type Pure<A> = Eff<never, A>;

/**
 * An effect request represents a call to an effect operation.
 */
export interface EffectRequest<E extends EffectSignature<any>, Op extends keyof E['operations']> {
  readonly effect: E;
  readonly operation: Op;
  readonly args: Parameters<E['operations'][Op]>;
}

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * A handler provides implementations for effect operations.
 */
export interface Handler<E extends EffectSignature<any>, R> {
  readonly effect: E;
  readonly operations: HandlerOperations<E, R>;
  readonly return: <A>(value: A) => R;
}

/**
 * Handler operations map effect operations to implementations.
 */
export type HandlerOperations<E extends EffectSignature<any>, R> = {
  [K in keyof E['operations']]: HandlerClause<E['operations'][K], R>;
};

/**
 * A handler clause handles one effect operation.
 */
export type HandlerClause<Op extends EffectOperation<any, any>, R> = (
  args: Op['_input'],
  resume: (result: Op['_output']) => R
) => R;

/**
 * Deep handler - handles all nested effects
 */
export interface DeepHandler<E extends EffectSignature<any>, R> extends Handler<E, R> {
  readonly depth: 'deep';
}

/**
 * Shallow handler - handles only immediate effects
 */
export interface ShallowHandler<E extends EffectSignature<any>, R> extends Handler<E, R> {
  readonly depth: 'shallow';
}

// ============================================================================
// EFFECT EVIDENCE
// ============================================================================

/**
 * Evidence that an effect E is present in the effect row Row.
 */
export interface Evidence<E extends EffectSignature<any>, Row extends EffectRow> {
  readonly effect: E;
  readonly _row: Row;
}

/**
 * Create evidence for an effect.
 */
export function evidence<E extends EffectSignature<any>, Row extends EffectRow>(
  effect: E
): Evidence<E, Row | E> {
  return { effect, _row: undefined as any };
}

// ============================================================================
// TYPE-LEVEL UTILITIES
// ============================================================================

/**
 * Remove an effect from an effect row.
 */
export type RemoveEffect<Row extends EffectRow, E extends EffectSignature<any>> = 
  Row extends E ? never : Row;

/**
 * Add an effect to an effect row.
 */
export type AddEffect<Row extends EffectRow, E extends EffectSignature<any>> = Row | E;

/**
 * Check if an effect is in an effect row.
 */
export type HasEffect<Row extends EffectRow, E extends EffectSignature<any>> = 
  E extends Row ? true : false;

/**
 * Merge two effect rows.
 */
export type MergeEffects<E1 extends EffectRow, E2 extends EffectRow> = E1 | E2;

// ============================================================================
// CONTINUATION TYPES
// ============================================================================

/**
 * A delimited continuation.
 */
export interface Continuation<A, B> {
  readonly _tag: 'Continuation';
  apply(value: A): B;
  compose<C>(other: Continuation<B, C>): Continuation<A, C>;
}

/**
 * A resumption is a continuation that can be invoked multiple times.
 */
export interface Resumption<A, B> extends Continuation<A, B> {
  readonly multishot: boolean;
}

// ============================================================================
// FIBER TYPES (for Async effect)
// ============================================================================

/**
 * A fiber represents a lightweight thread of execution.
 */
export interface Fiber<A> {
  readonly id: string;
  readonly status: FiberStatus;
  join(): Promise<A>;
  interrupt(): void;
}

export type FiberStatus = 
  | { tag: 'running' }
  | { tag: 'suspended' }
  | { tag: 'completed'; value: unknown }
  | { tag: 'failed'; error: unknown }
  | { tag: 'interrupted' };

// ============================================================================
// SCHEDULE TYPES (for Time effect)
// ============================================================================

export type ScheduleId = string & { readonly _brand: unique symbol };
