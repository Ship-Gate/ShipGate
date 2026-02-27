/**
 * Effect System Types
 */

// ============================================
// Core Effect Types
// ============================================

/**
 * An effect is a description of a side effect
 */
export interface Effect<T = unknown> {
  readonly _tag: string;
  readonly payload: T;
}

/**
 * Effect type constructor
 */
export type EffectType<Tag extends string, Payload> = Effect<Payload> & {
  readonly _tag: Tag;
};

/**
 * An effectful computation
 */
export type Eff<E extends Effect, A> = {
  readonly _E: E;
  readonly _A: A;
  run: () => Generator<E, A, unknown>;
};

// ============================================
// Standard Effects
// ============================================

/**
 * Console I/O effect
 */
export type ConsoleEffect =
  | EffectType<'console.log', { message: string }>
  | EffectType<'console.error', { message: string }>
  | EffectType<'console.read', void>;

/**
 * File system effect
 */
export type FileSystemEffect =
  | EffectType<'fs.read', { path: string }>
  | EffectType<'fs.write', { path: string; content: string }>
  | EffectType<'fs.delete', { path: string }>
  | EffectType<'fs.exists', { path: string }>;

/**
 * Network effect
 */
export type NetworkEffect =
  | EffectType<'http.request', { url: string; method: string; body?: unknown }>
  | EffectType<'http.response', { status: number; body: unknown }>;

/**
 * Database effect
 */
export type DatabaseEffect =
  | EffectType<'db.query', { sql: string; params?: unknown[] }>
  | EffectType<'db.execute', { sql: string; params?: unknown[] }>
  | EffectType<'db.transaction', { operations: DatabaseEffect[] }>;

/**
 * Time effect
 */
export type TimeEffect =
  | EffectType<'time.now', void>
  | EffectType<'time.sleep', { ms: number }>
  | EffectType<'time.timeout', { ms: number; action: () => unknown }>;

/**
 * Random effect
 */
export type RandomEffect =
  | EffectType<'random.int', { min: number; max: number }>
  | EffectType<'random.float', void>
  | EffectType<'random.uuid', void>;

/**
 * State effect
 */
export type StateEffect<S> =
  | EffectType<'state.get', void>
  | EffectType<'state.set', { value: S }>
  | EffectType<'state.modify', { fn: (s: S) => S }>;

/**
 * Error effect
 */
export type ErrorEffect =
  | EffectType<'error.throw', { error: Error }>
  | EffectType<'error.catch', { handler: (e: Error) => unknown }>;

/**
 * Async effect
 */
export type AsyncEffect =
  | EffectType<'async.fork', { computation: () => unknown }>
  | EffectType<'async.join', { fiber: Fiber }>
  | EffectType<'async.race', { computations: Array<() => unknown> }>;

export interface Fiber {
  id: string;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: Error;
}

// ============================================
// Effect Handlers
// ============================================

/**
 * Effect handler type
 */
export type Handler<E extends Effect, R> = {
  [K in E['_tag']]: (
    payload: Extract<E, { _tag: K }>['payload'],
    resume: (value: unknown) => R
  ) => R;
};

/**
 * Handler with return clause
 */
export interface FullHandler<E extends Effect, A, R> {
  return: (value: A) => R;
  handlers: Handler<E, R>;
}

// ============================================
// Effect Row Types
// ============================================

/**
 * Effect row - a set of effects
 */
export type EffectRow = Effect[];

/**
 * Check if effect is in row
 */
export type HasEffect<R extends EffectRow, E extends Effect> = E extends R[number]
  ? true
  : false;

/**
 * Remove effect from row
 */
export type RemoveEffect<R extends EffectRow, E extends Effect> = R extends [
  infer Head,
  ...infer Tail
]
  ? Head extends E
    ? Tail extends EffectRow
      ? RemoveEffect<Tail, E>
      : never
    : Tail extends EffectRow
    ? [Head, ...RemoveEffect<Tail, E>]
    : never
  : [];

// ============================================
// ISL Effect Annotations
// ============================================

/**
 * ISL effect annotation
 */
export interface ISLEffectAnnotation {
  name: string;
  kind: EffectKind;
  description?: string;
  reversible: boolean;
  idempotent: boolean;
}

export type EffectKind =
  | 'io'
  | 'state'
  | 'exception'
  | 'async'
  | 'nondeterminism'
  | 'resource'
  | 'logging'
  | 'metrics'
  | 'custom';

/**
 * Effect signature for ISL behaviors
 */
export interface EffectSignature {
  behavior: string;
  effects: ISLEffectAnnotation[];
  pure: boolean;
}

// ============================================
// Effect Analysis
// ============================================

export interface EffectAnalysisResult {
  behavior: string;
  effects: ISLEffectAnnotation[];
  warnings: EffectWarning[];
  suggestions: string[];
}

export interface EffectWarning {
  kind: 'unhandled' | 'unsafe' | 'performance' | 'composition';
  message: string;
  location?: string;
}
