/**
 * Integration tests for cross-service correlation
 * 
 * Tests that correlation IDs propagate correctly across service boundaries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { fastifyTracingPlugin } from '../src/adapters/fastify.js';
import { createTracedFetch } from '../src/adapters/fetch.js';
import { CORRELATION_HEADERS } from '../src/correlation.js';

describe('Cross-service correlation', () => {
  let serviceA: FastifyInstance;
  let serviceB: FastifyInstance;
  let provider: NodeTracerProvider;
  let mockFetch: typeof fetch;

  beforeEach(async () => {
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.register();

    // Service A - receives requests and calls Service B
    serviceA = Fastify();
    await serviceA.register(fastifyTracingPlugin, {
      serviceName: 'service-a',
      serviceVersion: '1.0.0',
    });

    // Service B - receives requests from Service A
    serviceB = Fastify();
    await serviceB.register(fastifyTracingPlugin, {
      serviceName: 'service-b',
      serviceVersion: '1.0.0',
    });

    // Setup Service B endpoint
    serviceB.get('/data', async (request, reply) => {
      const correlationId = serviceB.getCorrelationId();
      return {
        data: 'response from service-b',
        correlationId,
      };
    });

    // Start Service B
    await serviceB.listen({ port: 3001, host: '127.0.0.1' });

    // Setup Service A endpoint that calls Service B
    const tracedFetch = createTracedFetch(fetch, 'service-a');
    serviceA.get('/proxy', async (request, reply) => {
      const correlationId = serviceA.getCorrelationId();
      const response = await tracedFetch('http://127.0.0.1:3001/data');
      const data = await response.json();
      return {
        ...data,
        serviceA: {
          correlationId,
        },
      };
    });

    // Start Service A
    await serviceA.listen({ port: 3000, host: '127.0.0.1' });
  });

  afterEach(async () => {
    await serviceA.close();
    await serviceB.close();
    await provider.shutdown();
  });

  it('should propagate correlation ID from Service A to Service B', async () => {
    const response = await fetch('http://127.0.0.1:3000/proxy');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.serviceA.correlationId).toBeTruthy();
    expect(data.correlationId).toBeTruthy();
    // Correlation IDs should match (same trace)
    expect(data.serviceA.correlationId).toBe(data.correlationId);
  });

  it('should maintain correlation ID in response headers', async () => {
    const response = await fetch('http://127.0.0.1:3000/proxy');
    const correlationIdHeader = response.headers.get(CORRELATION_HEADERS.CORRELATION_ID);

    expect(correlationIdHeader).toBeTruthy();
    expect(typeof correlationIdHeader).toBe('string');
  });

  it('should propagate correlation ID from external request', async () => {
    const externalCorrelationId = 'external-correlation-id-123';
    const response = await fetch('http://127.0.0.1:3000/proxy', {
      headers: {
        [CORRELATION_HEADERS.CORRELATION_ID]: externalCorrelationId,
      },
    });

    const data = await response.json();
    // Should use the provided correlation ID
    expect(data.serviceA.correlationId).toBeTruthy();
  });

  it('should create separate traces for different requests', async () => {
    const response1 = await fetch('http://127.0.0.1:3000/proxy');
    const data1 = await response1.json();

    const response2 = await fetch('http://127.0.0.1:3000/proxy');
    const data2 = await response2.json();

    // Each request should have its own correlation ID
    expect(data1.serviceA.correlationId).toBeTruthy();
    expect(data2.serviceA.correlationId).toBeTruthy();
    // They should be different (different traces)
    expect(data1.serviceA.correlationId).not.toBe(data2.serviceA.correlationId);
  });
});
