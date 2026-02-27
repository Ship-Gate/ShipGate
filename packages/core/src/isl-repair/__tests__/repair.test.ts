/**
 * ISL Repair Engine Tests
 *
 * Tests for the deterministic AST repair system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Domain, SourceLocation } from '@isl-lang/parser';
import {
  repairAst,
  createRepairPipeline,
  formatRepairReport,
  missingFieldsStrategy,
  normalizeOrderStrategy,
  schemaFixStrategy,
} from '../index.js';
import type { RepairResult, DeepPartial } from '../types.js';
import {
  emptyAst,
  missingNameAndVersion,
  entityMissingFields,
  behaviorMissingSpecs,
  invalidTypeNames,
  invalidOperators,
  duplicateFields,
  unsortedDomain,
  sqlTypeNames,
  invalidQuantifiers,
  complexBroken,
} from '../fixtures/index.js';

const defaultLocation: SourceLocation = {
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

/**
 * Create a valid minimal domain for comparison
 */
function createValidDomain(): Domain {
  return {
    kind: 'Domain',
    location: defaultLocation,
    name: { kind: 'Identifier', name: 'TestDomain', location: defaultLocation },
    version: { kind: 'StringLiteral', value: '1.0.0', location: defaultLocation },
    imports: [],
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
  };
}

describe('repairAst', () => {
  describe('missing fields repairs', () => {
    it('should add missing name and version to domain', () => {
      const result = repairAst(missingNameAndVersion as Domain);

      expect(result.ast.name).toBeDefined();
      expect(result.ast.name.name).toBe('UnnamedDomain');
      expect(result.ast.version).toBeDefined();
      expect(result.ast.version.value).toBe('0.1.0');

      const nameRepair = result.repairs.find((r) => r.path === 'domain.name');
      const versionRepair = result.repairs.find((r) => r.path === 'domain.version');

      expect(nameRepair).toBeDefined();
      expect(nameRepair?.category).toBe('missing-field');
      expect(versionRepair).toBeDefined();
      expect(versionRepair?.category).toBe('missing-field');
    });

    it('should initialize all missing arrays on empty AST', () => {
      const result = repairAst(emptyAst as Domain);

      expect(result.ast.imports).toEqual([]);
      expect(result.ast.types).toEqual([]);
      expect(result.ast.entities).toEqual([]);
      expect(result.ast.behaviors).toEqual([]);
      expect(result.ast.invariants).toEqual([]);
      expect(result.ast.policies).toEqual([]);
      expect(result.ast.views).toEqual([]);
      expect(result.ast.scenarios).toEqual([]);
      expect(result.ast.chaos).toEqual([]);

      // Should have repairs for each missing array
      const arrayRepairs = result.repairs.filter(
        (r) => r.category === 'missing-field' && r.diffSummary.includes('Initialized empty')
      );
      expect(arrayRepairs.length).toBeGreaterThanOrEqual(9);
    });

    it('should add missing entity name and field properties', () => {
      const result = repairAst(entityMissingFields as Domain);

      const entity = result.ast.entities[0];
      expect(entity).toBeDefined();
      expect(entity.name.name).toBe('Entity1');
      expect(entity.invariants).toEqual([]);

      const field = entity.fields[0];
      expect(field).toBeDefined();
      expect(field.name.name).toBe('field1');
      expect(field.type).toBeDefined();
      expect(field.optional).toBe(false);
      expect(field.annotations).toEqual([]);
    });

    it('should add missing behavior input/output specs', () => {
      const result = repairAst(behaviorMissingSpecs as Domain);

      const behavior = result.ast.behaviors[0];
      expect(behavior).toBeDefined();
      expect(behavior.input).toBeDefined();
      expect(behavior.input.fields).toEqual([]);
      expect(behavior.output).toBeDefined();
      expect(behavior.output.success).toBeDefined();
      expect(behavior.output.errors).toEqual([]);
      expect(behavior.preconditions).toEqual([]);
      expect(behavior.postconditions).toEqual([]);
    });
  });

  describe('schema fix repairs', () => {
    it('should correct JavaScript/TypeScript type names', () => {
      const result = repairAst(invalidTypeNames as Domain);

      const entity = result.ast.entities[0];
      const fields = entity.fields;

      // string -> String
      expect(fields[0].type.kind).toBe('PrimitiveType');
      expect((fields[0].type as { name: string }).name).toBe('String');

      // number -> Int
      expect(fields[1].type.kind).toBe('PrimitiveType');
      expect((fields[1].type as { name: string }).name).toBe('Int');

      // boolean -> Boolean
      expect(fields[2].type.kind).toBe('PrimitiveType');
      expect((fields[2].type as { name: string }).name).toBe('Boolean');

      // Should have repairs for each type correction
      const typeRepairs = result.repairs.filter(
        (r) => r.category === 'schema-mismatch' && r.diffSummary.includes('Corrected type')
      );
      expect(typeRepairs.length).toBe(3);
    });

    it('should correct SQL type names', () => {
      const result = repairAst(sqlTypeNames as Domain);

      const fields = result.ast.entities[0].fields;

      expect((fields[0].type as { name: string }).name).toBe('String'); // VARCHAR
      expect((fields[1].type as { name: string }).name).toBe('Int'); // INTEGER
      expect((fields[2].type as { name: string }).name).toBe('Decimal'); // FLOAT
      expect((fields[3].type as { name: string }).name).toBe('Timestamp'); // DATETIME
    });

    it('should correct invalid binary operators', () => {
      const result = repairAst(invalidOperators as Domain);

      const invariants = result.ast.entities[0].invariants;

      // === -> ==
      expect((invariants[0] as { operator: string }).operator).toBe('==');

      // && -> and
      expect((invariants[1] as { operator: string }).operator).toBe('and');

      const operatorRepairs = result.repairs.filter(
        (r) => r.category === 'schema-mismatch' && r.diffSummary.includes('Corrected operator')
      );
      expect(operatorRepairs.length).toBe(2);
    });

    it('should correct invalid quantifier names', () => {
      const result = repairAst(invalidQuantifiers as Domain);

      const invariants = result.ast.entities[0].invariants;

      // every -> all
      expect((invariants[0] as { quantifier: string }).quantifier).toBe('all');

      // exists -> any
      expect((invariants[1] as { quantifier: string }).quantifier).toBe('any');
    });

    it('should remove duplicate entity fields', () => {
      const result = repairAst(duplicateFields as Domain);

      const entity = result.ast.entities[0];

      // Should have 2 fields after removing duplicate
      expect(entity.fields.length).toBe(2);

      // Check that no duplicate names exist
      const names = entity.fields.map((f) => f.name.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);

      // Should have a duplicate removal repair
      const duplicateRepair = result.repairs.find((r) => r.category === 'duplicate-removal');
      expect(duplicateRepair).toBeDefined();
      expect(duplicateRepair?.diffSummary).toContain('email');
    });
  });

  describe('normalize order repairs', () => {
    it('should sort entities alphabetically', () => {
      const result = repairAst(unsortedDomain as Domain);

      const entityNames = result.ast.entities.map((e) => e.name.name);
      expect(entityNames).toEqual(['Apple', 'Mango', 'Zebra']);

      const orderRepair = result.repairs.find(
        (r) => r.category === 'normalize-order' && r.path === 'domain.entities'
      );
      expect(orderRepair).toBeDefined();
    });

    it('should sort behaviors alphabetically', () => {
      const result = repairAst(unsortedDomain as Domain);

      const behaviorNames = result.ast.behaviors.map((b) => b.name.name);
      expect(behaviorNames).toEqual(['AAction', 'ZAction']);
    });

    it('should sort types alphabetically', () => {
      const result = repairAst(unsortedDomain as Domain);

      const typeNames = result.ast.types.map((t) => t.name.name);
      expect(typeNames).toEqual(['Alpha', 'Zebra']);
    });

    it('should respect normalizeOrdering option', () => {
      const result = repairAst(unsortedDomain as Domain, [], { normalizeOrdering: false });

      // Order should be preserved
      const entityNames = result.ast.entities.map((e) => e.name.name);
      expect(entityNames).toEqual(['Zebra', 'Apple', 'Mango']);

      // No ordering repairs
      const orderRepairs = result.repairs.filter((r) => r.category === 'normalize-order');
      expect(orderRepairs.length).toBe(0);
    });
  });

  describe('complex repairs', () => {
    it('should handle AST with multiple issues', () => {
      const result = repairAst(complexBroken as Domain);

      // Should have name and version
      expect(result.ast.name).toBeDefined();
      expect(result.ast.version).toBeDefined();

      // Should have initialized arrays
      expect(result.ast.invariants).toEqual([]);
      expect(result.ast.policies).toEqual([]);

      // Entity should be repaired
      const entity = result.ast.entities[0];
      expect(entity.name.name).toBe('Entity1');
      expect(entity.fields[0].type.kind).toBe('PrimitiveType');
      expect((entity.fields[0].type as { name: string }).name).toBe('String');

      // Operator should be fixed
      expect((entity.invariants[0] as { operator: string }).operator).toBe('and');

      // Behavior should be repaired
      const behavior = result.ast.behaviors[0];
      expect(behavior.name.name).toBe('Behavior1');
      expect(behavior.input).toBeDefined();
      expect(behavior.output).toBeDefined();

      // Should have unrepaired error for type without definition
      expect(result.remainingErrors.length).toBeGreaterThan(0);
      const typeError = result.remainingErrors.find((e) =>
        e.message.includes('no definition')
      );
      expect(typeError).toBeDefined();
    });
  });

  describe('options', () => {
    it('should respect minConfidence option', () => {
      // With minConfidence: 'high', low confidence repairs should be filtered
      const result = repairAst(entityMissingFields as Domain, [], {
        minConfidence: 'high',
      });

      // Low confidence repairs (like default field types) should not be applied
      const lowConfidenceRepairs = result.repairs.filter((r) => r.confidence === 'low');
      expect(lowConfidenceRepairs.length).toBe(0);
    });

    it('should respect categories filter', () => {
      const result = repairAst(complexBroken as Domain, [], {
        categories: ['missing-field'],
      });

      // Only missing-field repairs should be applied
      for (const repair of result.repairs) {
        expect(repair.category).toBe('missing-field');
      }
    });

    it('should respect maxRepairs option', () => {
      const result = repairAst(emptyAst as Domain, [], { maxRepairs: 3 });

      expect(result.repairs.length).toBeLessThanOrEqual(3);
    });
  });

  describe('immutability', () => {
    it('should not mutate the original AST', () => {
      const original = JSON.parse(JSON.stringify(emptyAst));
      const result = repairAst(emptyAst as Domain);

      // Original should be unchanged
      expect(emptyAst).toEqual(original);

      // Result should be different
      expect(result.ast).not.toBe(emptyAst);
      expect(result.ast.name).toBeDefined();
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      const result = repairAst(complexBroken as Domain);

      expect(result.stats.totalRepairs).toBe(result.repairs.length);
      expect(result.stats.unrepairedCount).toBe(result.remainingErrors.length);
      expect(result.stats.durationMs).toBeGreaterThan(0);

      // Category counts should sum to total
      const categorySum = Object.values(result.stats.byCategory).reduce((a, b) => a + b, 0);
      expect(categorySum).toBe(result.stats.totalRepairs);

      // Confidence counts should sum to total
      const confidenceSum = Object.values(result.stats.byConfidence).reduce((a, b) => a + b, 0);
      expect(confidenceSum).toBe(result.stats.totalRepairs);
    });
  });
});

describe('createRepairPipeline', () => {
  it('should create a custom repair pipeline', () => {
    // Only use missing fields strategy
    const quickRepair = createRepairPipeline([missingFieldsStrategy]);

    const result = quickRepair(behaviorMissingSpecs as Domain);

    // Should have missing field repairs
    expect(result.repairs.length).toBeGreaterThan(0);
    for (const repair of result.repairs) {
      expect(repair.category).toBe('missing-field');
    }
  });

  it('should allow strategy composition', () => {
    // Skip ordering normalization
    const repair = createRepairPipeline([missingFieldsStrategy, schemaFixStrategy]);

    const result = repair(unsortedDomain as Domain);

    // Should not have ordering repairs
    const orderRepairs = result.repairs.filter((r) => r.category === 'normalize-order');
    expect(orderRepairs.length).toBe(0);
  });
});

describe('formatRepairReport', () => {
  it('should format a repair report as string', () => {
    const result = repairAst(complexBroken as Domain);
    const report = formatRepairReport(result);

    expect(typeof report).toBe('string');
    expect(report).toContain('ISL REPAIR REPORT');
    expect(report).toContain('Total repairs applied:');
    expect(report).toContain('Remaining errors:');
    expect(report).toContain('Duration:');
    expect(report).toContain('Repairs by category:');
    expect(report).toContain('Repairs by confidence:');
  });

  it('should include repair details', () => {
    const result = repairAst(missingNameAndVersion as Domain);
    const report = formatRepairReport(result);

    expect(report).toContain('REPAIRS APPLIED');
    expect(report).toContain('Path:');
    expect(report).toContain('Reason:');
    expect(report).toContain('Change:');
  });

  it('should include unrepaired errors when present', () => {
    const result = repairAst(complexBroken as Domain);
    const report = formatRepairReport(result);

    if (result.remainingErrors.length > 0) {
      expect(report).toContain('UNREPAIRED ERRORS');
    }
  });
});

describe('repaired AST validation', () => {
  it('should produce a valid domain structure from empty AST', () => {
    const result = repairAst(emptyAst as Domain);
    const ast = result.ast;

    // Verify required domain fields
    expect(ast.kind).toBe('Domain');
    expect(ast.name).toBeDefined();
    expect(ast.name.kind).toBe('Identifier');
    expect(ast.version).toBeDefined();
    expect(ast.version.kind).toBe('StringLiteral');

    // Verify all arrays are initialized
    expect(Array.isArray(ast.imports)).toBe(true);
    expect(Array.isArray(ast.types)).toBe(true);
    expect(Array.isArray(ast.entities)).toBe(true);
    expect(Array.isArray(ast.behaviors)).toBe(true);
    expect(Array.isArray(ast.invariants)).toBe(true);
    expect(Array.isArray(ast.policies)).toBe(true);
    expect(Array.isArray(ast.views)).toBe(true);
    expect(Array.isArray(ast.scenarios)).toBe(true);
    expect(Array.isArray(ast.chaos)).toBe(true);
  });

  it('should produce valid entity structure', () => {
    const result = repairAst(entityMissingFields as Domain);
    const entity = result.ast.entities[0];

    expect(entity.kind).toBe('Entity');
    expect(entity.name.kind).toBe('Identifier');
    expect(typeof entity.name.name).toBe('string');
    expect(Array.isArray(entity.fields)).toBe(true);
    expect(Array.isArray(entity.invariants)).toBe(true);

    // Verify field structure
    const field = entity.fields[0];
    expect(field.kind).toBe('Field');
    expect(field.name.kind).toBe('Identifier');
    expect(field.type).toBeDefined();
    expect(typeof field.optional).toBe('boolean');
    expect(Array.isArray(field.annotations)).toBe(true);
  });

  it('should produce valid behavior structure', () => {
    const result = repairAst(behaviorMissingSpecs as Domain);
    const behavior = result.ast.behaviors[0];

    expect(behavior.kind).toBe('Behavior');
    expect(behavior.name.kind).toBe('Identifier');
    expect(behavior.input.kind).toBe('InputSpec');
    expect(Array.isArray(behavior.input.fields)).toBe(true);
    expect(behavior.output.kind).toBe('OutputSpec');
    expect(behavior.output.success).toBeDefined();
    expect(Array.isArray(behavior.output.errors)).toBe(true);
    expect(Array.isArray(behavior.preconditions)).toBe(true);
    expect(Array.isArray(behavior.postconditions)).toBe(true);
    expect(Array.isArray(behavior.invariants)).toBe(true);
    expect(Array.isArray(behavior.temporal)).toBe(true);
    expect(Array.isArray(behavior.security)).toBe(true);
    expect(Array.isArray(behavior.compliance)).toBe(true);
  });
});
