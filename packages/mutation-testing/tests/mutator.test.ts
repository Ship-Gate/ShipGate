/**
 * Mutation Testing Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MutationEngine,
  mutate,
  applyMutant,
} from '../src/mutator';
import {
  MutationReporter,
  generateReport,
  formatReportText,
} from '../src/reporter';
import {
  SurvivorAnalyzer,
  analyzeSurvivors,
} from '../src/survivor';
import type { Mutant, MutationResult } from '../src/types';

// Mock AST for testing
const mockAST = {
  type: 'Domain',
  name: 'TestDomain',
  entities: [
    {
      type: 'Entity',
      name: 'User',
      fields: [
        {
          type: 'FieldDefinition',
          name: 'email',
          optional: false,
        },
        {
          type: 'FieldDefinition',
          name: 'bio',
          optional: true,
        },
      ],
      invariants: [
        {
          type: 'Invariant',
          operator: '>=',
          left: { type: 'Identifier', name: 'age' },
          right: { type: 'NumericLiteral', value: 0 },
        },
      ],
    },
  ],
  behaviors: [
    {
      type: 'Behavior',
      name: 'CreateUser',
      preconditions: [
        {
          type: 'Precondition',
          negated: true,
          expression: {
            type: 'CallExpression',
            name: 'User.exists_by_email',
          },
        },
      ],
      postconditions: [
        {
          type: 'Postcondition',
          comparison: {
            type: 'BinaryExpression',
            operator: '==',
            left: { type: 'Identifier', name: 'result.status' },
            right: { type: 'Identifier', name: 'PENDING' },
          },
        },
      ],
    },
  ],
  types: [
    {
      type: 'TypeDefinition',
      name: 'Password',
      constraint: {
        type: 'TypeConstraint',
        min_length: 8,
        max_length: 128,
      },
    },
  ],
};

describe('MutationEngine', () => {
  it('should generate mutants from AST', () => {
    const engine = new MutationEngine();
    const mutants = engine.generateMutants(mockAST, 'test.isl');

    expect(mutants.length).toBeGreaterThan(0);
    expect(mutants.every((m) => m.id)).toBe(true);
    expect(mutants.every((m) => m.type)).toBe(true);
    expect(mutants.every((m) => m.status === 'pending')).toBe(true);
  });

  it('should respect maxMutants config', () => {
    const engine = new MutationEngine({ maxMutants: 5 });
    const mutants = engine.generateMutants(mockAST, 'test.isl');

    expect(mutants.length).toBeLessThanOrEqual(5);
  });

  it('should filter by mutation types', () => {
    const engine = new MutationEngine({ mutationTypes: ['comparison'] });
    const mutants = engine.generateMutants(mockAST, 'test.isl');

    expect(mutants.every((m) => m.type === 'comparison')).toBe(true);
  });
});

describe('applyMutant', () => {
  it('should apply single-line mutation', () => {
    const source = `entity User {
  age: Int { min: 0 }
}`;

    const mutant: Mutant = {
      id: 'test-1',
      type: 'boundary',
      location: {
        file: 'test.isl',
        startLine: 2,
        endLine: 2,
        startColumn: 16,
        endColumn: 17,
      },
      original: '0',
      mutated: '1',
      description: 'Change min from 0 to 1',
      status: 'pending',
    };

    const result = applyMutant(source, mutant);
    expect(result).toContain('min: 1');
  });
});

describe('MutationReporter', () => {
  it('should generate report from results', () => {
    const results: MutationResult[] = [
      {
        mutant: createMutant('1', 'killed', 'comparison'),
        status: 'killed',
        testsRun: 10,
        testsPassed: 9,
        testsFailed: 1,
        duration: 100,
      },
      {
        mutant: createMutant('2', 'killed', 'logical'),
        status: 'killed',
        testsRun: 10,
        testsPassed: 8,
        testsFailed: 2,
        duration: 150,
      },
      {
        mutant: createMutant('3', 'survived', 'boundary'),
        status: 'survived',
        testsRun: 10,
        testsPassed: 10,
        testsFailed: 0,
        duration: 200,
      },
    ];

    const reporter = new MutationReporter();
    const report = reporter.generateReport(results);

    expect(report.totalMutants).toBe(3);
    expect(report.killed).toBe(2);
    expect(report.survived).toBe(1);
    expect(report.score).toBeCloseTo(66.67, 1);
    expect(report.survivors.length).toBe(1);
  });

  it('should calculate correct mutation score', () => {
    const results: MutationResult[] = [
      { mutant: createMutant('1', 'killed'), status: 'killed', testsRun: 1, testsPassed: 0, testsFailed: 1, duration: 10 },
      { mutant: createMutant('2', 'killed'), status: 'killed', testsRun: 1, testsPassed: 0, testsFailed: 1, duration: 10 },
      { mutant: createMutant('3', 'killed'), status: 'killed', testsRun: 1, testsPassed: 0, testsFailed: 1, duration: 10 },
      { mutant: createMutant('4', 'killed'), status: 'killed', testsRun: 1, testsPassed: 0, testsFailed: 1, duration: 10 },
      { mutant: createMutant('5', 'survived'), status: 'survived', testsRun: 1, testsPassed: 1, testsFailed: 0, duration: 10 },
    ];

    const report = generateReport(results);
    expect(report.score).toBe(80); // 4/5 = 80%
  });

  it('should format report as text', () => {
    const results: MutationResult[] = [
      { mutant: createMutant('1', 'killed'), status: 'killed', testsRun: 1, testsPassed: 0, testsFailed: 1, duration: 10 },
      { mutant: createMutant('2', 'survived'), status: 'survived', testsRun: 1, testsPassed: 1, testsFailed: 0, duration: 10 },
    ];

    const report = generateReport(results);
    const text = formatReportText(report);

    expect(text).toContain('MUTATION TESTING REPORT');
    expect(text).toContain('Mutation Score:');
    expect(text).toContain('Killed:');
    expect(text).toContain('Survived:');
  });
});

describe('SurvivorAnalyzer', () => {
  it('should analyze surviving mutants', () => {
    const survivors: Mutant[] = [
      createMutant('1', 'survived', 'boundary'),
      createMutant('2', 'survived', 'error'),
      createMutant('3', 'survived', 'comparison'),
    ];

    const analyzer = new SurvivorAnalyzer();
    const analyses = analyzer.analyze(survivors);

    expect(analyses.length).toBe(3);
    expect(analyses.every((a) => a.likelyCause)).toBe(true);
    expect(analyses.every((a) => a.suggestedTest)).toBe(true);
    expect(analyses.every((a) => a.testTemplate)).toBe(true);
    expect(analyses.every((a) => typeof a.priority === 'number')).toBe(true);
  });

  it('should sort by priority', () => {
    const survivors: Mutant[] = [
      createMutant('1', 'survived', 'arithmetic'), // Low priority
      createMutant('2', 'survived', 'precondition'), // High priority
      createMutant('3', 'survived', 'boundary'), // Medium priority
    ];

    const analyses = analyzeSurvivors(survivors);

    // Precondition should be first (highest priority)
    expect(analyses[0].mutant.type).toBe('precondition');
  });

  it('should determine correct cause for boundary mutations', () => {
    const survivor = createMutant('1', 'survived', 'boundary');
    const analyses = analyzeSurvivors([survivor]);

    expect(analyses[0].likelyCause).toBe('boundary_not_tested');
  });

  it('should determine correct cause for error mutations', () => {
    const survivor = createMutant('1', 'survived', 'error');
    const analyses = analyzeSurvivors([survivor]);

    expect(analyses[0].likelyCause).toBe('error_path_not_tested');
  });
});

describe('Mutation Operators', () => {
  describe('Arithmetic', () => {
    it('should generate mutants for numeric literals', () => {
      const engine = new MutationEngine({ mutationTypes: ['arithmetic'] });
      const ast = {
        type: 'Domain',
        types: [{
          type: 'TypeConstraint',
          min: 8,
          max: 128,
        }],
      };

      const mutants = engine.generateMutants(ast, 'test.isl');
      
      // Should have mutations for min and max values
      const minMutants = mutants.filter((m) => m.original.includes('min'));
      expect(minMutants.length).toBeGreaterThan(0);
    });
  });

  describe('Comparison', () => {
    it('should generate mutants for comparison operators', () => {
      const engine = new MutationEngine({ mutationTypes: ['comparison'] });
      const ast = {
        type: 'Domain',
        entities: [{
          type: 'Entity',
          invariants: [{
            type: 'Invariant',
            operator: '>=',
          }],
        }],
      };

      const mutants = engine.generateMutants(ast, 'test.isl');
      
      // Should have mutations changing >= to other operators
      expect(mutants.some((m) => m.original === '>=' || m.original.includes('invariant'))).toBe(true);
    });
  });

  describe('Logical', () => {
    it('should generate mutants for implies expressions', () => {
      const engine = new MutationEngine({ mutationTypes: ['logical'] });
      const ast = {
        type: 'Domain',
        entities: [{
          type: 'Entity',
          invariants: [{
            type: 'ImpliesExpression',
            antecedent: { type: 'Identifier' },
            consequent: { type: 'Identifier' },
          }],
        }],
      };

      const mutants = engine.generateMutants(ast, 'test.isl');
      
      // Should have mutations for implies
      expect(mutants.some((m) => m.description.includes('implies'))).toBe(true);
    });
  });

  describe('Boundary', () => {
    it('should generate boundary mutations', () => {
      const engine = new MutationEngine({ mutationTypes: ['boundary'] });
      const ast = {
        type: 'Domain',
        types: [{
          type: 'TypeConstraint',
          min_length: 8,
          max_length: 128,
        }],
      };

      const mutants = engine.generateMutants(ast, 'test.isl');
      
      // Should have ±1 mutations for boundaries
      expect(mutants.some((m) => m.description.includes('min_length'))).toBe(true);
    });
  });

  describe('Null', () => {
    it('should generate optional field mutations', () => {
      const engine = new MutationEngine({ mutationTypes: ['null'] });
      const ast = {
        type: 'Domain',
        entities: [{
          type: 'Entity',
          fields: [{
            type: 'FieldDefinition',
            name: 'bio',
            optional: true,
          }],
        }],
      };

      const mutants = engine.generateMutants(ast, 'test.isl');
      
      // Should have mutation to make required
      expect(mutants.some((m) => m.description.includes('required'))).toBe(true);
    });
  });

  describe('Temporal', () => {
    it('should generate temporal mutations', () => {
      const engine = new MutationEngine({ mutationTypes: ['temporal'] });
      const ast = {
        type: 'Domain',
        behaviors: [{
          type: 'Behavior',
          temporal: [{
            type: 'TemporalConstraint',
            within: 200,
            unit: 'ms',
            percentile: 'p99',
          }],
        }],
      };

      const mutants = engine.generateMutants(ast, 'test.isl');
      
      // Should have mutations for timing
      expect(mutants.some((m) => 
        m.description.includes('Tighten') || 
        m.description.includes('Loosen') ||
        m.description.includes('percentile')
      )).toBe(true);
    });
  });
});

// Helper to create test mutants
function createMutant(
  id: string,
  status: 'pending' | 'killed' | 'survived' = 'pending',
  type: string = 'comparison'
): Mutant {
  return {
    id: `mutant-${id}`,
    type: type as any,
    location: {
      file: 'test.isl',
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 10,
    },
    original: 'original',
    mutated: 'mutated',
    description: `Test mutation ${id}`,
    status,
  };
}
