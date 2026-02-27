// ============================================================================
// ISL Standard Library - Actor System
// @isl-lang/stdlib-distributed/actor-system
// ============================================================================

import {
  Actor,
  ActorBehavior,
  ActorRef,
  ActorStatus,
  createActor,
} from './actor.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ActorSystemConfig {
  name: string;
  deadLetterHandler?: (message: unknown, recipient: string) => void;
  defaultSupervision?: 'restart' | 'stop' | 'resume' | 'escalate';
  maxActors?: number;
}

export interface ActorSystemStats {
  name: string;
  totalActors: number;
  activeActors: number;
  stoppedActors: number;
  failedActors: number;
  messagesProcessed: number;
  deadLetters: number;
  uptime: number;
}

// ============================================================================
// ACTOR SYSTEM
// ============================================================================

export class ActorSystem {
  private readonly config: Required<ActorSystemConfig>;
  private readonly actors = new Map<string, Actor<unknown, unknown>>();
  private readonly startTime = Date.now();
  private messagesProcessed = 0;
  private deadLetterCount = 0;
  private isShutdown = false;

  constructor(config: ActorSystemConfig) {
    this.config = {
      name: config.name,
      deadLetterHandler: config.deadLetterHandler ?? this.defaultDeadLetterHandler.bind(this),
      defaultSupervision: config.defaultSupervision ?? 'restart',
      maxActors: config.maxActors ?? 10000,
    };
  }

  /**
   * Get the actor system name.
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Spawn a new root-level actor.
   */
  spawn<M, S = void>(
    behavior: ActorBehavior<M, S>,
    name?: string
  ): ActorRef<M> {
    if (this.isShutdown) {
      throw new Error('Actor system is shut down');
    }

    if (this.actors.size >= this.config.maxActors) {
      throw new Error(`Maximum actor limit (${this.config.maxActors}) reached`);
    }

    const actorName = name ?? crypto.randomUUID();

    if (this.actors.has(actorName)) {
      throw new Error(`Actor with name '${actorName}' already exists`);
    }

    const actor = createActor(behavior, actorName);
    this.actors.set(actorName, actor as unknown as Actor<unknown, unknown>);
    
    actor.start();

    return actor.ref;
  }

  /**
   * Stop an actor by reference.
   */
  async stop<M>(ref: ActorRef<M>): Promise<void> {
    const actor = this.actors.get(ref.id);
    if (actor) {
      await actor.stop();
      this.actors.delete(ref.id);
    }
  }

  /**
   * Get an actor reference by name.
   */
  actorOf<M>(name: string): ActorRef<M> | undefined {
    const actor = this.actors.get(name);
    if (!actor) return undefined;
    return actor.ref as unknown as ActorRef<M>;
  }

  /**
   * Check if an actor exists.
   */
  hasActor(name: string): boolean {
    return this.actors.has(name);
  }

  /**
   * Get actor status by name.
   */
  getActorStatus(name: string): ActorStatus | undefined {
    return this.actors.get(name)?.getStatus();
  }

  /**
   * Send a message to an actor by name (with dead letter handling).
   */
  tell<M>(name: string, message: M): boolean {
    const actor = this.actors.get(name);
    
    if (!actor || actor.getStatus() === 'stopped') {
      this.config.deadLetterHandler(message, name);
      this.deadLetterCount++;
      return false;
    }

    actor.ref.send(message as unknown);
    this.messagesProcessed++;
    return true;
  }

  /**
   * Ask an actor and wait for response.
   */
  async ask<M, R>(name: string, message: M, timeoutMs?: number): Promise<R> {
    const actor = this.actors.get(name);
    
    if (!actor || actor.getStatus() === 'stopped') {
      throw new Error(`Actor '${name}' not found or stopped`);
    }

    const result = await (actor.ref as ActorRef<unknown>).ask<R>(message as unknown, timeoutMs);
    this.messagesProcessed++;
    return result;
  }

  /**
   * Get system statistics.
   */
  getStats(): ActorSystemStats {
    let activeActors = 0;
    let stoppedActors = 0;
    let failedActors = 0;

    for (const actor of this.actors.values()) {
      switch (actor.getStatus()) {
        case 'processing':
        case 'idle':
          activeActors++;
          break;
        case 'stopped':
          stoppedActors++;
          break;
        case 'failed':
          failedActors++;
          break;
      }
    }

    return {
      name: this.config.name,
      totalActors: this.actors.size,
      activeActors,
      stoppedActors,
      failedActors,
      messagesProcessed: this.messagesProcessed,
      deadLetters: this.deadLetterCount,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get all actor names.
   */
  getActorNames(): string[] {
    return Array.from(this.actors.keys());
  }

  /**
   * Shutdown the actor system.
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;

    // Stop all actors
    const stopPromises = Array.from(this.actors.values()).map(actor => actor.stop());
    await Promise.all(stopPromises);

    this.actors.clear();
  }

  /**
   * Check if system is shut down.
   */
  isShuttingDown(): boolean {
    return this.isShutdown;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private defaultDeadLetterHandler(_message: unknown, _recipient: string): void {
    // Default handler does nothing, but could be configured to log
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new actor system.
 */
export function createActorSystem(config: ActorSystemConfig): ActorSystem {
  return new ActorSystem(config);
}

/**
 * Create a simple actor system with just a name.
 */
export function actorSystem(name: string): ActorSystem {
  return new ActorSystem({ name });
}

// ============================================================================
// ROUTER ACTOR PATTERNS
// ============================================================================

export type RouterStrategy =
  | 'round-robin'
  | 'random'
  | 'smallest-mailbox'
  | 'broadcast'
  | 'consistent-hash';

export interface RouterConfig<M> {
  strategy: RouterStrategy;
  routees: Array<ActorRef<M>>;
  hashKey?: (message: M) => string;
}

/**
 * Create a router that distributes messages to a pool of actors.
 */
export function createRouter<M>(config: RouterConfig<M>): ActorRef<M> {
  let roundRobinIndex = 0;

  const selectRoutee = (message: M): ActorRef<M> | null => {
    if (config.routees.length === 0) return null;

    switch (config.strategy) {
      case 'round-robin':
        const selected = config.routees[roundRobinIndex % config.routees.length];
        roundRobinIndex++;
        return selected ?? null;

      case 'random':
        const randomIndex = Math.floor(Math.random() * config.routees.length);
        return config.routees[randomIndex] ?? null;

      case 'consistent-hash':
        if (config.hashKey) {
          const hash = hashCode(config.hashKey(message));
          const index = Math.abs(hash) % config.routees.length;
          return config.routees[index] ?? null;
        }
        return config.routees[0] ?? null;

      default:
        return config.routees[0] ?? null;
    }
  };

  return {
    id: `router-${crypto.randomUUID()}`,
    address: '/router',
    send: (message: M) => {
      if (config.strategy === 'broadcast') {
        for (const routee of config.routees) {
          routee.send(message);
        }
      } else {
        const routee = selectRoutee(message);
        if (routee) {
          routee.send(message);
        }
      }
    },
    ask: async <R>(message: M, timeoutMs?: number): Promise<R> => {
      const routee = selectRoutee(message);
      if (!routee) {
        throw new Error('No routees available');
      }
      return routee.ask<R>(message, timeoutMs);
    },
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// ============================================================================
// ACTOR SELECTION (for addressing actors by path)
// ============================================================================

export interface ActorSelection<M> {
  tell(message: M): void;
  resolveOne(timeoutMs?: number): Promise<ActorRef<M>>;
}

/**
 * Select actors by path pattern.
 */
export function selectActors<M>(
  system: ActorSystem,
  pattern: string
): ActorSelection<M> {
  const resolveMatching = (): ActorRef<M>[] => {
    const names = system.getActorNames();
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    return names
      .filter(name => regex.test(name))
      .map(name => system.actorOf<M>(name))
      .filter((ref): ref is ActorRef<M> => ref !== undefined);
  };

  return {
    tell: (message: M) => {
      for (const ref of resolveMatching()) {
        ref.send(message);
      }
    },
    resolveOne: async (timeoutMs = 5000): Promise<ActorRef<M>> => {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeoutMs) {
        const refs = resolveMatching();
        const first = refs[0];
        if (refs.length > 0 && first) {
          return first;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      throw new Error(`No actor found matching pattern: ${pattern}`);
    },
  };
}
