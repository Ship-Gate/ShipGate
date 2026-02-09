import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { scanDependencies } from '../src/scanner.js';
import { FindingKind } from '../src/types.js';

describe('Phantom Dependency Scanner', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  describe('Missing Dependencies', () => {
    it('should detect missing dependencies', async () => {
      const projectRoot = path.join(fixturesDir, 'missing-dependency');
      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: false,
      });

      expect(result.findings.length).toBeGreaterThan(0);
      const missingDeps = result.findings.filter(
        (f) => f.kind === FindingKind.MISSING_DEPENDENCY
      );
      expect(missingDeps.length).toBeGreaterThan(0);

      // Should find express and react as missing
      const packageNames = missingDeps.map((f) => f.packageName);
      expect(packageNames).toContain('express');
      expect(packageNames).toContain('react');
    });

    it('should not flag valid dependencies', async () => {
      const projectRoot = path.join(fixturesDir, 'valid-project');
      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: false,
      });

      const missingDeps = result.findings.filter(
        (f) => f.kind === FindingKind.MISSING_DEPENDENCY
      );
      expect(missingDeps.length).toBe(0);
    });
  });

  describe('Unresolvable Imports', () => {
    it('should detect unresolvable relative imports', async () => {
      const projectRoot = path.join(fixturesDir, 'unresolvable-import');
      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: false,
      });

      const unresolvable = result.findings.filter(
        (f) => f.kind === FindingKind.UNRESOLVABLE_IMPORT
      );
      expect(unresolvable.length).toBeGreaterThan(0);
    });
  });

  describe('Workspace Awareness', () => {
    it('should recognize workspace packages', async () => {
      const projectRoot = path.join(fixturesDir, 'workspace-project');
      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: false,
      });

      // Should not flag @isl-lang/isl-core as missing (it's a workspace package)
      const missingDeps = result.findings.filter(
        (f) => f.packageName === '@isl-lang/isl-core'
      );
      expect(missingDeps.length).toBe(0);
    });
  });

  describe('Typo Suggestions', () => {
    it('should suggest typo fixes', async () => {
      const projectRoot = path.join(fixturesDir, 'missing-dependency');
      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: false,
        suggestTypos: true,
      });

      const findingsWithSuggestions = result.findings.filter(
        (f) => f.suggestions && f.suggestions.length > 0
      );
      expect(findingsWithSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Registry Checks', () => {
    it('should check npm registry when enabled', async () => {
      const projectRoot = path.join(fixturesDir, 'missing-dependency');
      const cacheDir = path.join(projectRoot, '.test-cache');

      // Clean up cache before test
      try {
        await fs.rm(cacheDir, { recursive: true });
      } catch {
        // Ignore
      }

      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: true,
        cacheDir,
        maxRegistryChecks: 10,
        registryTimeout: 5000,
      });

      expect(result.registryChecksPerformed).toBe(true);
      expect(result.registryChecksMade).toBeGreaterThan(0);

      // Clean up cache after test
      try {
        await fs.rm(cacheDir, { recursive: true });
      } catch {
        // Ignore
      }
    });

    it('should not block on registry timeout', async () => {
      const projectRoot = path.join(fixturesDir, 'missing-dependency');
      const cacheDir = path.join(projectRoot, '.test-cache-timeout');

      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: true,
        cacheDir,
        maxRegistryChecks: 10,
        registryTimeout: 1, // Very short timeout
      });

      // Should complete without errors even with timeout
      expect(result.errors.length).toBe(0);
      expect(result.findings.length).toBeGreaterThan(0);

      // Clean up
      try {
        await fs.rm(cacheDir, { recursive: true });
      } catch {
        // Ignore
      }
    });
  });

  describe('Confidence Scores', () => {
    it('should assign confidence scores to findings', async () => {
      const projectRoot = path.join(fixturesDir, 'missing-dependency');
      const result = await scanDependencies({
        projectRoot,
        files: [path.join(projectRoot, 'src', 'index.ts')],
        checkRegistry: false,
      });

      for (const finding of result.findings) {
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('File Scanning', () => {
    it('should scan all files when files not specified', async () => {
      const projectRoot = path.join(fixturesDir, 'missing-dependency');
      const result = await scanDependencies({
        projectRoot,
        checkRegistry: false,
      });

      expect(result.filesScanned).toBeGreaterThan(0);
      expect(result.importsChecked).toBeGreaterThan(0);
    });
  });
});
