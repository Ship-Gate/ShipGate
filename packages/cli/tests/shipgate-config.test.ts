// ============================================================================
// ShipGate Configuration Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';

// ── Imports under test ──────────────────────────────────────────────────────

import {
  validateConfig,
  formatValidationErrors,
} from '../src/config/validator.js';

import {
  applyDefaults,
  DEFAULT_SHIPGATE_CONFIG,
  DEFAULT_CI_CONFIG,
  DEFAULT_SCANNING_CONFIG,
  DEFAULT_GENERATE_CONFIG,
} from '../src/config/schema.js';
import type { ShipGateConfig } from '../src/config/schema.js';

import {
  loadShipGateConfig,
  loadShipGateConfigFromFile,
  ShipGateConfigError,
} from '../src/config/loader.js';

import {
  shouldVerify,
  filterVerifiableFiles,
  findMissingRequiredSpecs,
} from '../src/config/glob-matcher.js';

import { generateStarterConfig } from '../src/config/init-template.js';

// ── Test directories ────────────────────────────────────────────────────────

const TEMP_DIR = resolve(__dirname, '../../../.test-temp/shipgate-config');

function ensureCleanDir(dir: string) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

// ============================================================================
// Schema & Defaults
// ============================================================================

describe('ShipGate Schema', () => {
  it('DEFAULT_SHIPGATE_CONFIG has all required fields', () => {
    expect(DEFAULT_SHIPGATE_CONFIG.version).toBe(1);
    expect(DEFAULT_SHIPGATE_CONFIG.ci).toBeDefined();
    expect(DEFAULT_SHIPGATE_CONFIG.scanning).toBeDefined();
    expect(DEFAULT_SHIPGATE_CONFIG.generate).toBeDefined();
  });

  it('DEFAULT_CI_CONFIG has correct defaults', () => {
    expect(DEFAULT_CI_CONFIG.failOn).toBe('error');
    expect(DEFAULT_CI_CONFIG.requireIsl).toEqual([]);
    expect(DEFAULT_CI_CONFIG.ignore).toEqual([]);
    expect(DEFAULT_CI_CONFIG.speclessMode).toBe('on');
  });

  it('DEFAULT_SCANNING_CONFIG enables all checks', () => {
    expect(DEFAULT_SCANNING_CONFIG.hallucinations).toBe(true);
    expect(DEFAULT_SCANNING_CONFIG.fakeFeatures).toBe(true);
    expect(DEFAULT_SCANNING_CONFIG.secrets).toBe(true);
    expect(DEFAULT_SCANNING_CONFIG.vulnerabilities).toBe(true);
  });

  it('DEFAULT_GENERATE_CONFIG has correct defaults', () => {
    expect(DEFAULT_GENERATE_CONFIG.output).toBe('.shipgate/specs');
    expect(DEFAULT_GENERATE_CONFIG.minConfidence).toBe(0.3);
  });

  describe('applyDefaults', () => {
    it('fills in all defaults for empty partial', () => {
      const config = applyDefaults({});
      expect(config.version).toBe(1);
      expect(config.ci?.failOn).toBe('error');
      expect(config.ci?.requireIsl).toEqual([]);
      expect(config.scanning?.hallucinations).toBe(true);
      expect(config.generate?.minConfidence).toBe(0.3);
    });

    it('preserves user-specified values', () => {
      const config = applyDefaults({
        ci: { failOn: 'warning', requireIsl: ['src/auth/**'] },
        scanning: { secrets: false },
      });
      expect(config.ci?.failOn).toBe('warning');
      expect(config.ci?.requireIsl).toEqual(['src/auth/**']);
      expect(config.ci?.ignore).toEqual([]);
      expect(config.scanning?.secrets).toBe(false);
      expect(config.scanning?.hallucinations).toBe(true);
    });
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('ShipGate Validator', () => {
  describe('valid configs', () => {
    it('accepts minimal valid config', () => {
      const result = validateConfig({ version: 1 });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config?.version).toBe(1);
    });

    it('accepts full valid config', () => {
      const result = validateConfig({
        version: 1,
        ci: {
          failOn: 'warning',
          requireIsl: ['src/auth/**', 'src/payments/**'],
          ignore: ['**/*.test.ts', '**/*.spec.ts'],
          speclessMode: 'warn-only',
        },
        scanning: {
          hallucinations: true,
          fakeFeatures: false,
          secrets: true,
          vulnerabilities: true,
        },
        generate: {
          output: './specs',
          minConfidence: 0.5,
        },
      });
      expect(result.valid).toBe(true);
      expect(result.config?.ci?.failOn).toBe('warning');
      expect(result.config?.ci?.speclessMode).toBe('warn-only');
    });

    it('accepts snake_case keys (fail_on, require_isl)', () => {
      const result = validateConfig({
        version: 1,
        ci: {
          fail_on: 'unspecced',
          require_isl: ['src/**'],
          specless_mode: 'off',
        },
        scanning: {
          fake_features: false,
        },
        generate: {
          min_confidence: 0.7,
        },
      });
      expect(result.valid).toBe(true);
      expect(result.config?.ci?.failOn).toBe('unspecced');
      expect(result.config?.ci?.requireIsl).toEqual(['src/**']);
      expect(result.config?.ci?.speclessMode).toBe('off');
      expect(result.config?.scanning?.fakeFeatures).toBe(false);
      expect(result.config?.generate?.minConfidence).toBe(0.7);
    });

    it('accepts config with only ci section', () => {
      const result = validateConfig({
        version: 1,
        ci: { failOn: 'error' },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid configs', () => {
    it('rejects non-object', () => {
      const result = validateConfig('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must be a YAML mapping');
    });

    it('rejects null', () => {
      const result = validateConfig(null);
      expect(result.valid).toBe(false);
    });

    it('rejects array', () => {
      const result = validateConfig([1, 2, 3]);
      expect(result.valid).toBe(false);
    });

    it('rejects missing version', () => {
      const result = validateConfig({ ci: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'version' }),
      );
    });

    it('rejects wrong version', () => {
      const result = validateConfig({ version: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors[0].got).toBe(2);
    });

    it('rejects invalid failOn value', () => {
      const result = validateConfig({
        version: 1,
        ci: { failOn: 'strict' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('ci.failOn');
      expect(result.errors[0].message).toContain('must be one of');
      expect(result.errors[0].got).toBe('strict');
    });

    it('rejects non-array requireIsl', () => {
      const result = validateConfig({
        version: 1,
        ci: { requireIsl: 'src/**' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('ci.requireIsl');
    });

    it('rejects non-string items in requireIsl', () => {
      const result = validateConfig({
        version: 1,
        ci: { requireIsl: ['valid', 123] },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('ci.requireIsl[1]');
    });

    it('rejects invalid speclessMode', () => {
      const result = validateConfig({
        version: 1,
        ci: { speclessMode: 'auto' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('ci.speclessMode');
    });

    it('rejects non-boolean scanning fields', () => {
      const result = validateConfig({
        version: 1,
        scanning: { secrets: 'yes' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('scanning.secrets');
    });

    it('rejects out-of-range minConfidence', () => {
      const result = validateConfig({
        version: 1,
        generate: { minConfidence: 5 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('generate.minConfidence');
    });

    it('rejects non-string generate.output', () => {
      const result = validateConfig({
        version: 1,
        generate: { output: 123 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('generate.output');
    });

    it('collects multiple errors', () => {
      const result = validateConfig({
        version: 2,
        ci: { failOn: 'strict', speclessMode: 'auto' },
        generate: { minConfidence: 5 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('formatValidationErrors', () => {
    it('formats errors with file path', () => {
      const errors = [
        { path: 'ci.failOn', message: 'must be one of: error, warning, unspecced', got: 'strict' },
      ];
      const formatted = formatValidationErrors(errors, '.shipgate.yml');
      expect(formatted).toContain('Error in .shipgate.yml:');
      expect(formatted).toContain('must be one of');
      expect(formatted).toContain('"strict"');
    });

    it('formats errors without file path', () => {
      const errors = [
        { path: 'version', message: 'version is required and must be 1' },
      ];
      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain('Error in .shipgate.yml:');
    });
  });
});

// ============================================================================
// Loader
// ============================================================================

describe('ShipGate Loader', () => {
  const LOADER_DIR = join(TEMP_DIR, 'loader');

  beforeAll(() => {
    ensureCleanDir(LOADER_DIR);
  });

  afterAll(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('loadShipGateConfig', () => {
    it('returns defaults when no config file exists', async () => {
      const emptyDir = join(LOADER_DIR, 'empty');
      ensureCleanDir(emptyDir);

      const result = await loadShipGateConfig(emptyDir);
      expect(result.source).toBe('defaults');
      expect(result.configPath).toBeNull();
      expect(result.config.version).toBe(1);
      expect(result.config.ci?.failOn).toBe('error');
    });

    it('loads .shipgate.yml from current directory', async () => {
      const dir = join(LOADER_DIR, 'yml-test');
      ensureCleanDir(dir);
      writeFileSync(join(dir, '.shipgate.yml'), `
version: 1
ci:
  fail_on: warning
`);

      const result = await loadShipGateConfig(dir);
      expect(result.source).toBe('file');
      expect(result.configPath).toBe(join(dir, '.shipgate.yml'));
      expect(result.config.ci?.failOn).toBe('warning');
    });

    it('loads .shipgate.yaml variant', async () => {
      const dir = join(LOADER_DIR, 'yaml-test');
      ensureCleanDir(dir);
      writeFileSync(join(dir, '.shipgate.yaml'), `
version: 1
ci:
  fail_on: unspecced
`);

      const result = await loadShipGateConfig(dir);
      expect(result.source).toBe('file');
      expect(result.config.ci?.failOn).toBe('unspecced');
    });

    it('loads shipgate.config.yml variant', async () => {
      const dir = join(LOADER_DIR, 'config-yml-test');
      ensureCleanDir(dir);
      writeFileSync(join(dir, 'shipgate.config.yml'), `
version: 1
scanning:
  secrets: false
`);

      const result = await loadShipGateConfig(dir);
      expect(result.source).toBe('file');
      expect(result.config.scanning?.secrets).toBe(false);
      // Defaults still applied
      expect(result.config.scanning?.hallucinations).toBe(true);
    });

    it('walks up directories to find config', async () => {
      const parentDir = join(LOADER_DIR, 'parent-walk');
      const childDir = join(parentDir, 'child', 'grandchild');
      ensureCleanDir(childDir);
      writeFileSync(join(parentDir, '.shipgate.yml'), `
version: 1
ci:
  fail_on: warning
`);

      const result = await loadShipGateConfig(childDir);
      expect(result.source).toBe('file');
      expect(result.configPath).toBe(join(parentDir, '.shipgate.yml'));
      expect(result.config.ci?.failOn).toBe('warning');
    });

    it('prioritizes .shipgate.yml over .shipgate.yaml', async () => {
      const dir = join(LOADER_DIR, 'priority-test');
      ensureCleanDir(dir);
      writeFileSync(join(dir, '.shipgate.yml'), `
version: 1
ci:
  fail_on: error
`);
      writeFileSync(join(dir, '.shipgate.yaml'), `
version: 1
ci:
  fail_on: warning
`);

      const result = await loadShipGateConfig(dir);
      expect(result.config.ci?.failOn).toBe('error');
    });

    it('applies defaults for omitted sections', async () => {
      const dir = join(LOADER_DIR, 'defaults-test');
      ensureCleanDir(dir);
      writeFileSync(join(dir, '.shipgate.yml'), `
version: 1
ci:
  fail_on: warning
`);

      const result = await loadShipGateConfig(dir);
      // CI section partially overridden
      expect(result.config.ci?.failOn).toBe('warning');
      expect(result.config.ci?.ignore).toEqual([]);
      // Other sections fully defaulted
      expect(result.config.scanning?.hallucinations).toBe(true);
      expect(result.config.generate?.minConfidence).toBe(0.3);
    });
  });

  describe('loadShipGateConfigFromFile', () => {
    it('loads a valid config file', async () => {
      const filePath = join(LOADER_DIR, 'specific.yml');
      writeFileSync(filePath, `
version: 1
ci:
  fail_on: unspecced
  require_isl:
    - "src/auth/**"
  ignore:
    - "**/*.test.ts"
scanning:
  secrets: true
generate:
  output: ./my-specs
  min_confidence: 0.5
`);

      const result = await loadShipGateConfigFromFile(filePath);
      expect(result.config.ci?.failOn).toBe('unspecced');
      expect(result.config.ci?.requireIsl).toEqual(['src/auth/**']);
      expect(result.config.ci?.ignore).toEqual(['**/*.test.ts']);
      expect(result.config.generate?.output).toBe('./my-specs');
      expect(result.config.generate?.minConfidence).toBe(0.5);
    });

    it('throws on invalid YAML', async () => {
      const filePath = join(LOADER_DIR, 'bad-yaml.yml');
      writeFileSync(filePath, `
version: 1
  bad indentation: [
`);

      await expect(loadShipGateConfigFromFile(filePath)).rejects.toThrow('Failed to parse');
    });

    it('throws on empty file', async () => {
      const filePath = join(LOADER_DIR, 'empty.yml');
      writeFileSync(filePath, '');

      await expect(loadShipGateConfigFromFile(filePath)).rejects.toThrow('is empty');
    });

    it('throws ShipGateConfigError on validation failure', async () => {
      const filePath = join(LOADER_DIR, 'invalid-config.yml');
      writeFileSync(filePath, `
version: 2
ci:
  fail_on: strict
`);

      try {
        await loadShipGateConfigFromFile(filePath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ShipGateConfigError);
        const configErr = err as ShipGateConfigError;
        expect(configErr.validationErrors.length).toBeGreaterThan(0);
        expect(configErr.configPath).toBe(filePath);
      }
    });
  });
});

// ============================================================================
// Glob Matcher
// ============================================================================

describe('ShipGate Glob Matcher', () => {
  describe('shouldVerify', () => {
    it('returns verify=true for any file with default config', () => {
      const config: ShipGateConfig = { version: 1 };
      const result = shouldVerify('src/auth/login.ts', config);
      expect(result.verify).toBe(true);
      expect(result.requireIsl).toBe(false);
    });

    it('ignores files matching ci.ignore patterns', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: { ignore: ['**/*.test.ts', '**/*.spec.ts'] },
      };

      expect(shouldVerify('src/auth/login.test.ts', config).verify).toBe(false);
      expect(shouldVerify('src/auth/login.spec.ts', config).verify).toBe(false);
      expect(shouldVerify('src/auth/login.ts', config).verify).toBe(true);
    });

    it('ignores files matching directory patterns', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: { ignore: ['src/generated/**'] },
      };

      expect(shouldVerify('src/generated/types.ts', config).verify).toBe(false);
      expect(shouldVerify('src/generated/deep/file.ts', config).verify).toBe(false);
      expect(shouldVerify('src/auth/login.ts', config).verify).toBe(true);
    });

    it('marks files matching requireIsl patterns', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: {
          requireIsl: ['src/auth/**', 'src/payments/**'],
        },
      };

      const authResult = shouldVerify('src/auth/login.ts', config);
      expect(authResult.verify).toBe(true);
      expect(authResult.requireIsl).toBe(true);
      expect(authResult.reason).toContain('ISL spec required');

      const payResult = shouldVerify('src/payments/checkout.ts', config);
      expect(payResult.requireIsl).toBe(true);

      const otherResult = shouldVerify('src/utils/helpers.ts', config);
      expect(otherResult.requireIsl).toBe(false);
    });

    it('ignore takes precedence over requireIsl', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: {
          requireIsl: ['src/auth/**'],
          ignore: ['**/*.test.ts'],
        },
      };

      const result = shouldVerify('src/auth/login.test.ts', config);
      expect(result.verify).toBe(false);
      expect(result.requireIsl).toBe(false);
    });

    it('normalizes Windows backslashes', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: { ignore: ['src/generated/**'] },
      };

      expect(shouldVerify('src\\generated\\types.ts', config).verify).toBe(false);
    });

    it('handles leading ./ in paths', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: { ignore: ['src/generated/**'] },
      };

      expect(shouldVerify('./src/generated/types.ts', config).verify).toBe(false);
    });
  });

  describe('filterVerifiableFiles', () => {
    it('filters out ignored files', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: {
          ignore: ['**/*.test.ts'],
          requireIsl: ['src/auth/**'],
        },
      };

      const files = [
        'src/auth/login.ts',
        'src/auth/login.test.ts',
        'src/utils/helpers.ts',
      ];

      const result = filterVerifiableFiles(files, config);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ path: 'src/auth/login.ts', requireIsl: true });
      expect(result[1]).toEqual({ path: 'src/utils/helpers.ts', requireIsl: false });
    });
  });

  describe('findMissingRequiredSpecs', () => {
    it('returns files that match requireIsl but have no spec', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: { requireIsl: ['src/auth/**'] },
      };

      const codeFiles = ['src/auth/login.ts', 'src/auth/register.ts', 'src/utils/helpers.ts'];
      const specMap = new Map([['src/auth/login.ts', 'specs/auth-login.isl']]);

      const missing = findMissingRequiredSpecs(codeFiles, specMap, config);
      expect(missing).toEqual(['src/auth/register.ts']);
    });

    it('returns empty array when all required files have specs', () => {
      const config: ShipGateConfig = {
        version: 1,
        ci: { requireIsl: ['src/auth/**'] },
      };

      const codeFiles = ['src/auth/login.ts'];
      const specMap = new Map([['src/auth/login.ts', 'specs/auth-login.isl']]);

      const missing = findMissingRequiredSpecs(codeFiles, specMap, config);
      expect(missing).toEqual([]);
    });

    it('returns empty array when no requireIsl patterns', () => {
      const config: ShipGateConfig = { version: 1 };
      const codeFiles = ['src/auth/login.ts'];
      const specMap = new Map<string, string>();

      const missing = findMissingRequiredSpecs(codeFiles, specMap, config);
      expect(missing).toEqual([]);
    });
  });
});

// ============================================================================
// Init Template
// ============================================================================

describe('ShipGate Init Template', () => {
  it('generates valid YAML content', () => {
    const content = generateStarterConfig();
    expect(content).toContain('version: 1');
    expect(content).toContain('fail_on: error');
    expect(content).toContain('ignore:');
    expect(content).toContain('**/*.test.ts');
    expect(content).toContain('**/*.spec.ts');
    expect(content).toContain('specless_mode:');
    expect(content).toContain('hallucinations: true');
    expect(content).toContain('min_confidence: 0.3');
  });

  it('generated content passes validation', async () => {
    const content = generateStarterConfig();

    // Parse YAML
    const { parse: parseYaml } = await import('yaml');
    const parsed = parseYaml(content);

    const result = validateConfig(parsed);
    expect(result.valid).toBe(true);
    expect(result.config?.version).toBe(1);
    expect(result.config?.ci?.failOn).toBe('error');
  });

  it('includes documentation link', () => {
    const content = generateStarterConfig();
    expect(content).toContain('https://shipgate.dev/docs/config');
  });

  it('has commented-out require_isl examples', () => {
    const content = generateStarterConfig();
    expect(content).toContain('# require_isl:');
    expect(content).toContain('#   - src/auth/**');
    expect(content).toContain('#   - src/payments/**');
  });
});

// ============================================================================
// Integration (End-to-End via CLI)
// ============================================================================

describe('ShipGate CLI Integration', () => {
  const E2E_DIR = join(TEMP_DIR, 'e2e');

  beforeAll(async () => {
    ensureCleanDir(E2E_DIR);
  });

  afterAll(() => {
    if (existsSync(E2E_DIR)) {
      rmSync(E2E_DIR, { recursive: true, force: true });
    }
  });

  it('loadShipGateConfig + shouldVerify integration', async () => {
    const dir = join(E2E_DIR, 'integration-1');
    ensureCleanDir(dir);
    writeFileSync(join(dir, '.shipgate.yml'), `
version: 1
ci:
  fail_on: warning
  require_isl:
    - "src/auth/**"
  ignore:
    - "**/*.test.ts"
    - "src/generated/**"
`);

    const { config } = await loadShipGateConfig(dir);

    // Ignored files
    expect(shouldVerify('src/auth/login.test.ts', config).verify).toBe(false);
    expect(shouldVerify('src/generated/types.ts', config).verify).toBe(false);

    // Required ISL files
    const authResult = shouldVerify('src/auth/login.ts', config);
    expect(authResult.verify).toBe(true);
    expect(authResult.requireIsl).toBe(true);

    // Normal files
    const utilResult = shouldVerify('src/utils/helpers.ts', config);
    expect(utilResult.verify).toBe(true);
    expect(utilResult.requireIsl).toBe(false);
  });
});
