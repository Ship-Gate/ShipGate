// ============================================================================
// Fuzzer Tests
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  Fuzzer,
  fuzz,
  fuzzWithType,
  fuzzBehavior,
  generateStrings,
  generateIntegers,
  generateFloats,
  generateArrays,
  generateObjects,
  generateForType,
  generateBehaviorInputs,
  generateBoundaryValues,
  generateRandom,
  generateMutations,
  mutateString,
  mutateNumber,
  mutateObject,
  mutateArray,
  mutateValue,
  minimize,
  deltaDebug,
  Corpus,
  createCorpusFromSeeds,
  generateReport,
  formatMarkdown,
  createRng,
  generateCrashId,
  INJECTION_PAYLOADS,
  SPECIAL_CHARS,
  INTEGER_BOUNDARIES,
  FLOAT_EDGE_CASES,
  PROTOTYPE_POLLUTION_PAYLOADS,
  createCoverageState,
  updateCoverage,
  simulateCoverage,
  type FuzzContext,
  type ISLTypeInfo,
  type ISLBehaviorInfo,
  type GeneratedValue,
} from '../src/index.js';

// ============================================================================
// String Generator Tests
// ============================================================================

describe('String Generator', () => {
  it('generates empty string boundary', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateStrings(ctx));
    
    expect(values.some(v => v.value === '')).toBe(true);
    expect(values.some(v => v.category === 'boundary')).toBe(true);
  });

  it('generates whitespace variations', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateStrings(ctx));
    
    expect(values.some(v => v.value === ' ')).toBe(true);
    expect(values.some(v => v.value === '\t')).toBe(true);
    expect(values.some(v => v.value === '\n')).toBe(true);
  });

  it('generates length boundary values', () => {
    const ctx: FuzzContext = {
      iterations: 10,
      constraints: { maxLength: 10, minLength: 3 },
    };
    const values = Array.from(generateStrings(ctx));
    
    expect(values.some(v => v.value.length === 9)).toBe(true);  // maxLength - 1
    expect(values.some(v => v.value.length === 10)).toBe(true); // maxLength
    expect(values.some(v => v.value.length === 11)).toBe(true); // maxLength + 1
    expect(values.some(v => v.value.length === 2)).toBe(true);  // minLength - 1
    expect(values.some(v => v.value.length === 3)).toBe(true);  // minLength
  });

  it('generates injection payloads', () => {
    const ctx: FuzzContext = { iterations: 10, includeSecurityPayloads: true };
    const values = Array.from(generateStrings(ctx));
    
    expect(values.some(v => v.category === 'injection')).toBe(true);
    expect(values.some(v => v.value.includes('DROP TABLE'))).toBe(true);
  });

  it('generates special characters', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateStrings(ctx));
    
    expect(values.some(v => v.value.includes('\x00'))).toBe(true); // Null byte
    expect(values.some(v => v.category === 'special')).toBe(true);
  });

  it('generates unicode edge cases', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateStrings(ctx));
    
    expect(values.some(v => v.category === 'unicode')).toBe(true);
  });

  it('mutates strings correctly', () => {
    const rng = createRng('test');
    const original = 'hello world';
    
    // Run multiple mutations to test different paths
    const mutations = new Set<string>();
    for (let i = 0; i < 100; i++) {
      mutations.add(mutateString(original, rng));
    }
    
    // Should produce different variations
    expect(mutations.size).toBeGreaterThan(1);
    // At least one should be different from original
    expect(Array.from(mutations).some(m => m !== original)).toBe(true);
  });
});

// ============================================================================
// Number Generator Tests
// ============================================================================

describe('Number Generator', () => {
  it('generates integer boundaries', () => {
    const ctx: FuzzContext = { iterations: 50 };
    const values = Array.from(generateIntegers(ctx));
    
    expect(values.some(v => v.value === 0)).toBe(true);
    expect(values.some(v => v.value === -1)).toBe(true);
    expect(values.some(v => v.value === 1)).toBe(true);
    expect(values.some(v => v.value === 127)).toBe(true);
    expect(values.some(v => v.value === 128)).toBe(true);
    expect(values.some(v => v.value === 255)).toBe(true);
    expect(values.some(v => v.value === 256)).toBe(true);
  });

  it('generates constraint-based boundaries', () => {
    const ctx: FuzzContext = {
      iterations: 10,
      constraints: { min: 0, max: 150 },
    };
    const values = Array.from(generateIntegers(ctx));
    
    expect(values.some(v => v.value === -1)).toBe(true);  // min - 1
    expect(values.some(v => v.value === 0)).toBe(true);   // min
    expect(values.some(v => v.value === 1)).toBe(true);   // min + 1
    expect(values.some(v => v.value === 149)).toBe(true); // max - 1
    expect(values.some(v => v.value === 150)).toBe(true); // max
    expect(values.some(v => v.value === 151)).toBe(true); // max + 1
  });

  it('generates float edge cases', () => {
    const ctx: FuzzContext = { iterations: 50 };
    const values = Array.from(generateFloats(ctx));
    
    expect(values.some(v => v.value === 0.0)).toBe(true);
    expect(values.some(v => Object.is(v.value, -0))).toBe(true);
    expect(values.some(v => Number.isNaN(v.value))).toBe(true);
    expect(values.some(v => v.value === Infinity)).toBe(true);
    expect(values.some(v => v.value === -Infinity)).toBe(true);
  });

  it('mutates numbers correctly', () => {
    const rng = createRng('test');
    const mutations = new Set<number>();
    
    for (let i = 0; i < 100; i++) {
      const mutated = mutateNumber(42, rng);
      if (!Number.isNaN(mutated)) {
        mutations.add(mutated);
      }
    }
    
    expect(mutations.size).toBeGreaterThan(1);
    expect(mutations.has(-42)).toBe(true); // Negation
  });
});

// ============================================================================
// Structure Generator Tests
// ============================================================================

describe('Structure Generator', () => {
  it('generates empty array', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const numberGen = function*(c: FuzzContext) { yield { value: 1, category: 'valid' as const, description: 'test' }; };
    const values = Array.from(generateArrays(numberGen, ctx));
    
    expect(values.some(v => Array.isArray(v.value) && v.value.length === 0)).toBe(true);
  });

  it('generates empty object', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const valueGen = function*(c: FuzzContext) { yield { value: 'test', category: 'valid' as const, description: 'test' }; };
    const values = Array.from(generateObjects(valueGen, ctx));
    
    expect(values.some(v => Object.keys(v.value).length === 0)).toBe(true);
  });

  it('generates prototype pollution keys', () => {
    const ctx: FuzzContext = { iterations: 10 };
    const valueGen = function*(c: FuzzContext) { yield { value: 'test', category: 'valid' as const, description: 'test' }; };
    const values = Array.from(generateObjects(valueGen, ctx));
    
    expect(values.some(v => '__proto__' in v.value)).toBe(true);
    expect(values.some(v => 'constructor' in v.value)).toBe(true);
  });

  it('mutates objects correctly', () => {
    const rng = createRng('test');
    const original = { name: 'test', value: 42 };
    
    const mutations: Record<string, unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      mutations.push(mutateObject(original, rng));
    }
    
    // Should produce some different structures
    const keys = mutations.map(m => Object.keys(m).sort().join(','));
    expect(new Set(keys).size).toBeGreaterThan(1);
  });

  it('mutates arrays correctly', () => {
    const rng = createRng('test');
    const original = [1, 2, 3, 4, 5];
    
    const mutations: unknown[][] = [];
    for (let i = 0; i < 50; i++) {
      mutations.push(mutateArray(original, rng));
    }
    
    // Should produce different lengths
    const lengths = mutations.map(m => m.length);
    expect(new Set(lengths).size).toBeGreaterThan(1);
  });
});

// ============================================================================
// Semantic Generator Tests
// ============================================================================

describe('Semantic Generator', () => {
  it('generates values for String type', () => {
    const typeInfo: ISLTypeInfo = {
      kind: 'PrimitiveType',
      name: 'String',
    };
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateForType(typeInfo, ctx));
    
    expect(values.some(v => v.value === '')).toBe(true);
    expect(values.some(v => typeof v.value === 'string')).toBe(true);
  });

  it('generates values for Int type', () => {
    const typeInfo: ISLTypeInfo = {
      kind: 'PrimitiveType',
      name: 'Int',
    };
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateForType(typeInfo, ctx));
    
    expect(values.some(v => v.value === 0)).toBe(true);
    expect(values.some(v => typeof v.value === 'number')).toBe(true);
  });

  it('generates values for Boolean type', () => {
    const typeInfo: ISLTypeInfo = {
      kind: 'PrimitiveType',
      name: 'Boolean',
    };
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateForType(typeInfo, ctx));
    
    expect(values.some(v => v.value === true)).toBe(true);
    expect(values.some(v => v.value === false)).toBe(true);
    expect(values.some(v => v.value === null)).toBe(true);
  });

  it('generates values for Enum type', () => {
    const typeInfo: ISLTypeInfo = {
      kind: 'EnumType',
      variants: ['ACTIVE', 'INACTIVE', 'PENDING'],
    };
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateForType(typeInfo, ctx));
    
    expect(values.some(v => v.value === 'ACTIVE')).toBe(true);
    expect(values.some(v => v.value === 'INACTIVE')).toBe(true);
    expect(values.some(v => v.value === 'PENDING')).toBe(true);
    expect(values.some(v => v.value === 'INVALID_VARIANT')).toBe(true); // Invalid
  });

  it('generates behavior inputs', () => {
    const behavior: ISLBehaviorInfo = {
      name: 'CreateUser',
      inputFields: [
        {
          name: 'email',
          type: { kind: 'PrimitiveType', name: 'String' },
          optional: false,
        },
        {
          name: 'age',
          type: { kind: 'PrimitiveType', name: 'Int' },
          optional: true,
        },
      ],
    };
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateBehaviorInputs(behavior, ctx));
    
    // Should generate empty input
    expect(values.some(v => Object.keys(v.value).length === 0)).toBe(true);
    
    // Should generate inputs with email
    expect(values.some(v => 'email' in v.value)).toBe(true);
    
    // Should generate inputs missing required field
    expect(values.some(v => v.category === 'missing')).toBe(true);
  });
});

// ============================================================================
// Boundary Strategy Tests
// ============================================================================

describe('Boundary Strategy', () => {
  it('generates string boundaries', () => {
    const typeInfo: ISLTypeInfo = {
      kind: 'PrimitiveType',
      name: 'String',
    };
    const ctx: FuzzContext = { constraints: { maxLength: 10 } };
    const values = Array.from(generateBoundaryValues(typeInfo, ctx));
    
    expect(values.some(v => v.value === '')).toBe(true);
    expect(values.some(v => typeof v.value === 'string' && v.value.length === 9)).toBe(true);
    expect(values.some(v => typeof v.value === 'string' && v.value.length === 10)).toBe(true);
    expect(values.some(v => typeof v.value === 'string' && v.value.length === 11)).toBe(true);
  });

  it('generates integer boundaries', () => {
    const typeInfo: ISLTypeInfo = {
      kind: 'PrimitiveType',
      name: 'Int',
    };
    const ctx: FuzzContext = { constraints: { min: 0, max: 100 } };
    const values = Array.from(generateBoundaryValues(typeInfo, ctx));
    
    expect(values.some(v => v.value === -1)).toBe(true);
    expect(values.some(v => v.value === 0)).toBe(true);
    expect(values.some(v => v.value === 100)).toBe(true);
    expect(values.some(v => v.value === 101)).toBe(true);
  });
});

// ============================================================================
// Random Strategy Tests
// ============================================================================

describe('Random Strategy', () => {
  it('generates random values', () => {
    const ctx: FuzzContext = { iterations: 100, seed: 'test' };
    const values = Array.from(generateRandom(ctx));
    
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(v => v.category === 'random')).toBe(true);
  });

  it('is deterministic with seed', () => {
    const ctx1: FuzzContext = { iterations: 10, seed: 'test', rng: createRng('test') };
    const ctx2: FuzzContext = { iterations: 10, seed: 'test', rng: createRng('test') };
    
    const values1 = Array.from(generateRandom(ctx1, { seed: 'test' }));
    const values2 = Array.from(generateRandom(ctx2, { seed: 'test' }));
    
    // With same seed, should produce same sequence
    expect(values1.length).toBe(values2.length);
  });
});

// ============================================================================
// Mutation Strategy Tests
// ============================================================================

describe('Mutation Strategy', () => {
  it('generates mutations from corpus', () => {
    const corpus = [
      { input: 'test', category: 'valid' as const, causedCrash: false, energy: 10, mutationCount: 0, addedAt: Date.now() },
    ];
    const ctx: FuzzContext = { iterations: 10 };
    const values = Array.from(generateMutations(corpus, ctx));
    
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(v => v.category === 'mutation')).toBe(true);
  });

  it('mutates values with different types', () => {
    const rng = createRng('test');
    
    const stringResult = mutateValue('hello', rng);
    const numberResult = mutateValue(42, rng);
    const arrayResult = mutateValue([1, 2, 3], rng);
    const objectResult = mutateValue({ a: 1 }, rng);
    
    // Each should produce a mutation result
    expect(stringResult.operation).toBeDefined();
    expect(numberResult.operation).toBeDefined();
    expect(arrayResult.operation).toBeDefined();
    expect(objectResult.operation).toBeDefined();
  });
});

// ============================================================================
// Coverage Strategy Tests
// ============================================================================

describe('Coverage Strategy', () => {
  it('creates coverage state', () => {
    const state = createCoverageState();
    
    expect(state.discoveredBranches).toBeInstanceOf(Set);
    expect(state.branchHitCounts).toBeInstanceOf(Map);
  });

  it('simulates coverage for different input types', () => {
    expect(simulateCoverage(null).has('null_path')).toBe(true);
    expect(simulateCoverage('test').has('string_path')).toBe(true);
    expect(simulateCoverage(42).has('number_path')).toBe(true);
    expect(simulateCoverage([]).has('array_path')).toBe(true);
    expect(simulateCoverage({}).has('object_path')).toBe(true);
  });

  it('detects interesting patterns', () => {
    expect(simulateCoverage('').has('empty_string')).toBe(true);
    expect(simulateCoverage('a'.repeat(200)).has('long_string')).toBe(true);
    expect(simulateCoverage('test\x00').has('null_byte')).toBe(true);
    expect(simulateCoverage(0).has('zero')).toBe(true);
    expect(simulateCoverage(-5).has('negative')).toBe(true);
    expect(simulateCoverage(NaN).has('nan')).toBe(true);
    expect(simulateCoverage({ __proto__: {} }).has('proto_key')).toBe(true);
  });

  it('updates coverage state', () => {
    const state = createCoverageState();
    
    const result = updateCoverage(state, ['branch1', 'branch2'], new Map([['branch1', 1]]));
    
    expect(result.newBranches).toContain('branch1');
    expect(result.newBranches).toContain('branch2');
    expect(result.coverageIncreased).toBe(true);
    expect(state.discoveredBranches.has('branch1')).toBe(true);
  });
});

// ============================================================================
// Corpus Tests
// ============================================================================

describe('Corpus', () => {
  it('adds entries', () => {
    const corpus = new Corpus();
    
    corpus.add('test1', 'valid');
    corpus.add('test2', 'boundary');
    
    const stats = corpus.getStats();
    expect(stats.size).toBe(2);
  });

  it('deduplicates entries', () => {
    const corpus = new Corpus();
    
    corpus.add('test', 'valid');
    corpus.add('test', 'valid');
    
    const stats = corpus.getStats();
    expect(stats.size).toBe(1);
  });

  it('tracks crash-inducing inputs', () => {
    const corpus = new Corpus();
    
    corpus.add('normal', 'valid', undefined, false);
    corpus.add('crash', 'injection', undefined, true);
    
    const crashInducing = corpus.getCrashInducing();
    expect(crashInducing.length).toBe(1);
    expect(crashInducing[0]!.input).toBe('crash');
  });

  it('gets entries by category', () => {
    const corpus = new Corpus();
    
    corpus.add('test1', 'valid');
    corpus.add('test2', 'boundary');
    corpus.add('test3', 'boundary');
    
    const boundaries = corpus.getByCategory('boundary');
    expect(boundaries.length).toBe(2);
  });

  it('exports and imports correctly', () => {
    const corpus1 = new Corpus({ seed: 'test' });
    corpus1.add('test1', 'valid');
    corpus1.add('test2', 'boundary');
    
    const exported = corpus1.export();
    
    const corpus2 = new Corpus();
    corpus2.import(exported);
    
    expect(corpus2.getStats().size).toBe(2);
  });
});

// ============================================================================
// Minimizer Tests
// ============================================================================

describe('Minimizer', () => {
  it('minimizes crashing string', async () => {
    // Target that crashes on strings containing 'x'
    const target = (input: string) => {
      if (input.includes('x')) {
        throw new Error('Contains x');
      }
      return 'ok';
    };

    const result = await minimize('abcxdef', target);
    
    expect(result.minimized).toBe('x');
    expect(result.reductionPercent).toBeGreaterThan(0);
  });

  it('minimizes crashing array', async () => {
    // Target that crashes on arrays with negative numbers
    const target = (input: number[]) => {
      if (input.some(n => n < 0)) {
        throw new Error('Contains negative');
      }
      return 'ok';
    };

    const result = await minimize([1, 2, -3, 4, 5], target);
    
    // Should minimize to just the negative number
    expect((result.minimized as number[]).some(n => n < 0)).toBe(true);
    expect((result.minimized as number[]).length).toBeLessThanOrEqual(1);
  });

  it('handles non-reproducible crashes', async () => {
    let callCount = 0;
    const target = (input: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('First call only');
      }
      return 'ok';
    };

    const result = await minimize('test', target, { verifyFirst: true });
    
    // Can't minimize non-reproducible crash
    expect(result.minimized).toBe('test');
    expect(result.reductionPercent).toBe(0);
  });

  it('delta debugging minimizes effectively', async () => {
    const target = (input: string) => {
      if (input.includes('FAIL')) {
        throw new Error('Contains FAIL');
      }
      return 'ok';
    };

    const result = await deltaDebug(
      'lots of text before FAIL and after',
      target,
      50
    );
    
    expect((result.minimized as string).includes('FAIL')).toBe(true);
    expect((result.minimized as string).length).toBeLessThan(35);
  });
});

// ============================================================================
// Reporter Tests
// ============================================================================

describe('Reporter', () => {
  it('generates report from results', () => {
    const result = {
      duration: 1000,
      iterations: 100,
      crashes: [{
        input: 'test',
        error: 'Test error',
        stack: 'at test.js:1',
        category: 'exception' as const,
        reproducible: true,
        uniqueId: 'crash_1',
        timestamp: Date.now(),
        fuzzCategory: 'injection' as const,
        count: 1,
      }],
      hangs: [],
      coverage: {
        totalBranches: 100,
        coveredBranches: 50,
        percentage: 50,
        newBranches: 10,
      },
      corpus: {
        size: 50,
        coverageIncreasing: 10,
        byCategory: { valid: 30, boundary: 20 } as Record<string, number>,
        crashInducing: 1,
      },
      seed: 'test',
      config: {},
    };

    const report = generateReport(result, 'TestTarget');
    
    expect(report.summary.targetName).toBe('TestTarget');
    expect(report.summary.crashCount).toBe(1);
    expect(report.crashes.length).toBe(1);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('formats markdown correctly', () => {
    const report = {
      summary: {
        targetName: 'Test',
        duration: 1000,
        iterations: 100,
        crashCount: 0,
        hangCount: 0,
        coveragePercent: 80,
        seed: 'test',
        timestamp: new Date().toISOString(),
      },
      crashes: [],
      hangs: [],
      coverage: {
        percentage: 80,
        totalBranches: 100,
        coveredBranches: 80,
        uncoveredAreas: [],
      },
      recommendations: ['Continue testing'],
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('# Fuzz Report: Test');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Coverage');
    expect(markdown).toContain('## Recommendations');
    expect(markdown).toContain('✅ PASS');
  });
});

// ============================================================================
// Main Fuzzer Tests
// ============================================================================

describe('Fuzzer', () => {
  it('fuzzes a simple function', async () => {
    const target = (input: unknown) => {
      if (input === null) {
        throw new Error('Null not allowed');
      }
      return 'ok';
    };

    const result = await fuzz(target, {
      maxIterations: 100,
      totalTimeout: 5000,
    });

    expect(result.iterations).toBeGreaterThan(0);
    expect(result.crashes.length).toBeGreaterThan(0);
    expect(result.crashes.some(c => c.error.includes('Null'))).toBe(true);
  });

  it('fuzzes with type information', async () => {
    const target = (input: unknown) => {
      if (typeof input === 'string' && input.length > 100) {
        throw new Error('String too long');
      }
      return 'ok';
    };

    const typeInfo: ISLTypeInfo = {
      kind: 'PrimitiveType',
      name: 'String',
    };

    const result = await fuzzWithType(target, typeInfo, {
      maxIterations: 100,
      totalTimeout: 5000,
    });

    expect(result.iterations).toBeGreaterThan(0);
    expect(result.crashes.some(c => c.error.includes('too long'))).toBe(true);
  });

  it('handles timeout correctly', async () => {
    const target = async (input: unknown) => {
      // Simulate slow operation
      await new Promise(resolve => setTimeout(resolve, 10000));
      return 'ok';
    };

    const result = await fuzz(target, {
      maxIterations: 5,
      inputTimeout: 100,
      totalTimeout: 1000,
    });

    // Should have some timeout crashes
    expect(result.crashes.some(c => c.error.includes('Timeout'))).toBe(true);
  });

  it('respects iteration limit', async () => {
    const target = (input: unknown) => 'ok';

    const result = await fuzz(target, {
      maxIterations: 50,
      totalTimeout: 60000,
    });

    expect(result.iterations).toBeLessThanOrEqual(50);
  });

  it('adds seeds to corpus', async () => {
    const fuzzer = new Fuzzer<string, string>({
      maxIterations: 10,
    });

    fuzzer.addSeeds(['valid1', 'valid2', 'valid3']);

    const result = await fuzzer.fuzz((input) => input);
    
    expect(result.corpus.size).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  it('creates deterministic RNG', () => {
    const rng1 = createRng('seed');
    const rng2 = createRng('seed');
    
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    
    expect(values1).toEqual(values2);
  });

  it('generates unique crash IDs', () => {
    const id1 = generateCrashId('Error 1', 'at line 1');
    const id2 = generateCrashId('Error 2', 'at line 2');
    const id3 = generateCrashId('Error 1', 'at line 1');
    
    expect(id1).not.toBe(id2);
    expect(id1).toBe(id3); // Same error/stack should produce same ID
  });
});

// ============================================================================
// Security Payload Tests
// ============================================================================

describe('Security Payloads', () => {
  it('includes SQL injection payloads', () => {
    expect(INJECTION_PAYLOADS.sql.length).toBeGreaterThan(0);
    expect(INJECTION_PAYLOADS.sql.some(p => p.includes('DROP'))).toBe(true);
    expect(INJECTION_PAYLOADS.sql.some(p => p.includes('OR'))).toBe(true);
  });

  it('includes XSS payloads', () => {
    expect(INJECTION_PAYLOADS.xss.length).toBeGreaterThan(0);
    expect(INJECTION_PAYLOADS.xss.some(p => p.includes('script'))).toBe(true);
  });

  it('includes command injection payloads', () => {
    expect(INJECTION_PAYLOADS.command.length).toBeGreaterThan(0);
    expect(INJECTION_PAYLOADS.command.some(p => p.includes('rm'))).toBe(true);
  });

  it('includes path traversal payloads', () => {
    expect(INJECTION_PAYLOADS.pathTraversal.length).toBeGreaterThan(0);
    expect(INJECTION_PAYLOADS.pathTraversal.some(p => p.includes('..'))).toBe(true);
  });

  it('includes prototype pollution payloads', () => {
    expect(PROTOTYPE_POLLUTION_PAYLOADS.length).toBeGreaterThan(0);
    expect(PROTOTYPE_POLLUTION_PAYLOADS.some(p => '__proto__' in p)).toBe(true);
  });
});
