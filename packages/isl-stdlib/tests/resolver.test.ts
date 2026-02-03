/**
 * Resolver Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseImportPath,
  isStdlibImport,
  resolveStdlibImport,
  resolveImports,
  getSuggestions,
  mergeProvides,
} from '../src/resolver.js';

describe('Resolver', () => {
  describe('parseImportPath', () => {
    it('parses @isl/stdlib-auth', () => {
      const result = parseImportPath('@isl/stdlib-auth');
      expect(result).toEqual({
        moduleName: 'stdlib-auth',
        subpath: '.',
      });
    });

    it('parses @isl/stdlib-auth/session', () => {
      const result = parseImportPath('@isl/stdlib-auth/session');
      expect(result).toEqual({
        moduleName: 'stdlib-auth',
        subpath: '/session',
      });
    });

    it('parses @isl-lang/stdlib-auth', () => {
      const result = parseImportPath('@isl-lang/stdlib-auth');
      expect(result).toEqual({
        moduleName: 'stdlib-auth',
        subpath: '.',
      });
    });

    it('parses stdlib-auth (short name)', () => {
      const result = parseImportPath('stdlib-auth');
      expect(result).toEqual({
        moduleName: 'stdlib-auth',
        subpath: '.',
      });
    });

    it('parses stdlib-auth/behaviors/login', () => {
      const result = parseImportPath('stdlib-auth/behaviors/login');
      expect(result).toEqual({
        moduleName: 'stdlib-auth',
        subpath: '/behaviors/login',
      });
    });

    it('returns null for non-stdlib import', () => {
      const result = parseImportPath('./local-file.isl');
      expect(result).toBeNull();
    });
  });

  describe('isStdlibImport', () => {
    it('returns true for @isl/stdlib-* imports', () => {
      expect(isStdlibImport('@isl/stdlib-auth')).toBe(true);
      expect(isStdlibImport('@isl/stdlib-payments')).toBe(true);
    });

    it('returns true for @isl-lang/stdlib-* imports', () => {
      expect(isStdlibImport('@isl-lang/stdlib-auth')).toBe(true);
    });

    it('returns true for stdlib-* imports', () => {
      expect(isStdlibImport('stdlib-auth')).toBe(true);
    });

    it('returns false for other imports', () => {
      expect(isStdlibImport('./local.isl')).toBe(false);
      expect(isStdlibImport('../other.isl')).toBe(false);
      expect(isStdlibImport('some-package')).toBe(false);
    });
  });

  describe('resolveStdlibImport', () => {
    it('resolves @isl/stdlib-auth to module and file', () => {
      const result = resolveStdlibImport('@isl/stdlib-auth');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.module.name).toBe('@isl-lang/stdlib-auth');
        expect(result.filePath).toBe('intents/domain.isl');
        expect(result.provides.entities).toContain('User');
        expect(result.provides.behaviors).toContain('Login');
      }
    });

    it('resolves @isl/stdlib-auth/session subpath', () => {
      const result = resolveStdlibImport('@isl/stdlib-auth/session');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.filePath).toBe('intents/session.isl');
      }
    });

    it('returns error for unknown module', () => {
      const result = resolveStdlibImport('@isl/stdlib-unknown');
      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toBe('MODULE_NOT_FOUND');
        expect(result.suggestions).toBeDefined();
      }
    });

    it('returns error for unknown subpath', () => {
      const result = resolveStdlibImport('@isl/stdlib-auth/unknown');
      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toBe('SUBPATH_NOT_FOUND');
        expect(result.suggestions).toBeDefined();
      }
    });

    it('returns error for invalid import path', () => {
      const result = resolveStdlibImport('./local-file.isl');
      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toBe('INVALID_IMPORT');
      }
    });
  });

  describe('resolveImports', () => {
    it('resolves multiple imports', () => {
      const { resolved, errors } = resolveImports([
        '@isl/stdlib-auth',
        '@isl/stdlib-rate-limit',
      ]);
      expect(errors).toHaveLength(0);
      expect(resolved).toHaveLength(2);
      expect(resolved[0]?.module.name).toContain('auth');
      expect(resolved[1]?.module.name).toContain('rate-limit');
    });

    it('collects errors for invalid imports', () => {
      const { resolved, errors } = resolveImports([
        '@isl/stdlib-auth',
        '@isl/stdlib-unknown',
      ]);
      expect(resolved).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.code).toBe('MODULE_NOT_FOUND');
    });
  });

  describe('getSuggestions', () => {
    it('suggests modules for partial match', () => {
      const suggestions = getSuggestions('auth');
      expect(suggestions).toContain('@isl/stdlib-auth');
    });

    it('suggests modules for entity name', () => {
      const suggestions = getSuggestions('User');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('suggests modules for behavior name', () => {
      const suggestions = getSuggestions('Login');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('mergeProvides', () => {
    it('merges provides from multiple imports', () => {
      const { resolved } = resolveImports([
        '@isl/stdlib-auth',
        '@isl/stdlib-rate-limit',
      ]);
      const merged = mergeProvides(resolved);
      expect(merged.entities).toContain('User');
      expect(merged.entities).toContain('RateLimitBucket');
      expect(merged.behaviors).toContain('Login');
    });

    it('deduplicates entities', () => {
      const { resolved } = resolveImports([
        '@isl/stdlib-auth',
        '@isl/stdlib-auth',
      ]);
      const merged = mergeProvides(resolved);
      const userCount = merged.entities.filter(e => e === 'User').length;
      expect(userCount).toBe(1);
    });
  });
});
