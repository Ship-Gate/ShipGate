/**
 * ISL State Machine Builder
 * 
 * Fluent API for constructing state machines
 */

import type {
  StateMachine,
  StateNode,
  Transition,
  Guard,
  Action,
  GuardRef,
  ActionRef,
  InvokeConfig,
} from './types';

/**
 * State machine builder
 */
export class MachineBuilder<
  TState extends string = string,
  TEvent extends string = string,
  TContext = Record<string, unknown>
> {
  private machine: StateMachine<TState, TEvent, TContext>;

  constructor(id: string) {
    this.machine = {
      id,
      initial: '' as TState,
      states: {} as Record<TState, StateNode<TState, TEvent, TContext>>,
      guards: {},
      actions: {},
    };
  }

  /**
   * Set machine description
   */
  description(desc: string): this {
    this.machine.description = desc;
    return this;
  }

  /**
   * Set initial context
   */
  context(ctx: TContext): this {
    this.machine.context = ctx;
    return this;
  }

  /**
   * Set initial state
   */
  initial(state: TState): this {
    this.machine.initial = state;
    return this;
  }

  /**
   * Add a state
   */
  state(name: TState, config?: Partial<StateNode<TState, TEvent, TContext>>): this {
    this.machine.states[name] = {
      type: 'atomic',
      ...config,
    } as StateNode<TState, TEvent, TContext>;
    return this;
  }

  /**
   * Add an atomic state
   */
  atomic(name: TState): StateBuilder<TState, TEvent, TContext> {
    return new StateBuilder(this, name, 'atomic');
  }

  /**
   * Add a final state
   */
  final(name: TState): this {
    this.machine.states[name] = { type: 'final' } as StateNode<TState, TEvent, TContext>;
    return this;
  }

  /**
   * Add a compound state
   */
  compound(name: TState): StateBuilder<TState, TEvent, TContext> {
    return new StateBuilder(this, name, 'compound');
  }

  /**
   * Add a parallel state
   */
  parallel(name: TState): StateBuilder<TState, TEvent, TContext> {
    return new StateBuilder(this, name, 'parallel');
  }

  /**
   * Add a guard
   */
  guard(name: string, fn: Guard<TContext, TEvent>): this {
    this.machine.guards![name] = fn;
    return this;
  }

  /**
   * Add an action
   */
  action(name: string, fn: Action<TContext, TEvent>): this {
    this.machine.actions![name] = fn;
    return this;
  }

  /**
   * Internal: set state node
   */
  _setState(name: TState, node: StateNode<TState, TEvent, TContext>): void {
    this.machine.states[name] = node;
  }

  /**
   * Build the state machine
   */
  build(): StateMachine<TState, TEvent, TContext> {
    if (!this.machine.initial) {
      const states = Object.keys(this.machine.states);
      if (states.length > 0) {
        this.machine.initial = states[0] as TState;
      }
    }
    return this.machine;
  }
}

/**
 * State builder for fluent state configuration
 */
export class StateBuilder<
  TState extends string = string,
  TEvent extends string = string,
  TContext = Record<string, unknown>
> {
  private node: StateNode<TState, TEvent, TContext>;

  constructor(
    private parent: MachineBuilder<TState, TEvent, TContext>,
    private name: TState,
    type: StateNode<TState, TEvent, TContext>['type']
  ) {
    this.node = {
      type,
      on: {} as Record<TEvent, Transition<TState, TContext, TEvent>>,
    };
  }

  /**
   * Add entry actions
   */
  entry(...actions: ActionRef[]): this {
    this.node.entry = actions;
    return this;
  }

  /**
   * Add exit actions
   */
  exit(...actions: ActionRef[]): this {
    this.node.exit = actions;
    return this;
  }

  /**
   * Add a transition on an event
   */
  on(
    event: TEvent,
    target: TState,
    config?: { guard?: GuardRef; actions?: ActionRef[]; internal?: boolean }
  ): this {
    const transition: Transition<TState, TContext, TEvent> = {
      target,
      guard: config?.guard,
      actions: config?.actions,
      internal: config?.internal,
    };

    const existing = this.node.on![event];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(transition);
      } else {
        this.node.on![event] = [existing, transition];
      }
    } else {
      this.node.on![event] = transition;
    }

    return this;
  }

  /**
   * Add an internal transition (no state change)
   */
  onInternal(event: TEvent, actions: ActionRef[]): this {
    this.node.on![event] = {
      internal: true,
      actions,
    };
    return this;
  }

  /**
   * Add an always transition (eventless)
   */
  always(target: TState, config?: { guard?: GuardRef; actions?: ActionRef[] }): this {
    if (!this.node.always) {
      this.node.always = [];
    }
    this.node.always.push({
      target,
      guard: config?.guard,
      actions: config?.actions,
    });
    return this;
  }

  /**
   * Add a delayed transition
   */
  after(delay: number, target: TState, config?: { guard?: GuardRef; actions?: ActionRef[] }): this {
    if (!this.node.after) {
      this.node.after = {};
    }
    this.node.after[delay] = {
      target,
      guard: config?.guard,
      actions: config?.actions,
    };
    return this;
  }

  /**
   * Add an invoke configuration
   */
  invoke(config: InvokeConfig): this {
    if (!this.node.invoke) {
      this.node.invoke = [];
    }
    this.node.invoke.push(config);
    return this;
  }

  /**
   * Add metadata
   */
  meta(data: Record<string, unknown>): this {
    this.node.meta = data;
    return this;
  }

  /**
   * Add tags
   */
  tags(...tags: string[]): this {
    this.node.tags = tags;
    return this;
  }

  /**
   * For compound states: set initial child state
   */
  initialChild(state: string): this {
    this.node.initial = state;
    return this;
  }

  /**
   * For compound states: add child states
   */
  children(states: Record<string, StateNode<TState, TEvent, TContext>>): this {
    this.node.states = states;
    return this;
  }

  /**
   * Finish building this state and return to parent
   */
  done(): MachineBuilder<TState, TEvent, TContext> {
    this.parent._setState(this.name, this.node);
    return this.parent;
  }
}

/**
 * Create a new state machine builder
 */
export function createMachine<
  TState extends string = string,
  TEvent extends string = string,
  TContext = Record<string, unknown>
>(id: string): MachineBuilder<TState, TEvent, TContext> {
  return new MachineBuilder<TState, TEvent, TContext>(id);
}

/**
 * Quick machine definition helper
 */
export function defineMachine<
  TState extends string,
  TEvent extends string,
  TContext = Record<string, unknown>
>(
  config: Omit<StateMachine<TState, TEvent, TContext>, 'guards' | 'actions'> & {
    guards?: Record<string, Guard<TContext, TEvent>>;
    actions?: Record<string, Action<TContext, TEvent>>;
  }
): StateMachine<TState, TEvent, TContext> {
  return config as StateMachine<TState, TEvent, TContext>;
}
