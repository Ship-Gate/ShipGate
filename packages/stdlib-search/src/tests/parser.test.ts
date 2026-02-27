/**
 * Tests for query parser
 */

import { describe, it, expect } from 'vitest';
import { QueryParser } from '../query/parser.js';

describe('QueryParser', () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe('Term Queries', () => {
    it('should parse simple term', () => {
      const query = parser.parse('test');
      expect(query.type).toBe('term');
      expect(query.term).toBe('test');
      expect(query.field).toBe('_all');
    });

    it('should parse field-specific term', () => {
      const query = parser.parse('title:test');
      expect(query.type).toBe('term');
      expect(query.term).toBe('test');
      expect(query.field).toBe('title');
    });

    it('should handle empty query', () => {
      const query = parser.parse('');
      expect(query.type).toBe('term');
      expect(query.term).toBe('');
    });
  });

  describe('Phrase Queries', () => {
    it('should parse quoted phrases', () => {
      const query = parser.parse('"quick brown fox"');
      expect(query.type).toBe('phrase');
      expect(query.terms).toEqual(['quick', 'brown', 'fox']);
    });

    it('should parse field-specific phrases', () => {
      const query = parser.parse('title:"quick brown"');
      expect(query.type).toBe('phrase');
      expect(query.field).toBe('title');
      expect(query.terms).toEqual(['quick', 'brown']);
    });

    it('should handle single quotes', () => {
      const query = parser.parse("'quick brown'");
      expect(query.type).toBe('phrase');
      expect(query.terms).toEqual(['quick', 'brown']);
    });
  });

  describe('Boolean Queries', () => {
    it('should parse AND queries', () => {
      const query = parser.parse('quick AND brown');
      expect(query.type).toBe('boolean');
      expect(query.must).toHaveLength(2);
      expect(query.should).toBeUndefined();
    });

    it('should parse OR queries', () => {
      const query = parser.parse('quick OR brown');
      expect(query.type).toBe('boolean');
      expect(query.should).toHaveLength(2);
      expect(query.must).toBeUndefined();
    });

    it('should parse NOT queries', () => {
      const query = parser.parse('quick NOT brown');
      expect(query.type).toBe('boolean');
      expect(query.must).toHaveLength(1);
      expect(query.must_not).toHaveLength(1);
    });

    it('should parse complex boolean queries', () => {
      const query = parser.parse('quick AND brown OR fox NOT lazy');
      expect(query.type).toBe('boolean');
      expect(query.must).toBeDefined();
      expect(query.should).toBeDefined();
      expect(query.must_not).toBeDefined();
    });

    it('should handle parentheses in advanced parsing', () => {
      const query = parser.parseAdvanced('(quick AND brown) OR fox');
      expect(query.type).toBe('boolean');
    });
  });

  describe('Wildcard Queries', () => {
    it('should parse wildcard patterns', () => {
      const query = parser.parse('br*wn');
      expect(query.type).toBe('wildcard');
      expect(query.term).toBe('br*wn');
    });

    it('should parse field-specific wildcards', () => {
      const query = parser.parse('title:qu*');
      expect(query.type).toBe('wildcard');
      expect(query.field).toBe('title');
      expect(query.term).toBe('qu*');
    });

    it('should handle question mark wildcards', () => {
      const query = parser.parse('br?wn');
      expect(query.type).toBe('wildcard');
      expect(query.term).toBe('br?wn');
    });
  });

  describe('Fuzzy Queries', () => {
    it('should parse fuzzy queries', () => {
      const query = parser.parse('quick~');
      expect(query.type).toBe('fuzzy');
      expect(query.term).toBe('quick');
      expect(query.fuzziness).toBe(1);
    });

    it('should parse fuzzy with distance', () => {
      const query = parser.parse('quick~2');
      expect(query.type).toBe('fuzzy');
      expect(query.term).toBe('quick');
      expect(query.fuzziness).toBe(2);
    });

    it('should parse field-specific fuzzy', () => {
      const query = parser.parse('title:quick~1.5');
      expect(query.type).toBe('fuzzy');
      expect(query.field).toBe('title');
      expect(query.fuzziness).toBe(1.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed case', () => {
      const query = parser.parse('Quick AND brown');
      expect(query.type).toBe('boolean');
      expect(query.must![0].term).toBe('quick');
      expect(query.must![1].term).toBe('brown');
    });

    it('should handle extra whitespace', () => {
      const query = parser.parse('  quick   AND   brown  ');
      expect(query.type).toBe('boolean');
      expect(query.must).toHaveLength(2);
    });

    it('should handle special characters in phrases', () => {
      const query = parser.parse('"test-with/special@chars"');
      expect(query.type).toBe('phrase');
      expect(query.terms).toEqual(['test-with/special@chars']);
    });

    it('should handle escaped quotes', () => {
      // This is a simplified test - full escape handling would be more complex
      const query = parser.parse('"test \\"quoted\\""');
      expect(query.type).toBe('phrase');
    });
  });

  describe('Complex Queries', () => {
    it('should parse mixed query types', () => {
      const query = parser.parse('title:"quick brown" AND content:fox* OR author:john~');
      expect(query.type).toBe('boolean');
      expect(query.must).toBeDefined();
      expect(query.should).toBeDefined();
    });

    it('should handle nested boolean logic', () => {
      const query = parser.parse('quick AND (brown OR fox) NOT lazy');
      expect(query.type).toBe('boolean');
      // More complex parsing would handle nested structures
    });
  });
});
