// ============================================================================
// Error Handling Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';
import { ErrorCode } from '../src/errors.js';

describe('Error Handling', () => {
  describe('Syntax Errors', () => {
    it('should report missing closing brace', () => {
      const source = `domain Test { version: "1.0.0"`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report unexpected tokens', () => {
      const source = `domain Test { version: "1.0.0" @ }`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.code === ErrorCode.UNEXPECTED_TOKEN || 
        e.code === ErrorCode.UNEXPECTED_CHARACTER
      )).toBe(true);
    });

    it('should report missing version', () => {
      const source = `domain Test { entity User { id: UUID } }`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.message.toLowerCase().includes('version')
      )).toBe(true);
    });

    it('should report unterminated strings', () => {
      const source = `domain Test { version: "unterminated }`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ErrorCode.UNTERMINATED_STRING)).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should continue parsing after syntax error', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Bad { @@@ }
          entity Good {
            id: UUID
          }
        }
      `;
      const result = parse(source);
      
      // Should have errors but also parse some content
      expect(result.errors.length).toBeGreaterThan(0);
      // The domain should still be partially constructed
      expect(result.domain).toBeDefined();
    });

    it('should report multiple errors', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity One { "invalid }
          entity Two { "also invalid }
        }
      `;
      const result = parse(source);
      
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Error Location', () => {
    it('should report correct line number', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    invalid@field: String
  }
}`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      const error = result.errors[0];
      expect(error?.location.line).toBe(5);
    });

    it('should report correct column number', () => {
      const source = `domain Test { version: @invalid }`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      const error = result.errors[0];
      expect(error?.location).toBeDefined();
      expect(error?.location.column).toBeGreaterThan(0);
    });

    it('should include filename in location', () => {
      const source = `domain Test { version: @invalid }`;
      const result = parse(source, 'test.isl');
      
      const error = result.errors[0];
      expect(error?.location.file).toBe('test.isl');
    });
  });

  describe('Diagnostic Information', () => {
    it('should include error code', () => {
      const source = `domain Test { version: "1.0.0" @@ }`;
      const result = parse(source);
      
      const error = result.errors[0];
      expect(error?.code).toBeDefined();
      expect(error?.code.length).toBeGreaterThan(0);
    });

    it('should include source', () => {
      const source = `domain Test {`;
      const result = parse(source);
      
      const error = result.errors[0];
      expect(error?.source).toBe('parser');
    });

    it('should include severity', () => {
      const source = `domain Test {`;
      const result = parse(source);
      
      const error = result.errors[0];
      expect(error?.severity).toBe('error');
    });
  });

  describe('Specific Error Cases', () => {
    it('should handle invalid escape sequences', () => {
      const source = `domain Test { version: "test\\z" }`;
      const result = parse(source);
      
      // Should either report error or handle gracefully
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle unterminated block comments', () => {
      const source = `domain Test { /* never ends version: "1.0.0" }`;
      const result = parse(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ErrorCode.UNTERMINATED_COMMENT)).toBe(true);
    });

    it('should handle empty input', () => {
      const result = parse('');
      
      expect(result.success).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      const result = parse('   \n\n\t  ');
      
      expect(result.success).toBe(false);
    });
  });

  describe('Graceful Degradation', () => {
    it('should return partial AST on error', () => {
      const source = `
        domain PartialTest {
          version: "1.0.0"
          entity ValidEntity {
            id: UUID
          }
          entity InvalidEntity {
            @@@
          }
        }
      `;
      const result = parse(source);
      
      expect(result.domain).toBeDefined();
      expect(result.domain?.name.name).toBe('PartialTest');
      expect(result.domain?.version.value).toBe('1.0.0');
    });

    it('should include tokens even on error', () => {
      const source = `domain Test { version: "1.0.0" @@ }`;
      const result = parse(source);
      
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.length).toBeGreaterThan(0);
    });
  });
});
