// ============================================================================
// ISL Actor System Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  defineActor,
  oneForOne,
  oneForAll,
  restForOne,
  startSystem,
  match,
  msg,
  createActorSystem,
} from './index.js';

describe('defineActor', () => {
  it('should create an actor definition with minimal args', () => {
    const def = defineActor('counter', 0, (state, message: { kind: 'increment' }) => state + 1);

    expect(def.name).toBe('counter');
    expect(def.initialState).toBe(0);
    expect(def.receive).toBeDefined();
  });

  it('should create an actor definition with options', () => {
    const preStart = () => {};
    const postStop = () => {};
    const strategy = oneForOne(3, 5000);

    const def = defineActor('test', { count: 0 }, (state) => state, {
      preStart,
      postStop,
      supervisionStrategy: strategy,
    });

    expect(def.preStart).toBe(preStart);
    expect(def.postStop).toBe(postStop);
    expect(def.supervisionStrategy).toBe(strategy);
  });
});

describe('supervision strategies', () => {
  it('should create oneForOne strategy', () => {
    const strategy = oneForOne(3, 5000);

    expect(strategy.kind).toBe('OneForOne');
    expect(strategy.maxRestarts).toBe(3);
    expect(strategy.withinDuration).toBe(5000);
    expect(strategy.decider).toBeDefined();
  });

  it('should create oneForAll strategy', () => {
    const strategy = oneForAll(5, 10000);

    expect(strategy.kind).toBe('OneForAll');
    expect(strategy.maxRestarts).toBe(5);
    expect(strategy.withinDuration).toBe(10000);
  });

  it('should create restForOne strategy', () => {
    const strategy = restForOne(2, 3000);

    expect(strategy.kind).toBe('RestForOne');
    expect(strategy.maxRestarts).toBe(2);
    expect(strategy.withinDuration).toBe(3000);
  });

  it('should use custom decider', () => {
    const customDecider = () => 'STOP' as const;
    const strategy = oneForOne(1, 1000, customDecider);

    expect(strategy.decider(new Error('test'))).toBe('STOP');
  });

  it('should use default decider returning RESTART', () => {
    const strategy = oneForOne(1, 1000);

    expect(strategy.decider(new Error('test'))).toBe('RESTART');
  });
});

describe('startSystem', () => {
  it('should create an actor system with given name', () => {
    const system = startSystem('test-system');

    expect(system).toBeDefined();
    expect(system.name).toBe('test-system');
  });
});

describe('createActorSystem', () => {
  it('should create an actor system with config', () => {
    const system = createActorSystem({ name: 'my-system' });

    expect(system).toBeDefined();
    expect(system.name).toBe('my-system');
  });
});

describe('match', () => {
  type Message =
    | { kind: 'increment'; amount: number }
    | { kind: 'decrement'; amount: number }
    | { kind: 'reset' };

  it('should match message kind and return handler result', () => {
    const message: Message = { kind: 'increment', amount: 5 };

    const result = match(message, {
      increment: (m) => m.amount * 2,
      decrement: (m) => -m.amount,
    });

    expect(result).toBe(10);
  });

  it('should return undefined for unmatched kind', () => {
    const message: Message = { kind: 'reset' };

    const result = match(message, {
      increment: () => 1,
      decrement: () => -1,
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined for message without kind', () => {
    const message = { value: 42 };

    const result = match(message, {
      something: () => 'matched',
    });

    expect(result).toBeUndefined();
  });
});

describe('msg', () => {
  it('should create a typed message with kind only', () => {
    const message = msg('ping');

    expect(message).toEqual({ kind: 'ping' });
  });

  it('should create a typed message with data', () => {
    const message = msg('greet', { name: 'Alice', age: 30 });

    expect(message).toEqual({ kind: 'greet', name: 'Alice', age: 30 });
  });
});
