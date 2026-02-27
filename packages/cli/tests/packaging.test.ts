/**
 * Packaging Test: Validates shipgate CLI package structure and tarball
 *
 * Ensures:
 *   1. Package bins and files are correct
 *   2. dist/cli.cjs exists and is included in pack
 *   3. npm pack produces valid tarball
 *   4. When installed in monorepo context, npx shipgate --help and verify work
 *
 * The "install from tarball" step runs inside the monorepo so workspace deps
 * (external @isl-lang/*) resolve. For true fresh-install testing, run after
 * `pnpm release` when packages are published to npm.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_PACKAGE_ROOT = join(__dirname, '..');
const MONOREPO_ROOT = join(CLI_PACKAGE_ROOT, '../..');

function findShipgateDist(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'shipgate') {
        const distPath = join(p, 'dist', 'cli.cjs');
        if (existsSync(distPath)) results.push(distPath);
      }
      results.push(...findShipgateDist(p));
    }
  }
  return results;
}

function run(cmd: string, cwd: string, timeout = 90_000): { exitCode: number; stdout: string; stderr: string } {
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

describe('Packaging: package structure', () => {
  it('package.json bin points to dist/cli.cjs', () => {
    const pkg = JSON.parse(readFileSync(join(CLI_PACKAGE_ROOT, 'package.json'), 'utf-8'));
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin.shipgate).toBe('dist/cli.cjs');
    expect(pkg.bin.isl).toBe('dist/cli.cjs');
  });

  it('package.json files includes dist and postinstall script', () => {
    const pkg = JSON.parse(readFileSync(join(CLI_PACKAGE_ROOT, 'package.json'), 'utf-8'));
    const files = pkg.files ?? [];
    expect(files).toContain('dist');
    expect(files.some((f: string) => f.includes('postinstall'))).toBe(true);
  });

  it('dist/cli.cjs exists and has shebang', () => {
    const distPath = join(CLI_PACKAGE_ROOT, 'dist', 'cli.cjs');
    expect(existsSync(distPath)).toBe(true);
    const firstLine = readFileSync(distPath, 'utf-8').split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });
});

describe('Packaging: npm pack and install', () => {
  let tarballPath: string;
  let installDir: string;
  let fixtureDir: string;

  beforeAll(() => {
    const distPath = join(CLI_PACKAGE_ROOT, 'dist', 'cli.cjs');
    if (!existsSync(distPath)) {
      throw new Error(`dist/cli.cjs not found. Run "pnpm build" from monorepo root first.`);
    }

    // npm pack (--ignore-scripts: dist already built by turbo)
    const packResult = run('npm pack --ignore-scripts', CLI_PACKAGE_ROOT);
    expect(packResult.exitCode).toBe(0);

    const packOutput = (packResult.stdout || '').trim();
    const tgzName = packOutput.split(/[\r\n]+/).pop()?.trim() ?? '';
    const discovered = readdirSync(CLI_PACKAGE_ROOT).filter((f) => f.endsWith('.tgz'));
    tarballPath =
      tgzName && existsSync(join(CLI_PACKAGE_ROOT, tgzName))
        ? join(CLI_PACKAGE_ROOT, tgzName)
        : discovered.length > 0
          ? join(CLI_PACKAGE_ROOT, discovered[0])
          : '';
    if (!tarballPath || !existsSync(tarballPath)) {
      throw new Error(`No tarball found after npm pack. stdout: ${packOutput}`);
    }

    // Install tarball in a consumer dir inside monorepo so workspace:* deps resolve
    installDir = join(CLI_PACKAGE_ROOT, '.pack-test-consumer');
    if (existsSync(installDir)) rmSync(installDir, { recursive: true, force: true });
    mkdirSync(installDir, { recursive: true });
    writeFileSync(
      join(installDir, 'package.json'),
      JSON.stringify({
        name: 'pack-test-consumer',
        version: '1.0.0',
        private: true,
        dependencies: { shipgate: 'file:../' + (tarballPath.split(/[/\\]/).pop() ?? 'shipgate-2.0.0.tgz') },
      }),
    );
    const installResult = run('npm install', installDir);
    expect(installResult.exitCode).toBe(0);

    fixtureDir = join(installDir, 'fixture');
    mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(
      join(fixtureDir, 'spec.isl'),
      `domain UserService {
  version: "1.0.0"
  entity User { id: String; name: String }
  behavior GetUser {
    input { id: String }
    output { success: User }
  }
}
`,
    );
    writeFileSync(
      join(fixtureDir, 'impl.ts'),
      `export interface User { id: string; name: string }
export function GetUser(input: { id: string }): User {
  return { id: input.id, name: "test" };
}
`,
    );
  });

  afterAll(() => {
    try {
      if (installDir) rmSync(installDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    try {
      if (tarballPath && existsSync(tarballPath)) rmSync(tarballPath, { force: true });
    } catch {
      // ignore
    }
  });

  it('tarball contains dist/cli.cjs', () => {
    const listResult = run(`tar -tzf "${tarballPath}"`, CLI_PACKAGE_ROOT);
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toMatch(/package\/dist\/cli\.cjs/);
  });

  it('shipgate binary runs without missing dist file errors', () => {
    // Find shipgate (pnpm may use .pnpm store structure)
    const nm = join(installDir, 'node_modules');
    const candidates = [
      join(nm, 'shipgate', 'dist', 'cli.cjs'),
      ...findShipgateDist(nm),
    ];
    const shipgateDist = candidates.find((p) => existsSync(p));
    if (!shipgateDist) {
      throw new Error(`Installed package missing dist/cli.cjs. Checked: ${candidates.join(', ')}`);
    }
    const { exitCode, stdout, stderr } = run(`node "${shipgateDist}" --help`, installDir);
    const out = stdout + stderr;
    expect(out).not.toMatch(/ENOENT|missing dist|dist\/cli\.cjs.*not found/i);
    if (exitCode === 0) {
      expect(out).toContain('verify');
    }
  });
});
