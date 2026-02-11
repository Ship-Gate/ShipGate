/**
 * E2E: run shipgate init / check / gate from a separate "consumer" directory using the built CLI.
 * Simulates real-world usage (different cwd, no monorepo context).
 *
 * Optional: set E2E_INSTALL_FROM_PACK=1 and run after `npm pack` in packages/cli to test
 * the installed-from-tarball path (run scripts/e2e-from-pack.sh or manually).
 *
 * Requires: pnpm build in packages/cli first.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_PACKAGE_ROOT = join(__dirname, '..');
const CLI_PATH = join(CLI_PACKAGE_ROOT, 'dist', 'cli.cjs');

function run(cmd: string, cwd: string, timeout = 60_000): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (error: unknown) {
    const e = error as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return {
      exitCode: e.status ?? 1,
      stdout: (e.stdout?.toString() ?? '').trim(),
      stderr: (e.stderr?.toString() ?? '').trim(),
    };
  }
}

function shipgate(args: string, cwd: string, timeout = 60_000) {
  const cliArg = CLI_PATH.replace(/\\/g, '/');
  return run(`node "${cliArg}" ${args}`, cwd, timeout);
}

describe('E2E: consumer project (init / check / gate)', () => {
  let consumerDir: string;

  beforeAll(() => {
    if (!existsSync(CLI_PATH)) {
      throw new Error(`dist/cli.cjs not found. Run "pnpm build" in packages/cli first.`);
    }
    consumerDir = mkdtempSync(join(tmpdir(), 'shipgate-e2e-consumer-'));
  });

  afterAll(() => {
    try {
      rmSync(consumerDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('runs shipgate --version from consumer dir', () => {
    const { exitCode, stdout } = shipgate('--version', consumerDir);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('runs shipgate init in consumer project', () => {
    const projectDir = join(consumerDir, 'my-app');
    const dirArg = projectDir.replace(/\\/g, '/');
    const { exitCode } = shipgate(`init my-app --directory "${dirArg}"`, consumerDir);
    expect(exitCode).toBe(0);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, 'src', 'my-app.isl'))).toBe(true);
    expect(existsSync(join(projectDir, 'isl.config.json'))).toBe(true);
    const islContent = readFileSync(join(projectDir, 'src', 'my-app.isl'), 'utf-8');
    expect(islContent).toContain('domain');
    expect(islContent).toContain('entity');
    expect(islContent).toContain('behavior');
  });

  it('runs shipgate check', () => {
    const projectDir = join(consumerDir, 'my-app');
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'my-app.isl'),
      `domain MyApp {
  version: "1.0.0"
  entity User { id: ID; name: String }
}
`,
      'utf-8',
    );
    const { exitCode, stdout, stderr } = shipgate('check src/my-app.isl', projectDir);
    expect([0, 1]).toContain(exitCode);
    expect(stdout + stderr).toBeTruthy();
  });

  it('runs shipgate gate (spec + impl dir)', () => {
    const projectDir = join(consumerDir, 'my-app');
    const specPath = join(projectDir, 'src', 'my-app.isl');
    if (!existsSync(specPath)) return;
    const specArg = specPath.replace(/\\/g, '/');
    const implDir = join(projectDir, 'src').replace(/\\/g, '/');
    const { exitCode, stdout, stderr } = shipgate(`gate "${specArg}" --impl "${implDir}"`, consumerDir, 30_000);
    expect([0, 1, 2, 3]).toContain(exitCode);
    expect(stdout + stderr).toBeTruthy();
  });
});
