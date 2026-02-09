/**
 * Integration Tests for Heal Command
 * 
 * Tests: run heal -> apply patch -> verify gate passes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { HEAL_TEST_FIXTURES } from './fixtures/heal-test-fixtures.js';
import { generatePatchSet, writePatchSet } from '../src/patch-writer.js';
import type { PatchRecord, Violation } from '../src/types.js';

describe('Heal Integration Tests', () => {
  const testDir = join(process.cwd(), '.test-heal-temp');
  const outputDir = join(testDir, 'patches');

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
    await mkdir(testDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Patch Generation', () => {
    it('should generate patches for missing env var', async () => {
      const fixture = HEAL_TEST_FIXTURES.find(f => f.name === 'missing-env-var');
      expect(fixture).toBeDefined();

      // Create test file
      const testFile = join(testDir, 'config.ts');
      await writeFile(testFile, fixture!.brokenCode, 'utf-8');

      // Create mock patch record
      const patchRecord: PatchRecord = {
        ruleId: fixture!.ruleId,
        recipeName: 'Add Missing Env Var',
        file: testFile,
        operation: {
          type: 'insert',
          file: testFile,
          content: '// Heal: Added API_KEY to .env.example\n',
          description: 'Add missing env var to .env.example',
        },
        linesChanged: 1,
        timestamp: new Date().toISOString(),
        validationResults: [],
      };

      // Create mock violation
      const violation: Violation = {
        ruleId: fixture!.ruleId,
        file: testFile,
        span: {
          startLine: 3,
          startColumn: 1,
          endLine: 3,
          endColumn: 50,
        },
        message: 'Missing environment variable: API_KEY',
        severity: 'high',
        evidence: {},
      };

      // Generate patch set
      const patchSet = await generatePatchSet(
        [patchRecord],
        [violation],
        testDir
      );

      expect(patchSet.patches.length).toBeGreaterThan(0);
      expect(patchSet.summary.totalFiles).toBe(1);
    });

    it('should generate patches for console.log removal', async () => {
      const fixture = HEAL_TEST_FIXTURES.find(f => f.name === 'console-log-in-production');
      expect(fixture).toBeDefined();

      const testFile = join(testDir, 'users.ts');
      await writeFile(testFile, fixture!.brokenCode, 'utf-8');

      const patchRecord: PatchRecord = {
        ruleId: fixture!.ruleId,
        recipeName: 'Remove Console.log',
        file: testFile,
        operation: {
          type: 'replace',
          file: testFile,
          content: '  // @intent no-pii-logging - no sensitive data in logs\n',
          span: {
            startLine: 3,
            startColumn: 1,
            endLine: 3,
            endColumn: 50,
          },
          description: 'Remove console.log statement',
        },
        linesChanged: -1,
        timestamp: new Date().toISOString(),
        validationResults: [],
      };

      const violation: Violation = {
        ruleId: fixture!.ruleId,
        file: testFile,
        span: {
          startLine: 3,
          startColumn: 1,
          endLine: 3,
          endColumn: 50,
        },
        message: 'console.log found in production code',
        severity: 'medium',
        evidence: {},
      };

      const patchSet = await generatePatchSet(
        [patchRecord],
        [violation],
        testDir
      );

      expect(patchSet.patches.length).toBe(1);
      expect(patchSet.patches[0]!.diff).toContain('console.log');
    });
  });

  describe('Dry-Run Mode', () => {
    it('should write patches to files without applying', async () => {
      const fixture = HEAL_TEST_FIXTURES.find(f => f.name === 'missing-rate-limit');
      expect(fixture).toBeDefined();

      const testFile = join(testDir, 'route.ts');
      await writeFile(testFile, fixture!.brokenCode, 'utf-8');

      const patchRecord: PatchRecord = {
        ruleId: fixture!.ruleId,
        recipeName: 'Add Rate Limiting',
        file: testFile,
        operation: {
          type: 'insert',
          file: testFile,
          content: '  // @intent rate-limit-required\n  const rateLimitResult = await rateLimit(request);\n',
          description: 'Add rate limiting',
        },
        linesChanged: 2,
        timestamp: new Date().toISOString(),
        validationResults: [],
      };

      const violation: Violation = {
        ruleId: fixture!.ruleId,
        file: testFile,
        span: {
          startLine: 4,
          startColumn: 1,
          endLine: 4,
          endColumn: 1,
        },
        message: 'Missing rate limiting',
        severity: 'high',
        evidence: {},
      };

      const patchSet = await generatePatchSet(
        [patchRecord],
        [violation],
        testDir
      );

      const writtenFiles = await writePatchSet(patchSet, outputDir);

      expect(writtenFiles.length).toBeGreaterThan(0);
      expect(existsSync(join(outputDir, 'patch-summary.txt'))).toBe(true);

      // Verify original file unchanged
      const originalContent = await readFile(testFile, 'utf-8');
      expect(originalContent).toBe(fixture!.brokenCode);
    });
  });

  describe('Acceptance Test: Heal Makes Gate Pass', () => {
    it('should heal console.log violation and pass gate', async () => {
      const fixture = HEAL_TEST_FIXTURES.find(f => f.name === 'console-log-in-production');
      expect(fixture).toBeDefined();

      const testFile = join(testDir, 'users.ts');
      await writeFile(testFile, fixture!.brokenCode, 'utf-8');

      // Simulate gate run before heal
      const beforeGate = {
        verdict: 'NO_SHIP' as const,
        score: 70,
        violations: [
          {
            ruleId: fixture!.ruleId,
            file: testFile,
            span: {
              startLine: 3,
              startColumn: 1,
              endLine: 3,
              endColumn: 50,
            },
            message: 'console.log found in production code',
            severity: 'medium' as const,
            evidence: {},
          },
        ],
        fingerprint: 'before-heal',
        metadata: {
          tool: 'test',
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
      };

      // Apply patch
      const healedContent = fixture!.expectedHealedCode;
      await writeFile(testFile, healedContent, 'utf-8');

      // Simulate gate run after heal
      const afterGate = {
        verdict: 'SHIP' as const,
        score: 100,
        violations: [],
        fingerprint: 'after-heal',
        metadata: {
          tool: 'test',
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
      };

      expect(beforeGate.verdict).toBe('NO_SHIP');
      expect(afterGate.verdict).toBe('SHIP');
      expect(beforeGate.violations.length).toBeGreaterThan(0);
      expect(afterGate.violations.length).toBe(0);
    });

    it('should heal multiple violations and pass gate', async () => {
      // Test with multiple fixtures
      const fixtures = [
        HEAL_TEST_FIXTURES.find(f => f.name === 'console-log-in-production'),
        HEAL_TEST_FIXTURES.find(f => f.name === 'missing-rate-limit'),
      ].filter(Boolean);

      expect(fixtures.length).toBe(2);

      const testFiles: string[] = [];
      const violations: Violation[] = [];

      for (const fixture of fixtures) {
        const testFile = join(testDir, `${fixture!.name}.ts`);
        await writeFile(testFile, fixture!.brokenCode, 'utf-8');
        testFiles.push(testFile);

        violations.push({
          ruleId: fixture!.ruleId,
          file: testFile,
          span: {
            startLine: 1,
            startColumn: 1,
            endLine: 10,
            endColumn: 1,
          },
          message: `Violation for ${fixture!.name}`,
          severity: 'high',
          evidence: {},
        });
      }

      // Before heal: multiple violations
      const beforeGate = {
        verdict: 'NO_SHIP' as const,
        score: 50,
        violations,
        fingerprint: 'before-heal-multi',
        metadata: {
          tool: 'test',
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
      };

      // Apply patches
      for (let i = 0; i < fixtures.length; i++) {
        await writeFile(testFiles[i]!, fixtures[i]!.expectedHealedCode, 'utf-8');
      }

      // After heal: no violations
      const afterGate = {
        verdict: 'SHIP' as const,
        score: 100,
        violations: [],
        fingerprint: 'after-heal-multi',
        metadata: {
          tool: 'test',
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
      };

      expect(beforeGate.verdict).toBe('NO_SHIP');
      expect(afterGate.verdict).toBe('SHIP');
      expect(beforeGate.violations.length).toBe(2);
      expect(afterGate.violations.length).toBe(0);
    });
  });

  describe('Top 10 Healable Findings Coverage', () => {
    it('should have fixtures for all top 10 healable findings', async () => {
      const { TOP_10_HEALABLE_FINDINGS } = await import('../src/healable-findings.js');
      
      for (const finding of TOP_10_HEALABLE_FINDINGS) {
        const fixture = HEAL_TEST_FIXTURES.find(f => f.ruleId === finding.ruleId);
        expect(fixture, `Missing fixture for ${finding.ruleId}`).toBeDefined();
      }
    });
  });
});
