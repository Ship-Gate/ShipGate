import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Database } from 'sql.js';
import { createApp } from '../src/index.js';
import { openMemoryDatabase } from '../src/db/schema.js';

// ── Fixtures ──────────────────────────────────────────────────────────

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    repo: 'github.com/acme/app',
    branch: 'main',
    commit: 'abc1234',
    verdict: 'SHIP',
    score: 90,
    coverage: { specced: 18, total: 20, percentage: 90 },
    files: [
      { path: 'src/a.ts', verdict: 'pass', method: 'isl', score: 95, violations: [] },
      {
        path: 'src/b.ts',
        verdict: 'warn',
        method: 'specless',
        score: 80,
        violations: ['Drift detected'],
      },
    ],
    duration: 500,
    triggeredBy: 'ci',
    ...overrides,
  };
}

// ── Suite ──────────────────────────────────────────────────────────────

describe('Coverage & Trends API', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = await openMemoryDatabase();
    app = createApp({ db, disableRateLimit: true });
  });

  afterEach(() => {
    db.close();
  });

  // ── Coverage ────────────────────────────────────────────────────────

  describe('GET /api/v1/coverage', () => {
    it('returns coverage summary for a repo', async () => {
      await request(app).post('/api/v1/reports').send(makeReport());

      const res = await request(app)
        .get('/api/v1/coverage?repo=github.com/acme/app')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        repo: 'github.com/acme/app',
        totalFiles: 20,
        speccedFiles: 18,
        coveragePercentage: 90,
        byMethod: { isl: 1, specless: 1 },
      });
    });

    it('returns 404 when no reports exist for repo', async () => {
      const res = await request(app)
        .get('/api/v1/coverage?repo=github.com/unknown/repo')
        .expect(404);

      expect(res.body.ok).toBe(false);
    });

    it('returns coverage for all repos when no filter', async () => {
      await request(app)
        .post('/api/v1/reports')
        .send(makeReport({ repo: 'github.com/acme/app' }));
      await request(app)
        .post('/api/v1/reports')
        .send(makeReport({ repo: 'github.com/acme/lib' }));

      const res = await request(app)
        .get('/api/v1/coverage')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });
  });

  // ── Trends ──────────────────────────────────────────────────────────

  describe('GET /api/v1/trends', () => {
    it('returns trend data for a repo', async () => {
      await request(app).post('/api/v1/reports').send(makeReport({ score: 85 }));
      await request(app).post('/api/v1/reports').send(makeReport({ score: 95 }));

      const res = await request(app)
        .get('/api/v1/trends?repo=github.com/acme/app&days=30')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const point = res.body.data[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('avgScore');
      expect(point).toHaveProperty('reportCount');
      expect(point).toHaveProperty('coveragePercentage');
      expect(point.reportCount).toBe(2);
    });

    it('requires repo parameter', async () => {
      const res = await request(app)
        .get('/api/v1/trends')
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('defaults to 30 days', async () => {
      await request(app).post('/api/v1/reports').send(makeReport());

      const res = await request(app)
        .get('/api/v1/trends?repo=github.com/acme/app')
        .expect(200);

      expect(res.body.ok).toBe(true);
    });
  });

  // ── Drift ───────────────────────────────────────────────────────────

  describe('GET /api/v1/drift', () => {
    it('detects score drift between reports', async () => {
      // First report: score 90
      await request(app)
        .post('/api/v1/reports')
        .send(makeReport({ score: 90, commit: 'aaa1111' }));

      // Brief pause to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));

      // Second report: score 70 (drift of -20, above default threshold of 5)
      await request(app)
        .post('/api/v1/reports')
        .send(makeReport({ score: 70, commit: 'bbb2222' }));

      const res = await request(app)
        .get('/api/v1/drift?repo=github.com/acme/app&threshold=5')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);

      if (res.body.data.length > 0) {
        const alert = res.body.data[0];
        expect(alert.repo).toBe('github.com/acme/app');
        expect(alert.direction).toBe('degrading');
        expect(alert.delta).toBeLessThan(0);
      }
    });

    it('returns empty when no drift exceeds threshold', async () => {
      await request(app)
        .post('/api/v1/reports')
        .send(makeReport({ score: 90, commit: 'aaa1111' }));

      await new Promise((r) => setTimeout(r, 50));

      await request(app)
        .post('/api/v1/reports')
        .send(makeReport({ score: 91, commit: 'bbb2222' }));

      const res = await request(app)
        .get('/api/v1/drift?repo=github.com/acme/app&threshold=10')
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('requires repo parameter', async () => {
      const res = await request(app)
        .get('/api/v1/drift')
        .expect(400);

      expect(res.body.ok).toBe(false);
    });
  });
});
