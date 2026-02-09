import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Database } from 'sql.js';
import { createApp } from '../src/index.js';
import { openMemoryDatabase } from '../src/db/schema.js';

// ── Test fixtures ──────────────────────────────────────────────────────

function validReport(overrides: Record<string, unknown> = {}) {
  return {
    repo: 'github.com/acme/app',
    branch: 'main',
    commit: 'abc1234',
    verdict: 'SHIP',
    score: 92,
    coverage: { specced: 18, total: 20, percentage: 90 },
    files: [
      {
        path: 'src/auth.ts',
        verdict: 'pass',
        method: 'isl',
        score: 95,
        violations: [],
      },
      {
        path: 'src/utils.ts',
        verdict: 'warn',
        method: 'specless',
        score: 80,
        violations: ['Missing error handling'],
      },
    ],
    duration: 1234,
    triggeredBy: 'ci',
    ...overrides,
  };
}

// ── Suite ──────────────────────────────────────────────────────────────

describe('Reports API', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = await openMemoryDatabase();
    app = createApp({ db, disableRateLimit: true });
  });

  afterEach(() => {
    db.close();
  });

  // ── POST /api/v1/reports ────────────────────────────────────────────

  describe('POST /api/v1/reports', () => {
    it('creates a report and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send(validReport())
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toMatchObject({
        repo: 'github.com/acme/app',
        branch: 'main',
        verdict: 'SHIP',
        score: 92,
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('accepts optional PR number', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send(validReport({ pr: 42 }))
        .expect(201);

      expect(res.body.data.pr).toBe(42);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send({ repo: 'test' })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeInstanceOf(Array);
    });

    it('rejects invalid verdict', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send(validReport({ verdict: 'MAYBE' }))
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('rejects score out of range', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send(validReport({ score: 150 }))
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('rejects empty files array', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send(validReport({ files: [] }))
        .expect(400);

      expect(res.body.ok).toBe(false);
    });
  });

  // ── GET /api/v1/reports/:id ─────────────────────────────────────────

  describe('GET /api/v1/reports/:id', () => {
    it('returns an existing report', async () => {
      const createRes = await request(app)
        .post('/api/v1/reports')
        .send(validReport());

      const id = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/reports/${id}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.files).toHaveLength(2);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/reports/nonexistent-uuid')
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  // ── GET /api/v1/reports (list) ──────────────────────────────────────

  describe('GET /api/v1/reports', () => {
    it('returns paginated results', async () => {
      // Insert 3 reports
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/reports')
          .send(validReport({ score: 80 + i }));
      }

      const res = await request(app)
        .get('/api/v1/reports?page=1&limit=2')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('filters by repo', async () => {
      await request(app)
        .post('/api/v1/reports')
        .send(validReport({ repo: 'github.com/acme/app' }));
      await request(app)
        .post('/api/v1/reports')
        .send(validReport({ repo: 'github.com/acme/lib' }));

      const res = await request(app)
        .get('/api/v1/reports?repo=github.com/acme/lib')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].repo).toBe('github.com/acme/lib');
    });

    it('filters by verdict', async () => {
      await request(app)
        .post('/api/v1/reports')
        .send(validReport({ verdict: 'SHIP' }));
      await request(app)
        .post('/api/v1/reports')
        .send(validReport({ verdict: 'NO_SHIP', score: 30 }));

      const res = await request(app)
        .get('/api/v1/reports?verdict=NO_SHIP')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].verdict).toBe('NO_SHIP');
    });

    it('defaults to page 1 limit 20', async () => {
      const res = await request(app)
        .get('/api/v1/reports')
        .expect(200);

      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
    });
  });

  // ── Health check ────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns healthy status', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(typeof res.body.data.uptime).toBe('number');
    });
  });

  // ── 404 catch-all ───────────────────────────────────────────────────

  describe('Unknown routes', () => {
    it('returns 404 for unknown paths', async () => {
      const res = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Not found');
    });
  });
});
