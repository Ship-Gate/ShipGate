/**
 * Express Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { expressVerificationMiddleware, getCollector } from '../src/index.js';
import request from 'supertest';

describe('Express Verification Middleware', () => {
  beforeEach(() => {
    getCollector().clear();
  });

  it('should capture traces for requests', async () => {
    const app = express();
    app.use(express.json());

    app.use(
      expressVerificationMiddleware({
        domain: 'Test',
        behaviorExtractor: (req) => `${req.method} ${req.path}`,
      })
    );

    app.get('/test', (_req, res) => {
      res.json({ message: 'hello' });
    });

    await request(app).get('/test').expect(200);

    const collector = getCollector();
    const traces = collector.getTracesForDomain('Test');

    expect(traces.length).toBeGreaterThan(0);
    const trace = traces[0];
    expect(trace.domain).toBe('Test');
    expect(trace.events.length).toBeGreaterThan(0);
  });

  it('should ignore health check paths', async () => {
    const app = express();

    app.use(
      expressVerificationMiddleware({
        domain: 'Test',
        ignorePaths: ['/health'],
      })
    );

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    await request(app).get('/health').expect(200);

    const collector = getCollector();
    const traces = collector.getTracesForDomain('Test');

    expect(traces.length).toBe(0);
  });
});
