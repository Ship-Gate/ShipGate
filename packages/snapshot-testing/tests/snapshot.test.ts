/**
 * Snapshot Testing Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Core
  SnapshotStore,
  hashContent,
  generateSnapshotKey,
  defaultSerializer,
  
  // Comparators
  compareJson,
  compareJsonStrings,
  compareIsl,
  parseIslElements,
  extractDomainName,
  removeComments,
  normalizeWhitespace,
  compareGenerated,
  normalizeTypescript,
  normalizeFormatting,
  
  // Reporter
  generateDiff,
  formatUnifiedDiff,
} from '../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Core Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Core', () => {
  describe('hashContent', () => {
    it('should generate consistent hashes', () => {
      const hash1 = hashContent('test content');
      const hash2 = hashContent('test content');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = hashContent('content 1');
      const hash2 = hashContent('content 2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSnapshotKey', () => {
    it('should generate valid key', () => {
      const key = generateSnapshotKey('test.ts', 'my test name', 0);
      expect(key).toBe('my-test-name-0');
    });

    it('should sanitize special characters', () => {
      const key = generateSnapshotKey('test.ts', 'test: with "special" chars!', 0);
      expect(key).not.toContain(':');
      expect(key).not.toContain('"');
      expect(key).not.toContain('!');
    });
  });

  describe('defaultSerializer', () => {
    it('should serialize strings directly', () => {
      expect(defaultSerializer('hello')).toBe('hello');
    });

    it('should serialize objects as JSON', () => {
      const result = defaultSerializer({ a: 1, b: 2 });
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });

    it('should handle null and undefined', () => {
      expect(defaultSerializer(null)).toBe('null');
      expect(defaultSerializer(undefined)).toBe('undefined');
    });
  });

  describe('SnapshotStore', () => {
    let store: SnapshotStore;

    beforeEach(() => {
      store = new SnapshotStore();
    });

    it('should set and get snapshots', () => {
      const snapshot = store.set('test.ts', 'test name', 'content');
      expect(snapshot.content).toBe('content');
      expect(snapshot.metadata.testName).toBe('test name');
    });

    it('should increment index for same test', () => {
      store.set('test.ts', 'test name', 'content 1');
      expect(store.getNextIndex('test.ts', 'test name')).toBe(1);
      
      store.set('test.ts', 'test name', 'content 2');
      expect(store.getNextIndex('test.ts', 'test name')).toBe(2);
    });

    it('should reset counter', () => {
      store.set('test.ts', 'test name', 'content');
      expect(store.getNextIndex('test.ts', 'test name')).toBe(1);
      
      store.resetCounter('test.ts', 'test name');
      expect(store.getNextIndex('test.ts', 'test name')).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JSON Comparator Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('JSON Comparator', () => {
  describe('compareJson', () => {
    it('should match identical objects', () => {
      const result = compareJson({ a: 1, b: 2 }, { a: 1, b: 2 });
      expect(result.match).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect added keys', () => {
      const result = compareJson({ a: 1 }, { a: 1, b: 2 });
      expect(result.match).toBe(false);
      expect(result.differences).toContainEqual(
        expect.objectContaining({ type: 'added', path: 'b' })
      );
    });

    it('should detect removed keys', () => {
      const result = compareJson({ a: 1, b: 2 }, { a: 1 });
      expect(result.match).toBe(false);
      expect(result.differences).toContainEqual(
        expect.objectContaining({ type: 'removed', path: 'b' })
      );
    });

    it('should detect changed values', () => {
      const result = compareJson({ a: 1 }, { a: 2 });
      expect(result.match).toBe(false);
      expect(result.differences).toContainEqual(
        expect.objectContaining({ type: 'changed', path: 'a' })
      );
    });

    it('should respect ignoreKeys option', () => {
      const result = compareJson(
        { a: 1, timestamp: 123 },
        { a: 1, timestamp: 456 },
        { ignoreKeys: ['timestamp'] }
      );
      expect(result.match).toBe(true);
    });

    it('should respect numberTolerance option', () => {
      const result = compareJson(
        { value: 1.0 },
        { value: 1.001 },
        { numberTolerance: 0.01 }
      );
      expect(result.match).toBe(true);
    });

    it('should compare nested objects', () => {
      const result = compareJson(
        { nested: { a: 1 } },
        { nested: { a: 2 } }
      );
      expect(result.match).toBe(false);
      expect(result.differences).toContainEqual(
        expect.objectContaining({ path: 'nested.a' })
      );
    });

    it('should compare arrays', () => {
      const result = compareJson([1, 2, 3], [1, 2, 4]);
      expect(result.match).toBe(false);
    });

    it('should respect ignoreArrayOrder option', () => {
      const result = compareJson(
        [1, 2, 3],
        [3, 1, 2],
        { ignoreArrayOrder: true }
      );
      expect(result.match).toBe(true);
    });
  });

  describe('compareJsonStrings', () => {
    it('should parse and compare JSON strings', () => {
      const result = compareJsonStrings('{"a":1}', '{"a":1}');
      expect(result.match).toBe(true);
    });

    it('should handle invalid JSON', () => {
      const result = compareJsonStrings('invalid', 'invalid');
      expect(result.match).toBe(true); // Same strings
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISL Comparator Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ISL Comparator', () => {
  const sampleISL = `
domain Auth {
  version: "1.0.0"
  
  entity User {
    id: ID
    name: String
  }
  
  behavior Login {
    input { email: String }
    output { token: String }
  }
}
`;

  describe('extractDomainName', () => {
    it('should extract domain name', () => {
      expect(extractDomainName(sampleISL)).toBe('Auth');
    });

    it('should return null for invalid content', () => {
      expect(extractDomainName('invalid content')).toBeNull();
    });
  });

  describe('removeComments', () => {
    it('should remove single-line comments', () => {
      const input = 'code // comment\nmore code';
      expect(removeComments(input)).toBe('code \nmore code');
    });

    it('should remove multi-line comments', () => {
      const input = 'code /* comment */ more';
      expect(removeComments(input)).toBe('code  more');
    });

    it('should remove doc comments', () => {
      const input = '/** doc comment */\ncode';
      expect(removeComments(input)).toBe('\ncode');
    });
  });

  describe('normalizeWhitespace', () => {
    it('should trim and collapse lines', () => {
      const input = '  line 1  \n\n  line 2  ';
      expect(normalizeWhitespace(input)).toBe('line 1\nline 2');
    });
  });

  describe('parseIslElements', () => {
    it('should parse domain', () => {
      const elements = parseIslElements(sampleISL);
      const domain = elements.find(e => e.type === 'domain');
      expect(domain).toBeDefined();
      expect(domain?.name).toBe('Auth');
    });

    it('should parse entities', () => {
      const elements = parseIslElements(sampleISL);
      const entity = elements.find(e => e.type === 'entity');
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('User');
    });

    it('should parse behaviors', () => {
      const elements = parseIslElements(sampleISL);
      const behavior = elements.find(e => e.type === 'behavior');
      expect(behavior).toBeDefined();
      expect(behavior?.name).toBe('Login');
    });
  });

  describe('compareIsl', () => {
    it('should match identical ISL', () => {
      const result = compareIsl(sampleISL, sampleISL);
      expect(result.match).toBe(true);
    });

    it('should detect added entity', () => {
      const modified = sampleISL.replace('behavior Login', `
  entity Admin {
    id: ID
  }
  
  behavior Login`);
      
      const result = compareIsl(sampleISL, modified);
      expect(result.match).toBe(false);
      expect(result.structuralChanges).toBe(true);
    });

    it('should detect removed behavior', () => {
      const modified = sampleISL.replace(/behavior Login[\s\S]*?\}[\s\S]*?\}/, '}');
      const result = compareIsl(sampleISL, modified);
      expect(result.match).toBe(false);
    });

    it('should ignore whitespace when configured', () => {
      const modified = sampleISL.replace(/\n/g, '\n\n');
      const result = compareIsl(sampleISL, modified, { ignoreWhitespace: true });
      expect(result.match).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Generated Code Comparator Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Generated Code Comparator', () => {
  describe('normalizeFormatting', () => {
    it('should normalize line endings', () => {
      const input = 'line1\r\nline2\r\n';
      expect(normalizeFormatting(input)).toBe('line1\nline2');
    });

    it('should remove trailing whitespace', () => {
      const input = 'line1   \nline2\t\t';
      expect(normalizeFormatting(input)).toBe('line1\nline2');
    });

    it('should collapse multiple blank lines', () => {
      const input = 'line1\n\n\n\nline2';
      expect(normalizeFormatting(input)).toBe('line1\n\nline2');
    });
  });

  describe('normalizeTypescript', () => {
    it('should remove generated comments', () => {
      const input = '/** Auto-generated */\nconst x = 1;';
      const result = normalizeTypescript(input, { ignoreGeneratedComments: true });
      expect(result).not.toContain('Auto-generated');
    });

    it('should remove timestamps', () => {
      const input = '// Generated: 2024-01-15T12:00:00Z\nconst x = 1;';
      const result = normalizeTypescript(input, { ignoreTimestamps: true });
      expect(result).toContain('[TIMESTAMP]');
    });
  });

  describe('compareGenerated', () => {
    it('should match identical code', () => {
      const code = 'const x = 1;\nconst y = 2;';
      const result = compareGenerated(code, code);
      expect(result.match).toBe(true);
    });

    it('should detect added lines', () => {
      const result = compareGenerated(
        'const x = 1;',
        'const x = 1;\nconst y = 2;'
      );
      expect(result.match).toBe(false);
      expect(result.addedLines).toBe(1);
    });

    it('should detect removed lines', () => {
      const result = compareGenerated(
        'const x = 1;\nconst y = 2;',
        'const x = 1;'
      );
      expect(result.match).toBe(false);
      expect(result.removedLines).toBe(1);
    });

    it('should ignore formatting when configured', () => {
      const result = compareGenerated(
        'const x = 1;',
        'const x = 1;   ',
        { ignoreFormatting: true }
      );
      expect(result.match).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reporter Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Reporter', () => {
  describe('generateDiff', () => {
    it('should generate diff for different strings', () => {
      const result = generateDiff('line1\nline2', 'line1\nline3');
      expect(result.hasChanges).toBe(true);
      expect(result.hunks.length).toBeGreaterThan(0);
    });

    it('should have no changes for identical strings', () => {
      const result = generateDiff('same', 'same');
      expect(result.hasChanges).toBe(false);
    });

    it('should count additions and deletions', () => {
      const result = generateDiff('old', 'new');
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(1);
    });
  });

  describe('formatUnifiedDiff', () => {
    it('should format diff as string', () => {
      const diffResult = generateDiff('old\nline', 'new\nline');
      const formatted = formatUnifiedDiff(diffResult, { colors: false });
      
      expect(formatted).toContain('@@');
      expect(formatted).toContain('-old');
      expect(formatted).toContain('+new');
    });
  });
});
