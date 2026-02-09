/**
 * Trace Collector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraceCollector } from '../src/collector.js';
import type { Trace, TraceEvent } from '@isl-lang/trace-format';

describe('TraceCollector', () => {
  let collector: TraceCollector;

  beforeEach(() => {
    collector = new TraceCollector();
  });

  it('should store traces', () => {
    const trace: Trace = {
      id: 'test-1',
      name: 'Test Trace',
      domain: 'Test',
      startTime: new Date().toISOString(),
      correlationId: 'corr-1',
      events: [],
    };

    collector.addTrace(trace);

    const traces = collector.getTraces();
    expect(traces.length).toBe(1);
    expect(traces[0]?.id).toBe('test-1');
  });

  it('should store events', () => {
    const event: TraceEvent = {
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId: 'corr-1',
      handler: 'test-handler',
      inputs: {},
      outputs: {},
      events: [],
    };

    collector.addEvent(event);

    const events = collector.getEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.handler).toBe('test-handler');
  });

  it('should filter traces by domain', () => {
    collector.addTrace({
      id: 'trace-1',
      name: 'Trace 1',
      domain: 'Auth',
      startTime: new Date().toISOString(),
      correlationId: 'corr-1',
      events: [],
    });

    collector.addTrace({
      id: 'trace-2',
      name: 'Trace 2',
      domain: 'Payments',
      startTime: new Date().toISOString(),
      correlationId: 'corr-2',
      events: [],
    });

    const authTraces = collector.getTracesForDomain('Auth');
    expect(authTraces.length).toBe(1);
    expect(authTraces[0]?.domain).toBe('Auth');
  });

  it('should export traces and events', () => {
    const trace: Trace = {
      id: 'test-1',
      name: 'Test Trace',
      domain: 'Test',
      startTime: new Date().toISOString(),
      correlationId: 'corr-1',
      events: [],
    };

    const event: TraceEvent = {
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId: 'corr-1',
      handler: 'test-handler',
      inputs: {},
      outputs: {},
      events: [],
    };

    collector.addTrace(trace);
    collector.addEvent(event);

    const exported = collector.export();
    expect(exported.traces.length).toBe(1);
    expect(exported.events.length).toBe(1);
  });

  it('should calculate coverage statistics', () => {
    collector.addTrace({
      id: 'trace-1',
      name: 'Trace 1',
      domain: 'Auth',
      startTime: new Date().toISOString(),
      correlationId: 'corr-1',
      events: [
        {
          time: new Date().toISOString(),
          kind: 'handler_call',
          correlationId: 'corr-1',
          handler: 'Login',
          inputs: {},
          outputs: {},
          events: [],
        },
      ],
    });

    const coverage = collector.getCoverage();
    expect(coverage.totalTraces).toBe(1);
    expect(coverage.totalEvents).toBe(1);
    expect(coverage.handlers.has('Login')).toBe(true);
    expect(coverage.domains.has('Auth')).toBe(true);
  });

  it('should clear all traces and events', () => {
    collector.addTrace({
      id: 'trace-1',
      name: 'Trace 1',
      domain: 'Test',
      startTime: new Date().toISOString(),
      correlationId: 'corr-1',
      events: [],
    });

    collector.addEvent({
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId: 'corr-1',
      handler: 'test',
      inputs: {},
      outputs: {},
      events: [],
    });

    collector.clear();

    expect(collector.getTraces().length).toBe(0);
    expect(collector.getEvents().length).toBe(0);
  });
});
