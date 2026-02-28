/**
 * Shipgate CLI Runner
 *
 * Resolves executable (workspace local, pnpm, npx) and runs
 * verify with JSON output. Supports cancellation.
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import type { CancellationToken } from 'vscode';
import type { ScanResult, ScanRunResult } from '../model/types';
import { createEmptyScanResult, normalizeVerdict } from '../model/types';
import { safeParseJSON } from '../utils/json';

export interface RunScanOptions {
  workspaceRoot: string;
  executablePath?: string;
  token?: CancellationToken;
}

export interface RunScanOutput {
  success: boolean;
  result?: ScanResult;
  error?: string;
  stderr?: string;
}

const CLI_VERIFY_JSON_PAYLOAD = ['verify', '.', '--json'];

/**
 * Resolve Shipgate/ISL executable in priority order:
 * 1. VS Code setting shipgate.scan.executablePath
 * 2. Workspace local packages/cli/dist/cli.cjs
 * 3. node_modules/.bin/isl or shipgate (workspace)
 * 4. pnpm exec isl (if pnpm workspace)
 * 5. npx shipgate
 */
export async function resolveShipgateExecutable(
  workspaceRoot: string,
  customPath?: string
): Promise<{ executable: string; args: string[] }> {
  if (customPath && customPath.trim()) {
    return { executable: customPath.trim(), args: CLI_VERIFY_JSON_PAYLOAD };
  }

  const root = resolve(workspaceRoot ?? process.cwd());

  // 1. Workspace local CLI package (node-run .cjs/.js only)
  const localCliPaths = [
    join(root, 'packages', 'cli', 'dist', 'cli.cjs'),
    join(root, 'packages', 'cli', 'dist', 'cli.js'),
    join(root, 'node_modules', 'shipgate', 'dist', 'cli.cjs'),
    join(root, 'node_modules', 'shipgate', 'dist', 'cli.js'),
  ];

  for (const p of localCliPaths) {
    if (existsSync(p)) {
      return { executable: 'node', args: [p, ...CLI_VERIFY_JSON_PAYLOAD] };
    }
  }

  // 2. Extension-local CLI (sibling package in monorepo only — path contains packages/vscode)
  const extensionDir = dirname(__dirname); // packages/vscode in dev, extension root when installed
  const isMonorepoLayout = /packages[\/\\]vscode/.test(extensionDir);
  if (isMonorepoLayout) {
    const extensionLocalCli = join(extensionDir, '..', 'cli', 'dist', 'cli.cjs');
    if (existsSync(extensionLocalCli)) {
      return { executable: 'node', args: [resolve(extensionLocalCli), ...CLI_VERIFY_JSON_PAYLOAD] };
    }
  }

  // 3. pnpm workspace - try pnpm exec
  const pnpmLock = join(root, 'pnpm-lock.yaml');
  if (existsSync(pnpmLock)) {
    return { executable: 'pnpm', args: ['exec', 'isl', 'verify', '.', '--json'] };
  }

  // 4. npx fallback
  return { executable: 'npx', args: ['--yes', 'shipgate', 'verify', '.', '--json'] };
}

/**
 * Run Shipgate verify and parse JSON output.
 */
export async function runShipgateScan(
  options: RunScanOptions
): Promise<RunScanOutput> {
  const { workspaceRoot, executablePath, token } = options;

  const { executable, args } = await resolveShipgateExecutable(
    workspaceRoot,
    executablePath
  );

  const cwd = workspaceRoot && typeof workspaceRoot === 'string' ? workspaceRoot : process.cwd();
  return new Promise((resolvePromise) => {
    const proc: ChildProcess = spawn(executable, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const onTokenCancel = () => {
      try {
        proc.kill('SIGTERM');
      } catch {
        // ignore
      }
    };

    if (token) {
      token.onCancellationRequested(onTokenCancel);
    }

    proc.on('close', (code, signal) => {
      if (token) {
        token.onCancellationRequested(() => {});
      }

      const parseInput = stdout.trim() || stderr.trim();
      const parsed = safeParseJSON<{
        verdict?: string;
        score?: number;
        coverage?: { specced: number; total: number };
        mode?: string;
        files?: Array<{
          file: string;
          status: string;
          mode: string;
          score: number;
          specFile?: string | null;
          blockers: string[];
          errors: string[];
          duration: number;
        }>;
        blockers?: string[];
        recommendations?: string[];
        duration?: number;
        exitCode?: number;
      }>(parseInput);

      if (!parsed.ok) {
        const errMsg =
          stderr?.trim() ||
          (code !== 0 && code != null ? `Process exited with code ${code}` : null) ||
          parsed.error ||
          'No JSON output from CLI';
        resolvePromise({
          success: false,
          error: errMsg,
          stderr: stderr || undefined,
        });
        return;
      }

      const raw = parsed.data;
      const result: ScanRunResult = {
        verdict: normalizeVerdict(raw.verdict ?? 'NO_SHIP'),
        score: typeof raw.score === 'number' ? raw.score : 0,
        coverage: raw.coverage ?? { specced: 0, total: 0 },
        mode: (raw.mode as ScanRunResult['mode']) ?? 'specless',
        files: (raw.files ?? [])
          .filter((f) => f && typeof f.file === 'string')
          .map((f) => ({
          file: f.file,
          status: (f.status === 'PASS' ? 'PASS' : f.status === 'FAIL' ? 'FAIL' : 'WARN') as 'PASS' | 'WARN' | 'FAIL',
          mode: f.mode,
          score: f.score ?? 0,
          specFile: f.specFile,
          blockers: f.blockers ?? [],
          errors: f.errors ?? [],
          duration: f.duration ?? 0,
        })),
        blockers: raw.blockers ?? [],
        recommendations: raw.recommendations ?? [],
        duration: raw.duration ?? 0,
        exitCode: raw.exitCode ?? (code ?? 1),
      };

      const scanResult: ScanResult = {
        result,
        metadata: {
          timestamp: new Date().toISOString(),
          workspaceRoot: cwd,
          executable: args.length > 0 ? `${executable} ${args[0]}` : executable,
        },
      };

      // CLI exit codes: 0=SHIP, 1=NO_SHIP, 4=WARN — all are valid results
      const isValidResult = parsed.ok && raw.verdict != null;
      const success = isValidResult;
      const errorWhenFailed =
        !isValidResult && (stderr?.trim() || (code !== 0 && code != null ? `Process exited with code ${code}` : null) || 'Unknown error');

      resolvePromise({
        success,
        result: scanResult,
        error: success ? undefined : (errorWhenFailed || undefined),
        stderr: stderr || undefined,
      });
    });

    proc.on('error', (err) => {
      resolvePromise({
        success: false,
        error: err.message,
        stderr: stderr || undefined,
      });
    });
  });
}
