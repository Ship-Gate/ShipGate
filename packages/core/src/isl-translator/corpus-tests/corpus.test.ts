/**
 * Corpus Test Suite
 * 
 * Validates AST/ISL invariants WITHOUT calling a model.
 * Tests:
 * - Printer determinism: same AST always produces identical output
 * - Round-trip parse equality after normalization
 * - Stable fingerprinting for same normalized AST
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  CorpusRunner,
  MockExtractor,
  normalizeAST,
  printAST,
  printASTCompact,
  fingerprintAST,
  shortFingerprint,
  validateShape,
  createDomain,
  createEntity,
  createBehavior,
  createField,
  createPrimitiveType,
  createInputSpec,
  createOutputSpec,
  createIdentifier,
  createStringLiteral,
  createNumberLiteral,
  createBooleanLiteral,
  type Domain,
  type CorpusEntry,
  type ShapeRule,
} from './corpusRunner.js';
import corpus from './corpus.json';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const minimalDomain = createDomain('Minimal', '1.0.0', {
  entities: [
    createEntity('Item', [
      createField('id', createPrimitiveType('UUID')),
    ]),
  ],
});

const complexDomain = createDomain('Complex', '2.0.0', {
  owner: 'Test Suite',
  entities: [
    createEntity('User', [
      createField('id', createPrimitiveType('UUID')),
      createField('email', createPrimitiveType('String')),
      createField('name', createPrimitiveType('String')),
      createField('createdAt', createPrimitiveType('Timestamp')),
    ]),
    createEntity('Post', [
      createField('id', createPrimitiveType('UUID')),
      createField('title', createPrimitiveType('String')),
      createField('content', createPrimitiveType('String')),
      createField('authorId', createPrimitiveType('UUID')),
    ]),
  ],
  behaviors: [
    createBehavior('CreateUser', {
      description: 'Create a new user',
      input: createInputSpec([
        createField('email', createPrimitiveType('String')),
        createField('name', createPrimitiveType('String')),
      ]),
      output: createOutputSpec(createPrimitiveType('Boolean')),
      preconditions: [
        {
          kind: 'BinaryExpr',
          operator: '>',
          left: {
            kind: 'MemberExpr',
            object: createIdentifier('input'),
            property: createIdentifier('email'),
          },
          right: createNumberLiteral(0),
        },
      ],
      postconditions: [
        {
          kind: 'PostconditionBlock',
          condition: 'success',
          predicates: [createBooleanLiteral(true)],
        },
      ],
    }),
    createBehavior('DeleteUser', {
      description: 'Delete a user',
      input: createInputSpec([
        createField('userId', createPrimitiveType('UUID')),
      ]),
    }),
  ],
});

// ============================================================================
// PRINTER DETERMINISM TESTS
// ============================================================================

describe('Printer Determinism', () => {
  describe('printAST', () => {
    it('should produce identical output for the same AST', () => {
      const outputs: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        outputs.push(printAST(minimalDomain));
      }
      
      const first = outputs[0];
      expect(outputs.every(o => o === first)).toBe(true);
    });

    it('should produce identical output for complex AST', () => {
      const outputs: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        outputs.push(printAST(complexDomain));
      }
      
      const first = outputs[0];
      expect(outputs.every(o => o === first)).toBe(true);
    });

    it('should maintain key ordering across prints', () => {
      const output1 = printAST(complexDomain);
      const output2 = printAST(complexDomain);
      
      expect(output1).toBe(output2);
    });

    it('should handle deeply nested structures deterministically', () => {
      const nestedDomain = createDomain('Nested', '1.0.0', {
        behaviors: [
          createBehavior('DeepBehavior', {
            preconditions: [
              {
                kind: 'BinaryExpr',
                operator: 'and',
                left: {
                  kind: 'BinaryExpr',
                  operator: '==',
                  left: createIdentifier('a'),
                  right: createNumberLiteral(1),
                },
                right: {
                  kind: 'BinaryExpr',
                  operator: '==',
                  left: createIdentifier('b'),
                  right: createNumberLiteral(2),
                },
              },
            ],
          }),
        ],
      });

      const outputs: string[] = [];
      for (let i = 0; i < 5; i++) {
        outputs.push(printAST(nestedDomain));
      }
      
      expect(outputs.every(o => o === outputs[0])).toBe(true);
    });
  });

  describe('printASTCompact', () => {
    it('should produce identical compact output', () => {
      const outputs: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        outputs.push(printASTCompact(minimalDomain));
      }
      
      const first = outputs[0];
      expect(outputs.every(o => o === first)).toBe(true);
    });
  });
});

// ============================================================================
// NORMALIZATION TESTS
// ============================================================================

describe('AST Normalization', () => {
  describe('normalizeAST', () => {
    it('should remove location information', () => {
      const normalized = normalizeAST(minimalDomain);
      
      expect(normalized.location).toBeUndefined();
      expect(normalized.name.location).toBeUndefined();
      expect(normalized.version.location).toBeUndefined();
    });

    it('should preserve structural content', () => {
      const normalized = normalizeAST(minimalDomain);
      
      expect(normalized.kind).toBe('Domain');
      expect(normalized.name.kind).toBe('Identifier');
      expect(normalized.name.name).toBe('Minimal');
      expect(normalized.version.value).toBe('1.0.0');
    });

    it('should normalize arrays recursively', () => {
      const normalized = normalizeAST(complexDomain);
      
      expect(normalized.entities.length).toBe(2);
      expect(normalized.entities[0].location).toBeUndefined();
      expect(normalized.entities[0].fields[0].location).toBeUndefined();
    });

    it('should handle null and undefined values', () => {
      const domainWithNulls = createDomain('Test', '1.0.0', {
        owner: undefined,
        entities: [],
      });
      
      const normalized = normalizeAST(domainWithNulls);
      
      expect(normalized.owner).toBeUndefined();
      expect(normalized.entities).toEqual([]);
    });

    it('should produce equivalent results for structurally identical ASTs', () => {
      const domain1 = createDomain('Test', '1.0.0');
      const domain2 = createDomain('Test', '1.0.0');
      
      const normalized1 = normalizeAST(domain1);
      const normalized2 = normalizeAST(domain2);
      
      expect(JSON.stringify(normalized1)).toBe(JSON.stringify(normalized2));
    });
  });

  describe('Round-trip equality', () => {
    it('should maintain equality after multiple normalizations', () => {
      const normalized1 = normalizeAST(complexDomain);
      const normalized2 = normalizeAST(normalized1 as Domain);
      const normalized3 = normalizeAST(normalized2 as Domain);
      
      expect(JSON.stringify(normalized1)).toBe(JSON.stringify(normalized2));
      expect(JSON.stringify(normalized2)).toBe(JSON.stringify(normalized3));
    });

    it('should be idempotent', () => {
      const normalized = normalizeAST(minimalDomain);
      const doubleNormalized = normalizeAST(normalized as Domain);
      
      expect(JSON.stringify(normalized)).toBe(JSON.stringify(doubleNormalized));
    });
  });
});

// ============================================================================
// FINGERPRINTING TESTS
// ============================================================================

describe('AST Fingerprinting', () => {
  describe('fingerprintAST', () => {
    it('should produce identical fingerprints for the same AST', () => {
      const fingerprints: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        fingerprints.push(fingerprintAST(minimalDomain));
      }
      
      const first = fingerprints[0];
      expect(fingerprints.every(f => f === first)).toBe(true);
    });

    it('should produce identical fingerprints for structurally equivalent ASTs', () => {
      const domain1 = createDomain('Test', '1.0.0', {
        entities: [createEntity('Item', [createField('id', createPrimitiveType('UUID'))])],
      });
      const domain2 = createDomain('Test', '1.0.0', {
        entities: [createEntity('Item', [createField('id', createPrimitiveType('UUID'))])],
      });
      
      const fp1 = fingerprintAST(domain1);
      const fp2 = fingerprintAST(domain2);
      
      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprints for different ASTs', () => {
      const domain1 = createDomain('First', '1.0.0');
      const domain2 = createDomain('Second', '1.0.0');
      
      const fp1 = fingerprintAST(domain1);
      const fp2 = fingerprintAST(domain2);
      
      expect(fp1).not.toBe(fp2);
    });

    it('should detect changes in nested content', () => {
      const domain1 = createDomain('Test', '1.0.0', {
        entities: [createEntity('Item', [createField('id', createPrimitiveType('UUID'))])],
      });
      const domain2 = createDomain('Test', '1.0.0', {
        entities: [createEntity('Item', [createField('id', createPrimitiveType('String'))])],
      });
      
      const fp1 = fingerprintAST(domain1);
      const fp2 = fingerprintAST(domain2);
      
      expect(fp1).not.toBe(fp2);
    });

    it('should be stable across normalizations', () => {
      const fp1 = fingerprintAST(complexDomain);
      const normalized = normalizeAST(complexDomain);
      const fp2 = fingerprintAST(normalized as Domain);
      
      expect(fp1).toBe(fp2);
    });
  });

  describe('shortFingerprint', () => {
    it('should return first 16 characters', () => {
      const short = shortFingerprint(minimalDomain);
      const full = fingerprintAST(minimalDomain);
      
      expect(short.length).toBe(16);
      expect(full.startsWith(short)).toBe(true);
    });

    it('should be stable', () => {
      const shorts: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        shorts.push(shortFingerprint(minimalDomain));
      }
      
      expect(shorts.every(s => s === shorts[0])).toBe(true);
    });
  });
});

// ============================================================================
// SHAPE VALIDATION TESTS
// ============================================================================

describe('Shape Validation', () => {
  describe('validateShape', () => {
    it('should pass valid shapes', () => {
      const rules: ShapeRule = {
        minEntities: 1,
        maxEntities: 5,
        requiredKinds: ['Domain', 'Entity'],
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing entities', () => {
      const rules: ShapeRule = {
        minEntities: 5,
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('entities'))).toBe(true);
    });

    it('should detect too many entities', () => {
      const rules: ShapeRule = {
        maxEntities: 1,
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('entities'))).toBe(true);
    });

    it('should detect missing behaviors', () => {
      const rules: ShapeRule = {
        minBehaviors: 10,
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('behaviors'))).toBe(true);
    });

    it('should detect missing required kinds', () => {
      const rules: ShapeRule = {
        requiredKinds: ['NonExistentKind'],
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('NonExistentKind'))).toBe(true);
    });

    it('should validate domain name pattern', () => {
      const rules: ShapeRule = {
        domainNamePattern: '^Complex$',
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(true);
    });

    it('should fail invalid domain name pattern', () => {
      const rules: ShapeRule = {
        domainNamePattern: '^InvalidPattern$',
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(false);
    });

    it('should validate version pattern', () => {
      const rules: ShapeRule = {
        versionPattern: '^\\d+\\.\\d+\\.\\d+$',
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(true);
    });

    it('should check preconditions requirement', () => {
      const rules: ShapeRule = {
        requirePreconditions: true,
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(true);
    });

    it('should check postconditions requirement', () => {
      const rules: ShapeRule = {
        requirePostconditions: true,
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.valid).toBe(true);
    });

    it('should warn about missing recommended fields', () => {
      const rules: ShapeRule = {
        requiredFields: ['nonexistent_field'],
      };
      
      const result = validateShape(complexDomain, rules);
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// MOCK EXTRACTOR TESTS
// ============================================================================

describe('MockExtractor', () => {
  let extractor: MockExtractor;

  beforeAll(() => {
    extractor = new MockExtractor();
  });

  it('should generate valid AST from corpus entry', () => {
    const entry: CorpusEntry = {
      id: 'test-001',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minEntities: 1,
        minBehaviors: 1,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.kind).toBe('Domain');
    expect(ast.entities.length).toBeGreaterThanOrEqual(1);
    expect(ast.behaviors.length).toBeGreaterThanOrEqual(1);
  });

  it('should respect minEntities in shape rules', () => {
    const entry: CorpusEntry = {
      id: 'test-002',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minEntities: 3,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.entities.length).toBeGreaterThanOrEqual(3);
  });

  it('should respect minBehaviors in shape rules', () => {
    const entry: CorpusEntry = {
      id: 'test-003',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minBehaviors: 5,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.behaviors.length).toBeGreaterThanOrEqual(5);
  });

  it('should add preconditions when required', () => {
    const entry: CorpusEntry = {
      id: 'test-004',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minBehaviors: 1,
        requirePreconditions: true,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.behaviors.some(b => b.preconditions.length > 0)).toBe(true);
  });

  it('should add postconditions when required', () => {
    const entry: CorpusEntry = {
      id: 'test-005',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minBehaviors: 1,
        requirePostconditions: true,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.behaviors.some(b => b.postconditions.length > 0)).toBe(true);
  });

  it('should add temporal specs when required', () => {
    const entry: CorpusEntry = {
      id: 'test-006',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minBehaviors: 1,
        requireTemporal: true,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.behaviors.some(b => b.temporal.length > 0)).toBe(true);
  });

  it('should add security specs when required', () => {
    const entry: CorpusEntry = {
      id: 'test-007',
      prompt: 'Test prompt',
      category: 'test',
      expectedShape: {
        minBehaviors: 1,
        requireSecurity: true,
      },
      tags: ['test'],
    };

    const ast = extractor.extract(entry);

    expect(ast.behaviors.some(b => b.security.length > 0)).toBe(true);
  });
});

// ============================================================================
// CORPUS RUNNER TESTS
// ============================================================================

describe('CorpusRunner', () => {
  let runner: CorpusRunner;
  const corpusEntries = (corpus as { entries: CorpusEntry[] }).entries;

  beforeAll(() => {
    runner = new CorpusRunner();
  });

  describe('run', () => {
    it('should run a single corpus entry', () => {
      const entry = corpusEntries[0];
      const result = runner.run(entry);

      expect(result.entry).toBe(entry);
      expect(result.ast).toBeDefined();
      expect(result.fingerprint).toBeDefined();
      expect(result.printOutput).toBeDefined();
      expect(result.printerDeterministic).toBe(true);
      expect(result.fingerprintStable).toBe(true);
    });

    it('should validate shape rules', () => {
      const entry = corpusEntries[0];
      const result = runner.run(entry);

      expect(result.validation).toBeDefined();
      expect(result.validation.valid).toBe(true);
    });
  });

  describe('runAll', () => {
    it('should run all corpus entries', () => {
      const results = runner.runAll(corpusEntries);

      expect(results.length).toBe(corpusEntries.length);
      expect(results.every(r => r.ast !== undefined)).toBe(true);
    });

    it('should maintain printer determinism across all entries', () => {
      const results = runner.runAll(corpusEntries);

      expect(results.every(r => r.printerDeterministic)).toBe(true);
    });

    it('should maintain fingerprint stability across all entries', () => {
      const results = runner.runAll(corpusEntries);

      expect(results.every(r => r.fingerprintStable)).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should provide summary statistics', () => {
      const results = runner.runAll(corpusEntries);
      const summary = runner.getSummary(results);

      expect(summary.total).toBe(corpusEntries.length);
      expect(summary.passed + summary.failed).toBe(summary.total);
      expect(summary.passRate).toBeGreaterThanOrEqual(0);
      expect(summary.passRate).toBeLessThanOrEqual(100);
    });

    it('should report deterministic failures', () => {
      const results = runner.runAll(corpusEntries);
      const summary = runner.getSummary(results);

      expect(summary.deterministicFailures).toEqual([]);
    });

    it('should report fingerprint failures', () => {
      const results = runner.runAll(corpusEntries);
      const summary = runner.getSummary(results);

      expect(summary.fingerprintFailures).toEqual([]);
    });
  });
});

// ============================================================================
// FULL CORPUS VALIDATION TESTS
// ============================================================================

describe('Full Corpus Validation', () => {
  const corpusEntries = (corpus as { entries: CorpusEntry[] }).entries;
  let runner: CorpusRunner;
  let results: ReturnType<CorpusRunner['runAll']>;

  beforeAll(() => {
    runner = new CorpusRunner();
    results = runner.runAll(corpusEntries);
  });

  it('should have 50 corpus entries', () => {
    expect(corpusEntries.length).toBe(50);
  });

  it('should validate all entries have required fields', () => {
    for (const entry of corpusEntries) {
      expect(entry.id).toBeDefined();
      expect(entry.prompt).toBeDefined();
      expect(entry.category).toBeDefined();
      expect(entry.expectedShape).toBeDefined();
      expect(entry.tags).toBeDefined();
    }
  });

  it('should have unique IDs for all entries', () => {
    const ids = corpusEntries.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should pass printer determinism for all entries', () => {
    const failures = results.filter(r => !r.printerDeterministic);
    expect(failures).toHaveLength(0);
  });

  it('should pass fingerprint stability for all entries', () => {
    const failures = results.filter(r => !r.fingerprintStable);
    expect(failures).toHaveLength(0);
  });

  it('should pass shape validation for all entries', () => {
    const failures = results.filter(r => !r.validation.valid);
    if (failures.length > 0) {
      const failureDetails = failures.map(f => ({
        id: f.entry.id,
        errors: f.validation.errors,
      }));
      // Log failure details for debugging
      console.log('Shape validation failures:', JSON.stringify(failureDetails, null, 2));
    }
    expect(failures).toHaveLength(0);
  });

  it('should have categories covering main use cases', () => {
    const categories = new Set(corpusEntries.map(e => e.category));
    
    expect(categories.has('authentication')).toBe(true);
    expect(categories.has('crud')).toBe(true);
    expect(categories.has('payments')).toBe(true);
    expect(categories.has('orders')).toBe(true);
    expect(categories.has('notifications')).toBe(true);
  });

  it('should have at least 100% pass rate', () => {
    const summary = runner.getSummary(results);
    expect(summary.passRate).toBe(100);
  });

  describe.each(corpusEntries.slice(0, 10))('Entry: $id', (entry) => {
    it('should produce deterministic prints', () => {
      const result = runner.run(entry);
      expect(result.printerDeterministic).toBe(true);
    });

    it('should produce stable fingerprints', () => {
      const result = runner.run(entry);
      expect(result.fingerprintStable).toBe(true);
    });

    it('should validate shape rules', () => {
      const result = runner.run(entry);
      expect(result.validation.valid).toBe(true);
    });
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty domain', () => {
    const emptyDomain = createDomain('Empty', '1.0.0');
    
    const fp = fingerprintAST(emptyDomain);
    const printed = printAST(emptyDomain);
    const normalized = normalizeAST(emptyDomain);
    
    expect(fp).toBeDefined();
    expect(printed).toBeDefined();
    expect(normalized).toBeDefined();
  });

  it('should handle domain with empty arrays', () => {
    const domain = createDomain('EmptyArrays', '1.0.0', {
      entities: [],
      behaviors: [],
      types: [],
      imports: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
    });
    
    const fp = fingerprintAST(domain);
    const printed = printAST(domain);
    
    expect(fp).toBeDefined();
    expect(printed.includes('EmptyArrays')).toBe(true);
  });

  it('should handle special characters in strings', () => {
    const domain = createDomain('Special', '1.0.0', {
      owner: 'Test "quoted" owner',
      behaviors: [
        createBehavior('Test\nNewline', {
          description: 'Description with\ttab',
        }),
      ],
    });
    
    const fp = fingerprintAST(domain);
    const printed = printAST(domain);
    
    expect(fp).toBeDefined();
    expect(printed).toBeDefined();
  });

  it('should handle unicode in identifiers', () => {
    const domain = createDomain('Unicode', '1.0.0', {
      entities: [
        createEntity('Ëntity', [
          createField('fiëld', createPrimitiveType('String')),
        ]),
      ],
    });
    
    const fp = fingerprintAST(domain);
    const normalized = normalizeAST(domain);
    
    expect(fp).toBeDefined();
    expect((normalized.entities[0] as typeof domain.entities[0]).name.name).toBe('Ëntity');
  });

  it('should handle very long field names', () => {
    const longName = 'a'.repeat(1000);
    const domain = createDomain('LongNames', '1.0.0', {
      entities: [
        createEntity(longName, [
          createField(longName, createPrimitiveType('String')),
        ]),
      ],
    });
    
    const fp1 = fingerprintAST(domain);
    const fp2 = fingerprintAST(domain);
    
    expect(fp1).toBe(fp2);
  });

  it('should handle deeply nested expressions', () => {
    let expr: typeof createNumberLiteral extends (...args: unknown[]) => infer R ? R : never = createNumberLiteral(1);
    
    for (let i = 0; i < 20; i++) {
      expr = {
        kind: 'BinaryExpr',
        operator: '+',
        left: expr,
        right: createNumberLiteral(i),
      } as typeof expr;
    }
    
    const domain = createDomain('DeepNested', '1.0.0', {
      behaviors: [
        createBehavior('Deep', {
          preconditions: [expr as typeof domain.behaviors[0]['preconditions'][0]],
        }),
      ],
    });
    
    const fp = fingerprintAST(domain);
    const printed = printAST(domain);
    
    expect(fp).toBeDefined();
    expect(printed.includes('DeepNested')).toBe(true);
  });
});
