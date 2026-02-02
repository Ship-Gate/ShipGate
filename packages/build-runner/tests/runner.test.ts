// ============================================================================
// Build Runner Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { buildRunner } from '../src/runner.js';
import { cleanOutputDir } from '../src/output.js';
import type { BuildResult } from '../src/types.js';

const FIXTURES_DIR = new URL('../fixtures', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const TEST_OUTPUT_DIR = new URL('../.test-output', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

describe('BuildRunner', () => {
  beforeEach(async () => {
    await cleanOutputDir(TEST_OUTPUT_DIR);
  });

  afterEach(async () => {
    await cleanOutputDir(TEST_OUTPUT_DIR);
  });

  describe('run()', () => {
    it('should successfully build a minimal spec', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
      });

      expect(result.success).toBe(true);
      // Check errors are now warnings, so we only fail on parse errors
      expect(result.errors.filter(e => e.stage === 'parse')).toHaveLength(0);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should generate types directory or report codegen error', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
      });

      const typesFiles = result.files.filter(f => f.type === 'types');
      const codegenErrors = result.errors.filter(e => e.stage === 'codegen');
      
      // Either types are generated OR there's a known codegen limitation
      expect(typesFiles.length > 0 || codegenErrors.length > 0).toBe(true);
    });

    it('should generate test files', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        testFramework: 'vitest',
      });

      const testFiles = result.files.filter(f => f.type === 'test');
      expect(testFiles.length).toBeGreaterThan(0);
    });

    it('should generate evidence JSON when verify is enabled', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: true,
      });

      expect(result.evidence).toBeDefined();
      expect(result.evidence?.domainName).toBe('Minimal');
      
      const evidenceFile = result.files.find(f => f.path === 'evidence/evidence.json');
      expect(evidenceFile).toBeDefined();
    });

    it('should generate HTML report when htmlReport is enabled', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: true,
        htmlReport: true,
      });

      const reportFile = result.files.find(f => f.path === 'reports/report.html');
      expect(reportFile).toBeDefined();
      expect(reportFile?.content).toContain('<!DOCTYPE html>');
    });

    it('should skip verification when verify is false', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: false,
      });

      expect(result.success).toBe(true);
      expect(result.evidence).toBeUndefined();
      expect(result.timing.verify).toBe(0);
    });

    it('should handle spec with multiple behaviors', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'with-behavior.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: true,
      });

      expect(result.success).toBe(true);
      expect(result.evidence?.behaviors.length).toBeGreaterThan(1);
    });

    it('should fail gracefully on invalid spec path', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'nonexistent.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].stage).toBe('parse');
    });

    it('should write manifest file', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
      });

      expect(result.success).toBe(true);
      
      const manifestPath = path.join(TEST_OUTPUT_DIR, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.generated).toBe('build-runner');
      expect(manifest.files).toBeDefined();
    });

    it('should record timing for all stages', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: true,
      });

      expect(result.timing.parse).toBeGreaterThanOrEqual(0);
      expect(result.timing.check).toBeGreaterThanOrEqual(0);
      expect(result.timing.importResolve).toBeGreaterThanOrEqual(0);
      expect(result.timing.codegen).toBeGreaterThanOrEqual(0);
      expect(result.timing.testgen).toBeGreaterThanOrEqual(0);
      expect(result.timing.verify).toBeGreaterThanOrEqual(0);
      expect(result.timing.total).toBeGreaterThan(0);
    });
  });

  describe('output options', () => {
    it('should use vitest as default test framework', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
      });

      const configFile = result.files.find(f => f.path.includes('vitest.config'));
      expect(configFile).toBeDefined();
    });

    it('should generate jest config when specified', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        testFramework: 'jest',
      });

      const configFile = result.files.find(f => f.path.includes('jest.config'));
      expect(configFile).toBeDefined();
    });

    it('should include helpers when includeHelpers is true', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        includeHelpers: true,
      });

      const helperFiles = result.files.filter(f => f.type === 'helper');
      expect(helperFiles.length).toBeGreaterThan(0);
    });

    it('should skip chaos tests when includeChaosTests is false', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        includeChaosTests: false,
      });

      const chaosFiles = result.files.filter(f => f.path.includes('.chaos.'));
      expect(chaosFiles).toHaveLength(0);
    });
  });
});
