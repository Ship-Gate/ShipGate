// ============================================================================
// ISL Actor System - Public API
// Distributed computing with actors, message passing, and supervision
// ============================================================================

// Types
export type {
  ActorRef,
  ActorPath,
  ActorAddress,
  ActorState,
  Envelope,
  ActorDef,
  MessageHandler,
  Behavior,
  ActorContext,
  Cancellable,
  SupervisionStrategy,
  OneForOneStrategy,
  OneForAllStrategy,
  RestForOneStrategy,
  SupervisionDirective,
  SystemMessage,
  ActorSystemConfig,
  RemotingConfig,
  Logger,
  LogLevel,
  ActorSystem,
  EventStream,
  Subscription,
  Scheduler,
  RouterStrategy,
  RouterConfig,
  PersistentEvent,
  Snapshot,
  PersistentActorDef,
  ClusterMember,
  MemberStatus,
  ClusterConfig,
} from './types.js';

// Actor
export {
  createActor,
  createActorContext,
  processMessage,
  startActor,
  stopActor,
} from './actor.js';

// System
export { createActorSystem } from './system.js';

// ============================================================================
// Convenience Functions
// ============================================================================

import type { ActorDef, ActorSystem, SupervisionStrategy, SupervisionDirective } from './types.js';
import { createActorSystem } from './system.js';

/**
 * Create a simple actor definition
 */
export function defineActor<S, M>(
  name: string,
  initialState: S,
  receive: ActorDef<S, M>['receive'],
  options?: {
    preStart?: ActorDef<S, M>['preStart'];
    postStop?: ActorDef<S, M>['postStop'];
    supervisionStrategy?: SupervisionStrategy;
  }
): ActorDef<S, M> {
  return {
    name,
    initialState,
    receive,
    ...options,
  };
}

/**
 * Create one-for-one supervision strategy
 */
export function oneForOne(
  maxRestarts: number,
  withinDuration: number,
  decider?: (error: Error) => SupervisionDirective
): SupervisionStrategy {
  return {
    kind: 'OneForOne',
    maxRestarts,
    withinDuration,
    decider: decider ?? defaultDecider,
  };
}

/**
 * Create one-for-all supervision strategy
 */
export function oneForAll(
  maxRestarts: number,
  withinDuration: number,
  decider?: (error: Error) => SupervisionDirective
): SupervisionStrategy {
  return {
    kind: 'OneForAll',
    maxRestarts,
    withinDuration,
    decider: decider ?? defaultDecider,
  };
}

/**
 * Create rest-for-one supervision strategy
 */
export function restForOne(
  maxRestarts: number,
  withinDuration: number,
  decider?: (error: Error) => SupervisionDirective
): SupervisionStrategy {
  return {
    kind: 'RestForOne',
    maxRestarts,
    withinDuration,
    decider: decider ?? defaultDecider,
  };
}

/**
 * Default supervision decider
 */
function defaultDecider(error: Error): SupervisionDirective {
  // By default, restart on error
  return 'RESTART';
}

/**
 * Create and start an actor system
 */
export function startSystem(name: string): ActorSystem {
  return createActorSystem({ name });
}

/**
 * Pattern matching helper for messages
 */
export function match<M, R>(
  message: M,
  handlers: { [K in string]?: (msg: Extract<M, { kind: K }>) => R }
): R | undefined {
  const msg = message as { kind?: string };
  if (msg.kind && handlers[msg.kind]) {
    return handlers[msg.kind]!(message as Extract<M, { kind: typeof msg.kind }>);
  }
  return undefined;
}

/**
 * Create a typed message
 */
export function msg<K extends string, D extends Record<string, unknown>>(
  kind: K,
  data?: D
): { kind: K } & D {
  return { kind, ...data } as { kind: K } & D;
}
