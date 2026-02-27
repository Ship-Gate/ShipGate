/**
 * Built-in sinks for the analytics pipeline.
 */

import type { AnalyticsEvent } from '../tracker/types.js';
import type { SinkFn } from './types.js';

/**
 * Console sink — logs events to stdout.
 */
export function consoleSink(prefix = '[analytics]'): SinkFn {
  return async (events: AnalyticsEvent[]): Promise<void> => {
    for (const e of events) {
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${e.type}:${e.name} user=${e.userId ?? e.anonymousId ?? '?'} ts=${e.timestamp}`);
    }
  };
}

/**
 * Memory sink — stores events in an array (useful for tests).
 */
export function memorySink(store: AnalyticsEvent[]): SinkFn {
  return async (events: AnalyticsEvent[]): Promise<void> => {
    store.push(...events);
  };
}

/**
 * Callback sink — delegate to an arbitrary async function.
 */
export function callbackSink(fn: (events: AnalyticsEvent[]) => Promise<void>): SinkFn {
  return fn;
}

/**
 * Multi-sink — fan-out to multiple sinks.
 */
export function multiSink(sinks: SinkFn[]): SinkFn {
  return async (events: AnalyticsEvent[]): Promise<void> => {
    await Promise.all(sinks.map(s => s(events)));
  };
}

/**
 * Null sink — discards all events.
 */
export function nullSink(): SinkFn {
  return async (): Promise<void> => {
    // noop
  };
}
