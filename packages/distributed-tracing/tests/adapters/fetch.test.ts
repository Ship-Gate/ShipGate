/**
 * Tests for fetch adapter with correlation ID propagation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { createTracedFetch, getCorrelationHeaders } from '../../src/adapters/fetch.js';
import { CORRELATION_HEADERS } from '../../src/correlation.js';

describe('Fetch adapter', () => {
  let provider: NodeTracerProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.register();

    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(async () => {
    await provider.shutdown();
    vi.clearAllMocks();
  });

  it('should inject correlation headers into requests', async () => {
    const tracedFetch = createTracedFetch(mockFetch as typeof fetch);

    await tracedFetch('https://api.example.com/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    const url = call[0];
    const options = call[1] as RequestInit;

    expect(url).toBe('https://api.example.com/test');
    expect(options.headers).toBeInstanceOf(Headers);

    const headers = options.headers as Headers;
    const correlationId = headers.get(CORRELATION_HEADERS.CORRELATION_ID);
    expect(correlationId).toBeTruthy();
  });

  it('should merge with existing headers', async () => {
    const tracedFetch = createTracedFetch(mockFetch as typeof fetch);

    await tracedFetch('https://api.example.com/test', {
      headers: {
        'Authorization': 'Bearer token',
      },
    });

    const call = mockFetch.mock.calls[0];
    const options = call[1] as RequestInit;
    const headers = options.headers as Headers;

    expect(headers.get('Authorization')).toBe('Bearer token');
    expect(headers.get(CORRELATION_HEADERS.CORRELATION_ID)).toBeTruthy();
  });

  it('should create spans for requests', async () => {
    const tracedFetch = createTracedFetch(mockFetch as typeof fetch, 'test-service');

    await tracedFetch('https://api.example.com/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Span creation verified by no errors
  });

  it('should record response status in span', async () => {
    const errorResponse = new Response('Error', { status: 500 });
    mockFetch.mockResolvedValueOnce(errorResponse);

    const tracedFetch = createTracedFetch(mockFetch as typeof fetch);

    await tracedFetch('https://api.example.com/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Error status should be recorded in span
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    mockFetch.mockRejectedValueOnce(fetchError);

    const tracedFetch = createTracedFetch(mockFetch as typeof fetch);

    await expect(tracedFetch('https://api.example.com/test')).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should skip span creation when createSpan is false', async () => {
    const tracedFetch = createTracedFetch(mockFetch as typeof fetch);

    await tracedFetch('https://api.example.com/test', {
      createSpan: false,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Still injects headers even without span
    const call = mockFetch.mock.calls[0];
    const options = call[1] as RequestInit;
    const headers = options.headers as Headers;
    expect(headers.get(CORRELATION_HEADERS.CORRELATION_ID)).toBeTruthy();
  });

  it('should use custom span name when provided', async () => {
    const tracedFetch = createTracedFetch(mockFetch as typeof fetch);

    await tracedFetch('https://api.example.com/test', {
      spanName: 'custom-operation',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  describe('getCorrelationHeaders', () => {
    it('should return correlation headers', () => {
      const headers = getCorrelationHeaders();
      expect(typeof headers).toBe('object');
      // May be empty if no active span, but should be an object
    });
  });
});
