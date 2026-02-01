// ============================================================================
// ISL Actor System - Core Actor Implementation
// ============================================================================

import type {
  ActorRef,
  ActorPath,
  ActorState,
  ActorDef,
  ActorContext,
  Behavior,
  MessageHandler,
  Envelope,
  SupervisionStrategy,
  SupervisionDirective,
  SystemMessage,
  Cancellable,
  Logger,
  ActorSystem,
} from './types.js';

/**
 * Internal actor state
 */
interface ActorInternals<S, M> {
  ref: ActorRef;
  path: ActorPath;
  state: ActorState;
  definition: ActorDef<S, M>;
  currentState: S;
  currentHandler: MessageHandler<S, M>;
  behaviorStack: MessageHandler<S, M>[];
  stash: M[];
  mailbox: Envelope<M>[];
  parent?: ActorRef;
  children: Map<string, ActorRef>;
  watching: Set<ActorRef>;
  watchedBy: Set<ActorRef>;
  restartCount: number;
  lastRestartTime?: number;
  scheduledTasks: Set<Cancellable>;
  system: ActorSystem;
}

/**
 * Create an actor
 */
export function createActor<S, M>(
  definition: ActorDef<S, M>,
  path: ActorPath,
  parent: ActorRef | undefined,
  system: ActorSystem
): ActorInternals<S, M> {
  const ref = generateActorRef();
  const initialState = typeof definition.initialState === 'function'
    ? (definition.initialState as () => S)()
    : definition.initialState;

  return {
    ref,
    path,
    state: 'CREATED',
    definition,
    currentState: initialState,
    currentHandler: definition.receive,
    behaviorStack: [definition.receive],
    stash: [],
    mailbox: [],
    parent,
    children: new Map(),
    watching: new Set(),
    watchedBy: new Set(),
    restartCount: 0,
    scheduledTasks: new Set(),
    system,
  };
}

/**
 * Create actor context for message processing
 */
export function createActorContext<S, M>(
  actor: ActorInternals<S, M>,
  envelope?: Envelope<M>
): ActorContext<S, M> {
  return {
    self: actor.ref,
    path: actor.path,
    sender: envelope?.sender,
    state: actor.currentState,
    parent: actor.parent,
    children: Array.from(actor.children.values()),
    system: actor.system,
    log: createLogger(actor.path),

    send<T>(recipient: ActorRef, message: T): void {
      actor.system.send(recipient, message);
    },

    ask<T, R>(recipient: ActorRef, message: T, timeout?: number): Promise<R> {
      return actor.system.ask<T, R>(recipient, message, timeout);
    },

    reply<T>(message: T): void {
      if (envelope?.sender) {
        actor.system.send(envelope.sender, message);
      }
    },

    forward<T>(recipient: ActorRef, message: T): void {
      actor.system.send(recipient, message);
    },

    spawn<CS, CM>(def: ActorDef<CS, CM>, name?: string): ActorRef {
      const childName = name ?? `child-${actor.children.size}`;
      const childPath = `${actor.path}/${childName}` as ActorPath;
      // This would delegate to system.spawn with parent context
      return actor.system.spawn(def, childPath);
    },

    stop(ref?: ActorRef): void {
      const target = ref ?? actor.ref;
      actor.system.stop(target);
    },

    watch(ref: ActorRef): void {
      actor.watching.add(ref);
      actor.system.send(ref, { kind: 'Watch', target: actor.ref } as SystemMessage);
    },

    unwatch(ref: ActorRef): void {
      actor.watching.delete(ref);
      actor.system.send(ref, { kind: 'Unwatch', target: actor.ref } as SystemMessage);
    },

    become(handler: MessageHandler<S, M>): Behavior<S, M> {
      actor.behaviorStack.push(handler);
      actor.currentHandler = handler;
      return { state: actor.currentState, handler };
    },

    unbecome(): Behavior<S, M> {
      if (actor.behaviorStack.length > 1) {
        actor.behaviorStack.pop();
        actor.currentHandler = actor.behaviorStack[actor.behaviorStack.length - 1]!;
      }
      return { state: actor.currentState, handler: actor.currentHandler };
    },

    stash(): void {
      if (envelope) {
        actor.stash.push(envelope.message);
      }
    },

    unstashAll(): void {
      // Prepend stashed messages to mailbox
      const stashed = actor.stash.map(m => createEnvelope(m, undefined, actor.ref));
      actor.mailbox.unshift(...stashed);
      actor.stash = [];
    },

    scheduleOnce<T>(delay: number, message: T, recipient?: ActorRef): Cancellable {
      const target = recipient ?? actor.ref;
      const cancellable = actor.system.scheduler.scheduleOnce(delay, () => {
        actor.system.send(target, message);
      });
      actor.scheduledTasks.add(cancellable);
      return cancellable;
    },

    scheduleRepeatedly<T>(
      initialDelay: number,
      interval: number,
      message: T,
      recipient?: ActorRef
    ): Cancellable {
      const target = recipient ?? actor.ref;
      const cancellable = actor.system.scheduler.scheduleRepeatedly(
        initialDelay,
        interval,
        () => { actor.system.send(target, message); }
      );
      actor.scheduledTasks.add(cancellable);
      return cancellable;
    },
  };
}

/**
 * Process a message
 */
export async function processMessage<S, M>(
  actor: ActorInternals<S, M>,
  envelope: Envelope<M>
): Promise<void> {
  if (actor.state !== 'RUNNING') {
    actor.mailbox.push(envelope);
    return;
  }

  const ctx = createActorContext(actor, envelope);

  try {
    const result = await actor.currentHandler(actor.currentState, envelope.message, ctx);

    if (isBehavior(result)) {
      actor.currentState = result.state;
      if (result.handler) {
        actor.currentHandler = result.handler;
      }
    } else {
      actor.currentState = result as S;
    }
  } catch (error) {
    await handleFailure(actor, error as Error);
  }
}

/**
 * Handle actor failure
 */
async function handleFailure<S, M>(
  actor: ActorInternals<S, M>,
  error: Error
): Promise<void> {
  const strategy = actor.definition.supervisionStrategy;
  if (!strategy) {
    // Default: escalate to parent
    if (actor.parent) {
      actor.system.send(actor.parent, {
        kind: 'ChildFailed',
        child: actor.ref,
        error,
      } as SystemMessage);
    }
    actor.state = 'FAILED';
    return;
  }

  const directive = strategy.decider(error);
  await applyDirective(actor, directive, error);
}

/**
 * Apply supervision directive
 */
async function applyDirective<S, M>(
  actor: ActorInternals<S, M>,
  directive: SupervisionDirective,
  error: Error
): Promise<void> {
  switch (directive) {
    case 'RESUME':
      // Continue with same state
      break;

    case 'RESTART':
      await restartActor(actor, error);
      break;

    case 'STOP':
      await stopActor(actor, 'Stopped due to failure');
      break;

    case 'ESCALATE':
      if (actor.parent) {
        actor.system.send(actor.parent, {
          kind: 'ChildFailed',
          child: actor.ref,
          error,
        } as SystemMessage);
      }
      actor.state = 'FAILED';
      break;
  }
}

/**
 * Restart an actor
 */
async function restartActor<S, M>(
  actor: ActorInternals<S, M>,
  error: Error
): Promise<void> {
  actor.state = 'RESTARTING';

  // Check restart limits
  const strategy = actor.definition.supervisionStrategy;
  if (strategy) {
    const now = Date.now();
    if (actor.lastRestartTime && now - actor.lastRestartTime < strategy.withinDuration) {
      actor.restartCount++;
    } else {
      actor.restartCount = 1;
    }

    if (actor.restartCount > strategy.maxRestarts) {
      await stopActor(actor, 'Max restarts exceeded');
      return;
    }

    actor.lastRestartTime = now;
  }

  // Call preRestart hook
  if (actor.definition.preRestart) {
    const ctx = createActorContext(actor);
    await actor.definition.preRestart(ctx, error);
  }

  // Reset state
  const initialState = typeof actor.definition.initialState === 'function'
    ? (actor.definition.initialState as () => S)()
    : actor.definition.initialState;
  actor.currentState = initialState;
  actor.currentHandler = actor.definition.receive;
  actor.behaviorStack = [actor.definition.receive];
  actor.stash = [];

  // Call postRestart hook
  if (actor.definition.postRestart) {
    const ctx = createActorContext(actor);
    await actor.definition.postRestart(ctx);
  }

  actor.state = 'RUNNING';
}

/**
 * Stop an actor
 */
export async function stopActor<S, M>(
  actor: ActorInternals<S, M>,
  reason: string
): Promise<void> {
  actor.state = 'STOPPING';

  // Cancel scheduled tasks
  for (const task of actor.scheduledTasks) {
    task.cancel();
  }
  actor.scheduledTasks.clear();

  // Stop children
  for (const childRef of actor.children.values()) {
    await actor.system.stop(childRef);
  }

  // Call postStop hook
  if (actor.definition.postStop) {
    const ctx = createActorContext(actor);
    await actor.definition.postStop(ctx);
  }

  // Notify watchers
  for (const watcher of actor.watchedBy) {
    actor.system.send(watcher, {
      kind: 'Terminated',
      actor: actor.ref,
      reason,
    } as SystemMessage);
  }

  actor.state = 'STOPPED';
}

/**
 * Start an actor
 */
export async function startActor<S, M>(
  actor: ActorInternals<S, M>
): Promise<void> {
  actor.state = 'STARTING';

  try {
    // Call preStart hook
    if (actor.definition.preStart) {
      const ctx = createActorContext(actor);
      await actor.definition.preStart(ctx);
    }

    actor.state = 'RUNNING';

    // Process any queued messages
    while (actor.mailbox.length > 0 && actor.state === 'RUNNING') {
      const envelope = actor.mailbox.shift()!;
      await processMessage(actor, envelope);
    }
  } catch (error) {
    actor.state = 'FAILED';
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateActorRef(): ActorRef {
  return `actor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as ActorRef;
}

function createEnvelope<M>(
  message: M,
  sender: ActorRef | undefined,
  recipient: ActorRef
): Envelope<M> {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sender,
    recipient,
    message,
    timestamp: new Date(),
    metadata: {},
  };
}

function isBehavior<S, M>(value: unknown): value is Behavior<S, M> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value
  );
}

function createLogger(path: ActorPath): Logger {
  const prefix = `[${path}]`;
  return {
    trace: (msg, ...args) => console.log(`${prefix} TRACE: ${msg}`, ...args),
    debug: (msg, ...args) => console.log(`${prefix} DEBUG: ${msg}`, ...args),
    info: (msg, ...args) => console.log(`${prefix} INFO: ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`${prefix} WARN: ${msg}`, ...args),
    error: (msg, err, ...args) => console.error(`${prefix} ERROR: ${msg}`, err, ...args),
  };
}
