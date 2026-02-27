/**
 * Multi-Tenant Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TenantManager,
  InMemoryTenantRepository,
  TenantError,
  isValidSlug,
  generateSlug,
  type Tenant,
  type CreateTenantInput,
} from '../src/tenant.js';
import {
  TenantContext,
  NoTenantContextError,
  withTenant,
} from '../src/context.js';
import {
  extractTenantId,
  InMemoryTenantCache,
  type TenantExtractionStrategy,
} from '../src/middleware.js';
import {
  tenantWhere,
  tenantData,
  validateTenantOwnership,
} from '../src/isolation/row-level.js';
import {
  SchemaManager,
} from '../src/isolation/schema.js';
import {
  UsageTracker,
  InMemoryUsageStorage,
  createUsageTracker,
} from '../src/billing/usage.js';
import {
  LimitEnforcer,
  TenantRateLimiter,
  LimitExceededError,
  RateLimitExceededError,
} from '../src/billing/limits.js';
import {
  MigrationGenerator,
  formatMigration,
} from '../src/generator/migrations.js';
import {
  generateTenantAwareISL,
  transformEntity,
} from '../src/generator/isl.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: 'test-tenant-id',
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'STARTER',
    limits: {
      maxUsers: 25,
      maxStorageMB: 1000,
      maxApiCallsPerMonth: 10000,
      maxBehaviorsPerMinute: 50,
    },
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Tenant Tests
// ============================================================================

describe('TenantManager', () => {
  let repository: InMemoryTenantRepository;
  let manager: TenantManager;

  beforeEach(() => {
    repository = new InMemoryTenantRepository();
    manager = new TenantManager(repository);
  });

  describe('createTenant', () => {
    it('creates a tenant with valid input', async () => {
      const input: CreateTenantInput = {
        name: 'Acme Corp',
        slug: 'acme-corp',
        plan: 'PRO',
      };

      const tenant = await manager.createTenant(input);

      expect(tenant.name).toBe('Acme Corp');
      expect(tenant.slug).toBe('acme-corp');
      expect(tenant.plan).toBe('PRO');
      expect(tenant.status).toBe('ACTIVE');
      expect(tenant.limits.maxUsers).toBe(100); // PRO plan limit
    });

    it('rejects invalid slug format', async () => {
      const input: CreateTenantInput = {
        name: 'Acme Corp',
        slug: 'INVALID_SLUG!',
      };

      await expect(manager.createTenant(input)).rejects.toThrow(TenantError);
    });

    it('rejects reserved slugs', async () => {
      const input: CreateTenantInput = {
        name: 'Admin',
        slug: 'admin',
      };

      await expect(manager.createTenant(input)).rejects.toThrow(TenantError);
    });

    it('rejects duplicate slugs', async () => {
      await manager.createTenant({ name: 'First', slug: 'test-slug' });
      
      await expect(
        manager.createTenant({ name: 'Second', slug: 'test-slug' })
      ).rejects.toThrow(TenantError);
    });
  });

  describe('getTenant', () => {
    it('retrieves tenant by ID', async () => {
      const created = await manager.createTenant({ name: 'Test', slug: 'test' });
      const found = await manager.getTenant(created.id);

      expect(found.id).toBe(created.id);
    });

    it('retrieves tenant by slug', async () => {
      await manager.createTenant({ name: 'Test', slug: 'my-slug' });
      const found = await manager.getTenantBySlug('my-slug');

      expect(found.slug).toBe('my-slug');
    });

    it('throws for non-existent tenant', async () => {
      await expect(manager.getTenant('non-existent')).rejects.toThrow(TenantError);
    });
  });

  describe('updateTenant', () => {
    it('updates tenant properties', async () => {
      const tenant = await manager.createTenant({ name: 'Original', slug: 'test' });
      const updated = await manager.updateTenant(tenant.id, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
    });

    it('upgrades plan with new limits', async () => {
      const tenant = await manager.createTenant({ name: 'Test', slug: 'test' });
      const upgraded = await manager.upgradePlan(tenant.id, 'ENTERPRISE');

      expect(upgraded.plan).toBe('ENTERPRISE');
      expect(upgraded.limits.maxUsers).toBe(-1); // Unlimited
    });
  });

  describe('suspendTenant', () => {
    it('suspends an active tenant', async () => {
      const tenant = await manager.createTenant({ name: 'Test', slug: 'test' });
      const suspended = await manager.suspendTenant(tenant.id, 'Payment overdue');

      expect(suspended.status).toBe('SUSPENDED');
    });
  });
});

describe('Slug utilities', () => {
  it('validates correct slugs', () => {
    expect(isValidSlug('valid-slug')).toBe(true);
    expect(isValidSlug('test123')).toBe(true);
    expect(isValidSlug('a1')).toBe(false); // Too short
    expect(isValidSlug('valid-slug-123')).toBe(true);
  });

  it('generates slugs from names', () => {
    expect(generateSlug('Acme Corp')).toBe('acme-corp');
    expect(generateSlug('Test & Company')).toBe('test-company');
    expect(generateSlug('  Spaces  ')).toBe('spaces');
  });
});

// ============================================================================
// Context Tests
// ============================================================================

describe('TenantContext', () => {
  const testTenant = createTestTenant();

  it('provides tenant within context', () => {
    TenantContext.run(testTenant, () => {
      const current = TenantContext.getTenant();
      expect(current.id).toBe(testTenant.id);
    });
  });

  it('throws outside context', () => {
    expect(() => TenantContext.getTenant()).toThrow(NoTenantContextError);
  });

  it('reports context status correctly', () => {
    expect(TenantContext.isInContext()).toBe(false);

    TenantContext.run(testTenant, () => {
      expect(TenantContext.isInContext()).toBe(true);
    });
  });

  it('supports nested contexts', () => {
    const tenant2 = createTestTenant({ id: 'tenant-2', slug: 'tenant-2' });

    TenantContext.run(testTenant, () => {
      expect(TenantContext.getTenantId()).toBe(testTenant.id);

      TenantContext.run(tenant2, () => {
        expect(TenantContext.getTenantId()).toBe(tenant2.id);
      });

      expect(TenantContext.getTenantId()).toBe(testTenant.id);
    });
  });

  it('supports async context', async () => {
    await TenantContext.runAsync(testTenant, async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(TenantContext.getTenantId()).toBe(testTenant.id);
    });
  });
});

describe('withTenant', () => {
  it('executes function in tenant context', async () => {
    const tenant = createTestTenant();
    
    const result = await withTenant(tenant, () => {
      return TenantContext.getTenant().name;
    });

    expect(result).toBe(tenant.name);
  });
});

// ============================================================================
// Middleware Tests
// ============================================================================

describe('extractTenantId', () => {
  it('extracts from subdomain', async () => {
    const strategies: TenantExtractionStrategy[] = [{ type: 'subdomain' }];
    const req = {
      url: 'https://acme.example.com/api',
      hostname: 'acme.example.com',
      headers: {},
      method: 'GET',
    };

    const tenantId = await extractTenantId(req, strategies);
    expect(tenantId).toBe('acme');
  });

  it('extracts from header', async () => {
    const strategies: TenantExtractionStrategy[] = [
      { type: 'header', name: 'X-Tenant-ID' }
    ];
    const req = {
      url: 'https://example.com/api',
      headers: { 'x-tenant-id': 'my-tenant' },
      method: 'GET',
    };

    const tenantId = await extractTenantId(req, strategies);
    expect(tenantId).toBe('my-tenant');
  });

  it('extracts from path', async () => {
    const strategies: TenantExtractionStrategy[] = [
      { type: 'path', pattern: '/t/:tenant' }
    ];
    const req = {
      url: 'https://example.com/t/acme/users',
      path: '/t/acme/users',
      headers: {},
      method: 'GET',
    };

    const tenantId = await extractTenantId(req, strategies);
    expect(tenantId).toBe('acme');
  });

  it('tries strategies in order', async () => {
    const strategies: TenantExtractionStrategy[] = [
      { type: 'header', name: 'X-Tenant-ID' },
      { type: 'subdomain' },
    ];
    const req = {
      url: 'https://other.example.com/api',
      hostname: 'other.example.com',
      headers: { 'x-tenant-id': 'header-tenant' },
      method: 'GET',
    };

    const tenantId = await extractTenantId(req, strategies);
    expect(tenantId).toBe('header-tenant');
  });
});

describe('TenantCache', () => {
  it('caches and retrieves tenants', async () => {
    const cache = new InMemoryTenantCache();
    const tenant = createTestTenant();

    await cache.set('test-key', tenant, 60000);
    const cached = await cache.get('test-key');

    expect(cached?.id).toBe(tenant.id);
  });

  it('expires cached tenants', async () => {
    const cache = new InMemoryTenantCache();
    const tenant = createTestTenant();

    await cache.set('test-key', tenant, 1); // 1ms TTL
    await new Promise(resolve => setTimeout(resolve, 10));
    const cached = await cache.get('test-key');

    expect(cached).toBeNull();
  });
});

// ============================================================================
// Row-Level Security Tests
// ============================================================================

describe('Row-Level Security', () => {
  const tenant = createTestTenant();

  it('adds tenant to where clause', () => {
    TenantContext.run(tenant, () => {
      const where = tenantWhere({ email: 'test@example.com' });
      expect(where.email).toBe('test@example.com');
      expect(where.tenantId).toBe(tenant.id);
    });
  });

  it('adds tenant to data', () => {
    TenantContext.run(tenant, () => {
      const data = tenantData({ name: 'John' });
      expect(data.name).toBe('John');
      expect(data.tenantId).toBe(tenant.id);
    });
  });

  it('validates tenant ownership', () => {
    TenantContext.run(tenant, () => {
      const ownedRecord = { id: '1', tenantId: tenant.id };
      const otherRecord = { id: '2', tenantId: 'other-tenant' };

      expect(validateTenantOwnership(ownedRecord)).toBe(true);
      expect(validateTenantOwnership(otherRecord)).toBe(false);
    });
  });
});

// ============================================================================
// Schema Manager Tests
// ============================================================================

describe('SchemaManager', () => {
  let manager: SchemaManager;

  beforeEach(() => {
    manager = new SchemaManager();
  });

  it('generates schema name from tenant ID', () => {
    const name = manager.getSchemaName('abc-123-def');
    expect(name).toBe('tenant_abc_123_def');
  });

  it('generates create schema SQL', () => {
    const tenant = createTestTenant();
    const sql = manager.generateCreateSchemaSQL(tenant, ['users', 'posts']);

    expect(sql).toContain('CREATE SCHEMA');
    expect(sql).toContain('tenant_test_tenant_id');
    expect(sql).toContain('users');
    expect(sql).toContain('posts');
  });
});

// ============================================================================
// Usage Tracker Tests
// ============================================================================

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    tracker = createUsageTracker();
  });

  it('checks limits correctly', async () => {
    const tenant = createTestTenant({ plan: 'FREE' });
    
    await TenantContext.runAsync(tenant, async () => {
      // Should be allowed initially
      const allowed = await tracker.checkLimit(tenant.id, 'apiCalls');
      expect(allowed).toBe(true);
    });
  });

  it('increments usage', async () => {
    const tenant = createTestTenant();
    
    await TenantContext.runAsync(tenant, async () => {
      const result = await tracker.increment(tenant.id, 'apiCalls', 5);
      expect(result.newValue).toBe(5);

      const result2 = await tracker.increment(tenant.id, 'apiCalls', 3);
      expect(result2.newValue).toBe(8);
    });
  });

  it('reports usage snapshot', async () => {
    const tenant = createTestTenant();
    
    await TenantContext.runAsync(tenant, async () => {
      await tracker.increment(tenant.id, 'apiCalls', 100);
      const snapshot = await tracker.getUsage(tenant.id);

      expect(snapshot.metrics.apiCalls).toBe(100);
      expect(snapshot.tenantId).toBe(tenant.id);
    });
  });
});

// ============================================================================
// Limit Enforcer Tests
// ============================================================================

describe('LimitEnforcer', () => {
  let tracker: UsageTracker;
  let enforcer: LimitEnforcer;

  beforeEach(() => {
    tracker = createUsageTracker();
    enforcer = new LimitEnforcer(tracker);
  });

  it('allows within limits', async () => {
    const tenant = createTestTenant();
    
    await TenantContext.runAsync(tenant, async () => {
      const result = await enforcer.check('apiCalls');
      expect(result.allowed).toBe(true);
    });
  });
});

describe('TenantRateLimiter', () => {
  it('allows requests within limit', async () => {
    const limiter = new TenantRateLimiter({
      windowMs: 60000,
      defaultLimit: 10,
    });
    const tenant = createTestTenant();

    await TenantContext.runAsync(tenant, async () => {
      const result = await limiter.isAllowed();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  it('blocks requests over limit', async () => {
    const limiter = new TenantRateLimiter({
      windowMs: 60000,
      defaultLimit: 2,
    });
    const tenant = createTestTenant();

    await TenantContext.runAsync(tenant, async () => {
      await limiter.isAllowed();
      await limiter.isAllowed();
      const result = await limiter.isAllowed();

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  it('enforces and throws on limit', async () => {
    const limiter = new TenantRateLimiter({
      windowMs: 60000,
      defaultLimit: 1,
    });
    const tenant = createTestTenant();

    await TenantContext.runAsync(tenant, async () => {
      await limiter.enforce(); // First call OK
      await expect(limiter.enforce()).rejects.toThrow(RateLimitExceededError);
    });
  });
});

// ============================================================================
// Migration Generator Tests
// ============================================================================

describe('MigrationGenerator', () => {
  let generator: MigrationGenerator;

  beforeEach(() => {
    generator = new MigrationGenerator({
      isolation: 'row_level',
      tenantIdColumn: 'tenant_id',
      tenantTable: 'tenants',
      targetTables: ['users', 'posts', 'comments'],
    });
  });

  it('generates add tenant support migration', () => {
    const migration = generator.generateAddTenantSupport();

    expect(migration.name).toBe('add_tenant_support');
    expect(migration.up).toContain('CREATE TABLE');
    expect(migration.up).toContain('tenants');
    expect(migration.up).toContain('tenant_id');
    expect(migration.up).toContain('ROW LEVEL SECURITY');
  });

  it('generates scoped uniques migration', () => {
    const migration = generator.generateScopedUniques({
      users: ['email', 'username'],
    });

    expect(migration.name).toBe('scope_uniques_to_tenant');
    expect(migration.up).toContain('tenant_id');
    expect(migration.up).toContain('email');
  });

  it('formats migration correctly', () => {
    const migration = generator.generateAddTenantSupport();
    const formatted = formatMigration(migration);

    expect(formatted).toContain('-- Migration:');
    expect(formatted).toContain('-- UP');
    expect(formatted).toContain('-- DOWN');
  });
});

// ============================================================================
// ISL Generator Tests
// ============================================================================

describe('ISL Generator', () => {
  it('generates tenant-aware ISL config', () => {
    const result = generateTenantAwareISL('UserService', {
      isolation: 'row_level',
      identifier: 'tenant_id',
      tenantEntity: true,
    });

    expect(result.types).toContain(expect.stringContaining('PlanType'));
    expect(result.types).toContain(expect.stringContaining('TenantStatus'));
    expect(result.tenant).toContain('entity Tenant');
  });

  it('transforms entity to be tenant-aware', () => {
    const transform = transformEntity('User', [
      'id: UUID [unique]',
      'email: String [unique]',
    ], {
      isolation: 'row_level',
      identifier: 'tenant_id',
    });

    expect(transform.name).toBe('User');
    expect(transform.addFields).toContain(expect.stringContaining('tenant_id'));
  });
});
