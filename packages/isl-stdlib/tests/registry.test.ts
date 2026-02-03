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
    it('returns all module names', () => {
      const names = getModuleNames();
      expect(names).toContain('stdlib-auth');
      expect(names).toContain('stdlib-rate-limit');
      expect(names).toContain('stdlib-audit');
      expect(names).toContain('stdlib-payments');
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
      expect(modules.some(m => m.name.includes('rate-limit'))).toBe(true);
    });

    it('returns modules in the business category', () => {
      const modules = getModulesByCategory('business');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.some(m => m.name.includes('payments'))).toBe(true);
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
  });

  describe('findModulesWithEntity', () => {
    it('finds modules that provide User entity', () => {
      const modules = findModulesWithEntity('User');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('auth');
    });

    it('finds modules that provide Session entity', () => {
      const modules = findModulesWithEntity('Session');
      expect(modules.length).toBeGreaterThan(0);
    });
  });

  describe('findModulesWithBehavior', () => {
    it('finds modules that provide Login behavior', () => {
      const modules = findModulesWithBehavior('Login');
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]?.name).toContain('auth');
    });
  });

  describe('resolveDependencyTree', () => {
    it('resolves dependencies in topological order', () => {
      const deps = resolveDependencyTree('stdlib-saas');
      expect(deps).toContain('stdlib-auth');
      expect(deps).toContain('stdlib-saas');
      // Auth should come before saas
      expect(deps.indexOf('stdlib-auth')).toBeLessThan(deps.indexOf('stdlib-saas'));
    });

    it('returns single module for no dependencies', () => {
      const deps = resolveDependencyTree('stdlib-cache');
      expect(deps).toContain('stdlib-cache');
    });
  });

  describe('resolveImportAlias', () => {
    it('resolves @isl/stdlib-auth alias', () => {
      const result = resolveImportAlias('@isl/stdlib-auth');
      expect(result).toBe('stdlib-auth');
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
      expect(stats.totalModules).toBeGreaterThan(0);
      expect(stats.totalEntities).toBeGreaterThan(0);
      expect(stats.totalBehaviors).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
    });
  });
});
