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

    it('parses stdlib-core (short name)', () => {
      const result = parseImportPath('stdlib-core');
      expect(result).toEqual({
        moduleName: 'stdlib-core',
        subpath: '.',
      });
    });

    it('parses stdlib-security/cors', () => {
      const result = parseImportPath('stdlib-security/cors');
      expect(result).toEqual({
        moduleName: 'stdlib-security',
        subpath: '/cors',
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
      expect(isStdlibImport('@isl/stdlib-core')).toBe(true);
      expect(isStdlibImport('@isl/stdlib-http')).toBe(true);
      expect(isStdlibImport('@isl/stdlib-storage')).toBe(true);
      expect(isStdlibImport('@isl/stdlib-security')).toBe(true);
    });

    it('returns true for @isl-lang/stdlib-* imports', () => {
      expect(isStdlibImport('@isl-lang/stdlib-auth')).toBe(true);
    });

    it('returns true for stdlib-* imports', () => {
      expect(isStdlibImport('stdlib-auth')).toBe(true);
      expect(isStdlibImport('stdlib-core')).toBe(true);
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
        expect(result.filePath).toMatch(/\.isl$/);
        expect(result.provides.entities).toContain('Session');
        expect(result.provides.behaviors).toContain('InitiateOAuth');
      }
    });

    it('resolves @isl/stdlib-core to module and file', () => {
      const result = resolveStdlibImport('@isl/stdlib-core');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.module.name).toBe('@isl-lang/stdlib-core');
        expect(result.provides.types).toContain('Email');
        expect(result.provides.types).toContain('UUID');
      }
    });

    it('resolves @isl/stdlib-http to module and file', () => {
      const result = resolveStdlibImport('@isl/stdlib-http');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.module.name).toBe('@isl-lang/stdlib-http');
        expect(result.provides.entities).toContain('HTTPRequest');
      }
    });

    it('resolves @isl/stdlib-storage to module and file', () => {
      const result = resolveStdlibImport('@isl/stdlib-storage');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.module.name).toBe('@isl-lang/stdlib-storage');
        expect(result.provides.behaviors).toContain('Create');
      }
    });

    it('resolves @isl/stdlib-security to module and file', () => {
      const result = resolveStdlibImport('@isl/stdlib-security');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.module.name).toBe('@isl-lang/stdlib-security');
        expect(result.provides.behaviors).toContain('CheckRateLimit');
      }
    });

    it('resolves @isl/stdlib-auth/session-create subpath', () => {
      const result = resolveStdlibImport('@isl/stdlib-auth/session-create');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.filePath).toContain('session-create');
      }
    });

    it('resolves @isl/stdlib-security/cors subpath', () => {
      const result = resolveStdlibImport('@isl/stdlib-security/cors');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.filePath).toContain('cors');
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
        '@isl/stdlib-core',
      ]);
      expect(errors).toHaveLength(0);
      expect(resolved).toHaveLength(2);
      expect(resolved[0]?.module.name).toContain('auth');
      expect(resolved[1]?.module.name).toContain('core');
    });

    it('resolves all 6 stdlib modules', () => {
      const { resolved, errors } = resolveImports([
        'stdlib-core',
        'stdlib-auth',
        'stdlib-http',
        'stdlib-payments',
        'stdlib-storage',
        'stdlib-security',
      ]);
      expect(errors).toHaveLength(0);
      expect(resolved).toHaveLength(6);
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
      const suggestions = getSuggestions('Payment');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('suggests modules for behavior name', () => {
      const suggestions = getSuggestions('CheckRateLimit');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('suggests core for Email type', () => {
      const suggestions = getSuggestions('Email');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('mergeProvides', () => {
    it('merges provides from multiple imports', () => {
      const { resolved } = resolveImports([
        '@isl/stdlib-auth',
        '@isl/stdlib-security',
      ]);
      const merged = mergeProvides(resolved);
      expect(merged.entities).toContain('Session');
      expect(merged.entities).toContain('RateLimitConfig');
      expect(merged.behaviors).toContain('InitiateOAuth');
      expect(merged.behaviors).toContain('CheckRateLimit');
    });

    it('deduplicates entities', () => {
      const { resolved } = resolveImports([
        '@isl/stdlib-auth',
        '@isl/stdlib-auth',
      ]);
      const merged = mergeProvides(resolved);
      const sessionCount = merged.entities.filter(e => e === 'Session').length;
      expect(sessionCount).toBe(1);
    });
  });
});
