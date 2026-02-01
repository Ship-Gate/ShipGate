/**
 * ISL Diff Engine Tests
 *
 * Tests for the deterministic diff engine.
 */

import { describe, it, expect } from 'vitest';
import { diffSpec } from '../diff.js';
import { formatDiff, formatDiffOneLine, formatDiffJson } from '../formatDiff.js';
import type { Domain, Entity, Behavior, Field, Identifier, StringLiteral, SourceLocation } from '@isl-lang/parser';

// ============================================================================
// TEST HELPERS
// ============================================================================

function loc(): SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function id(name: string): Identifier {
  return { kind: 'Identifier', name, location: loc() };
}

function str(value: string): StringLiteral {
  return { kind: 'StringLiteral', value, location: loc() };
}

function field(name: string, typeName: string, optional = false): Field {
  return {
    kind: 'Field',
    name: id(name),
    type: { kind: 'PrimitiveType', name: typeName as 'String', location: loc() },
    optional,
    annotations: [],
    location: loc(),
  };
}

function entity(name: string, fields: Field[] = []): Entity {
  return {
    kind: 'Entity',
    name: id(name),
    fields,
    invariants: [],
    location: loc(),
  };
}

function behavior(
  name: string,
  options: {
    inputFields?: Field[];
    preconditions?: string[];
  } = {}
): Behavior {
  const preconds = (options.preconditions ?? []).map((p) => ({
    kind: 'Identifier' as const,
    name: p,
    location: loc(),
  }));

  return {
    kind: 'Behavior',
    name: id(name),
    input: { kind: 'InputSpec', fields: options.inputFields ?? [], location: loc() },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
      errors: [],
      location: loc(),
    },
    preconditions: preconds,
    postconditions: [],
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location: loc(),
  };
}

function domain(
  name: string,
  version: string,
  entities: Entity[] = [],
  behaviors: Behavior[] = []
): Domain {
  return {
    kind: 'Domain',
    name: id(name),
    version: str(version),
    imports: [],
    types: [],
    entities,
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  };
}

// ============================================================================
// BASIC DIFF TESTS
// ============================================================================

describe('diffSpec', () => {
  describe('empty domains', () => {
    it('should return empty diff for identical domains', () => {
      const d1 = domain('Test', '1.0.0');
      const d2 = domain('Test', '1.0.0');

      const diff = diffSpec(d1, d2);

      expect(diff.isEmpty).toBe(true);
      expect(diff.domainName).toBe('Test');
      expect(diff.entityDiffs).toHaveLength(0);
      expect(diff.behaviorDiffs).toHaveLength(0);
      expect(diff.typeDiffs).toHaveLength(0);
    });

    it('should detect version change', () => {
      const d1 = domain('Test', '1.0.0');
      const d2 = domain('Test', '2.0.0');

      const diff = diffSpec(d1, d2);

      expect(diff.versionChange).toBeDefined();
      expect(diff.versionChange?.oldVersion).toBe('1.0.0');
      expect(diff.versionChange?.newVersion).toBe('2.0.0');
    });
  });

  describe('entity diffs', () => {
    it('should detect added entity', () => {
      const d1 = domain('Test', '1.0.0');
      const d2 = domain('Test', '1.0.0', [entity('User')]);

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(1);
      expect(diff.entityDiffs[0].name).toBe('User');
      expect(diff.entityDiffs[0].change).toBe('added');
      expect(diff.entityDiffs[0].severity).toBe('compatible');
      expect(diff.summary.entitiesAdded).toBe(1);
    });

    it('should detect removed entity', () => {
      const d1 = domain('Test', '1.0.0', [entity('User')]);
      const d2 = domain('Test', '1.0.0');

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(1);
      expect(diff.entityDiffs[0].name).toBe('User');
      expect(diff.entityDiffs[0].change).toBe('removed');
      expect(diff.entityDiffs[0].severity).toBe('breaking');
      expect(diff.summary.entitiesRemoved).toBe(1);
    });

    it('should detect added field in entity', () => {
      const d1 = domain('Test', '1.0.0', [entity('User', [field('id', 'UUID')])]);
      const d2 = domain('Test', '1.0.0', [
        entity('User', [field('id', 'UUID'), field('email', 'String')]),
      ]);

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(1);
      expect(diff.entityDiffs[0].change).toBe('changed');
      expect(diff.entityDiffs[0].fieldChanges).toHaveLength(1);
      expect(diff.entityDiffs[0].fieldChanges[0].name).toBe('email');
      expect(diff.entityDiffs[0].fieldChanges[0].change).toBe('added');
    });

    it('should detect removed field in entity', () => {
      const d1 = domain('Test', '1.0.0', [
        entity('User', [field('id', 'UUID'), field('email', 'String')]),
      ]);
      const d2 = domain('Test', '1.0.0', [entity('User', [field('id', 'UUID')])]);

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(1);
      expect(diff.entityDiffs[0].change).toBe('changed');
      expect(diff.entityDiffs[0].fieldChanges).toHaveLength(1);
      expect(diff.entityDiffs[0].fieldChanges[0].name).toBe('email');
      expect(diff.entityDiffs[0].fieldChanges[0].change).toBe('removed');
      expect(diff.entityDiffs[0].severity).toBe('breaking');
    });

    it('should detect field type change', () => {
      const d1 = domain('Test', '1.0.0', [entity('User', [field('age', 'String')])]);
      const d2 = domain('Test', '1.0.0', [entity('User', [field('age', 'Int')])]);

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(1);
      expect(diff.entityDiffs[0].fieldChanges).toHaveLength(1);
      expect(diff.entityDiffs[0].fieldChanges[0].change).toBe('changed');
      expect(diff.entityDiffs[0].fieldChanges[0].oldType).toBe('String');
      expect(diff.entityDiffs[0].fieldChanges[0].newType).toBe('Int');
      expect(diff.entityDiffs[0].severity).toBe('breaking');
    });

    it('should detect optional to required change as breaking', () => {
      const d1 = domain('Test', '1.0.0', [entity('User', [field('email', 'String', true)])]);
      const d2 = domain('Test', '1.0.0', [entity('User', [field('email', 'String', false)])]);

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(1);
      expect(diff.entityDiffs[0].fieldChanges).toHaveLength(1);
      expect(diff.entityDiffs[0].fieldChanges[0].oldOptional).toBe(true);
      expect(diff.entityDiffs[0].fieldChanges[0].newOptional).toBe(false);
      expect(diff.entityDiffs[0].severity).toBe('breaking');
    });
  });

  describe('behavior diffs', () => {
    it('should detect added behavior', () => {
      const d1 = domain('Test', '1.0.0');
      const d2 = domain('Test', '1.0.0', [], [behavior('CreateUser')]);

      const diff = diffSpec(d1, d2);

      expect(diff.behaviorDiffs).toHaveLength(1);
      expect(diff.behaviorDiffs[0].name).toBe('CreateUser');
      expect(diff.behaviorDiffs[0].change).toBe('added');
      expect(diff.behaviorDiffs[0].severity).toBe('compatible');
      expect(diff.summary.behaviorsAdded).toBe(1);
    });

    it('should detect removed behavior', () => {
      const d1 = domain('Test', '1.0.0', [], [behavior('CreateUser')]);
      const d2 = domain('Test', '1.0.0');

      const diff = diffSpec(d1, d2);

      expect(diff.behaviorDiffs).toHaveLength(1);
      expect(diff.behaviorDiffs[0].name).toBe('CreateUser');
      expect(diff.behaviorDiffs[0].change).toBe('removed');
      expect(diff.behaviorDiffs[0].severity).toBe('breaking');
      expect(diff.summary.behaviorsRemoved).toBe(1);
    });

    it('should detect added input field', () => {
      const d1 = domain('Test', '1.0.0', [], [behavior('CreateUser')]);
      const d2 = domain('Test', '1.0.0', [], [
        behavior('CreateUser', { inputFields: [field('email', 'String')] }),
      ]);

      const diff = diffSpec(d1, d2);

      expect(diff.behaviorDiffs).toHaveLength(1);
      expect(diff.behaviorDiffs[0].inputDiff.changed).toBe(true);
      expect(diff.behaviorDiffs[0].inputDiff.fieldChanges).toHaveLength(1);
      expect(diff.behaviorDiffs[0].inputDiff.fieldChanges[0].name).toBe('email');
      expect(diff.behaviorDiffs[0].inputDiff.fieldChanges[0].change).toBe('added');
      // Adding required input is breaking
      expect(diff.behaviorDiffs[0].severity).toBe('breaking');
    });

    it('should detect added precondition as breaking', () => {
      const d1 = domain('Test', '1.0.0', [], [behavior('CreateUser')]);
      const d2 = domain('Test', '1.0.0', [], [
        behavior('CreateUser', { preconditions: ['input.email.is_valid'] }),
      ]);

      const diff = diffSpec(d1, d2);

      expect(diff.behaviorDiffs).toHaveLength(1);
      expect(diff.behaviorDiffs[0].preconditionChanges).toHaveLength(1);
      expect(diff.behaviorDiffs[0].preconditionChanges[0].change).toBe('added');
      expect(diff.behaviorDiffs[0].severity).toBe('breaking');
    });
  });

  describe('determinism', () => {
    it('should produce identical diffs for same inputs', () => {
      const d1 = domain('Test', '1.0.0', [
        entity('Zebra', [field('id', 'UUID')]),
        entity('Apple', [field('id', 'UUID')]),
      ]);
      const d2 = domain('Test', '1.0.0', [
        entity('Apple', [field('id', 'UUID'), field('name', 'String')]),
        entity('Mango', [field('id', 'UUID')]),
      ]);

      // Run multiple times
      const diff1 = diffSpec(d1, d2);
      const diff2 = diffSpec(d1, d2);
      const diff3 = diffSpec(d1, d2);

      // Stringify to compare
      const json1 = JSON.stringify(diff1);
      const json2 = JSON.stringify(diff2);
      const json3 = JSON.stringify(diff3);

      expect(json1).toBe(json2);
      expect(json2).toBe(json3);
    });

    it('should sort entity diffs by name', () => {
      const d1 = domain('Test', '1.0.0');
      const d2 = domain('Test', '1.0.0', [
        entity('Zebra'),
        entity('Apple'),
        entity('Mango'),
      ]);

      const diff = diffSpec(d1, d2);

      expect(diff.entityDiffs).toHaveLength(3);
      expect(diff.entityDiffs[0].name).toBe('Apple');
      expect(diff.entityDiffs[1].name).toBe('Mango');
      expect(diff.entityDiffs[2].name).toBe('Zebra');
    });

    it('should sort behavior diffs by name', () => {
      const d1 = domain('Test', '1.0.0');
      const d2 = domain('Test', '1.0.0', [], [
        behavior('DeleteUser'),
        behavior('CreateUser'),
        behavior('UpdateUser'),
      ]);

      const diff = diffSpec(d1, d2);

      expect(diff.behaviorDiffs).toHaveLength(3);
      expect(diff.behaviorDiffs[0].name).toBe('CreateUser');
      expect(diff.behaviorDiffs[1].name).toBe('DeleteUser');
      expect(diff.behaviorDiffs[2].name).toBe('UpdateUser');
    });
  });

  describe('summary calculation', () => {
    it('should calculate correct summary', () => {
      const d1 = domain('Test', '1.0.0', [entity('User')], [behavior('Login')]);
      const d2 = domain('Test', '1.0.0', [entity('Admin')], [
        behavior('Login'),
        behavior('Logout'),
      ]);

      const diff = diffSpec(d1, d2);

      expect(diff.summary.entitiesAdded).toBe(1);
      expect(diff.summary.entitiesRemoved).toBe(1);
      expect(diff.summary.entitiesChanged).toBe(0);
      expect(diff.summary.behaviorsAdded).toBe(1);
      expect(diff.summary.behaviorsRemoved).toBe(0);
      expect(diff.summary.totalChanges).toBe(3);
      expect(diff.summary.breakingChanges).toBe(1); // User removed
      expect(diff.summary.compatibleChanges).toBe(2); // Admin + Logout added
    });
  });
});

// ============================================================================
// FORMAT TESTS
// ============================================================================

describe('formatDiff', () => {
  it('should format empty diff', () => {
    const d1 = domain('Test', '1.0.0');
    const diff = diffSpec(d1, d1);

    const output = formatDiff(diff);

    expect(output).toContain('No changes detected');
  });

  it('should format entity additions', () => {
    const d1 = domain('Test', '1.0.0');
    const d2 = domain('Test', '1.0.0', [entity('User')]);

    const diff = diffSpec(d1, d2);
    const output = formatDiff(diff, { colors: false });

    expect(output).toContain('+ entity User');
    expect(output).toContain('ENTITIES');
  });

  it('should format behavior changes', () => {
    const d1 = domain('Test', '1.0.0', [], [behavior('CreateUser')]);
    const d2 = domain('Test', '1.0.0');

    const diff = diffSpec(d1, d2);
    const output = formatDiff(diff, { colors: false });

    expect(output).toContain('- behavior CreateUser');
    expect(output).toContain('BEHAVIORS');
  });

  it('should include summary by default', () => {
    const d1 = domain('Test', '1.0.0');
    const d2 = domain('Test', '1.0.0', [entity('User')]);

    const diff = diffSpec(d1, d2);
    const output = formatDiff(diff, { colors: false });

    expect(output).toContain('SUMMARY');
    expect(output).toContain('Entities:');
  });

  it('should respect showSummary option', () => {
    const d1 = domain('Test', '1.0.0');
    const d2 = domain('Test', '1.0.0', [entity('User')]);

    const diff = diffSpec(d1, d2);
    const output = formatDiff(diff, { colors: false, showSummary: false });

    expect(output).not.toContain('SUMMARY');
  });
});

describe('formatDiffOneLine', () => {
  it('should format empty diff', () => {
    const d1 = domain('Test', '1.0.0');
    const diff = diffSpec(d1, d1);

    const output = formatDiffOneLine(diff);

    expect(output).toBe('No changes');
  });

  it('should format changes concisely', () => {
    const d1 = domain('Test', '1.0.0');
    const d2 = domain('Test', '1.0.0', [entity('User'), entity('Admin')], [behavior('Login')]);

    const diff = diffSpec(d1, d2);
    const output = formatDiffOneLine(diff);

    expect(output).toContain('Test:');
    expect(output).toContain('+2E');
    expect(output).toContain('+1B');
  });

  it('should show breaking changes indicator', () => {
    const d1 = domain('Test', '1.0.0', [entity('User')]);
    const d2 = domain('Test', '1.0.0');

    const diff = diffSpec(d1, d2);
    const output = formatDiffOneLine(diff);

    expect(output).toContain('[!1 breaking]');
  });
});

describe('formatDiffJson', () => {
  it('should produce valid JSON', () => {
    const d1 = domain('Test', '1.0.0');
    const d2 = domain('Test', '1.0.0', [entity('User')]);

    const diff = diffSpec(d1, d2);
    const json = formatDiffJson(diff);

    const parsed = JSON.parse(json);
    expect(parsed.domainName).toBe('Test');
    expect(parsed.entityDiffs).toHaveLength(1);
  });

  it('should produce compact JSON when not pretty', () => {
    const d1 = domain('Test', '1.0.0');
    const d2 = domain('Test', '1.0.0', [entity('User')]);

    const diff = diffSpec(d1, d2);
    const json = formatDiffJson(diff, false);

    expect(json).not.toContain('\n');
  });
});
