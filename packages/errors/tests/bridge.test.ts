// ============================================================================
// Tests for Legacy Error Code Bridge
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  resolveErrorCode,
  categoryFromCode,
  fromParserDiagnostic,
  fromParserDiagnostics,
  LEGACY_CODE_MAP,
  type LegacyParserDiagnostic,
} from '../src/index.js';

describe('Error Code Bridge', () => {
  describe('resolveErrorCode', () => {
    it('maps lexer legacy codes to unified codes', () => {
      expect(resolveErrorCode('L001')).toBe('E0001');
      expect(resolveErrorCode('L002')).toBe('E0002');
      expect(resolveErrorCode('L006')).toBe('E0006');
    });

    it('maps parser legacy codes to unified codes', () => {
      expect(resolveErrorCode('P001')).toBe('E0100');
      expect(resolveErrorCode('P006')).toBe('E0105');
      expect(resolveErrorCode('P010')).toBe('E0109');
      expect(resolveErrorCode('P019')).toBe('E0118');
    });

    it('returns unified codes as-is', () => {
      expect(resolveErrorCode('E0001')).toBe('E0001');
      expect(resolveErrorCode('E0200')).toBe('E0200');
      expect(resolveErrorCode('E0500')).toBe('E0500');
    });

    it('returns unknown codes as-is', () => {
      expect(resolveErrorCode('X999')).toBe('X999');
    });
  });

  describe('categoryFromCode', () => {
    it('resolves lexer category', () => {
      expect(categoryFromCode('E0001')).toBe('lexer');
      expect(categoryFromCode('L001')).toBe('lexer');
    });

    it('resolves parser category', () => {
      expect(categoryFromCode('E0100')).toBe('parser');
      expect(categoryFromCode('P001')).toBe('parser');
    });

    it('resolves type category', () => {
      expect(categoryFromCode('E0200')).toBe('type');
    });

    it('resolves semantic category', () => {
      expect(categoryFromCode('E0300')).toBe('semantic');
    });

    it('resolves eval category', () => {
      expect(categoryFromCode('E0400')).toBe('eval');
    });

    it('resolves verify category', () => {
      expect(categoryFromCode('E0500')).toBe('verify');
    });

    it('resolves config category', () => {
      expect(categoryFromCode('E0600')).toBe('config');
    });

    it('resolves io category', () => {
      expect(categoryFromCode('E0700')).toBe('io');
    });
  });

  describe('fromParserDiagnostic', () => {
    it('converts a legacy parser diagnostic with legacy code', () => {
      const legacy: LegacyParserDiagnostic = {
        severity: 'error',
        code: 'P001',
        message: "Unexpected token 'foo'",
        location: {
          file: 'test.isl',
          line: 3,
          column: 5,
          endLine: 3,
          endColumn: 8,
        },
        source: 'parser',
      };

      const result = fromParserDiagnostic(legacy);
      expect(result.code).toBe('E0100');
      expect(result.category).toBe('parser');
      expect(result.severity).toBe('error');
      expect(result.message).toBe("Unexpected token 'foo'");
      expect(result.source).toBe('parser');
    });

    it('preserves notes and help', () => {
      const legacy: LegacyParserDiagnostic = {
        severity: 'error',
        code: 'P010',
        message: "Duplicate entity 'User'",
        location: {
          file: 'test.isl',
          line: 6,
          column: 3,
          endLine: 6,
          endColumn: 7,
        },
        source: 'parser',
        notes: ['Each entity must have a unique name'],
        help: ['Rename one of the entities'],
        relatedInformation: [
          {
            message: 'Previously defined here',
            location: {
              file: 'test.isl',
              line: 3,
              column: 3,
              endLine: 3,
              endColumn: 7,
            },
          },
        ],
      };

      const result = fromParserDiagnostic(legacy);
      expect(result.code).toBe('E0109');
      expect(result.notes).toEqual(['Each entity must have a unique name']);
      expect(result.help).toEqual(['Rename one of the entities']);
      expect(result.relatedInformation).toHaveLength(1);
    });

    it('converts multiple diagnostics', () => {
      const legacies: LegacyParserDiagnostic[] = [
        {
          severity: 'error',
          code: 'L001',
          message: 'Unexpected character',
          location: { file: 'a.isl', line: 1, column: 1, endLine: 1, endColumn: 2 },
          source: 'parser',
        },
        {
          severity: 'warning',
          code: 'P013',
          message: 'Missing version',
          location: { file: 'a.isl', line: 1, column: 1, endLine: 1, endColumn: 1 },
          source: 'parser',
        },
      ];

      const results = fromParserDiagnostics(legacies);
      expect(results).toHaveLength(2);
      expect(results[0]!.code).toBe('E0001');
      expect(results[1]!.code).toBe('E0112');
    });
  });

  describe('LEGACY_CODE_MAP completeness', () => {
    it('has mappings for all lexer codes L001-L006', () => {
      for (let i = 1; i <= 6; i++) {
        const code = `L${String(i).padStart(3, '0')}`;
        expect(LEGACY_CODE_MAP[code]).toBeDefined();
      }
    });

    it('has mappings for all parser codes P001-P019', () => {
      for (let i = 1; i <= 19; i++) {
        const code = `P${String(i).padStart(3, '0')}`;
        expect(LEGACY_CODE_MAP[code]).toBeDefined();
      }
    });
  });
});
