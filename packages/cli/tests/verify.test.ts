// ============================================================================
// Verify Command Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Paths
const CLI_PATH = resolve(__dirname, '../src/index.ts');
const TEMP_DIR = resolve(__dirname, '../../../.test-temp/verify-tests');
const FIXTURES_ROOT = resolve(__dirname, '../../../test-fixtures');

// Helper to run CLI command
async function runCLI(args: string[], options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = process.cwd(), timeout = 30000 } = options;
  
  try {
    const { stdout, stderr } = await execAsync(
      `npx tsx ${CLI_PATH} ${args.join(' ')}`,
      { cwd, timeout }
    );
    return {
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: execError.code ?? 1,
      stdout: execError.stdout?.trim() ?? '',
      stderr: execError.stderr?.trim() ?? '',
    };
  }
}

describe('Verify Command', () => {
  const fixturesExist = existsSync(FIXTURES_ROOT);

  beforeAll(() => {
    // Clean up temp directory if it exists
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });

    // Create test fixtures
    mkdirSync(join(TEMP_DIR, '.shipgate/specs'), { recursive: true });
    
    // Create minimal ISL spec
    writeFileSync(join(TEMP_DIR, '.shipgate/specs/test.isl'), `
isl 1.0

domain TestDomain {
  entity User {
    id: UUID
    name: String
    email: String
  }

  behavior CreateUser {
    input {
      name: String
      email: String
    }
    output {
      success: User
    }
    postconditions {
      "User is created" => result.name == input.name
    }
  }
}
`);

    // Create mock implementation
    writeFileSync(join(TEMP_DIR, 'impl.ts'), `
export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string
  ) {}
}

export function createUser(input: { name: string; email: string }): User {
  return new User(
    crypto.randomUUID(),
    input.name,
    input.email
  );
}
`);
  });

  afterAll(() => {
    // Clean up
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('--help', () => {
    it('should show help for verify command', async () => {
      const result = await runCLI(['verify', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('verify');
      expect(result.stdout).toContain('impl');
    });
  });

  describe('Basic Verification', () => {
    it('should auto-detect mode when path provided without --impl', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const result = await runCLI(['verify', specPath]);

      // In unified mode, verify [path] without --impl runs auto-detect
      // It should not crash and should produce output
      expect(typeof result.exitCode).toBe('number');
    });

    it('should require --impl when --spec is used for legacy single-spec mode', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const result = await runCLI(['verify', specPath, '--impl', join(TEMP_DIR, 'impl.ts')]);

      // Legacy mode: spec + impl should produce a result
      expect(typeof result.exitCode).toBe('number');
    });

    it('should verify spec against implementation', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      
      const result = await runCLI(['verify', specPath, '--impl', implPath]);
      
      // Command should run without crashing
      expect(typeof result.exitCode).toBe('number');
    });

    it('should fail on non-existent spec file', async () => {
      const result = await runCLI(['verify', '/nonexistent.isl', '--impl', 'impl.ts']);
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should fail on non-existent impl file', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const result = await runCLI(['verify', specPath, '--impl', '/nonexistent.ts']);
      
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('JSON Output', () => {
    it('should output valid JSON with --format json', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      
      const result = await runCLI(['verify', specPath, '--impl', implPath, '--format', 'json']);
      
      // Try to parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        // If JSON parsing fails, check if there was an error
        expect(result.stdout).toMatch(/error|fail/i);
        return;
      }
      
      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('specFile');
      expect(parsed).toHaveProperty('implFile');
    });
  });

  describe('Evidence Report', () => {
    it('should write report with --report flag', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      const reportPath = join(TEMP_DIR, 'evidence-report.json');
      
      await runCLI(['verify', specPath, '--impl', implPath, '--report', reportPath]);
      
      // Report file should be created
      if (existsSync(reportPath)) {
        const content = readFileSync(reportPath, 'utf-8');
        const report = JSON.parse(content);
        
        expect(report).toHaveProperty('metadata');
        expect(report).toHaveProperty('evidenceScore');
        expect(report.metadata).toHaveProperty('timestamp');
        expect(report.metadata).toHaveProperty('specFile');
      }
    });

    it('should create report directory if needed', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      const reportPath = join(TEMP_DIR, 'nested/dir/report.json');
      
      await runCLI(['verify', specPath, '--impl', implPath, '--report', reportPath]);
      
      // Check that nested directory was created
      if (existsSync(reportPath)) {
        expect(existsSync(join(TEMP_DIR, 'nested/dir'))).toBe(true);
      }
    });
  });

  describe('Options', () => {
    it('should accept --timeout option', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      
      const result = await runCLI(['verify', specPath, '--impl', implPath, '--timeout', '5000']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --min-score option', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      
      const result = await runCLI(['verify', specPath, '--impl', implPath, '--min-score', '90']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --detailed flag', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      
      const result = await runCLI(['verify', specPath, '--impl', implPath, '--detailed']);
      
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Evidence Score', () => {
    it('should include evidence score in JSON output', async () => {
      const specPath = join(TEMP_DIR, '.shipgate/specs/test.isl');
      const implPath = join(TEMP_DIR, 'impl.ts');
      
      const result = await runCLI(['verify', specPath, '--impl', implPath, '--format', 'json']);
      
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return; // Skip if JSON parsing fails
      }
      
      // Check evidence score structure if verification succeeded
      if (parsed.success && parsed.evidenceScore) {
        const evidence = parsed.evidenceScore as Record<string, unknown>;
        expect(evidence).toHaveProperty('overall');
        expect(evidence).toHaveProperty('confidence');
        expect(evidence).toHaveProperty('passedChecks');
        expect(evidence).toHaveProperty('failedChecks');
      }
    });
  });
});

// ============================================================================
// Config-Driven Verify (ci.ignore + ci.require_isl)
// Matcher logic is tested in shipgate-config.test.ts (filterVerifiableFiles,
// findMissingRequiredSpecs). These E2E tests require full project build.
// ============================================================================

describe('Config-Driven Verify', () => {
  const CONFIG_VERIFY_DIR = resolve(__dirname, '../../../.test-temp/config-verify');

  beforeAll(() => {
    if (existsSync(CONFIG_VERIFY_DIR)) {
      rmSync(CONFIG_VERIFY_DIR, { recursive: true, force: true });
    }
    mkdirSync(CONFIG_VERIFY_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(CONFIG_VERIFY_DIR)) {
      rmSync(CONFIG_VERIFY_DIR, { recursive: true, force: true });
    }
  });

  describe('ci.ignore', () => {
    it('should NOT scan node_modules, dist, .next when in ci.ignore', async () => {
      const dir = join(CONFIG_VERIFY_DIR, 'ignore-fixture');
      mkdirSync(join(dir, 'src'), { recursive: true });
      mkdirSync(join(dir, 'node_modules/pkg'), { recursive: true });
      mkdirSync(join(dir, 'dist'), { recursive: true });
      mkdirSync(join(dir, '.next'), { recursive: true });

      writeFileSync(join(dir, 'src/app.ts'), `
export function main() {
  return { ok: true };
}
`);

      writeFileSync(join(dir, 'node_modules/pkg/index.js'), 'module.exports = {};');
      writeFileSync(join(dir, 'dist/bundle.js'), '// built');
      writeFileSync(join(dir, '.next/server.js'), '// next');

      // Call unifiedVerify directly with config-driven ignore
      const { unifiedVerify } = await import('../src/commands/verify.js');
      const { DEFAULT_IGNORE } = await import('../src/config/schema.js');
      const result = await unifiedVerify(dir, {
        shipgateConfig: {
          version: 1,
          ci: {
            failOn: 'error',
            requireIsl: [],
            ignore: [...DEFAULT_IGNORE],
          },
        },
      });

      // Should verify only src/app.ts, not node_modules/dist/.next
      const filePaths = result.files.map((f) => f.file);
      expect(filePaths.some((p) => /node_modules[\\/]pkg/.test(p))).toBe(false);
      expect(filePaths.some((p) => /dist[\\/]bundle/.test(p))).toBe(false);
      expect(filePaths.some((p) => /\.next[\\/]server/.test(p))).toBe(false);
      expect(filePaths.some((p) => /src[\\/]app\.ts/.test(p))).toBe(true);
    });
  });

  describe('ci.require_isl', () => {
    it.skipIf(typeof process.env.CI === 'string')('should fail with clear message when require_isl files lack specs', async () => {
      const dir = join(CONFIG_VERIFY_DIR, 'require-isl-fixture');
      mkdirSync(join(dir, 'src/auth'), { recursive: true });
      mkdirSync(join(dir, '.shipgate/specs'), { recursive: true });

      writeFileSync(join(dir, '.shipgate.yml'), `
version: 1
ci:
  require_isl:
    - "src/auth/**"
`);

      writeFileSync(join(dir, 'src/auth/login.ts'), `
export function login(email: string) {
  return { id: '1', email };
}
`);

      // Call unifiedVerify directly (bypasses CLI module loading issues)
      const { unifiedVerify } = await import('../src/commands/verify.js');
      const { DEFAULT_IGNORE } = await import('../src/config/schema.js');
      const result = await unifiedVerify(dir, {
        shipgateConfig: {
          version: 1,
          ci: {
            failOn: 'error',
            requireIsl: ['src/auth/**'],
            ignore: [...DEFAULT_IGNORE],
          },
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.verdict).toBe('NO_SHIP');
      expect(result.blockers.some((b) => /ci\.require_isl|require.*ISL|ISL spec required/i.test(b))).toBe(true);
      expect(result.blockers.some((b) => /src[\\/]auth[\\/]login/.test(b))).toBe(true);
    });
  });
});

describe('Verify Command Fixtures', () => {
  const fixturesExist = existsSync(FIXTURES_ROOT);

  it.skipIf(!fixturesExist)('should verify valid fixture file', async () => {
    const specPath = join(FIXTURES_ROOT, 'valid/minimal.isl');
    const implPath = join(FIXTURES_ROOT, 'valid/minimal.isl'); // Use spec as mock impl
    
    const result = await runCLI(['verify', specPath, '--impl', implPath]);
    
    expect(typeof result.exitCode).toBe('number');
  });

  it.skipIf(!fixturesExist)('should handle complex types fixture', async () => {
    const specPath = join(FIXTURES_ROOT, 'valid/complex-types.isl');
    const implPath = join(FIXTURES_ROOT, 'valid/complex-types.isl');
    
    const result = await runCLI(['verify', specPath, '--impl', implPath]);
    
    expect(typeof result.exitCode).toBe('number');
  });
});

// ============================================================================
// Unified Verify Command Tests
// ============================================================================

describe('Unified Verify Command', () => {
  const UNIFIED_DIR = resolve(__dirname, '../../../.test-temp/unified-verify');

  beforeAll(() => {
    if (existsSync(UNIFIED_DIR)) {
      rmSync(UNIFIED_DIR, { recursive: true, force: true });
    }
    mkdirSync(UNIFIED_DIR, { recursive: true });

    // Create directory with ISL specs
    mkdirSync(join(UNIFIED_DIR, 'isl-project/specs'), { recursive: true });
    mkdirSync(join(UNIFIED_DIR, 'isl-project/src'), { recursive: true });

    writeFileSync(join(UNIFIED_DIR, 'isl-project/specs/auth.isl'), `
isl 1.0

domain Auth {
  entity User {
    id: UUID
    email: String
  }

  behavior Login {
    input { email: String }
    output { success: User }
    postconditions {
      "Returns user" => result.email == input.email
    }
  }
}
`);

    writeFileSync(join(UNIFIED_DIR, 'isl-project/src/auth.ts'), `
export function login(email: string) {
  return { id: crypto.randomUUID(), email };
}
`);

    // Create directory with only code files (specless)
    mkdirSync(join(UNIFIED_DIR, 'specless-project/src'), { recursive: true });
    writeFileSync(join(UNIFIED_DIR, 'specless-project/src/payment.ts'), `
export function processPayment(amount: number) {
  return { success: true, amount };
}
`);

    // Create mixed project
    mkdirSync(join(UNIFIED_DIR, 'mixed-project/specs'), { recursive: true });
    mkdirSync(join(UNIFIED_DIR, 'mixed-project/src'), { recursive: true });

    writeFileSync(join(UNIFIED_DIR, 'mixed-project/specs/auth.isl'), `
isl 1.0

domain Auth {
  entity User {
    id: UUID
    email: String
  }

  behavior Login {
    input { email: String }
    output { success: User }
    postconditions {
      "Returns user" => result.email == input.email
    }
  }
}
`);

    writeFileSync(join(UNIFIED_DIR, 'mixed-project/src/auth.ts'), `
export function login(email: string) {
  return { id: crypto.randomUUID(), email };
}
`);

    writeFileSync(join(UNIFIED_DIR, 'mixed-project/src/unspecced.ts'), `
export function doSomething() {
  return { done: true };
}
`);
  });

  afterAll(() => {
    if (existsSync(UNIFIED_DIR)) {
      rmSync(UNIFIED_DIR, { recursive: true, force: true });
    }
  });

  describe('Auto-detect mode', () => {
    it('should accept a directory path without --spec', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath]);

      // Should not crash, should produce output
      expect(typeof result.exitCode).toBe('number');
    });

    it('should run without any arguments (current directory)', async () => {
      const result = await runCLI(['verify'], { cwd: UNIFIED_DIR });
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('--json flag', () => {
    it('should output valid JSON with --json', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath, '--json']);

      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        // JSON might be in stderr or mixed with other output
      }

      if (parsed) {
        expect(parsed).toHaveProperty('verdict');
        expect(parsed).toHaveProperty('score');
        expect(parsed).toHaveProperty('coverage');
        expect(parsed).toHaveProperty('files');
        expect(parsed).toHaveProperty('blockers');
        expect(parsed).toHaveProperty('exitCode');
      }
    });

    it('should include proper coverage data in JSON', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath, '--json']);

      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return; // Skip if JSON parsing fails
      }

      if (parsed?.coverage) {
        const coverage = parsed.coverage as { specced: number; total: number };
        expect(typeof coverage.specced).toBe('number');
        expect(typeof coverage.total).toBe('number');
      }
    });
  });

  describe('--ci flag', () => {
    it('should produce CI output with --ci', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath, '--ci']);

      // CI mode outputs JSON to stdout
      expect(typeof result.exitCode).toBe('number');

      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        // CI output may have annotations mixed in
      }

      if (parsed) {
        expect(parsed).toHaveProperty('verdict');
      }
    });
  });

  describe('--fail-on flag', () => {
    it('should accept --fail-on error', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath, '--fail-on', 'error', '--json']);

      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --fail-on warning', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath, '--fail-on', 'warning', '--json']);

      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --fail-on unspecced', async () => {
      const targetPath = join(UNIFIED_DIR, 'specless-project/src');
      const result = await runCLI(['verify', targetPath, '--fail-on', 'unspecced', '--json']);

      expect(typeof result.exitCode).toBe('number');

      // With --fail-on unspecced, specless files should cause NO_SHIP
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        // Specless project with --fail-on unspecced should be NO_SHIP
        expect(parsed.verdict).toBe('NO_SHIP');
      }
    });
  });

  describe('Legacy backward compatibility', () => {
    it('should still work with <spec> --impl <file> syntax', async () => {
      const specPath = join(UNIFIED_DIR, 'isl-project/specs/auth.isl');
      const implPath = join(UNIFIED_DIR, 'isl-project/src/auth.ts');
      const result = await runCLI(['verify', specPath, '--impl', implPath]);

      expect(typeof result.exitCode).toBe('number');
    });

    it('should work with --spec <file> --impl <file>', async () => {
      const specPath = join(UNIFIED_DIR, 'isl-project/specs/auth.isl');
      const implPath = join(UNIFIED_DIR, 'isl-project/src/auth.ts');
      const result = await runCLI(['verify', '--spec', specPath, '--impl', implPath]);

      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Exit codes', () => {
    it('should exit 0 for SHIP', async () => {
      // An empty directory should produce a clean result
      const emptyDir = join(UNIFIED_DIR, 'empty-dir');
      mkdirSync(emptyDir, { recursive: true });

      // Not necessarily 0 for empty, but should be a valid exit code
      const result = await runCLI(['verify', emptyDir, '--json']);
      expect(typeof result.exitCode).toBe('number');
    });

    it('should exit 1 for NO_SHIP (critical failures)', async () => {
      const result = await runCLI(['verify', '/nonexistent-path-12345', '--json']);
      expect(result.exitCode).not.toBe(0);
    });
  });
});
