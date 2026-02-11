/**
 * stdlib-analytics comprehensive tests
 *
 * Covers: batching (size+time with injected clock), transform/filter ordering,
 * dedupe/anonymize correctness, funnel conversion math, histogram percentiles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnalyticsEvent } from '../src/tracker/types';

// ── helpers ───────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2, 10),
    type: 'track',
    name: 'Test_Event',
    userId: 'user_1',
    timestamp: 1000,
    receivedAt: 1000,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. BATCHER — flush by size + time (inject clock)
// ═══════════════════════════════════════════════════════════════════════════

import { Batcher } from '../src/tracker/batch';

describe('Batcher', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('flushes when buffer reaches flushAt', async () => {
    const flushed: AnalyticsEvent[][] = [];
    const batcher = new Batcher(async (events) => { flushed.push([...events]); }, {
      flushAt: 3,
      flushIntervalMs: 0, // disable time-based
      maxQueueSize: 100,
    });

    batcher.add(makeEvent({ id: 'a' }));
    batcher.add(makeEvent({ id: 'b' }));
    expect(flushed).toHaveLength(0);

    batcher.add(makeEvent({ id: 'c' })); // hits flushAt=3
    // flush is async — wait for it
    await vi.runAllTimersAsync();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(3);

    await batcher.shutdown();
  });

  it('flushes on interval (injected clock)', async () => {
    let clock = 0;
    const flushed: AnalyticsEvent[][] = [];
    const batcher = new Batcher(async (events) => { flushed.push([...events]); }, {
      flushAt: 999, // won't trigger by size
      flushIntervalMs: 500,
      maxQueueSize: 100,
      now: () => clock,
    });

    batcher.add(makeEvent());
    expect(flushed).toHaveLength(0);

    clock = 500;
    await vi.advanceTimersByTimeAsync(500);

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(1);

    await batcher.shutdown();
  });

  it('drops events when maxQueueSize exceeded (backpressure)', async () => {
    const batcher = new Batcher(async () => {}, {
      flushAt: 999,
      flushIntervalMs: 0,
      maxQueueSize: 2,
    });

    expect(batcher.add(makeEvent())).toBe(true);
    expect(batcher.add(makeEvent())).toBe(true);
    expect(batcher.add(makeEvent())).toBe(false); // dropped
    expect(batcher.stats.dropped).toBe(1);
    expect(batcher.pending).toBe(2);

    await batcher.shutdown();
  });

  it('re-enqueues on flush failure, within cap', async () => {
    let failOnce = true;
    const batcher = new Batcher(async () => {
      if (failOnce) { failOnce = false; throw new Error('fail'); }
    }, {
      flushAt: 999,
      flushIntervalMs: 0,
      maxQueueSize: 100,
    });

    batcher.add(makeEvent({ id: 'x' }));
    await batcher.flush(); // fails → re-enqueues
    expect(batcher.pending).toBe(1);

    await batcher.flush(); // succeeds
    expect(batcher.pending).toBe(0);

    await batcher.shutdown();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. TRACKER — sampling, dedup, validation
// ═══════════════════════════════════════════════════════════════════════════

import { Tracker } from '../src/tracker/tracker';
import { InvalidEventNameError, MissingIdentityError, DuplicateEventError } from '../src/errors';

describe('Tracker', () => {
  it('tracks a valid event', () => {
    const events: AnalyticsEvent[] = [];
    const tracker = new Tracker(async (e) => { events.push(...e); }, {
      flushAt: 999, flushIntervalMs: 0,
    });

    const result = tracker.track({ event: 'Click', userId: 'u1' });
    expect(result.sampled).toBe(true);
    expect(result.queued).toBe(true);
  });

  it('throws on missing identity', () => {
    const tracker = new Tracker(async () => {}, { flushIntervalMs: 0 });
    expect(() => tracker.track({ event: 'Ev' })).toThrow(MissingIdentityError);
  });

  it('throws on invalid event name', () => {
    const tracker = new Tracker(async () => {}, { flushIntervalMs: 0 });
    expect(() => tracker.track({ event: '123bad', userId: 'u' })).toThrow(InvalidEventNameError);
  });

  it('throws on duplicate messageId', () => {
    const tracker = new Tracker(async () => {}, { flushIntervalMs: 0 });
    tracker.track({ event: 'Ev', userId: 'u', messageId: 'msg1' });
    expect(() => tracker.track({ event: 'Ev', userId: 'u', messageId: 'msg1' })).toThrow(DuplicateEventError);
  });

  it('deterministic sampling is consistent', () => {
    const tracker = new Tracker(async () => {}, {
      flushIntervalMs: 0,
      sampleRate: 0.5,
      sampleSeed: 42,
    });

    const results: boolean[] = [];
    for (let i = 0; i < 100; i++) {
      try {
        const r = tracker.track({ event: 'Ev', userId: 'u', messageId: `m${i}` });
        results.push(r.sampled);
      } catch { /* dedup won't happen since unique messageId */ }
    }

    // With 50% sample rate, roughly half should be sampled
    const sampledCount = results.filter(Boolean).length;
    expect(sampledCount).toBeGreaterThan(10);
    expect(sampledCount).toBeLessThan(90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. PIPELINE — transform/filter order, backpressure
// ═══════════════════════════════════════════════════════════════════════════

import { Pipeline } from '../src/pipeline/pipeline';
import { anonymize, renameEvent, enrichProperties, redactProperty } from '../src/pipeline/transforms';
import { allowEvents, blockEvents, dedupeByMessageId } from '../src/pipeline/filters';
import { memorySink } from '../src/pipeline/sinks';

describe('Pipeline', () => {
  it('applies transforms then filters in declaration order', () => {
    const store: AnalyticsEvent[] = [];
    const pipeline = new Pipeline({ maxBufferSize: 100, sinkBatchSize: 999, sinkFlushIntervalMs: 0 })
      .transform('rename', renameEvent('OldName', 'NewName'))
      .filter('allow', allowEvents(['NewName', 'Other']))
      .to(memorySink(store));

    // Event starts as "OldName" → renamed to "NewName" → passes filter
    const accepted = pipeline.push(makeEvent({ name: 'OldName' }));
    expect(accepted).toBe(true);
    expect(pipeline.pending).toBe(1);

    // "BlockedName" → not renamed → filter drops it
    const rejected = pipeline.push(makeEvent({ name: 'BlockedName' }));
    expect(rejected).toBe(false);
  });

  it('blockEvents filter works', () => {
    const pipeline = new Pipeline({ maxBufferSize: 100, sinkBatchSize: 999, sinkFlushIntervalMs: 0 })
      .filter('block', blockEvents(['Spam']))
      .to(memorySink([]));

    expect(pipeline.push(makeEvent({ name: 'Spam' }))).toBe(false);
    expect(pipeline.push(makeEvent({ name: 'Good' }))).toBe(true);
  });

  it('backpressure drops oldest events', () => {
    const pipeline = new Pipeline({ maxBufferSize: 2, sinkBatchSize: 999, sinkFlushIntervalMs: 0 });
    pipeline.to(memorySink([]));

    pipeline.push(makeEvent({ id: '1' }));
    pipeline.push(makeEvent({ id: '2' }));
    pipeline.push(makeEvent({ id: '3' })); // drops oldest

    expect(pipeline.pending).toBe(2);
    expect(pipeline.stats.dropped).toBe(1);
  });

  it('flushes to sink', async () => {
    const store: AnalyticsEvent[] = [];
    const pipeline = new Pipeline({ maxBufferSize: 100, sinkBatchSize: 999, sinkFlushIntervalMs: 0 })
      .to(memorySink(store));

    pipeline.push(makeEvent({ name: 'A' }));
    pipeline.push(makeEvent({ name: 'B' }));
    await pipeline.flushSink();

    expect(store).toHaveLength(2);
    expect(pipeline.pending).toBe(0);
    expect(pipeline.stats.sunk).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. TRANSFORMS — dedupe & anonymize correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Transforms', () => {
  describe('anonymize', () => {
    it('strips PII fields and hashes userId', () => {
      const transform = anonymize();
      const event = makeEvent({
        userId: 'real_user',
        properties: { email: 'a@b.com', phone: '555', score: 10 },
        context: { ip: '1.2.3.4', device: { userAgent: 'Mozilla' } },
      });

      const result = transform(event)!;
      expect(result.userId).toMatch(/^anon_/);
      expect(result.userId).not.toBe('real_user');
      expect(result.properties!.email).toBeUndefined();
      expect(result.properties!.phone).toBeUndefined();
      expect(result.properties!.score).toBe(10); // non-PII kept
      expect(result.context!.ip).toBeUndefined();
    });

    it('produces deterministic hash for same userId', () => {
      const transform = anonymize();
      const e1 = transform(makeEvent({ userId: 'user_abc' }))!;
      const e2 = transform(makeEvent({ userId: 'user_abc' }))!;
      expect(e1.userId).toBe(e2.userId);
    });
  });

  describe('redactProperty', () => {
    it('replaces property value with [REDACTED]', () => {
      const transform = redactProperty('ssn');
      const event = makeEvent({ properties: { ssn: '123-45-6789', ok: true } });
      const result = transform(event)!;
      expect(result.properties!.ssn).toBe('[REDACTED]');
      expect(result.properties!.ok).toBe(true);
    });
  });

  describe('enrichProperties', () => {
    it('adds static properties', () => {
      const transform = enrichProperties({ env: 'prod', version: '2.0' });
      const event = makeEvent({ properties: { a: 1 } });
      const result = transform(event)!;
      expect(result.properties!.env).toBe('prod');
      expect(result.properties!.a).toBe(1); // original preserved
    });
  });
});

describe('Filters', () => {
  describe('dedupeByMessageId', () => {
    it('drops duplicate messageIds', () => {
      const filter = dedupeByMessageId(100);
      const e1 = makeEvent({ id: 'e1', messageId: 'msg_1' });
      const e2 = makeEvent({ id: 'e2', messageId: 'msg_1' }); // dupe

      expect(filter(e1)).toBe(true);
      expect(filter(e2)).toBe(false); // deduped
    });

    it('falls back to event id when no messageId', () => {
      const filter = dedupeByMessageId(100);
      const e1 = makeEvent({ id: 'same' });
      const e2 = makeEvent({ id: 'same' });

      expect(filter(e1)).toBe(true);
      expect(filter(e2)).toBe(false);
    });

    it('evicts oldest entries beyond window', () => {
      const filter = dedupeByMessageId(2);
      const e1 = makeEvent({ id: 'a' });
      const e2 = makeEvent({ id: 'b' });
      const e3 = makeEvent({ id: 'c' }); // evicts 'a'

      expect(filter(e1)).toBe(true);
      expect(filter(e2)).toBe(true);
      expect(filter(e3)).toBe(true);

      // 'a' was evicted, so it's accepted again
      const e4 = makeEvent({ id: 'a' });
      expect(filter(e4)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. FUNNEL — conversion math
// ═══════════════════════════════════════════════════════════════════════════

import { FunnelAnalyzer } from '../src/funnel/analyzer';
import { FunnelBuilder } from '../src/funnel/builder';
import type { FunnelEvent } from '../src/funnel/types';

describe('FunnelAnalyzer', () => {
  const steps = [
    { name: 'Visit', eventName: 'page_view' },
    { name: 'Signup', eventName: 'signup' },
    { name: 'Purchase', eventName: 'purchase' },
  ];

  it('computes correct conversion rates', () => {
    const events: FunnelEvent[] = [
      // User A: completes all steps
      { eventName: 'page_view', userId: 'A', timestamp: 100 },
      { eventName: 'signup', userId: 'A', timestamp: 200 },
      { eventName: 'purchase', userId: 'A', timestamp: 300 },
      // User B: only first two steps
      { eventName: 'page_view', userId: 'B', timestamp: 100 },
      { eventName: 'signup', userId: 'B', timestamp: 200 },
      // User C: only first step
      { eventName: 'page_view', userId: 'C', timestamp: 100 },
      // User D: only purchase (no page_view first) — should not count
      { eventName: 'purchase', userId: 'D', timestamp: 100 },
    ];

    const analyzer = new FunnelAnalyzer(steps);
    const result = analyzer.analyze(events);

    // 3 users entered (A, B, C)
    expect(result.steps[0].count).toBe(3);
    expect(result.steps[0].conversionRate).toBe(1.0);

    // 2 signed up (A, B)
    expect(result.steps[1].count).toBe(2);
    expect(result.steps[1].conversionRate).toBeCloseTo(2 / 3, 4);

    // 1 purchased (A)
    expect(result.steps[2].count).toBe(1);
    expect(result.steps[2].conversionRate).toBeCloseTo(1 / 3, 4);

    // Overall conversion: 1/3
    expect(result.overallConversion).toBeCloseTo(1 / 3, 4);
  });

  it('respects conversion window', () => {
    const events: FunnelEvent[] = [
      { eventName: 'page_view', userId: 'A', timestamp: 0 },
      { eventName: 'signup', userId: 'A', timestamp: 1000 },
      { eventName: 'purchase', userId: 'A', timestamp: 999_999_999 }, // way after window
    ];

    const analyzer = new FunnelAnalyzer(steps, { conversionWindowMs: 5000 });
    const result = analyzer.analyze(events);

    expect(result.steps[0].count).toBe(1);
    expect(result.steps[1].count).toBe(1);
    expect(result.steps[2].count).toBe(0); // outside window
  });

  it('computes drop-off rates', () => {
    const events: FunnelEvent[] = [
      { eventName: 'page_view', userId: 'A', timestamp: 100 },
      { eventName: 'signup', userId: 'A', timestamp: 200 },
      { eventName: 'page_view', userId: 'B', timestamp: 100 },
    ];

    const analyzer = new FunnelAnalyzer(steps);
    const result = analyzer.analyze(events);

    expect(result.steps[0].dropOffRate).toBe(0);
    expect(result.steps[1].dropOffRate).toBe(0.5); // B dropped
    expect(result.steps[2].dropOffRate).toBe(1.0); // A dropped at purchase
  });

  it('computes median time between steps', () => {
    const events: FunnelEvent[] = [
      { eventName: 'page_view', userId: 'A', timestamp: 0 },
      { eventName: 'signup', userId: 'A', timestamp: 100 },
      { eventName: 'page_view', userId: 'B', timestamp: 0 },
      { eventName: 'signup', userId: 'B', timestamp: 200 },
    ];

    const analyzer = new FunnelAnalyzer([steps[0], steps[1]]);
    const result = analyzer.analyze(events);

    // Median of [100, 200] = 150
    expect(result.steps[1].medianTimeFromPreviousMs).toBe(150);
  });

  it('FunnelBuilder produces equivalent results', () => {
    const events: FunnelEvent[] = [
      { eventName: 'page_view', userId: 'A', timestamp: 100 },
      { eventName: 'signup', userId: 'A', timestamp: 200 },
    ];

    const analyzer = new FunnelBuilder()
      .step('Visit', 'page_view')
      .step('Signup', 'signup')
      .build();

    const result = analyzer.analyze(events);
    expect(result.steps).toHaveLength(2);
    expect(result.overallConversion).toBe(1.0);
  });

  it('supports step filters', () => {
    const events: FunnelEvent[] = [
      { eventName: 'page_view', userId: 'A', timestamp: 100 },
      { eventName: 'signup', userId: 'A', timestamp: 200, properties: { plan: 'free' } },
      { eventName: 'page_view', userId: 'B', timestamp: 100 },
      { eventName: 'signup', userId: 'B', timestamp: 200, properties: { plan: 'pro' } },
    ];

    const analyzer = new FunnelBuilder()
      .step('Visit', 'page_view')
      .stepWhere('Pro Signup', 'signup', 'plan', 'equals', 'pro')
      .build();

    const result = analyzer.analyze(events);
    expect(result.steps[0].count).toBe(2);
    expect(result.steps[1].count).toBe(1); // only B matches filter
  });

  it('throws for fewer than 2 steps', () => {
    expect(() => new FunnelAnalyzer([{ name: 'Only', eventName: 'ev' }])).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. METRICS — counter, gauge, histogram percentiles
// ═══════════════════════════════════════════════════════════════════════════

import { Counter } from '../src/metrics/counter';
import { Gauge } from '../src/metrics/gauge';
import { Histogram } from '../src/metrics/histogram';

describe('Counter', () => {
  it('increments monotonically', () => {
    const c = new Counter('requests', { method: 'GET' });
    c.inc();
    c.inc(5);
    expect(c.value).toBe(6);
  });

  it('rejects negative increments', () => {
    const c = new Counter('x');
    expect(() => c.inc(-1)).toThrow();
  });

  it('resets to zero', () => {
    const c = new Counter('x');
    c.inc(10);
    c.reset();
    expect(c.value).toBe(0);
  });

  it('snapshot includes labels', () => {
    const c = new Counter('http_reqs', { status: '200' }, () => 9999);
    c.inc(3);
    const snap = c.snapshot();
    expect(snap.name).toBe('http_reqs');
    expect(snap.type).toBe('counter');
    expect(snap.labels.status).toBe('200');
    expect(snap.value).toBe(3);
    expect(snap.timestamp).toBe(9999);
  });
});

describe('Gauge', () => {
  it('goes up and down', () => {
    const g = new Gauge('queue_size');
    g.set(10);
    expect(g.value).toBe(10);
    g.inc(5);
    expect(g.value).toBe(15);
    g.dec(3);
    expect(g.value).toBe(12);
  });
});

describe('Histogram', () => {
  it('computes percentiles correctly', () => {
    const h = new Histogram('latency', { buckets: [10, 50, 100, 500] });

    // Insert known values
    const values = [5, 10, 20, 30, 50, 80, 100, 200, 300, 500];
    for (const v of values) h.observe(v);

    expect(h.count).toBe(10);
    expect(h.sum).toBe(1295);
    expect(h.min).toBe(5);
    expect(h.max).toBe(500);
    expect(h.mean).toBeCloseTo(129.5);

    // p50 = median of [5,10,20,30,50,80,100,200,300,500] → 50
    expect(h.percentile(0.5)).toBe(50);

    // p90 → 9th value (index 8) → 300
    expect(h.percentile(0.9)).toBe(300);

    // p99 → 10th value → 500
    expect(h.percentile(0.99)).toBe(500);
  });

  it('bucket counts are cumulative', () => {
    const h = new Histogram('x', { buckets: [10, 50, 100] });
    h.observe(5);   // ≤10, ≤50, ≤100
    h.observe(30);  // ≤50, ≤100
    h.observe(80);  // ≤100
    h.observe(200); // none

    const snap = h.snapshot();
    const bucketMap = Object.fromEntries(snap.buckets.map(b => [b.le, b.count]));
    expect(bucketMap[10]).toBe(1);
    expect(bucketMap[50]).toBe(2);
    expect(bucketMap[100]).toBe(3);
  });

  it('rejects non-finite values', () => {
    const h = new Histogram('x');
    expect(() => h.observe(Infinity)).toThrow();
    expect(() => h.observe(NaN)).toThrow();
  });

  it('resets all state', () => {
    const h = new Histogram('x');
    h.observe(10);
    h.observe(20);
    h.reset();
    expect(h.count).toBe(0);
    expect(h.sum).toBe(0);
    expect(h.min).toBe(0);
    expect(h.max).toBe(0);
  });

  it('snapshot includes standard percentiles', () => {
    const h = new Histogram('x');
    for (let i = 1; i <= 100; i++) h.observe(i);

    const snap = h.snapshot();
    expect(snap.percentiles).toHaveLength(4);
    expect(snap.percentiles.map(p => p.p)).toEqual([0.5, 0.9, 0.95, 0.99]);
    expect(snap.percentiles[0].value).toBe(50); // p50
    expect(snap.percentiles[3].value).toBe(99); // p99
  });
});
