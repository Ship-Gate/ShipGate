/**
 * Built-in transforms for the analytics pipeline.
 */

import type { AnalyticsEvent } from '../tracker/types.js';
import type { TransformFn } from './types.js';

/**
 * Anonymize: strip userId and replace with a hash, remove PII fields.
 */
export function anonymize(fieldsToStrip: string[] = ['email', 'name', 'phone', 'ip']): TransformFn {
  return (event: AnalyticsEvent): AnalyticsEvent => {
    const props = event.properties ? { ...event.properties } : undefined;
    if (props) {
      for (const f of fieldsToStrip) {
        delete props[f];
      }
    }

    const ctx = event.context ? { ...event.context } : undefined;
    if (ctx) {
      delete ctx.ip;
      if (ctx.device) {
        ctx.device = { ...ctx.device };
        delete ctx.device.userAgent;
      }
    }

    return {
      ...event,
      userId: event.userId ? hashString(event.userId) : undefined,
      properties: props,
      context: ctx,
    };
  };
}

/**
 * Rename an event.
 */
export function renameEvent(from: string, to: string): TransformFn {
  return (event: AnalyticsEvent): AnalyticsEvent => {
    if (event.name === from) {
      return { ...event, name: to };
    }
    return event;
  };
}

/**
 * Add static properties to every event.
 */
export function enrichProperties(extra: Record<string, unknown>): TransformFn {
  return (event: AnalyticsEvent): AnalyticsEvent => ({
    ...event,
    properties: { ...extra, ...event.properties },
  });
}

/**
 * Redact a specific property value (replace with "[REDACTED]").
 */
export function redactProperty(propertyName: string): TransformFn {
  return (event: AnalyticsEvent): AnalyticsEvent => {
    if (!event.properties || !(propertyName in event.properties)) return event;
    return {
      ...event,
      properties: { ...event.properties, [propertyName]: '[REDACTED]' },
    };
  };
}

/** Simple string hash for anonymisation */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return 'anon_' + hash.toString(16);
}
