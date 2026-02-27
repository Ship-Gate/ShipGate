// ============================================================================
// WebAssembly Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import { compileToWat, validateWat } from '../src/wat-emitter';
import { generateBindings } from '../src/bindings';
import { optimizeModule, formatOptimizationStats } from '../src/optimizer';
import type * as AST from '../../../master_contracts/ast';
import type { WasmModule, WasmFunction } from '../src/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSourceLocation = (): AST.SourceLocation => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'TestDomain', location: createSourceLocation() },
  version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      location: createSourceLocation(),
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: { kind: 'Identifier', name: 'CreateUser', location: createSourceLocation() },
      description: { kind: 'StringLiteral', value: 'Create a new user', location: createSourceLocation() },
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'name', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec',
        success: {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: 'User', location: createSourceLocation() }],
            location: createSourceLocation(),
          },
          location: createSourceLocation(),
        },
        errors: [
          {
            kind: 'ErrorSpec',
            name: { kind: 'Identifier', name: 'INVALID_AGE', location: createSourceLocation() },
            retriable: false,
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      preconditions: [
        {
          kind: 'BinaryExpr',
          operator: '>=',
          left: {
            kind: 'MemberExpr',
            object: { kind: 'Identifier', name: 'input', location: createSourceLocation() },
            property: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
            location: createSourceLocation(),
          },
          right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createSourceLocation() },
          location: createSourceLocation(),
        } as AST.BinaryExpr,
      ],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: createSourceLocation(),
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: createSourceLocation(),
});

// ============================================================================
// GENERATOR TESTS
// ============================================================================

describe('generate', () => {
  it('should generate WASM module from domain', () => {
    const domain = createMinimalDomain();
    const result = generate(domain);

    expect(result.success).toBe(true);
    expect(result.modules).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should include behavior functions in output', () => {
    const domain = createMinimalDomain();
    const result = generate(domain);

    const wat = result.modules[0].wat;
    expect(wat).toContain('CreateUser');
    expect(wat).toContain('func');
  });

  it('should include entity functions', () => {
    const domain = createMinimalDomain();
    const result = generate(domain);

    const wat = result.modules[0].wat;
    expect(wat).toContain('User_new');
    expect(wat).toContain('User_get_id');
    expect(wat).toContain('User_set_id');
  });

  it('should include runtime functions', () => {
    const domain = createMinimalDomain();
    const result = generate(domain, { includeRuntime: true });

    const wat = result.modules[0].wat;
    expect(wat).toContain('__alloc');
    expect(wat).toContain('__strlen');
  });

  it('should include memory export', () => {
    const domain = createMinimalDomain();
    const result = generate(domain);

    const wat = result.modules[0].wat;
    expect(wat).toContain('(export "memory"');
  });

  it('should respect target option', () => {
    const domain = createMinimalDomain();
    const result = generate(domain, { target: 'edge' });

    expect(result.modules[0].runtime.hostFunctions).toContain('http.fetch');
  });
});

// ============================================================================
// WAT EMITTER TESTS
// ============================================================================

describe('compileToWat', () => {
  it('should generate valid WAT syntax', () => {
    const module: WasmModule = {
      name: 'test',
      types: [{ params: ['i32'], results: ['i32'] }],
      imports: [],
      functions: [
        {
          name: 'add',
          export: 'add',
          type: { params: ['i32', 'i32'], results: ['i32'] },
          locals: [],
          body: [
            { op: 'local.get', index: 0 },
            { op: 'local.get', index: 1 },
            { op: 'i32.add' },
          ],
        },
      ],
      tables: [],
      memories: [{ name: 'memory', initial: 1 }],
      globals: [],
      exports: [],
      data: [],
    };

    const wat = compileToWat(module);

    expect(wat).toContain('(module $test');
    expect(wat).toContain('(func $add');
    expect(wat).toContain('local.get');
    expect(wat).toContain('i32.add');
  });

  it('should include comments', () => {
    const module: WasmModule = {
      name: 'test',
      types: [],
      imports: [],
      functions: [
        {
          name: 'test',
          type: { params: [], results: [] },
          locals: [],
          body: [{ op: 'nop' }],
          comments: ['This is a test function'],
        },
      ],
      tables: [],
      memories: [],
      globals: [],
      exports: [],
      data: [],
    };

    const wat = compileToWat(module);
    expect(wat).toContain(';; This is a test function');
  });

  it('should handle memory with limits', () => {
    const module: WasmModule = {
      name: 'test',
      types: [],
      imports: [],
      functions: [],
      tables: [],
      memories: [{ name: 'mem', initial: 1, maximum: 10, shared: true }],
      globals: [],
      exports: [],
      data: [],
    };

    const wat = compileToWat(module);
    expect(wat).toContain('(memory $mem 1 10 shared)');
  });

  it('should handle globals', () => {
    const module: WasmModule = {
      name: 'test',
      types: [],
      imports: [],
      functions: [],
      tables: [],
      memories: [],
      globals: [
        { name: 'counter', type: 'i32', mutable: true, init: 0 },
        { name: 'constant', type: 'i64', mutable: false, init: BigInt(42) },
      ],
      exports: [],
      data: [],
    };

    const wat = compileToWat(module);
    expect(wat).toContain('(global $counter (mut i32)');
    expect(wat).toContain('(global $constant i64');
  });
});

describe('validateWat', () => {
  it('should validate balanced parentheses', () => {
    const valid = '(module (func (nop)))';
    const invalid = '(module (func (nop))';

    expect(validateWat(valid).valid).toBe(true);
    expect(validateWat(invalid).valid).toBe(false);
  });

  it('should handle strings with parentheses', () => {
    const wat = '(module (data (i32.const 0) "(test)"))';
    expect(validateWat(wat).valid).toBe(true);
  });
});

// ============================================================================
// BINDINGS TESTS
// ============================================================================

describe('generateBindings', () => {
  it('should generate TypeScript bindings', () => {
    const domain = createMinimalDomain();
    const bindings = generateBindings(domain, { language: 'typescript', style: 'class' });

    expect(bindings.code).toContain('export class TestDomainRuntime');
    expect(bindings.code).toContain('async initialize');
    expect(bindings.code).toContain('createUser');
  });

  it('should generate entity interfaces', () => {
    const domain = createMinimalDomain();
    const bindings = generateBindings(domain, { language: 'typescript', style: 'class' });

    expect(bindings.code).toContain('export interface User');
    expect(bindings.code).toContain('id');
    expect(bindings.code).toContain('age: number');
  });

  it('should generate behavior types', () => {
    const domain = createMinimalDomain();
    const bindings = generateBindings(domain, { language: 'typescript', style: 'class' });

    expect(bindings.code).toContain('export interface CreateUserInput');
    expect(bindings.code).toContain('export type CreateUserResult');
  });

  it('should generate JavaScript bindings', () => {
    const domain = createMinimalDomain();
    const bindings = generateBindings(domain, { language: 'javascript', style: 'class' });

    expect(bindings.code).toContain('export class TestDomainRuntime');
    expect(bindings.code).toContain('#instance');
  });

  it('should include helper functions when requested', () => {
    const domain = createMinimalDomain();
    const bindings = generateBindings(domain, {
      language: 'typescript',
      style: 'class',
      includeHelpers: true,
    });

    expect(bindings.code).toContain('loadWasm');
    expect(bindings.code).toContain('encodeString');
    expect(bindings.code).toContain('decodeString');
  });
});

// ============================================================================
// OPTIMIZER TESTS
// ============================================================================

describe('optimizeModule', () => {
  const createTestModule = (): WasmModule => ({
    name: 'test',
    types: [],
    imports: [],
    functions: [
      {
        name: 'main',
        export: 'main',
        type: { params: [], results: ['i32'] },
        locals: [],
        body: [
          { op: 'i32.const', value: 1 },
          { op: 'i32.const', value: 2 },
          { op: 'i32.add' },
        ],
      },
      {
        name: 'unused',
        type: { params: [], results: [] },
        locals: [],
        body: [{ op: 'nop' }],
      },
    ],
    tables: [],
    memories: [],
    globals: [],
    exports: [{ name: 'main', kind: 'func', index: 0 }],
    data: [],
  });

  it('should fold constants', () => {
    const module = createTestModule();
    const result = optimizeModule(module, { level: 'balanced', constantFolding: true });

    expect(result.stats.foldedConstants).toBeGreaterThan(0);
  });

  it('should eliminate dead code', () => {
    const module = createTestModule();
    const result = optimizeModule(module, { level: 'balanced', deadCodeElimination: true });

    expect(result.stats.removedFunctions).toBe(1);
    expect(result.module.functions.some(f => f.name === 'unused')).toBe(false);
  });

  it('should report optimization stats', () => {
    const module = createTestModule();
    const result = optimizeModule(module, { level: 'balanced' });

    expect(result.stats.originalInstructions).toBeGreaterThan(0);
    expect(result.stats.optimizedInstructions).toBeLessThanOrEqual(result.stats.originalInstructions);
  });

  it('should format stats as string', () => {
    const module = createTestModule();
    const result = optimizeModule(module, { level: 'balanced' });
    const formatted = formatOptimizationStats(result.stats);

    expect(formatted).toContain('Optimization Results');
    expect(formatted).toContain('Instructions');
  });

  it('should skip optimization when level is none', () => {
    const module = createTestModule();
    const result = optimizeModule(module, { level: 'none' });

    expect(result.stats.originalInstructions).toBe(result.stats.optimizedInstructions);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('integration', () => {
  it('should generate complete module from domain', () => {
    const domain = createMinimalDomain();
    const result = generate(domain, { optimize: true });

    expect(result.success).toBe(true);
    
    const { wat, bindings, runtime } = result.modules[0];
    
    // WAT should be valid
    const validation = validateWat(wat);
    expect(validation.valid).toBe(true);
    
    // Bindings should have exports
    expect(bindings.exports.length).toBeGreaterThan(0);
    
    // Runtime requirements should be specified
    expect(runtime.memoryPages).toBeGreaterThan(0);
  });

  it('should generate edge-compatible module', () => {
    const domain = createMinimalDomain();
    const result = generate(domain, { target: 'edge' });

    expect(result.success).toBe(true);
    expect(result.modules[0].runtime.hostFunctions).toContain('http.fetch');
  });
});
