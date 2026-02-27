import { describe, it, expect } from 'vitest';
import {
  generateRequireSnippet,
  generateEnsureSnippet,
  generateInvariantSnippet,
  generateRequireAllSnippet,
  generateEnsureAllSnippet,
  generateInvariantAllSnippet,
  generateVerifiedFunctionWrapper,
  generateImportSnippet,
  generateModuleHeader,
  verifySnippetDeterminism,
  combineSnippets,
} from '../src/snippets';

describe('Snippet Generators', () => {
  describe('generateRequireSnippet', () => {
    it('should generate require snippet', () => {
      const snippet = generateRequireSnippet('amount > 0', 'Amount must be positive');
      
      expect(snippet.code).toBe('require(amount > 0, "Amount must be positive");');
      expect(snippet.imports).toContain('require');
      expect(snippet.hash).toBeTruthy();
    });

    it('should escape quotes in message', () => {
      const snippet = generateRequireSnippet('x > 0', 'Value "x" must be positive');
      
      expect(snippet.code).toContain('\\"x\\"');
    });

    it('should be deterministic', () => {
      const snippet1 = generateRequireSnippet('x > 0', 'Test message');
      const snippet2 = generateRequireSnippet('x > 0', 'Test message');
      
      expect(snippet1.code).toBe(snippet2.code);
      expect(snippet1.hash).toBe(snippet2.hash);
    });
  });

  describe('generateEnsureSnippet', () => {
    it('should generate ensure snippet', () => {
      const snippet = generateEnsureSnippet('result !== null', 'Result must not be null');
      
      expect(snippet.code).toBe('ensure(result !== null, "Result must not be null");');
      expect(snippet.imports).toContain('ensure');
    });

    it('should be deterministic', () => {
      const snippet1 = generateEnsureSnippet('result.id', 'Has ID');
      const snippet2 = generateEnsureSnippet('result.id', 'Has ID');
      
      expect(snippet1.hash).toBe(snippet2.hash);
    });
  });

  describe('generateInvariantSnippet', () => {
    it('should generate invariant snippet', () => {
      const snippet = generateInvariantSnippet('balance >= 0', 'Balance must never be negative');
      
      expect(snippet.code).toBe('invariant(balance >= 0, "Balance must never be negative");');
      expect(snippet.imports).toContain('invariant');
    });

    it('should be deterministic', () => {
      const snippet1 = generateInvariantSnippet('count >= 0', 'Non-negative');
      const snippet2 = generateInvariantSnippet('count >= 0', 'Non-negative');
      
      expect(snippet1.hash).toBe(snippet2.hash);
    });
  });

  describe('generateRequireAllSnippet', () => {
    it('should generate batch require snippet', () => {
      const checks: Array<[string, string]> = [
        ['amount > 0', 'Amount must be positive'],
        ['user !== null', 'User is required'],
      ];
      
      const snippet = generateRequireAllSnippet(checks);
      
      expect(snippet.code).toContain('requireAll([');
      expect(snippet.code).toContain('[amount > 0, "Amount must be positive"],');
      expect(snippet.code).toContain('[user !== null, "User is required"],');
      expect(snippet.code).toContain(']);');
      expect(snippet.imports).toContain('requireAll');
    });

    it('should be deterministic for same input order', () => {
      const checks: Array<[string, string]> = [
        ['a > 0', 'A positive'],
        ['b > 0', 'B positive'],
      ];
      
      const snippet1 = generateRequireAllSnippet(checks);
      const snippet2 = generateRequireAllSnippet(checks);
      
      expect(snippet1.hash).toBe(snippet2.hash);
    });
  });

  describe('generateEnsureAllSnippet', () => {
    it('should generate batch ensure snippet', () => {
      const checks: Array<[string, string]> = [
        ['result.id', 'Has ID'],
        ['result.name', 'Has name'],
      ];
      
      const snippet = generateEnsureAllSnippet(checks);
      
      expect(snippet.code).toContain('ensureAll([');
      expect(snippet.imports).toContain('ensureAll');
    });
  });

  describe('generateInvariantAllSnippet', () => {
    it('should generate batch invariant snippet', () => {
      const checks: Array<[string, string]> = [
        ['total >= 0', 'Total non-negative'],
        ['items.length >= 0', 'Items non-negative'],
      ];
      
      const snippet = generateInvariantAllSnippet(checks);
      
      expect(snippet.code).toContain('invariantAll([');
      expect(snippet.imports).toContain('invariantAll');
    });
  });

  describe('generateVerifiedFunctionWrapper', () => {
    it('should generate complete wrapper with preconditions', () => {
      const snippet = generateVerifiedFunctionWrapper(
        'createUser',
        [['input.email', 'Email is required']],
        [],
        []
      );
      
      expect(snippet.code).toContain('async function verified_createUser');
      expect(snippet.code).toContain('// Preconditions');
      expect(snippet.code).toContain('require(input.email, "Email is required")');
      expect(snippet.code).toContain('const result = await impl(input)');
      expect(snippet.code).toContain('return result');
      expect(snippet.imports).toContain('require');
    });

    it('should generate wrapper with postconditions', () => {
      const snippet = generateVerifiedFunctionWrapper(
        'createUser',
        [],
        [['result.id', 'Must have ID']],
        []
      );
      
      expect(snippet.code).toContain('// Postconditions');
      expect(snippet.code).toContain('ensure(result.id, "Must have ID")');
      expect(snippet.imports).toContain('ensure');
    });

    it('should generate wrapper with invariants', () => {
      const snippet = generateVerifiedFunctionWrapper(
        'transfer',
        [],
        [],
        [['balance >= 0', 'Balance must never be negative']]
      );
      
      expect(snippet.code).toContain('// Capture state for invariants');
      expect(snippet.code).toContain('captureState()');
      expect(snippet.code).toContain('// Invariants');
      expect(snippet.code).toContain('invariant(balance >= 0, "Balance must never be negative")');
      expect(snippet.imports).toContain('invariant');
      expect(snippet.imports).toContain('captureState');
    });

    it('should generate wrapper with all checks', () => {
      const snippet = generateVerifiedFunctionWrapper(
        'process',
        [['input.valid', 'Input valid']],
        [['result.success', 'Success']],
        [['state.ok', 'State OK']]
      );
      
      expect(snippet.code).toContain('// Preconditions');
      expect(snippet.code).toContain('// Postconditions');
      expect(snippet.code).toContain('// Invariants');
      expect(snippet.imports).toContain('require');
      expect(snippet.imports).toContain('ensure');
      expect(snippet.imports).toContain('invariant');
    });

    it('should include types when requested', () => {
      const snippet = generateVerifiedFunctionWrapper(
        'test',
        [],
        [],
        [],
        { includeTypes: true, language: 'typescript' }
      );
      
      expect(snippet.code).toContain('<TInput, TResult>');
      expect(snippet.code).toContain(': TInput');
      expect(snippet.code).toContain('Promise<TResult>');
    });

    it('should be deterministic', () => {
      const snippet1 = generateVerifiedFunctionWrapper(
        'test',
        [['a', 'A']],
        [['b', 'B']],
        [['c', 'C']]
      );
      
      const snippet2 = generateVerifiedFunctionWrapper(
        'test',
        [['a', 'A']],
        [['b', 'B']],
        [['c', 'C']]
      );
      
      expect(snippet1.hash).toBe(snippet2.hash);
      expect(snippet1.code).toBe(snippet2.code);
    });
  });

  describe('generateImportSnippet', () => {
    it('should generate import statement', () => {
      const snippet = generateImportSnippet(['require', 'ensure', 'invariant']);
      
      expect(snippet.code).toBe("import { ensure, invariant, require } from '@isl-lang/runtime-verify';");
    });

    it('should sort imports alphabetically', () => {
      const snippet = generateImportSnippet(['invariant', 'require', 'ensure']);
      
      expect(snippet.code).toContain('ensure, invariant, require');
    });

    it('should be deterministic regardless of input order', () => {
      const snippet1 = generateImportSnippet(['require', 'ensure']);
      const snippet2 = generateImportSnippet(['ensure', 'require']);
      
      expect(snippet1.code).toBe(snippet2.code);
      expect(snippet1.hash).toBe(snippet2.hash);
    });
  });

  describe('generateModuleHeader', () => {
    it('should generate complete module header', () => {
      const snippet = generateModuleHeader();
      
      expect(snippet.code).toContain('// Generated by @isl-lang/runtime-verify');
      expect(snippet.code).toContain('import {');
      expect(snippet.code).toContain('require,');
      expect(snippet.code).toContain('ensure,');
      expect(snippet.code).toContain('invariant,');
      expect(snippet.code).toContain('PreconditionError,');
      expect(snippet.code).toContain("} from '@isl-lang/runtime-verify';");
    });

    it('should be deterministic', () => {
      const snippet1 = generateModuleHeader();
      const snippet2 = generateModuleHeader();
      
      expect(snippet1.hash).toBe(snippet2.hash);
    });
  });

  describe('verifySnippetDeterminism', () => {
    it('should return true for valid snippet', () => {
      const snippet = generateRequireSnippet('x > 0', 'Positive');
      
      expect(verifySnippetDeterminism(snippet)).toBe(true);
    });

    it('should return false for tampered snippet', () => {
      const snippet = generateRequireSnippet('x > 0', 'Positive');
      
      // Tamper with the code
      const tampered = {
        ...snippet,
        code: snippet.code + ' // tampered',
      };
      
      expect(verifySnippetDeterminism(tampered)).toBe(false);
    });
  });

  describe('combineSnippets', () => {
    it('should combine multiple snippets', () => {
      const snippet1 = generateRequireSnippet('a > 0', 'A positive');
      const snippet2 = generateEnsureSnippet('b > 0', 'B positive');
      
      const combined = combineSnippets([snippet1, snippet2]);
      
      expect(combined.code).toContain(snippet1.code);
      expect(combined.code).toContain(snippet2.code);
    });

    it('should merge imports', () => {
      const snippet1 = generateRequireSnippet('a > 0', 'A');
      const snippet2 = generateEnsureSnippet('b > 0', 'B');
      const snippet3 = generateInvariantSnippet('c > 0', 'C');
      
      const combined = combineSnippets([snippet1, snippet2, snippet3]);
      
      expect(combined.imports).toContain('require');
      expect(combined.imports).toContain('ensure');
      expect(combined.imports).toContain('invariant');
    });

    it('should sort imports alphabetically', () => {
      const snippet1 = generateRequireSnippet('a > 0', 'A');
      const snippet2 = generateEnsureSnippet('b > 0', 'B');
      
      const combined = combineSnippets([snippet1, snippet2]);
      
      expect(combined.imports).toEqual(['ensure', 'require']);
    });

    it('should use custom separator', () => {
      const snippet1 = generateRequireSnippet('a > 0', 'A');
      const snippet2 = generateEnsureSnippet('b > 0', 'B');
      
      const combined = combineSnippets([snippet1, snippet2], '\n');
      
      expect(combined.code).toBe(`${snippet1.code}\n${snippet2.code}`);
    });

    it('should produce deterministic hash', () => {
      const snippet1 = generateRequireSnippet('a > 0', 'A');
      const snippet2 = generateEnsureSnippet('b > 0', 'B');
      
      const combined1 = combineSnippets([snippet1, snippet2]);
      const combined2 = combineSnippets([snippet1, snippet2]);
      
      expect(combined1.hash).toBe(combined2.hash);
    });
  });

  describe('Determinism Verification', () => {
    it('all snippet generators should be deterministic', () => {
      // Run each generator twice and verify hashes match
      const generators = [
        () => generateRequireSnippet('x > 0', 'Positive'),
        () => generateEnsureSnippet('x > 0', 'Positive'),
        () => generateInvariantSnippet('x > 0', 'Positive'),
        () => generateRequireAllSnippet([['x > 0', 'X'], ['y > 0', 'Y']]),
        () => generateEnsureAllSnippet([['x > 0', 'X'], ['y > 0', 'Y']]),
        () => generateInvariantAllSnippet([['x > 0', 'X'], ['y > 0', 'Y']]),
        () => generateVerifiedFunctionWrapper('test', [['a', 'A']], [['b', 'B']], [['c', 'C']]),
        () => generateImportSnippet(['require', 'ensure']),
        () => generateModuleHeader(),
      ];
      
      for (const generator of generators) {
        const result1 = generator();
        const result2 = generator();
        
        expect(result1.hash).toBe(result2.hash);
        expect(result1.code).toBe(result2.code);
        expect(verifySnippetDeterminism(result1)).toBe(true);
        expect(verifySnippetDeterminism(result2)).toBe(true);
      }
    });

    it('different inputs should produce different hashes', () => {
      const snippet1 = generateRequireSnippet('x > 0', 'Positive');
      const snippet2 = generateRequireSnippet('y > 0', 'Positive');
      const snippet3 = generateRequireSnippet('x > 0', 'Different message');
      
      expect(snippet1.hash).not.toBe(snippet2.hash);
      expect(snippet1.hash).not.toBe(snippet3.hash);
      expect(snippet2.hash).not.toBe(snippet3.hash);
    });
  });
});
