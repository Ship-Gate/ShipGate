// ============================================================================
// ISL Actor System - Actor System Implementation
// ============================================================================

import type {
  ActorRef,
  ActorPath,
  ActorDef,
  ActorSystem,
  ActorSystemConfig,
  Envelope,
  EventStream,
  Subscription,
  Scheduler,
  Cancellable,
} from './types.js';
import {
  createActor,
  startActor,
  stopActor,
  processMessage,
  createActorContext,
} from './actor.js';

/**
 * Actor system implementation
 */
class ActorSystemImpl implements ActorSystem {
  name: string;
  root: ActorRef;
  deadLetters: ActorRef;
  eventStream: EventStream;
  scheduler: Scheduler;
  
  private actors: Map<ActorRef, ReturnType<typeof createActor>>;
  private pathToRef: Map<ActorPath, ActorRef>;
  private config: ActorSystemConfig;
  private shutdownPromise: Promise<void>;
  private shutdownResolve!: () => void;
  private isShuttingDown: boolean = false;

  constructor(config: ActorSystemConfig) {
    this.config = config;
    this.name = config.name;
    this.actors = new Map();
    this.pathToRef = new Map();
    this.eventStream = createEventStream();
    this.scheduler = createScheduler();

    // Create shutdown promise
    this.shutdownPromise = new Promise(resolve => {
      this.shutdownResolve = resolve;
    });

    // Create root actor
    this.root = this.spawn({
      name: 'root',
      initialState: {},
      receive: (state, msg, ctx) => {
        // Root actor forwards system messages
        return state;
      },
    }, '/' as ActorPath);

    // Create dead letters actor
    this.deadLetters = this.spawn({
      name: 'deadLetters',
      initialState: { count: 0 },
      receive: (state, msg, ctx) => {
        ctx.log.warn('Dead letter received:', msg);
        if (config.deadLetterHandler) {
          config.deadLetterHandler(msg as Envelope);
        }
        return { count: state.count + 1 };
      },
    }, '/system/deadLetters' as ActorPath);
  }

  spawn<S, M>(def: ActorDef<S, M>, path?: ActorPath): ActorRef {
    const actorPath = path ?? this.generatePath(def.name);
    const parentRef = this.findParent(actorPath);
    
    const actor = createActor(def, actorPath, parentRef, this);
    this.actors.set(actor.ref, actor as ReturnType<typeof createActor>);
    this.pathToRef.set(actorPath, actor.ref);

    // Register as child of parent
    if (parentRef) {
      const parent = this.actors.get(parentRef);
      if (parent) {
        const childName = actorPath.split('/').pop() ?? '';
        parent.children.set(childName, actor.ref);
      }
    }

    // Start the actor
    startActor(actor).catch(err => {
      console.error(`Failed to start actor ${actorPath}:`, err);
    });

    return actor.ref;
  }

  async stop(ref: ActorRef): Promise<void> {
    const actor = this.actors.get(ref);
    if (!actor) return;

    await stopActor(actor, 'Stopped');
    
    // Remove from parent's children
    if (actor.parent) {
      const parent = this.actors.get(actor.parent);
      if (parent) {
        for (const [name, childRef] of parent.children) {
          if (childRef === ref) {
            parent.children.delete(name);
            break;
          }
        }
      }
    }

    this.actors.delete(ref);
    this.pathToRef.delete(actor.path);
  }

  lookup(path: ActorPath): ActorRef | undefined {
    return this.pathToRef.get(path);
  }

  send<M>(ref: ActorRef, message: M): void {
    const actor = this.actors.get(ref);
    if (!actor) {
      // Send to dead letters
      this.send(this.deadLetters, {
        id: `dl-${Date.now()}`,
        sender: undefined,
        recipient: ref,
        message,
        timestamp: new Date(),
        metadata: { reason: 'ActorNotFound' },
      });
      return;
    }

    const envelope: Envelope<M> = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sender: undefined,
      recipient: ref,
      message,
      timestamp: new Date(),
      metadata: {},
    };

    processMessage(actor, envelope as Envelope<unknown>).catch(err => {
      console.error(`Error processing message for ${actor.path}:`, err);
    });
  }

  async ask<M, R>(ref: ActorRef, message: M, timeout?: number): Promise<R> {
    const timeoutMs = timeout ?? this.config.defaultTimeout ?? 5000;

    return new Promise<R>((resolve, reject) => {
      // Create temporary actor for response
      const replyTo = this.spawn<{ resolved: boolean }, unknown>({
        name: `ask-${Date.now()}`,
        initialState: { resolved: false },
        receive: (state, msg, ctx) => {
          if (!state.resolved) {
            resolve(msg as R);
            ctx.stop();
            return { resolved: true };
          }
          return state;
        },
      });

      // Set timeout
      const timer = setTimeout(() => {
        const actor = this.actors.get(replyTo);
        if (actor && !(actor.currentState as { resolved: boolean }).resolved) {
          this.stop(replyTo);
          reject(new Error('Ask timeout'));
        }
      }, timeoutMs);

      // Send message with reply-to
      const actor = this.actors.get(ref);
      if (!actor) {
        clearTimeout(timer);
        this.stop(replyTo);
        reject(new Error('Actor not found'));
        return;
      }

      const envelope: Envelope<M> = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sender: replyTo,
        recipient: ref,
        message,
        timestamp: new Date(),
        metadata: {},
      };

      processMessage(actor, envelope as Envelope<unknown>).catch(err => {
        clearTimeout(timer);
        this.stop(replyTo);
        reject(err);
      });
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return this.shutdownPromise;
    this.isShuttingDown = true;

    // Stop all actors (except root and system actors)
    const actorsToStop = Array.from(this.actors.values())
      .filter(a => !a.path.startsWith('/system') && a.path !== '/')
      .map(a => a.ref);

    for (const ref of actorsToStop) {
      await this.stop(ref);
    }

    // Stop system actors
    await this.stop(this.deadLetters);
    await this.stop(this.root);

    this.shutdownResolve();
    return this.shutdownPromise;
  }

  get whenTerminated(): Promise<void> {
    return this.shutdownPromise;
  }

  private generatePath(name: string): ActorPath {
    return `/user/${name}-${Date.now()}` as ActorPath;
  }

  private findParent(path: ActorPath): ActorRef | undefined {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return this.root;
    
    const parentPath = '/' + parts.slice(0, -1).join('/') as ActorPath;
    return this.pathToRef.get(parentPath);
  }
}

/**
 * Create an actor system
 */
export function createActorSystem(config: ActorSystemConfig): ActorSystem {
  return new ActorSystemImpl(config);
}

/**
 * Create event stream
 */
function createEventStream(): EventStream {
  const subscribers = new Map<string, Set<(event: unknown) => void>>();

  return {
    subscribe<E>(eventType: string, handler: (event: E) => void): Subscription {
      if (!subscribers.has(eventType)) {
        subscribers.set(eventType, new Set());
      }
      subscribers.get(eventType)!.add(handler as (event: unknown) => void);

      return {
        unsubscribe() {
          subscribers.get(eventType)?.delete(handler as (event: unknown) => void);
        },
      };
    },

    publish<E>(eventType: string, event: E): void {
      const handlers = subscribers.get(eventType);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(event);
          } catch (err) {
            console.error(`Error in event handler for ${eventType}:`, err);
          }
        }
      }
    },
  };
}

/**
 * Create scheduler
 */
function createScheduler(): Scheduler {
  return {
    scheduleOnce(delay: number, task: () => void): Cancellable {
      let cancelled = false;
      const timer = setTimeout(() => {
        if (!cancelled) task();
      }, delay);

      return {
        cancel() {
          cancelled = true;
          clearTimeout(timer);
        },
        get isCancelled() {
          return cancelled;
        },
      };
    },

    scheduleRepeatedly(
      initialDelay: number,
      interval: number,
      task: () => void
    ): Cancellable {
      let cancelled = false;
      let timer: NodeJS.Timeout;

      const run = () => {
        if (!cancelled) {
          task();
          timer = setTimeout(run, interval);
        }
      };

      timer = setTimeout(run, initialDelay);

      return {
        cancel() {
          cancelled = true;
          clearTimeout(timer);
        },
        get isCancelled() {
          return cancelled;
        },
      };
    },
  };
}
