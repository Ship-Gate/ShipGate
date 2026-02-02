/**
 * ISL State Machine Types
 * 
 * Defines formal state machines for modeling complex business logic,
 * workflows, and system behavior.
 */

/**
 * State machine definition
 */
export interface StateMachine<
  TState extends string = string,
  TEvent extends string = string,
  TContext = unknown
> {
  id: string;
  description?: string;
  initial: TState;
  context?: TContext;
  states: Record<TState, StateNode<TState, TEvent, TContext>>;
  guards?: Record<string, Guard<TContext, TEvent>>;
  actions?: Record<string, Action<TContext, TEvent>>;
}

/**
 * State node definition
 */
export interface StateNode<
  TState extends string = string,
  TEvent extends string = string,
  TContext = unknown
> {
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  entry?: ActionRef[];
  exit?: ActionRef[];
  on?: Record<TEvent, Transition<TState, TContext, TEvent> | Transition<TState, TContext, TEvent>[]>;
  always?: Transition<TState, TContext, TEvent>[];
  after?: Record<number, Transition<TState, TContext, TEvent>>;
  states?: Record<string, StateNode<TState, TEvent, TContext>>;
  initial?: string;
  invoke?: InvokeConfig[];
  meta?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Transition definition
 */
export interface Transition<
  TState extends string = string,
  _TContext = unknown,
  _TEvent extends string = string
> {
  target?: TState;
  guard?: GuardRef;
  actions?: ActionRef[];
  internal?: boolean;
  description?: string;
}

/**
 * Guard function type
 */
export type Guard<TContext = unknown, TEvent extends string = string> = (
  context: TContext,
  event: EventObject<TEvent>
) => boolean;

/**
 * Action function type
 */
export type Action<TContext = unknown, TEvent extends string = string> = (
  context: TContext,
  event: EventObject<TEvent>
) => TContext | void;

/**
 * Guard reference
 */
export type GuardRef = string | { type: string; params?: Record<string, unknown> };

/**
 * Action reference
 */
export type ActionRef = string | { type: string; params?: Record<string, unknown> };

/**
 * Event object
 */
export interface EventObject<TEvent extends string = string> {
  type: TEvent;
  payload?: unknown;
  timestamp?: number;
}

/**
 * Invoke configuration for async operations
 */
export interface InvokeConfig {
  id?: string;
  src: string | ((context: unknown) => Promise<unknown>);
  onDone?: Transition<string, unknown, string>;
  onError?: Transition<string, unknown, string>;
}

/**
 * State machine instance
 */
export interface MachineInstance<
  TState extends string = string,
  TEvent extends string = string,
  TContext = unknown
> {
  machine: StateMachine<TState, TEvent, TContext>;
  state: TState;
  context: TContext;
  history: StateTransitionRecord<TState, TEvent>[];
  status: 'running' | 'stopped' | 'done' | 'error';
}

/**
 * State transition record
 */
export interface StateTransitionRecord<
  TState extends string = string,
  TEvent extends string = string
> {
  from: TState;
  to: TState;
  event: EventObject<TEvent>;
  timestamp: number;
  actions: string[];
}

/**
 * State machine verification result
 */
export interface VerificationResult {
  valid: boolean;
  errors: MachineError[];
  warnings: MachineWarning[];
  reachability: Map<string, boolean>;
  deadlocks: string[];
  unreachableStates: string[];
}

/**
 * Machine error
 */
export interface MachineError {
  type: 'invalid_transition' | 'missing_state' | 'missing_guard' | 'missing_action' | 'deadlock';
  message: string;
  state?: string;
  transition?: string;
}

/**
 * Machine warning
 */
export interface MachineWarning {
  type: 'unreachable_state' | 'no_exit' | 'missing_handler';
  message: string;
  state?: string;
}

/**
 * State machine ISL specification
 */
export interface StateMachineSpec {
  name: string;
  domain?: string;
  description?: string;
  states: StateSpec[];
  events: EventSpec[];
  transitions: TransitionSpec[];
  invariants?: string[];
}

/**
 * State specification
 */
export interface StateSpec {
  name: string;
  type?: 'initial' | 'normal' | 'final';
  description?: string;
  invariants?: string[];
}

/**
 * Event specification
 */
export interface EventSpec {
  name: string;
  description?: string;
  payload?: Record<string, string>;
}

/**
 * Transition specification
 */
export interface TransitionSpec {
  from: string;
  to: string;
  event: string;
  guard?: string;
  actions?: string[];
  description?: string;
}
