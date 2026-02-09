/**
 * PR Analysis Tests
 *
 * Covers diff parsing, file classification, spec matching,
 * risk scoring, and smart file selection across various PR scenarios.
 */

import { describe, it, expect } from 'vitest';

import {
  // Diff parsing
  parseNameStatus,
  mergeNumstat,
  mergeHunks,

  // File classification
  isTestFile,
  isTypeOnly,
  isConfigFile,
  isCriticalPath,
  isISLSpec,
  isSourceFile,
  resolveConfig,

  // Spec matching
  findMatchingSpec,
  findAffectedSpecs,

  // Risk scoring
  calculatePRRisk,
  riskLabel,

  // File selection
  selectFilesForVerification,

  // Formatting
  formatVerificationPlan,
} from '../src/pr-analysis/index.js';

import type {
  FileChange,
  PRAnalysis,
  VerificationPlan,
} from '../src/pr-analysis/index.js';

// ============================================================================
// Helpers
// ============================================================================

function makeFileChange(overrides: Partial<FileChange> & { path: string }): FileChange {
  return {
    changeType: 'modified',
    linesAdded: 10,
    linesRemoved: 5,
    hunks: [],
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<PRAnalysis> = {}): PRAnalysis {
  return {
    changedFiles: [],
    affectedSpecs: [],
    newFiles: [],
    specChanges: [],
    riskScore: 0,
    riskLabel: 'low',
    baseBranch: 'main',
    headRef: 'HEAD',
    ...overrides,
  };
}

// ============================================================================
// Diff Parsing Tests
// ============================================================================

describe('parseNameStatus', () => {
  it('parses added files', () => {
    const raw = 'A\tsrc/payments/refund.ts';
    const result = parseNameStatus(raw);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/payments/refund.ts');
    expect(result[0].changeType).toBe('added');
  });

  it('parses modified files', () => {
    const raw = 'M\tsrc/auth/login.ts';
    const result = parseNameStatus(raw);

    expect(result).toHaveLength(1);
    expect(result[0].changeType).toBe('modified');
  });

  it('parses deleted files', () => {
    const raw = 'D\tsrc/old/deprecated.ts';
    const result = parseNameStatus(raw);

    expect(result).toHaveLength(1);
    expect(result[0].changeType).toBe('deleted');
  });

  it('parses renamed files with old and new paths', () => {
    const raw = 'R090\tsrc/old/name.ts\tsrc/new/name.ts';
    const result = parseNameStatus(raw);

    expect(result).toHaveLength(1);
    expect(result[0].changeType).toBe('renamed');
    expect(result[0].path).toBe('src/new/name.ts');
    expect(result[0].oldPath).toBe('src/old/name.ts');
  });

  it('parses multiple files', () => {
    const raw = [
      'A\tsrc/new-file.ts',
      'M\tsrc/existing.ts',
      'D\tsrc/removed.ts',
      'R100\tsrc/old.ts\tsrc/renamed.ts',
    ].join('\n');

    const result = parseNameStatus(raw);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.changeType)).toEqual([
      'added', 'modified', 'deleted', 'renamed',
    ]);
  });

  it('handles empty input', () => {
    expect(parseNameStatus('')).toEqual([]);
  });

  it('skips blank lines', () => {
    const raw = 'A\tsrc/file.ts\n\n\nM\tsrc/other.ts\n';
    const result = parseNameStatus(raw);
    expect(result).toHaveLength(2);
  });

  it('normalizes backslash paths', () => {
    const raw = 'M\tsrc\\auth\\login.ts';
    const result = parseNameStatus(raw);
    expect(result[0].path).toBe('src/auth/login.ts');
  });
});

describe('mergeNumstat', () => {
  it('merges line counts into existing changes', () => {
    const changes: FileChange[] = [
      makeFileChange({ path: 'src/auth/login.ts', linesAdded: 0, linesRemoved: 0 }),
      makeFileChange({ path: 'src/utils/format.ts', linesAdded: 0, linesRemoved: 0 }),
    ];

    const numstat = [
      '42\t10\tsrc/auth/login.ts',
      '5\t2\tsrc/utils/format.ts',
    ].join('\n');

    mergeNumstat(changes, numstat);

    expect(changes[0].linesAdded).toBe(42);
    expect(changes[0].linesRemoved).toBe(10);
    expect(changes[1].linesAdded).toBe(5);
    expect(changes[1].linesRemoved).toBe(2);
  });

  it('handles binary files (- - path)', () => {
    const changes: FileChange[] = [
      makeFileChange({ path: 'assets/logo.png', linesAdded: 0, linesRemoved: 0 }),
    ];

    mergeNumstat(changes, '-\t-\tassets/logo.png');

    expect(changes[0].linesAdded).toBe(0);
    expect(changes[0].linesRemoved).toBe(0);
  });

  it('handles empty numstat', () => {
    const changes: FileChange[] = [
      makeFileChange({ path: 'src/file.ts' }),
    ];
    mergeNumstat(changes, '');
    // Should not throw
    expect(changes[0].linesAdded).toBe(10);
  });
});

describe('mergeHunks', () => {
  it('attaches hunks to matching files', () => {
    const changes: FileChange[] = [
      makeFileChange({ path: 'src/auth/login.ts' }),
    ];

    const diff = [
      'diff --git a/src/auth/login.ts b/src/auth/login.ts',
      'index abc1234..def5678 100644',
      '--- a/src/auth/login.ts',
      '+++ b/src/auth/login.ts',
      '@@ -10,5 +10,8 @@ function login() {',
      '+  const token = createToken();',
      '@@ -30,3 +33,5 @@ function logout() {',
      '+  clearSession();',
    ].join('\n');

    mergeHunks(changes, diff);

    expect(changes[0].hunks).toHaveLength(2);
    expect(changes[0].hunks[0].oldStart).toBe(10);
    expect(changes[0].hunks[0].oldCount).toBe(5);
    expect(changes[0].hunks[0].newStart).toBe(10);
    expect(changes[0].hunks[0].newCount).toBe(8);
    expect(changes[0].hunks[1].oldStart).toBe(30);
  });

  it('handles single-line hunks', () => {
    const changes: FileChange[] = [
      makeFileChange({ path: 'src/file.ts' }),
    ];

    const diff = [
      'diff --git a/src/file.ts b/src/file.ts',
      '@@ -5 +5,2 @@ export default {};',
    ].join('\n');

    mergeHunks(changes, diff);

    expect(changes[0].hunks).toHaveLength(1);
    expect(changes[0].hunks[0].oldCount).toBe(1);
    expect(changes[0].hunks[0].newCount).toBe(2);
  });

  it('ignores hunks for unknown files', () => {
    const changes: FileChange[] = [
      makeFileChange({ path: 'src/known.ts' }),
    ];

    const diff = [
      'diff --git a/src/unknown.ts b/src/unknown.ts',
      '@@ -1,3 +1,5 @@',
    ].join('\n');

    mergeHunks(changes, diff);
    expect(changes[0].hunks).toHaveLength(0);
  });
});

// ============================================================================
// File Classification Tests
// ============================================================================

describe('File Classification', () => {
  describe('isTestFile', () => {
    it('detects .test.ts files', () => {
      expect(isTestFile('src/utils/format.test.ts')).toBe(true);
    });

    it('detects .spec.tsx files', () => {
      expect(isTestFile('components/Button.spec.tsx')).toBe(true);
    });

    it('detects __tests__ directory', () => {
      expect(isTestFile('src/__tests__/helper.ts')).toBe(true);
    });

    it('detects tests directory', () => {
      expect(isTestFile('tests/integration/api.ts')).toBe(true);
    });

    it('detects .stories files', () => {
      expect(isTestFile('src/Button.stories.tsx')).toBe(true);
    });

    it('detects mock files', () => {
      expect(isTestFile('src/api.mock.ts')).toBe(true);
    });

    it('does not flag source files', () => {
      expect(isTestFile('src/payments/charge.ts')).toBe(false);
    });

    it('supports extra patterns', () => {
      expect(isTestFile('e2e/login.ts', [/^e2e\//])).toBe(true);
    });
  });

  describe('isTypeOnly', () => {
    it('detects .d.ts files', () => {
      expect(isTypeOnly('src/types/payment.d.ts')).toBe(true);
    });

    it('detects .d.cts files', () => {
      expect(isTypeOnly('global.d.cts')).toBe(true);
    });

    it('detects types/index.ts', () => {
      expect(isTypeOnly('src/types/index.ts')).toBe(true);
    });

    it('does not flag regular .ts files', () => {
      expect(isTypeOnly('src/auth/login.ts')).toBe(false);
    });

    it('supports extra extensions', () => {
      expect(isTypeOnly('schema.graphql', ['.graphql'])).toBe(true);
    });
  });

  describe('isConfigFile', () => {
    it('detects tsconfig.json', () => {
      expect(isConfigFile('tsconfig.json')).toBe(true);
    });

    it('detects .env files', () => {
      expect(isConfigFile('.env.local')).toBe(true);
    });

    it('detects package.json', () => {
      expect(isConfigFile('package.json')).toBe(true);
    });

    it('detects Dockerfile', () => {
      expect(isConfigFile('Dockerfile')).toBe(true);
    });

    it('detects .github files', () => {
      expect(isConfigFile('.github/workflows/ci.yml')).toBe(true);
    });

    it('detects markdown files', () => {
      expect(isConfigFile('docs/README.md')).toBe(true);
    });

    it('does not flag source files', () => {
      expect(isConfigFile('src/auth/login.ts')).toBe(false);
    });
  });

  describe('isCriticalPath', () => {
    it('detects auth paths', () => {
      expect(isCriticalPath('src/auth/login.ts')).toBe(true);
    });

    it('detects payment paths', () => {
      expect(isCriticalPath('src/payments/charge.ts')).toBe(true);
    });

    it('detects security paths', () => {
      expect(isCriticalPath('lib/security/encryption.ts')).toBe(true);
    });

    it('detects api paths', () => {
      expect(isCriticalPath('src/api/users.ts')).toBe(true);
    });

    it('detects webhook paths', () => {
      expect(isCriticalPath('src/webhooks/stripe.ts')).toBe(true);
    });

    it('does not flag utility files', () => {
      expect(isCriticalPath('src/utils/format.ts')).toBe(false);
    });

    it('supports extra patterns', () => {
      expect(isCriticalPath('src/admin/panel.ts', [/admin/i])).toBe(true);
    });
  });

  describe('isISLSpec', () => {
    it('detects .isl files', () => {
      expect(isISLSpec('specs/auth.isl')).toBe(true);
    });

    it('does not flag .ts files', () => {
      expect(isISLSpec('src/auth.ts')).toBe(false);
    });
  });

  describe('isSourceFile', () => {
    it('detects .ts files', () => {
      expect(isSourceFile('src/auth.ts')).toBe(true);
    });

    it('detects .tsx files', () => {
      expect(isSourceFile('src/Button.tsx')).toBe(true);
    });

    it('detects .js files', () => {
      expect(isSourceFile('lib/utils.js')).toBe(true);
    });

    it('detects .jsx files', () => {
      expect(isSourceFile('components/App.jsx')).toBe(true);
    });

    it('does not flag .json', () => {
      expect(isSourceFile('config.json')).toBe(false);
    });
  });
});

// ============================================================================
// Spec Matching Tests
// ============================================================================

describe('findMatchingSpec', () => {
  const specs = [
    'specs/auth/login.isl',
    'specs/payments/charge.isl',
    'specs/payments.isl',
    'specs/user.isl',
  ];

  it('matches by exact basename', () => {
    expect(findMatchingSpec('src/auth/login.ts', specs)).toBe('specs/auth/login.isl');
  });

  it('matches by basename across directories', () => {
    expect(findMatchingSpec('src/payments/charge.ts', specs)).toBe('specs/payments/charge.isl');
  });

  it('matches by directory name', () => {
    expect(findMatchingSpec('src/payments/refund.ts', specs)).toBe('specs/payments.isl');
  });

  it('returns undefined when no match', () => {
    expect(findMatchingSpec('src/utils/format.ts', specs)).toBeUndefined();
  });

  it('returns undefined for empty spec list', () => {
    expect(findMatchingSpec('src/auth/login.ts', [])).toBeUndefined();
  });

  it('matches user spec', () => {
    expect(findMatchingSpec('src/models/user.ts', specs)).toBe('specs/user.isl');
  });
});

describe('findAffectedSpecs', () => {
  const specs = [
    'specs/auth.isl',
    'specs/payments/charge.isl',
  ];

  it('includes directly changed spec files', () => {
    const paths = ['specs/auth.isl', 'src/other.ts'];
    const affected = findAffectedSpecs(paths, specs);
    expect(affected).toContain('specs/auth.isl');
  });

  it('finds specs matching changed source files', () => {
    const paths = ['src/payments/charge.ts'];
    const affected = findAffectedSpecs(paths, specs);
    expect(affected).toContain('specs/payments/charge.isl');
  });

  it('deduplicates specs', () => {
    const paths = ['specs/auth.isl', 'src/auth/login.ts'];
    const affected = findAffectedSpecs(paths, specs);
    const authCount = affected.filter((s) => s === 'specs/auth.isl').length;
    expect(authCount).toBe(1);
  });

  it('returns empty for unmatched files', () => {
    const affected = findAffectedSpecs(['src/utils/format.ts'], specs);
    expect(affected).toEqual([]);
  });
});

// ============================================================================
// Risk Scoring Tests
// ============================================================================

describe('calculatePRRisk', () => {
  it('returns 0 for empty PR', () => {
    const analysis = makeAnalysis();
    expect(calculatePRRisk(analysis)).toBe(0);
  });

  it('adds risk per file (capped at 30)', () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      makeFileChange({ path: `src/util${i}.ts` }),
    );
    const analysis = makeAnalysis({ changedFiles: files });
    // 10 * 5 = 50, but capped at 30
    expect(calculatePRRisk(analysis)).toBe(30);
  });

  it('adds risk for critical-path files', () => {
    const files = [
      makeFileChange({ path: 'src/auth/login.ts' }),
    ];
    const analysis = makeAnalysis({ changedFiles: files });
    // 1 * 5 (file count) + 1 * 15 (critical) = 20
    expect(calculatePRRisk(analysis)).toBe(20);
  });

  it('adds risk for new files without specs', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/new.ts', changeType: 'added' }),
      ],
      newFiles: ['src/new.ts'],
      affectedSpecs: [],
    });
    // 1 * 5 (file count) + 1 * 10 (unspecced new) = 15
    expect(calculatePRRisk(analysis)).toBe(15);
  });

  it('adds risk for ISL spec changes', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'specs/orders.isl' }),
      ],
      specChanges: ['specs/orders.isl'],
    });
    // 1 * 5 (file count) + 1 * 10 (spec change) = 15
    expect(calculatePRRisk(analysis)).toBe(15);
  });

  it('adds risk for large diffs in critical files', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/auth/login.ts', linesAdded: 200 }),
      ],
    });
    // 1 * 5 (count) + 1 * 15 (critical) + 1 * 20 (large critical) = 40
    expect(calculatePRRisk(analysis)).toBe(40);
  });

  it('caps at 100', () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      makeFileChange({ path: `src/auth/module${i}.ts`, linesAdded: 200 }),
    );
    const analysis = makeAnalysis({
      changedFiles: files,
      specChanges: Array.from({ length: 5 }, (_, i) => `spec${i}.isl`),
    });
    expect(calculatePRRisk(analysis)).toBe(100);
  });

  it('scores elevated for payment changes', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/payments/charge.ts', linesAdded: 150 }),
        makeFileChange({ path: 'src/payments/refund.ts', changeType: 'added' }),
        makeFileChange({ path: 'src/utils/format.ts' }),
      ],
      newFiles: ['src/payments/refund.ts'],
      affectedSpecs: [],
    });
    const score = calculatePRRisk(analysis);
    // 3*5=15 (count) + 2*15=30 (critical) + 1*10=10 (unspecced new) + 1*20=20 (large critical)
    expect(score).toBe(75);
    expect(riskLabel(score)).toBe('elevated');
  });
});

describe('riskLabel', () => {
  it('returns low for 0-19', () => {
    expect(riskLabel(0)).toBe('low');
    expect(riskLabel(19)).toBe('low');
  });

  it('returns low for 20-39', () => {
    expect(riskLabel(20)).toBe('low');
    expect(riskLabel(39)).toBe('low');
  });

  it('returns moderate for 40-59', () => {
    expect(riskLabel(40)).toBe('moderate');
    expect(riskLabel(59)).toBe('moderate');
  });

  it('returns elevated for 60-79', () => {
    expect(riskLabel(60)).toBe('elevated');
    expect(riskLabel(79)).toBe('elevated');
  });

  it('returns critical for 80-100', () => {
    expect(riskLabel(80)).toBe('critical');
    expect(riskLabel(100)).toBe('critical');
  });
});

// ============================================================================
// File Selection Tests
// ============================================================================

describe('selectFilesForVerification', () => {
  const config = resolveConfig();
  const specs = ['specs/auth/login.isl', 'specs/payments/charge.isl'];

  it('skips test files', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'tests/payments.test.ts' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);

    expect(plan.skip).toHaveLength(1);
    expect(plan.skip[0].reason).toBe('test_file');
    expect(plan.fullVerify).toHaveLength(0);
    expect(plan.speclessVerify).toHaveLength(0);
  });

  it('skips type-only files', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/types/payment.d.ts' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);
    expect(plan.skip).toHaveLength(1);
    expect(plan.skip[0].reason).toBe('type_only');
  });

  it('skips config files', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'tsconfig.json' }),
        makeFileChange({ path: 'package.json' }),
        makeFileChange({ path: '.github/workflows/ci.yml' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);
    expect(plan.skip).toHaveLength(3);
    expect(plan.skip.every((s) => s.reason === 'config_file')).toBe(true);
  });

  it('skips deleted files', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/auth/login.ts', changeType: 'deleted' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);
    expect(plan.skip).toHaveLength(1);
  });

  it('routes specced files to fullVerify', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/auth/login.ts' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);

    expect(plan.fullVerify).toHaveLength(1);
    expect(plan.fullVerify[0].file.path).toBe('src/auth/login.ts');
    expect(plan.fullVerify[0].spec).toBe('specs/auth/login.isl');
  });

  it('routes critical-path files without specs to speclessVerify', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/security/encryption.ts' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);
    expect(plan.speclessVerify).toHaveLength(1);
    expect(plan.speclessVerify[0].path).toBe('src/security/encryption.ts');
  });

  it('recommends spec generation for new critical-path files', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/security/tokens.ts', changeType: 'added' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);
    expect(plan.speclessVerify).toHaveLength(1);
    expect(plan.generateSpec).toHaveLength(1);
    expect(plan.generateSpec[0].path).toBe('src/security/tokens.ts');
  });

  it('skips non-critical source files without specs', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/utils/format.ts' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);
    expect(plan.skip).toHaveLength(1);
    expect(plan.skip[0].reason).toBe('non_critical');
  });

  it('handles a realistic mixed PR', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        // Full verify: has spec
        makeFileChange({ path: 'src/auth/login.ts' }),
        makeFileChange({ path: 'src/payments/charge.ts' }),
        // Specless verify: critical, no matching spec
        makeFileChange({ path: 'src/security/encryption.ts', changeType: 'added' }),
        makeFileChange({ path: 'src/security/vault.ts' }),
        // Skip: test
        makeFileChange({ path: 'tests/payments.test.ts' }),
        // Skip: types
        makeFileChange({ path: 'src/types/payment.d.ts' }),
        // Skip: config
        makeFileChange({ path: 'package.json' }),
        // Skip: non-critical utility
        makeFileChange({ path: 'src/utils/format.ts' }),
      ],
    });

    const plan = selectFilesForVerification(analysis, config, specs);

    expect(plan.fullVerify).toHaveLength(2);
    expect(plan.fullVerify.map((v) => v.file.path).sort()).toEqual([
      'src/auth/login.ts',
      'src/payments/charge.ts',
    ]);

    expect(plan.speclessVerify).toHaveLength(2);
    expect(plan.speclessVerify.map((f) => f.path).sort()).toEqual([
      'src/security/encryption.ts',
      'src/security/vault.ts',
    ]);

    expect(plan.generateSpec).toHaveLength(1);
    expect(plan.generateSpec[0].path).toBe('src/security/encryption.ts');

    expect(plan.skip).toHaveLength(4);
  });
});

// ============================================================================
// Formatting Tests
// ============================================================================

describe('formatVerificationPlan', () => {
  it('formats a plan with all sections', () => {
    const plan: VerificationPlan = {
      fullVerify: [
        { file: makeFileChange({ path: 'src/auth/login.ts' }), spec: 'login.isl' },
      ],
      speclessVerify: [
        makeFileChange({ path: 'src/payments/refund.ts', changeType: 'added' }),
      ],
      skip: [
        { file: makeFileChange({ path: 'tests/auth.test.ts' }), reason: 'test_file' },
      ],
      generateSpec: [
        makeFileChange({ path: 'src/payments/refund.ts', changeType: 'added' }),
      ],
    };

    const output = formatVerificationPlan(plan);

    expect(output).toContain('Full verify (ISL spec):');
    expect(output).toContain('src/auth/login.ts → login.isl');
    expect(output).toContain('Specless verify (critical path, no spec):');
    expect(output).toContain('src/payments/refund.ts (NEW');
    expect(output).toContain('Skip (low risk):');
    expect(output).toContain('tests/auth.test.ts (test file)');
    expect(output).toContain('Recommend spec generation:');
    expect(output).toContain('shipgate isl generate src/payments/refund.ts');
  });

  it('omits empty sections', () => {
    const plan: VerificationPlan = {
      fullVerify: [],
      speclessVerify: [],
      skip: [
        { file: makeFileChange({ path: 'README.md' }), reason: 'config_file' },
      ],
      generateSpec: [],
    };

    const output = formatVerificationPlan(plan);
    expect(output).not.toContain('Full verify');
    expect(output).not.toContain('Specless verify');
    expect(output).not.toContain('Recommend spec');
    expect(output).toContain('Skip (low risk):');
  });
});

// ============================================================================
// Config Resolution Tests
// ============================================================================

describe('resolveConfig', () => {
  it('returns full defaults when no overrides given', () => {
    const config = resolveConfig();
    expect(config.specPatterns).toEqual(['**/*.isl']);
    expect(config.specRoot).toBe('.');
    expect(config.criticalPathPatterns).toEqual([]);
    expect(config.typeOnlyExtensions).toEqual([]);
  });

  it('merges overrides with defaults', () => {
    const config = resolveConfig({
      specRoot: 'isl-specs',
      criticalPathPatterns: [/admin/],
    });
    expect(config.specRoot).toBe('isl-specs');
    expect(config.criticalPathPatterns).toHaveLength(1);
    expect(config.specPatterns).toEqual(['**/*.isl']); // default preserved
  });
});

// ============================================================================
// Scenario: Feature Branch with Payment Changes
// ============================================================================

describe('Scenario: feature/add-refunds', () => {
  it('produces correct analysis for a payment feature PR', () => {
    const analysis = makeAnalysis({
      changedFiles: [
        makeFileChange({ path: 'src/payments/charge.ts', linesAdded: 20, linesRemoved: 5 }),
        makeFileChange({ path: 'src/auth/login.ts', linesAdded: 3, linesRemoved: 1 }),
        makeFileChange({ path: 'src/payments/refund.ts', changeType: 'added', linesAdded: 150, linesRemoved: 0 }),
        makeFileChange({ path: 'src/payments/webhook.ts', linesAdded: 30, linesRemoved: 10 }),
        makeFileChange({ path: 'src/utils/format.ts', linesAdded: 5, linesRemoved: 2 }),
        makeFileChange({ path: 'tests/payments.test.ts', linesAdded: 80, linesRemoved: 0 }),
        makeFileChange({ path: 'src/types/payment.d.ts', linesAdded: 10, linesRemoved: 0 }),
      ],
      affectedSpecs: ['specs/payments/charge.isl', 'specs/auth/login.isl'],
      newFiles: ['src/payments/refund.ts'],
      specChanges: [],
    });

    // Risk: 7 files (capped 30) + 4 critical (60) + 1 unspecced new (10) + 1 large critical(20)
    // = 30+60+10+20 = 100 (capped) — actually let's check: refund is new and critical
    // Actually refund is new, its linesAdded=150 and it's critical → large critical
    const risk = calculatePRRisk(analysis);
    expect(risk).toBeGreaterThanOrEqual(60);
    expect(riskLabel(risk)).toMatch(/elevated|critical/);
  });
});
