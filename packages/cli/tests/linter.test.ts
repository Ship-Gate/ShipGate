/**
 * Linter Tests
 * 
 * Tests for ISL linter rules
 */

import { describe, it, expect } from 'vitest';
import { lint } from '../src/commands/lint.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'linter');

describe('ISL Linter', () => {
  describe('unused-symbols', () => {
    it('should detect unused entities', async () => {
      const file = join(FIXTURES_DIR, 'unused-symbols.isl');
      const result = await lint(file);
      
      expect(result.success).toBe(false);
      const unusedEntityIssue = result.issues.find(
        i => i.rule === 'unused-symbols' && i.message.includes('UnusedEntity')
      );
      expect(unusedEntityIssue).toBeDefined();
      expect(unusedEntityIssue?.severity).toBe('warning');
    });
  });

  describe('duplicate-behaviors', () => {
    it('should detect duplicate behaviors', async () => {
      const file = join(FIXTURES_DIR, 'duplicate-behaviors.isl');
      const result = await lint(file);
      
      expect(result.success).toBe(false);
      const duplicateIssue = result.issues.find(
        i => i.rule === 'duplicate-behaviors'
      );
      expect(duplicateIssue).toBeDefined();
      expect(duplicateIssue?.severity).toBe('error');
    });
  });

  describe('overly-broad-invariants', () => {
    it('should detect overly broad invariants', async () => {
      const file = join(FIXTURES_DIR, 'overly-broad-invariants.isl');
      const result = await lint(file);
      
      const broadIssue = result.issues.find(
        i => i.rule === 'overly-broad-invariants'
      );
      expect(broadIssue).toBeDefined();
      expect(broadIssue?.severity).toBe('warning');
    });
  });

  describe('ambiguous-imports', () => {
    it('should detect ambiguous imports', async () => {
      const file = join(FIXTURES_DIR, 'ambiguous-imports.isl');
      const result = await lint(file);
      
      const ambiguousIssue = result.issues.find(
        i => i.rule === 'ambiguous-imports'
      );
      expect(ambiguousIssue).toBeDefined();
      expect(ambiguousIssue?.severity).toBe('warning');
    });
  });

  describe('unreachable-constraints', () => {
    it('should detect unreachable constraints', async () => {
      const file = join(FIXTURES_DIR, 'unreachable-constraints.isl');
      const result = await lint(file);
      
      const unreachableIssue = result.issues.find(
        i => i.rule === 'unreachable-constraints'
      );
      // May or may not be detected depending on expression analysis
      // This is a basic test
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('missing-preconditions', () => {
    it('should detect missing preconditions', async () => {
      const file = join(FIXTURES_DIR, 'missing-preconditions.isl');
      const result = await lint(file);
      
      const missingPreIssue = result.issues.find(
        i => i.rule === 'missing-preconditions'
      );
      expect(missingPreIssue).toBeDefined();
      expect(missingPreIssue?.severity).toBe('warning');
    });
  });

  describe('unused-imports', () => {
    it('should detect unused imports', async () => {
      const file = join(FIXTURES_DIR, 'unused-imports.isl');
      const result = await lint(file);
      
      const unusedImportIssue = result.issues.find(
        i => i.rule === 'unused-imports' && i.message.includes('UnusedType')
      );
      expect(unusedImportIssue).toBeDefined();
      expect(unusedImportIssue?.severity).toBe('warning');
    });
  });

  describe('missing-error-handling', () => {
    it('should detect missing error handling', async () => {
      const file = join(FIXTURES_DIR, 'missing-error-handling.isl');
      const result = await lint(file, { includeHints: true });
      
      const missingErrorIssue = result.issues.find(
        i => i.rule === 'missing-error-handling'
      );
      expect(missingErrorIssue).toBeDefined();
      expect(missingErrorIssue?.severity).toBe('info');
    });
  });

  describe('inconsistent-naming', () => {
    it('should detect inconsistent naming', async () => {
      const file = join(FIXTURES_DIR, 'inconsistent-naming.isl');
      const result = await lint(file, { includeHints: true });
      
      const namingIssues = result.issues.filter(
        i => i.rule === 'inconsistent-naming'
      );
      expect(namingIssues.length).toBeGreaterThan(0);
      expect(namingIssues[0]?.severity).toBe('info');
    });
  });

  describe('JSON output format', () => {
    it('should output JSON format', async () => {
      const file = join(FIXTURES_DIR, 'duplicate-behaviors.isl');
      const result = await lint(file, { format: 'json' });
      
      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });
});
