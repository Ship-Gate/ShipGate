/**
 * ISL Policy Packs - Bundle Format Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBundle,
  validateBundle,
  serializeBundle,
  deserializeBundle,
  checkBundleCompatibility,
  BUNDLE_FORMAT_VERSION,
} from '../src/bundle.js';
import {
  createRegistry,
  loadBuiltinPacks,
  authPolicyPack,
  piiPolicyPack,
  type PolicyPackRegistry,
} from '../src/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestPack(id: string, version: string): import('../src/types.js').PolicyPack {
  return {
    id,
    name: `Test Pack ${id}`,
    description: `Test pack ${id}`,
    version,
    rules: [
      {
        id: `${id}/test-rule`,
        name: 'Test Rule',
        description: 'A test rule',
        severity: 'error',
        category: id,
        tags: [],
        evaluate: () => null,
      },
    ],
  };
}

// ============================================================================
// Bundle Creation Tests
// ============================================================================

describe('ISL Policy Packs - Bundle Creation', () => {
  let registry: PolicyPackRegistry;

  beforeEach(async () => {
    registry = createRegistry();
    await loadBuiltinPacks(registry);
  });

  it('should create a bundle from packs', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs);

    expect(bundle.metadata.formatVersion).toBe(BUNDLE_FORMAT_VERSION);
    expect(bundle.metadata.createdAt).toBeTruthy();
    expect(bundle.metadata.createdBy).toBe('@isl-lang/policy-packs');
    expect(bundle.packs.length).toBeGreaterThan(0);
  });

  it('should include pack versions in bundle', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs);

    for (const packSpec of bundle.packs) {
      const pack = packs.find(p => p.id === packSpec.packId);
      expect(pack).toBeDefined();
      expect(packSpec.version).toBe(pack!.version);
    }
  });

  it('should respect pack configuration', () => {
    const packs = registry.getAllPacks();
    const config = {
      auth: { enabled: false },
      pii: { enabled: true },
    };

    const bundle = createBundle(packs, config);

    const authPack = bundle.packs.find(p => p.packId === 'auth');
    const piiPack = bundle.packs.find(p => p.packId === 'pii');

    expect(authPack?.enabled).toBe(false);
    expect(piiPack?.enabled).toBe(true);
  });

  it('should include rule overrides in bundle', () => {
    const packs = registry.getAllPacks();
    const config = {
      auth: {
        enabled: true,
        ruleOverrides: {
          'auth/bypass-detected': {
            enabled: false,
            severity: 'warning',
          },
        },
      },
    };

    const bundle = createBundle(packs, config);

    const authPack = bundle.packs.find(p => p.packId === 'auth');
    expect(authPack?.ruleOverrides?.['auth/bypass-detected']?.enabled).toBe(false);
    expect(authPack?.ruleOverrides?.['auth/bypass-detected']?.severity).toBe('warning');
  });

  it('should include description in bundle metadata', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs, undefined, {
      description: 'Test bundle',
    });

    expect(bundle.metadata.description).toBe('Test bundle');
  });

  it('should filter by minimum severity', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs, undefined, {
      minSeverity: 'warning',
    });

    // Bundle should still include all packs, but minSeverity is set
    expect(bundle.packs.length).toBeGreaterThan(0);
    expect(bundle.packs[0].minSeverity).toBe('warning');
  });
});

// ============================================================================
// Bundle Serialization Tests
// ============================================================================

describe('ISL Policy Packs - Bundle Serialization', () => {
  it('should serialize and deserialize bundle', () => {
    const pack = createTestPack('test', '1.0.0');
    const bundle = createBundle([pack]);

    const json = serializeBundle(bundle);
    expect(json).toBeTruthy();
    expect(typeof json).toBe('string');

    const deserialized = deserializeBundle(json);
    expect(deserialized.metadata.formatVersion).toBe(bundle.metadata.formatVersion);
    expect(deserialized.packs.length).toBe(bundle.packs.length);
  });

  it('should throw on invalid JSON', () => {
    expect(() => deserializeBundle('invalid json')).toThrow();
  });

  it('should throw on missing required fields', () => {
    expect(() => deserializeBundle('{}')).toThrow('missing required fields');
  });
});

// ============================================================================
// Bundle Validation Tests
// ============================================================================

describe('ISL Policy Packs - Bundle Validation', () => {
  let registry: PolicyPackRegistry;

  beforeEach(async () => {
    registry = createRegistry();
    await loadBuiltinPacks(registry);
  });

  it('should validate a valid bundle', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs);

    const packMap = new Map<string, typeof packs>();
    for (const pack of packs) {
      packMap.set(pack.id, [pack]);
    }

    const result = validateBundle(bundle, packMap);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect missing packs', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs);

    // Add a non-existent pack to bundle
    bundle.packs.push({
      packId: 'nonexistent',
      version: '1.0.0',
      enabled: true,
    });

    const packMap = new Map<string, typeof packs>();
    for (const pack of packs) {
      packMap.set(pack.id, [pack]);
    }

    const result = validateBundle(bundle, packMap);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
  });

  it('should detect version mismatches', () => {
    const packs = registry.getAllPacks();
    const bundle = createBundle(packs);

    // Change a pack version to non-existent version
    const authPack = bundle.packs.find(p => p.packId === 'auth');
    if (authPack) {
      authPack.version = '999.999.999';
    }

    const packMap = new Map<string, typeof packs>();
    for (const pack of packs) {
      packMap.set(pack.id, [pack]);
    }

    const result = validateBundle(bundle, packMap);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should warn about outdated versions', () => {
    const pack1 = createTestPack('test', '1.0.0');
    const pack2 = createTestPack('test', '1.1.0');
    
    const bundle = createBundle([pack1]);
    bundle.packs[0].version = '1.0.0';

    const packMap = new Map<string, (typeof pack1)[]>();
    packMap.set('test', [pack1, pack2]);

    const result = validateBundle(bundle, packMap);

    // Should warn about newer version
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('1.1.0'))).toBe(true);
  });

  it('should detect deprecated rules', () => {
    const pack = createTestPack('test', '1.0.0');
    
    // Add a deprecated rule
    const deprecatedRule = {
      id: 'test/deprecated-rule',
      name: 'Deprecated Rule',
      description: 'A deprecated rule',
      severity: 'error' as const,
      category: 'test',
      tags: [],
      evaluate: () => null,
      deprecated: true,
      deprecatedSince: '1.0.0',
      replacementRuleId: 'test/new-rule',
      deprecationMessage: 'Use test/new-rule instead',
    };
    
    pack.rules.push(deprecatedRule);

    const bundle = createBundle([pack]);
    bundle.packs[0].ruleOverrides = {
      'test/deprecated-rule': { enabled: true },
    };

    const packMap = new Map<string, (typeof pack)[]>();
    packMap.set('test', [pack]);

    const result = validateBundle(bundle, packMap);

    expect(result.deprecations.length).toBeGreaterThan(0);
    expect(result.deprecations[0].id).toBe('test/deprecated-rule');
    expect(result.deprecations[0].replacementId).toBe('test/new-rule');
  });
});

// ============================================================================
// Bundle Compatibility Tests
// ============================================================================

describe('ISL Policy Packs - Bundle Compatibility', () => {
  it('should check bundle compatibility', () => {
    const pack1 = createTestPack('test', '1.0.0');
    const pack2 = createTestPack('test', '1.1.0');
    
    const bundle = createBundle([pack1]);
    bundle.packs[0].version = '1.0.0';

    const packMap = new Map<string, (typeof pack1)[]>();
    packMap.set('test', [pack1, pack2]);

    const result = checkBundleCompatibility(bundle, packMap);

    expect(result.compatible).toBe(true);
    expect(result.missingPacks.length).toBe(0);
  });

  it('should detect missing packs in compatibility check', () => {
    const bundle = createBundle([createTestPack('test', '1.0.0')]);
    bundle.packs.push({
      packId: 'missing',
      version: '1.0.0',
      enabled: true,
    });

    const packMap = new Map<string, ReturnType<typeof createTestPack>[]>();
    packMap.set('test', [createTestPack('test', '1.0.0')]);

    const result = checkBundleCompatibility(bundle, packMap);

    expect(result.compatible).toBe(false);
    expect(result.missingPacks).toContain('missing');
  });

  it('should detect outdated versions', () => {
    const pack1 = createTestPack('test', '1.0.0');
    const pack2 = createTestPack('test', '1.2.0');
    
    const bundle = createBundle([pack1]);
    bundle.packs[0].version = '1.0.0';

    const packMap = new Map<string, (typeof pack1)[]>();
    packMap.set('test', [pack1, pack2]);

    const result = checkBundleCompatibility(bundle, packMap);

    expect(result.outdatedVersions.length).toBeGreaterThan(0);
    expect(result.outdatedVersions[0].requested).toBe('1.0.0');
    expect(result.outdatedVersions[0].available).toBe('1.2.0');
  });
});

// ============================================================================
// Compatibility Tests: Older Specs with Newer Packs
// ============================================================================

describe('ISL Policy Packs - Compatibility: Older Specs with Newer Packs', () => {
  it('should evaluate older bundle with newer pack versions', async () => {
    const registry = createRegistry();
    
    // Create an "older" pack version
    const oldPack = {
      ...authPolicyPack,
      version: '1.0.0',
    };
    
    // Create a "newer" pack version (same major version)
    const newPack = {
      ...authPolicyPack,
      version: '1.2.0',
      rules: [
        ...authPolicyPack.rules,
        // Add a new rule in newer version
        {
          id: 'auth/new-rule',
          name: 'New Rule',
          description: 'A new rule',
          severity: 'warning' as const,
          category: 'auth',
          tags: [],
          evaluate: () => null,
        },
      ],
    };

    registry.registerPack(oldPack);
    
    // Create bundle from old pack
    const bundle = createBundle([oldPack]);
    
    // Now register newer pack
    registry.clear();
    registry.registerPack(newPack);
    
    // Bundle should still work (same major version)
    const packMap = new Map<string, (typeof newPack)[]>();
    packMap.set('auth', [newPack]);
    
    const validation = validateBundle(bundle, packMap);
    
    // Should be compatible (same major version)
    expect(validation.valid).toBe(true);
  });

  it('should emit deprecation warnings for deprecated rules', async () => {
    const registry = createRegistry();
    
    // Create pack with deprecated rule
    const packWithDeprecated = {
      ...piiPolicyPack,
      rules: [
        ...piiPolicyPack.rules,
        {
          id: 'pii/old-logging-rule',
          name: 'Old Logging Rule',
          description: 'Deprecated rule',
          severity: 'error' as const,
          category: 'pii',
          tags: [],
          evaluate: () => null,
          deprecated: true,
          deprecatedSince: '1.1.0',
          replacementRuleId: 'pii/logged-sensitive-data',
          deprecationMessage: 'Use pii/logged-sensitive-data instead',
        },
      ],
    };

    registry.registerPack(packWithDeprecated);
    
    // Create bundle that references deprecated rule
    const bundle = createBundle([packWithDeprecated], {
      pii: {
        enabled: true,
        ruleOverrides: {
          'pii/old-logging-rule': { enabled: true },
        },
      },
    });

    const packMap = new Map<string, (typeof packWithDeprecated)[]>();
    packMap.set('pii', [packWithDeprecated]);

    const validation = validateBundle(bundle, packMap);

    expect(validation.deprecations.length).toBeGreaterThan(0);
    expect(validation.deprecations[0].id).toBe('pii/old-logging-rule');
    expect(validation.deprecations[0].replacementId).toBe('pii/logged-sensitive-data');
  });

  it('should handle rule removal gracefully with deprecation notice', async () => {
    const registry = createRegistry();
    
    // Old pack with a rule
    const oldPack = {
      ...authPolicyPack,
      version: '1.0.0',
      rules: [
        ...authPolicyPack.rules,
        {
          id: 'auth/removed-rule',
          name: 'Removed Rule',
          description: 'This rule will be removed',
          severity: 'warning' as const,
          category: 'auth',
          tags: [],
          evaluate: () => null,
        },
      ],
    };

    // New pack without the rule (it was removed)
    const newPack = {
      ...authPolicyPack,
      version: '1.1.0',
      // Rule removed - not in rules array
    };

    // Create bundle from old pack
    const bundle = createBundle([oldPack], {
      auth: {
        enabled: true,
        ruleOverrides: {
          'auth/removed-rule': { enabled: true },
        },
      },
    });

    const packMap = new Map<string, (typeof newPack)[]>();
    packMap.set('auth', [newPack]);

    const validation = validateBundle(bundle, packMap);

    // Should warn about missing rule
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.warnings.some(w => w.includes('removed-rule'))).toBe(true);
  });
});
