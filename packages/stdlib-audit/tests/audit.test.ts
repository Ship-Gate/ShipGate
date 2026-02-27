// ============================================================================
// ISL Standard Library - Audit Tests
// @stdlib/audit/tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Ok,
  Err,
  EventCategory,
  EventOutcome,
  ActorType,
  createEntry,
  AuditTracker,
  InMemoryAuditStore,
  AuditQueryBuilder,
  ComplianceChecker,
  allEntriesHaveHash,
  failedLoginThreshold,
  adminActionsHaveResource,
  dataModificationsHaveChanges,
  securityEventsHaveActor,
  noGapsInAuthEvents,
  SOC2_RULES,
  createRule,
  generateReport,
  AggregationPipeline,
  Aggregator,
  RetentionEnforcer,
  DEFAULT_RETENTION_POLICIES,
} from '../src/index';
import type { AuditEntry, RecordInput, AuditStore } from '../src/index';

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeInput(overrides?: Partial<RecordInput>): RecordInput {
  return {
    action: 'test.action',
    category: EventCategory.DATA_ACCESS,
    outcome: EventOutcome.SUCCESS,
    actor: { id: 'actor-1', type: ActorType.USER },
    source: { service: 'test-service' },
    ...overrides,
  };
}

function makeEntry(overrides?: Partial<AuditEntry>): AuditEntry {
  const result = createEntry(makeInput());
  if (!result.ok) throw new Error('Failed to create entry');
  return { ...result.value, ...overrides } as AuditEntry;
}

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iter) items.push(item);
  return items;
}

// ============================================================================
// RECORD + QUERY TESTS
// ============================================================================

describe('Trail: record + query', () => {
  let store: InMemoryAuditStore;
  let tracker: AuditTracker;

  beforeEach(() => {
    store = new InMemoryAuditStore();
    tracker = new AuditTracker({
      store,
      source: { service: 'test-svc', version: '1.0.0', environment: 'test' },
    });
  });

  describe('createEntry', () => {
    it('should create a valid entry with hash', () => {
      const result = createEntry(makeInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id).toBeDefined();
      expect(result.value.hash).toBeDefined();
      expect(result.value.action).toBe('test.action');
      expect(result.value.category).toBe(EventCategory.DATA_ACCESS);
      expect(result.value.outcome).toBe(EventOutcome.SUCCESS);
      expect(result.value.timestamp).toBeInstanceOf(Date);
    });

    it('should reject empty action', () => {
      const result = createEntry(makeInput({ action: '' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_INPUT');
    });

    it('should reject empty actor id', () => {
      const result = createEntry(makeInput({ actor: { id: '', type: ActorType.USER } }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_INPUT');
    });

    it('should reject future timestamp', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const result = createEntry(makeInput({ timestamp: future }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_TIMESTAMP');
    });

    it('should reject negative duration_ms', () => {
      const result = createEntry(makeInput({ duration_ms: -1 }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_INPUT');
    });

    it('should reject resource without id', () => {
      const result = createEntry(makeInput({ resource: { type: 'doc', id: '' } }));
      expect(result.ok).toBe(false);
    });
  });

  describe('AuditTracker.record', () => {
    it('should record and persist an entry', async () => {
      const result = await tracker.record(makeInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(store.size()).toBe(1);
      expect(result.value.source.service).toBe('test-service');
    });

    it('should detect duplicate idempotency key', async () => {
      const input = makeInput({ idempotency_key: 'key-1' });
      const r1 = await tracker.record(input);
      expect(r1.ok).toBe(true);

      const r2 = await tracker.record(input);
      expect(r2.ok).toBe(false);
      if (r2.ok) return;
      expect(r2.error.code).toBe('DUPLICATE_ENTRY');
    });

    it('should record batch', async () => {
      const inputs = [makeInput({ action: 'a1' }), makeInput({ action: 'a2' })];
      const result = await tracker.recordBatch(inputs);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(store.size()).toBe(2);
    });
  });

  describe('AuditQueryBuilder', () => {
    beforeEach(async () => {
      await tracker.record(makeInput({ action: 'auth.login', category: EventCategory.AUTHENTICATION, actor: { id: 'user-1', type: ActorType.USER } }));
      await tracker.record(makeInput({ action: 'auth.logout', category: EventCategory.AUTHENTICATION, actor: { id: 'user-1', type: ActorType.USER } }));
      await tracker.record(makeInput({ action: 'data.read', category: EventCategory.DATA_ACCESS, actor: { id: 'user-2', type: ActorType.SERVICE } }));
      await tracker.record(makeInput({ action: 'admin.delete', category: EventCategory.ADMIN_ACTION, actor: { id: 'admin-1', type: ActorType.USER }, resource: { type: 'user', id: 'res-1' } }));
      await tracker.record(makeInput({ action: 'data.write', category: EventCategory.DATA_MODIFICATION, outcome: EventOutcome.FAILURE, actor: { id: 'user-2', type: ActorType.SERVICE } }));
    });

    it('should filter by actor', async () => {
      const result = await tracker.query().byActor('user-1').execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
    });

    it('should filter by action', async () => {
      const result = await tracker.query().byAction('auth.login').execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
    });

    it('should filter by action prefix', async () => {
      const result = await tracker.query().byActionPrefix('auth.').execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
    });

    it('should filter by category', async () => {
      const result = await tracker.query().byCategory(EventCategory.AUTHENTICATION).execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
    });

    it('should filter by resource', async () => {
      const result = await tracker.query().byResource('res-1').execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
    });

    it('should filter by outcome', async () => {
      const result = await tracker.query().byOutcome(EventOutcome.FAILURE).execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
    });

    it('should filter by service', async () => {
      const result = await tracker.query().byService('test-service').execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(5);
    });

    it('should apply limit', async () => {
      const result = await tracker.query().limit(2).execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
    });

    it('should count entries', async () => {
      const result = await tracker.query().byCategory(EventCategory.AUTHENTICATION).count();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(2);
    });

    it('should stream results via AsyncIterable', async () => {
      const entries = await collectAsync(tracker.query().byActor('user-2').stream());
      expect(entries).toHaveLength(2);
    });

    it('should reject invalid date range (since > until)', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      const result = await tracker.query().since(now).until(past).execute();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('should filter by since/until', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      const result = await tracker.query().since(past).until(now).execute();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(5);
    });
  });
});

// ============================================================================
// COMPLIANCE TESTS
// ============================================================================

describe('Compliance', () => {
  describe('ComplianceChecker', () => {
    it('should evaluate rules and return results', () => {
      const checker = new ComplianceChecker();
      checker.addRules([allEntriesHaveHash, securityEventsHaveActor]);

      const entries = [makeEntry({ hash: 'abc123', category: EventCategory.SECURITY_EVENT })];
      const result = checker.evaluate(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value.every((r) => r.passed)).toBe(true);
    });

    it('should detect missing hashes', () => {
      const checker = new ComplianceChecker();
      checker.addRule(allEntriesHaveHash);

      const entries = [makeEntry({ hash: undefined })];
      const result = checker.evaluate(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value[0]?.passed).toBe(false);
    });

    it('should check isCompliant', () => {
      const checker = new ComplianceChecker();
      checker.addRule(allEntriesHaveHash);

      const entries = [makeEntry({ hash: 'abc' })];
      const result = checker.isCompliant(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(true);
    });

    it('should remove rules', () => {
      const checker = new ComplianceChecker();
      checker.addRules([allEntriesHaveHash, securityEventsHaveActor]);
      checker.removeRule('INTEGRITY_HASH');
      expect(checker.getRules()).toHaveLength(1);
    });
  });

  describe('Built-in rules', () => {
    it('failedLoginThreshold: pass when rate < 20%', () => {
      const entries = [
        ...Array.from({ length: 9 }, () => makeEntry({ category: EventCategory.AUTHENTICATION, outcome: EventOutcome.SUCCESS })),
        makeEntry({ category: EventCategory.AUTHENTICATION, outcome: EventOutcome.FAILURE }),
      ];
      const result = failedLoginThreshold.evaluate(entries);
      expect(result.passed).toBe(true);
    });

    it('failedLoginThreshold: fail when rate > 20%', () => {
      const entries = [
        ...Array.from({ length: 3 }, () => makeEntry({ category: EventCategory.AUTHENTICATION, outcome: EventOutcome.SUCCESS })),
        ...Array.from({ length: 3 }, () => makeEntry({ category: EventCategory.AUTHENTICATION, outcome: EventOutcome.FAILURE })),
      ];
      const result = failedLoginThreshold.evaluate(entries);
      expect(result.passed).toBe(false);
    });

    it('adminActionsHaveResource: fail when resource missing', () => {
      const entries = [makeEntry({ category: EventCategory.ADMIN_ACTION, resource: undefined })];
      const result = adminActionsHaveResource.evaluate(entries);
      expect(result.passed).toBe(false);
    });

    it('dataModificationsHaveChanges: fail when changes missing', () => {
      const entries = [makeEntry({ category: EventCategory.DATA_MODIFICATION, changes: undefined })];
      const result = dataModificationsHaveChanges.evaluate(entries);
      expect(result.passed).toBe(false);
    });

    it('noGapsInAuthEvents: pass with close events', () => {
      const now = Date.now();
      const entries = [
        makeEntry({ category: EventCategory.AUTHENTICATION, timestamp: new Date(now - 3600000) }),
        makeEntry({ category: EventCategory.AUTHENTICATION, timestamp: new Date(now) }),
      ];
      const result = noGapsInAuthEvents.evaluate(entries);
      expect(result.passed).toBe(true);
    });

    it('noGapsInAuthEvents: fail with 25h gap', () => {
      const now = Date.now();
      const entries = [
        makeEntry({ category: EventCategory.AUTHENTICATION, timestamp: new Date(now - 25 * 3600000) }),
        makeEntry({ category: EventCategory.AUTHENTICATION, timestamp: new Date(now) }),
      ];
      const result = noGapsInAuthEvents.evaluate(entries);
      expect(result.passed).toBe(false);
    });

    it('createRule: custom rule works', () => {
      const rule = createRule({
        id: 'CUSTOM_1',
        name: 'Custom Rule',
        description: 'Test',
        severity: 'low',
        check: (entries) => ({
          passed: entries.length > 0,
          message: entries.length > 0 ? 'OK' : 'No entries',
        }),
      });
      expect(rule.evaluate([makeEntry()]).passed).toBe(true);
      expect(rule.evaluate([]).passed).toBe(false);
    });
  });

  describe('Report generation', () => {
    it('should generate a compliance report', () => {
      const entries = [
        makeEntry({ hash: 'abc', category: EventCategory.SECURITY_EVENT }),
        makeEntry({ hash: 'def', category: EventCategory.AUTHENTICATION }),
      ];
      const result = generateReport(entries, SOC2_RULES, { standard: 'SOC2' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.standard).toBe('SOC2');
      expect(result.value.entries_evaluated).toBe(2);
      expect(result.value.summary.total_rules).toBe(SOC2_RULES.length);
    });

    it('should fail with empty entries', () => {
      const result = generateReport([], SOC2_RULES);
      expect(result.ok).toBe(false);
    });
  });
});

// ============================================================================
// AGGREGATION TESTS
// ============================================================================

describe('Aggregation', () => {
  const entries: AuditEntry[] = [];

  beforeEach(() => {
    entries.length = 0;
    const now = Date.now();
    // 3 auth events, 2 data access, 1 admin
    entries.push(
      makeEntry({ category: EventCategory.AUTHENTICATION, action: 'auth.login', timestamp: new Date(now - 7200000) }),
      makeEntry({ category: EventCategory.AUTHENTICATION, action: 'auth.login', timestamp: new Date(now - 3600000) }),
      makeEntry({ category: EventCategory.AUTHENTICATION, action: 'auth.logout', timestamp: new Date(now - 1800000) }),
      makeEntry({ category: EventCategory.DATA_ACCESS, action: 'data.read', timestamp: new Date(now - 900000) }),
      makeEntry({ category: EventCategory.DATA_ACCESS, action: 'data.read', timestamp: new Date(now - 600000) }),
      makeEntry({ category: EventCategory.ADMIN_ACTION, action: 'admin.delete', timestamp: new Date(now) }),
    );
  });

  describe('AggregationPipeline', () => {
    it('should group by category', () => {
      const result = new AggregationPipeline()
        .groupByField('category')
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_groups).toBe(3);
      expect(result.value.total_entries).toBe(6);
    });

    it('should group by action', () => {
      const result = new AggregationPipeline()
        .group((e) => e.action)
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_groups).toBe(4);
    });

    it('should filter then group', () => {
      const result = new AggregationPipeline()
        .filter((e) => e.category === EventCategory.AUTHENTICATION)
        .group((e) => e.action)
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_entries).toBe(3);
      expect(result.value.total_groups).toBe(2);
    });

    it('should sort by count descending', () => {
      const result = new AggregationPipeline()
        .groupByField('category')
        .sortByCount('desc')
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.groups[0]?.key).toBe(EventCategory.AUTHENTICATION);
      expect(result.value.groups[0]?.count).toBe(3);
    });

    it('should apply limit after grouping', () => {
      const result = new AggregationPipeline()
        .groupByField('category')
        .sortByCount('desc')
        .limit(2)
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_groups).toBe(2);
    });

    it('should group by time window (hour)', () => {
      const result = new AggregationPipeline()
        .groupByTimeWindow('hour')
        .sortByKey()
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_groups).toBeGreaterThanOrEqual(1);
    });

    it('should compute first/last timestamps per group', () => {
      const result = new AggregationPipeline()
        .groupByField('category')
        .execute(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const g of result.value.groups) {
        expect(g.first_timestamp).toBeInstanceOf(Date);
        expect(g.last_timestamp).toBeInstanceOf(Date);
        expect(g.first_timestamp!.getTime()).toBeLessThanOrEqual(g.last_timestamp!.getTime());
      }
    });

    it('should execute async from AsyncIterable', async () => {
      async function* gen() {
        for (const e of entries) yield e;
      }
      const result = await new AggregationPipeline()
        .groupByField('category')
        .executeAsync(gen());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_entries).toBe(6);
    });
  });

  describe('Aggregator', () => {
    let store: InMemoryAuditStore;
    let aggregator: Aggregator;

    beforeEach(async () => {
      store = new InMemoryAuditStore();
      for (const e of entries) await store.insert(e);
      aggregator = new Aggregator(store);
    });

    it('should count by category', async () => {
      const result = await aggregator.countByCategory();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_groups).toBe(3);
    });

    it('should count by outcome', async () => {
      const result = await aggregator.countByOutcome();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_entries).toBe(6);
    });

    it('should get top actors', async () => {
      const result = await aggregator.topActors(5);
      expect(result.ok).toBe(true);
    });

    it('should get top actions', async () => {
      const result = await aggregator.topActions(2);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_groups).toBeLessThanOrEqual(2);
    });
  });
});

// ============================================================================
// RETENTION TESTS
// ============================================================================

describe('Retention', () => {
  let store: InMemoryAuditStore;
  let enforcer: RetentionEnforcer;

  beforeEach(async () => {
    store = new InMemoryAuditStore();
    enforcer = new RetentionEnforcer(store, DEFAULT_RETENTION_POLICIES);

    // Insert entries: some old, some recent
    const now = Date.now();
    const oldDate = new Date(now - 400 * 86400000); // 400 days ago
    const recentDate = new Date(now - 10 * 86400000); // 10 days ago

    // Old auth entry (365-day policy → should be purged)
    await store.insert(makeEntry({
      category: EventCategory.AUTHENTICATION,
      timestamp: oldDate,
    }));
    // Old system event (30-day policy → should be purged)
    await store.insert(makeEntry({
      category: EventCategory.SYSTEM_EVENT,
      timestamp: oldDate,
    }));
    // Recent auth entry (should NOT be purged)
    await store.insert(makeEntry({
      category: EventCategory.AUTHENTICATION,
      timestamp: recentDate,
    }));
    // Recent system event (should NOT be purged)
    await store.insert(makeEntry({
      category: EventCategory.SYSTEM_EVENT,
      timestamp: recentDate,
    }));
  });

  describe('RetentionEnforcer', () => {
    it('should purge old entries per policy', async () => {
      expect(store.size()).toBe(4);
      const result = await enforcer.purge();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.deleted).toBeGreaterThan(0);
      expect(result.value.categories_processed.length).toBeGreaterThan(0);
      expect(result.value.started_at).toBeInstanceOf(Date);
      expect(result.value.completed_at).toBeInstanceOf(Date);
    });

    it('should not delete recent entries', async () => {
      const result = await enforcer.purge();
      expect(result.ok).toBe(true);
      // Recent entries should survive
      expect(store.size()).toBeGreaterThan(0);
    });

    it('should purge single category', async () => {
      const result = await enforcer.purgeCategory(EventCategory.SYSTEM_EVENT);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeGreaterThanOrEqual(1);
    });

    it('should reject purge for unknown category', async () => {
      const sparseEnforcer = new RetentionEnforcer(store, []);
      const result = await sparseEnforcer.purgeCategory(EventCategory.SECURITY_EVENT);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_POLICY');
    });

    it('should manage policies', () => {
      const result = enforcer.setPolicy({
        category: EventCategory.SYSTEM_EVENT,
        retention_days: 60,
      });
      expect(result.ok).toBe(true);
      expect(enforcer.getPolicy(EventCategory.SYSTEM_EVENT)?.retention_days).toBe(60);
    });

    it('should reject invalid policy (retention_days < 1)', () => {
      const result = enforcer.setPolicy({
        category: EventCategory.SYSTEM_EVENT,
        retention_days: 0,
      });
      expect(result.ok).toBe(false);
    });

    it('should reject policy where archive >= retention', () => {
      const result = enforcer.setPolicy({
        category: EventCategory.SYSTEM_EVENT,
        retention_days: 30,
        archive_after_days: 30,
      });
      expect(result.ok).toBe(false);
    });

    it('should list all policies', () => {
      const policies = enforcer.getAllPolicies();
      expect(policies.length).toBe(DEFAULT_RETENTION_POLICIES.length);
    });
  });
});

// ============================================================================
// IN-MEMORY STORE TESTS
// ============================================================================

describe('InMemoryAuditStore', () => {
  let store: InMemoryAuditStore;

  beforeEach(() => {
    store = new InMemoryAuditStore();
  });

  it('should insert and find by id', async () => {
    const entry = makeEntry();
    await store.insert(entry);
    const found = await store.findById(entry.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(entry.id);
  });

  it('should insert batch', async () => {
    const entries = [makeEntry(), makeEntry()];
    await store.insertBatch(entries);
    expect(store.size()).toBe(2);
  });

  it('should return null for missing id', async () => {
    const found = await store.findById('nonexistent' as any);
    expect(found).toBeNull();
  });

  it('should query with filters', async () => {
    await store.insert(makeEntry({ category: EventCategory.AUTHENTICATION }));
    await store.insert(makeEntry({ category: EventCategory.DATA_ACCESS }));

    const results = await collectAsync(store.query({ category: EventCategory.AUTHENTICATION }));
    expect(results).toHaveLength(1);
  });

  it('should count with filters', async () => {
    await store.insert(makeEntry({ category: EventCategory.AUTHENTICATION }));
    await store.insert(makeEntry({ category: EventCategory.DATA_ACCESS }));

    const count = await store.count({ category: EventCategory.AUTHENTICATION });
    expect(count).toBe(1);
  });

  it('should delete older than date', async () => {
    const old = makeEntry({ timestamp: new Date('2020-01-01') });
    const recent = makeEntry({ timestamp: new Date() });
    await store.insertBatch([old, recent]);

    const deleted = await store.deleteOlderThan(new Date('2023-01-01'));
    expect(deleted).toBe(1);
    expect(store.size()).toBe(1);
  });

  it('should delete by category', async () => {
    const old1 = makeEntry({ timestamp: new Date('2020-01-01'), category: EventCategory.AUTHENTICATION });
    const old2 = makeEntry({ timestamp: new Date('2020-01-01'), category: EventCategory.DATA_ACCESS });
    await store.insertBatch([old1, old2]);

    const deleted = await store.deleteOlderThan(new Date('2023-01-01'), EventCategory.AUTHENTICATION);
    expect(deleted).toBe(1);
    expect(store.size()).toBe(1);
  });

  it('should pass health check', async () => {
    expect(await store.healthCheck()).toBe(true);
  });

  it('should clear all entries', async () => {
    await store.insert(makeEntry());
    store.clear();
    expect(store.size()).toBe(0);
  });

  it('should filter by tags', async () => {
    await store.insert(makeEntry({ tags: ['pii', 'gdpr'] }));
    await store.insert(makeEntry({ tags: ['internal'] }));

    const results = await collectAsync(store.query({ tags: ['pii'] }));
    expect(results).toHaveLength(1);
  });
});
