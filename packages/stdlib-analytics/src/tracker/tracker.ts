/**
 * Analytics tracker — event ingestion with dedup, sampling, batching.
 */

import { generateUUID } from '@isl-lang/stdlib-core';
import { InvalidEventNameError, MissingIdentityError, DuplicateEventError } from '../errors.js';
import { Batcher } from './batch.js';
import { enrichContext } from './context.js';
import type { TrackerConfig, AnalyticsEvent, TrackInput, TrackResult, FlushCallback } from './types.js';

const EVENT_NAME_RE = /^[A-Za-z][A-Za-z0-9_.]*$/;

export class Tracker {
  private readonly config: TrackerConfig;
  private readonly batcher: Batcher;
  private readonly seenMessageIds = new Set<string>();
  private readonly maxDedup = 10_000;

  constructor(onFlush: FlushCallback, config: Partial<TrackerConfig> = {}) {
    this.config = {
      flushAt: 20,
      flushIntervalMs: 10_000,
      maxQueueSize: 5000,
      retryCount: 3,
      sampleRate: 1.0,
      sampleSeed: 0,
      debug: false,
      now: Date.now,
      ...config,
    };

    this.batcher = new Batcher(onFlush, {
      flushAt: this.config.flushAt,
      flushIntervalMs: this.config.flushIntervalMs,
      maxQueueSize: this.config.maxQueueSize,
      now: this.config.now,
    });
  }

  track(input: TrackInput): TrackResult {
    // Validate identity
    if (!input.userId && !input.anonymousId) {
      throw new MissingIdentityError();
    }

    // Validate event name
    if (!input.event || !EVENT_NAME_RE.test(input.event) || input.event.length > 128) {
      throw new InvalidEventNameError(input.event ?? '');
    }

    // Dedup by messageId
    if (input.messageId) {
      if (this.seenMessageIds.has(input.messageId)) {
        throw new DuplicateEventError(input.messageId);
      }
      this.seenMessageIds.add(input.messageId);
      if (this.seenMessageIds.size > this.maxDedup) {
        const first = this.seenMessageIds.values().next().value as string;
        this.seenMessageIds.delete(first);
      }
    }

    const id = generateUUID();
    const now = this.config.now();

    // Deterministic sampling
    const sampled = this.shouldSample(id);
    if (!sampled) {
      return { id, sampled: false, queued: false };
    }

    const event: AnalyticsEvent = {
      id,
      type: 'track',
      name: input.event,
      userId: input.userId,
      anonymousId: input.anonymousId,
      properties: input.properties,
      context: enrichContext(input.context),
      timestamp: input.timestamp ?? now,
      receivedAt: now,
      messageId: input.messageId,
    };

    const queued = this.batcher.add(event);

    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`[Tracker] ${queued ? 'queued' : 'dropped'}: ${input.event}`);
    }

    return { id, sampled: true, queued };
  }

  async flush(): Promise<void> {
    await this.batcher.flush();
  }

  async shutdown(): Promise<void> {
    await this.batcher.shutdown();
  }

  get pending(): number {
    return this.batcher.pending;
  }

  get stats() {
    return this.batcher.stats;
  }

  /**
   * Deterministic sampling via FNV-1a hash of event id + seed.
   * Returns true if the event should be kept.
   */
  private shouldSample(eventId: string): boolean {
    if (this.config.sampleRate >= 1.0) return true;
    if (this.config.sampleRate <= 0.0) return false;

    const hash = fnv1a(eventId + ':' + this.config.sampleSeed);
    return (hash % 10000) / 10000 < this.config.sampleRate;
  }
}

/** FNV-1a 32-bit hash */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
