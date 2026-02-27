// ============================================================================
// Regression Tests - Tests for parser fixes
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';
import { Lexer } from '../src/lexer.js';

describe('Regression Tests', () => {
  describe('Hash Comments (#)', () => {
    it('should support hash comments at line start', () => {
      const source = `
# This is a comment
domain Test {
  version: "1.0.0"
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.name.name).toBe('Test');
    });

    it('should support hash comments after code', () => {
      const source = `
domain Test {  # inline comment
  version: "1.0.0"  # version comment
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should preserve hash comment tokens', () => {
      const lexer = new Lexer('# comment\ntest');
      const { tokens } = lexer.tokenize();
      const comment = tokens.find(t => t.type === 'COMMENT');
      expect(comment).toBeDefined();
      expect(comment?.value).toBe('# comment');
    });
  });

  describe('Logical Operators (&&, ||)', () => {
    it('should tokenize && as AND', () => {
      const lexer = new Lexer('a && b');
      const { tokens } = lexer.tokenize();
      const andToken = tokens.find(t => t.kind === 'AND');
      expect(andToken).toBeDefined();
      expect(andToken?.value).toBe('&&');
    });

    it('should tokenize || as OR', () => {
      const lexer = new Lexer('a || b');
      const { tokens } = lexer.tokenize();
      const orToken = tokens.find(t => t.kind === 'OR');
      expect(orToken).toBeDefined();
      expect(orToken?.value).toBe('||');
    });

    it('should parse && in expressions', () => {
      const source = `
domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    invariants {
      active && verified
    }
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.entities[0]?.invariants[0]?.kind).toBe('BinaryExpr');
    });

    it('should parse || in expressions', () => {
      const source = `
domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    invariants {
      active || pending
    }
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Single-Quoted Strings', () => {
    it('should tokenize single-quoted strings', () => {
      const lexer = new Lexer("'hello world'");
      const { tokens } = lexer.tokenize();
      const str = tokens.find(t => t.type === 'STRING');
      expect(str).toBeDefined();
      expect(str?.value).toBe('hello world');
    });

    it('should support escaped single quotes', () => {
      const lexer = new Lexer("'it\\'s working'");
      const { tokens } = lexer.tokenize();
      const str = tokens.find(t => t.type === 'STRING');
      expect(str?.value).toBe("it's working");
    });

    it('should parse single-quoted strings in code', () => {
      const source = `
domain Test {
  version: '1.0.0'
  entity User {
    id: UUID
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.version.value).toBe('1.0.0');
    });
  });

  describe('Brace-less Domain Syntax', () => {
    it('should parse domain without braces', () => {
      const source = `
domain TimeContracts
version "1.0.0"
owner "IntentOS"

type Duration = String
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.name.name).toBe('TimeContracts');
      expect(result.domain?.version.value).toBe('1.0.0');
      expect(result.domain?.owner?.value).toBe('IntentOS');
    });

    it('should support both braced and brace-less syntax', () => {
      const braced = `
domain Test {
  version: "1.0.0"
}
      `;
      const braceless = `
domain Test
version "1.0.0"
      `;
      
      const result1 = parse(braced);
      const result2 = parse(braceless);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.domain?.name.name).toBe(result2.domain?.name.name);
      expect(result1.domain?.version.value).toBe(result2.domain?.version.value);
    });
  });

  describe('Mixed Comment Styles', () => {
    it('should support both // and # comments', () => {
      const source = `
// C-style comment
# Python-style comment
domain Test {
  version: "1.0.0"  // inline
  /* block comment */
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Complex Expressions', () => {
    it('should parse complex logical expressions', () => {
      const source = `
domain Test {
  version: "1.0.0"
  behavior Check {
    input { value: Int }
    output { success: Boolean }
    preconditions {
      (value > 0 && value < 100) || value == -1
    }
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });
});
