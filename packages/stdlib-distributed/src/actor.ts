// ============================================================================
// ISL Standard Library - Actor Model
// @isl-lang/stdlib-distributed/actor
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type ActorRef<M> = {
  readonly id: string;
  readonly address: string;
  send(message: M): void;
  ask<R>(message: M, timeoutMs?: number): Promise<R>;
};

export type ActorContext<M, S> = {
  self: ActorRef<M>;
  state: S;
  sender?: ActorRef<unknown>;
  spawn<CM, CS>(behavior: ActorBehavior<CM, CS>, name?: string): ActorRef<CM>;
  stop(ref?: ActorRef<unknown>): void;
  watch(ref: ActorRef<unknown>): void;
  unwatch(ref: ActorRef<unknown>): void;
  schedule(message: M, delayMs: number): CancelToken;
  scheduleRepeat(message: M, intervalMs: number): CancelToken;
};

export type ActorBehavior<M, S = void> = {
  initialState: S | (() => S);
  receive: (context: ActorContext<M, S>, message: M) => S | Promise<S>;
  onStart?: (context: ActorContext<M, S>) => void | Promise<void>;
  onStop?: (context: ActorContext<M, S>) => void | Promise<void>;
  onSignal?: (context: ActorContext<M, S>, signal: ActorSignal) => void | Promise<void>;
  supervision?: SupervisionStrategy;
};

export type ActorSignal =
  | { type: 'started' }
  | { type: 'stopped' }
  | { type: 'child-stopped'; ref: ActorRef<unknown> }
  | { type: 'child-failed'; ref: ActorRef<unknown>; error: Error }
  | { type: 'watch-terminated'; ref: ActorRef<unknown> };

export type SupervisionStrategy =
  | { type: 'restart'; maxRetries?: number; withinMs?: number }
  | { type: 'stop' }
  | { type: 'resume' }
  | { type: 'escalate' };

export interface CancelToken {
  cancel(): void;
  readonly isCancelled: boolean;
}

export interface Envelope<M> {
  message: M;
  sender?: ActorRef<unknown>;
  replyTo?: (response: unknown) => void;
}

export type ActorStatus = 'idle' | 'processing' | 'stopped' | 'failed';

// ============================================================================
// ACTOR IMPLEMENTATION
// ============================================================================

export class Actor<M, S = void> {
  private readonly id: string;
  private readonly behavior: ActorBehavior<M, S>;
  private state: S;
  private status: ActorStatus = 'idle';
  private mailbox: Envelope<M>[] = [];
  private processing = false;
  private children = new Map<string, Actor<unknown, unknown>>();
  private watchers = new Set<ActorRef<unknown>>();
  private watching = new Set<string>();
  private timers = new Set<NodeJS.Timeout>();
  private parent?: Actor<unknown, unknown>;
  private restartCount = 0;
  private lastRestartTime = 0;
  private onStopCallbacks: Array<() => void> = [];

  constructor(
    id: string,
    behavior: ActorBehavior<M, S>,
    parent?: Actor<unknown, unknown>
  ) {
    this.id = id;
    this.behavior = behavior;
    this.parent = parent;
    this.state = typeof behavior.initialState === 'function'
      ? (behavior.initialState as () => S)()
      : behavior.initialState;
  }

  /**
   * Get the actor's reference.
   */
  get ref(): ActorRef<M> {
    return {
      id: this.id,
      address: this.getAddress(),
      send: (message: M) => this.send(message),
      ask: <R>(message: M, timeoutMs?: number) => this.ask<R>(message, timeoutMs),
    };
  }

  /**
   * Get actor status.
   */
  getStatus(): ActorStatus {
    return this.status;
  }

  /**
   * Start the actor.
   */
  async start(): Promise<void> {
    if (this.status !== 'idle') return;

    const context = this.createContext();

    if (this.behavior.onStart) {
      await this.behavior.onStart(context);
    }

    if (this.behavior.onSignal) {
      await this.behavior.onSignal(context, { type: 'started' });
    }

    this.status = 'processing';
    this.processMailbox();
  }

  /**
   * Stop the actor.
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped') return;

    this.status = 'stopped';

    // Stop all children
    for (const child of this.children.values()) {
      await child.stop();
    }

    // Clear timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Notify watchers
    for (const watcher of this.watchers) {
      watcher.send({ type: 'watch-terminated', ref: this.ref } as unknown);
    }

    const context = this.createContext();

    if (this.behavior.onSignal) {
      await this.behavior.onSignal(context, { type: 'stopped' });
    }

    if (this.behavior.onStop) {
      await this.behavior.onStop(context);
    }

    // Run stop callbacks
    for (const callback of this.onStopCallbacks) {
      callback();
    }
  }

  /**
   * Send a message to this actor.
   */
  send(message: M, sender?: ActorRef<unknown>): void {
    if (this.status === 'stopped') return;

    this.mailbox.push({ message, sender });
    this.processMailbox();
  }

  /**
   * Send a message and wait for a reply.
   */
  ask<R>(message: M, timeoutMs = 5000): Promise<R> {
    return new Promise((resolve, reject) => {
      if (this.status === 'stopped') {
        reject(new Error('Actor is stopped'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Ask timed out'));
      }, timeoutMs);

      this.mailbox.push({
        message,
        replyTo: (response: unknown) => {
          clearTimeout(timeout);
          resolve(response as R);
        },
      });

      this.processMailbox();
    });
  }

  /**
   * Register a callback for when the actor stops.
   */
  onStop(callback: () => void): void {
    this.onStopCallbacks.push(callback);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private getAddress(): string {
    if (this.parent) {
      return `${(this.parent as Actor<unknown, unknown>).getAddress()}/${this.id}`;
    }
    return `/${this.id}`;
  }

  private createContext(): ActorContext<M, S> {
    return {
      self: this.ref,
      state: this.state,
      spawn: <CM, CS>(behavior: ActorBehavior<CM, CS>, name?: string) => {
        return this.spawnChild(behavior, name);
      },
      stop: (ref?: ActorRef<unknown>) => {
        if (!ref) {
          this.stop();
        } else {
          const child = this.children.get(ref.id);
          if (child) {
            child.stop();
            this.children.delete(ref.id);
          }
        }
      },
      watch: (ref: ActorRef<unknown>) => {
        this.watching.add(ref.id);
      },
      unwatch: (ref: ActorRef<unknown>) => {
        this.watching.delete(ref.id);
      },
      schedule: (message: M, delayMs: number) => {
        return this.scheduleMessage(message, delayMs, false);
      },
      scheduleRepeat: (message: M, intervalMs: number) => {
        return this.scheduleMessage(message, intervalMs, true);
      },
    };
  }

  private spawnChild<CM, CS>(
    behavior: ActorBehavior<CM, CS>,
    name?: string
  ): ActorRef<CM> {
    const childId = name ?? crypto.randomUUID();
    const child = new Actor(childId, behavior, this as unknown as Actor<unknown, unknown>);
    this.children.set(childId, child as unknown as Actor<unknown, unknown>);
    child.start();
    return child.ref;
  }

  private scheduleMessage(
    message: M,
    delayMs: number,
    repeat: boolean
  ): CancelToken {
    let cancelled = false;
    let timer: NodeJS.Timeout;

    const schedule = () => {
      timer = setTimeout(() => {
        if (!cancelled && this.status !== 'stopped') {
          this.send(message);
          if (repeat) {
            schedule();
          }
        }
      }, delayMs);
      this.timers.add(timer);
    };

    schedule();

    return {
      cancel: () => {
        cancelled = true;
        clearTimeout(timer);
        this.timers.delete(timer);
      },
      get isCancelled() {
        return cancelled;
      },
    };
  }

  private async processMailbox(): Promise<void> {
    if (this.processing || this.status === 'stopped') return;

    this.processing = true;

    while (this.mailbox.length > 0 && this.getStatus() !== 'stopped') {
      const envelope = this.mailbox.shift()!;
      
      try {
        const context = {
          ...this.createContext(),
          sender: envelope.sender,
        };

        const newState = await this.behavior.receive(context, envelope.message);
        this.state = newState;

        if (envelope.replyTo) {
          envelope.replyTo(newState);
        }
      } catch (error) {
        await this.handleFailure(error as Error);
      }
    }

    this.processing = false;
  }

  private async handleFailure(error: Error): Promise<void> {
    const strategy = this.behavior.supervision ?? { type: 'restart', maxRetries: 3 };

    switch (strategy.type) {
      case 'restart':
        const now = Date.now();
        const withinMs = strategy.withinMs ?? 60000;
        
        if (now - this.lastRestartTime > withinMs) {
          this.restartCount = 0;
        }

        if (this.restartCount < (strategy.maxRetries ?? 3)) {
          this.restartCount++;
          this.lastRestartTime = now;
          
          // Reset state and restart
          this.state = typeof this.behavior.initialState === 'function'
            ? (this.behavior.initialState as () => S)()
            : this.behavior.initialState;
          
          if (this.behavior.onStart) {
            await this.behavior.onStart(this.createContext());
          }
        } else {
          this.status = 'failed';
          this.notifyParentOfFailure(error);
        }
        break;

      case 'stop':
        this.status = 'failed';
        await this.stop();
        break;

      case 'resume':
        // Continue processing
        break;

      case 'escalate':
        this.notifyParentOfFailure(error);
        break;
    }
  }

  private notifyParentOfFailure(error: Error): void {
    if (this.parent && this.parent.behavior.onSignal) {
      const signal: ActorSignal = {
        type: 'child-failed',
        ref: this.ref as ActorRef<unknown>,
        error,
      };
      this.parent.behavior.onSignal(
        this.parent.createContext() as ActorContext<unknown, unknown>,
        signal
      );
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new actor with the given behavior.
 */
export function createActor<M, S = void>(
  behavior: ActorBehavior<M, S>,
  name?: string
): Actor<M, S> {
  return new Actor(name ?? crypto.randomUUID(), behavior);
}

/**
 * Define an actor behavior.
 */
export function defineBehavior<M, S = void>(
  config: ActorBehavior<M, S>
): ActorBehavior<M, S> {
  return config;
}

/**
 * Create a stateless actor behavior.
 */
export function stateless<M>(
  receive: (context: ActorContext<M, void>, message: M) => void | Promise<void>
): ActorBehavior<M, void> {
  return {
    initialState: undefined as void,
    receive: async (context, message) => {
      await receive(context, message);
      return undefined as void;
    },
  };
}

/**
 * Create a stateful actor behavior.
 */
export function stateful<M, S>(
  initialState: S | (() => S),
  receive: (context: ActorContext<M, S>, message: M) => S | Promise<S>
): ActorBehavior<M, S> {
  return {
    initialState,
    receive,
  };
}
