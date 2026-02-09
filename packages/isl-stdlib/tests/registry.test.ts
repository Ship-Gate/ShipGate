/**
 * Registry Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getRegistry,
  getModule,
  getModuleNames,
  getModulesByCategory,
  searchModules,
  findModulesWithEntity,
  findModulesWithBehavior,
  resolveDependencyTree,
  resolveImportAlias,
  validateRegistry,
  getRegistryStats,
} from '../src/registry.js';

describe('Registry', () => {
  describe('getRegistry', () => {
    it('returns the registry object', () => {
      const registry = getRegistry();
      expect(registry).toBeDefined();
      expect(registry.version).toBe('1.0.0');
      expect(registry.modules).toBeDefined();
      expect(registry.categories).toBeDefined();
      expect(registry.importAliases).toBeDefined();
    });
  });

  describe('getModuleNames', () => {
    it('returns all 6 module names', () => {
      const names = getModuleNames();
      expect(names).toContain('stdlib-core');
      expect(names).toContain('stdlib-auth');
      expect(names).toContain('stdlib-http');
      expect(names).toContain('stdlib-payments');
      expect(names).toContain('stdlib-storage');
      expect(names).toContain('stdlib-security');
      expect(names).toHaveLength(6);
    });
  });

  describe('getModule', () => {
    it('returns a module by short name', () => {
      const module = getModule('stdlib-auth');
      expect(module).toBeDefined();
      expect(module?.name).toBe('@isl-lang/stdlib-auth');
      expect(module?.version).toBe('1.0.0');
    });

    it('returns a module without stdlib- prefix', () => {
      const module = getModule('auth');
      expect(module).toBeDefined();
      expect(module?.name).toBe('@isl-lang/stdlib-auth');
    });

    it('returns undefined for unknown module', () => {
      const module = getModule('stdlib-unknown');
      expect(module).toBeUndefined();
    });
  });

  describe('getModulesByCategory', () => {
    it('returns modules in the security category', () => {
      const modules = getModulesByCategory('security');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.some(m => m.name.includes('auth'))).toBe(true);
      expect(modules.some(m => m.name.includes('security'))).toBe(true);
    });

    it('returns modules in the business category', () => {
      const modules = getModulesByCategory('business');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.some(m => m.name.includes('payments'))).toBe(true);
    });

    it('returns modules in the data category', () => {
      const modules = getModulesByCategory('data');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.some(m => m.name.includes('core'))).toBe(true);
    });
  });

  describe('searchModules', () => {
    it('finds modules by keyword', () => {
      const modules = searchModules('auth');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('auth');
    });

    it('finds modules by description keyword', () => {
      const modules = searchModules('payment');
      expect(modules.length).toBeGreaterThan(0);
    });

    it('finds modules by security keyword', () => {
      const modules = searchModules('rate-limit');
      expect(modules.length).toBeGreaterThan(0);
    });
  });

  describe('findModulesWithEntity', () => {
    it('finds modules that provide Payment entity', () => {
      const modules = findModulesWithEntity('Payment');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('payments');
    });

    it('finds modules that provide Session entity', () => {
      const modules = findModulesWithEntity('Session');
      expect(modules.length).toBeGreaterThan(0);
    });

    it('finds modules that provide HTTPRequest entity', () => {
      const modules = findModulesWithEntity('HTTPRequest');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('http');
    });

    it('finds modules that provide RateLimitConfig entity', () => {
      const modules = findModulesWithEntity('RateLimitConfig');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('security');
    });
  });

  describe('findModulesWithBehavior', () => {
    it('finds modules that provide InitiateOAuth behavior', () => {
      const modules = findModulesWithBehavior('InitiateOAuth');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('auth');
    });

    it('finds modules that provide Create behavior', () => {
      const modules = findModulesWithBehavior('Create');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('storage');
    });

    it('finds modules that provide CheckRateLimit behavior', () => {
      const modules = findModulesWithBehavior('CheckRateLimit');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('security');
    });
  });

  describe('resolveDependencyTree', () => {
    it('resolves dependencies in topological order', () => {
      const deps = resolveDependencyTree('stdlib-payments');
      expect(deps).toContain('stdlib-core');
      expect(deps).toContain('stdlib-payments');
      expect(deps.indexOf('stdlib-core')).toBeLessThan(deps.indexOf('stdlib-payments'));
    });

    it('resolves core with no dependencies', () => {
      const deps = resolveDependencyTree('stdlib-core');
      expect(deps).toHaveLength(1);
      expect(deps).toContain('stdlib-core');
    });
  });

  describe('resolveImportAlias', () => {
    it('resolves @isl/stdlib-auth alias', () => {
      const result = resolveImportAlias('@isl/stdlib-auth');
      expect(result).toBe('stdlib-auth');
    });

    it('resolves @isl/auth short alias', () => {
      const result = resolveImportAlias('@isl/auth');
      expect(result).toBe('stdlib-auth');
    });

    it('resolves @isl/stdlib-core alias', () => {
      const result = resolveImportAlias('@isl/stdlib-core');
      expect(result).toBe('stdlib-core');
    });

    it('resolves @isl/stdlib-security alias', () => {
      const result = resolveImportAlias('@isl/stdlib-security');
      expect(result).toBe('stdlib-security');
    });

    it('resolves subpath imports', () => {
      const result = resolveImportAlias('@isl/stdlib-auth/session');
      expect(result).toBe('stdlib-auth');
    });

    it('returns undefined for unknown alias', () => {
      const result = resolveImportAlias('@isl/unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('validateRegistry', () => {
    it('validates the registry successfully', () => {
      const { valid, errors } = validateRegistry();
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });
  });

  describe('getRegistryStats', () => {
    it('returns registry statistics', () => {
      const stats = getRegistryStats();
      expect(stats.totalModules).toBe(6);
      expect(stats.totalEntities).toBeGreaterThan(0);
      expect(stats.totalBehaviors).toBeGreaterThan(0);
      expect(stats.totalTypes).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
    });
  });
});
