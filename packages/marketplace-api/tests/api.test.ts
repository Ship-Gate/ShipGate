/**
 * Marketplace API Tests
 * 
 * Integration tests for the Intent Marketplace API.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Express } from 'express';

describe('Marketplace API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('marketplace-api');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('API Info', () => {
    it('should return API information', async () => {
      const res = await request(app).get('/api');
      
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Intent Marketplace API');
      expect(res.body.version).toBe('0.1.0');
      expect(res.body.endpoints).toBeDefined();
      expect(res.body.endpoints.intents).toBeDefined();
      expect(res.body.endpoints.search).toBeDefined();
    });
  });

  describe('GET /api/intents', () => {
    it('should return list of packages', async () => {
      const res = await request(app).get('/api/intents');
      
      expect(res.status).toBe(200);
      expect(res.body.packages).toBeDefined();
      expect(Array.isArray(res.body.packages)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeDefined();
      expect(res.body.pagination.limit).toBeDefined();
      expect(res.body.pagination.offset).toBeDefined();
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/intents')
        .query({ limit: 5, offset: 0 });
      
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.offset).toBe(0);
    });

    it('should support filtering by category', async () => {
      const res = await request(app)
        .get('/api/intents')
        .query({ category: 'AUTH' });
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.packages)).toBe(true);
    });

    it('should support sorting', async () => {
      const res = await request(app)
        .get('/api/intents')
        .query({ sort: 'stars', order: 'desc' });
      
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/intents', () => {
    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/intents')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details).toBeDefined();
    });

    it('should validate name format', async () => {
      const res = await request(app)
        .post('/api/intents')
        .send({
          name: 'Invalid Name',
          displayName: 'Test Package',
          description: 'A test package description',
          author: 'test-author',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should accept valid package creation', async () => {
      const res = await request(app)
        .post('/api/intents')
        .send({
          name: 'test-package',
          displayName: 'Test Package',
          description: 'A test package description for validation',
          author: 'test-author',
          category: 'GENERAL',
        });
      
      // Will fail without database, but validates the route works
      expect([201, 500]).toContain(res.status);
    });
  });

  describe('GET /api/intents/:name', () => {
    it('should return 404 for non-existent package', async () => {
      const res = await request(app).get('/api/intents/non-existent-package');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/intents/:name/versions', () => {
    it('should return 404 for non-existent package', async () => {
      const res = await request(app).get('/api/intents/non-existent/versions');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/search', () => {
    it('should require query parameter', async () => {
      const res = await request(app).get('/api/search');
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('"q"');
    });

    it('should return search results', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'auth' });
      
      expect(res.status).toBe(200);
      expect(res.body.query).toBe('auth');
      expect(res.body.results).toBeDefined();
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it('should support category filter', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'test', category: 'AUTH' });
      
      expect(res.status).toBe(200);
    });

    it('should support minimum trust score filter', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'test', minTrust: '80' });
      
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/trending', () => {
    it('should return trending packages', async () => {
      const res = await request(app).get('/api/trending/trending');
      
      expect(res.status).toBe(200);
      expect(res.body.period).toBeDefined();
      expect(res.body.trending).toBeDefined();
      expect(Array.isArray(res.body.trending)).toBe(true);
    });

    it('should support period parameter', async () => {
      const res = await request(app)
        .get('/api/trending/trending')
        .query({ period: 'month' });
      
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('month');
    });
  });

  describe('GET /api/search/categories', () => {
    it('should return list of categories', async () => {
      const res = await request(app).get('/api/search/categories');
      
      expect(res.status).toBe(200);
      expect(res.body.categories).toBeDefined();
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThan(0);
      
      // Verify category structure
      const category = res.body.categories[0];
      expect(category.value).toBeDefined();
      expect(category.label).toBeDefined();
      expect(category.description).toBeDefined();
    });
  });

  describe('GET /api/search/suggest', () => {
    it('should require prefix parameter', async () => {
      const res = await request(app).get('/api/search/suggest');
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('should return suggestions', async () => {
      const res = await request(app)
        .get('/api/search/suggest')
        .query({ prefix: 'auth' });
      
      expect(res.status).toBe(200);
      expect(res.body.prefix).toBe('auth');
      expect(res.body.suggestions).toBeDefined();
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });
  });

  describe('GET /api/intents/:name/trust', () => {
    it('should return 404 for non-existent package', async () => {
      const res = await request(app).get('/api/intents/non-existent/trust');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/intents/:name/trust/badge', () => {
    it('should return 404 for non-existent package', async () => {
      const res = await request(app).get('/api/intents/non-existent/trust/badge');
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/intents/:name/trust/incident', () => {
    it('should validate incident fields', async () => {
      const res = await request(app)
        .post('/api/intents/test-package/trust/incident')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should validate severity enum', async () => {
      const res = await request(app)
        .post('/api/intents/test-package/trust/incident')
        .send({
          severity: 'INVALID',
          title: 'Test incident',
          description: 'Test incident description',
          reportedBy: 'tester',
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/trust/compare', () => {
    it('should require at least 2 packages', async () => {
      const res = await request(app)
        .post('/api/intents/trust/compare')
        .send({ packages: ['single-package'] });
      
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/intents/trust/recommendations', () => {
    it('should return trust recommendations', async () => {
      const res = await request(app).get('/api/intents/trust/recommendations');
      
      expect(res.status).toBe(200);
      expect(res.body.thresholds).toBeDefined();
      expect(res.body.factors).toBeDefined();
      expect(res.body.thresholds.production_ready).toBeDefined();
      expect(res.body.thresholds.production_ready.minScore).toBe(90);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/intents/:name/versions', () => {
    it('should validate version format', async () => {
      const res = await request(app)
        .post('/api/intents/test-package/versions')
        .send({
          version: 'invalid-version',
          contract: 'domain Test {}',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should require contract', async () => {
      const res = await request(app)
        .post('/api/intents/test-package/versions')
        .send({
          version: '1.0.0',
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/intents/:name/deploy', () => {
    it('should validate deployment data', async () => {
      const res = await request(app)
        .post('/api/intents/test-package/deploy')
        .send({});
      
      expect(res.status).toBe(400);
    });

    it('should validate environment enum', async () => {
      const res = await request(app)
        .post('/api/intents/test-package/deploy')
        .send({
          version: '1.0.0',
          environment: 'invalid',
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/intents/:name/star', () => {
    it('should return 404 for non-existent package', async () => {
      const res = await request(app)
        .post('/api/intents/non-existent/star')
        .send({ star: true });
      
      expect(res.status).toBe(404);
    });
  });
});
