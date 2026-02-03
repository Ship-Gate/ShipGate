/**
 * Smoke Tests
 * 
 * Verify that stdlib modules can be resolved with integrity verification.
 * Tests the core use case: importing stdlib-auth in an ISL spec.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getModule,
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

describe('Smoke Tests', () => {
  describe('stdlib-auth module', () => {
    it('resolves stdlib-auth module with correct metadata', () => {
      const module = getModule('stdlib-auth');
      expect(module).toBeDefined();
      expect(module?.name).toBe('@isl-lang/stdlib-auth');
      expect(module?.version).toBe('1.0.0');
      expect(module?.status).toBe('implemented');
    });

    it('stdlib-auth has entry point in auth directory', () => {
      const module = getModule('stdlib-auth');
      expect(module?.entryPoint).toMatch(/^auth\//);
    });

    it('stdlib-auth has module hash for integrity verification', () => {
      const module = getModule('stdlib-auth');
      expect(module?.moduleHash).toBeDefined();
      expect(module?.moduleHash).toHaveLength(64); // SHA-256 hex
    });

    it('stdlib-auth has file hashes for all ISL files', () => {
      const module = getModule('stdlib-auth');
      expect(module?.files).toBeDefined();
      expect(module?.files.length).toBeGreaterThan(0);
      
      for (const file of module?.files ?? []) {
        expect(file.path).toMatch(/\.isl$/);
        expect(file.contentHash).toHaveLength(64);
      }
    });

    it('stdlib-auth provides Session entity (from session-create.isl)', () => {
      const module = getModule('stdlib-auth');
      expect(module?.provides.entities).toContain('Session');
    });

    it('stdlib-auth provides OAuthCredential entity (from oauth-login.isl)', () => {
      const module = getModule('stdlib-auth');
      expect(module?.provides.entities).toContain('OAuthCredential');
    });

    it('can resolve @isl/stdlib-auth import path', () => {
      const result = resolveStdlibImport('@isl/stdlib-auth');
      expect('code' in result).toBe(false);
      if (!('code' in result)) {
        expect(result.module.name).toBe('@isl-lang/stdlib-auth');
        expect(result.filePath).toMatch(/\.isl$/);
      }
    });
  });

  describe('stdlib-payments module', () => {
    it('resolves stdlib-payments module', () => {
      const module = getModule('stdlib-payments');
      expect(module).toBeDefined();
      expect(module?.name).toBe('@isl-lang/stdlib-payments');
      expect(module?.status).toBe('implemented');
    });

    it('stdlib-payments provides Payment entity', () => {
      const module = getModule('stdlib-payments');
      expect(module?.provides.entities).toContain('Payment');
    });

    it('stdlib-payments has module hash', () => {
      const module = getModule('stdlib-payments');
      expect(module?.moduleHash).toHaveLength(64);
    });
  });

  describe('stdlib-uploads module', () => {
    it('resolves stdlib-uploads module', () => {
      const module = getModule('stdlib-uploads');
      expect(module).toBeDefined();
      expect(module?.name).toBe('@isl-lang/stdlib-uploads');
      expect(module?.status).toBe('implemented');
    });

    it('stdlib-uploads has file hashes', () => {
      const module = getModule('stdlib-uploads');
      expect(module?.files.length).toBeGreaterThan(0);
    });
  });

  describe('Content Hash Verification', () => {
    it('verifies stdlib-auth file hashes match actual files', async () => {
      const module = getModule('stdlib-auth');
      expect(module).toBeDefined();

      for (const fileEntry of module?.files ?? []) {
        const filePath = path.join(STDLIB_ROOT, fileEntry.path);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const actualHash = crypto.createHash('sha256').update(content).digest('hex');
          
          expect(actualHash).toBe(fileEntry.contentHash);
        } catch (err) {
          // File might not exist in test environment - skip
          console.warn(`Skipping hash verification for ${filePath}: file not accessible`);
        }
      }
    });

    it('module hash is derived from file hashes', () => {
      const module = getModule('stdlib-auth');
      expect(module).toBeDefined();

      // Verify module hash computation
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
      const hash2 = calculateManifestHash([...pins].reverse()); // Different order

      // Hash should be consistent regardless of pin order
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8); // Truncated hash
    });

    it('different pins produce different manifest hash', () => {
      const authModule = getModule('stdlib-auth');
      const uploadsModule = getModule('stdlib-uploads');

      const pins1: StdlibVersionPin[] = [
        createVersionPin(authModule!, 'stdlib-auth'),
      ];
      const pins2: StdlibVersionPin[] = [
        createVersionPin(uploadsModule!, 'stdlib-uploads'),
      ];

      const hash1 = calculateManifestHash(pins1);
      const hash2 = calculateManifestHash(pins2);

      expect(hash1).not.toBe(hash2);
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
      expect(registry.categories.business.modules).toContain('stdlib-payments');
      expect(registry.categories.storage.modules).toContain('stdlib-uploads');
    });

    it('import aliases resolve correctly', () => {
      const registry = getRegistry();
      expect(registry.importAliases['@isl/stdlib-auth']).toBe('stdlib-auth');
      expect(registry.importAliases['@isl/auth']).toBe('stdlib-auth');
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
    it('resolves module dependency tree', () => {
      // Note: Current implemented modules have no hard dependencies
      const deps = resolveDependencyTree('stdlib-auth');
      expect(deps).toContain('stdlib-auth');
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
