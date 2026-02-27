/**
 * Tests for ShipGate Packs functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFile, mkdir, writeFile, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import {
  installPack,
  listPacks,
  verifyPackInstall,
  type PackInstallOptions,
} from '../src/commands/packs.js';

describe('ShipGate Packs', () => {
  let testDir: string;
  let registryPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `shipgate-packs-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    // Create a test registry
    registryPath = join(testDir, 'test-registry.json');
    const registry = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      packs: {
        'test-pack': {
          name: 'test-pack',
          version: '1.0.0',
          description: 'Test pack',
          downloadUrl: `file://${resolve(process.cwd(), 'packages/stdlib-auth')}`,
          manifestUrl: `file://${resolve(process.cwd(), 'packages/stdlib-auth/pack.json')}`,
          checksum: 'test-checksum',
        },
      },
    };
    await writeFile(registryPath, JSON.stringify(registry, null, 2));
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('installPack', () => {
    it('should install a pack from registry', async () => {
      const installPath = join(testDir, 'installed-packs', 'test-pack');
      
      const result = await installPack({
        name: 'test-pack',
        targetDir: installPath,
        skipVerify: true,
        verbose: false,
        registryUrl: registryPath,
      });

      expect(result.success).toBe(true);
      expect(result.packName).toBe('test-pack');
      expect(existsSync(installPath)).toBe(true);
      expect(existsSync(join(installPath, 'pack.json'))).toBe(true);
    });

    it('should fail for non-existent pack', async () => {
      const result = await installPack({
        name: 'non-existent-pack',
        targetDir: join(testDir, 'installed-packs', 'non-existent'),
        skipVerify: true,
        registryUrl: registryPath,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should create pack.json with manifest', async () => {
      const installPath = join(testDir, 'installed-packs', 'test-pack');
      
      const result = await installPack({
        name: 'test-pack',
        targetDir: installPath,
        skipVerify: true,
        registryUrl: registryPath,
      });

      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.name).toBe('test-pack');
      
      // Verify pack.json was written
      const packJsonPath = join(installPath, 'pack.json');
      expect(existsSync(packJsonPath)).toBe(true);
      
      const packJson = JSON.parse(await readFile(packJsonPath, 'utf-8'));
      expect(packJson.name).toBe('test-pack');
    });
  });

  describe('listPacks', () => {
    it('should list installed packs', async () => {
      const packsDir = join(testDir, 'packs');
      await mkdir(packsDir, { recursive: true });
      
      // Install a pack
      const installPath = join(packsDir, 'test-pack');
      await installPack({
        name: 'test-pack',
        targetDir: installPath,
        skipVerify: true,
        registryUrl: registryPath,
      });

      // List packs
      const result = await listPacks(packsDir);
      
      expect(result.packs.length).toBeGreaterThan(0);
      const pack = result.packs.find(p => p.name === 'test-pack');
      expect(pack).toBeDefined();
      expect(pack?.version).toBe('1.0.0');
    });

    it('should return empty list when no packs installed', async () => {
      const packsDir = join(testDir, 'empty-packs');
      await mkdir(packsDir, { recursive: true });
      
      const result = await listPacks(packsDir);
      expect(result.packs).toEqual([]);
    });
  });

  describe('verifyPackInstall', () => {
    it('should verify installed pack', async () => {
      const packsDir = join(testDir, 'packs');
      await mkdir(packsDir, { recursive: true });
      
      // Install a pack
      const installPath = join(packsDir, 'test-pack');
      await installPack({
        name: 'test-pack',
        targetDir: installPath,
        skipVerify: true,
        registryUrl: registryPath,
      });

      // Verify pack
      const result = await verifyPackInstall('test-pack', packsDir);
      
      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail verification for non-existent pack', async () => {
      const packsDir = join(testDir, 'packs');
      await mkdir(packsDir, { recursive: true });
      
      const result = await verifyPackInstall('non-existent', packsDir);
      
      expect(result.success).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('pack format', () => {
    it('should create valid pack.json structure', async () => {
      const installPath = join(testDir, 'installed-packs', 'test-pack');
      
      await installPack({
        name: 'test-pack',
        targetDir: installPath,
        skipVerify: true,
        registryUrl: registryPath,
      });

      const packJsonPath = join(installPath, 'pack.json');
      const packJson = JSON.parse(await readFile(packJsonPath, 'utf-8'));
      
      // Verify required fields
      expect(packJson.name).toBeDefined();
      expect(packJson.version).toBeDefined();
      expect(packJson.domain).toBeDefined();
      expect(packJson.files).toBeDefined();
      expect(Array.isArray(packJson.files)).toBe(true);
    });
  });
});
