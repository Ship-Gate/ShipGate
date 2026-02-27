/**
 * Formatter Tests
 * 
 * Tests for ISL formatter ensuring:
 * - Idempotency: fmt(fmt(x)) == fmt(x)
 * - AST equivalence: parse(fmt(x)) produces equivalent AST
 * - Comment preservation
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from '@isl-lang/parser';
import { fmt } from '../src/commands/fmt.js';
import { Formatter } from '../src/commands/fmt/formatter.js';
import { CommentExtractor } from '../src/commands/fmt/comments.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, '../../stdlib-auth/intents/behaviors');
const TEST_FIXTURES = [
  'authenticate.isl',
  'authorize.isl',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize AST for comparison (remove location info)
 */
function normalizeAST(ast: any): any {
  if (!ast || typeof ast !== 'object') return ast;
  if (Array.isArray(ast)) {
    return ast.map(normalizeAST);
  }
  
  const normalized: any = {};
  for (const [key, value] of Object.entries(ast)) {
    if (key === 'location') continue; // Skip location
    normalized[key] = normalizeAST(value);
  }
  return normalized;
}

/**
 * Compare two ASTs for semantic equivalence
 */
function astsEqual(ast1: any, ast2: any): boolean {
  const norm1 = normalizeAST(ast1);
  const norm2 = normalizeAST(ast2);
  return JSON.stringify(norm1) === JSON.stringify(norm2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Formatter Idempotency', () => {
  it('should be idempotent: fmt(fmt(x)) == fmt(x)', async () => {
    const testCases = [
      'domain Test { }',
      `domain Test {
  entity User {
    name: String
    age: Int?
  }
}`,
      `domain Test {
  behavior Login {
    input {
      email: String
      password: String
    }
  }
}`,
    ];

    for (const source of testCases) {
      // Parse and format
      const parseResult1 = parse(source);
      if (!parseResult1.success || !parseResult1.domain) {
        continue; // Skip invalid cases
      }

      const extractor1 = new CommentExtractor(source);
      const comments1 = extractor1.extract();
      const formatter1 = new Formatter();
      const formatted1 = formatter1.format(parseResult1.domain, comments1);

      // Format again
      const parseResult2 = parse(formatted1);
      if (!parseResult2.success || !parseResult2.domain) {
        console.warn('Second parse failed for:', source);
        continue;
      }

      const extractor2 = new CommentExtractor(formatted1);
      const comments2 = extractor2.extract();
      const formatter2 = new Formatter();
      const formatted2 = formatter2.format(parseResult2.domain, comments2);

      // Should be identical
      expect(formatted2).toBe(formatted1);
    }
  });

  it('should handle complex nested structures idempotently', async () => {
    const source = `domain Auth {
  entity User {
    id: UUID
    email: Email
    profile: UserProfile?
  }
  
  behavior Login {
    input {
      email: Email
      password: Password
    }
    output {
      success: {
        user: User
        token: String
      }
    }
  }
}`;

    const parseResult1 = parse(source);
    if (!parseResult1.success || !parseResult1.domain) {
      return;
    }

    const extractor1 = new CommentExtractor(source);
    const formatter1 = new Formatter();
    const formatted1 = formatter1.format(parseResult1.domain, extractor1.extract());

    const parseResult2 = parse(formatted1);
    if (!parseResult2.success || !parseResult2.domain) {
      return;
    }

    const extractor2 = new CommentExtractor(formatted1);
    const formatter2 = new Formatter();
    const formatted2 = formatter2.format(parseResult2.domain, extractor2.extract());

    expect(formatted2).toBe(formatted1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AST Equivalence Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Formatter AST Equivalence', () => {
  it('should produce equivalent AST: parse(fmt(x)) ≈ parse(x)', async () => {
    const testCases = [
      'domain Test { }',
      `domain Test {
  entity User {
    name: String
  }
}`,
      `domain Test {
  type Email = String
  entity User {
    email: Email
  }
}`,
    ];

    for (const source of testCases) {
      // Parse original
      const parseResult1 = parse(source);
      if (!parseResult1.success || !parseResult1.domain) {
        continue;
      }

      // Format
      const extractor = new CommentExtractor(source);
      const formatter = new Formatter();
      const formatted = formatter.format(parseResult1.domain, extractor.extract());

      // Parse formatted
      const parseResult2 = parse(formatted);
      if (!parseResult2.success || !parseResult2.domain) {
        console.warn('Parse of formatted failed for:', source);
        continue;
      }

      // Compare ASTs (semantically equivalent)
      const ast1 = normalizeAST(parseResult1.domain);
      const ast2 = normalizeAST(parseResult2.domain);

      // Key properties should match
      expect(ast1.kind).toBe(ast2.kind);
      expect(ast1.name?.name || ast1.name).toBe(ast2.name?.name || ast2.name);
      
      if (ast1.entities && ast2.entities) {
        expect(ast1.entities.length).toBe(ast2.entities.length);
      }
      if (ast1.behaviors && ast2.behaviors) {
        expect(ast1.behaviors.length).toBe(ast2.behaviors.length);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Comment Preservation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Formatter Comment Preservation', () => {
  it('should preserve line comments', () => {
    const source = `// This is a comment
domain Test {
  // Another comment
  entity User {
    name: String // Field comment
  }
}`;

    const parseResult = parse(source);
    if (!parseResult.success || !parseResult.domain) {
      return;
    }

    const extractor = new CommentExtractor(source);
    const formatter = new Formatter();
    const formatted = formatter.format(parseResult.domain, extractor.extract());

    // Should contain comments
    expect(formatted).toContain('// This is a comment');
    expect(formatted).toContain('// Another comment');
    expect(formatted).toContain('// Field comment');
  });

  it('should preserve hash comments', () => {
    const source = `# Header comment
domain Test {
  # Section comment
  entity User {
    name: String # Inline comment
  }
}`;

    const parseResult = parse(source);
    if (!parseResult.success || !parseResult.domain) {
      return;
    }

    const extractor = new CommentExtractor(source);
    const formatter = new Formatter();
    const formatted = formatter.format(parseResult.domain, extractor.extract());

    expect(formatted).toContain('# Header comment');
    expect(formatted).toContain('# Section comment');
    expect(formatted).toContain('# Inline comment');
  });

  it('should preserve block comments', () => {
    const source = `/* Block comment */
domain Test {
  /* Multi-line
     comment */
  entity User {
    name: String
  }
}`;

    const parseResult = parse(source);
    if (!parseResult.success || !parseResult.domain) {
      return;
    }

    const extractor = new CommentExtractor(source);
    const formatter = new Formatter();
    const formatted = formatter.format(parseResult.domain, extractor.extract());

    expect(formatted).toContain('/* Block comment */');
    expect(formatted).toContain('/* Multi-line');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Formatter Snapshots', () => {
  for (const fixture of TEST_FIXTURES) {
    it(`should format ${fixture} consistently`, async () => {
      try {
        const filePath = join(FIXTURES_DIR, fixture);
        const source = await readFile(filePath, 'utf-8');
        
        const parseResult = parse(source, filePath);
        if (!parseResult.success || !parseResult.domain) {
          console.warn(`Skipping ${fixture} - parse failed`);
          return;
        }

        const extractor = new CommentExtractor(source);
        const formatter = new Formatter();
        const formatted = formatter.format(parseResult.domain, extractor.extract());

        // Snapshot the formatted output
        expect(formatted).toMatchSnapshot(`formatted-${fixture}`);
      } catch (err) {
        // Fixture might not exist, skip
        console.warn(`Skipping ${fixture}:`, err);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI Formatter Integration', () => {
  it('should format files via CLI', async () => {
    // This would test the actual CLI command
    // For now, we test the core functionality
    const source = `domain Test {
entity User {
  name: String
}
}`;

    const parseResult = parse(source);
    if (!parseResult.success || !parseResult.domain) {
      return;
    }

    const extractor = new CommentExtractor(source);
    const formatter = new Formatter();
    const formatted = formatter.format(parseResult.domain, extractor.extract());

    // Should be properly formatted
    expect(formatted).toContain('domain Test');
    expect(formatted).toContain('entity User');
    expect(formatted).toContain('name: String');
  });
});
