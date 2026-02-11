/**
 * Shipgate CLI Runner
 *
 * Resolves executable (workspace local, pnpm, npx) and runs
 * verify with JSON output. Supports cancellation.
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
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

  const root = resolve(workspaceRoot);

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

  // 2. pnpm workspace - try pnpm exec
  const pnpmLock = join(root, 'pnpm-lock.yaml');
  if (existsSync(pnpmLock)) {
    return { executable: 'pnpm', args: ['exec', 'isl', 'verify', '.', '--json'] };
  }

  // 3. npx fallback
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

  return new Promise((resolvePromise) => {
    const proc: ChildProcess = spawn(executable, args, {
      cwd: workspaceRoot,
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
      }>(stdout.trim());

      if (!parsed.ok) {
        resolvePromise({
          success: false,
          error: parsed.error,
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
        files: (raw.files ?? []).map((f) => ({
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
          workspaceRoot,
          executable: args.length > 0 ? `${executable} ${args[0]}` : executable,
        },
      };

      resolvePromise({
        success: code === 0,
        result: scanResult,
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
