/**
 * Tests for Shipgate Fixes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Finding } from '@isl-lang/isl-gate';
import {
  suggestFixes,
  registerFixer,
  listFixers,
} from '../src/shipgate-fixes.js';
import { applyPatches } from '../src/patch-engine.js';
import '../src/fixers/index.js'; // Register fixers

describe('Shipgate Fixes', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `shipgate-fix-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('suggestFixes', () => {
    it('should return empty suggestions for empty claims', async () => {
      const result = await suggestFixes([], {
        projectRoot: testDir,
      });

      expect(result.total).toBe(0);
      expect(result.suggestions).toEqual([]);
    });

    it('should suggest fixes for missing env var', async () => {
      // Create .env.example
      const envExamplePath = join(testDir, '.env.example');
      writeFileSync(envExamplePath, 'PORT=3000\n');

      const finding: Finding = {
        id: '1',
        type: 'missing-env-var',
        severity: 'medium',
        message: 'Missing environment variable: API_KEY',
        rule: 'missing-env-var',
        file: 'src/index.ts',
        line: 10,
        autoFixable: true,
      };

      const result = await suggestFixes([finding], {
        projectRoot: testDir,
      });

      expect(result.total).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.rule === 'missing-env-var')).toBe(true);
    });

    it('should filter by onlyRules', async () => {
      const finding1: Finding = {
        id: '1',
        type: 'missing-env-var',
        severity: 'medium',
        message: 'Missing environment variable: API_KEY',
        rule: 'missing-env-var',
        autoFixable: true,
      };

      const finding2: Finding = {
        id: '2',
        type: 'dead-route',
        severity: 'high',
        message: 'Route /api/users not found',
        rule: 'dead-route',
        autoFixable: true,
      };

      const result = await suggestFixes([finding1, finding2], {
        projectRoot: testDir,
        onlyRules: ['missing-env-var'],
      });

      expect(result.suggestions.every(s => s.rule === 'missing-env-var')).toBe(true);
    });

    it('should respect minConfidence threshold', async () => {
      const finding: Finding = {
        id: '1',
        type: 'missing-env-var',
        severity: 'medium',
        message: 'Missing environment variable: API_KEY',
        rule: 'missing-env-var',
        autoFixable: true,
      };

      const result = await suggestFixes([finding], {
        projectRoot: testDir,
        minConfidence: 0.95, // Very high threshold
      });

      // Should filter out low-confidence suggestions
      expect(result.suggestions.every(s => s.confidence >= 0.95)).toBe(true);
    });
  });

  describe('fixer registry', () => {
    it('should list registered fixers', () => {
      const fixers = listFixers();
      expect(fixers.length).toBeGreaterThan(0);
      expect(fixers.some(f => f.rule === 'missing-env-var')).toBe(true);
      expect(fixers.some(f => f.rule === 'dead-route')).toBe(true);
      expect(fixers.some(f => f.rule === 'phantom-dependency')).toBe(true);
    });
  });

  describe('patch application', () => {
    it('should apply patches in dry-run mode', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original content\n');

      const { createPatch } = await import('../src/patcher.js');
      const patch = createPatch('replace', 1, {
        file: 'test.txt',
        original: 'original content',
        replacement: 'new content',
        description: 'Test patch',
        confidence: 0.9,
      });

      const result = await applyPatches([patch], {
        projectRoot: testDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.applied.length).toBe(1);
      
      // File should not be modified in dry-run
      const content = await readFile(testFile, 'utf-8');
      expect(content).toBe('original content\n');
    });

    it('should apply patches when not in dry-run', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original content\n');

      const { createPatch } = await import('../src/patcher.js');
      const patch = createPatch('replace', 1, {
        file: 'test.txt',
        original: 'original content',
        replacement: 'new content',
        description: 'Test patch',
        confidence: 0.9,
      });

      const result = await applyPatches([patch], {
        projectRoot: testDir,
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.applied.length).toBe(1);
      
      // File should be modified
      const content = await readFile(testFile, 'utf-8');
      expect(content).toBe('new content\n');
    });
  });
});
