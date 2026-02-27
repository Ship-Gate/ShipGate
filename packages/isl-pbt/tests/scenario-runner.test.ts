// ============================================================================
// Scenario Runner Tests - Full PBT pipeline with ISL type-aware shrinking
// ============================================================================
//
// These tests exercise the complete PBT loop:
//   1. ISL-type-aware generators for primitives, constraints, enums,
//      nested entities, and collections.
//   2. ISL-type-aware shrink strategies per type.
//   3. Scenario runner that executes behaviors with generated inputs.
//   4. Human-friendly failure output showing the ISL element responsible.
// ============================================================================

import { describe, it, expect } from 'vitest';
import type * as AST from '@isl-lang/parser';
import {
  createPRNG,
  typeShrink,
  withTypeShrink,
  shrinkEntityInstance,
  integer,
  float,
  string,
  email,
  fromEnum,
  array,
  record,
  optional,
  moneyAmount,
  boolean,
  runScenario,
  formatFailure,
  formatFailureJSON,
  createInputGenerator,
  extractProperties,
} from '../src/index.js';
import type { BehaviorImplementation, ExecutionResult } from '../src/runner.js';

// ============================================================================
// HELPERS
// ============================================================================

function loc(line = 1, col = 1, file = 'test.isl'): AST.SourceLocation {
  return { file, line, column: col, endLine: line, endColumn: col + 10 };
}

function id(name: string): AST.Identifier {
  return { kind: 'Identifier', name, location: loc() } as any;
}

function qname(...parts: string[]): AST.QualifiedName {
  return {
    kind: 'QualifiedName',
    parts: parts.map((p) => id(p)),
    location: loc(),
  } as any;
}

function ref(name: string): AST.ReferenceType {
  return { kind: 'ReferenceType', name: qname(name), location: loc() } as any;
}

function prim(name: string): AST.PrimitiveType {
  return { kind: 'PrimitiveType', name, location: loc() } as any;
}

function numLit(value: number): AST.NumberLiteral {
  return { kind: 'NumberLiteral', value, location: loc() } as any;
}

function strLit(value: string): AST.StringLiteral {
  return { kind: 'StringLiteral', value, location: loc() } as any;
}

function boolLit(value: boolean): AST.BooleanLiteral {
  return { kind: 'BooleanLiteral', value, location: loc() } as any;
}

function field(name: string, type: AST.TypeDefinition, opts?: { optional?: boolean; annotations?: any[] }): AST.Field {
  return {
    kind: 'Field',
    name: id(name),
    type,
    optional: opts?.optional ?? false,
    annotations: opts?.annotations ?? [],
    location: loc(),
  } as any;
}

function constrained(base: AST.TypeDefinition, constraints: Array<{ name: string; value: AST.Expression }>): AST.ConstrainedType {
  return {
    kind: 'ConstrainedType',
    base,
    constraints: constraints.map((c) => ({
      kind: 'Constraint' as const,
      name: c.name,
      value: c.value,
      location: loc(),
    })),
    location: loc(),
  } as any;
}

function enumType(variants: string[]): AST.EnumType {
  return {
    kind: 'EnumType',
    variants: variants.map((v) => ({
      kind: 'EnumVariant' as const,
      name: id(v),
      location: loc(),
    })),
    location: loc(),
  } as any;
}

function structType(fields: AST.Field[]): AST.StructType {
  return { kind: 'StructType', fields, location: loc() } as any;
}

function listType(element: AST.TypeDefinition): AST.ListType {
  return { kind: 'ListType', element, location: loc() } as any;
}

function mapType(key: AST.TypeDefinition, value: AST.TypeDefinition): AST.MapType {
  return { kind: 'MapType', key, value, location: loc() } as any;
}

function optionalType(inner: AST.TypeDefinition): AST.OptionalType {
  return { kind: 'OptionalType', inner, location: loc() } as any;
}

// ============================================================================
// 1. TYPE-AWARE SHRINK STRATEGIES
// ============================================================================

describe('ISL Type-Aware Shrinking', () => {
  const emptyDomain: AST.Domain = {
    kind: 'Domain',
    name: id('Test'),
    version: strLit('1.0'),
    uses: [],
    imports: [],
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  } as any;

  describe('Primitives', () => {
    it('shrinks Int towards 0', () => {
      const shrinks = [...typeShrink(42, prim('Int'), emptyDomain)];
      expect(shrinks).toContain(0);
      expect(shrinks.every((v) => typeof v === 'number')).toBe(true);
      expect(shrinks.every((v) => Number.isInteger(v))).toBe(true);
    });

    it('shrinks negative Int towards 0', () => {
      const shrinks = [...typeShrink(-50, prim('Int'), emptyDomain)];
      expect(shrinks).toContain(0);
      expect(shrinks).toContain(50); // absolute value
    });

    it('shrinks Decimal towards 0', () => {
      const shrinks = [...typeShrink(3.14, prim('Decimal'), emptyDomain)];
      expect(shrinks).toContain(0);
      expect(shrinks.some((v) => v === 3)).toBe(true); // truncated
    });

    it('shrinks String towards empty', () => {
      const shrinks = [...typeShrink('hello world', prim('String'), emptyDomain)];
      expect(shrinks).toContain('');
      expect(shrinks.some((s) => typeof s === 'string' && s.length < 11)).toBe(true);
    });

    it('shrinks Boolean true → false', () => {
      const shrinks = [...typeShrink(true, prim('Boolean'), emptyDomain)];
      expect(shrinks).toContain(false);
    });

    it('Boolean false yields nothing', () => {
      const shrinks = [...typeShrink(false, prim('Boolean'), emptyDomain)];
      expect(shrinks).toHaveLength(0);
    });
  });

  describe('Constrained Types', () => {
    it('shrinks Int {min: 10, max: 100} respecting constraints', () => {
      const typ = constrained(prim('Int'), [
        { name: 'min', value: numLit(10) },
        { name: 'max', value: numLit(100) },
      ]);
      const shrinks = [...typeShrink(75, typ, emptyDomain)];
      for (const s of shrinks) {
        expect(s).toBeGreaterThanOrEqual(10);
        expect(s).toBeLessThanOrEqual(100);
      }
      expect(shrinks).toContain(10); // lower bound
    });

    it('shrinks Decimal {min: 0, precision: 2} preserving precision', () => {
      const typ = constrained(prim('Decimal'), [
        { name: 'min', value: numLit(0) },
        { name: 'precision', value: numLit(2) },
      ]);
      const shrinks = [...typeShrink(99.99, typ, emptyDomain)];
      for (const s of shrinks) {
        expect(s as number).toBeGreaterThanOrEqual(0);
        const decimals = String(s).split('.')[1];
        if (decimals) {
          expect(decimals.length).toBeLessThanOrEqual(2);
        }
      }
    });

    it('shrinks String {min_length: 3, max_length: 20} respecting bounds', () => {
      const typ = constrained(prim('String'), [
        { name: 'min_length', value: numLit(3) },
        { name: 'max_length', value: numLit(20) },
      ]);
      const shrinks = [...typeShrink('a long string value here', typ, emptyDomain)];
      for (const s of shrinks) {
        expect((s as string).length).toBeGreaterThanOrEqual(3);
        expect((s as string).length).toBeLessThanOrEqual(20);
      }
    });

    it('returns nothing for value already at minimum', () => {
      const typ = constrained(prim('Int'), [
        { name: 'min', value: numLit(5) },
      ]);
      const shrinks = [...typeShrink(5, typ, emptyDomain)];
      expect(shrinks.every((v) => (v as number) >= 5)).toBe(true);
    });
  });

  describe('Enums', () => {
    it('shrinks towards first variant', () => {
      const typ = enumType(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
      const shrinks = [...typeShrink('SUSPENDED', typ, emptyDomain)];
      expect(shrinks).toContain('ACTIVE');
    });

    it('yields nothing if already first variant', () => {
      const typ = enumType(['ACTIVE', 'INACTIVE']);
      const shrinks = [...typeShrink('ACTIVE', typ, emptyDomain)];
      expect(shrinks).toHaveLength(0);
    });
  });

  describe('Nested Entities (StructType)', () => {
    it('shrinks struct fields independently', () => {
      const typ = structType([
        field('name', prim('String')),
        field('age', prim('Int')),
      ]);
      const value = { name: 'Alice Wonderland', age: 42 };
      const shrinks = [...typeShrink(value, typ, emptyDomain)] as Record<string, unknown>[];

      // Should attempt to shrink name
      expect(shrinks.some((s) => (s.name as string).length < 16)).toBe(true);
      // Should attempt to shrink age
      expect(shrinks.some((s) => s.age === 0)).toBe(true);
    });

    it('tries removing optional fields', () => {
      const typ = structType([
        field('name', prim('String')),
        field('nickname', prim('String'), { optional: true }),
      ]);
      const value = { name: 'Alice', nickname: 'Ali' };
      const shrinks = [...typeShrink(value, typ, emptyDomain)] as Record<string, unknown>[];

      expect(shrinks.some((s) => s.nickname === undefined)).toBe(true);
    });

    it('recursively shrinks nested structs', () => {
      const addressType = structType([
        field('street', prim('String')),
        field('zip', prim('Int')),
      ]);
      const typ = structType([
        field('name', prim('String')),
        field('address', addressType),
      ]);
      const value = {
        name: 'Bob',
        address: { street: '123 Main St', zip: 90210 },
      };
      const shrinks = [...typeShrink(value, typ, emptyDomain)] as Record<string, unknown>[];

      // Should shrink nested address fields
      expect(shrinks.some((s) => {
        const addr = s.address as Record<string, unknown>;
        return addr && (addr.zip === 0 || (addr.street as string).length < 11);
      })).toBe(true);
    });
  });

  describe('Collections', () => {
    it('shrinks List by removing elements', () => {
      const typ = listType(prim('Int'));
      const value = [10, 20, 30, 40, 50];
      const shrinks = [...typeShrink(value, typ, emptyDomain)] as unknown[][];

      expect(shrinks.some((s) => s.length === 0)).toBe(true); // empty
      expect(shrinks.some((s) => s.length === 1)).toBe(true); // single
      expect(shrinks.some((s) => s.length < 5)).toBe(true);
    });

    it('shrinks List elements using ISL type', () => {
      const typ = listType(prim('Int'));
      const value = [100];
      const shrinks = [...typeShrink(value, typ, emptyDomain)] as unknown[][];

      // Should try shrinking the element
      expect(shrinks.some((s) => s.length === 1 && (s[0] as number) < 100)).toBe(true);
    });

    it('shrinks Map by removing keys and shrinking values', () => {
      const typ = mapType(prim('String'), prim('Int'));
      const value = { a: 10, b: 20, c: 30 };
      const shrinks = [...typeShrink(value, typ, emptyDomain)] as Record<string, unknown>[];

      expect(shrinks.some((s) => Object.keys(s).length === 0)).toBe(true);
      expect(shrinks.some((s) => Object.keys(s).length < 3)).toBe(true);
    });
  });

  describe('Optional', () => {
    it('shrinks to undefined first', () => {
      const typ = optionalType(prim('Int'));
      const shrinks = [...typeShrink(42, typ, emptyDomain)];
      expect(shrinks[0]).toBeUndefined();
    });

    it('then shrinks inner value', () => {
      const typ = optionalType(prim('Int'));
      const shrinks = [...typeShrink(42, typ, emptyDomain)];
      expect(shrinks).toContain(undefined);
      expect(shrinks).toContain(0);
    });
  });

  describe('withTypeShrink wraps a generator', () => {
    it('generate delegates to base, shrink uses ISL type', () => {
      const baseGen = integer(0, 1000);
      const typ = constrained(prim('Int'), [
        { name: 'min', value: numLit(10) },
        { name: 'max', value: numLit(500) },
      ]);
      const wrapped = withTypeShrink(baseGen, typ, emptyDomain);

      const prng = createPRNG(42);
      const val = wrapped.generate(prng, 100);
      expect(typeof val).toBe('number');

      const shrinks = [...wrapped.shrink(250)];
      for (const s of shrinks) {
        expect(s).toBeGreaterThanOrEqual(10);
        expect(s).toBeLessThanOrEqual(500);
      }
    });
  });

  describe('Entity instance shrinking', () => {
    it('shrinks entity fields by ISL type', () => {
      const userEntity: AST.Entity = {
        kind: 'Entity',
        name: id('User'),
        fields: [
          field('name', prim('String')),
          field('age', prim('Int')),
          field('bio', prim('String'), { optional: true }),
        ],
        invariants: [],
        location: loc(),
      } as any;

      const value = { name: 'Alice Wonderland', age: 30, bio: 'A curious person' };
      const shrinks = [...shrinkEntityInstance(value, userEntity, emptyDomain)] as Record<string, unknown>[];

      // Should try removing optional bio
      expect(shrinks.some((s) => s.bio === undefined)).toBe(true);
      // Should try shrinking name
      expect(shrinks.some((s) => (s.name as string).length < 16)).toBe(true);
      // Should try shrinking age
      expect(shrinks.some((s) => s.age === 0)).toBe(true);
    });
  });
});

// ============================================================================
// 2. SCENARIO RUNNER
// ============================================================================

describe('Scenario Runner', () => {
  // Build a realistic mock domain for a "TransferMoney" behavior
  const transferDomain: AST.Domain = {
    kind: 'Domain',
    name: id('Banking'),
    version: strLit('1.0'),
    uses: [],
    imports: [],
    types: [
      {
        kind: 'TypeDeclaration',
        name: id('Money'),
        definition: constrained(prim('Decimal'), [
          { name: 'min', value: numLit(0) },
          { name: 'precision', value: numLit(2) },
        ]),
        annotations: [],
        location: loc(),
      },
      {
        kind: 'TypeDeclaration',
        name: id('AccountStatus'),
        definition: enumType(['ACTIVE', 'FROZEN', 'CLOSED']),
        annotations: [],
        location: loc(),
      },
    ] as any[],
    entities: [
      {
        kind: 'Entity',
        name: id('Account'),
        fields: [
          field('id', prim('UUID')),
          field('balance', ref('Money')),
          field('status', ref('AccountStatus')),
        ],
        invariants: [],
        location: loc(),
      },
    ] as any[],
    behaviors: [
      {
        kind: 'Behavior',
        name: id('TransferMoney'),
        input: {
          kind: 'InputSpec',
          fields: [
            field('amount', constrained(prim('Decimal'), [
              { name: 'min', value: numLit(0.01) },
              { name: 'max', value: numLit(10000) },
            ])),
            field('from_account', prim('String')),
            field('to_account', prim('String')),
          ],
          location: loc(),
        },
        output: {
          kind: 'OutputSpec',
          success: prim('Boolean'),
          errors: [],
          location: loc(),
        },
        preconditions: [],
        postconditions: [
          {
            kind: 'PostconditionBlock',
            condition: { kind: 'Identifier', name: 'success', location: loc() },
            predicates: [
              {
                kind: 'BinaryExpr',
                operator: '>',
                left: {
                  kind: 'MemberExpr',
                  object: { kind: 'Identifier', name: 'result', location: loc() },
                  property: id('balance'),
                  location: loc(),
                },
                right: numLit(0),
                location: loc(10, 5, 'banking.isl'),
              },
            ],
            location: loc(10, 3, 'banking.isl'),
          },
        ],
        invariants: [],
        temporal: [],
        security: [],
        compliance: [],
        location: loc(5, 1, 'banking.isl'),
      },
    ] as any[],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  } as any;

  function createTransferImpl(opts: {
    failOnAmountAbove?: number;
  } = {}): BehaviorImplementation {
    return {
      async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
        const amount = input.amount as number;
        if (opts.failOnAmountAbove && amount > opts.failOnAmountAbove) {
          return {
            success: true,
            result: { balance: -1 }, // Negative balance → postcondition violation
          };
        }
        return {
          success: true,
          result: { balance: 1000 - amount },
        };
      },
    };
  }

  it('passes when all postconditions hold', async () => {
    const impl = createTransferImpl();
    const result = await runScenario(transferDomain, 'TransferMoney', impl, {
      numTests: 50,
      seed: 42,
    });

    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
  });

  it('detects postcondition violation and attributes it', async () => {
    // Fail when amount > 500 (balance goes negative)
    const impl = createTransferImpl({ failOnAmountAbove: 500 });
    const result = await runScenario(transferDomain, 'TransferMoney', impl, {
      numTests: 200,
      seed: 42,
      maxSize: 10000,
    });

    expect(result.success).toBe(false);
    expect(result.firstFailure).toBeDefined();
    expect(result.firstFailure!.attribution).toBeDefined();
    expect(result.firstFailure!.attribution!.elementKind).toBe('postcondition');
    expect(result.firstFailure!.attribution!.expression).toContain('>');
  });

  it('shrinks to minimal counterexample', async () => {
    const impl = createTransferImpl({ failOnAmountAbove: 500 });
    const result = await runScenario(transferDomain, 'TransferMoney', impl, {
      numTests: 200,
      seed: 42,
      maxSize: 10000,
      maxShrinks: 50,
    });

    if (!result.success && result.counterexample) {
      const cx = result.counterexample;
      // The minimal amount should still be > 500 (still triggers the bug)
      // but should be smaller than the original
      expect(cx.shrinkSteps).toBeGreaterThan(0);
      expect(cx.attribution.elementKind).toBe('postcondition');

      // Ensure minimal input is defined
      expect(cx.input).toBeDefined();
      expect(cx.input.amount).toBeDefined();
    }
  });

  it('formatted report includes ISL element info (not just seed)', async () => {
    const impl = createTransferImpl({ failOnAmountAbove: 500 });
    const result = await runScenario(transferDomain, 'TransferMoney', impl, {
      numTests: 200,
      seed: 42,
      maxSize: 10000,
    });

    if (!result.success) {
      expect(result.formattedReport).toContain('postcondition');
      expect(result.formattedReport).toContain('banking.isl');
      expect(result.formattedReport).toContain('Responsible ISL Element');
      expect(result.formattedReport).not.toContain('random seed: 123');
    }
  });

  it('throws for unknown behavior', async () => {
    const impl = createTransferImpl();
    await expect(
      runScenario(transferDomain, 'NonExistent', impl),
    ).rejects.toThrow("Behavior 'NonExistent' not found");
  });
});

// ============================================================================
// 3. FAILURE FORMATTER
// ============================================================================

describe('Failure Formatter', () => {
  const mockAttribution = {
    elementKind: 'postcondition' as const,
    expression: 'result.balance > 0',
    location: loc(15, 5, 'banking.isl'),
    guard: 'success',
  };

  const mockFailure = {
    iteration: 42,
    size: 50,
    seed: 12345,
    input: { amount: 999.99, from_account: 'acc-123', to_account: 'acc-456' },
    passed: false,
    error: 'Expected result.balance > 0 but got -1',
    attribution: mockAttribution,
    duration: 12,
    logs: [],
  };

  const mockCounterexample = {
    input: { amount: 500.01, from_account: 'a', to_account: 'b' },
    attribution: mockAttribution,
    shrinkSteps: 15,
    originalInput: { amount: 999.99, from_account: 'acc-123', to_account: 'acc-456' },
  };

  it('produces a report with ISL element attribution', () => {
    const report = formatFailure(
      mockFailure as any,
      mockCounterexample,
      12345,
      'TransferMoney',
      'Banking',
    );

    expect(report.summary).toContain('postcondition');
    expect(report.summary).toContain('result.balance > 0');
    expect(report.summary).toContain('banking.isl');
    expect(report.attribution.elementKind).toBe('postcondition');
    expect(report.attribution.location.file).toBe('banking.isl');
  });

  it('includes shrunk fields diff', () => {
    const report = formatFailure(
      mockFailure as any,
      mockCounterexample,
      12345,
      'TransferMoney',
      'Banking',
    );

    expect(report.shrunkFields.length).toBeGreaterThan(0);
    expect(report.shrunkFields.some((f) => f.name === 'amount')).toBe(true);
    const amountField = report.shrunkFields.find((f) => f.name === 'amount')!;
    expect(amountField.original).toBe(999.99);
    expect(amountField.shrunk).toBe(500.01);
  });

  it('text output shows ISL location, not just seed', () => {
    const report = formatFailure(
      mockFailure as any,
      mockCounterexample,
      12345,
      'TransferMoney',
      'Banking',
    );

    expect(report.text).toContain('VIOLATED ISL ELEMENT');
    expect(report.text).toContain('POSTCONDITION');
    expect(report.text).toContain('banking.isl');
    expect(report.text).toContain('15:5');
    expect(report.text).toContain('MINIMAL COUNTEREXAMPLE');
    expect(report.text).toContain('SHRINK DIFF');
    expect(report.text).toContain('REPRODUCE');
    expect(report.text).toContain('--seed 12345');
  });

  it('JSON format is CI-friendly', () => {
    const report = formatFailure(
      mockFailure as any,
      mockCounterexample,
      12345,
      'TransferMoney',
      'Banking',
    );
    const json = formatFailureJSON(report);

    expect(json.summary).toContain('postcondition');
    expect((json.attribution as any).kind).toBe('postcondition');
    expect((json.attribution as any).location).toContain('banking.isl');
    expect(json.shrinkSteps).toBe(15);
    expect(json.seed).toBe(12345);
  });

  it('handles failure without counterexample', () => {
    const report = formatFailure(
      mockFailure as any,
      undefined,
      12345,
      'TransferMoney',
      'Banking',
    );

    expect(report.minimalInput).toEqual(mockFailure.input);
    expect(report.shrinkSteps).toBe(0);
    expect(report.text).toContain('VIOLATED ISL ELEMENT');
  });
});

// ============================================================================
// 4. ISL-BASED INPUT GENERATION (Integration)
// ============================================================================

describe('ISL-Based Input Generation', () => {
  const paymentDomain: AST.Domain = {
    kind: 'Domain',
    name: id('Payments'),
    version: strLit('1.0'),
    uses: [],
    imports: [],
    types: [
      {
        kind: 'TypeDeclaration',
        name: id('Currency'),
        definition: enumType(['USD', 'EUR', 'GBP']),
        annotations: [],
        location: loc(),
      },
      {
        kind: 'TypeDeclaration',
        name: id('Address'),
        definition: structType([
          field('street', prim('String')),
          field('city', prim('String')),
          field('zip', constrained(prim('String'), [
            { name: 'min_length', value: numLit(5) },
            { name: 'max_length', value: numLit(10) },
          ])),
        ]),
        annotations: [],
        location: loc(),
      },
    ] as any[],
    entities: [],
    behaviors: [
      {
        kind: 'Behavior',
        name: id('ProcessPayment'),
        input: {
          kind: 'InputSpec',
          fields: [
            field('amount', constrained(prim('Decimal'), [
              { name: 'min', value: numLit(0.01) },
              { name: 'max', value: numLit(50000) },
            ])),
            field('currency', ref('Currency')),
            field('items', listType(prim('String'))),
            field('billing_address', ref('Address')),
            field('memo', prim('String'), { optional: true }),
          ],
          location: loc(),
        },
        output: {
          kind: 'OutputSpec',
          success: prim('Boolean'),
          errors: [],
          location: loc(),
        },
        preconditions: [],
        postconditions: [],
        invariants: [],
        temporal: [],
        security: [],
        compliance: [],
        location: loc(),
      },
    ] as any[],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  } as any;

  it('generates valid inputs for complex behavior with nested types', () => {
    const behavior = paymentDomain.behaviors[0]!;
    const properties = extractProperties(behavior, paymentDomain);
    const gen = createInputGenerator(properties);
    const prng = createPRNG(42);

    for (let i = 0; i < 30; i++) {
      const input = gen.generate(prng.fork(), Math.min(i * 3, 100));
      expect(input.amount).toBeDefined();
      expect(input.currency).toBeDefined();
      expect(['USD', 'EUR', 'GBP']).toContain(input.currency);
      expect(Array.isArray(input.items)).toBe(true);
    }
  });

  it('generates deterministic outputs with same seed', () => {
    const behavior = paymentDomain.behaviors[0]!;
    const properties = extractProperties(behavior, paymentDomain);
    const gen = createInputGenerator(properties);

    const run1 = Array.from({ length: 20 }, (_, i) => {
      const prng = createPRNG(999);
      return gen.generate(prng, 50);
    });

    const run2 = Array.from({ length: 20 }, (_, i) => {
      const prng = createPRNG(999);
      return gen.generate(prng, 50);
    });

    expect(run1).toEqual(run2);
  });
});
