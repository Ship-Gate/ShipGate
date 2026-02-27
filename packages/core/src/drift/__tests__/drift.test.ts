/**
 * Drift Detection Unit Tests
 *
 * Tests all four drift strategies, the score calculator,
 * extraction utilities, and formatting.
 */

import { describe, it, expect } from 'vitest';
import {
  extractFunctions,
  extractImports,
  extractExportedNames,
} from '../extract.js';
import {
  detectTimestampDrift,
  detectSignatureDrift,
  detectBehaviorDrift,
  detectDependencyDrift,
  findMatchingBehavior,
  signaturesConflict,
  normalizeName,
  daysBetween,
} from '../strategies.js';
import { calculateDriftScore, scoreSeverity } from '../score.js';
import {
  formatDriftScanSummary,
  formatSingleReport,
  formatDriftScanJSON,
} from '../formatDrift.js';
import { matchSpecsToImpls } from '../detectDrift.js';
import type { DriftReport, DriftScanSummary, DriftIndicator } from '../driftTypes.js';
import type { Behavior, Domain, Identifier, InputSpec, Field } from '@isl-lang/parser';

// ============================================================================
// HELPERS
// ============================================================================

function makeIdentifier(name: string): Identifier {
  return {
    kind: 'Identifier',
    name,
    location: { file: '', line: 1, column: 0, endLine: 1, endColumn: 0 },
  };
}

function makeField(name: string): Field {
  return {
    kind: 'Field',
    name: makeIdentifier(name),
    type: {
      kind: 'PrimitiveType',
      name: 'String',
      location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
    },
    optional: false,
    annotations: [],
    location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
  } as Field;
}

function makeBehavior(name: string, inputFields: string[] = []): Behavior {
  return {
    kind: 'Behavior',
    name: makeIdentifier(name),
    input: {
      kind: 'InputSpec',
      fields: inputFields.map(makeField),
      location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
    } as InputSpec,
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'String', location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 } },
      errors: [],
      location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
    },
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location: { file: '', line: 5, column: 0, endLine: 20, endColumn: 0 },
  } as Behavior;
}

function makeDomain(behaviors: Behavior[]): Domain {
  return {
    kind: 'Domain',
    name: makeIdentifier('TestDomain'),
    version: { kind: 'StringLiteral', value: '1.0', location: { file: '', line: 1, column: 0, endLine: 1, endColumn: 0 } },
    uses: [],
    imports: [],
    types: [],
    entities: [],
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: { file: '', line: 1, column: 0, endLine: 50, endColumn: 0 },
  } as Domain;
}

// ============================================================================
// EXTRACTION TESTS
// ============================================================================

describe('extractFunctions', () => {
  it('should extract exported function declarations', () => {
    const source = `
export function processPayment(amount: number, currency: string): Promise<Receipt> {
  // implementation
}
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('processPayment');
    expect(fns[0].params).toEqual(['amount', 'currency']);
    expect(fns[0].exported).toBe(true);
    expect(fns[0].async).toBe(false);
  });

  it('should extract async function declarations', () => {
    const source = `
export async function fetchUser(id: string): Promise<User> {
  return db.find(id);
}
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('fetchUser');
    expect(fns[0].async).toBe(true);
    expect(fns[0].exported).toBe(true);
  });

  it('should extract arrow functions', () => {
    const source = `
export const calculateTotal = (items: Item[], tax: number): number => {
  return items.reduce((sum, i) => sum + i.price, 0) * (1 + tax);
};
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('calculateTotal');
    expect(fns[0].params).toEqual(['items', 'tax']);
    expect(fns[0].exported).toBe(true);
  });

  it('should extract non-exported functions', () => {
    const source = `
function internalHelper(data: string): boolean {
  return data.length > 0;
}
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('internalHelper');
    expect(fns[0].exported).toBe(false);
  });

  it('should handle multiple functions', () => {
    const source = `
export function login(username: string, password: string): Token {
  // ...
}

export function logout(token: string): void {
  // ...
}

function hashPassword(pw: string): string {
  // ...
}
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(3);
    expect(fns.map((f) => f.name)).toEqual(['login', 'logout', 'hashPassword']);
  });

  it('should handle functions with no parameters', () => {
    const source = `
export function getConfig(): Config {
  return {};
}
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(1);
    expect(fns[0].params).toEqual([]);
  });

  it('should skip comments and empty lines', () => {
    const source = `
// This is a comment
// export function fake(): void {}

export function real(): void {
  // body
}
`;
    const fns = extractFunctions(source);
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('real');
  });
});

describe('extractImports', () => {
  it('should extract named imports', () => {
    const source = `import { readFile, writeFile } from 'fs/promises';`;
    const imports = extractImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('fs/promises');
    expect(imports[0].names).toEqual(['readFile', 'writeFile']);
    expect(imports[0].typeOnly).toBe(false);
  });

  it('should extract type-only imports', () => {
    const source = `import type { User, Role } from './types';`;
    const imports = extractImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('./types');
    expect(imports[0].typeOnly).toBe(true);
  });

  it('should extract default imports', () => {
    const source = `import express from 'express';`;
    const imports = extractImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('express');
    expect(imports[0].defaultImport).toBe('express');
  });

  it('should extract side-effect imports', () => {
    const source = `import 'dotenv/config';`;
    const imports = extractImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('dotenv/config');
    expect(imports[0].names).toEqual([]);
  });

  it('should handle aliased imports', () => {
    const source = `import { readFile as read, writeFile as write } from 'fs/promises';`;
    const imports = extractImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0].names).toEqual(['read', 'write']);
  });
});

describe('extractExportedNames', () => {
  it('should extract all exported symbols', () => {
    const source = `
export function processPayment() {}
export const MAX_AMOUNT = 10000;
export class PaymentService {}
export type PaymentResult = { success: boolean };
export interface Config {}
export enum Status { Active, Inactive }
`;
    const names = extractExportedNames(source);
    expect(names).toEqual([
      'processPayment',
      'MAX_AMOUNT',
      'PaymentService',
      'PaymentResult',
      'Config',
      'Status',
    ]);
  });
});

// ============================================================================
// STRATEGY TESTS
// ============================================================================

describe('detectTimestampDrift', () => {
  it('should return no indicators when spec is newer than code', () => {
    const specMtime = new Date('2025-02-01');
    const implMtime = new Date('2025-01-15');

    const indicators = detectTimestampDrift('spec.isl', 'impl.ts', specMtime, implMtime);
    expect(indicators).toHaveLength(0);
  });

  it('should detect drift when code is newer than spec', () => {
    const specMtime = new Date('2025-01-01');
    const implMtime = new Date('2025-01-15');

    const indicators = detectTimestampDrift('spec.isl', 'impl.ts', specMtime, implMtime);
    expect(indicators).toHaveLength(1);
    expect(indicators[0].type).toBe('structural_change');
    expect(indicators[0].severity).toBe('medium');
    expect(indicators[0].description).toContain('14 days after spec');
  });

  it('should flag high severity for old specs (>30 days)', () => {
    const specMtime = new Date('2024-01-01');
    const implMtime = new Date('2025-01-01');

    const indicators = detectTimestampDrift('spec.isl', 'impl.ts', specMtime, implMtime);
    expect(indicators).toHaveLength(1);
    expect(indicators[0].severity).toBe('high');
  });

  it('should flag low severity for recent changes (<7 days)', () => {
    const specMtime = new Date('2025-01-01');
    const implMtime = new Date('2025-01-03');

    const indicators = detectTimestampDrift('spec.isl', 'impl.ts', specMtime, implMtime);
    expect(indicators).toHaveLength(1);
    expect(indicators[0].severity).toBe('low');
  });
});

describe('detectSignatureDrift', () => {
  it('should detect functions with no matching behavior', () => {
    const domain = makeDomain([makeBehavior('login')]);
    const implFns = [
      { name: 'login', params: ['username', 'password'], returnType: 'Token', exported: true, async: false, line: 5 },
      { name: 'processRefund', params: ['orderId'], returnType: 'void', exported: true, async: true, line: 15 },
    ];

    const indicators = detectSignatureDrift('spec.isl', 'impl.ts', domain, implFns);
    expect(indicators.some((i) => i.type === 'new_behavior' && i.description.includes('processRefund'))).toBe(true);
  });

  it('should detect signature mismatches', () => {
    const domain = makeDomain([makeBehavior('charge', ['amount'])]);
    const implFns = [
      { name: 'charge', params: ['amount', 'currency', 'metadata'], returnType: 'Receipt', exported: true, async: false, line: 10 },
    ];

    const indicators = detectSignatureDrift('spec.isl', 'impl.ts', domain, implFns);
    expect(indicators.some((i) => i.type === 'signature_change')).toBe(true);
  });

  it('should not flag matching signatures', () => {
    const domain = makeDomain([makeBehavior('transfer', ['from', 'to', 'amount'])]);
    const implFns = [
      { name: 'transfer', params: ['from', 'to', 'amount'], returnType: 'Receipt', exported: true, async: false, line: 10 },
    ];

    const indicators = detectSignatureDrift('spec.isl', 'impl.ts', domain, implFns);
    expect(indicators).toHaveLength(0);
  });

  it('should not flag likely helper functions', () => {
    const domain = makeDomain([makeBehavior('login')]);
    const implFns = [
      { name: 'login', params: ['username'], returnType: 'void', exported: true, async: false, line: 1 },
      { name: 'validateInput', params: ['data'], returnType: 'boolean', exported: true, async: false, line: 10 },
      { name: 'formatResponse', params: ['resp'], returnType: 'string', exported: true, async: false, line: 20 },
    ];

    const indicators = detectSignatureDrift('spec.isl', 'impl.ts', domain, implFns);
    // validateInput and formatResponse should be treated as helpers, not flagged
    expect(indicators.filter((i) => i.type === 'new_behavior')).toHaveLength(0);
  });
});

describe('detectBehaviorDrift', () => {
  it('should detect spec behaviors with no implementation', () => {
    const domain = makeDomain([
      makeBehavior('login'),
      makeBehavior('processRefund'),
    ]);
    const implFns = [
      { name: 'login', params: ['username'], returnType: 'void', exported: true, async: false, line: 1 },
    ];

    const indicators = detectBehaviorDrift('spec.isl', 'impl.ts', domain, implFns);
    expect(indicators).toHaveLength(1);
    expect(indicators[0].type).toBe('removed_behavior');
    expect(indicators[0].description).toContain('processRefund');
    expect(indicators[0].severity).toBe('high');
  });

  it('should not flag behaviors that have matching implementations', () => {
    const domain = makeDomain([
      makeBehavior('login'),
      makeBehavior('logout'),
    ]);
    const implFns = [
      { name: 'login', params: [], returnType: 'void', exported: true, async: false, line: 1 },
      { name: 'logout', params: [], returnType: 'void', exported: true, async: false, line: 10 },
    ];

    const indicators = detectBehaviorDrift('spec.isl', 'impl.ts', domain, implFns);
    expect(indicators).toHaveLength(0);
  });

  it('should match behaviors with different naming conventions', () => {
    const domain = makeDomain([
      makeBehavior('process_payment'),  // snake_case in spec
    ]);
    const implFns = [
      { name: 'processPayment', params: [], returnType: 'void', exported: true, async: false, line: 1 },  // camelCase in impl
    ];

    const indicators = detectBehaviorDrift('spec.isl', 'impl.ts', domain, implFns);
    expect(indicators).toHaveLength(0);
  });
});

describe('detectDependencyDrift', () => {
  it('should detect new external package imports', () => {
    const domain = makeDomain([]);
    const implImports = [
      { source: 'stripe', names: ['Stripe'], typeOnly: false, line: 1 },
    ];

    const indicators = detectDependencyDrift('spec.isl', 'impl.ts', domain, implImports);
    expect(indicators.some((i) => i.type === 'dependency_change' && i.description.includes('stripe'))).toBe(true);
  });

  it('should not flag type-only imports', () => {
    const domain = makeDomain([]);
    const implImports = [
      { source: 'stripe', names: ['StripeClient'], typeOnly: true, line: 1 },
    ];

    const indicators = detectDependencyDrift('spec.isl', 'impl.ts', domain, implImports);
    expect(indicators).toHaveLength(0);
  });

  it('should not flag relative imports', () => {
    const domain = makeDomain([]);
    const implImports = [
      { source: './utils', names: ['helper'], typeOnly: false, line: 1 },
      { source: '../config', names: ['config'], typeOnly: false, line: 2 },
    ];

    const indicators = detectDependencyDrift('spec.isl', 'impl.ts', domain, implImports);
    expect(indicators).toHaveLength(0);
  });

  it('should not flag Node.js built-ins', () => {
    const domain = makeDomain([]);
    const implImports = [
      { source: 'fs', names: ['readFile'], typeOnly: false, line: 1 },
      { source: 'path', names: ['join'], typeOnly: false, line: 2 },
    ];

    const indicators = detectDependencyDrift('spec.isl', 'impl.ts', domain, implImports);
    expect(indicators).toHaveLength(0);
  });

  it('should not flag dev tool imports', () => {
    const domain = makeDomain([]);
    const implImports = [
      { source: 'chalk', names: ['default'], typeOnly: false, line: 1 },
      { source: 'debug', names: ['default'], typeOnly: false, line: 2 },
    ];

    const indicators = detectDependencyDrift('spec.isl', 'impl.ts', domain, implImports);
    expect(indicators).toHaveLength(0);
  });
});

// ============================================================================
// SCORE TESTS
// ============================================================================

describe('calculateDriftScore', () => {
  it('should return 0 for empty indicators', () => {
    expect(calculateDriftScore([])).toBe(0);
  });

  it('should calculate weighted score from indicators', () => {
    const indicators: DriftIndicator[] = [
      {
        type: 'structural_change',
        description: 'Code modified 5 days after spec',
        severity: 'low',
        codeLocation: { file: 'impl.ts', line: 0 },
      },
    ];
    const score = calculateDriftScore(indicators);
    // structural_change weight = 10, low multiplier = 0.5 → 5
    expect(score).toBe(5);
  });

  it('should cap at 100', () => {
    const indicators: DriftIndicator[] = Array.from({ length: 10 }, () => ({
      type: 'signature_change' as const,
      description: 'Signature changed',
      severity: 'high' as const,
      codeLocation: { file: 'impl.ts', line: 0 },
    }));
    const score = calculateDriftScore(indicators);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should weight high-severity indicators more heavily', () => {
    const lowIndicator: DriftIndicator = {
      type: 'structural_change',
      description: 'test',
      severity: 'low',
      codeLocation: { file: 'impl.ts', line: 0 },
    };
    const highIndicator: DriftIndicator = {
      type: 'structural_change',
      description: 'test',
      severity: 'high',
      codeLocation: { file: 'impl.ts', line: 0 },
    };

    const lowScore = calculateDriftScore([lowIndicator]);
    const highScore = calculateDriftScore([highIndicator]);
    expect(highScore).toBeGreaterThan(lowScore);
  });
});

describe('scoreSeverity', () => {
  it('should return in-sync for 0', () => {
    expect(scoreSeverity(0)).toBe('in-sync');
  });

  it('should return low for 1-20', () => {
    expect(scoreSeverity(10)).toBe('low');
    expect(scoreSeverity(20)).toBe('low');
  });

  it('should return medium for 21-50', () => {
    expect(scoreSeverity(30)).toBe('medium');
    expect(scoreSeverity(50)).toBe('medium');
  });

  it('should return high for 51-80', () => {
    expect(scoreSeverity(60)).toBe('high');
    expect(scoreSeverity(80)).toBe('high');
  });

  it('should return critical for 81-100', () => {
    expect(scoreSeverity(90)).toBe('critical');
    expect(scoreSeverity(100)).toBe('critical');
  });
});

// ============================================================================
// HELPER TESTS
// ============================================================================

describe('normalizeName', () => {
  it('should normalize camelCase', () => {
    expect(normalizeName('processPayment')).toBe('process_payment');
  });

  it('should normalize PascalCase', () => {
    expect(normalizeName('ProcessPayment')).toBe('process_payment');
  });

  it('should normalize kebab-case', () => {
    expect(normalizeName('process-payment')).toBe('process_payment');
  });

  it('should normalize snake_case (no change)', () => {
    expect(normalizeName('process_payment')).toBe('process_payment');
  });

  it('should handle mixed cases', () => {
    expect(normalizeName('processPayment_v2')).toBe('process_payment_v2');
  });
});

describe('daysBetween', () => {
  it('should calculate days between two dates', () => {
    const a = new Date('2025-01-01');
    const b = new Date('2025-01-15');
    expect(daysBetween(a, b)).toBe(14);
  });

  it('should return 0 for same day', () => {
    const a = new Date('2025-01-01T10:00:00');
    const b = new Date('2025-01-01T20:00:00');
    expect(daysBetween(a, b)).toBe(0);
  });
});

describe('findMatchingBehavior', () => {
  it('should find exact name match', () => {
    const behaviors = [makeBehavior('login'), makeBehavior('logout')];
    const result = findMatchingBehavior('login', behaviors);
    expect(result).toBeDefined();
    expect(result?.name.name).toBe('login');
  });

  it('should find case-normalized match', () => {
    const behaviors = [makeBehavior('process_payment')];
    const result = findMatchingBehavior('processPayment', behaviors);
    expect(result).toBeDefined();
  });

  it('should return undefined for no match', () => {
    const behaviors = [makeBehavior('login')];
    const result = findMatchingBehavior('processPayment', behaviors);
    expect(result).toBeUndefined();
  });
});

describe('signaturesConflict', () => {
  it('should not conflict when both have no params', () => {
    const fn = { name: 'test', params: [], returnType: '', exported: true, async: false, line: 1 };
    const behavior = makeBehavior('test', []);
    expect(signaturesConflict(fn, behavior)).toBe(false);
  });

  it('should conflict when params differ significantly', () => {
    const fn = { name: 'charge', params: ['amount', 'currency', 'metadata'], returnType: '', exported: true, async: false, line: 1 };
    const behavior = makeBehavior('charge', ['amount']);
    expect(signaturesConflict(fn, behavior)).toBe(true);
  });

  it('should not conflict for small differences (1 extra param)', () => {
    const fn = { name: 'charge', params: ['amount', 'options'], returnType: '', exported: true, async: false, line: 1 };
    const behavior = makeBehavior('charge', ['amount']);
    // Only 1 mismatch, threshold is 2
    expect(signaturesConflict(fn, behavior)).toBe(false);
  });
});

// ============================================================================
// MATCHING TESTS
// ============================================================================

describe('matchSpecsToImpls', () => {
  it('should match by base filename', () => {
    const specFiles = ['/specs/login.isl', '/specs/payment.isl'];
    const implFiles = ['/src/login.ts', '/src/payment.ts', '/src/utils.ts'];

    const pairs = matchSpecsToImpls(specFiles, implFiles);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].specFile).toBe('/specs/login.isl');
    expect(pairs[0].implFile).toBe('/src/login.ts');
  });

  it('should return empty for no matches', () => {
    const specFiles = ['/specs/auth.isl'];
    const implFiles = ['/src/payment.ts'];

    const pairs = matchSpecsToImpls(specFiles, implFiles);
    expect(pairs).toHaveLength(0);
  });

  it('should handle case-insensitive matching', () => {
    const specFiles = ['/specs/Login.isl'];
    const implFiles = ['/src/login.ts'];

    const pairs = matchSpecsToImpls(specFiles, implFiles);
    expect(pairs).toHaveLength(1);
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('formatSingleReport', () => {
  it('should format an in-sync report', () => {
    const report: DriftReport = {
      file: '/src/login.ts',
      spec: '/specs/login.isl',
      driftScore: 0,
      severity: 'in-sync',
      lastCodeChange: new Date(),
      lastSpecChange: new Date(),
      indicators: [],
    };

    const output = formatSingleReport(report);
    expect(output).toContain('login.ts');
    expect(output).toContain('login.isl');
    expect(output).toContain('0/100');
    expect(output).toContain('in sync');
    expect(output).toContain('\u2713');
  });

  it('should format a high-drift report with indicators', () => {
    const report: DriftReport = {
      file: '/src/payment.ts',
      spec: '/specs/payment.isl',
      driftScore: 72,
      severity: 'high',
      lastCodeChange: new Date(),
      lastSpecChange: new Date('2024-01-01'),
      indicators: [
        {
          type: 'new_behavior',
          description: "Function 'processRefund' has no ISL behavior",
          severity: 'high',
          codeLocation: { file: '/src/payment.ts', line: 25 },
        },
        {
          type: 'signature_change',
          description: "'charge' signature changed",
          severity: 'high',
          codeLocation: { file: '/src/payment.ts', line: 10 },
        },
      ],
    };

    const output = formatSingleReport(report);
    expect(output).toContain('72/100');
    expect(output).toContain('high');
    expect(output).toContain('processRefund');
    expect(output).toContain('shipgate drift');
  });
});

describe('formatDriftScanSummary', () => {
  it('should format a complete scan summary', () => {
    const summary: DriftScanSummary = {
      totalSpecs: 3,
      inSync: 1,
      drifted: 2,
      highDrift: 1,
      averageScore: 29,
      reports: [
        {
          file: '/src/login.ts',
          spec: '/specs/login.isl',
          driftScore: 15,
          severity: 'low',
          lastCodeChange: new Date(),
          lastSpecChange: new Date(),
          indicators: [],
        },
        {
          file: '/src/payment.ts',
          spec: '/specs/payment.isl',
          driftScore: 72,
          severity: 'high',
          lastCodeChange: new Date(),
          lastSpecChange: new Date(),
          indicators: [],
        },
        {
          file: '/src/users.ts',
          spec: '/specs/users.isl',
          driftScore: 0,
          severity: 'in-sync',
          lastCodeChange: new Date(),
          lastSpecChange: new Date(),
          indicators: [],
        },
      ],
      timestamp: new Date(),
      durationMs: 42,
    };

    const output = formatDriftScanSummary(summary);
    expect(output).toContain('Drift Report');
    expect(output).toContain('2 of 3 spec(s) may need updating');
    expect(output).toContain('1 spec(s) have high drift');
    expect(output).toContain('Average drift score: 29/100');
  });

  it('should handle empty scan', () => {
    const summary: DriftScanSummary = {
      totalSpecs: 0,
      inSync: 0,
      drifted: 0,
      highDrift: 0,
      averageScore: 0,
      reports: [],
      timestamp: new Date(),
      durationMs: 5,
    };

    const output = formatDriftScanSummary(summary);
    expect(output).toContain('No spec');
  });
});

describe('formatDriftScanJSON', () => {
  it('should produce valid JSON', () => {
    const summary: DriftScanSummary = {
      totalSpecs: 1,
      inSync: 1,
      drifted: 0,
      highDrift: 0,
      averageScore: 0,
      reports: [{
        file: '/src/login.ts',
        spec: '/specs/login.isl',
        driftScore: 0,
        severity: 'in-sync',
        lastCodeChange: new Date('2025-01-01'),
        lastSpecChange: new Date('2025-01-01'),
        indicators: [],
      }],
      timestamp: new Date('2025-01-01'),
      durationMs: 10,
    };

    const json = formatDriftScanJSON(summary);
    const parsed = JSON.parse(json);
    expect(parsed.totalSpecs).toBe(1);
    expect(parsed.reports).toHaveLength(1);
    expect(parsed.reports[0].driftScore).toBe(0);
  });
});
