import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Database } from 'sql.js';
import { createApp } from '../src/index.js';
import { openMemoryDatabase } from '../src/db/schema.js';
import { ensureAuditSchema } from '../src/audit/schema.js';
import { createAuditQueries, computeHash } from '../src/audit/queries.js';
import { createAuditService } from '../src/audit/service.js';
import { auditRecordsToCsv } from '../src/audit/csv.js';
import type { AuditActor, AuditEvent } from '../src/audit/types.js';

// ── Test fixtures ──────────────────────────────────────────────────────

const testActor: AuditActor = {
  id: 'user-001',
  email: 'alice@example.com',
  role: 'admin',
};

const secondActor: AuditActor = {
  id: 'user-002',
  email: 'bob@example.com',
  role: 'developer',
};

function verificationEvent(overrides: Partial<AuditEvent & { type: 'verification_run' }> = {}): AuditEvent {
  return {
    type: 'verification_run',
    verdict: 'SHIP',
    score: 92,
    repo: 'github.com/acme/app',
    commit: 'abc1234',
    ...overrides,
  };
}

// ── Query layer tests ──────────────────────────────────────────────────

describe('Audit Queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = await openMemoryDatabase();
    ensureAuditSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('appendAuditRecord', () => {
    it('inserts a record and returns it', () => {
      const queries = createAuditQueries(db);
      const record = queries.appendAuditRecord(
        verificationEvent(),
        testActor,
        { extra: 'data' },
        '192.168.1.1',
      );

      expect(record.id).toBeDefined();
      expect(record.timestamp).toBeDefined();
      expect(record.event.type).toBe('verification_run');
      expect(record.actor.id).toBe('user-001');
      expect(record.metadata).toEqual({ extra: 'data' });
      expect(record.ip).toBe('192.168.1.1');
      expect(record.hash).toBeDefined();
      expect(record.hash).toHaveLength(64); // SHA-256 hex
      expect(record.previousHash).toHaveLength(64);
    });

    it('builds a hash chain across multiple records', () => {
      const queries = createAuditQueries(db);

      const first = queries.appendAuditRecord(verificationEvent(), testActor);
      const second = queries.appendAuditRecord(
        { type: 'gate_bypass', repo: 'r', commit: 'c', reason: 'hotfix', approver: 'alice' },
        testActor,
      );
      const third = queries.appendAuditRecord(
        { type: 'config_changed', field: 'threshold', oldValue: '80', newValue: '90', author: 'alice' },
        testActor,
      );

      // First record chains from genesis
      expect(first.previousHash).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000',
      );

      // Second record chains from first
      expect(second.previousHash).toBe(first.hash);

      // Third record chains from second
      expect(third.previousHash).toBe(second.hash);
    });

    it('computes hash correctly: sha256(previousHash + eventData)', () => {
      const queries = createAuditQueries(db);
      const event = verificationEvent();
      const record = queries.appendAuditRecord(event, testActor);

      const expectedHash = computeHash(record.previousHash, JSON.stringify(event));
      expect(record.hash).toBe(expectedHash);
    });
  });

  describe('listAuditRecords', () => {
    it('returns paginated results', () => {
      const queries = createAuditQueries(db);

      for (let i = 0; i < 5; i++) {
        queries.appendAuditRecord(
          verificationEvent({ score: 80 + i }),
          testActor,
        );
      }

      const result = queries.listAuditRecords({ page: 1, limit: 2 });
      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('filters by event type', () => {
      const queries = createAuditQueries(db);

      queries.appendAuditRecord(verificationEvent(), testActor);
      queries.appendAuditRecord(
        { type: 'gate_bypass', repo: 'r', commit: 'c', reason: 'hotfix', approver: 'alice' },
        testActor,
      );

      const result = queries.listAuditRecords({
        type: 'gate_bypass',
        page: 1,
        limit: 20,
      });
      expect(result.records).toHaveLength(1);
      expect(result.records[0]!.event.type).toBe('gate_bypass');
    });

    it('filters by actor', () => {
      const queries = createAuditQueries(db);

      queries.appendAuditRecord(verificationEvent(), testActor);
      queries.appendAuditRecord(verificationEvent(), secondActor);

      const result = queries.listAuditRecords({
        actor: 'user-002',
        page: 1,
        limit: 20,
      });
      expect(result.records).toHaveLength(1);
      expect(result.records[0]!.actor.email).toBe('bob@example.com');
    });

    it('returns newest first', () => {
      const queries = createAuditQueries(db);

      queries.appendAuditRecord(verificationEvent({ score: 80 }), testActor);
      queries.appendAuditRecord(verificationEvent({ score: 95 }), testActor);

      const result = queries.listAuditRecords({ page: 1, limit: 20 });
      const event0 = result.records[0]!.event as { type: 'verification_run'; score: number };
      const event1 = result.records[1]!.event as { type: 'verification_run'; score: number };
      // Newest first — the second insert (score 95) should be first
      expect(event0.score).toBe(95);
      expect(event1.score).toBe(80);
    });
  });

  describe('getAuditRecord', () => {
    it('returns a record by id', () => {
      const queries = createAuditQueries(db);
      const created = queries.appendAuditRecord(verificationEvent(), testActor);

      const found = queries.getAuditRecord(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.hash).toBe(created.hash);
    });

    it('returns undefined for unknown id', () => {
      const queries = createAuditQueries(db);
      expect(queries.getAuditRecord('nonexistent')).toBeUndefined();
    });
  });

  describe('verifyHashChain', () => {
    it('validates an intact chain', () => {
      const queries = createAuditQueries(db);

      queries.appendAuditRecord(verificationEvent(), testActor);
      queries.appendAuditRecord(
        { type: 'gate_bypass', repo: 'r', commit: 'c', reason: 'hotfix', approver: 'a' },
        testActor,
      );
      queries.appendAuditRecord(verificationEvent({ score: 50 }), testActor);

      const result = queries.verifyHashChain();
      expect(result.valid).toBe(true);
      expect(result.brokenAtId).toBeUndefined();
    });

    it('detects a tampered record', () => {
      const queries = createAuditQueries(db);

      queries.appendAuditRecord(verificationEvent(), testActor);
      const second = queries.appendAuditRecord(verificationEvent({ score: 50 }), testActor);
      queries.appendAuditRecord(verificationEvent({ score: 60 }), testActor);

      // Tamper with the second record's event_data directly in SQLite
      db.run(
        `UPDATE audit_log SET event_data = '{"type":"verification_run","verdict":"TAMPERED","score":99,"repo":"x","commit":"y"}'
         WHERE id = '${second.id}'`,
      );

      const result = queries.verifyHashChain();
      expect(result.valid).toBe(false);
      expect(result.brokenAtId).toBe(second.id);
    });

    it('returns valid for an empty table', () => {
      const queries = createAuditQueries(db);
      const result = queries.verifyHashChain();
      expect(result.valid).toBe(true);
    });
  });

  describe('exportAuditRecords', () => {
    it('returns all matching records without pagination', () => {
      const queries = createAuditQueries(db);

      for (let i = 0; i < 25; i++) {
        queries.appendAuditRecord(verificationEvent({ score: i }), testActor);
      }

      const records = queries.exportAuditRecords({});
      expect(records).toHaveLength(25);
    });

    it('returns records in chronological order (oldest first)', () => {
      const queries = createAuditQueries(db);

      queries.appendAuditRecord(verificationEvent({ score: 10 }), testActor);
      queries.appendAuditRecord(verificationEvent({ score: 20 }), testActor);

      const records = queries.exportAuditRecords({});
      const event0 = records[0]!.event as { type: 'verification_run'; score: number };
      const event1 = records[1]!.event as { type: 'verification_run'; score: number };
      expect(event0.score).toBe(10);
      expect(event1.score).toBe(20);
    });
  });
});

// ── Service tests ──────────────────────────────────────────────────────

describe('Audit Service', () => {
  let db: Database;

  beforeEach(async () => {
    db = await openMemoryDatabase();
    ensureAuditSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('auditVerification logs a verification event', () => {
    const queries = createAuditQueries(db);
    const service = createAuditService(queries);

    const record = service.auditVerification(
      { verdict: 'SHIP', score: 95 },
      { repo: 'github.com/acme/app', commit: 'abc', actor: testActor, ip: '10.0.0.1' },
    );

    expect(record.event.type).toBe('verification_run');
    expect(record.ip).toBe('10.0.0.1');

    const found = queries.getAuditRecord(record.id);
    expect(found).toBeDefined();
  });

  it('auditGateBypass logs a bypass event', () => {
    const queries = createAuditQueries(db);
    const service = createAuditService(queries);

    const record = service.auditGateBypass(
      { repo: 'r', commit: 'c', reason: 'hotfix', approver: 'alice' },
      testActor,
    );

    expect(record.event.type).toBe('gate_bypass');
  });

  it('auditConfigChange logs a config change', () => {
    const queries = createAuditQueries(db);
    const service = createAuditService(queries);

    const record = service.auditConfigChange(
      { field: 'threshold', oldValue: '80', newValue: '90', author: 'alice' },
      testActor,
    );

    expect(record.event.type).toBe('config_changed');
  });

  it('auditApiKeyCreated only logs the key name, not the value', () => {
    const queries = createAuditQueries(db);
    const service = createAuditService(queries);

    const record = service.auditApiKeyCreated(
      { userId: 'user-001', keyName: 'production-key' },
      testActor,
    );

    expect(record.event.type).toBe('api_key_created');
    const eventStr = JSON.stringify(record.event);
    expect(eventStr).not.toContain('sk_live_'); // no actual key values
    expect(eventStr).toContain('production-key'); // key name is present
  });
});

// ── CSV export tests ───────────────────────────────────────────────────

describe('CSV Export', () => {
  let db: Database;

  beforeEach(async () => {
    db = await openMemoryDatabase();
    ensureAuditSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('produces valid CSV with headers', () => {
    const queries = createAuditQueries(db);
    queries.appendAuditRecord(verificationEvent(), testActor);

    const records = queries.exportAuditRecords({});
    const csv = auditRecordsToCsv(records);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'id,timestamp,event_type,actor_id,actor_email,actor_role,ip,hash,previous_hash,event_data,metadata',
    );
    expect(lines).toHaveLength(2); // header + 1 record
  });

  it('includes hash chain in CSV for offline verification', () => {
    const queries = createAuditQueries(db);
    queries.appendAuditRecord(verificationEvent(), testActor);
    queries.appendAuditRecord(verificationEvent({ score: 50 }), testActor);

    const records = queries.exportAuditRecords({});
    const csv = auditRecordsToCsv(records);

    // Hash and previous_hash columns are present
    expect(csv).toContain('hash');
    expect(csv).toContain('previous_hash');
    // Two data rows
    expect(csv.split('\n')).toHaveLength(3);
  });

  it('escapes commas and quotes in CSV fields', () => {
    const queries = createAuditQueries(db);
    queries.appendAuditRecord(
      { type: 'spec_modified', file: 'auth.isl', repo: 'r', author: 'a', diff: 'added "rule", removed line' },
      testActor,
    );

    const records = queries.exportAuditRecords({});
    const csv = auditRecordsToCsv(records);

    // The event_data column should be properly escaped
    expect(csv).toContain('""'); // escaped quotes
  });

  it('returns only headers for empty dataset', () => {
    const csv = auditRecordsToCsv([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('id');
  });
});

// ── API route tests ────────────────────────────────────────────────────

describe('Audit API Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = await openMemoryDatabase();
    app = createApp({ db, disableRateLimit: true });
  });

  afterEach(() => {
    db.close();
  });

  // Helper to seed audit records via the audit queries
  function seedAudit(count: number, eventType: AuditEvent['type'] = 'verification_run') {
    ensureAuditSchema(db);
    const queries = createAuditQueries(db);
    for (let i = 0; i < count; i++) {
      if (eventType === 'verification_run') {
        queries.appendAuditRecord(verificationEvent({ score: 70 + i }), testActor);
      } else if (eventType === 'gate_bypass') {
        queries.appendAuditRecord(
          { type: 'gate_bypass', repo: 'r', commit: `c${i}`, reason: 'hotfix', approver: 'alice' },
          testActor,
        );
      }
    }
    return queries;
  }

  describe('GET /api/v1/audit', () => {
    it('returns paginated audit records', async () => {
      seedAudit(5);

      const res = await request(app)
        .get('/api/v1/audit?page=1&limit=2')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('filters by event type', async () => {
      seedAudit(3, 'verification_run');
      const queries = createAuditQueries(db);
      queries.appendAuditRecord(
        { type: 'gate_bypass', repo: 'r', commit: 'c', reason: 'hotfix', approver: 'a' },
        testActor,
      );

      const res = await request(app)
        .get('/api/v1/audit?type=gate_bypass')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].event.type).toBe('gate_bypass');
    });

    it('filters by actor', async () => {
      ensureAuditSchema(db);
      const queries = createAuditQueries(db);
      queries.appendAuditRecord(verificationEvent(), testActor);
      queries.appendAuditRecord(verificationEvent(), secondActor);

      const res = await request(app)
        .get('/api/v1/audit?actor=user-002')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].actor.id).toBe('user-002');
    });

    it('defaults to page 1, limit 20', async () => {
      seedAudit(0);

      const res = await request(app)
        .get('/api/v1/audit')
        .expect(200);

      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
    });
  });

  describe('GET /api/v1/audit/export', () => {
    it('returns CSV with correct content-type', async () => {
      seedAudit(3);

      const res = await request(app)
        .get('/api/v1/audit/export')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('audit-log.csv');

      const lines = res.text.split('\n');
      expect(lines[0]).toContain('id,timestamp,event_type');
      expect(lines).toHaveLength(4); // header + 3 records
    });

    it('filters export by type', async () => {
      seedAudit(2, 'verification_run');
      const queries = createAuditQueries(db);
      queries.appendAuditRecord(
        { type: 'gate_bypass', repo: 'r', commit: 'c', reason: 'hotfix', approver: 'a' },
        testActor,
      );

      const res = await request(app)
        .get('/api/v1/audit/export?type=gate_bypass')
        .expect(200);

      const lines = res.text.split('\n');
      expect(lines).toHaveLength(2); // header + 1 bypass record
    });
  });

  describe('GET /api/v1/audit/verify', () => {
    it('returns valid for intact chain', async () => {
      seedAudit(5);

      const res = await request(app)
        .get('/api/v1/audit/verify')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });

    it('detects tampered records', async () => {
      seedAudit(3);

      // Tamper with a record directly
      db.run(
        `UPDATE audit_log SET event_data = '{"type":"verification_run","verdict":"TAMPERED","score":0,"repo":"x","commit":"y"}'
         WHERE rowid = 2`,
      );

      const res = await request(app)
        .get('/api/v1/audit/verify')
        .expect(200);

      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.brokenAtId).toBeDefined();
    });
  });

  describe('GET /api/v1/audit/:id', () => {
    it('returns a single audit record', async () => {
      ensureAuditSchema(db);
      const queries = createAuditQueries(db);
      const created = queries.appendAuditRecord(verificationEvent(), testActor);

      const res = await request(app)
        .get(`/api/v1/audit/${created.id}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(created.id);
      expect(res.body.data.hash).toBe(created.hash);
    });

    it('returns 404 for unknown id', async () => {
      ensureAuditSchema(db);

      const res = await request(app)
        .get('/api/v1/audit/nonexistent-uuid')
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('Append-only enforcement', () => {
    it('has no DELETE endpoint', async () => {
      ensureAuditSchema(db);
      const queries = createAuditQueries(db);
      const created = queries.appendAuditRecord(verificationEvent(), testActor);

      const res = await request(app)
        .delete(`/api/v1/audit/${created.id}`)
        .expect(404);

      expect(res.body.ok).toBe(false);

      // Record still exists
      const found = queries.getAuditRecord(created.id);
      expect(found).toBeDefined();
    });

    it('has no PUT/PATCH endpoint', async () => {
      ensureAuditSchema(db);
      const queries = createAuditQueries(db);
      const created = queries.appendAuditRecord(verificationEvent(), testActor);

      await request(app)
        .put(`/api/v1/audit/${created.id}`)
        .send({ event: { type: 'verification_run' } })
        .expect(404);

      await request(app)
        .patch(`/api/v1/audit/${created.id}`)
        .send({ event: { type: 'verification_run' } })
        .expect(404);
    });

    it('has no POST endpoint for creating records via API', async () => {
      ensureAuditSchema(db);

      await request(app)
        .post('/api/v1/audit')
        .send({ event: verificationEvent(), actor: testActor })
        .expect(404);
    });
  });
});

// ── Hash computation tests ─────────────────────────────────────────────

describe('computeHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeHash('0'.repeat(64), '{"test":"data"}');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeHash('0'.repeat(64), '{"a":1}');
    const hash2 = computeHash('0'.repeat(64), '{"a":2}');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different previous hashes', () => {
    const data = '{"test":"same"}';
    const hash1 = computeHash('0'.repeat(64), data);
    const hash2 = computeHash('1'.repeat(64), data);
    expect(hash1).not.toBe(hash2);
  });

  it('is deterministic', () => {
    const prev = 'abcd'.repeat(16);
    const data = '{"type":"test"}';
    const hash1 = computeHash(prev, data);
    const hash2 = computeHash(prev, data);
    expect(hash1).toBe(hash2);
  });
});
