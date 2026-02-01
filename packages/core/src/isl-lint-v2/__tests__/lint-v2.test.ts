/**
 * ISL Linter V2 - Tests
 *
 * Tests for lint rules, severity classification, and auto-fix functionality.
 */

import { describe, it, expect } from 'vitest';

import {
  lint,
  applyFix,
  applyFixes,
  getRules,
  getRule,
  formatLintResult,
  getDiagnosticsBySeverity,
  getFixableDiagnostics,
  getAutoFixableFixes,
  sortFixesByPriority,
  getBestFix,
  validateFix,
  previewPatch,
  patchFactory,
} from '../index.js';

import {
  fixture1_authMissingConstraints,
  fixture2_paymentMissingFraudCheck,
  fixture3_uploadMissingValidation,
  fixture4_missingPostconditions,
  fixture5_ambiguousActor,
  fixture6_impossibleConstraints,
  fixture7_missingErrorSpecs,
  fixture8_unconstrainedNumeric,
  fixture9_duplicatePreconditions,
  fixture10_missingTemporal,
  fixtureValid_wellFormed,
} from '../fixtures/index.js';

// ============================================================================
// Rule Tests
// ============================================================================

describe('ISL Lint V2 Rules', () => {
  describe('ISL2-001: Minimum Constraints Rule', () => {
    it('should detect auth behavior missing constraints', () => {
      const result = lint(fixture1_authMissingConstraints);

      expect(result.success).toBe(false);
      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-001');
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe('error');
      expect(diagnostics[0].message).toContain('auth');
    });

    it('should detect payment behavior missing fraud check', () => {
      const result = lint(fixture2_paymentMissingFraudCheck);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-001');
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message.toLowerCase()).toContain('payment');
      expect(diagnostics[0].message.toLowerCase()).toContain('fraud');
    });

    it('should detect upload behavior missing validation', () => {
      const result = lint(fixture3_uploadMissingValidation);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-001');
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('upload');
    });
  });

  describe('ISL2-002: Missing Postconditions Rule', () => {
    it('should detect critical behaviors without postconditions', () => {
      const result = lint(fixture4_missingPostconditions);

      expect(result.success).toBe(false);
      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-002');
      expect(diagnostics.length).toBe(2);
      expect(diagnostics[0].severity).toBe('error');
      expect(diagnostics[0].message).toContain('postconditions');
    });
  });

  describe('ISL2-003: Ambiguous Actor Rule', () => {
    it('should detect behaviors without actors', () => {
      const result = lint(fixture5_ambiguousActor);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-003');
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe('warning');
    });

    it('should detect actors without constraints', () => {
      const result = lint(fixture5_ambiguousActor);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-003');
      const constraintDiag = diagnostics.find((d) => d.message.includes('no constraints'));
      expect(constraintDiag).toBeDefined();
    });
  });

  describe('ISL2-004: Impossible Constraints Rule', () => {
    it('should detect self-comparison inequality', () => {
      const result = lint(fixture6_impossibleConstraints);

      expect(result.success).toBe(false);
      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-004');
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe('error');
      expect(diagnostics[0].message).toContain('always false');
    });

    it('should detect contradictory numeric comparisons', () => {
      const result = lint(fixture6_impossibleConstraints);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-004');
      const numericDiag = diagnostics.find((d) => d.message.includes('5 < 3'));
      expect(numericDiag).toBeDefined();
    });
  });

  describe('ISL2-005: Missing Error Specifications Rule', () => {
    it('should detect behaviors without error specs', () => {
      const result = lint(fixture7_missingErrorSpecs);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-005');
      expect(diagnostics.length).toBe(2);
      expect(diagnostics[0].severity).toBe('warning');
      expect(diagnostics[0].message).toContain('no error specifications');
    });
  });

  describe('ISL2-006: Unconstrained Numeric Input Rule', () => {
    it('should detect numeric inputs without validation', () => {
      const result = lint(fixture8_unconstrainedNumeric);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-006');
      expect(diagnostics.length).toBe(2);
      expect(diagnostics[0].severity).toBe('warning');
      expect(diagnostics.some((d) => d.message.includes('price'))).toBe(true);
      expect(diagnostics.some((d) => d.message.includes('quantity'))).toBe(true);
    });
  });

  describe('ISL2-007: Duplicate Preconditions Rule', () => {
    it('should detect duplicate preconditions', () => {
      const result = lint(fixture9_duplicatePreconditions);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-007');
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].severity).toBe('info');
      expect(diagnostics[0].message).toContain('Duplicate');
    });
  });

  describe('ISL2-008: Missing Temporal Constraints Rule', () => {
    it('should detect async behaviors without temporal constraints', () => {
      const result = lint(fixture10_missingTemporal);

      const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'ISL2-008');
      expect(diagnostics.length).toBe(2);
      expect(diagnostics[0].severity).toBe('hint');
      expect(diagnostics[0].message).toContain('temporal');
    });
  });

  describe('Valid domain', () => {
    it('should pass all rules for well-formed domain', () => {
      const result = lint(fixtureValid_wellFormed);

      // May have hints but no errors
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.length).toBe(0);
    });
  });
});

// ============================================================================
// Severity Classification Tests
// ============================================================================

describe('Severity Classification', () => {
  it('should classify ISL2-001 (minimum constraints) as error', () => {
    const rule = getRule('ISL2-001');
    expect(rule?.severity).toBe('error');
  });

  it('should classify ISL2-002 (missing postconditions) as error', () => {
    const rule = getRule('ISL2-002');
    expect(rule?.severity).toBe('error');
  });

  it('should classify ISL2-003 (ambiguous actor) as warning', () => {
    const rule = getRule('ISL2-003');
    expect(rule?.severity).toBe('warning');
  });

  it('should classify ISL2-004 (impossible constraints) as error', () => {
    const rule = getRule('ISL2-004');
    expect(rule?.severity).toBe('error');
  });

  it('should classify ISL2-007 (duplicate preconditions) as info', () => {
    const rule = getRule('ISL2-007');
    expect(rule?.severity).toBe('info');
  });

  it('should classify ISL2-008 (missing temporal) as hint', () => {
    const rule = getRule('ISL2-008');
    expect(rule?.severity).toBe('hint');
  });
});

// ============================================================================
// Auto-Fix Tests
// ============================================================================

describe('Auto-Fix Functionality', () => {
  describe('Fix Generation', () => {
    it('should generate fixes for auth missing constraints', () => {
      const result = lint(fixture1_authMissingConstraints, { includeFixes: true });

      const diagnosticsWithFixes = getFixableDiagnostics(result);
      expect(diagnosticsWithFixes.length).toBeGreaterThan(0);

      const firstDiag = diagnosticsWithFixes[0];
      expect(firstDiag.fixes).toBeDefined();
      expect(firstDiag.fixes!.length).toBeGreaterThan(0);
    });

    it('should generate fixes for missing postconditions', () => {
      const result = lint(fixture4_missingPostconditions, { includeFixes: true });

      const diagnosticsWithFixes = result.diagnostics.filter(
        (d) => d.ruleId === 'ISL2-002' && d.fixes && d.fixes.length > 0
      );
      expect(diagnosticsWithFixes.length).toBe(2);
    });

    it('should generate multiple fix alternatives for ambiguous actors', () => {
      const result = lint(fixture5_ambiguousActor, { includeFixes: true });

      const actorDiag = result.diagnostics.find(
        (d) => d.ruleId === 'ISL2-003' && d.message.includes('approveTransaction')
      );
      expect(actorDiag?.fixes).toBeDefined();
      expect(actorDiag!.fixes!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Fix Application', () => {
    it('should apply a fix and return modified AST', () => {
      const result = lint(fixture4_missingPostconditions, { includeFixes: true });
      const diagnostic = result.diagnostics.find((d) => d.fixes && d.fixes.length > 0);

      expect(diagnostic).toBeDefined();
      expect(diagnostic!.fixes).toBeDefined();

      const fix = diagnostic!.fixes![0];
      const applyResult = applyFix(fixture4_missingPostconditions, fix);

      expect(applyResult.success).toBe(true);
      expect(applyResult.ast).toBeDefined();
      expect(applyResult.appliedPatches.length).toBeGreaterThan(0);
    });

    it('should preserve original AST when applying fixes', () => {
      const original = fixture4_missingPostconditions;
      const originalPostconditions = original.behaviors[0].postconditions.length;

      const result = lint(original, { includeFixes: true });
      const diagnostic = result.diagnostics.find((d) => d.fixes && d.fixes.length > 0);

      if (diagnostic?.fixes?.[0]) {
        applyFix(original, diagnostic.fixes[0]);
        expect(original.behaviors[0].postconditions.length).toBe(originalPostconditions);
      }
    });

    it('should apply multiple fixes in sequence', () => {
      const result = lint(fixture4_missingPostconditions, { includeFixes: true });
      const fixes = result.diagnostics.filter((d) => d.fixes && d.fixes.length > 0).flatMap((d) => d.fixes!);

      if (fixes.length >= 2) {
        const applyResult = applyFixes(fixture4_missingPostconditions, fixes.slice(0, 2));
        expect(applyResult.appliedPatches.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Fix Utilities', () => {
    it('should sort fixes by priority', () => {
      const result = lint(fixture1_authMissingConstraints, { includeFixes: true });
      const allFixes = result.diagnostics.flatMap((d) => d.fixes ?? []);

      const sorted = sortFixesByPriority(allFixes);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].priority).toBeLessThanOrEqual(sorted[i - 1].priority);
      }
    });

    it('should get best fix (highest priority)', () => {
      const result = lint(fixture5_ambiguousActor, { includeFixes: true });
      const actorDiag = result.diagnostics.find((d) => d.fixes && d.fixes.length > 1);

      if (actorDiag?.fixes) {
        const best = getBestFix(actorDiag.fixes);
        expect(best).toBeDefined();
        expect(best!.priority).toBe(Math.max(...actorDiag.fixes.map((f) => f.priority)));
      }
    });

    it('should validate fix structure', () => {
      const result = lint(fixture4_missingPostconditions, { includeFixes: true });
      const diagnostic = result.diagnostics.find((d) => d.fixes && d.fixes.length > 0);

      if (diagnostic?.fixes?.[0]) {
        const validation = validateFix(diagnostic.fixes[0]);
        expect(validation.valid).toBe(true);
        expect(validation.errors.length).toBe(0);
      }
    });

    it('should preview patch without applying', () => {
      const result = lint(fixture4_missingPostconditions, { includeFixes: true });
      const diagnostic = result.diagnostics.find((d) => d.fixes && d.fixes.length > 0);

      if (diagnostic?.fixes?.[0]?.patches?.[0]) {
        const preview = previewPatch(fixture4_missingPostconditions, diagnostic.fixes[0].patches[0]);
        expect(preview.path).toBeDefined();
        expect(preview.proposedChange).toBeDefined();
      }
    });
  });
});

// ============================================================================
// Lint Options Tests
// ============================================================================

describe('Lint Options', () => {
  it('should respect minSeverity option', () => {
    const resultAll = lint(fixture10_missingTemporal, { minSeverity: 'hint' });
    const resultErrorsOnly = lint(fixture10_missingTemporal, { minSeverity: 'error' });

    expect(resultAll.diagnostics.length).toBeGreaterThan(resultErrorsOnly.diagnostics.length);
  });

  it('should respect includeCategories option', () => {
    const resultSafety = lint(fixture1_authMissingConstraints, { includeCategories: ['safety'] });
    const resultAll = lint(fixture1_authMissingConstraints);

    expect(resultSafety.diagnostics.every((d) => d.category === 'safety')).toBe(true);
    expect(resultAll.diagnostics.length).toBeGreaterThanOrEqual(resultSafety.diagnostics.length);
  });

  it('should respect includeTags option', () => {
    const result = lint(fixture1_authMissingConstraints, { includeTags: ['security'] });

    expect(result.diagnostics.every((d) => d.tags?.includes('security'))).toBe(true);
  });

  it('should respect rule disabling', () => {
    const resultEnabled = lint(fixture1_authMissingConstraints);
    const resultDisabled = lint(fixture1_authMissingConstraints, {
      rules: { 'ISL2-001': false },
    });

    expect(
      resultEnabled.diagnostics.filter((d) => d.ruleId === 'ISL2-001').length
    ).toBeGreaterThan(
      resultDisabled.diagnostics.filter((d) => d.ruleId === 'ISL2-001').length
    );
  });

  it('should allow severity override', () => {
    const result = lint(fixture10_missingTemporal, {
      rules: { 'ISL2-008': { enabled: true, severity: 'error' } },
    });

    const temporalDiags = result.diagnostics.filter((d) => d.ruleId === 'ISL2-008');
    expect(temporalDiags.every((d) => d.severity === 'error')).toBe(true);
  });

  it('should respect includeFixes option', () => {
    const withFixes = lint(fixture4_missingPostconditions, { includeFixes: true });
    const withoutFixes = lint(fixture4_missingPostconditions, { includeFixes: false });

    expect(withFixes.fixableCount).toBeGreaterThan(0);
    expect(withoutFixes.fixableCount).toBe(0);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  it('should get all rules', () => {
    const rules = getRules();
    expect(rules.length).toBe(8);
  });

  it('should get rule by ID', () => {
    const rule = getRule('ISL2-001');
    expect(rule).toBeDefined();
    expect(rule?.name).toBe('minimum-constraints');
  });

  it('should get rule by name', () => {
    const rule = getRule('ambiguous-actor');
    expect(rule).toBeDefined();
    expect(rule?.id).toBe('ISL2-003');
  });

  it('should filter diagnostics by severity', () => {
    const result = lint(fixture1_authMissingConstraints);
    const errors = getDiagnosticsBySeverity(result, 'error');

    expect(errors.every((d) => d.severity === 'error')).toBe(true);
  });

  it('should format lint result as string', () => {
    const result = lint(fixture1_authMissingConstraints);
    const formatted = formatLintResult(result);

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain('Summary');
  });

  it('should format lint result with color', () => {
    const result = lint(fixture1_authMissingConstraints);
    const formatted = formatLintResult(result, { color: true });

    expect(formatted).toContain('\x1b['); // ANSI escape sequence
  });
});

// ============================================================================
// Patch Factory Tests
// ============================================================================

describe('Patch Factory', () => {
  it('should create insert patch', () => {
    const patch = patchFactory.insert(
      'behaviors[0].postconditions',
      { kind: 'PostconditionBlock', condition: 'success', predicates: [], location: {} as any },
      'last',
      'Add postcondition'
    );

    expect(patch.type).toBe('insert');
    expect(patch.position).toBe('last');
    expect(patch.targetPath).toBe('behaviors[0].postconditions');
  });

  it('should create replace patch', () => {
    const patch = patchFactory.replace(
      'behaviors[0].name',
      { kind: 'Identifier', name: 'newName', location: {} as any },
      'Rename behavior'
    );

    expect(patch.type).toBe('replace');
    expect(patch.targetPath).toBe('behaviors[0].name');
  });

  it('should create remove patch', () => {
    const patch = patchFactory.remove('behaviors[0].preconditions', 'Remove precondition', 0);

    expect(patch.type).toBe('remove');
    expect(patch.index).toBe(0);
  });

  it('should create modify patch', () => {
    const patch = patchFactory.modify('behaviors[0]', { description: 'New description' }, 'Update description');

    expect(patch.type).toBe('modify');
    expect(patch.properties).toEqual({ description: 'New description' });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty domain', () => {
    const emptyDomain = {
      kind: 'Domain' as const,
      name: { kind: 'Identifier' as const, name: 'Empty', location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 } },
      version: { kind: 'StringLiteral' as const, value: '1.0.0', location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 } },
      imports: [],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 },
    };

    const result = lint(emptyDomain);
    expect(result.success).toBe(true);
    expect(result.diagnostics.length).toBe(0);
  });

  it('should handle behavior with null actors', () => {
    const domain = {
      ...fixtureValid_wellFormed,
      behaviors: [
        {
          ...fixtureValid_wellFormed.behaviors[0],
          actors: undefined as any,
        },
      ],
    };

    expect(() => lint(domain)).not.toThrow();
  });

  it('should report timing information', () => {
    const result = lint(fixture1_authMissingConstraints);
    expect(result.durationMs).toBeDefined();
    expect(typeof result.durationMs).toBe('number');
  });
});
