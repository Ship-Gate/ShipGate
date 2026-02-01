/**
 * API Versioning Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Versioning,
  createVersioning,
  diffDomains,
  extractVersionFromUrl,
  extractVersionFromHeader,
  extractVersionFromQuery,
  buildVersionedUrl,
  stripVersionFromUrl,
  checkCompatibility,
  generateReport,
  generateTransformers,
  createRequestTransformer,
  createResponseTransformer,
} from '../src/index.js';
import type { Domain, Change } from '../src/types.js';

// Test fixtures
function createTestDomainV1(): Domain {
  return {
    name: 'auth',
    version: '1.0.0',
    entities: [
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'UUID' },
          { name: 'email', type: 'String' },
          { name: 'legacyId', type: 'String' },
        ],
      },
    ],
    behaviors: [
      {
        name: 'CreateUser',
        input: [
          { name: 'email', type: 'String' },
          { name: 'password', type: 'String' },
        ],
        output: { type: 'User' },
        errors: [
          { name: 'INVALID_EMAIL' },
          { name: 'WEAK_PASSWORD' },
        ],
      },
    ],
    types: [
      { name: 'Password', baseType: 'String', constraints: [{ name: 'min_length', value: 8 }] },
    ],
  };
}

function createTestDomainV2(): Domain {
  return {
    name: 'auth',
    version: '2.0.0',
    entities: [
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'UUID' },
          { name: 'email', type: 'Email' }, // Type changed
          { name: 'avatarUrl', type: 'String', optional: true }, // Added
          // legacyId removed
        ],
      },
    ],
    behaviors: [
      {
        name: 'CreateUser',
        input: [
          { name: 'email', type: 'Email' }, // Type changed
          { name: 'password', type: 'Password' },
        ],
        output: { type: 'User' },
        errors: [
          { name: 'INVALID_EMAIL' },
          { name: 'WEAK_PASSWORD' },
          { name: 'RATE_LIMITED' }, // Added
        ],
      },
    ],
    types: [
      { name: 'Password', baseType: 'String', constraints: [{ name: 'min_length', value: 12 }] }, // More restrictive
      { name: 'Email', baseType: 'String', constraints: [{ name: 'format', value: 'email' }] }, // New type
    ],
  };
}

describe('Domain Differ', () => {
  it('should detect removed fields as breaking', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const diff = diffDomains(v1, v2);
    
    expect(diff.breaking.some(c => 
      c.type === 'field_removed' && c.path === 'User.legacyId'
    )).toBe(true);
  });

  it('should detect added optional fields as non-breaking', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const diff = diffDomains(v1, v2);
    
    expect(diff.nonBreaking.some(c => 
      c.type === 'field_added' && c.path === 'User.avatarUrl'
    )).toBe(true);
  });

  it('should detect type changes as breaking', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const diff = diffDomains(v1, v2);
    
    expect(diff.breaking.some(c => 
      c.type === 'field_type_changed' && c.path.includes('email')
    )).toBe(true);
  });

  it('should detect added errors as non-breaking', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const diff = diffDomains(v1, v2);
    
    expect(diff.nonBreaking.some(c => 
      c.type === 'error_added' && c.path.includes('RATE_LIMITED')
    )).toBe(true);
  });

  it('should mark diff as incompatible when breaking changes exist', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const diff = diffDomains(v1, v2);
    
    expect(diff.compatible).toBe(false);
    expect(diff.breaking.length).toBeGreaterThan(0);
  });
});

describe('Version Strategies', () => {
  describe('URL Strategy', () => {
    it('should extract version from URL', () => {
      expect(extractVersionFromUrl('/v1/users')).toBe('1');
      expect(extractVersionFromUrl('/v2/users/123')).toBe('2');
      expect(extractVersionFromUrl('/v10/api/data')).toBe('10');
    });

    it('should return null for URLs without version', () => {
      expect(extractVersionFromUrl('/users')).toBe(null);
      expect(extractVersionFromUrl('/api/v1')).toBe(null);
    });

    it('should build versioned URL', () => {
      expect(buildVersionedUrl('/users', '1')).toBe('/v1/users');
      expect(buildVersionedUrl('/v1/users', '2')).toBe('/v2/users');
    });

    it('should strip version from URL', () => {
      expect(stripVersionFromUrl('/v1/users')).toBe('/users');
      expect(stripVersionFromUrl('/v2/users/123')).toBe('/users/123');
    });
  });

  describe('Header Strategy', () => {
    it('should extract version from custom header', () => {
      expect(extractVersionFromHeader({ 'API-Version': '2' })).toBe('2');
      expect(extractVersionFromHeader({ 'api-version': '3' })).toBe('3');
    });

    it('should extract version from Accept header', () => {
      expect(extractVersionFromHeader({ 
        'Accept': 'application/json;version=2' 
      })).toBe('2');
    });

    it('should return null when no version header', () => {
      expect(extractVersionFromHeader({})).toBe(null);
      expect(extractVersionFromHeader({ 'Content-Type': 'application/json' })).toBe(null);
    });
  });

  describe('Query Strategy', () => {
    it('should extract version from query string', () => {
      expect(extractVersionFromQuery('/users?version=2')).toBe('2');
      expect(extractVersionFromQuery('/users?foo=bar&version=3')).toBe('3');
    });

    it('should return null for URLs without version param', () => {
      expect(extractVersionFromQuery('/users')).toBe(null);
      expect(extractVersionFromQuery('/users?foo=bar')).toBe(null);
    });
  });
});

describe('Compatibility Checker', () => {
  it('should return compatible for identical domains', () => {
    const domain = createTestDomainV1();
    const result = checkCompatibility(domain, domain);
    
    expect(result.isCompatible).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should return incompatible for breaking changes', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const result = checkCompatibility(v1, v2);
    
    expect(result.isCompatible).toBe(false);
    expect(result.breakingChanges.length).toBeGreaterThan(0);
  });

  it('should calculate severity based on changes', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const result = checkCompatibility(v1, v2);
    
    expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
  });
});

describe('Report Generator', () => {
  it('should generate markdown report', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const report = generateReport(v1, v2);
    
    expect(report.markdown).toContain('# API Compatibility Report');
    expect(report.markdown).toContain('Breaking Changes');
    expect(report.summary.breakingCount).toBeGreaterThan(0);
  });

  it('should include migration path', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    
    const report = generateReport(v1, v2);
    
    expect(report.migrationPath.length).toBeGreaterThan(0);
    expect(report.migrationPath[0].order).toBe(1);
  });
});

describe('Transformer Generator', () => {
  it('should generate request transformer code', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    const diff = diffDomains(v1, v2);
    
    const transformers = generateTransformers(diff);
    
    expect(transformers.request).toContain('function transformRequest');
    expect(transformers.response).toContain('function transformResponse');
  });

  it('should provide working transformer functions', () => {
    const v1 = createTestDomainV1();
    const v2 = createTestDomainV2();
    const diff = diffDomains(v1, v2);
    
    const transformers = generateTransformers(diff);
    
    expect(typeof transformers.requestFn).toBe('function');
    expect(typeof transformers.responseFn).toBe('function');
  });
});

describe('Request/Response Transformers', () => {
  it('should create request transformer from changes', () => {
    const changes: Change[] = [
      {
        type: 'field_removed',
        path: 'User.legacyId',
        description: 'Field removed',
        from: 'legacyId',
      },
    ];
    
    const transformer = createRequestTransformer(changes);
    const result = transformer({
      body: { email: 'test@example.com', legacyId: '123' },
    });
    
    // Request transformer doesn't remove fields for removed (server ignores)
    // Just verify it doesn't crash and returns body
    expect(result.body).toBeDefined();
    expect(result.body?.email).toBe('test@example.com');
  });

  it('should create response transformer from changes', () => {
    const changes: Change[] = [
      {
        type: 'field_added',
        path: 'avatarUrl',  // Flat path to match body structure
        description: 'Field added',
        to: 'default',
      },
    ];
    
    const transformer = createResponseTransformer(changes);
    const result = transformer({
      body: { id: '123', avatarUrl: 'https://example.com/avatar.png' },
    });
    
    // Response transformer removes new fields for old clients
    expect(result.body).toBeDefined();
    expect(result.body?.avatarUrl).toBeUndefined();
  });
});

describe('Versioning Class', () => {
  let versioning: Versioning;

  beforeEach(() => {
    versioning = createVersioning();
  });

  it('should register and retrieve domains', () => {
    const domain = createTestDomainV1();
    versioning.registerDomain(domain);
    
    const retrieved = versioning.getDomain('auth@1.0.0');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('auth');
  });

  it('should diff registered domains', () => {
    versioning.registerDomain(createTestDomainV1());
    versioning.registerDomain(createTestDomainV2());
    
    const diff = versioning.diff('auth@1.0.0', 'auth@2.0.0');
    
    expect(diff.from).toBe('auth@1.0.0');
    expect(diff.to).toBe('auth@2.0.0');
    expect(diff.breaking.length).toBeGreaterThan(0);
  });

  it('should generate transformers for registered domains', () => {
    versioning.registerDomain(createTestDomainV1());
    versioning.registerDomain(createTestDomainV2());
    
    const transformers = versioning.getTransformers('auth@1.0.0', 'auth@2.0.0');
    
    expect(transformers.request).toBeDefined();
    expect(transformers.response).toBeDefined();
  });

  it('should build middleware config', () => {
    versioning.registerDomain(createTestDomainV1());
    versioning.registerDomain(createTestDomainV2());
    
    const config = versioning.buildMiddlewareConfig('auth', {
      strategy: 'header',
    });
    
    expect(config.strategy).toBe('header');
    expect(config.versions['1.0.0']).toBe('auth@1.0.0');
    expect(config.versions['2.0.0']).toBe('auth@2.0.0');
  });

  it('should cache diffs', () => {
    versioning.registerDomain(createTestDomainV1());
    versioning.registerDomain(createTestDomainV2());
    
    const diff1 = versioning.diff('auth@1.0.0', 'auth@2.0.0');
    const diff2 = versioning.diff('auth@1.0.0', 'auth@2.0.0');
    
    expect(diff1).toBe(diff2); // Same reference = cached
  });

  it('should get summary', () => {
    versioning.registerDomain(createTestDomainV1());
    versioning.registerDomain(createTestDomainV2());
    
    const summary = versioning.getSummary('auth@1.0.0', 'auth@2.0.0');
    
    expect(summary).toContain('auth@1.0.0');
    expect(summary).toContain('auth@2.0.0');
  });
});
