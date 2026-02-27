/**
 * Smoke Tests
 * 
 * Verify that all 6 stdlib modules can be resolved with integrity verification.
 * Tests the core use case: importing stdlib-* in an ISL spec.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getModule,
  getModuleNames,
  getRegistry,
  resolveStdlibImport,
  validateRegistry,
  resolveDependencyTree,
  createVersionPin,
  calculateManifestHash,
  type StdlibVersionPin,
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STDLIB_ROOT = path.resolve(__dirname, '../../../stdlib');

/** All 6 canonical stdlib module names */
const CANONICAL_MODULES = [
  'stdlib-core',
  'stdlib-auth',
  'stdlib-http',
  'stdlib-payments',
  'stdlib-storage',
  'stdlib-security',
] as const;

describe('Smoke Tests', () => {
  describe('All 6 canonical modules exist', () => {
    it('registry contains exactly 6 modules', () => {
      const names = getModuleNames();
      expect(names).toHaveLength(6);
      for (const mod of CANONICAL_MODULES) {
        expect(names).toContain(mod);
      }
    });

    for (const moduleName of CANONICAL_MODULES) {
      it(`${moduleName} module resolves with correct metadata`, () => {
        const module = getModule(moduleName);
        expect(module).toBeDefined();
        expect(module?.name).toBe(`@isl-lang/${moduleName}`);
        expect(module?.version).toBe('1.0.0');
        expect(module?.status).toBe('implemented');
      });

      it(`${moduleName} has entry point`, () => {
        const module = getModule(moduleName);
        expect(module?.entryPoint).toBeDefined();
        expect(module?.entryPoint).toMatch(/\.isl$/);
      });

      it(`${moduleName} has module hash for integrity verification`, () => {
        const module = getModule(moduleName);
        expect(module?.moduleHash).toBeDefined();
        expect(module?.moduleHash).toHaveLength(64); // SHA-256 hex
      });

      it(`${moduleName} has file hashes for all ISL files`, () => {
        const module = getModule(moduleName);
        expect(module?.files).toBeDefined();
        expect(module?.files.length).toBeGreaterThan(0);
        
        for (const file of module?.files ?? []) {
          expect(file.path).toMatch(/\.isl$/);
          expect(file.contentHash).toHaveLength(64);
        }
      });

      it(`can resolve @isl/${moduleName} import path`, () => {
        const result = resolveStdlibImport(`@isl/${moduleName}`);
        expect('code' in result).toBe(false);
        if (!('code' in result)) {
          expect(result.module.name).toBe(`@isl-lang/${moduleName}`);
          expect(result.filePath).toMatch(/\.isl$/);
        }
      });

      it(`can resolve ${moduleName} short-name import`, () => {
        const result = resolveStdlibImport(moduleName);
        expect('code' in result).toBe(false);
        if (!('code' in result)) {
          expect(result.module.name).toBe(`@isl-lang/${moduleName}`);
        }
      });
    }
  });

  describe('stdlib-core module', () => {
    it('provides base type definitions', () => {
      const module = getModule('stdlib-core');
      expect(module?.provides.types).toContain('Email');
      expect(module?.provides.types).toContain('URL');
      expect(module?.provides.types).toContain('UUID');
      expect(module?.provides.types).toContain('Timestamp');
      expect(module?.provides.types).toContain('Currency');
      expect(module?.provides.types).toContain('Money');
      expect(module?.provides.types).toContain('PageSize');
    });

    it('provides pagination entities', () => {
      const module = getModule('stdlib-core');
      expect(module?.provides.entities).toContain('PageInfo');
      expect(module?.provides.entities).toContain('AuditMetadata');
    });
  });

  describe('stdlib-auth module', () => {
    it('provides Session entity', () => {
      const module = getModule('stdlib-auth');
      expect(module?.provides.entities).toContain('Session');
    });

    it('provides OAuthCredential entity', () => {
      const module = getModule('stdlib-auth');
      expect(module?.provides.entities).toContain('OAuthCredential');
    });

    it('provides login behaviors', () => {
      const module = getModule('stdlib-auth');
      expect(module?.provides.behaviors).toContain('InitiateOAuth');
      expect(module?.provides.behaviors).toContain('CreateSession');
    });

    it('depends on stdlib-core', () => {
      const module = getModule('stdlib-auth');
      expect(module?.dependencies).toContain('stdlib-core');
    });
  });

  describe('stdlib-http module', () => {
    it('provides HTTP entities', () => {
      const module = getModule('stdlib-http');
      expect(module?.provides.entities).toContain('HTTPRequest');
      expect(module?.provides.entities).toContain('HTTPResponse');
      expect(module?.provides.entities).toContain('HTTPError');
    });

    it('provides middleware behaviors', () => {
      const module = getModule('stdlib-http');
      expect(module?.provides.behaviors).toContain('SendRequest');
      expect(module?.provides.behaviors).toContain('CheckCircuitBreaker');
    });
  });

  describe('stdlib-payments module', () => {
    it('provides Payment entity', () => {
      const module = getModule('stdlib-payments');
      expect(module?.provides.entities).toContain('Payment');
    });

    it('has peer dependency on stdlib-auth', () => {
      const module = getModule('stdlib-payments');
      expect(module?.peerDependencies).toContain('stdlib-auth');
    });
  });

  describe('stdlib-storage module', () => {
    it('provides CRUD behaviors', () => {
      const module = getModule('stdlib-storage');
      expect(module?.provides.behaviors).toContain('Create');
      expect(module?.provides.behaviors).toContain('Read');
      expect(module?.provides.behaviors).toContain('Update');
      expect(module?.provides.behaviors).toContain('Delete');
      expect(module?.provides.behaviors).toContain('List');
    });

    it('provides search behaviors', () => {
      const module = getModule('stdlib-storage');
      expect(module?.provides.behaviors).toContain('Search');
      expect(module?.provides.behaviors).toContain('Suggest');
    });

    it('provides soft-delete entity', () => {
      const module = getModule('stdlib-storage');
      expect(module?.provides.entities).toContain('SoftDeleteMetadata');
    });
  });

  describe('stdlib-security module', () => {
    it('provides rate limit entities', () => {
      const module = getModule('stdlib-security');
      expect(module?.provides.entities).toContain('RateLimitConfig');
      expect(module?.provides.entities).toContain('RateLimitResult');
    });

    it('provides CORS/CSRF entities', () => {
      const module = getModule('stdlib-security');
      expect(module?.provides.entities).toContain('CORSConfig');
      expect(module?.provides.entities).toContain('CSRFConfig');
      expect(module?.provides.entities).toContain('CSRFToken');
    });

    it('provides security behaviors', () => {
      const module = getModule('stdlib-security');
      expect(module?.provides.behaviors).toContain('CheckRateLimit');
      expect(module?.provides.behaviors).toContain('ValidateInput');
      expect(module?.provides.behaviors).toContain('SanitizeString');
      expect(module?.provides.behaviors).toContain('CheckCORS');
      expect(module?.provides.behaviors).toContain('ValidateCSRFToken');
    });
  });

  describe('Content Hash Verification', () => {
    for (const moduleName of CANONICAL_MODULES) {
      it(`verifies ${moduleName} file hashes match actual files`, async () => {
        const module = getModule(moduleName);
        expect(module).toBeDefined();

        for (const fileEntry of module?.files ?? []) {
          const filePath = path.join(STDLIB_ROOT, fileEntry.path);
          const content = await fs.readFile(filePath, 'utf-8');
          const actualHash = crypto.createHash('sha256').update(content).digest('hex');
          expect(actualHash).toBe(fileEntry.contentHash);
        }
      });
    }

    it('module hash is derived from file hashes', () => {
      const module = getModule('stdlib-auth');
      expect(module).toBeDefined();

      const sortedFiles = [...(module?.files ?? [])].sort((a, b) => a.path.localeCompare(b.path));
      const combined = sortedFiles.map(f => `${f.path}:${f.contentHash}`).join('\n');
      const expectedHash = crypto.createHash('sha256').update(combined).digest('hex');

      expect(module?.moduleHash).toBe(expectedHash);
    });
  });

  describe('Version Pinning', () => {
    it('creates version pin from module', () => {
      const module = getModule('stdlib-auth');
      expect(module).toBeDefined();

      const pin = createVersionPin(module!, 'stdlib-auth');
      
      expect(pin.moduleName).toBe('stdlib-auth');
      expect(pin.version).toBe('1.0.0');
      expect(pin.moduleHash).toBe(module!.moduleHash);
      expect(pin.entryPoint).toBe(module!.entryPoint);
    });

    it('calculates consistent manifest hash from pins', () => {
      const authModule = getModule('stdlib-auth');
      const paymentsModule = getModule('stdlib-payments');

      const pins: StdlibVersionPin[] = [
        createVersionPin(authModule!, 'stdlib-auth'),
        createVersionPin(paymentsModule!, 'stdlib-payments'),
      ];

      const hash1 = calculateManifestHash(pins);
      const hash2 = calculateManifestHash([...pins].reverse());

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
    });
  });

  describe('Registry Metadata', () => {
    it('registry has stdlibRoot', () => {
      const registry = getRegistry();
      expect(registry.stdlibRoot).toBe('stdlib');
    });

    it('registry has version', () => {
      const registry = getRegistry();
      expect(registry.version).toBe('1.0.0');
    });

    it('registry has categories with implemented modules', () => {
      const registry = getRegistry();
      expect(registry.categories.security.modules).toContain('stdlib-auth');
      expect(registry.categories.security.modules).toContain('stdlib-security');
      expect(registry.categories.business.modules).toContain('stdlib-payments');
      expect(registry.categories.storage.modules).toContain('stdlib-storage');
      expect(registry.categories.infrastructure.modules).toContain('stdlib-http');
      expect(registry.categories.data.modules).toContain('stdlib-core');
    });

    it('import aliases resolve correctly', () => {
      const registry = getRegistry();
      expect(registry.importAliases['@isl/stdlib-auth']).toBe('stdlib-auth');
      expect(registry.importAliases['@isl/auth']).toBe('stdlib-auth');
      expect(registry.importAliases['@isl/stdlib-core']).toBe('stdlib-core');
      expect(registry.importAliases['@isl/core']).toBe('stdlib-core');
      expect(registry.importAliases['@isl/stdlib-http']).toBe('stdlib-http');
      expect(registry.importAliases['@isl/stdlib-security']).toBe('stdlib-security');
      expect(registry.importAliases['@isl/stdlib-storage']).toBe('stdlib-storage');
    });
  });

  describe('Registry Validation', () => {
    it('registry passes validation', () => {
      const { valid, errors } = validateRegistry();
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('all implemented modules have required fields', () => {
      const registry = getRegistry();
      
      for (const [name, module] of Object.entries(registry.modules)) {
        if (module.status === 'implemented') {
          expect(module.entryPoint, `${name} missing entryPoint`).toBeDefined();
          expect(module.moduleHash, `${name} missing moduleHash`).toBeDefined();
          expect(module.files, `${name} missing files`).toBeDefined();
          expect(module.files.length, `${name} has no files`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Dependency Resolution', () => {
    it('resolves stdlib-auth dependency tree (includes core)', () => {
      const deps = resolveDependencyTree('stdlib-auth');
      expect(deps).toContain('stdlib-core');
      expect(deps).toContain('stdlib-auth');
      expect(deps.indexOf('stdlib-core')).toBeLessThan(deps.indexOf('stdlib-auth'));
    });

    it('resolves stdlib-payments dependency tree', () => {
      const deps = resolveDependencyTree('stdlib-payments');
      expect(deps).toContain('stdlib-core');
      expect(deps).toContain('stdlib-payments');
    });
  });

  describe('Clean Checkout Verification', () => {
    it('all stdlib files exist on disk', async () => {
      const registry = getRegistry();
      const missingFiles: string[] = [];

      for (const [moduleName, module] of Object.entries(registry.modules)) {
        if (module.status !== 'implemented') continue;

        for (const fileEntry of module.files) {
          const filePath = path.join(STDLIB_ROOT, fileEntry.path);
          try {
            await fs.access(filePath);
          } catch {
            missingFiles.push(`${moduleName}: ${fileEntry.path}`);
          }
        }
      }

      expect(missingFiles).toHaveLength(0);
    });
  });
});
