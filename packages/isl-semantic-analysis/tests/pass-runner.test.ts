/**
 * Semantic Pass Framework Tests
 * 
 * Tests:
 * - Pass registration and execution
 * - Dependency-based execution order
 * - Caching behavior
 * - CLI output formatting
 * - Multiple passes producing stable output
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DomainDeclaration, SourceSpan } from '@isl-lang/isl-core';
import type { Diagnostic } from '@isl-lang/errors';
import type { SemanticPass, PassContext, TypeEnvironment } from '../src/types.js';
import { PassRunner, createPassRunner } from '../src/pass-runner.js';
import { buildTypeEnvironment, emptyTypeEnvironment } from '../src/type-environment.js';
import { CLIFormatter, formatResult } from '../src/cli-formatter.js';
import { builtinPasses } from '../src/passes/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSpan(line: number, column: number, endLine?: number, endColumn?: number): SourceSpan {
  return {
    start: { line, column, offset: 0 },
    end: { line: endLine ?? line, column: endColumn ?? column + 10, offset: 100 },
  };
}

function createMockAST(overrides: Partial<DomainDeclaration> = {}): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: { kind: 'Identifier', name: 'TestDomain', span: createSpan(1, 1) },
    span: createSpan(1, 1, 100, 1),
    entities: [],
    behaviors: [],
    types: [],
    enums: [],
    imports: [],
    invariants: null,
    uiBlueprints: [],
    location: {
      file: 'test.isl',
      line: 1,
      column: 1,
      endLine: 100,
      endColumn: 1,
    },
    ...overrides,
  } as DomainDeclaration;
}

function createTestPass(id: string, options: {
  dependencies?: string[];
  priority?: number;
  diagnostics?: Diagnostic[];
  delay?: number;
} = {}): SemanticPass {
  return {
    id,
    name: `Test Pass ${id}`,
    description: `A test pass with id ${id}`,
    dependencies: options.dependencies,
    priority: options.priority ?? 0,
    enabledByDefault: true,
    run: (ctx: PassContext) => {
      // Simulate async work
      if (options.delay) {
        const start = Date.now();
        while (Date.now() - start < options.delay) { /* busy wait */ }
      }
      return options.diagnostics ?? [];
    },
  };
}

function createDiagnostic(code: string, message: string, line: number = 1): Diagnostic {
  return {
    code,
    category: 'semantic',
    severity: 'error',
    message,
    location: {
      file: 'test.isl',
      line,
      column: 1,
      endLine: line,
      endColumn: 10,
    },
    source: 'verifier',
  };
}

// ============================================================================
// Pass Registration Tests
// ============================================================================

describe('PassRunner', () => {
  describe('registration', () => {
    it('should register a single pass', () => {
      const runner = createPassRunner();
      const pass = createTestPass('test-1');
      
      runner.register(pass);
      
      expect(runner.getPass('test-1')).toBe(pass);
      expect(runner.getAllPasses()).toHaveLength(1);
    });

    it('should register multiple passes', () => {
      const runner = createPassRunner();
      const passes = [
        createTestPass('pass-a'),
        createTestPass('pass-b'),
        createTestPass('pass-c'),
      ];
      
      runner.registerAll(passes);
      
      expect(runner.getAllPasses()).toHaveLength(3);
      expect(runner.getPass('pass-a')).toBeDefined();
      expect(runner.getPass('pass-b')).toBeDefined();
      expect(runner.getPass('pass-c')).toBeDefined();
    });

    it('should override pass with same id', () => {
      const runner = createPassRunner();
      const pass1 = createTestPass('dup', { priority: 1 });
      const pass2 = createTestPass('dup', { priority: 2 });
      
      runner.register(pass1);
      runner.register(pass2);
      
      expect(runner.getAllPasses()).toHaveLength(1);
      expect(runner.getPass('dup')?.priority).toBe(2);
    });
  });

  // ============================================================================
  // Execution Tests
  // ============================================================================

  describe('execution', () => {
    it('should run all registered passes', () => {
      const runner = createPassRunner();
      const executionOrder: string[] = [];
      
      runner.registerAll([
        {
          ...createTestPass('a'),
          run: () => { executionOrder.push('a'); return []; },
        },
        {
          ...createTestPass('b'),
          run: () => { executionOrder.push('b'); return []; },
        },
      ]);

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(executionOrder).toContain('a');
      expect(executionOrder).toContain('b');
      expect(result.passResults).toHaveLength(2);
    });

    it('should collect diagnostics from all passes', () => {
      const runner = createPassRunner();
      
      runner.registerAll([
        createTestPass('a', { diagnostics: [createDiagnostic('E0001', 'Error A')] }),
        createTestPass('b', { diagnostics: [createDiagnostic('E0002', 'Error B')] }),
      ]);

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.diagnostics).toHaveLength(2);
      expect(result.diagnostics.map(d => d.code)).toContain('E0001');
      expect(result.diagnostics.map(d => d.code)).toContain('E0002');
    });

    it('should deduplicate identical diagnostics', () => {
      const runner = createPassRunner();
      const dup = createDiagnostic('E0001', 'Same error');
      
      runner.registerAll([
        createTestPass('a', { diagnostics: [dup] }),
        createTestPass('b', { diagnostics: [dup] }),
      ]);

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.diagnostics).toHaveLength(1);
    });

    it('should handle pass exceptions gracefully', () => {
      const runner = createPassRunner();
      
      runner.register({
        ...createTestPass('broken'),
        run: () => { throw new Error('Pass crashed!'); },
      });

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.passResults[0].succeeded).toBe(false);
      expect(result.passResults[0].error).toBe('Pass crashed!');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toContain('Pass crashed!');
    });
  });

  // ============================================================================
  // Dependency Order Tests
  // ============================================================================

  describe('dependency ordering', () => {
    it('should execute dependencies before dependent passes', () => {
      const runner = createPassRunner();
      const executionOrder: string[] = [];

      runner.registerAll([
        {
          ...createTestPass('consumer', { dependencies: ['provider'] }),
          run: () => { executionOrder.push('consumer'); return []; },
        },
        {
          ...createTestPass('provider'),
          run: () => { executionOrder.push('provider'); return []; },
        },
      ]);

      runner.run(createMockAST(), '', 'test.isl');
      
      const providerIndex = executionOrder.indexOf('provider');
      const consumerIndex = executionOrder.indexOf('consumer');
      
      expect(providerIndex).toBeLessThan(consumerIndex);
    });

    it('should handle complex dependency chains', () => {
      const runner = createPassRunner();
      const executionOrder: string[] = [];

      // D depends on B and C, B depends on A, C depends on A
      runner.registerAll([
        {
          ...createTestPass('d', { dependencies: ['b', 'c'] }),
          run: () => { executionOrder.push('d'); return []; },
        },
        {
          ...createTestPass('c', { dependencies: ['a'] }),
          run: () => { executionOrder.push('c'); return []; },
        },
        {
          ...createTestPass('b', { dependencies: ['a'] }),
          run: () => { executionOrder.push('b'); return []; },
        },
        {
          ...createTestPass('a'),
          run: () => { executionOrder.push('a'); return []; },
        },
      ]);

      runner.run(createMockAST(), '', 'test.isl');
      
      const indexOf = (id: string) => executionOrder.indexOf(id);
      
      // A must run before B and C
      expect(indexOf('a')).toBeLessThan(indexOf('b'));
      expect(indexOf('a')).toBeLessThan(indexOf('c'));
      
      // B and C must run before D
      expect(indexOf('b')).toBeLessThan(indexOf('d'));
      expect(indexOf('c')).toBeLessThan(indexOf('d'));
    });

    it('should detect circular dependencies', () => {
      const runner = createPassRunner();

      runner.registerAll([
        createTestPass('a', { dependencies: ['b'] }),
        createTestPass('b', { dependencies: ['a'] }),
      ]);

      expect(() => runner.run(createMockAST(), '', 'test.isl'))
        .toThrow(/circular dependency/i);
    });

    it('should respect priority among peers', () => {
      const runner = createPassRunner();
      const executionOrder: string[] = [];

      runner.registerAll([
        {
          ...createTestPass('low', { priority: 10 }),
          run: () => { executionOrder.push('low'); return []; },
        },
        {
          ...createTestPass('high', { priority: 100 }),
          run: () => { executionOrder.push('high'); return []; },
        },
        {
          ...createTestPass('medium', { priority: 50 }),
          run: () => { executionOrder.push('medium'); return []; },
        },
      ]);

      runner.run(createMockAST(), '', 'test.isl');
      
      // High priority should run first
      expect(executionOrder[0]).toBe('high');
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('caching', () => {
    it('should cache pass results', () => {
      let callCount = 0;
      const runner = createPassRunner({ cacheEnabled: true });
      
      runner.register({
        ...createTestPass('cached'),
        run: () => { callCount++; return []; },
      });

      const source = 'domain Test {}';
      
      // First run
      runner.run(createMockAST(), source, 'test.isl');
      expect(callCount).toBe(1);
      
      // Second run with same content - should use cache
      const result = runner.run(createMockAST(), source, 'test.isl');
      expect(callCount).toBe(1);
      expect(result.cacheInfo.hits).toBe(1);
    });

    it('should invalidate cache on content change', () => {
      let callCount = 0;
      const runner = createPassRunner({ cacheEnabled: true });
      
      runner.register({
        ...createTestPass('cached'),
        run: () => { callCount++; return []; },
      });

      runner.run(createMockAST(), 'domain Test {}', 'test.isl');
      expect(callCount).toBe(1);
      
      // Different content - should not use cache
      runner.run(createMockAST(), 'domain Modified {}', 'test.isl');
      expect(callCount).toBe(2);
    });

    it('should respect cache disabled config', () => {
      let callCount = 0;
      const runner = createPassRunner({ cacheEnabled: false });
      
      runner.register({
        ...createTestPass('nocache'),
        run: () => { callCount++; return []; },
      });

      const source = 'domain Test {}';
      
      runner.run(createMockAST(), source, 'test.isl');
      runner.run(createMockAST(), source, 'test.isl');
      
      expect(callCount).toBe(2);
    });

    it('should clear cache on demand', () => {
      let callCount = 0;
      const runner = createPassRunner({ cacheEnabled: true });
      
      runner.register({
        ...createTestPass('clearable'),
        run: () => { callCount++; return []; },
      });

      const source = 'domain Test {}';
      
      runner.run(createMockAST(), source, 'test.isl');
      runner.clearCache();
      runner.run(createMockAST(), source, 'test.isl');
      
      expect(callCount).toBe(2);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should enable only specified passes', () => {
      const runner = createPassRunner({ enablePasses: ['a'] });
      
      runner.registerAll([
        createTestPass('a', { diagnostics: [createDiagnostic('E0001', 'A')] }),
        createTestPass('b', { diagnostics: [createDiagnostic('E0002', 'B')] }),
      ]);

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('E0001');
    });

    it('should disable specified passes', () => {
      const runner = createPassRunner({ disablePasses: ['b'] });
      
      runner.registerAll([
        createTestPass('a', { diagnostics: [createDiagnostic('E0001', 'A')] }),
        createTestPass('b', { diagnostics: [createDiagnostic('E0002', 'B')] }),
      ]);

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('E0001');
    });

    it('should respect maxDiagnostics limit', () => {
      const runner = createPassRunner({ maxDiagnostics: 2 });
      
      runner.register(createTestPass('many', {
        diagnostics: [
          createDiagnostic('E0001', 'Error 1'),
          createDiagnostic('E0002', 'Error 2'),
          createDiagnostic('E0003', 'Error 3'),
          createDiagnostic('E0004', 'Error 4'),
        ],
      }));

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.diagnostics).toHaveLength(2);
    });

    it('should filter hints when includeHints is false', () => {
      const runner = createPassRunner({ includeHints: false });
      
      runner.register(createTestPass('hints', {
        diagnostics: [
          { ...createDiagnostic('E0001', 'Error'), severity: 'error' },
          { ...createDiagnostic('W0001', 'Warning'), severity: 'warning' },
          { ...createDiagnostic('H0001', 'Hint'), severity: 'hint' },
        ],
      }));

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.diagnostics).toHaveLength(2);
      expect(result.diagnostics.find(d => d.severity === 'hint')).toBeUndefined();
    });

    it('should stop on first error with failFast', () => {
      const runner = createPassRunner({ failFast: true });
      const executionOrder: string[] = [];
      
      runner.registerAll([
        {
          ...createTestPass('ok'),
          run: () => { executionOrder.push('ok'); return []; },
        },
        {
          ...createTestPass('fail'),
          run: () => { 
            executionOrder.push('fail'); 
            throw new Error('Failed!'); 
          },
        },
        {
          ...createTestPass('after'),
          run: () => { executionOrder.push('after'); return []; },
        },
      ]);

      runner.run(createMockAST(), '', 'test.isl');
      
      expect(executionOrder).not.toContain('after');
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('statistics', () => {
    it('should compute correct statistics', () => {
      const runner = createPassRunner({ includeHints: true });
      
      runner.register(createTestPass('mixed', {
        diagnostics: [
          { ...createDiagnostic('E0001', 'Error 1'), severity: 'error' },
          { ...createDiagnostic('E0002', 'Error 2'), severity: 'error' },
          { ...createDiagnostic('W0001', 'Warning'), severity: 'warning' },
          { ...createDiagnostic('H0001', 'Hint'), severity: 'hint' },
        ],
      }));

      const result = runner.run(createMockAST(), '', 'test.isl');
      
      expect(result.stats.errorCount).toBe(2);
      expect(result.stats.warningCount).toBe(1);
      expect(result.stats.hintCount).toBe(1);
      expect(result.stats.passesRun).toBe(1);
    });

    it('should track allPassed correctly', () => {
      const runner = createPassRunner();
      
      runner.register(createTestPass('ok'));
      const okResult = runner.run(createMockAST(), '', 'test.isl');
      expect(okResult.allPassed).toBe(true);

      runner.register(createTestPass('err', {
        diagnostics: [createDiagnostic('E0001', 'Error')],
      }));
      
      const errResult = runner.run(createMockAST(), 'changed', 'test.isl');
      expect(errResult.allPassed).toBe(false);
    });
  });
});

// ============================================================================
// CLI Formatter Tests
// ============================================================================

describe('CLIFormatter', () => {
  describe('pretty format', () => {
    it('should format diagnostics with spans', () => {
      const sources = new Map([
        ['test.isl', 'domain Test {\n  entity User {\n    name: String\n  }\n}'],
      ]);
      
      const formatter = new CLIFormatter({ format: 'pretty', colors: false, sources });
      
      const diagnostic: Diagnostic = {
        code: 'E0310',
        category: 'semantic',
        severity: 'error',
        message: 'Unused field detected',
        location: { file: 'test.isl', line: 3, column: 5, endLine: 3, endColumn: 17 },
        source: 'verifier',
      };

      const output = formatter.formatDiagnostic(diagnostic);
      
      expect(output).toContain('error[E0310]');
      expect(output).toContain('Unused field detected');
      expect(output).toContain('test.isl:3:5');
      expect(output).toContain('name: String');
      expect(output).toContain('^^^^');
    });

    it('should show suggested fixes', () => {
      const formatter = new CLIFormatter({ format: 'pretty', colors: false, showFixes: true });
      
      const diagnostic: Diagnostic = {
        code: 'E0322',
        category: 'semantic',
        severity: 'warning',
        message: 'Unused parameter',
        location: { file: 'test.isl', line: 5, column: 3, endLine: 5, endColumn: 10 },
        source: 'verifier',
        fix: {
          title: 'Remove unused parameter',
          edits: [{ range: { start: { line: 5, column: 3 }, end: { line: 5, column: 10 } }, newText: '' }],
          isPreferred: true,
        },
      };

      const output = formatter.formatDiagnostic(diagnostic);
      
      expect(output).toContain('suggested fix');
      expect(output).toContain('Remove unused parameter');
      expect(output).toContain('(preferred fix)');
    });

    it('should show related information', () => {
      const formatter = new CLIFormatter({ format: 'pretty', colors: false });
      
      const diagnostic: Diagnostic = {
        code: 'E0311',
        category: 'semantic',
        severity: 'warning',
        message: 'Duplicate condition',
        location: { file: 'test.isl', line: 10, column: 5, endLine: 10, endColumn: 20 },
        source: 'verifier',
        relatedInformation: [{
          message: 'First occurrence here',
          location: { file: 'test.isl', line: 5, column: 5, endLine: 5, endColumn: 20 },
        }],
      };

      const output = formatter.formatDiagnostic(diagnostic);
      
      expect(output).toContain('First occurrence here');
      expect(output).toContain('test.isl:5:5');
    });
  });

  describe('json format', () => {
    it('should produce valid JSON output', () => {
      const formatter = new CLIFormatter({ format: 'json' });
      
      const result = {
        passResults: [{ passId: 'test', passName: 'Test', diagnostics: [], durationMs: 10, succeeded: true }],
        diagnostics: [createDiagnostic('E0001', 'Test error')],
        allPassed: false,
        stats: { totalPasses: 1, passesRun: 1, passesSkipped: 0, errorCount: 1, warningCount: 0, hintCount: 0, totalDurationMs: 10 },
        cacheInfo: { enabled: true, hits: 0, misses: 1 },
      };

      const output = formatter.format(result);
      const parsed = JSON.parse(output);
      
      expect(parsed.success).toBe(false);
      expect(parsed.diagnostics).toHaveLength(1);
      expect(parsed.diagnostics[0].code).toBe('E0001');
    });
  });

  describe('compact format', () => {
    it('should produce single-line diagnostics', () => {
      const formatter = new CLIFormatter({ format: 'compact', colors: false });
      
      const output = formatter.formatDiagnostic(createDiagnostic('E0001', 'Test error', 5));
      
      expect(output).toBe('test.isl:5:1: E[E0001] Test error');
    });
  });

  describe('github format', () => {
    it('should produce GitHub Actions workflow commands', () => {
      const formatter = new CLIFormatter({ format: 'github' });
      
      const diagnostic: Diagnostic = {
        code: 'E0001',
        category: 'semantic',
        severity: 'error',
        message: 'Test error',
        location: { file: 'src/test.isl', line: 10, column: 5, endLine: 10, endColumn: 15 },
        source: 'verifier',
      };

      const output = formatter.formatDiagnostic(diagnostic);
      
      expect(output).toMatch(/^::error file=src\/test\.isl,line=10,col=5/);
      expect(output).toContain('Test error');
    });
  });
});

// ============================================================================
// Integration Tests - Multiple Passes
// ============================================================================

describe('Multiple Passes Integration', () => {
  it('should run built-in passes and produce stable output', () => {
    const runner = createPassRunner();
    runner.registerAll(builtinPasses);

    // Create AST with potential issues
    const ast = createMockAST({
      behaviors: [{
        kind: 'BehaviorDeclaration',
        name: { kind: 'Identifier', name: 'CreateUser', span: createSpan(5, 1) },
        span: createSpan(5, 1, 20, 1),
        input: [
          { 
            kind: 'FieldDeclaration', 
            name: { kind: 'Identifier', name: 'email', span: createSpan(6, 3) },
            type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Email', span: createSpan(6, 10) }, span: createSpan(6, 10) },
            span: createSpan(6, 3, 6, 20),
          },
          { 
            kind: 'FieldDeclaration', 
            name: { kind: 'Identifier', name: 'unusedParam', span: createSpan(7, 3) },
            type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String', span: createSpan(7, 16) }, span: createSpan(7, 16) },
            span: createSpan(7, 3, 7, 25),
          },
        ],
        output: [],
        preconditions: {
          kind: 'ConditionBlock',
          conditions: [],
          span: createSpan(9, 3),
        },
        postconditions: null,
        actors: [],
        invariants: null,
        temporal: null,
        security: null,
        compliance: null,
      }],
    } as Partial<DomainDeclaration>);

    // Run twice and compare
    const result1 = runner.run(ast, 'domain Test {}', 'test.isl');
    runner.clearCache();
    const result2 = runner.run(ast, 'domain Test {}', 'test.isl');

    // Results should be stable (same diagnostics in same order)
    expect(result1.diagnostics.length).toBe(result2.diagnostics.length);
    
    for (let i = 0; i < result1.diagnostics.length; i++) {
      expect(result1.diagnostics[i].code).toBe(result2.diagnostics[i].code);
      expect(result1.diagnostics[i].message).toBe(result2.diagnostics[i].message);
      expect(result1.diagnostics[i].location).toEqual(result2.diagnostics[i].location);
    }
  });

  it('should maintain pass execution order across runs', () => {
    const executionOrders: string[][] = [];
    
    for (let run = 0; run < 3; run++) {
      const order: string[] = [];
      const runner = createPassRunner();
      
      runner.registerAll([
        { ...createTestPass('c', { dependencies: ['a', 'b'], priority: 10 }), run: () => { order.push('c'); return []; } },
        { ...createTestPass('a', { priority: 50 }), run: () => { order.push('a'); return []; } },
        { ...createTestPass('b', { dependencies: ['a'], priority: 30 }), run: () => { order.push('b'); return []; } },
      ]);

      runner.run(createMockAST(), '', 'test.isl');
      executionOrders.push(order);
    }

    // All runs should have same order
    expect(executionOrders[0]).toEqual(executionOrders[1]);
    expect(executionOrders[1]).toEqual(executionOrders[2]);
    
    // Verify correct dependency order
    expect(executionOrders[0].indexOf('a')).toBeLessThan(executionOrders[0].indexOf('b'));
    expect(executionOrders[0].indexOf('b')).toBeLessThan(executionOrders[0].indexOf('c'));
  });
});

// ============================================================================
// Type Environment Tests
// ============================================================================

describe('TypeEnvironment', () => {
  it('should build from domain declaration', () => {
    const ast = createMockAST({
      entities: [{
        kind: 'EntityDeclaration',
        name: { kind: 'Identifier', name: 'User', span: createSpan(1, 1) },
        span: createSpan(1, 1, 10, 1),
        fields: [
          {
            kind: 'FieldDeclaration',
            name: { kind: 'Identifier', name: 'email', span: createSpan(2, 3) },
            type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Email', span: createSpan(2, 10) }, span: createSpan(2, 10) },
            span: createSpan(2, 3),
          },
        ],
        invariants: null,
        lifecycle: null,
      }],
    } as Partial<DomainDeclaration>);

    const env = buildTypeEnvironment(ast);
    
    expect(env.hasType('User')).toBe(true);
    expect(env.getEntity('User')).toBeDefined();
    expect(env.entityNames()).toContain('User');
    expect(env.fieldsOf('User')).toHaveLength(1);
    expect(env.fieldsOf('User')[0].name).toBe('email');
  });

  it('should lookup symbols correctly', () => {
    const ast = createMockAST({
      types: [{
        kind: 'TypeDeclaration',
        name: { kind: 'Identifier', name: 'Email', span: createSpan(1, 1) },
        span: createSpan(1, 1),
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String', span: createSpan(1, 15) }, span: createSpan(1, 15) },
        constraints: null,
      }],
    } as Partial<DomainDeclaration>);

    const env = buildTypeEnvironment(ast);
    
    const symbol = env.lookup('Email');
    expect(symbol).toBeDefined();
    expect(symbol?.kind).toBe('type');
    expect(symbol?.type.typeName).toBe('String');
  });
});
