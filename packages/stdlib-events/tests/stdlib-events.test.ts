import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Types & helpers
  ok,
  err,
  ActorType,
  EventErrorCode,
  EventError,
  concurrencyConflict,
  streamNotFound,

  // Emitter
  EventEmitter,

  // Bus
  createEventBus,

  // Middleware
  composeMiddleware,

  // Store
  InMemoryEventStore,

  // Aggregate
  createAggregate,

  // Projection
  createProjection,

  // Snapshot
  createSnapshot,
  shouldSnapshot,

  // Replay
  replayAggregate,
  replayProjection,
  collectEvents,
} from '../src/index.js';

import type {
  EventEnvelope,
  EventMap,
  Middleware,
  MiddlewareContext,
  Handler,
  EventBus,
  Snapshot,
} from '../src/index.js';

// ============================================================================
// Test event map used throughout
// ============================================================================

interface TestEvents extends EventMap {
  UserCreated: { name: string; email: string };
  UserDeleted: { userId: string };
  OrderPlaced: { orderId: string; amount: number };
  OrderCancelled: { orderId: string };
}

// ============================================================================
// Result type
// ============================================================================

describe('Result helpers', () => {
  it('ok() wraps a value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err() wraps an error', () => {
    const r = err('boom');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('boom');
  });
});

// ============================================================================
// EventEmitter
// ============================================================================

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new EventEmitter<TestEvents>();
  });

  it('calls sync handler on emit', async () => {
    const received: string[] = [];
    emitter.on('UserCreated', (data) => {
      received.push(data.name);
    });
    await emitter.emit('UserCreated', { name: 'Alice', email: 'a@b.c' });
    expect(received).toEqual(['Alice']);
  });

  it('calls async handler on emit', async () => {
    const received: string[] = [];
    emitter.on('UserCreated', async (data) => {
      await new Promise((r) => setTimeout(r, 5));
      received.push(data.name);
    });
    await emitter.emit('UserCreated', { name: 'Bob', email: 'b@c.d' });
    expect(received).toEqual(['Bob']);
  });

  it('unsubscribe via returned function', async () => {
    const received: string[] = [];
    const unsub = emitter.on('UserCreated', (data) => {
      received.push(data.name);
    });
    await emitter.emit('UserCreated', { name: 'A', email: '' });
    unsub();
    await emitter.emit('UserCreated', { name: 'B', email: '' });
    expect(received).toEqual(['A']);
  });

  it('unsubscribe via off()', async () => {
    const received: string[] = [];
    const handler: Handler<TestEvents['UserCreated']> = (data) => {
      received.push(data.name);
    };
    emitter.on('UserCreated', handler);
    await emitter.emit('UserCreated', { name: 'A', email: '' });
    emitter.off('UserCreated', handler);
    await emitter.emit('UserCreated', { name: 'B', email: '' });
    expect(received).toEqual(['A']);
  });

  it('async handlers execute in registration order', async () => {
    const order: number[] = [];

    emitter.on('UserCreated', async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    emitter.on('UserCreated', async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push(2);
    });
    emitter.on('UserCreated', () => {
      order.push(3);
    });

    await emitter.emit('UserCreated', { name: '', email: '' });
    expect(order).toEqual([1, 2, 3]);
  });

  it('listenerCount returns correct count', () => {
    expect(emitter.listenerCount('UserCreated')).toBe(0);
    const unsub = emitter.on('UserCreated', () => {});
    expect(emitter.listenerCount('UserCreated')).toBe(1);
    unsub();
    expect(emitter.listenerCount('UserCreated')).toBe(0);
  });

  it('removeAllListeners clears specific type', () => {
    emitter.on('UserCreated', () => {});
    emitter.on('UserDeleted', () => {});
    emitter.removeAllListeners('UserCreated');
    expect(emitter.listenerCount('UserCreated')).toBe(0);
    expect(emitter.listenerCount('UserDeleted')).toBe(1);
  });

  it('removeAllListeners with no arg clears all', () => {
    emitter.on('UserCreated', () => {});
    emitter.on('UserDeleted', () => {});
    emitter.removeAllListeners();
    expect(emitter.listenerCount('UserCreated')).toBe(0);
    expect(emitter.listenerCount('UserDeleted')).toBe(0);
  });
});

// ============================================================================
// EventBus (typed bus with middleware)
// ============================================================================

describe('createEventBus', () => {
  let bus: EventBus<TestEvents>;

  beforeEach(() => {
    bus = createEventBus<TestEvents>();
  });

  it('on/emit delivers typed payload', async () => {
    const received: TestEvents['UserCreated'][] = [];
    bus.on('UserCreated', (data) => received.push(data));
    await bus.emit('UserCreated', { name: 'Alice', email: 'a@b.c' });
    expect(received).toEqual([{ name: 'Alice', email: 'a@b.c' }]);
  });

  it('off removes handler', async () => {
    const received: string[] = [];
    const handler: Handler<TestEvents['UserCreated']> = (d) => {
      received.push(d.name);
    };
    bus.on('UserCreated', handler);
    await bus.emit('UserCreated', { name: 'A', email: '' });
    bus.off('UserCreated', handler);
    await bus.emit('UserCreated', { name: 'B', email: '' });
    expect(received).toEqual(['A']);
  });

  it('middleware intercepts emit', async () => {
    const log: string[] = [];

    const mw: Middleware<TestEvents> = async (ctx, next) => {
      log.push(`before:${ctx.type}`);
      await next();
      log.push(`after:${ctx.type}`);
    };

    bus.use(mw);
    bus.on('UserCreated', () => log.push('handler'));
    await bus.emit('UserCreated', { name: '', email: '' });

    expect(log).toEqual(['before:UserCreated', 'handler', 'after:UserCreated']);
  });

  it('multiple middleware chain correctly', async () => {
    const log: string[] = [];

    bus.use(async (_ctx, next) => {
      log.push('mw1-before');
      await next();
      log.push('mw1-after');
    });
    bus.use(async (_ctx, next) => {
      log.push('mw2-before');
      await next();
      log.push('mw2-after');
    });

    bus.on('UserCreated', () => log.push('handler'));
    await bus.emit('UserCreated', { name: '', email: '' });

    expect(log).toEqual([
      'mw1-before',
      'mw2-before',
      'handler',
      'mw2-after',
      'mw1-after',
    ]);
  });

  it('middleware can add metadata', async () => {
    let capturedMeta: Record<string, unknown> = {};

    bus.use(async (ctx, next) => {
      ctx.metadata['traced'] = true;
      await next();
    });

    bus.use(async (ctx, next) => {
      capturedMeta = { ...ctx.metadata };
      await next();
    });

    await bus.emit('UserCreated', { name: '', email: '' });
    expect(capturedMeta).toEqual({ traced: true });
  });

  it('listenerCount works through bus', () => {
    expect(bus.listenerCount('UserCreated')).toBe(0);
    const unsub = bus.on('UserCreated', () => {});
    expect(bus.listenerCount('UserCreated')).toBe(1);
    unsub();
    expect(bus.listenerCount('UserCreated')).toBe(0);
  });
});

// ============================================================================
// Typed bus compile-time examples (structural — these just need to compile)
// ============================================================================

describe('typed bus compile-time checks', () => {
  it('type-checks event payloads', async () => {
    const bus = createEventBus<TestEvents>();

    // These should compile:
    bus.on('UserCreated', (data) => {
      const _name: string = data.name;
      const _email: string = data.email;
      void _name;
      void _email;
    });

    bus.on('OrderPlaced', (data) => {
      const _orderId: string = data.orderId;
      const _amount: number = data.amount;
      void _orderId;
      void _amount;
    });

    await bus.emit('UserCreated', { name: 'test', email: 'test@test.com' });
    await bus.emit('OrderPlaced', { orderId: 'o1', amount: 100 });
  });
});

// ============================================================================
// InMemoryEventStore
// ============================================================================

describe('InMemoryEventStore', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = new InMemoryEventStore();
  });

  describe('append', () => {
    it('appends events and returns new version', () => {
      const result = store.append('stream-1', [
        { type: 'Created', data: { id: '1' } },
        { type: 'Updated', data: { name: 'new' } },
      ]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.newVersion).toBe(2);
        expect(result.value.positions).toHaveLength(2);
        expect(result.value.streamId).toBe('stream-1');
      }
    });

    it('rejects empty events array', () => {
      const result = store.append('stream-1', []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(EventErrorCode.INVALID_EVENT);
      }
    });

    it('optimistic concurrency — success when version matches', () => {
      store.append('s1', [{ type: 'A', data: {} }]);
      const result = store.append('s1', [{ type: 'B', data: {} }], 1);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.newVersion).toBe(2);
    });

    it('optimistic concurrency — conflict when version mismatches', () => {
      store.append('s1', [{ type: 'A', data: {} }]);
      const result = store.append('s1', [{ type: 'B', data: {} }], 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(EventErrorCode.CONCURRENCY_CONFLICT);
        expect(result.error.details?.expected).toBe(0);
        expect(result.error.details?.actual).toBe(1);
      }
    });

    it('expectedVersion 0 on new stream succeeds', () => {
      const result = store.append('new-stream', [{ type: 'Init', data: {} }], 0);
      expect(result.ok).toBe(true);
    });

    it('assigns monotonically increasing global positions', () => {
      const r1 = store.append('s1', [{ type: 'A', data: {} }]);
      const r2 = store.append('s2', [{ type: 'B', data: {} }]);
      expect(r1.ok && r2.ok).toBe(true);
      if (r1.ok && r2.ok) {
        expect(r2.value.positions[0]!).toBeGreaterThan(r1.value.positions[0]!);
      }
    });
  });

  describe('read (AsyncIterable)', () => {
    it('reads events from a stream', async () => {
      store.append('s1', [
        { type: 'A', data: { v: 1 } },
        { type: 'B', data: { v: 2 } },
        { type: 'C', data: { v: 3 } },
      ]);

      const events = await collectEvents(store.read('s1'));
      expect(events).toHaveLength(3);
      expect(events[0]!.type).toBe('A');
      expect(events[2]!.type).toBe('C');
    });

    it('reads from a specific version', async () => {
      store.append('s1', [
        { type: 'A', data: {} },
        { type: 'B', data: {} },
        { type: 'C', data: {} },
      ]);

      const events = await collectEvents(store.read('s1', 2));
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('C');
    });

    it('returns empty iterable for non-existent stream', async () => {
      const events = await collectEvents(store.read('nonexistent'));
      expect(events).toHaveLength(0);
    });
  });

  describe('readAll (AsyncIterable)', () => {
    it('reads all events across streams', async () => {
      store.append('s1', [{ type: 'A', data: {} }]);
      store.append('s2', [{ type: 'B', data: {} }]);
      store.append('s1', [{ type: 'C', data: {} }]);

      const events = await collectEvents(store.readAll());
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.type)).toEqual(['A', 'B', 'C']);
    });

    it('reads from a specific global position', async () => {
      store.append('s1', [{ type: 'A', data: {} }]);
      store.append('s2', [{ type: 'B', data: {} }]);

      const events = await collectEvents(store.readAll(1));
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('B');
    });
  });

  describe('snapshots', () => {
    it('save and retrieve snapshot', () => {
      const snap: Snapshot<{ balance: number }> = {
        streamId: 's1',
        version: 5,
        state: { balance: 100 },
        timestamp: new Date(),
      };
      store.saveSnapshot(snap);
      const retrieved = store.getSnapshot<{ balance: number }>('s1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.version).toBe(5);
      expect(retrieved!.state.balance).toBe(100);
    });

    it('returns undefined for missing snapshot', () => {
      expect(store.getSnapshot('nope')).toBeUndefined();
    });
  });

  describe('helpers', () => {
    it('streamVersion returns 0 for unknown stream', () => {
      expect(store.streamVersion('unknown')).toBe(0);
    });

    it('clear resets everything', () => {
      store.append('s1', [{ type: 'A', data: {} }]);
      store.clear();
      expect(store.globalPosition).toBe(0);
      expect(store.streamVersion('s1')).toBe(0);
    });
  });
});

// ============================================================================
// Aggregate
// ============================================================================

describe('createAggregate', () => {
  interface AccountState {
    balance: number;
    transactions: number;
  }

  function makeEnvelope(
    type: string,
    data: unknown,
    version: number,
    streamId = 'account-1',
  ): EventEnvelope {
    return {
      eventId: crypto.randomUUID(),
      streamId,
      version,
      position: version,
      type,
      timestamp: new Date(),
      data,
    };
  }

  it('applies events and updates state', () => {
    const agg = createAggregate<AccountState>({
      streamId: 'account-1',
      initialState: { balance: 0, transactions: 0 },
      apply: (state, event) => {
        if (event.type === 'Deposited') {
          const d = event.data as { amount: number };
          return {
            balance: state.balance + d.amount,
            transactions: state.transactions + 1,
          };
        }
        if (event.type === 'Withdrawn') {
          const d = event.data as { amount: number };
          return {
            balance: state.balance - d.amount,
            transactions: state.transactions + 1,
          };
        }
        return state;
      },
    });

    agg.apply(makeEnvelope('Deposited', { amount: 100 }, 1));
    agg.apply(makeEnvelope('Withdrawn', { amount: 30 }, 2));

    expect(agg.state.balance).toBe(70);
    expect(agg.state.transactions).toBe(2);
    expect(agg.version).toBe(2);
    expect(agg.uncommittedEvents).toHaveLength(2);
  });

  it('rehydrate from events', () => {
    const agg = createAggregate<AccountState>({
      streamId: 'account-1',
      initialState: { balance: 0, transactions: 0 },
      apply: (state, event) => {
        if (event.type === 'Deposited') {
          const d = event.data as { amount: number };
          return {
            balance: state.balance + d.amount,
            transactions: state.transactions + 1,
          };
        }
        return state;
      },
    });

    const events = [
      makeEnvelope('Deposited', { amount: 50 }, 1),
      makeEnvelope('Deposited', { amount: 25 }, 2),
    ];

    agg.rehydrate(events);
    expect(agg.state.balance).toBe(75);
    expect(agg.version).toBe(2);
    expect(agg.uncommittedEvents).toHaveLength(0);
  });

  it('rehydrate from snapshot + events', () => {
    const agg = createAggregate<AccountState>({
      streamId: 'account-1',
      initialState: { balance: 0, transactions: 0 },
      apply: (state, event) => {
        if (event.type === 'Deposited') {
          const d = event.data as { amount: number };
          return {
            balance: state.balance + d.amount,
            transactions: state.transactions + 1,
          };
        }
        return state;
      },
    });

    const snapshot: Snapshot<AccountState> = {
      streamId: 'account-1',
      version: 10,
      state: { balance: 500, transactions: 10 },
      timestamp: new Date(),
    };

    const newEvents = [
      makeEnvelope('Deposited', { amount: 100 }, 11),
    ];

    agg.rehydrate(newEvents, snapshot);
    expect(agg.state.balance).toBe(600);
    expect(agg.version).toBe(11);
  });

  it('toSnapshot captures current state', () => {
    const agg = createAggregate<AccountState>({
      streamId: 'account-1',
      initialState: { balance: 0, transactions: 0 },
      apply: (state, event) => {
        if (event.type === 'Deposited') {
          const d = event.data as { amount: number };
          return { balance: state.balance + d.amount, transactions: state.transactions + 1 };
        }
        return state;
      },
    });

    agg.apply(makeEnvelope('Deposited', { amount: 200 }, 1));
    const snap = agg.toSnapshot();
    expect(snap.streamId).toBe('account-1');
    expect(snap.version).toBe(1);
    expect(snap.state.balance).toBe(200);
  });

  it('clearUncommitted resets pending events', () => {
    const agg = createAggregate<AccountState>({
      streamId: 'account-1',
      initialState: { balance: 0, transactions: 0 },
      apply: (s) => s,
    });

    agg.apply(makeEnvelope('X', {}, 1));
    expect(agg.uncommittedEvents).toHaveLength(1);
    agg.clearUncommitted();
    expect(agg.uncommittedEvents).toHaveLength(0);
  });
});

// ============================================================================
// Projection
// ============================================================================

describe('createProjection', () => {
  interface OrderStats {
    total: number;
    cancelled: number;
  }

  function makeEnvelope(
    type: string,
    data: unknown,
    position: number,
  ): EventEnvelope {
    return {
      eventId: crypto.randomUUID(),
      streamId: 'orders',
      version: position,
      position,
      type,
      timestamp: new Date(),
      data,
    };
  }

  it('folds events into state via builder', async () => {
    const proj = createProjection<OrderStats>('order-stats', { total: 0, cancelled: 0 })
      .on('OrderPlaced', (s) => ({ ...s, total: s.total + 1 }))
      .on('OrderCancelled', (s) => ({ ...s, cancelled: s.cancelled + 1 }))
      .build();

    await proj.process(makeEnvelope('OrderPlaced', {}, 1));
    await proj.process(makeEnvelope('OrderPlaced', {}, 2));
    await proj.process(makeEnvelope('OrderCancelled', {}, 3));

    expect(proj.state.total).toBe(2);
    expect(proj.state.cancelled).toBe(1);
    expect(proj.position).toBe(3);
  });

  it('skips unhandled event types', async () => {
    const proj = createProjection<{ count: number }>('counter', { count: 0 })
      .on('OrderPlaced', (s) => ({ count: s.count + 1 }))
      .build();

    await proj.process(makeEnvelope('OrderPlaced', {}, 1));
    await proj.process(makeEnvelope('SomethingElse', {}, 2));

    expect(proj.state.count).toBe(1);
    expect(proj.position).toBe(2);
  });

  it('reset restores initial state', async () => {
    const proj = createProjection<{ count: number }>('counter', { count: 0 })
      .on('OrderPlaced', (s) => ({ count: s.count + 1 }))
      .build();

    await proj.process(makeEnvelope('OrderPlaced', {}, 1));
    expect(proj.state.count).toBe(1);

    proj.reset();
    expect(proj.state.count).toBe(0);
    expect(proj.position).toBe(0);
  });

  it('supports async handlers', async () => {
    const proj = createProjection<{ count: number }>('async-counter', { count: 0 })
      .on('OrderPlaced', async (s) => {
        await new Promise((r) => setTimeout(r, 5));
        return { count: s.count + 1 };
      })
      .build();

    await proj.process(makeEnvelope('OrderPlaced', {}, 1));
    expect(proj.state.count).toBe(1);
  });
});

// ============================================================================
// Snapshot helpers
// ============================================================================

describe('snapshot helpers', () => {
  it('createSnapshot creates a valid snapshot', () => {
    const snap = createSnapshot('s1', 5, { balance: 100 });
    expect(snap.streamId).toBe('s1');
    expect(snap.version).toBe(5);
    expect(snap.state).toEqual({ balance: 100 });
    expect(snap.timestamp).toBeInstanceOf(Date);
  });

  it('shouldSnapshot returns true when interval exceeded', () => {
    expect(shouldSnapshot(100, 0, 100)).toBe(true);
    expect(shouldSnapshot(150, 50, 100)).toBe(true);
  });

  it('shouldSnapshot returns false when below interval', () => {
    expect(shouldSnapshot(50, 0, 100)).toBe(false);
    expect(shouldSnapshot(99, 0, 100)).toBe(false);
  });
});

// ============================================================================
// Replay
// ============================================================================

describe('replay', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = new InMemoryEventStore();
  });

  it('replayAggregate replays events from store', async () => {
    store.append('account-1', [
      { type: 'Deposited', data: { amount: 100 } },
      { type: 'Deposited', data: { amount: 50 } },
      { type: 'Withdrawn', data: { amount: 30 } },
    ]);

    const agg = createAggregate<{ balance: number }>({
      streamId: 'account-1',
      initialState: { balance: 0 },
      apply: (state, event) => {
        const d = event.data as { amount: number };
        if (event.type === 'Deposited') return { balance: state.balance + d.amount };
        if (event.type === 'Withdrawn') return { balance: state.balance - d.amount };
        return state;
      },
    });

    await replayAggregate(store, agg);
    expect(agg.state.balance).toBe(120);
    expect(agg.version).toBe(3);
  });

  it('replayAggregate from snapshot', async () => {
    store.append('account-1', [
      { type: 'Deposited', data: { amount: 100 } },
      { type: 'Deposited', data: { amount: 50 } },
      { type: 'Deposited', data: { amount: 25 } },
    ]);

    const snapshot: Snapshot<{ balance: number }> = {
      streamId: 'account-1',
      version: 2,
      state: { balance: 150 },
      timestamp: new Date(),
    };

    const agg = createAggregate<{ balance: number }>({
      streamId: 'account-1',
      initialState: { balance: 0 },
      apply: (state, event) => {
        const d = event.data as { amount: number };
        if (event.type === 'Deposited') return { balance: state.balance + d.amount };
        return state;
      },
    });

    await replayAggregate(store, agg, snapshot);
    // Snapshot has balance 150 at version 2, then event 3 adds 25
    expect(agg.state.balance).toBe(175);
    expect(agg.version).toBe(3);
  });

  it('replayProjection replays all events into projection', async () => {
    store.append('orders-1', [{ type: 'OrderPlaced', data: {} }]);
    store.append('orders-2', [{ type: 'OrderPlaced', data: {} }]);
    store.append('orders-1', [{ type: 'OrderCancelled', data: {} }]);

    const proj = createProjection<{ placed: number; cancelled: number }>(
      'order-stats',
      { placed: 0, cancelled: 0 },
    )
      .on('OrderPlaced', (s) => ({ ...s, placed: s.placed + 1 }))
      .on('OrderCancelled', (s) => ({ ...s, cancelled: s.cancelled + 1 }))
      .build();

    await replayProjection(store, proj);
    expect(proj.state.placed).toBe(2);
    expect(proj.state.cancelled).toBe(1);
  });

  it('collectEvents gathers all from AsyncIterable', async () => {
    store.append('s1', [
      { type: 'A', data: {} },
      { type: 'B', data: {} },
    ]);

    const events = await collectEvents(store.readAll());
    expect(events).toHaveLength(2);
  });
});

// ============================================================================
// Error helpers
// ============================================================================

describe('error helpers', () => {
  it('concurrencyConflict creates proper error', () => {
    const e = concurrencyConflict('s1', 5, 3);
    expect(e).toBeInstanceOf(EventError);
    expect(e.code).toBe(EventErrorCode.CONCURRENCY_CONFLICT);
    expect(e.details?.expected).toBe(5);
    expect(e.details?.actual).toBe(3);
  });

  it('streamNotFound creates proper error', () => {
    const e = streamNotFound('s1');
    expect(e).toBeInstanceOf(EventError);
    expect(e.code).toBe(EventErrorCode.STREAM_NOT_FOUND);
    expect(e.details?.streamId).toBe('s1');
  });
});

// ============================================================================
// Middleware (standalone compose)
// ============================================================================

describe('composeMiddleware', () => {
  it('chains middleware in order', async () => {
    const log: string[] = [];

    type E = { ping: string };

    const mw1: Middleware<E> = async (_ctx, next) => {
      log.push('mw1-in');
      await next();
      log.push('mw1-out');
    };
    const mw2: Middleware<E> = async (_ctx, next) => {
      log.push('mw2-in');
      await next();
      log.push('mw2-out');
    };

    const dispatch = async () => {
      log.push('dispatch');
    };

    const composed = composeMiddleware([mw1, mw2], dispatch);
    await composed({
      type: 'ping',
      data: 'hello',
      timestamp: new Date(),
      metadata: {},
    });

    expect(log).toEqual(['mw1-in', 'mw2-in', 'dispatch', 'mw2-out', 'mw1-out']);
  });

  it('rejects double next() call', async () => {
    type E = { ping: string };

    const badMw: Middleware<E> = async (_ctx, next) => {
      await next();
      await next(); // should throw
    };

    const composed = composeMiddleware([badMw], async () => {});
    await expect(
      composed({ type: 'ping', data: '', timestamp: new Date(), metadata: {} }),
    ).rejects.toThrow('next() called multiple times');
  });
});
