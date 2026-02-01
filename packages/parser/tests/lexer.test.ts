// ============================================================================
// Lexer Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { Lexer, tokenize } from '../src/lexer.js';

describe('Lexer', () => {
  describe('Basic Tokenization', () => {
    it('should tokenize keywords', () => {
      const { tokens } = tokenize('domain entity behavior type enum');
      
      expect(tokens.filter(t => t.type !== 'EOF').map(t => t.kind)).toEqual([
        'DOMAIN', 'ENTITY', 'BEHAVIOR', 'TYPE', 'ENUM'
      ]);
    });

    it('should tokenize identifiers', () => {
      const { tokens } = tokenize('User userId user_name _private');
      
      const identifiers = tokens.filter(t => t.kind === 'IDENTIFIER');
      expect(identifiers.map(t => t.value)).toEqual([
        'User', 'userId', 'user_name', '_private'
      ]);
    });

    it('should tokenize primitive types', () => {
      const { tokens } = tokenize('String Int Decimal Boolean Timestamp UUID Duration');
      
      expect(tokens.filter(t => t.type !== 'EOF').map(t => t.value)).toEqual([
        'String', 'Int', 'Decimal', 'Boolean', 'Timestamp', 'UUID', 'Duration'
      ]);
    });

    it('should tokenize punctuation', () => {
      const { tokens } = tokenize('{ } ( ) [ ] , : ; . ?');
      
      const puncs = tokens.filter(t => t.type === 'PUNCTUATION');
      expect(puncs.map(t => t.kind)).toEqual([
        'LBRACE', 'RBRACE', 'LPAREN', 'RPAREN', 'LBRACKET', 'RBRACKET',
        'COMMA', 'COLON', 'SEMICOLON', 'DOT', 'QUESTION'
      ]);
    });

    it('should tokenize operators', () => {
      const { tokens } = tokenize('== != < > <= >= + - * / = -> =>');
      
      const ops = tokens.filter(t => t.type === 'OPERATOR');
      expect(ops.map(t => t.kind)).toEqual([
        'EQUALS', 'NOT_EQUALS', 'LT', 'GT', 'LTE', 'GTE',
        'PLUS', 'MINUS', 'STAR', 'SLASH', 'ASSIGN', 'ARROW', 'FAT_ARROW'
      ]);
    });
  });

  describe('String Literals', () => {
    it('should tokenize simple strings', () => {
      const { tokens } = tokenize('"hello world"');
      
      const strings = tokens.filter(t => t.type === 'STRING');
      expect(strings).toHaveLength(1);
      expect(strings[0]?.value).toBe('hello world');
    });

    it('should handle escape sequences', () => {
      const { tokens } = tokenize('"line1\\nline2\\ttab"');
      
      const strings = tokens.filter(t => t.type === 'STRING');
      expect(strings[0]?.value).toBe('line1\nline2\ttab');
    });

    it('should handle escaped quotes', () => {
      const { tokens } = tokenize('"say \\"hello\\""');
      
      const strings = tokens.filter(t => t.type === 'STRING');
      expect(strings[0]?.value).toBe('say "hello"');
    });

    it('should report unterminated strings', () => {
      const { errors } = tokenize('"unterminated');
      
      expect(errors.hasErrors()).toBe(true);
      expect(errors.getErrors()[0]?.code).toBe('L002');
    });
  });

  describe('Number Literals', () => {
    it('should tokenize integers', () => {
      const { tokens } = tokenize('42 0 123');
      
      const numbers = tokens.filter(t => t.type === 'NUMBER');
      expect(numbers.map(t => t.value)).toEqual(['42', '0', '123']);
    });

    it('should tokenize decimals', () => {
      const { tokens } = tokenize('3.14 0.5 100.00');
      
      const numbers = tokens.filter(t => t.type === 'NUMBER');
      expect(numbers.map(t => t.value)).toEqual(['3.14', '0.5', '100.00']);
    });

    it('should tokenize negative numbers', () => {
      const { tokens } = tokenize('-42 -3.14');
      
      // Negative numbers are parsed as MINUS followed by NUMBER
      const negAndNum = tokens.filter(t => t.type === 'OPERATOR' || t.type === 'NUMBER');
      expect(negAndNum[0]?.kind).toBe('MINUS');
      expect(negAndNum[1]?.value).toBe('42');
    });
  });

  describe('Duration Literals', () => {
    it('should tokenize durations with units', () => {
      const { tokens } = tokenize('200ms 5seconds 1minutes 2hours 7days');
      
      const durations = tokens.filter(t => t.type === 'DURATION');
      expect(durations).toHaveLength(5);
      expect(durations.map(t => t.value)).toEqual([
        '200ms', '5seconds', '1minutes', '2hours', '7days'
      ]);
    });
  });

  describe('Boolean Literals', () => {
    it('should tokenize booleans', () => {
      const { tokens } = tokenize('true false');
      
      const bools = tokens.filter(t => t.type === 'BOOLEAN');
      expect(bools).toHaveLength(2);
      expect(bools.map(t => t.value)).toEqual(['true', 'false']);
    });
  });

  describe('Comments', () => {
    it('should skip line comments', () => {
      const { tokens } = tokenize('domain // this is a comment\nUser');
      
      // Comments are preserved but filtered in tokenize output
      const nonComment = tokens.filter(t => t.type !== 'COMMENT' && t.type !== 'EOF');
      expect(nonComment.map(t => t.value)).toEqual(['domain', 'User']);
    });

    it('should skip block comments', () => {
      const { tokens } = tokenize('domain /* multi\nline\ncomment */ User');
      
      const nonComment = tokens.filter(t => t.type !== 'COMMENT' && t.type !== 'EOF');
      expect(nonComment.map(t => t.value)).toEqual(['domain', 'User']);
    });

    it('should report unterminated block comments', () => {
      const { errors } = tokenize('/* never ends');
      
      expect(errors.hasErrors()).toBe(true);
      expect(errors.getErrors()[0]?.code).toBe('L006');
    });
  });

  describe('Logical Operators', () => {
    it('should tokenize logical keywords', () => {
      const { tokens } = tokenize('and or not implies iff in');
      
      const ops = tokens.filter(t => t.type === 'KEYWORD' && t.type !== 'EOF');
      expect(ops.map(t => t.kind)).toEqual([
        'AND', 'OR', 'NOT', 'IMPLIES', 'IFF', 'IN'
      ]);
    });
  });

  describe('Source Locations', () => {
    it('should track line and column numbers', () => {
      const { tokens } = tokenize('domain\n  Test');
      
      const domainToken = tokens.find(t => t.value === 'domain');
      const testToken = tokens.find(t => t.value === 'Test');
      
      expect(domainToken?.location.line).toBe(1);
      expect(domainToken?.location.column).toBe(1);
      expect(testToken?.location.line).toBe(2);
      expect(testToken?.location.column).toBe(3);
    });

    it('should track end positions', () => {
      const { tokens } = tokenize('"hello"');
      
      const strToken = tokens.find(t => t.type === 'STRING');
      expect(strToken?.location.column).toBe(1);
      expect(strToken?.location.endColumn).toBe(8);
    });
  });

  describe('Complete Domain Tokenization', () => {
    it('should tokenize a minimal domain', () => {
      const source = `
        domain Minimal {
          version: "1.0.0"
          entity User {
            id: UUID [immutable, unique]
            name: String
          }
        }
      `;
      
      const { tokens, errors } = tokenize(source);
      
      expect(errors.hasErrors()).toBe(false);
      expect(tokens.filter(t => t.type !== 'EOF')).toHaveLength(22);
    });
  });
});
