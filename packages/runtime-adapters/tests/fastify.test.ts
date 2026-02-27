/**
 * Fastify Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { fastifyVerificationAdapter, getCollector } from '../src/index.js';

describe('Fastify Verification Adapter', () => {
  beforeEach(() => {
    getCollector().clear();
  });

  it('should capture traces for requests', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyVerificationAdapter, {
      domain: 'Test',
      behaviorExtractor: (req) => `${req.method} ${req.url}`,
    });

    fastify.get('/test', async () => {
      return { message: 'hello' };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);

    const collector = getCollector();
    const traces = collector.getTracesForDomain('Test');

    expect(traces.length).toBeGreaterThan(0);
    const trace = traces[0];
    expect(trace.domain).toBe('Test');
    expect(trace.events.length).toBeGreaterThan(0);
    expect(trace.events[0]?.kind).toBe('handler_call');
  });

  it('should ignore health check paths', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyVerificationAdapter, {
      domain: 'Test',
      ignorePaths: ['/health'],
    });

    fastify.get('/health', async () => {
      return { status: 'ok' };
    });

    await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    const collector = getCollector();
    const traces = collector.getTracesForDomain('Test');

    expect(traces.length).toBe(0);
  });

  it('should capture error events', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyVerificationAdapter, {
      domain: 'Test',
    });

    fastify.get('/error', async () => {
      throw new Error('Test error');
    });

    try {
      await fastify.inject({
        method: 'GET',
        url: '/error',
      });
    } catch {
      // Expected
    }

    const collector = getCollector();
    const events = collector.getEvents();

    const errorEvents = events.filter((e) => e.kind === 'handler_error');
    expect(errorEvents.length).toBeGreaterThan(0);
  });
});
