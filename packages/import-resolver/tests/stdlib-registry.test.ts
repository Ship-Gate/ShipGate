// ============================================================================
// Stdlib Registry Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StdlibRegistryManager,
  getStdlibRegistry,
  createStdlibRegistry,
  resetStdlibRegistry,
} from '../src/stdlib-registry.js';

describe('StdlibRegistryManager', () => {
  beforeEach(() => {
    resetStdlibRegistry();
  });

  describe('Module Registration', () => {
    it('should have 10 registered stdlib modules', () => {
      const registry = getStdlibRegistry();
      const modules = registry.getAvailableModules();
      
      expect(modules.length).toBe(10);
      
      // Original 5 modules
      expect(modules).toContain('@isl/auth');
      expect(modules).toContain('@isl/rate-limit');
      expect(modules).toContain('@isl/audit');
      expect(modules).toContain('@isl/payments');
      expect(modules).toContain('@isl/uploads');
      
      // New 5 modules
      expect(modules).toContain('@isl/datetime');
      expect(modules).toContain('@isl/strings');
      expect(modules).toContain('@isl/crypto');
      expect(modules).toContain('@isl/uuid');
      expect(modules).toContain('@isl/json');
    });

    it('should have correct aliases for all modules', () => {
      const registry = getStdlibRegistry();
      const aliases = registry.getAliases();
      
      // Original aliases
      expect(aliases['stdlib-auth']).toBe('@isl/auth');
      expect(aliases['stdlib-rate-limit']).toBe('@isl/rate-limit');
      expect(aliases['stdlib-audit']).toBe('@isl/audit');
      expect(aliases['stdlib-payments']).toBe('@isl/payments');
      expect(aliases['stdlib-uploads']).toBe('@isl/uploads');
      expect(aliases['stdlib-billing']).toBe('@isl/payments');
      
      // New aliases
      expect(aliases['stdlib-datetime']).toBe('@isl/datetime');
      expect(aliases['stdlib-strings']).toBe('@isl/strings');
      expect(aliases['stdlib-crypto']).toBe('@isl/crypto');
      expect(aliases['stdlib-uuid']).toBe('@isl/uuid');
      expect(aliases['stdlib-json']).toBe('@isl/json');
    });
  });

  describe('@isl/datetime module', () => {
    it('should be recognized as stdlib module', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.isStdlibModule('@isl/datetime')).toBe(true);
      expect(registry.isStdlibModule('stdlib-datetime')).toBe(true);
    });

    it('should resolve alias to canonical name', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.resolveAlias('stdlib-datetime')).toBe('@isl/datetime');
    });

    it('should have correct module definition', () => {
      const registry = getStdlibRegistry();
      const module = registry.getModule('@isl/datetime');
      
      expect(module).not.toBeNull();
      expect(module!.version).toBe('1.0.0');
      expect(module!.path).toBe('stdlib/datetime');
      expect(module!.files['index']).toBe('index.isl');
      expect(module!.description).toContain('Date and time');
    });

    it('should export deterministic and non-deterministic functions', () => {
      const registry = getStdlibRegistry();
      const exports = registry.getModuleExports('@isl/datetime');
      
      // Types
      expect(exports).toContain('Timestamp');
      expect(exports).toContain('Duration');
      expect(exports).toContain('TimeZone');
      
      // Non-deterministic
      expect(exports).toContain('Now');
      
      // Deterministic
      expect(exports).toContain('AddDuration');
      expect(exports).toContain('SubtractDuration');
      expect(exports).toContain('FormatTimestamp');
      expect(exports).toContain('ParseTimestamp');
      expect(exports).toContain('IsLeapYear');
      expect(exports).toContain('DaysInMonth');
    });
  });

  describe('@isl/strings module', () => {
    it('should be recognized as stdlib module', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.isStdlibModule('@isl/strings')).toBe(true);
      expect(registry.isStdlibModule('stdlib-strings')).toBe(true);
    });

    it('should have correct exports', () => {
      const registry = getStdlibRegistry();
      const exports = registry.getModuleExports('@isl/strings');
      
      // String operations
      expect(exports).toContain('Length');
      expect(exports).toContain('Trim');
      expect(exports).toContain('ToLowerCase');
      expect(exports).toContain('ToUpperCase');
      expect(exports).toContain('Split');
      expect(exports).toContain('Join');
      
      // Validation
      expect(exports).toContain('IsValidEmail');
      expect(exports).toContain('IsValidUrl');
      expect(exports).toContain('IsValidPhone');
      expect(exports).toContain('MatchesPattern');
      
      // Encoding
      expect(exports).toContain('EncodeBase64');
      expect(exports).toContain('DecodeBase64');
    });
  });

  describe('@isl/crypto module', () => {
    it('should be recognized as stdlib module', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.isStdlibModule('@isl/crypto')).toBe(true);
      expect(registry.isStdlibModule('stdlib-crypto')).toBe(true);
    });

    it('should have correct exports', () => {
      const registry = getStdlibRegistry();
      const exports = registry.getModuleExports('@isl/crypto');
      
      // Hash functions (deterministic)
      expect(exports).toContain('Hash');
      expect(exports).toContain('HashSHA256');
      expect(exports).toContain('HashSHA512');
      expect(exports).toContain('Hmac');
      expect(exports).toContain('VerifyHmac');
      
      // Password functions
      expect(exports).toContain('HashPassword');
      expect(exports).toContain('VerifyPassword');
      
      // Non-deterministic
      expect(exports).toContain('GenerateToken');
      expect(exports).toContain('GenerateApiKey');
      expect(exports).toContain('GenerateBytes');
    });
  });

  describe('@isl/uuid module', () => {
    it('should be recognized as stdlib module', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.isStdlibModule('@isl/uuid')).toBe(true);
      expect(registry.isStdlibModule('stdlib-uuid')).toBe(true);
    });

    it('should have correct exports', () => {
      const registry = getStdlibRegistry();
      const exports = registry.getModuleExports('@isl/uuid');
      
      // Types
      expect(exports).toContain('UUID');
      expect(exports).toContain('UUIDVersion');
      expect(exports).toContain('UUIDFormat');
      
      // Non-deterministic generation
      expect(exports).toContain('GenerateUUID');
      expect(exports).toContain('GenerateUUIDv7');
      
      // Deterministic generation
      expect(exports).toContain('GenerateUUIDv5');
      expect(exports).toContain('GenerateUUIDv3');
      
      // Validation
      expect(exports).toContain('IsValidUUID');
      expect(exports).toContain('IsNilUUID');
      expect(exports).toContain('NormalizeUUID');
    });
  });

  describe('@isl/json module', () => {
    it('should be recognized as stdlib module', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.isStdlibModule('@isl/json')).toBe(true);
      expect(registry.isStdlibModule('stdlib-json')).toBe(true);
    });

    it('should have correct exports', () => {
      const registry = getStdlibRegistry();
      const exports = registry.getModuleExports('@isl/json');
      
      // Types
      expect(exports).toContain('JSONValue');
      expect(exports).toContain('JSONObject');
      expect(exports).toContain('JSONArray');
      expect(exports).toContain('JSONPath');
      
      // Parsing/Serialization
      expect(exports).toContain('Parse');
      expect(exports).toContain('Stringify');
      expect(exports).toContain('IsValid');
      
      // Access
      expect(exports).toContain('Get');
      expect(exports).toContain('Has');
      expect(exports).toContain('Set');
      
      // Comparison
      expect(exports).toContain('Equals');
      expect(exports).toContain('Diff');
    });
  });

  describe('Module Resolution', () => {
    it('should resolve module paths correctly', () => {
      const registry = getStdlibRegistry();
      
      const resolved = registry.resolveModule('@isl/datetime');
      expect(resolved).not.toBeNull();
      expect(resolved!.name).toBe('@isl/datetime');
      expect(resolved!.absolutePath).toContain('stdlib');
      expect(resolved!.absolutePath).toContain('datetime');
    });

    it('should resolve module files', () => {
      const registry = getStdlibRegistry();
      
      const filePath = registry.resolveModuleFile('@isl/datetime/index');
      expect(filePath).not.toBeNull();
      expect(filePath).toContain('index.isl');
    });

    it('should resolve aliases to module files', () => {
      const registry = getStdlibRegistry();
      
      const filePath = registry.resolveModuleFile('stdlib-datetime');
      expect(filePath).not.toBeNull();
    });
  });

  describe('Export Checking', () => {
    it('should check if symbol is exported', () => {
      const registry = getStdlibRegistry();
      
      expect(registry.isExported('@isl/datetime', 'Now')).toBe(true);
      expect(registry.isExported('@isl/datetime', 'AddDuration')).toBe(true);
      expect(registry.isExported('@isl/datetime', 'NonExistent')).toBe(false);
      
      expect(registry.isExported('@isl/strings', 'Trim')).toBe(true);
      expect(registry.isExported('@isl/strings', 'IsValidEmail')).toBe(true);
      
      expect(registry.isExported('@isl/crypto', 'HashSHA256')).toBe(true);
      expect(registry.isExported('@isl/crypto', 'GenerateToken')).toBe(true);
      
      expect(registry.isExported('@isl/uuid', 'GenerateUUID')).toBe(true);
      expect(registry.isExported('@isl/uuid', 'IsValidUUID')).toBe(true);
      
      expect(registry.isExported('@isl/json', 'Parse')).toBe(true);
      expect(registry.isExported('@isl/json', 'Stringify')).toBe(true);
    });
  });

  describe('Singleton Behavior', () => {
    it('should return same instance from getStdlibRegistry', () => {
      const registry1 = getStdlibRegistry();
      const registry2 = getStdlibRegistry();
      
      expect(registry1).toBe(registry2);
    });

    it('should create new instance with createStdlibRegistry', () => {
      const registry1 = getStdlibRegistry();
      const registry2 = createStdlibRegistry({});
      
      expect(registry1).not.toBe(registry2);
    });

    it('should reset singleton with resetStdlibRegistry', () => {
      const registry1 = getStdlibRegistry();
      resetStdlibRegistry();
      const registry2 = getStdlibRegistry();
      
      expect(registry1).not.toBe(registry2);
    });
  });
});

describe('Stdlib Module Count Verification', () => {
  it('should have exactly 10 modules for 1.0 release', () => {
    const registry = getStdlibRegistry();
    const modules = registry.getAvailableModules();
    
    expect(modules.length).toBeGreaterThanOrEqual(10);
    
    const requiredModules = [
      '@isl/auth',
      '@isl/rate-limit',
      '@isl/audit',
      '@isl/payments',
      '@isl/uploads',
      '@isl/datetime',
      '@isl/strings',
      '@isl/crypto',
      '@isl/uuid',
      '@isl/json',
    ];
    
    for (const mod of requiredModules) {
      expect(modules).toContain(mod);
    }
  });
});
