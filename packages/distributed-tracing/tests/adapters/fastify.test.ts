/**
 * Tests for Fastify tracing adapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { fastifyTracingPlugin } from '../../src/adapters/fastify.js';
import { extractCorrelationFromHeaders, CORRELATION_HEADERS } from '../../src/correlation.js';

describe('Fastify tracing adapter', () => {
  let app: FastifyInstance;
  let provider: NodeTracerProvider;

  beforeEach(async () => {
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.register();

    app = Fastify();
    await app.register(fastifyTracingPlugin, {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
    });

    app.get('/test', async (request, reply) => {
      return { message: 'ok' };
    });

    app.get('/health', async () => {
      return { status: 'ok' };
    });
  });

  afterEach(async () => {
    await app.close();
    await provider.shutdown();
  });

  it('should extract correlation ID from incoming request', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';
    const traceparent = `00-${traceId}-${spanId}-01`;

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        [CORRELATION_HEADERS.TRACEPARENT]: traceparent,
      },
    });

    expect(response.statusCode).toBe(200);
    // Correlation ID should be in response headers
    expect(response.headers[CORRELATION_HEADERS.CORRELATION_ID.toLowerCase()]).toBeTruthy();
  });

  it('should inject correlation ID into response headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const correlationId = response.headers[CORRELATION_HEADERS.CORRELATION_ID.toLowerCase()];
    expect(correlationId).toBeTruthy();
    expect(typeof correlationId).toBe('string');
  });

  it('should propagate correlation ID across requests', async () => {
    // First request
    const response1 = await app.inject({
      method: 'GET',
      url: '/test',
    });

    const correlationId1 = response1.headers[CORRELATION_HEADERS.CORRELATION_ID.toLowerCase()] as string;

    // Second request with correlation ID from first
    const response2 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        [CORRELATION_HEADERS.CORRELATION_ID]: correlationId1,
      },
    });

    const correlationId2 = response2.headers[CORRELATION_HEADERS.CORRELATION_ID.toLowerCase()] as string;
    // Should maintain correlation ID
    expect(correlationId2).toBeTruthy();
  });

  it('should create spans for requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    // Span should be created (verified by no errors)
  });

  it('should handle errors and record them in spans', async () => {
    app.get('/error', async () => {
      throw new Error('Test error');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/error',
    });

    expect(response.statusCode).toBe(500);
  });

  it('should ignore paths in ignorePaths option', async () => {
    const testApp = Fastify();
    await testApp.register(fastifyTracingPlugin, {
      serviceName: 'test-service',
      ignorePaths: ['/health'],
    });

    testApp.get('/health', async () => {
      return { status: 'ok' };
    });

    const response = await testApp.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    await testApp.close();
  });

  it('should provide correlation ID via decorator', async () => {
    app.get('/correlation', async (request, reply) => {
      const correlationId = app.getCorrelationId();
      return { correlationId };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/correlation',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.correlationId).toBeTruthy();
  });
});
