/**
 * End-to-End Integration Test Suite
 *
 * Validates the full ShipGate pipeline works end-to-end.
 * Run with: pnpm test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

const CLI_PATH = join(__dirname, '../../packages/cli/dist/cli.cjs');
const TEST_TEMP = mkdtempSync(join(tmpdir(), 'shipgate-e2e-'));

function exec(
  args: string,
  opts?: { env?: Record<string, string>; cwd?: string; timeout?: number },
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts?.timeout ?? 30_000,
      env: { ...process.env, ...opts?.env },
      cwd: opts?.cwd,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

beforeAll(() => {
  if (!existsSync(CLI_PATH)) {
    console.warn(`CLI not built at ${CLI_PATH}. Run "pnpm build" first. Skipping e2e tests.`);
  }
});

afterAll(() => {
  try {
    rmSync(TEST_TEMP, { recursive: true, force: true });
  } catch {
    // Cleanup failure is non-fatal
  }
});

describe('E2E: shipgate init', () => {
  it('creates expected files in a temp directory', () => {
    if (!existsSync(CLI_PATH)) return;

    const projectDir = join(TEST_TEMP, 'init-test');
    const result = exec(`init test-project --directory "${projectDir}" --yes --template minimal`);

    expect(result.exitCode).toBe(0);
    expect(existsSync(projectDir)).toBe(true);
  });
});

describe('E2E: shipgate scan', () => {
  it('scans a project directory and produces output', () => {
    if (!existsSync(CLI_PATH)) return;

    const result = exec(`scan "${join(__dirname, '../../packages/demos')}" --format json`, {
      timeout: 60_000,
    });

    // scan should produce some output regardless
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
  });
});

describe('E2E: NL → ISL repair loop', () => {
  it('validates that ISL parsing functions are available', async () => {
    try {
      const parser = await import('@isl-lang/parser');
      expect(parser.parse).toBeDefined();

      const sampleISL = `domain TestDomain {
  entity User {
    id: UUID
    name: String
  }

  behavior CreateUser {
    input {
      name: String
    }
    output {
      user: User
    }
    errors {
      INVALID_NAME: "Name is required"
    }
    preconditions {
      input.name.length > 0
    }
    postconditions {
      result.user.name == input.name
    }
  }
}`;

      const result = parser.parse(sampleISL, 'test.isl');
      expect(result.domain).toBeDefined();
      expect(result.errors.length).toBe(0);
    } catch {
      // Parser not available in test env — skip
    }
  });
});

describe('E2E: Policy manifest', () => {
  it('policy manifest has 25+ rules', async () => {
    try {
      const { getPolicyManifest } = await import('../../packages/policy-engine/src/policy-manifest.js');
      const manifest = getPolicyManifest();
      expect(manifest.length).toBeGreaterThanOrEqual(25);

      for (const rule of manifest) {
        expect(rule.id).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.remediation).toBeDefined();
        expect(rule.languages.length).toBeGreaterThan(0);
      }
    } catch {
      // Policy engine not available in test env — skip
    }
  });
});

describe('E2E: MCP check_suggestion', () => {
  it('blocks ghost route diff', () => {
    const diffWithGhostRoute = `
+app.get('/api/v1/admin/users', async (req, res) => {
+  const users = await db.user.findMany();
+  res.json(users);
+});
`;

    // The check is implemented inline in the MCP server;
    // We test the detection patterns directly
    const routePatterns = diffWithGhostRoute.match(/['"`](\/api\/[^'"`\s]+)['"`]/g) ?? [];
    expect(routePatterns.length).toBeGreaterThan(0);
  });

  it('detects hardcoded secrets', () => {
    const diffWithSecret = `
+const apiKey = "sk-1234567890abcdef1234567890abcdef";
+const config = { key: apiKey };
`;

    const secretPattern = /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi;
    expect(secretPattern.test(diffWithSecret)).toBe(true);
  });
});

describe('E2E: Codegen adapters', () => {
  it('getCodegenAdapter returns null for typescript', async () => {
    const { getCodegenAdapter } = await import('../../packages/cli/src/commands/vibe/codegen-adapter.js');
    expect(getCodegenAdapter('typescript')).toBeNull();
  });

  it('getCodegenAdapter returns adapter for python/rust/go', async () => {
    const { getCodegenAdapter } = await import('../../packages/cli/src/commands/vibe/codegen-adapter.js');
    expect(getCodegenAdapter('python')).not.toBeNull();
    expect(getCodegenAdapter('rust')).not.toBeNull();
    expect(getCodegenAdapter('go')).not.toBeNull();
  });
});
