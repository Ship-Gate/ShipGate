/**
 * Team Config Unit Tests
 *
 * Covers:
 *   - YAML validation (valid configs, invalid configs, snake_case/camelCase)
 *   - Config loading from string (no file I/O needed)
 *   - Config resolution / merging (team + repo overrides)
 *   - Policy enforcement (coverage, quality, required checks, critical paths, banned patterns)
 *   - Template generation
 */

import { describe, it, expect } from 'vitest';
import {
  validateTeamConfig,
  formatTeamConfigErrors,
} from '../teamConfigValidator.js';
import {
  DEFAULT_TEAM_POLICIES,
  DEFAULT_TEAM_CONFIG,
  applyPolicyDefaults,
  applyTeamConfigDefaults,
  mergeTeamPolicies,
  generateTeamConfigTemplate,
} from '../teamConfigSchema.js';
import {
  parseTeamConfigString,
  TeamConfigError,
} from '../teamConfigLoader.js';
import {
  resolveConfigSync,
} from '../teamConfigResolver.js';
import {
  enforceTeamPolicies,
  formatPolicyResult,
} from '../policyEnforcement.js';
import type {
  PolicyVerifyInput,
  ResolvedConfig,
  TeamPolicies,
} from '../teamConfigTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_YAML = `
version: 1
team: "acme-engineering"

policies:
  min_coverage: 70
  min_spec_quality: 60

  required_checks:
    - hallucination-detection
    - secret-scanning
    - fake-feature-detection

  critical_paths:
    - "**/auth/**"
    - "**/payment*/**"

  banned_patterns:
    - pattern: "eval("
      reason: "Use of eval is prohibited"
      severity: error
    - pattern: "TODO.*hack"
      reason: "Temporary hacks must not ship"
      severity: warning

  security:
    require_rate_limiting: true
    require_error_consistency: true
    require_password_hashing: true

  spec_templates:
    - name: "api-endpoint"
      url: "https://specs.acme.com/templates/api-endpoint.isl"
`;

const MINIMAL_YAML = `
version: 1
team: "test-team"
policies: {}
`;

const CAMEL_CASE_YAML = `
version: 1
team: "camel-team"
policies:
  minCoverage: 80
  minSpecQuality: 50
  requiredChecks:
    - secret-scanning
  criticalPaths:
    - "**/api/**"
  bannedPatterns:
    - pattern: "console.log"
      reason: "No console.log in production"
      severity: warning
  specTemplates: []
`;

function makePassingInput(overrides: Partial<PolicyVerifyInput> = {}): PolicyVerifyInput {
  return {
    coverage: { percentage: 85, coveredFiles: [], uncoveredFiles: [] },
    specQuality: 75,
    checksRun: ['hallucination-detection', 'secret-scanning', 'fake-feature-detection'],
    sourceFiles: [],
    ...overrides,
  };
}

function makeResolvedConfig(overrides: Partial<TeamPolicies> = {}): ResolvedConfig {
  return {
    team: 'test-team',
    policies: {
      ...DEFAULT_TEAM_POLICIES,
      minCoverage: 70,
      minSpecQuality: 60,
      requiredChecks: ['hallucination-detection', 'secret-scanning', 'fake-feature-detection'],
      criticalPaths: ['**/auth/**'],
      bannedPatterns: [],
      security: {
        requireRateLimiting: true,
        requireErrorConsistency: true,
        requirePasswordHashing: true,
      },
      ...overrides,
    },
    source: { teamConfigPath: null, repoConfigPath: null },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('TeamConfig Validation', () => {
  describe('valid configs', () => {
    it('should accept a fully specified config', () => {
      const raw = {
        version: 1,
        team: 'acme-engineering',
        policies: {
          min_coverage: 70,
          min_spec_quality: 60,
          required_checks: ['secret-scanning'],
          critical_paths: ['**/auth/**'],
          banned_patterns: [
            { pattern: 'eval(', reason: 'No eval', severity: 'error' },
          ],
          security: {
            require_rate_limiting: true,
            require_error_consistency: true,
            require_password_hashing: true,
          },
          spec_templates: [
            { name: 'api', url: 'https://example.com/api.isl' },
          ],
        },
      };
      const result = validateTeamConfig(raw);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toBeDefined();
      expect(result.config!.team).toBe('acme-engineering');
    });

    it('should accept a minimal config with empty policies', () => {
      const raw = { version: 1, team: 'test', policies: {} };
      const result = validateTeamConfig(raw);
      expect(result.valid).toBe(true);
    });

    it('should support camelCase keys', () => {
      const raw = {
        version: 1,
        team: 'camel',
        policies: {
          minCoverage: 80,
          minSpecQuality: 50,
          requiredChecks: ['coverage'],
          criticalPaths: ['**/api/**'],
          bannedPatterns: [],
          specTemplates: [],
        },
      };
      const result = validateTeamConfig(raw);
      expect(result.valid).toBe(true);
      expect(result.config!.policies.minCoverage).toBe(80);
    });
  });

  describe('invalid configs', () => {
    it('should reject non-object input', () => {
      const result = validateTeamConfig('not-an-object');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('YAML mapping');
    });

    it('should reject missing version', () => {
      const result = validateTeamConfig({ team: 'x', policies: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'version' }),
      );
    });

    it('should reject wrong version', () => {
      const result = validateTeamConfig({ version: 2, team: 'x', policies: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'version', got: 2 }),
      );
    });

    it('should reject missing team', () => {
      const result = validateTeamConfig({ version: 1, policies: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'team' }),
      );
    });

    it('should reject empty team string', () => {
      const result = validateTeamConfig({ version: 1, team: '  ', policies: {} });
      expect(result.valid).toBe(false);
    });

    it('should reject missing policies', () => {
      const result = validateTeamConfig({ version: 1, team: 'x' });
      expect(result.valid).toBe(false);
    });

    it('should reject min_coverage out of range', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: { min_coverage: 150 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'policies.min_coverage' }),
      );
    });

    it('should reject non-numeric min_coverage', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: { min_coverage: 'high' },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject non-array required_checks', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: { required_checks: 'not-array' },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid banned pattern (missing fields)', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: { banned_patterns: [{ pattern: '' }] },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid severity in banned pattern', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: {
          banned_patterns: [
            { pattern: 'eval', reason: 'bad', severity: 'critical' },
          ],
        },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject non-boolean security fields', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: { security: { require_rate_limiting: 'yes' } },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject spec template without url', () => {
      const result = validateTeamConfig({
        version: 1,
        team: 'x',
        policies: { spec_templates: [{ name: 'test' }] },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('error formatting', () => {
    it('should include file path in header when provided', () => {
      const errors = [{ path: 'team', message: 'team is required' }];
      const output = formatTeamConfigErrors(errors, '/path/.shipgate-team.yml');
      expect(output).toContain('/path/.shipgate-team.yml');
    });

    it('should include "got" values', () => {
      const errors = [{ path: 'version', message: 'bad version', got: 99 }];
      const output = formatTeamConfigErrors(errors);
      expect(output).toContain('99');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Schema / Defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe('TeamConfig Schema', () => {
  describe('applyPolicyDefaults', () => {
    it('should fill all fields from an empty partial', () => {
      const result = applyPolicyDefaults({});
      expect(result.minCoverage).toBe(0);
      expect(result.minSpecQuality).toBe(0);
      expect(result.requiredChecks).toEqual([]);
      expect(result.criticalPaths).toEqual([]);
      expect(result.bannedPatterns).toEqual([]);
      expect(result.security).toEqual(expect.objectContaining({ requireRateLimiting: false }));
      expect(result.specTemplates).toEqual([]);
    });

    it('should preserve provided values', () => {
      const result = applyPolicyDefaults({ minCoverage: 80 });
      expect(result.minCoverage).toBe(80);
      expect(result.minSpecQuality).toBe(0); // still default
    });
  });

  describe('applyTeamConfigDefaults', () => {
    it('should produce a full TeamConfig from partial', () => {
      const result = applyTeamConfigDefaults({ team: 'alpha' });
      expect(result.version).toBe(1);
      expect(result.team).toBe('alpha');
      expect(result.policies.minCoverage).toBe(0);
    });
  });

  describe('mergeTeamPolicies', () => {
    it('should override base values with override values', () => {
      const base: TeamPolicies = {
        ...DEFAULT_TEAM_POLICIES,
        minCoverage: 50,
        requiredChecks: ['secret-scanning'],
      };
      const override = { minCoverage: 80 };
      const result = mergeTeamPolicies(base, override);
      expect(result.minCoverage).toBe(80);
      expect(result.requiredChecks).toEqual(['secret-scanning']); // unchanged
    });

    it('should replace arrays entirely when overridden', () => {
      const base: TeamPolicies = {
        ...DEFAULT_TEAM_POLICIES,
        requiredChecks: ['a', 'b'],
      };
      const result = mergeTeamPolicies(base, { requiredChecks: ['c'] });
      expect(result.requiredChecks).toEqual(['c']);
    });

    it('should deep-merge security policies', () => {
      const base: TeamPolicies = {
        ...DEFAULT_TEAM_POLICIES,
        security: {
          requireRateLimiting: true,
          requireErrorConsistency: false,
          requirePasswordHashing: false,
        },
      };
      const result = mergeTeamPolicies(base, {
        security: { requireErrorConsistency: true },
      });
      expect(result.security.requireRateLimiting).toBe(true);
      expect(result.security.requireErrorConsistency).toBe(true);
      expect(result.security.requirePasswordHashing).toBe(false);
    });
  });

  describe('generateTeamConfigTemplate', () => {
    it('should produce a valid YAML string with the team name', () => {
      const template = generateTeamConfigTemplate('my-team');
      expect(template).toContain('team: "my-team"');
      expect(template).toContain('version: 1');
      expect(template).toContain('min_coverage:');
      expect(template).toContain('banned_patterns:');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// YAML Loader (parseTeamConfigString)
// ═══════════════════════════════════════════════════════════════════════════════

describe('TeamConfig Loader', () => {
  describe('parseTeamConfigString', () => {
    it('should parse a valid YAML config', () => {
      const config = parseTeamConfigString(VALID_YAML);
      expect(config.version).toBe(1);
      expect(config.team).toBe('acme-engineering');
      expect(config.policies.minCoverage).toBe(70);
      expect(config.policies.minSpecQuality).toBe(60);
      expect(config.policies.requiredChecks).toContain('secret-scanning');
      expect(config.policies.criticalPaths).toContain('**/auth/**');
      expect(config.policies.bannedPatterns).toHaveLength(2);
      expect(config.policies.bannedPatterns[0].pattern).toBe('eval(');
      expect(config.policies.security.requireRateLimiting).toBe(true);
      expect(config.policies.specTemplates).toHaveLength(1);
    });

    it('should parse a minimal YAML config and apply defaults', () => {
      const config = parseTeamConfigString(MINIMAL_YAML);
      expect(config.team).toBe('test-team');
      expect(config.policies.minCoverage).toBe(0);
      expect(config.policies.requiredChecks).toEqual([]);
    });

    it('should support camelCase YAML keys', () => {
      const config = parseTeamConfigString(CAMEL_CASE_YAML);
      expect(config.policies.minCoverage).toBe(80);
      expect(config.policies.requiredChecks).toEqual(['secret-scanning']);
    });

    it('should throw TeamConfigError on invalid YAML', () => {
      expect(() => parseTeamConfigString('{ invalid yaml [')).toThrow(TeamConfigError);
    });

    it('should throw TeamConfigError on empty content', () => {
      expect(() => parseTeamConfigString('')).toThrow(TeamConfigError);
    });

    it('should throw TeamConfigError on missing required fields', () => {
      const yaml = 'version: 1\nteam: "x"';
      expect(() => parseTeamConfigString(yaml)).toThrow(TeamConfigError);
    });

    it('should include source path in error', () => {
      try {
        parseTeamConfigString('bad: yaml: [', '/my/path.yml');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TeamConfigError);
        expect((err as TeamConfigError).configPath).toBe('/my/path.yml');
      }
    });

    it('should default banned_pattern severity to error', () => {
      const yaml = `
version: 1
team: "test"
policies:
  banned_patterns:
    - pattern: "eval("
      reason: "No eval"
`;
      const config = parseTeamConfigString(yaml);
      expect(config.policies.bannedPatterns[0].severity).toBe('error');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Config Resolution
// ═══════════════════════════════════════════════════════════════════════════════

describe('TeamConfig Resolution', () => {
  describe('resolveConfigSync', () => {
    it('should return defaults when no team config provided', () => {
      const resolved = resolveConfigSync(null);
      expect(resolved.team).toBeNull();
      expect(resolved.policies.minCoverage).toBe(0);
    });

    it('should apply team policies over defaults', () => {
      const resolved = resolveConfigSync(
        { minCoverage: 70, requiredChecks: ['secret-scanning'] },
        undefined,
        'acme',
      );
      expect(resolved.team).toBe('acme');
      expect(resolved.policies.minCoverage).toBe(70);
      expect(resolved.policies.requiredChecks).toEqual(['secret-scanning']);
      expect(resolved.policies.minSpecQuality).toBe(0); // default
    });

    it('should apply repo overrides over team config', () => {
      const resolved = resolveConfigSync(
        { minCoverage: 70, minSpecQuality: 60 },
        { minCoverage: 90 },
        'acme',
      );
      expect(resolved.policies.minCoverage).toBe(90); // repo override
      expect(resolved.policies.minSpecQuality).toBe(60); // from team
    });

    it('should handle three-level merge: defaults → team → repo', () => {
      const resolved = resolveConfigSync(
        {
          minCoverage: 50,
          security: { requireRateLimiting: true, requireErrorConsistency: false, requirePasswordHashing: false },
        },
        {
          security: { requireErrorConsistency: true },
        },
        'acme',
      );
      expect(resolved.policies.minCoverage).toBe(50);
      expect(resolved.policies.security.requireRateLimiting).toBe(true);   // from team
      expect(resolved.policies.security.requireErrorConsistency).toBe(true); // repo override
      expect(resolved.policies.security.requirePasswordHashing).toBe(false); // from team
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Policy Enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('Policy Enforcement', () => {
  describe('enforceTeamPolicies', () => {
    it('should pass when all policies are satisfied', () => {
      const config = makeResolvedConfig();
      const input = makePassingInput();
      const result = enforceTeamPolicies(input, config);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    describe('coverage checks', () => {
      it('should fail when coverage is below minimum', () => {
        const config = makeResolvedConfig({ minCoverage: 80 });
        const input = makePassingInput({
          coverage: { percentage: 60, coveredFiles: [], uncoveredFiles: [] },
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.passed).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            policy: 'min_coverage',
            severity: 'error',
          }),
        );
      });

      it('should pass when coverage equals minimum', () => {
        const config = makeResolvedConfig({ minCoverage: 70 });
        const input = makePassingInput({
          coverage: { percentage: 70, coveredFiles: [], uncoveredFiles: [] },
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'min_coverage')).toBeUndefined();
      });

      it('should skip coverage check when minCoverage is 0', () => {
        const config = makeResolvedConfig({ minCoverage: 0 });
        const input = makePassingInput({
          coverage: { percentage: 0, coveredFiles: [], uncoveredFiles: [] },
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'min_coverage')).toBeUndefined();
      });
    });

    describe('spec quality checks', () => {
      it('should fail when spec quality is below minimum', () => {
        const config = makeResolvedConfig({ minSpecQuality: 60 });
        const input = makePassingInput({ specQuality: 40 });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations).toContainEqual(
          expect.objectContaining({ policy: 'min_spec_quality' }),
        );
      });

      it('should skip when spec quality is not available', () => {
        const config = makeResolvedConfig({ minSpecQuality: 60 });
        const input = makePassingInput({ specQuality: undefined });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'min_spec_quality')).toBeUndefined();
      });
    });

    describe('required checks', () => {
      it('should fail when required checks are missing', () => {
        const config = makeResolvedConfig({
          requiredChecks: ['hallucination-detection', 'secret-scanning', 'vulnerability-scanning'],
        });
        const input = makePassingInput({
          checksRun: ['hallucination-detection', 'secret-scanning'],
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            policy: 'required_checks',
            message: expect.stringContaining('vulnerability-scanning'),
          }),
        );
      });

      it('should pass when all required checks were run', () => {
        const config = makeResolvedConfig({ requiredChecks: ['a', 'b'] });
        const input = makePassingInput({ checksRun: ['a', 'b', 'c'] });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'required_checks')).toBeUndefined();
      });
    });

    describe('critical paths', () => {
      it('should fail when critical path files are uncovered', () => {
        const config = makeResolvedConfig({ criticalPaths: ['**/auth/**'] });
        const input = makePassingInput({
          sourceFiles: ['src/auth/login.ts', 'src/auth/signup.ts', 'src/utils.ts'],
          coverage: {
            percentage: 80,
            coveredFiles: ['src/utils.ts'],
            uncoveredFiles: ['src/auth/login.ts', 'src/auth/signup.ts'],
          },
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            policy: 'critical_path_coverage',
            files: expect.arrayContaining(['src/auth/login.ts']),
          }),
        );
      });

      it('should pass when all critical path files are covered', () => {
        const config = makeResolvedConfig({ criticalPaths: ['**/auth/**'] });
        const input = makePassingInput({
          sourceFiles: ['src/auth/login.ts'],
          coverage: {
            percentage: 100,
            coveredFiles: ['src/auth/login.ts'],
            uncoveredFiles: [],
          },
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'critical_path_coverage')).toBeUndefined();
      });

      it('should handle no files matching the critical path', () => {
        const config = makeResolvedConfig({ criticalPaths: ['**/payment*/**'] });
        const input = makePassingInput({ sourceFiles: ['src/utils.ts'] });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'critical_path_coverage')).toBeUndefined();
      });
    });

    describe('banned patterns', () => {
      it('should detect banned patterns in source files', () => {
        const config = makeResolvedConfig({
          bannedPatterns: [
            { pattern: 'eval\\(', reason: 'No eval', severity: 'error' },
          ],
        });
        const input = makePassingInput({
          sourceContents: new Map([
            ['src/util.ts', 'const result = eval("1+1");'],
            ['src/safe.ts', 'const x = 1;'],
          ]),
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            policy: 'banned_pattern',
            files: ['src/util.ts'],
          }),
        );
      });

      it('should detect literal patterns that are not valid regex', () => {
        const config = makeResolvedConfig({
          bannedPatterns: [
            { pattern: 'eval(', reason: 'No eval', severity: 'error' },
          ],
        });
        const input = makePassingInput({
          sourceContents: new Map([
            ['src/bad.ts', 'const result = eval("code");'],
          ]),
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.violations).toContainEqual(
          expect.objectContaining({ policy: 'banned_pattern' }),
        );
      });

      it('should use the correct severity from the banned pattern', () => {
        const config = makeResolvedConfig({
          bannedPatterns: [
            { pattern: 'TODO.*hack', reason: 'No hacks', severity: 'warning' },
          ],
        });
        const input = makePassingInput({
          sourceContents: new Map([
            ['src/code.ts', '// TODO: hack around auth'],
          ]),
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.passed).toBe(true); // warnings don't fail
        expect(result.violations).toContainEqual(
          expect.objectContaining({ severity: 'warning' }),
        );
      });

      it('should skip banned pattern check when sourceContents is not provided', () => {
        const config = makeResolvedConfig({
          bannedPatterns: [{ pattern: 'eval', reason: 'bad', severity: 'error' }],
        });
        const input = makePassingInput(); // no sourceContents
        const result = enforceTeamPolicies(input, config);
        expect(result.violations.find((v) => v.policy === 'banned_pattern')).toBeUndefined();
      });
    });

    describe('result summary', () => {
      it('should count violations by severity', () => {
        const config = makeResolvedConfig({
          minCoverage: 80,
          bannedPatterns: [
            { pattern: 'TODO', reason: 'no todos', severity: 'warning' },
          ],
        });
        const input = makePassingInput({
          coverage: { percentage: 50, coveredFiles: [], uncoveredFiles: [] },
          sourceContents: new Map([['src/a.ts', '// TODO: fix']]),
        });
        const result = enforceTeamPolicies(input, config);
        expect(result.summary.errors).toBe(1);
        expect(result.summary.warnings).toBe(1);
        expect(result.passed).toBe(false); // has errors
      });
    });
  });

  describe('formatPolicyResult', () => {
    it('should format a passing result', () => {
      const result = { violations: [], passed: true, summary: { errors: 0, warnings: 0, infos: 0 } };
      const output = formatPolicyResult(result);
      expect(output).toContain('All policies passed');
    });

    it('should format violations with team name', () => {
      const result = {
        violations: [
          { policy: 'min_coverage', message: 'Coverage 50% below minimum 70%', severity: 'error' as const },
        ],
        passed: false,
        summary: { errors: 1, warnings: 0, infos: 0 },
      };
      const output = formatPolicyResult(result, 'acme');
      expect(output).toContain('team: acme');
      expect(output).toContain('min_coverage');
      expect(output).toContain('FAILED');
    });

    it('should show affected files (truncated at 5)', () => {
      const files = Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`);
      const result = {
        violations: [
          { policy: 'critical_path_coverage', message: 'Uncovered', severity: 'error' as const, files },
        ],
        passed: false,
        summary: { errors: 1, warnings: 0, infos: 0 },
      };
      const output = formatPolicyResult(result);
      expect(output).toContain('src/file0.ts');
      expect(output).toContain('src/file4.ts');
      expect(output).toContain('and 3 more');
    });
  });
});
