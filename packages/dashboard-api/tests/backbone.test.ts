/**
 * Backbone API tests — Agent 16 acceptance criteria:
 *   1. Can store a run and retrieve it.
 *   2. Proof bundle metadata links cleanly to stored artifacts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Database } from 'sql.js';
import { openMemoryDatabase } from '../src/db/schema.js';
import { createApp } from '../src/index.js';

let db: Database;
let app: Express;

beforeAll(async () => {
  db = await openMemoryDatabase();
  app = createApp({ db, disableRateLimit: true, disableAudit: true });
});

afterAll(() => {
  db.close();
});

// ── Helpers ──────────────────────────────────────────────────────────────

async function createTestOrg(name = 'test-org') {
  const res = await request(app)
    .post('/api/v1/backbone/orgs')
    .send({ name })
    .expect(201);
  return res.body.data;
}

async function createTestProject(orgId: string, name = 'test-project') {
  const res = await request(app)
    .post('/api/v1/backbone/projects')
    .send({ orgId, name })
    .expect(201);
  return res.body.data;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Backbone API — Orgs', () => {
  it('creates an org and retrieves it', async () => {
    const org = await createTestOrg('org-crud');
    expect(org.id).toBeDefined();
    expect(org.name).toBe('org-crud');

    const res = await request(app)
      .get(`/api/v1/backbone/orgs/${org.id}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.name).toBe('org-crud');
  });

  it('rejects duplicate org names', async () => {
    await createTestOrg('dup-org');
    await request(app)
      .post('/api/v1/backbone/orgs')
      .send({ name: 'dup-org' })
      .expect(409);
  });

  it('lists orgs', async () => {
    const res = await request(app).get('/api/v1/backbone/orgs').expect(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Backbone API — Projects', () => {
  it('creates a project under an org', async () => {
    const org = await createTestOrg('proj-org');
    const proj = await createTestProject(org.id, 'my-service');

    expect(proj.id).toBeDefined();
    expect(proj.orgId).toBe(org.id);
    expect(proj.name).toBe('my-service');
  });

  it('rejects project creation for non-existent org', async () => {
    await request(app)
      .post('/api/v1/backbone/projects')
      .send({ orgId: '00000000-0000-0000-0000-000000000000', name: 'ghost' })
      .expect(404);
  });

  it('retrieves a project by id', async () => {
    const org = await createTestOrg('proj-get-org');
    const proj = await createTestProject(org.id, 'get-proj');

    const res = await request(app)
      .get(`/api/v1/backbone/projects/${proj.id}`)
      .expect(200);

    expect(res.body.data.name).toBe('get-proj');
  });

  it('lists projects filtered by orgId', async () => {
    const org = await createTestOrg('proj-list-org');
    await createTestProject(org.id, 'alpha');
    await createTestProject(org.id, 'beta');

    const res = await request(app)
      .get(`/api/v1/backbone/projects?orgId=${org.id}`)
      .expect(200);

    expect(res.body.data.length).toBe(2);
  });
});

describe('Backbone API — Runs (acceptance: store & retrieve)', () => {
  it('submits a run with artifacts + verdict and retrieves it', async () => {
    const org = await createTestOrg('run-org');
    const proj = await createTestProject(org.id, 'run-proj');

    // Submit a run
    const submitRes = await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        commitSha: 'abc123',
        branch: 'main',
        trigger: 'ci',
        artifacts: [
          {
            kind: 'proof_bundle',
            path: '/evidence/bundle.json',
            sha256: 'deadbeef',
            sizeBytes: 4096,
            meta: { format: 'shipgate-v1', specCount: 12 },
          },
          {
            kind: 'isl_spec',
            path: '/specs/auth.isl',
            sha256: 'cafebabe',
            sizeBytes: 1024,
          },
          {
            kind: 'coverage_report',
            path: '/reports/coverage.json',
          },
        ],
        verdict: {
          verdict: 'SHIP',
          score: 97.5,
          reason: 'All specs passed',
          ruleIds: ['rule-auth-001', 'rule-payments-002'],
        },
        meta: { ciProvider: 'github-actions', runNumber: 42 },
      })
      .expect(201);

    const run = submitRes.body.data;
    expect(run.id).toBeDefined();
    expect(run.projectId).toBe(proj.id);
    expect(run.status).toBe('completed');
    expect(run.artifacts).toHaveLength(3);
    expect(run.verdict).toBeDefined();
    expect(run.verdict.verdict).toBe('SHIP');
    expect(run.verdict.score).toBe(97.5);

    // Retrieve the same run by ID
    const getRes = await request(app)
      .get(`/api/v1/backbone/runs/${run.id}`)
      .expect(200);

    const retrieved = getRes.body.data;
    expect(retrieved.id).toBe(run.id);
    expect(retrieved.commitSha).toBe('abc123');
    expect(retrieved.branch).toBe('main');
    expect(retrieved.trigger).toBe('ci');
    expect(retrieved.status).toBe('completed');
    expect(retrieved.artifacts).toHaveLength(3);
    expect(retrieved.verdict.verdict).toBe('SHIP');
    expect(retrieved.verdict.score).toBe(97.5);
    expect(retrieved.verdict.ruleIds).toEqual(['rule-auth-001', 'rule-payments-002']);
    expect(retrieved.meta).toEqual({ ciProvider: 'github-actions', runNumber: 42 });
  });

  it('submits a run without a verdict (pending)', async () => {
    const org = await createTestOrg('pending-run-org');
    const proj = await createTestProject(org.id, 'pending-proj');

    const res = await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        trigger: 'manual',
      })
      .expect(201);

    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.verdict).toBeNull();
    expect(res.body.data.artifacts).toHaveLength(0);
  });

  it('rejects run for non-existent project', async () => {
    await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: '00000000-0000-0000-0000-000000000000',
        trigger: 'ci',
      })
      .expect(404);
  });

  it('lists runs with pagination', async () => {
    const org = await createTestOrg('list-runs-org');
    const proj = await createTestProject(org.id, 'list-runs-proj');

    // Submit 3 runs
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/backbone/runs')
        .send({ projectId: proj.id, trigger: 'ci', branch: `branch-${i}` })
        .expect(201);
    }

    const res = await request(app)
      .get(`/api/v1/backbone/runs?projectId=${proj.id}&limit=2&page=1`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

describe('Backbone API — Proof bundle metadata links to artifacts', () => {
  it('proof bundle artifact metadata is stored and retrievable via run', async () => {
    const org = await createTestOrg('proof-org');
    const proj = await createTestProject(org.id, 'proof-proj');

    const proofMeta = {
      format: 'shipgate-proof-v2',
      specCount: 8,
      passCount: 7,
      failCount: 1,
      islVersion: '1.0.0',
      evaluatorHash: 'sha256:abcdef123456',
    };

    const submitRes = await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        commitSha: 'proof-commit-sha',
        branch: 'main',
        trigger: 'ci',
        artifacts: [
          {
            kind: 'proof_bundle',
            path: '/evidence/proof-bundle.json',
            sha256: 'proof-sha256-hash',
            sizeBytes: 8192,
            meta: proofMeta,
          },
        ],
        verdict: {
          verdict: 'WARN',
          score: 87.5,
          reason: '1 spec failed',
          ruleIds: ['rule-auth-003'],
        },
      })
      .expect(201);

    const runId = submitRes.body.data.id;

    // Fetch artifacts for the run
    const artifactsRes = await request(app)
      .get(`/api/v1/backbone/runs/${runId}/artifacts`)
      .expect(200);

    expect(artifactsRes.body.data).toHaveLength(1);
    const proofArtifact = artifactsRes.body.data[0];
    expect(proofArtifact.kind).toBe('proof_bundle');
    expect(proofArtifact.path).toBe('/evidence/proof-bundle.json');
    expect(proofArtifact.sha256).toBe('proof-sha256-hash');
    expect(proofArtifact.sizeBytes).toBe(8192);
    expect(proofArtifact.meta).toEqual(proofMeta);
    expect(proofArtifact.runId).toBe(runId);

    // Fetch individual artifact by ID
    const singleRes = await request(app)
      .get(`/api/v1/backbone/artifacts/${proofArtifact.id}`)
      .expect(200);

    expect(singleRes.body.data.id).toBe(proofArtifact.id);
    expect(singleRes.body.data.meta).toEqual(proofMeta);
  });

  it('multiple artifact kinds are stored correctly per run', async () => {
    const org = await createTestOrg('multi-art-org');
    const proj = await createTestProject(org.id, 'multi-art-proj');

    const submitRes = await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        trigger: 'cli',
        artifacts: [
          { kind: 'proof_bundle', path: '/proof.json', meta: { type: 'proof' } },
          { kind: 'isl_spec', path: '/spec.isl' },
          { kind: 'log', path: '/run.log', sizeBytes: 256 },
          { kind: 'coverage_report', path: '/cov.json' },
          { kind: 'other', path: '/extra.txt' },
        ],
      })
      .expect(201);

    const runId = submitRes.body.data.id;
    const artRes = await request(app)
      .get(`/api/v1/backbone/runs/${runId}/artifacts`)
      .expect(200);

    expect(artRes.body.data).toHaveLength(5);
    const kinds = artRes.body.data.map((a: { kind: string }) => a.kind);
    expect(kinds).toContain('proof_bundle');
    expect(kinds).toContain('isl_spec');
    expect(kinds).toContain('log');
    expect(kinds).toContain('coverage_report');
    expect(kinds).toContain('other');
  });
});

describe('Backbone API — Latest verdict', () => {
  it('fetches the latest verdict for a project', async () => {
    const org = await createTestOrg('verdict-org');
    const proj = await createTestProject(org.id, 'verdict-proj');

    // Submit two runs with verdicts
    await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        trigger: 'ci',
        verdict: { verdict: 'NO_SHIP', score: 40, reason: 'Old run' },
      })
      .expect(201);

    // Small delay so timestamps differ
    await new Promise((r) => setTimeout(r, 10));

    await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        trigger: 'ci',
        verdict: { verdict: 'SHIP', score: 99, reason: 'Latest run' },
      })
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/backbone/projects/${proj.id}/verdict`)
      .expect(200);

    expect(res.body.data.verdict).toBe('SHIP');
    expect(res.body.data.score).toBe(99);
    expect(res.body.data.reason).toBe('Latest run');
    expect(res.body.data.run).toBeDefined();
    expect(res.body.data.run.projectId).toBe(proj.id);
  });

  it('returns 404 when no verdicts exist', async () => {
    const org = await createTestOrg('no-verdict-org');
    const proj = await createTestProject(org.id, 'no-verdict-proj');

    await request(app)
      .get(`/api/v1/backbone/projects/${proj.id}/verdict`)
      .expect(404);
  });
});

describe('Backbone API — Validation', () => {
  it('rejects invalid trigger value', async () => {
    const org = await createTestOrg('val-org');
    const proj = await createTestProject(org.id, 'val-proj');

    await request(app)
      .post('/api/v1/backbone/runs')
      .send({ projectId: proj.id, trigger: 'invalid' })
      .expect(400);
  });

  it('rejects invalid verdict value', async () => {
    const org = await createTestOrg('val-verdict-org');
    const proj = await createTestProject(org.id, 'val-verdict-proj');

    await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        trigger: 'ci',
        verdict: { verdict: 'MAYBE', score: 50 },
      })
      .expect(400);
  });

  it('rejects score out of range', async () => {
    const org = await createTestOrg('val-score-org');
    const proj = await createTestProject(org.id, 'val-score-proj');

    await request(app)
      .post('/api/v1/backbone/runs')
      .send({
        projectId: proj.id,
        trigger: 'ci',
        verdict: { verdict: 'SHIP', score: 150 },
      })
      .expect(400);
  });

  it('rejects empty org name', async () => {
    await request(app)
      .post('/api/v1/backbone/orgs')
      .send({ name: '' })
      .expect(400);
  });

  it('rejects project with missing orgId', async () => {
    await request(app)
      .post('/api/v1/backbone/projects')
      .send({ name: 'no-org' })
      .expect(400);
  });
});

describe('Backbone API — 404s', () => {
  it('returns 404 for non-existent run', async () => {
    await request(app)
      .get('/api/v1/backbone/runs/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('returns 404 for non-existent artifact', async () => {
    await request(app)
      .get('/api/v1/backbone/artifacts/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('returns 404 for non-existent project', async () => {
    await request(app)
      .get('/api/v1/backbone/projects/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
