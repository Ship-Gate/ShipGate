/**
 * State Machine Core Implementation
 *
 * A runtime state machine implementation based on ISL lifecycle specifications.
 */

export interface StateConfig {
  /** State name */
  name: string;
  /** Entry actions */
  onEntry?: string[];
  /** Exit actions */
  onExit?: string[];
  /** Whether this is a final state */
  final?: boolean;
  /** Whether this is the initial state */
  initial?: boolean;
  /** Guard conditions for entering this state */
  guards?: string[];
  /** State metadata */
  meta?: Record<string, unknown>;
}

export interface TransitionConfig {
  /** Source state */
  from: string;
  /** Target state */
  to: string;
  /** Event that triggers this transition */
  event: string;
  /** Guard conditions */
  guards?: string[];
  /** Actions to execute during transition */
  actions?: string[];
  /** Description */
  description?: string;
}

export interface StateMachineConfig {
  /** Machine ID */
  id: string;
  /** Initial state */
  initial: string;
  /** All states */
  states: StateConfig[];
  /** All transitions */
  transitions: TransitionConfig[];
  /** Context type (for TypeScript) */
  context?: Record<string, unknown>;
}

export interface StateMachineInstance<TContext = Record<string, unknown>> {
  /** Current state */
  currentState: string;
  /** Context data */
  context: TContext;
  /** State history */
  history: StateTransition[];
}

export interface StateTransition {
  /** Previous state */
  from: string;
  /** New state */
  to: string;
  /** Event that triggered transition */
  event: string;
  /** Timestamp */
  timestamp: string;
  /** Context at time of transition */
  context: Record<string, unknown>;
}

export type GuardFunction<TContext = Record<string, unknown>> = (
  context: TContext,
  event: { type: string; payload?: unknown }
) => boolean;

export type ActionFunction<TContext = Record<string, unknown>> = (
  context: TContext,
  event: { type: string; payload?: unknown }
) => TContext | void;

export class StateMachine<TContext = Record<string, unknown>> {
  private config: StateMachineConfig;
  private instance: StateMachineInstance<TContext>;
  private guards: Map<string, GuardFunction<TContext>>;
  private actions: Map<string, ActionFunction<TContext>>;
  private listeners: Set<(instance: StateMachineInstance<TContext>) => void>;

  constructor(config: StateMachineConfig, initialContext?: TContext) {
    this.config = config;
    this.guards = new Map();
    this.actions = new Map();
    this.listeners = new Set();

    this.instance = {
      currentState: config.initial,
      context: (initialContext ?? config.context ?? {}) as TContext,
      history: [],
    };
  }

  /**
   * Register a guard function
   */
  registerGuard(name: string, guard: GuardFunction<TContext>): void {
    this.guards.set(name, guard);
  }

  /**
   * Register an action function
   */
  registerAction(name: string, action: ActionFunction<TContext>): void {
    this.actions.set(name, action);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (instance: StateMachineInstance<TContext>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Send an event to the machine
   */
  send(event: string | { type: string; payload?: unknown }): boolean {
    const eventObj = typeof event === 'string' ? { type: event } : event;
    const transition = this.findTransition(eventObj.type);

    if (!transition) {
      console.warn(`No transition found for event '${eventObj.type}' from state '${this.instance.currentState}'`);
      return false;
    }

    // Check guards
    if (transition.guards) {
      for (const guardName of transition.guards) {
        const guard = this.guards.get(guardName);
        if (guard && !guard(this.instance.context, eventObj)) {
          console.warn(`Guard '${guardName}' blocked transition`);
          return false;
        }
      }
    }

    // Execute exit actions
    const currentStateConfig = this.getStateConfig(this.instance.currentState);
    if (currentStateConfig?.onExit) {
      this.executeActions(currentStateConfig.onExit, eventObj);
    }

    // Execute transition actions
    if (transition.actions) {
      this.executeActions(transition.actions, eventObj);
    }

    // Record transition
    const stateTransition: StateTransition = {
      from: this.instance.currentState,
      to: transition.to,
      event: eventObj.type,
      timestamp: new Date().toISOString(),
      context: { ...this.instance.context } as Record<string, unknown>,
    };
    this.instance.history.push(stateTransition);

    // Update state
    this.instance.currentState = transition.to;

    // Execute entry actions
    const newStateConfig = this.getStateConfig(transition.to);
    if (newStateConfig?.onEntry) {
      this.executeActions(newStateConfig.onEntry, eventObj);
    }

    // Notify listeners
    this.notifyListeners();

    return true;
  }

  /**
   * Check if a transition is possible
   */
  can(event: string): boolean {
    const transition = this.findTransition(event);
    if (!transition) return false;

    if (transition.guards) {
      for (const guardName of transition.guards) {
        const guard = this.guards.get(guardName);
        if (guard && !guard(this.instance.context, { type: event })) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get available events from current state
   */
  getAvailableEvents(): string[] {
    return this.config.transitions
      .filter((t) => t.from === this.instance.currentState || t.from === '*')
      .filter((t) => this.can(t.event))
      .map((t) => t.event);
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.instance.currentState;
  }

  /**
   * Get context
   */
  getContext(): TContext {
    return { ...this.instance.context };
  }

  /**
   * Update context
   */
  setContext(updates: Partial<TContext>): void {
    this.instance.context = { ...this.instance.context, ...updates };
    this.notifyListeners();
  }

  /**
   * Get state history
   */
  getHistory(): StateTransition[] {
    return [...this.instance.history];
  }

  /**
   * Check if in final state
   */
  isFinal(): boolean {
    const stateConfig = this.getStateConfig(this.instance.currentState);
    return stateConfig?.final ?? false;
  }

  /**
   * Reset to initial state
   */
  reset(context?: TContext): void {
    this.instance = {
      currentState: this.config.initial,
      context: context ?? (this.config.context ?? {}) as TContext,
      history: [],
    };
    this.notifyListeners();
  }

  /**
   * Serialize machine state
   */
  serialize(): string {
    return JSON.stringify({
      currentState: this.instance.currentState,
      context: this.instance.context,
      history: this.instance.history,
    });
  }

  /**
   * Restore machine state
   */
  restore(serialized: string): void {
    const data = JSON.parse(serialized);
    this.instance = {
      currentState: data.currentState,
      context: data.context as TContext,
      history: data.history,
    };
    this.notifyListeners();
  }

  private findTransition(event: string): TransitionConfig | undefined {
    return this.config.transitions.find(
      (t) => t.event === event && (t.from === this.instance.currentState || t.from === '*')
    );
  }

  private getStateConfig(stateName: string): StateConfig | undefined {
    return this.config.states.find((s) => s.name === stateName);
  }

  private executeActions(
    actionNames: string[],
    event: { type: string; payload?: unknown }
  ): void {
    for (const actionName of actionNames) {
      const action = this.actions.get(actionName);
      if (action) {
        const result = action(this.instance.context, event);
        if (result !== undefined) {
          this.instance.context = result as TContext;
        }
      }
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.instance);
    }
  }
}

/**
 * Create a state machine from configuration
 */
export function createStateMachine<TContext = Record<string, unknown>>(
  config: StateMachineConfig,
  initialContext?: TContext
): StateMachine<TContext> {
  return new StateMachine(config, initialContext);
}
