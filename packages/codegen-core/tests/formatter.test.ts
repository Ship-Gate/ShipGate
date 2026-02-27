/**
 * @isl-lang/codegen-core - Formatter Tests
 *
 * Tests for deterministic code formatting and printing.
 */

import { describe, it, expect } from 'vitest';
import {
  formatCodeSync,
  generateHeader,
  generateSectionComment,
  hashContent,
  createPrinter,
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toScreamingSnakeCase,
} from '../src/formatter.js';

// ============================================================================
// Code Formatting Tests
// ============================================================================

describe('formatCodeSync', () => {
  it('should normalize line endings to LF by default', () => {
    const code = 'line1\r\nline2\rline3\nline4';
    const formatted = formatCodeSync(code, 'typescript');

    expect(formatted).not.toContain('\r');
    expect(formatted.split('\n').length).toBeGreaterThanOrEqual(4);
  });

  it('should ensure trailing newline', () => {
    const code = 'const x = 1';
    const formatted = formatCodeSync(code, 'typescript');

    expect(formatted.endsWith('\n')).toBe(true);
  });

  it('should normalize indentation to spaces for TypeScript', () => {
    const code = '\tconst x = 1;';
    const formatted = formatCodeSync(code, 'typescript');

    expect(formatted).toContain('  '); // 2 spaces
  });

  it('should use tabs for Go', () => {
    const code = '  func main() {}';
    const formatted = formatCodeSync(code, 'go');

    expect(formatted).toContain('\t');
  });
});

// ============================================================================
// Header Generation Tests
// ============================================================================

describe('generateHeader', () => {
  it('should generate a deterministic header', () => {
    const header = generateHeader({
      generator: '@isl-lang/codegen-types',
      version: '1.0.0',
      sourcePath: 'domain/auth.isl',
    });

    expect(header).toContain('@generated - DO NOT EDIT');
    expect(header).toContain('Source: domain/auth.isl');
    expect(header).toContain('@isl-lang/codegen-types@1.0.0');
  });

  it('should include hash when requested', () => {
    const header = generateHeader({
      generator: '@isl-lang/codegen-types',
      version: '1.0.0',
      includeHash: true,
      metadata: { hash: 'abc12345' },
    });

    expect(header).toContain('Hash: abc12345');
  });

  it('should produce identical output for same input', () => {
    const config = {
      generator: '@isl-lang/codegen-types',
      version: '1.0.0',
      sourcePath: 'auth.isl',
    };

    const header1 = generateHeader(config);
    const header2 = generateHeader(config);

    expect(header1).toBe(header2);
  });
});

describe('generateSectionComment', () => {
  it('should generate a section comment', () => {
    const comment = generateSectionComment('Types');

    expect(comment).toContain('Types');
    expect(comment).toContain('===');
  });
});

// ============================================================================
// Content Hashing Tests
// ============================================================================

describe('hashContent', () => {
  it('should produce consistent hash for same input', () => {
    const content = 'export interface User { id: string; }';

    const hash1 = hashContent(content);
    const hash2 = hashContent(content);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different input', () => {
    const hash1 = hashContent('content1');
    const hash2 = hashContent('content2');

    expect(hash1).not.toBe(hash2);
  });

  it('should respect length parameter', () => {
    const hash4 = hashContent('test', 4);
    const hash8 = hashContent('test', 8);

    expect(hash4).toHaveLength(4);
    expect(hash8).toHaveLength(8);
  });
});

// ============================================================================
// Code Printer Tests
// ============================================================================

describe('createPrinter', () => {
  it('should write lines with indentation', () => {
    const printer = createPrinter();

    printer.writeLine('export interface User {');
    printer.indent();
    printer.writeLine('id: string;');
    printer.dedent();
    printer.writeLine('}');

    const output = printer.toString();

    expect(output).toContain('export interface User {');
    expect(output).toContain('  id: string;');
    expect(output).toContain('}');
  });

  it('should handle nested indentation', () => {
    const printer = createPrinter();

    printer.writeLine('function outer() {');
    printer.indent();
    printer.writeLine('function inner() {');
    printer.indent();
    printer.writeLine('return true;');
    printer.dedent();
    printer.writeLine('}');
    printer.dedent();
    printer.writeLine('}');

    const output = printer.toString();
    const lines = output.split('\n');

    expect(lines[2]).toMatch(/^    return true;/); // 4 spaces
  });

  it('should write blocks', () => {
    const printer = createPrinter();

    printer.writeBlock('export interface User {', '}', () => {
      printer.writeLine('id: string;');
      printer.writeLine('name: string;');
    });

    const output = printer.toString();

    expect(output).toContain('export interface User {');
    expect(output).toContain('  id: string;');
    expect(output).toContain('  name: string;');
    expect(output).toContain('}');
  });

  it('should add blank lines', () => {
    const printer = createPrinter();

    printer.writeLine('// Section 1');
    printer.blankLine();
    printer.writeLine('// Section 2');

    const output = printer.toString();
    const lines = output.split('\n');

    expect(lines).toContain('');
  });

  it('should produce deterministic output', () => {
    const buildCode = () => {
      const printer = createPrinter();
      printer.writeLine('export interface User {');
      printer.indent();
      printer.writeLine('id: string;');
      printer.writeLine('email: string;');
      printer.dedent();
      printer.writeLine('}');
      return printer.toString();
    };

    const output1 = buildCode();
    const output2 = buildCode();

    expect(output1).toBe(output2);
  });

  it('should end with newline', () => {
    const printer = createPrinter();
    printer.writeLine('const x = 1;');

    const output = printer.toString();

    expect(output.endsWith('\n')).toBe(true);
  });
});

// ============================================================================
// String Transformation Tests
// ============================================================================

describe('toPascalCase', () => {
  it('should convert from various formats', () => {
    expect(toPascalCase('user_profile')).toBe('UserProfile');
    expect(toPascalCase('user-profile')).toBe('UserProfile');
    expect(toPascalCase('userProfile')).toBe('UserProfile');
    expect(toPascalCase('UserProfile')).toBe('UserProfile');
  });
});

describe('toCamelCase', () => {
  it('should convert from various formats', () => {
    expect(toCamelCase('user_profile')).toBe('userProfile');
    expect(toCamelCase('user-profile')).toBe('userProfile');
    expect(toCamelCase('UserProfile')).toBe('userProfile');
  });
});

describe('toKebabCase', () => {
  it('should convert from various formats', () => {
    expect(toKebabCase('userProfile')).toBe('user-profile');
    expect(toKebabCase('UserProfile')).toBe('user-profile');
    expect(toKebabCase('user_profile')).toBe('user-profile');
  });
});

describe('toSnakeCase', () => {
  it('should convert from various formats', () => {
    expect(toSnakeCase('userProfile')).toBe('user_profile');
    expect(toSnakeCase('UserProfile')).toBe('user_profile');
    expect(toSnakeCase('user-profile')).toBe('user_profile');
  });
});

describe('toScreamingSnakeCase', () => {
  it('should convert to SCREAMING_SNAKE_CASE', () => {
    expect(toScreamingSnakeCase('userProfile')).toBe('USER_PROFILE');
    expect(toScreamingSnakeCase('UserProfile')).toBe('USER_PROFILE');
    expect(toScreamingSnakeCase('user-profile')).toBe('USER_PROFILE');
  });
});

// ============================================================================
// Determinism Tests (Golden Snapshot Pattern)
// ============================================================================

describe('determinism', () => {
  it('should produce identical formatted code on repeated runs', () => {
    const code = `
      export interface User {
        id: string;
        email: string;
        name?: string;
      }
    `;

    const results = Array(5)
      .fill(null)
      .map(() => formatCodeSync(code, 'typescript'));

    // All results should be identical
    for (const result of results) {
      expect(result).toBe(results[0]);
    }
  });

  it('should produce identical headers for same config', () => {
    const config = {
      generator: '@isl-lang/test',
      version: '1.0.0',
      sourcePath: 'test.isl',
    };

    const results = Array(5)
      .fill(null)
      .map(() => generateHeader(config));

    for (const result of results) {
      expect(result).toBe(results[0]);
    }
  });

  it('should produce identical hashes for same content', () => {
    const content = 'some test content that should hash consistently';

    const results = Array(5)
      .fill(null)
      .map(() => hashContent(content));

    for (const result of results) {
      expect(result).toBe(results[0]);
    }
  });
});
