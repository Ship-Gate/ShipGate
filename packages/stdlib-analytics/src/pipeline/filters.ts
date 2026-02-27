/**
 * Built-in filters for the analytics pipeline.
 */

import type { AnalyticsEvent } from '../tracker/types.js';
import type { FilterFn } from './types.js';

/**
 * Keep only events matching the given names.
 */
export function allowEvents(names: string[]): FilterFn {
  const set = new Set(names);
  return (event: AnalyticsEvent) => set.has(event.name);
}

/**
 * Drop events matching the given names.
 */
export function blockEvents(names: string[]): FilterFn {
  const set = new Set(names);
  return (event: AnalyticsEvent) => !set.has(event.name);
}

/**
 * Deduplicate events by messageId within a sliding window.
 */
export function dedupeByMessageId(windowSize = 10_000): FilterFn {
  const seen = new Set<string>();
  const order: string[] = [];

  return (event: AnalyticsEvent) => {
    const key = event.messageId ?? event.id;
    if (seen.has(key)) return false;
    seen.add(key);
    order.push(key);
    if (order.length > windowSize) {
      const evicted = order.shift()!;
      seen.delete(evicted);
    }
    return true;
  };
}

/**
 * Sample events deterministically using a hash of event id.
 */
export function sample(rate: number, seed = 0): FilterFn {
  return (event: AnalyticsEvent) => {
    if (rate >= 1.0) return true;
    if (rate <= 0.0) return false;
    const hash = fnv1a(event.id + ':' + seed);
    return (hash % 10000) / 10000 < rate;
  };
}

/**
 * Filter events by a property value.
 */
export function whereProperty(property: string, value: unknown): FilterFn {
  return (event: AnalyticsEvent) => {
    return event.properties?.[property] === value;
  };
}

/**
 * Only keep events with a specific event type.
 */
export function byType(type: AnalyticsEvent['type']): FilterFn {
  return (event: AnalyticsEvent) => event.type === type;
}

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
