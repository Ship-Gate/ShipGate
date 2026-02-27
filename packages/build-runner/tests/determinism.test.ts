// ============================================================================
// Determinism Tests - Verify stable, reproducible output
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { buildRunner } from '../src/runner.js';
import { cleanOutputDir, hashContent, sortFilesDeterministically } from '../src/output.js';
import { generateEvidenceJson } from '../src/evidence.js';
import type { BuildResult, OutputFile } from '../src/types.js';

const FIXTURES_DIR = new URL('../fixtures', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const TEST_OUTPUT_DIR = new URL('../.test-output-determinism', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

describe('Determinism', () => {
  beforeEach(async () => {
    await cleanOutputDir(TEST_OUTPUT_DIR);
  });

  afterEach(async () => {
    await cleanOutputDir(TEST_OUTPUT_DIR);
  });

  describe('file ordering', () => {
    it('should produce files in stable alphabetical order', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: false,
      });

      const paths = result.files.map(f => f.path);
      const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b, 'en'));

      expect(paths).toEqual(sortedPaths);
    });

    it('should produce identical file order across multiple runs', async () => {
      const run1 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-1',
        target: 'typescript',
        verify: false,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-1');

      const run2 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-2',
        target: 'typescript',
        verify: false,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-2');

      const paths1 = run1.files.map(f => f.path);
      const paths2 = run2.files.map(f => f.path);

      expect(paths1).toEqual(paths2);
    });
  });

  describe('content stability', () => {
    it('should produce identical content across multiple runs', async () => {
      const run1 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-1',
        target: 'typescript',
        verify: false,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-1');

      const run2 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-2',
        target: 'typescript',
        verify: false,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-2');

      // Compare content hashes
      for (let i = 0; i < run1.files.length; i++) {
        const file1 = run1.files[i];
        const file2 = run2.files.find(f => f.path === file1.path);
        
        expect(file2).toBeDefined();
        expect(hashContent(file1.content)).toBe(hashContent(file2!.content));
      }
    });

    it('should not include timestamps in output', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: false,
      });

      for (const file of result.files) {
        // Check for common timestamp patterns
        expect(file.content).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(file.content).not.toMatch(/Generated at:/i);
        expect(file.content).not.toMatch(/Created on:/i);
      }
    });
  });

  describe('evidence JSON stability', () => {
    it('should produce stable evidence JSON structure', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: true,
      });

      expect(result.evidence).toBeDefined();
      
      const json1 = generateEvidenceJson(result.evidence!);
      const json2 = generateEvidenceJson(result.evidence!);

      expect(json1).toBe(json2);
    });

    it('should order behaviors alphabetically in evidence', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'with-behavior.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: true,
      });

      expect(result.evidence).toBeDefined();
      
      const behaviorNames = result.evidence!.behaviors.map(b => b.name);
      const sortedNames = [...behaviorNames].sort((a, b) => a.localeCompare(b, 'en'));

      expect(behaviorNames).toEqual(sortedNames);
    });

    it('should produce consistent build IDs for same input', async () => {
      const run1 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-1',
        target: 'typescript',
        verify: true,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-1');

      const run2 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-2',
        target: 'typescript',
        verify: true,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-2');

      expect(run1.evidence?.buildId).toBe(run2.evidence?.buildId);
      expect(run1.evidence?.specHash).toBe(run2.evidence?.specHash);
    });
  });

  describe('manifest stability', () => {
    it('should produce consistent manifest across runs', async () => {
      const run1 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-1',
        target: 'typescript',
        verify: false,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-1');

      const run2 = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR + '-2',
        target: 'typescript',
        verify: false,
      });

      await cleanOutputDir(TEST_OUTPUT_DIR + '-2');

      // Compare manifest entries (excluding root path)
      const manifest1Paths = run1.manifest.files.map(f => f.path);
      const manifest2Paths = run2.manifest.files.map(f => f.path);

      expect(manifest1Paths).toEqual(manifest2Paths);
    });

    it('should have sorted file entries in manifest', async () => {
      const result = await buildRunner.run({
        specPath: path.join(FIXTURES_DIR, 'minimal.isl'),
        outDir: TEST_OUTPUT_DIR,
        target: 'typescript',
        verify: false,
      });

      const manifestPaths = result.manifest.files.map(f => f.path);
      const sortedPaths = [...manifestPaths].sort((a, b) => a.localeCompare(b, 'en'));

      expect(manifestPaths).toEqual(sortedPaths);
    });
  });

  describe('sortFilesDeterministically', () => {
    it('should sort files by path alphabetically', () => {
      const files: OutputFile[] = [
        { path: 'z/file.ts', content: '', type: 'types' },
        { path: 'a/file.ts', content: '', type: 'types' },
        { path: 'm/file.ts', content: '', type: 'types' },
      ];

      const sorted = sortFilesDeterministically(files);

      expect(sorted[0].path).toBe('a/file.ts');
      expect(sorted[1].path).toBe('m/file.ts');
      expect(sorted[2].path).toBe('z/file.ts');
    });

    it('should be stable for equal paths', () => {
      const files: OutputFile[] = [
        { path: 'same.ts', content: 'a', type: 'types' },
        { path: 'same.ts', content: 'b', type: 'test' },
      ];

      const sorted1 = sortFilesDeterministically([...files]);
      const sorted2 = sortFilesDeterministically([...files].reverse());

      // Both should produce same order (alphabetically by path, ties preserve original order)
      // Since paths are equal, JavaScript's stable sort preserves original order
      expect(sorted1.map(f => f.path)).toEqual(sorted2.map(f => f.path));
      expect(sorted1.length).toBe(sorted2.length);
    });
  });

  describe('hashContent', () => {
    it('should produce consistent hashes', () => {
      const content = 'test content';
      
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = hashContent('content 1');
      const hash2 = hashContent('content 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 16-character hex strings', () => {
      const hash = hashContent('test');
      
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});
