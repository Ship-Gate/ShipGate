/**
 * ISL Semantic Linter - Tests
 */

import { describe, it, expect } from 'vitest';
import type { Domain, Behavior, Entity, Expression, SourceLocation } from '@isl-lang/parser';
import {
  lint,
  formatLintResult,
  getRules,
  getRule,
  missingPostconditionsRule,
  ambiguousActorRule,
  securitySensitiveNoConstraintsRule,
  impossibleConstraintsRule,
} from '../index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createLocation(line = 1, column = 1): SourceLocation {
  return {
    file: 'test.isl',
    line,
    column,
    endLine: line,
    endColumn: column + 10,
  };
}

function createIdentifier(name: string, location?: SourceLocation) {
  return {
    kind: 'Identifier' as const,
    name,
    location: location ?? createLocation(),
  };
}

function createStringLiteral(value: string, location?: SourceLocation) {
  return {
    kind: 'StringLiteral' as const,
    value,
    location: location ?? createLocation(),
  };
}

function createMinimalDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    kind: 'Domain',
    name: createIdentifier('TestDomain'),
    version: createStringLiteral('1.0.0'),
    imports: [],
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: createLocation(),
    ...overrides,
  };
}

function createMinimalBehavior(name: string, overrides: Partial<Behavior> = {}): Behavior {
  return {
    kind: 'Behavior',
    name: createIdentifier(name),
    input: { kind: 'InputSpec', fields: [], location: createLocation() },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'Boolean', location: createLocation() },
      errors: [],
      location: createLocation(),
    },
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location: createLocation(),
    ...overrides,
  };
}

function createMinimalEntity(name: string, overrides: Partial<Entity> = {}): Entity {
  return {
    kind: 'Entity',
    name: createIdentifier(name),
    fields: [],
    invariants: [],
    location: createLocation(),
    ...overrides,
  };
}

// ============================================================================
// Basic Lint Function Tests
// ============================================================================

describe('lint', () => {
  it('returns success for empty domain', () => {
    const domain = createMinimalDomain();
    const result = lint(domain);
    
    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.domainName).toBe('TestDomain');
  });

  it('includes duration in results', () => {
    const domain = createMinimalDomain();
    const result = lint(domain);
    
    expect(result.durationMs).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('respects minSeverity option', () => {
    const domain = createMinimalDomain({
      behaviors: [createMinimalBehavior('CreateUser')], // Will trigger ISL001
    });
    
    // With default (all severities)
    const resultAll = lint(domain);
    
    // With minSeverity = error (should skip warnings)
    const resultErrorOnly = lint(domain, { minSeverity: 'error' });
    
    // ISL001 is a warning, so it should be filtered out
    expect(resultErrorOnly.diagnostics.filter(d => d.ruleId === 'ISL001')).toHaveLength(0);
  });

  it('respects rule enable/disable', () => {
    const domain = createMinimalDomain({
      behaviors: [createMinimalBehavior('CreateUser')],
    });
    
    // Disable ISL001
    const result = lint(domain, {
      rules: { 'ISL001': false },
    });
    
    expect(result.diagnostics.filter(d => d.ruleId === 'ISL001')).toHaveLength(0);
    expect(result.skippedRules).toContain('ISL001');
  });

  it('respects category filters', () => {
    const domain = createMinimalDomain({
      behaviors: [createMinimalBehavior('CreateUser')],
    });
    
    // Only include 'safety' category
    const result = lint(domain, {
      includeCategories: ['safety'],
    });
    
    // ISL001 is 'completeness', should be excluded
    expect(result.diagnostics.filter(d => d.category === 'completeness')).toHaveLength(0);
  });
});

// ============================================================================
// Rule: Missing Postconditions (ISL001)
// ============================================================================

describe('ISL001: missing-postconditions', () => {
  it('detects missing postconditions on critical behaviors', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('CreateUser'),
        createMinimalBehavior('UpdateOrder'),
        createMinimalBehavior('DeleteAccount'),
        createMinimalBehavior('TransferFunds'),
      ],
    });
    
    const result = lint(domain);
    const isl001 = result.diagnostics.filter(d => d.ruleId === 'ISL001');
    
    expect(isl001).toHaveLength(4);
    expect(isl001.map(d => d.elementName)).toEqual([
      'CreateUser',
      'UpdateOrder',
      'DeleteAccount',
      'TransferFunds',
    ]);
  });

  it('passes when postconditions are present', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('CreateUser', {
          postconditions: [{
            kind: 'PostconditionBlock',
            condition: 'success',
            predicates: [{
              kind: 'BinaryExpr',
              operator: '!=',
              left: createIdentifier('result'),
              right: { kind: 'NullLiteral', location: createLocation() },
              location: createLocation(),
            }],
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl001 = result.diagnostics.filter(d => d.ruleId === 'ISL001');
    
    expect(isl001).toHaveLength(0);
  });

  it('ignores non-critical behaviors', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('GetUserProfile'),
        createMinimalBehavior('ListOrders'),
        createMinimalBehavior('SearchProducts'),
      ],
    });
    
    const result = lint(domain);
    const isl001 = result.diagnostics.filter(d => d.ruleId === 'ISL001');
    
    expect(isl001).toHaveLength(0);
  });
});

// ============================================================================
// Rule: Ambiguous Actor (ISL002)
// ============================================================================

describe('ISL002: ambiguous-actor', () => {
  it('detects missing actors on security-sensitive behaviors', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('AuthenticateUser'),
        createMinimalBehavior('ProcessPayment'),
        createMinimalBehavior('AdminApproveRequest'),
      ],
    });
    
    const result = lint(domain);
    const isl002 = result.diagnostics.filter(d => d.ruleId === 'ISL002');
    
    expect(isl002.length).toBeGreaterThanOrEqual(3);
  });

  it('detects actors without constraints', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('ProcessPayment', {
          actors: [{
            kind: 'ActorSpec',
            name: createIdentifier('User'),
            constraints: [], // No constraints!
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl002 = result.diagnostics.filter(d => d.ruleId === 'ISL002');
    
    expect(isl002.length).toBeGreaterThanOrEqual(1);
    expect(isl002.some(d => d.message.includes('no constraints'))).toBe(true);
  });

  it('passes when actors have constraints', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('ProcessPayment', {
          actors: [{
            kind: 'ActorSpec',
            name: createIdentifier('User'),
            constraints: [{
              kind: 'Identifier',
              name: 'authenticated',
              location: createLocation(),
            }],
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl002 = result.diagnostics.filter(d => 
      d.ruleId === 'ISL002' && d.message.includes('no constraints')
    );
    
    expect(isl002).toHaveLength(0);
  });
});

// ============================================================================
// Rule: Security-Sensitive No Constraints (ISL003)
// ============================================================================

describe('ISL003: security-sensitive-no-constraints', () => {
  it('detects auth behaviors without security constraints', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('Login'),
        createMinimalBehavior('Authenticate'),
        createMinimalBehavior('ResetPassword'),
      ],
    });
    
    const result = lint(domain);
    const isl003 = result.diagnostics.filter(d => d.ruleId === 'ISL003');
    
    expect(isl003.length).toBeGreaterThanOrEqual(3);
    expect(isl003.every(d => d.severity === 'error')).toBe(true);
  });

  it('detects payment behaviors without security constraints', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('ProcessPayment'),
        createMinimalBehavior('TransferMoney'),
        createMinimalBehavior('Refund'),
      ],
    });
    
    const result = lint(domain);
    const isl003 = result.diagnostics.filter(d => d.ruleId === 'ISL003');
    
    expect(isl003.length).toBeGreaterThanOrEqual(3);
  });

  it('detects upload behaviors without security constraints', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('UploadFile'),
        createMinimalBehavior('DownloadAttachment'),
        createMinimalBehavior('ExportData'),
      ],
    });
    
    const result = lint(domain);
    const isl003 = result.diagnostics.filter(d => d.ruleId === 'ISL003');
    
    expect(isl003.length).toBeGreaterThanOrEqual(3);
  });

  it('passes when preconditions are present', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('ProcessPayment', {
          preconditions: [{
            kind: 'BinaryExpr',
            operator: '>',
            left: {
              kind: 'MemberExpr',
              object: createIdentifier('input'),
              property: createIdentifier('amount'),
              location: createLocation(),
            },
            right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createLocation() },
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl003 = result.diagnostics.filter(d => d.ruleId === 'ISL003');
    
    expect(isl003).toHaveLength(0);
  });

  it('passes when security specs are present', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('Login', {
          security: [{
            kind: 'SecuritySpec',
            type: 'rate_limit',
            details: createStringLiteral('5 per minute'),
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl003 = result.diagnostics.filter(d => d.ruleId === 'ISL003');
    
    expect(isl003).toHaveLength(0);
  });

  it('passes when actor constraints are present', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('ProcessPayment', {
          actors: [{
            kind: 'ActorSpec',
            name: createIdentifier('User'),
            constraints: [createIdentifier('authenticated')],
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl003 = result.diagnostics.filter(d => d.ruleId === 'ISL003');
    
    expect(isl003).toHaveLength(0);
  });
});

// ============================================================================
// Rule: Impossible Constraints (ISL004)
// ============================================================================

describe('ISL004: impossible-constraints', () => {
  it('detects x != x pattern', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('TestBehavior', {
          preconditions: [{
            kind: 'BinaryExpr',
            operator: '!=',
            left: createIdentifier('x'),
            right: createIdentifier('x'),
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl004 = result.diagnostics.filter(d => d.ruleId === 'ISL004');
    
    expect(isl004).toHaveLength(1);
    expect(isl004[0].message).toContain('always false');
  });

  it('detects x < x pattern', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('TestBehavior', {
          preconditions: [{
            kind: 'BinaryExpr',
            operator: '<',
            left: createIdentifier('value'),
            right: createIdentifier('value'),
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl004 = result.diagnostics.filter(d => d.ruleId === 'ISL004');
    
    expect(isl004).toHaveLength(1);
  });

  it('detects contradictory numeric comparisons (5 == 3)', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('TestBehavior', {
          preconditions: [{
            kind: 'BinaryExpr',
            operator: '==',
            left: { kind: 'NumberLiteral', value: 5, isFloat: false, location: createLocation() },
            right: { kind: 'NumberLiteral', value: 3, isFloat: false, location: createLocation() },
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl004 = result.diagnostics.filter(d => d.ruleId === 'ISL004');
    
    expect(isl004).toHaveLength(1);
    expect(isl004[0].message).toContain('5 == 3');
  });

  it('detects contradictory "and" conditions (x > 5 and x < 3)', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('TestBehavior', {
          preconditions: [{
            kind: 'BinaryExpr',
            operator: 'and',
            left: {
              kind: 'BinaryExpr',
              operator: '>',
              left: createIdentifier('x'),
              right: { kind: 'NumberLiteral', value: 5, isFloat: false, location: createLocation() },
              location: createLocation(),
            },
            right: {
              kind: 'BinaryExpr',
              operator: '<',
              left: createIdentifier('x'),
              right: { kind: 'NumberLiteral', value: 3, isFloat: false, location: createLocation() },
              location: createLocation(),
            },
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl004 = result.diagnostics.filter(d => d.ruleId === 'ISL004');
    
    expect(isl004).toHaveLength(1);
    expect(isl004[0].message).toContain('Contradictory');
  });

  it('detects impossible invariants in entities', () => {
    const domain = createMinimalDomain({
      entities: [
        createMinimalEntity('User', {
          invariants: [{
            kind: 'BinaryExpr',
            operator: '!=',
            left: createIdentifier('id'),
            right: createIdentifier('id'),
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl004 = result.diagnostics.filter(d => d.ruleId === 'ISL004');
    
    expect(isl004).toHaveLength(1);
    expect(isl004[0].elementName).toBe('User');
  });

  it('passes for valid constraints', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createMinimalBehavior('TestBehavior', {
          preconditions: [{
            kind: 'BinaryExpr',
            operator: '>',
            left: createIdentifier('amount'),
            right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createLocation() },
            location: createLocation(),
          }],
        }),
      ],
    });
    
    const result = lint(domain);
    const isl004 = result.diagnostics.filter(d => d.ruleId === 'ISL004');
    
    expect(isl004).toHaveLength(0);
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('formatLintResult', () => {
  it('formats empty result', () => {
    const domain = createMinimalDomain();
    const result = lint(domain);
    const formatted = formatLintResult(result);
    
    expect(formatted).toContain('No issues found');
  });

  it('formats result with issues', () => {
    const domain = createMinimalDomain({
      behaviors: [createMinimalBehavior('CreateUser')],
    });
    const result = lint(domain);
    const formatted = formatLintResult(result);
    
    expect(formatted).toContain('ISL001');
    expect(formatted).toContain('CreateUser');
    expect(formatted).toContain('Summary');
  });
});

describe('getRules', () => {
  it('returns all rules', () => {
    const rules = getRules();
    
    expect(rules.length).toBeGreaterThanOrEqual(4);
    expect(rules.some(r => r.id === 'ISL001')).toBe(true);
    expect(rules.some(r => r.id === 'ISL002')).toBe(true);
    expect(rules.some(r => r.id === 'ISL003')).toBe(true);
    expect(rules.some(r => r.id === 'ISL004')).toBe(true);
  });
});

describe('getRule', () => {
  it('gets rule by ID', () => {
    const rule = getRule('ISL001');
    
    expect(rule).toBeDefined();
    expect(rule?.id).toBe('ISL001');
    expect(rule?.name).toBe('missing-postconditions');
  });

  it('gets rule by name', () => {
    const rule = getRule('security-sensitive-no-constraints');
    
    expect(rule).toBeDefined();
    expect(rule?.id).toBe('ISL003');
  });

  it('returns undefined for unknown rule', () => {
    const rule = getRule('UNKNOWN');
    
    expect(rule).toBeUndefined();
  });
});
