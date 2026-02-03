/**
 * Integration tests for ISL Standard Library 1.0 import resolution
 * Verifies all 10 stdlib modules can be discovered and resolved
 */

import { describe, test, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Load the registry directly for testing
const registryPath = path.resolve(__dirname, '../src/stdlib-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

describe('Stdlib 1.0 Registry Integration', () => {
  const STDLIB_1_0_MODULES = [
    '@isl/string',
    '@isl/math',
    '@isl/collections',
    '@isl/json',
    '@isl/datetime',
    '@isl/uuid',
    '@isl/crypto',
    '@isl/encoding',
    '@isl/regex',
    '@isl/url',
  ];

  describe('Registry Structure', () => {
    test('registry version is 1.0.0', () => {
      expect(registry.version).toBe('1.0.0');
    });

    test('all 10 stdlib 1.0 modules are registered', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        expect(registry.modules[moduleName]).toBeDefined();
        expect(registry.modules[moduleName].version).toBe('1.0.0');
      }
    });

    test('each module has required fields', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        const mod = registry.modules[moduleName];
        expect(mod.version).toBeDefined();
        expect(mod.path).toBeDefined();
        expect(mod.files).toBeDefined();
        expect(mod.exports).toBeDefined();
        expect(mod.description).toBeDefined();
      }
    });

    test('determinism field is present for each module', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        const mod = registry.modules[moduleName];
        expect(typeof mod.deterministic).toBe('boolean');
      }
    });
  });

  describe('Aliases', () => {
    test('stdlib- prefixed aliases are registered', () => {
      expect(registry.aliases['stdlib-string']).toBe('@isl/string');
      expect(registry.aliases['stdlib-math']).toBe('@isl/math');
      expect(registry.aliases['stdlib-collections']).toBe('@isl/collections');
      expect(registry.aliases['stdlib-json']).toBe('@isl/json');
      expect(registry.aliases['stdlib-datetime']).toBe('@isl/datetime');
      expect(registry.aliases['stdlib-uuid']).toBe('@isl/uuid');
      expect(registry.aliases['stdlib-crypto']).toBe('@isl/crypto');
      expect(registry.aliases['stdlib-encoding']).toBe('@isl/encoding');
      expect(registry.aliases['stdlib-regex']).toBe('@isl/regex');
      expect(registry.aliases['stdlib-url']).toBe('@isl/url');
    });

    test('strings -> string alias exists', () => {
      expect(registry.aliases['stdlib-strings']).toBe('@isl/string');
    });
  });

  describe('Categories', () => {
    test('modules are organized into categories', () => {
      expect(registry.categories).toBeDefined();
      expect(registry.categories.core).toBeDefined();
      expect(registry.categories.data).toBeDefined();
      expect(registry.categories.temporal).toBeDefined();
      expect(registry.categories.security).toBeDefined();
      expect(registry.categories.patterns).toBeDefined();
    });

    test('core category contains string, math, collections', () => {
      expect(registry.categories.core.modules).toContain('@isl/string');
      expect(registry.categories.core.modules).toContain('@isl/math');
      expect(registry.categories.core.modules).toContain('@isl/collections');
    });

    test('data category contains json, encoding, url', () => {
      expect(registry.categories.data.modules).toContain('@isl/json');
      expect(registry.categories.data.modules).toContain('@isl/encoding');
      expect(registry.categories.data.modules).toContain('@isl/url');
    });

    test('temporal category contains datetime, uuid', () => {
      expect(registry.categories.temporal.modules).toContain('@isl/datetime');
      expect(registry.categories.temporal.modules).toContain('@isl/uuid');
    });

    test('security category contains crypto', () => {
      expect(registry.categories.security.modules).toContain('@isl/crypto');
    });

    test('patterns category contains regex', () => {
      expect(registry.categories.patterns.modules).toContain('@isl/regex');
    });
  });

  describe('Determinism Policy', () => {
    test('determinism policy is defined', () => {
      expect(registry.determinism_policy).toBeDefined();
      expect(registry.determinism_policy.version).toBe('1.0.0');
    });

    test('fully deterministic modules are listed', () => {
      const fullyDet = registry.determinism_policy.fully_deterministic_modules;
      expect(fullyDet).toContain('@isl/string');
      expect(fullyDet).toContain('@isl/math');
      expect(fullyDet).toContain('@isl/collections');
      expect(fullyDet).toContain('@isl/json');
      expect(fullyDet).toContain('@isl/encoding');
      expect(fullyDet).toContain('@isl/regex');
      expect(fullyDet).toContain('@isl/url');
    });

    test('mixed determinism modules are listed', () => {
      const mixedDet = registry.determinism_policy.mixed_determinism_modules;
      expect(mixedDet).toContain('@isl/datetime');
      expect(mixedDet).toContain('@isl/uuid');
      expect(mixedDet).toContain('@isl/crypto');
    });

    test('non-deterministic functions are explicitly listed', () => {
      const nonDetFns = registry.determinism_policy.nondeterministic_functions;
      
      // datetime
      expect(nonDetFns['@isl/datetime']).toContain('Now');
      
      // uuid
      expect(nonDetFns['@isl/uuid']).toContain('GenerateUUID');
      expect(nonDetFns['@isl/uuid']).toContain('GenerateUUIDv7');
      
      // crypto
      expect(nonDetFns['@isl/crypto']).toContain('GenerateToken');
      expect(nonDetFns['@isl/crypto']).toContain('GenerateApiKey');
      expect(nonDetFns['@isl/crypto']).toContain('GenerateBytes');
      expect(nonDetFns['@isl/crypto']).toContain('HashPassword');
    });
  });

  describe('Module File Resolution', () => {
    const workspaceRoot = path.resolve(__dirname, '../../../..');

    test('each module path points to existing directory', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        const mod = registry.modules[moduleName];
        const modulePath = path.join(workspaceRoot, mod.path);
        expect(fs.existsSync(modulePath)).toBe(true);
      }
    });

    test('each module has index.isl file', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        const mod = registry.modules[moduleName];
        expect(mod.files.index).toBe('index.isl');
        
        const indexPath = path.join(workspaceRoot, mod.path, 'index.isl');
        expect(fs.existsSync(indexPath)).toBe(true);
      }
    });

    test('module ISL files contain module declaration', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        const mod = registry.modules[moduleName];
        const indexPath = path.join(workspaceRoot, mod.path, 'index.isl');
        const content = fs.readFileSync(indexPath, 'utf-8');
        
        // Should contain "module" declaration
        expect(content).toMatch(/^module\s+\w+\s+version/m);
        
        // Should have deterministic annotations
        expect(content.toLowerCase()).toContain('deterministic');
      }
    });
  });

  describe('Module Exports', () => {
    test('each module exports symbols', () => {
      for (const moduleName of STDLIB_1_0_MODULES) {
        const mod = registry.modules[moduleName];
        expect(mod.exports.length).toBeGreaterThan(0);
      }
    });

    test('@isl/string exports expected symbols', () => {
      const exports = registry.modules['@isl/string'].exports;
      expect(exports).toContain('Length');
      expect(exports).toContain('Trim');
      expect(exports).toContain('ToLowerCase');
      expect(exports).toContain('Contains');
      expect(exports).toContain('Split');
      expect(exports).toContain('IsValidEmail');
    });

    test('@isl/math exports expected symbols', () => {
      const exports = registry.modules['@isl/math'].exports;
      expect(exports).toContain('Abs');
      expect(exports).toContain('Min');
      expect(exports).toContain('Max');
      expect(exports).toContain('Round');
      expect(exports).toContain('Sum');
      expect(exports).toContain('Average');
    });

    test('@isl/datetime exports Now (non-deterministic)', () => {
      const exports = registry.modules['@isl/datetime'].exports;
      expect(exports).toContain('Now');
    });

    test('@isl/uuid exports GenerateUUID (non-deterministic)', () => {
      const exports = registry.modules['@isl/uuid'].exports;
      expect(exports).toContain('GenerateUUID');
      expect(exports).toContain('GenerateUUIDv5'); // deterministic
    });

    test('@isl/crypto exports hash and generation functions', () => {
      const exports = registry.modules['@isl/crypto'].exports;
      expect(exports).toContain('Hash');
      expect(exports).toContain('HashSHA256');
      expect(exports).toContain('GenerateToken');
      expect(exports).toContain('ConstantTimeEquals');
    });
  });
});

describe('Stdlib Module Content Validation', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../..');

  test('@isl/string module is 100% deterministic', () => {
    const content = fs.readFileSync(
      path.join(workspaceRoot, 'stdlib/string/index.isl'),
      'utf-8'
    );
    
    // Should not have deterministic: false
    expect(content).not.toMatch(/deterministic:\s*false/i);
  });

  test('@isl/datetime module marks Now as non-deterministic', () => {
    const content = fs.readFileSync(
      path.join(workspaceRoot, 'stdlib/datetime/index.isl'),
      'utf-8'
    );
    
    // Find Now behavior and check it's marked non-deterministic
    const nowMatch = content.match(/behavior\s+Now\s*\{[\s\S]*?deterministic:\s*(true|false)/);
    expect(nowMatch).toBeTruthy();
    expect(nowMatch![1]).toBe('false');
  });

  test('@isl/uuid module marks GenerateUUID as non-deterministic', () => {
    const content = fs.readFileSync(
      path.join(workspaceRoot, 'stdlib/uuid/index.isl'),
      'utf-8'
    );
    
    // GenerateUUID should be non-deterministic
    const genMatch = content.match(/behavior\s+GenerateUUID\s*\{[\s\S]*?deterministic:\s*(true|false)/);
    expect(genMatch).toBeTruthy();
    expect(genMatch![1]).toBe('false');
    
    // GenerateUUIDv5 should be deterministic
    const gen5Match = content.match(/behavior\s+GenerateUUIDv5\s*\{[\s\S]*?deterministic:\s*(true|false)/);
    expect(gen5Match).toBeTruthy();
    expect(gen5Match![1]).toBe('true');
  });
});
