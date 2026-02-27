/**
 * ISL State Machine Interpreter
 * 
 * Executes state machines with proper transition handling
 */

import type {
  StateMachine,
  Transition,
  EventObject,
  MachineInstance,
  StateTransitionRecord,
  Guard,
  Action,
  GuardRef,
  ActionRef,
} from './types';

/**
 * Interpreter options
 */
export interface InterpreterOptions<TContext = unknown> {
  onTransition?: (record: StateTransitionRecord) => void;
  onStateChange?: (state: string, context: TContext) => void;
  onAction?: (name: string, context: TContext) => void;
  maxHistory?: number;
}

/**
 * Create a machine instance
 */
export function createInstance<
  TState extends string,
  TEvent extends string,
  TContext
>(
  machine: StateMachine<TState, TEvent, TContext>
): MachineInstance<TState, TEvent, TContext> {
  return {
    machine,
    state: machine.initial,
    context: machine.context ?? ({} as TContext),
    history: [],
    status: 'stopped',
  };
}

/**
 * Start the machine instance
 */
export function start<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  options?: InterpreterOptions<TContext>
): MachineInstance<TState, TEvent, TContext> {
  const newInstance = { ...instance, status: 'running' as const };

  // Execute entry actions for initial state
  const initialState = instance.machine.states[instance.state];
  if (initialState?.entry) {
    newInstance.context = executeActions(
      newInstance,
      initialState.entry,
      { type: '' as TEvent, timestamp: Date.now() },
      options
    );
  }

  // Check for always transitions
  return checkAlwaysTransitions(newInstance, options);
}

/**
 * Send an event to the machine
 */
export function send<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  event: TEvent | EventObject<TEvent>,
  options?: InterpreterOptions<TContext>
): MachineInstance<TState, TEvent, TContext> {
  if (instance.status !== 'running') {
    return instance;
  }

  const eventObj: EventObject<TEvent> =
    typeof event === 'string'
      ? { type: event, timestamp: Date.now() }
      : { ...event, timestamp: event.timestamp ?? Date.now() };

  const currentState = instance.machine.states[instance.state];
  if (!currentState?.on) {
    return instance;
  }

  const transitions = currentState.on[eventObj.type];
  if (!transitions) {
    return instance;
  }

  const transitionArray = Array.isArray(transitions) ? transitions : [transitions];

  // Find first valid transition
  for (const transition of transitionArray) {
    if (isTransitionEnabled(instance, transition, eventObj)) {
      return executeTransition(instance, transition, eventObj, options);
    }
  }

  return instance;
}

/**
 * Check if a transition is enabled
 */
function isTransitionEnabled<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  transition: Transition<TState, TContext, TEvent>,
  event: EventObject<TEvent>
): boolean {
  if (!transition.guard) {
    return true;
  }

  const guard = resolveGuard(instance.machine, transition.guard);
  if (!guard) {
    return true;
  }

  return guard(instance.context, event);
}

/**
 * Execute a transition
 */
function executeTransition<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  transition: Transition<TState, TContext, TEvent>,
  event: EventObject<TEvent>,
  options?: InterpreterOptions<TContext>
): MachineInstance<TState, TEvent, TContext> {
  const fromState = instance.state;
  const toState = transition.target ?? instance.state;
  const isInternal = transition.internal;

  let newContext = instance.context;
  const executedActions: string[] = [];

  // Exit actions (if not internal transition)
  if (!isInternal && fromState !== toState) {
    const currentStateNode = instance.machine.states[fromState];
    if (currentStateNode?.exit) {
      newContext = executeActions(
        { ...instance, context: newContext },
        currentStateNode.exit,
        event,
        options
      );
      executedActions.push(...currentStateNode.exit.map(a => typeof a === 'string' ? a : a.type));
    }
  }

  // Transition actions
  if (transition.actions) {
    newContext = executeActions(
      { ...instance, context: newContext },
      transition.actions,
      event,
      options
    );
    executedActions.push(...transition.actions.map(a => typeof a === 'string' ? a : a.type));
  }

  // Entry actions (if not internal transition)
  if (!isInternal && fromState !== toState) {
    const targetStateNode = instance.machine.states[toState];
    if (targetStateNode?.entry) {
      newContext = executeActions(
        { ...instance, context: newContext },
        targetStateNode.entry,
        event,
        options
      );
      executedActions.push(...targetStateNode.entry.map(a => typeof a === 'string' ? a : a.type));
    }
  }

  // Create transition record
  const record: StateTransitionRecord<TState, TEvent> = {
    from: fromState,
    to: toState,
    event,
    timestamp: Date.now(),
    actions: executedActions,
  };

  // Update history
  const maxHistory = options?.maxHistory ?? 100;
  const history = [...instance.history, record].slice(-maxHistory);

  // Notify listeners
  if (options?.onTransition) {
    options.onTransition(record);
  }

  if (options?.onStateChange && fromState !== toState) {
    options.onStateChange(toState, newContext);
  }

  // Check if we've reached a final state
  const targetStateNode = instance.machine.states[toState];
  const status = targetStateNode?.type === 'final' ? 'done' : 'running';

  const newInstance: MachineInstance<TState, TEvent, TContext> = {
    ...instance,
    state: toState,
    context: newContext,
    history,
    status,
  };

  // Check for always transitions
  return checkAlwaysTransitions(newInstance, options);
}

/**
 * Check and execute always transitions
 */
function checkAlwaysTransitions<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  options?: InterpreterOptions<TContext>
): MachineInstance<TState, TEvent, TContext> {
  const currentState = instance.machine.states[instance.state];
  if (!currentState?.always) {
    return instance;
  }

  const event: EventObject<TEvent> = { type: '' as TEvent, timestamp: Date.now() };

  for (const transition of currentState.always) {
    if (isTransitionEnabled(instance, transition, event)) {
      return executeTransition(instance, transition, event, options);
    }
  }

  return instance;
}

/**
 * Execute actions and return updated context
 */
function executeActions<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  actions: ActionRef[],
  event: EventObject<TEvent>,
  options?: InterpreterOptions<TContext>
): TContext {
  let context = instance.context;

  for (const actionRef of actions) {
    const action = resolveAction(instance.machine, actionRef);
    if (action) {
      const result = action(context, event);
      if (result !== undefined) {
        context = result as TContext;
      }

      if (options?.onAction) {
        const actionName = typeof actionRef === 'string' ? actionRef : actionRef.type;
        options.onAction(actionName, context);
      }
    }
  }

  return context;
}

/**
 * Resolve a guard reference to a guard function
 */
function resolveGuard<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>,
  ref: GuardRef
): Guard<TContext, TEvent> | undefined {
  const name = typeof ref === 'string' ? ref : ref.type;
  return machine.guards?.[name];
}

/**
 * Resolve an action reference to an action function
 */
function resolveAction<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>,
  ref: ActionRef
): Action<TContext, TEvent> | undefined {
  const name = typeof ref === 'string' ? ref : ref.type;
  return machine.actions?.[name];
}

/**
 * Get current state value
 */
export function getState<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>
): TState {
  return instance.state;
}

/**
 * Get current context
 */
export function getContext<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>
): TContext {
  return instance.context;
}

/**
 * Check if machine is in a specific state
 */
export function isInState<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  state: TState
): boolean {
  return instance.state === state;
}

/**
 * Check if machine can handle an event
 */
export function canHandle<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>,
  event: TEvent
): boolean {
  const currentState = instance.machine.states[instance.state];
  return currentState?.on?.[event] !== undefined;
}

/**
 * Get available events for current state
 */
export function getAvailableEvents<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>
): TEvent[] {
  const currentState = instance.machine.states[instance.state];
  if (!currentState?.on) {
    return [];
  }
  return Object.keys(currentState.on) as TEvent[];
}

/**
 * Stop the machine
 */
export function stop<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>
): MachineInstance<TState, TEvent, TContext> {
  return { ...instance, status: 'stopped' };
}

/**
 * Reset the machine to initial state
 */
export function reset<TState extends string, TEvent extends string, TContext>(
  instance: MachineInstance<TState, TEvent, TContext>
): MachineInstance<TState, TEvent, TContext> {
  return {
    ...instance,
    state: instance.machine.initial,
    context: instance.machine.context ?? ({} as TContext),
    history: [],
    status: 'stopped',
  };
}
