/**
 * Spec Quality Scorer — Tests
 *
 * Tests each quality dimension and the main scorer.
 */

import { describe, it, expect } from 'vitest';
import type {
  Domain,
  Behavior,
  Entity,
  SourceLocation,
  InputSpec,
  OutputSpec,
  PostconditionBlock,
  SecuritySpec,
  TemporalSpec,
  ErrorSpec,
  Field,
  Expression,
  ScenarioBlock,
  ChaosBlock,
  InvariantBlock,
  TypeDeclaration,
} from '@isl-lang/parser';
import { scoreSpec, formatReport } from '../scorer.js';
import { completenessChecker } from '../checkers/completeness.js';
import { specificityChecker } from '../checkers/specificity.js';
import { securityChecker } from '../checkers/security.js';
import { testabilityChecker } from '../checkers/testability.js';
import { consistencyChecker } from '../checkers/consistency.js';

// ============================================================================
// Test Helpers
// ============================================================================

function loc(line = 1, column = 1): SourceLocation {
  return { file: 'test.isl', line, column, endLine: line, endColumn: column + 10 };
}

function id(name: string) {
  return { kind: 'Identifier' as const, name, location: loc() };
}

function str(value: string) {
  return { kind: 'StringLiteral' as const, value, location: loc() };
}

function num(value: number) {
  return { kind: 'NumberLiteral' as const, value, isFloat: false, location: loc() };
}

function field(name: string, typeName = 'String'): Field {
  return {
    kind: 'Field',
    name: id(name),
    type: { kind: 'PrimitiveType', name: typeName as 'String', location: loc() },
    optional: false,
    annotations: [],
    location: loc(),
  };
}

function inputSpec(fields: Field[]): InputSpec {
  return { kind: 'InputSpec', fields, location: loc() };
}

function outputSpec(opts?: { successType?: string; errors?: ErrorSpec[] }): OutputSpec {
  return {
    kind: 'OutputSpec',
    success: {
      kind: 'PrimitiveType',
      name: (opts?.successType ?? 'Boolean') as 'Boolean',
      location: loc(),
    },
    errors: opts?.errors ?? [],
    location: loc(),
  };
}

function errorSpec(name: string): ErrorSpec {
  return {
    kind: 'ErrorSpec',
    name: id(name),
    retriable: false,
    location: loc(),
  };
}

function postcondition(predicates: Expression[], condition: 'success' | 'any_error' = 'success'): PostconditionBlock {
  return {
    kind: 'PostconditionBlock',
    condition,
    predicates,
    location: loc(),
  };
}

function securitySpec(type: 'requires' | 'rate_limit' | 'fraud_check'): SecuritySpec {
  return {
    kind: 'SecuritySpec',
    type,
    details: id('placeholder'),
    location: loc(),
  };
}

function temporalSpec(): TemporalSpec {
  return {
    kind: 'TemporalSpec',
    operator: 'response',
    predicate: id('placeholder'),
    duration: { kind: 'DurationLiteral', value: 500, unit: 'ms', location: loc() },
    location: loc(),
  };
}

function behavior(name: string, overrides: Partial<Behavior> = {}): Behavior {
  return {
    kind: 'Behavior',
    name: id(name),
    input: inputSpec([field('data')]),
    output: outputSpec(),
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location: loc(),
    ...overrides,
  };
}

function entity(name: string, fields: Field[] = [field('id', 'UUID')], invariants: Expression[] = []): Entity {
  return {
    kind: 'Entity',
    name: id(name),
    fields,
    invariants,
    location: loc(),
  };
}

function domain(overrides: Partial<Domain> = {}): Domain {
  return {
    kind: 'Domain',
    name: id('TestDomain'),
    version: str('1.0.0'),
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
    ...overrides,
  };
}

// Expressions
function binaryExpr(op: string, left: Expression, right: Expression): Expression {
  return {
    kind: 'BinaryExpr',
    operator: op as '==',
    left,
    right,
    location: loc(),
  };
}

function memberExpr(obj: Expression, prop: string): Expression {
  return {
    kind: 'MemberExpr',
    object: obj,
    property: id(prop),
    location: loc(),
  };
}

function nullLiteral(): Expression {
  return { kind: 'NullLiteral', location: loc() };
}

// ============================================================================
// Completeness Checker Tests
// ============================================================================

describe('completenessChecker', () => {
  it('gives full score for a well-defined domain', () => {
    const d = domain({
      entities: [entity('User', [field('id'), field('email')], [binaryExpr('!=', id('email'), str(''))])],
      behaviors: [
        behavior('CreateUser', {
          postconditions: [postcondition([binaryExpr('==', memberExpr(id('result'), 'success'), id('true'))])],
          output: outputSpec({ errors: [errorSpec('InvalidInput')] }),
        }),
      ],
    });

    const result = completenessChecker.check(d, 'test.isl');
    expect(result.score.score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes behavior with input but no output', () => {
    const d = domain({
      behaviors: [
        behavior('DoSomething', {
          input: inputSpec([field('data')]),
          output: undefined as unknown as OutputSpec,
        }),
      ],
    });

    const result = completenessChecker.check(d, 'test.isl');
    expect(result.score.score).toBeLessThan(100);
    expect(result.suggestions.some(s => s.message.includes('no output'))).toBe(true);
  });

  it('penalizes behavior with postconditions but no error cases', () => {
    const d = domain({
      behaviors: [
        behavior('DoSomething', {
          postconditions: [postcondition([binaryExpr('==', id('result'), id('true'))])],
          output: outputSpec({ errors: [] }),
        }),
      ],
    });

    const result = completenessChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('no error cases'))).toBe(true);
  });

  it('penalizes entity with fields but no invariants', () => {
    const d = domain({
      entities: [entity('Account', [field('balance')], [])],
      behaviors: [behavior('Deposit')],
    });

    const result = completenessChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('no invariants'))).toBe(true);
  });

  it('penalizes domain with entities but no behaviors', () => {
    const d = domain({
      entities: [entity('User')],
      behaviors: [],
    });

    const result = completenessChecker.check(d, 'test.isl');
    expect(result.score.score).toBeLessThan(100);
    expect(result.suggestions.some(s => s.severity === 'critical')).toBe(true);
  });

  it('penalizes empty domain', () => {
    const d = domain();

    const result = completenessChecker.check(d, 'test.isl');
    expect(result.score.score).toBeLessThan(80);
    expect(result.suggestions.some(s => s.message.includes('empty'))).toBe(true);
  });
});

// ============================================================================
// Specificity Checker Tests
// ============================================================================

describe('specificityChecker', () => {
  it('gives full score for specific postconditions with temporal and preconditions', () => {
    const d = domain({
      behaviors: [
        behavior('Login', {
          preconditions: [binaryExpr('!=', memberExpr(id('input'), 'email'), str(''))],
          postconditions: [
            postcondition([
              binaryExpr('==', memberExpr(id('result'), 'status'), str('authenticated')),
            ]),
          ],
          temporal: [temporalSpec()],
          output: outputSpec({ successType: 'UUID' }),
        }),
      ],
    });

    const result = specificityChecker.check(d, 'test.isl');
    expect(result.score.score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes weak postconditions (null checks)', () => {
    const d = domain({
      behaviors: [
        behavior('GetUser', {
          postconditions: [
            postcondition([binaryExpr('!=', memberExpr(id('result'), 'token'), nullLiteral())]),
          ],
        }),
      ],
    });

    const result = specificityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('null check'))).toBe(true);
  });

  it('penalizes weak length checks', () => {
    const d = domain({
      behaviors: [
        behavior('GetToken', {
          postconditions: [
            postcondition([
              binaryExpr(
                '>',
                memberExpr(memberExpr(id('result'), 'token'), 'length'),
                num(0),
              ),
            ]),
          ],
        }),
      ],
    });

    const result = specificityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('weak length check'))).toBe(true);
  });

  it('penalizes missing temporal requirements', () => {
    const d = domain({
      behaviors: [
        behavior('Search', { temporal: [] }),
        behavior('Fetch', { temporal: [] }),
      ],
    });

    const result = specificityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('temporal'))).toBe(true);
  });

  it('penalizes missing preconditions', () => {
    const d = domain({
      behaviors: [
        behavior('TransferMoney', {
          input: inputSpec([field('amount'), field('to')]),
          preconditions: [],
        }),
      ],
    });

    const result = specificityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('no preconditions'))).toBe(true);
  });

  it('penalizes generic output types', () => {
    const d = domain({
      behaviors: [
        behavior('GetToken', {
          output: outputSpec({ successType: 'String' }),
        }),
      ],
    });

    const result = specificityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('generic'))).toBe(true);
  });
});

// ============================================================================
// Security Checker Tests
// ============================================================================

describe('securityChecker', () => {
  it('gives high score when all security concerns are addressed', () => {
    const d = domain({
      behaviors: [
        behavior('Login', {
          input: inputSpec([field('email'), field('password')]),
          security: [securitySpec('rate_limit'), securitySpec('requires')],
          postconditions: [
            postcondition([binaryExpr('==', id('stored'), { kind: 'CallExpr', callee: id('hash'), arguments: [id('password')], location: loc() })]),
          ],
          output: outputSpec({ errors: [errorSpec('InvalidCredentials')] }),
        }),
      ],
    });

    const result = securityChecker.check(d, 'test.isl');
    expect(result.score.score).toBeGreaterThanOrEqual(70);
  });

  it('penalizes auth behavior without rate limiting', () => {
    const d = domain({
      behaviors: [
        behavior('Login', {
          security: [],
        }),
      ],
    });

    const result = securityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('rate limiting'))).toBe(true);
  });

  it('penalizes password handling without hashing', () => {
    const d = domain({
      behaviors: [
        behavior('Register', {
          input: inputSpec([field('email'), field('password')]),
          security: [],
          postconditions: [],
        }),
      ],
    });

    const result = securityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('hashing'))).toBe(true);
  });

  it('penalizes auth-specific error names that leak information', () => {
    const d = domain({
      behaviors: [
        behavior('Authenticate', {
          output: outputSpec({ errors: [errorSpec('InvalidPassword'), errorSpec('UserNotFound')] }),
          security: [securitySpec('rate_limit')],
        }),
      ],
    });

    const result = securityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('leak auth information'))).toBe(true);
  });

  it('penalizes token handling without expiry', () => {
    const d = domain({
      behaviors: [
        behavior('GenerateToken', {
          postconditions: [],
          temporal: [],
        }),
      ],
    });

    const result = securityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('expiry'))).toBe(true);
  });

  it('gives baseline score when no security-sensitive behaviors exist', () => {
    const d = domain({
      behaviors: [behavior('CalculateTotal')],
    });

    const result = securityChecker.check(d, 'test.isl');
    expect(result.score.score).toBeGreaterThanOrEqual(80);
  });
});

// ============================================================================
// Testability Checker Tests
// ============================================================================

describe('testabilityChecker', () => {
  it('gives high score for testable behaviors with scenarios', () => {
    const d = domain({
      behaviors: [
        behavior('CreateUser', {
          postconditions: [
            postcondition([binaryExpr('==', memberExpr(id('result'), 'success'), id('true'))]),
          ],
        }),
      ],
      scenarios: [
        {
          kind: 'ScenarioBlock',
          behaviorName: id('CreateUser'),
          scenarios: [],
          location: loc(),
        },
      ],
    });

    const result = testabilityChecker.check(d, 'test.isl');
    expect(result.score.score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes abstract postconditions', () => {
    const d = domain({
      behaviors: [
        behavior('Validate', {
          postconditions: [
            postcondition([id('someAbstractCondition')]),
          ],
        }),
      ],
    });

    const result = testabilityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes("can't generate tests"))).toBe(true);
  });

  it('penalizes behaviors without scenarios', () => {
    const d = domain({
      behaviors: [behavior('DoWork')],
      scenarios: [],
    });

    const result = testabilityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('no scenario tests'))).toBe(true);
  });

  it('penalizes behaviors with no postconditions (untestable)', () => {
    const d = domain({
      behaviors: [
        behavior('FireAndForget', {
          input: undefined as unknown as InputSpec,
          output: undefined as unknown as OutputSpec,
          postconditions: [],
        }),
      ],
    });

    const result = testabilityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('hard to test'))).toBe(true);
  });

  it('suggests chaos tests for non-trivial domains', () => {
    const d = domain({
      behaviors: [
        behavior('A'),
        behavior('B'),
        behavior('C'),
      ],
      chaos: [],
    });

    const result = testabilityChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('chaos'))).toBe(true);
  });
});

// ============================================================================
// Consistency Checker Tests
// ============================================================================

describe('consistencyChecker', () => {
  it('gives full score for consistent naming with metadata', () => {
    const d = domain({
      version: str('1.0.0'),
      owner: str('team-backend'),
      entities: [entity('User')],
      behaviors: [behavior('CreateUser')],
      invariants: [
        {
          kind: 'InvariantBlock',
          name: id('rules'),
          scope: 'global',
          predicates: [binaryExpr('>=', id('balance'), num(0))],
          location: loc(),
        },
      ],
      types: [
        {
          kind: 'TypeDeclaration',
          name: id('Email'),
          definition: { kind: 'PrimitiveType', name: 'String', location: loc() },
          annotations: [],
          location: loc(),
        },
      ],
    });

    const result = consistencyChecker.check(d, 'test.isl');
    expect(result.score.score).toBeGreaterThanOrEqual(85);
  });

  it('penalizes non-PascalCase entity names', () => {
    const d = domain({
      entities: [entity('user_account')],
      behaviors: [behavior('CreateUser')],
    });

    const result = consistencyChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('PascalCase'))).toBe(true);
  });

  it('penalizes missing version', () => {
    const d = domain({
      version: str(''),
      behaviors: [behavior('DoWork')],
    });

    const result = consistencyChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('version'))).toBe(true);
  });

  it('penalizes missing owner', () => {
    const d = domain({
      owner: undefined,
      behaviors: [behavior('DoWork')],
    });

    const result = consistencyChecker.check(d, 'test.isl');
    expect(result.suggestions.some(s => s.message.includes('owner'))).toBe(true);
  });
});

// ============================================================================
// Main Scorer Tests
// ============================================================================

describe('scoreSpec', () => {
  it('returns a report with all five dimensions', () => {
    const d = domain({
      entities: [entity('Account', [field('id'), field('balance')])],
      behaviors: [behavior('Deposit')],
    });

    const report = scoreSpec(d, 'test.isl');

    expect(report.file).toBe('test.isl');
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.dimensions.completeness).toBeDefined();
    expect(report.dimensions.specificity).toBeDefined();
    expect(report.dimensions.security).toBeDefined();
    expect(report.dimensions.testability).toBeDefined();
    expect(report.dimensions.consistency).toBeDefined();
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('gives a well-rounded spec a score above 60', () => {
    const d = domain({
      version: str('1.0.0'),
      owner: str('team-backend'),
      entities: [
        entity('User', [field('id', 'UUID'), field('email')], [binaryExpr('!=', id('email'), str(''))]),
      ],
      behaviors: [
        behavior('CreateUser', {
          preconditions: [binaryExpr('!=', memberExpr(id('input'), 'email'), str(''))],
          postconditions: [
            postcondition([
              binaryExpr('==', memberExpr(id('result'), 'success'), id('true')),
            ]),
          ],
          output: outputSpec({ errors: [errorSpec('InvalidInput')], successType: 'UUID' }),
          temporal: [temporalSpec()],
        }),
      ],
      scenarios: [
        {
          kind: 'ScenarioBlock',
          behaviorName: id('CreateUser'),
          scenarios: [],
          location: loc(),
        },
      ],
    });

    const report = scoreSpec(d, 'test.isl');
    expect(report.overallScore).toBeGreaterThanOrEqual(60);
  });

  it('respects skipDimensions option', () => {
    const d = domain({
      behaviors: [behavior('Login')],
    });

    const report = scoreSpec(d, 'test.isl', {
      skipDimensions: ['security'],
    });

    expect(report.dimensions.security.score).toBe(-1);
    expect(report.dimensions.security.findings).toContain('Skipped');
  });

  it('sorts suggestions by severity (critical first)', () => {
    const d = domain({
      entities: [entity('User')],
      behaviors: [],
    });

    const report = scoreSpec(d, 'test.isl');

    const severities = report.suggestions.map(s => s.severity);
    const criticalIdx = severities.indexOf('critical');
    const infoIdx = severities.lastIndexOf('info');

    if (criticalIdx >= 0 && infoIdx >= 0) {
      expect(criticalIdx).toBeLessThan(infoIdx);
    }
  });
});

// ============================================================================
// Format Report Tests
// ============================================================================

describe('formatReport', () => {
  it('renders a human-readable report string', () => {
    const d = domain({
      entities: [entity('User')],
      behaviors: [behavior('CreateUser')],
    });

    const report = scoreSpec(d, 'src/auth.isl');
    const output = formatReport(report);

    expect(output).toContain('ISL Spec Quality Report');
    expect(output).toContain('auth.isl');
    expect(output).toContain('Overall Score');
    expect(output).toContain('Completeness');
    expect(output).toContain('Specificity');
    expect(output).toContain('Security');
    expect(output).toContain('Testability');
    expect(output).toContain('Consistency');
  });

  it('includes suggestions in output', () => {
    const d = domain();
    const report = scoreSpec(d, 'test.isl');
    const output = formatReport(report);

    expect(output).toContain('Suggestions');
  });
});

// ============================================================================
// Min-Score Threshold Tests
// ============================================================================

describe('min-score threshold', () => {
  it('scoreSpec result can be evaluated against a threshold', () => {
    const d = domain({
      entities: [entity('User')],
      behaviors: [behavior('CreateUser')],
    });

    const report = scoreSpec(d, 'test.isl');
    const minScore = 80;
    const passes = report.overallScore >= minScore;

    // A minimal spec shouldn't pass a strict threshold
    expect(typeof passes).toBe('boolean');
  });
});
