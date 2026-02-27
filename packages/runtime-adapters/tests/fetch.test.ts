/**
 * Fetch Adapter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVerificationFetch, getCollector } from '../src/index.js';

// Mock fetch
global.fetch = vi.fn();

describe('Fetch Verification Adapter', () => {
  beforeEach(() => {
    getCollector().clear();
    vi.clearAllMocks();
  });

  it('should capture traces for fetch calls', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const fetchWithVerification = createVerificationFetch({
      domain: 'Test',
      behaviorExtractor: (url) => `fetch ${url}`,
    });

    await fetchWithVerification('https://api.example.com/test');

    const collector = getCollector();
    const events = collector.getEvents();

    expect(events.length).toBeGreaterThan(0);
    const callEvent = events.find((e) => e.kind === 'handler_call');
    expect(callEvent).toBeDefined();
    expect(callEvent?.handler).toContain('fetch');
  });

  it('should capture error events for failed requests', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const fetchWithVerification = createVerificationFetch({
      domain: 'Test',
    });

    try {
      await fetchWithVerification('https://api.example.com/test');
    } catch {
      // Expected
    }

    const collector = getCollector();
    const events = collector.getEvents();

    const errorEvents = events.filter((e) => e.kind === 'handler_error');
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('should ignore specified URLs', async () => {
    const fetchWithVerification = createVerificationFetch({
      domain: 'Test',
      ignoreUrls: ['metrics', 'health'],
    });

    await fetchWithVerification('https://api.example.com/metrics');

    const collector = getCollector();
    const events = collector.getEvents();

    expect(events.length).toBe(0);
  });
});
