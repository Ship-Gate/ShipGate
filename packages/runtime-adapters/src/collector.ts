/**
 * Trace Collector
 * 
 * Stores traces for verification. Traces are collected during runtime
 * and can be exported for use with `shipgate verify`.
 */

import type { Trace, TraceEvent } from '@isl-lang/trace-format';

/**
 * Trace collector that stores traces in memory
 */
export class TraceCollector {
  private traces: Map<string, Trace> = new Map();
  private events: TraceEvent[] = [];

  /**
   * Add a trace to the collector
   */
  addTrace(trace: Trace): void {
    this.traces.set(trace.id, trace);
    // Also add events to the flat list for coverage analysis
    this.events.push(...trace.events);
  }

  /**
   * Add a single event (will be grouped into traces by correlation ID)
   */
  addEvent(event: TraceEvent): void {
    this.events.push(event);
  }

  /**
   * Get all traces
   */
  getTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get all events
   */
  getEvents(): TraceEvent[] {
    return this.events;
  }

  /**
   * Get traces for a specific domain/behavior
   */
  getTracesForDomain(domain: string): Trace[] {
    return Array.from(this.traces.values()).filter(t => t.domain === domain);
  }

  /**
   * Get events for a specific handler
   */
  getEventsForHandler(handler: string): TraceEvent[] {
    return this.events.filter(e => e.handler === handler);
  }

  /**
   * Clear all traces and events
   */
  clear(): void {
    this.traces.clear();
    this.events = [];
  }

  /**
   * Export traces as JSON for verification
   */
  export(): { traces: Trace[]; events: TraceEvent[] } {
    return {
      traces: this.getTraces(),
      events: this.getEvents(),
    };
  }

  /**
   * Get coverage statistics
   */
  getCoverage(): {
    totalTraces: number;
    totalEvents: number;
    handlers: Set<string>;
    domains: Set<string>;
  } {
    const handlers = new Set<string>();
    const domains = new Set<string>();

    for (const event of this.events) {
      handlers.add(event.handler);
    }

    for (const trace of this.traces.values()) {
      domains.add(trace.domain);
    }

    return {
      totalTraces: this.traces.size,
      totalEvents: this.events.length,
      handlers,
      domains,
    };
  }
}

/**
 * Global trace collector instance
 * Used by adapters to store traces automatically
 */
export const globalCollector = new TraceCollector();

/**
 * Get or create a trace collector instance
 */
export function getCollector(): TraceCollector {
  return globalCollector;
}
