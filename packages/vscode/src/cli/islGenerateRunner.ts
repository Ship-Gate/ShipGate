/**
 * ISL Generate Runner
 *
 * Invokes isl isl-generate to turn code into ISL specs.
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

export interface IslGenerateOptions {
  path: string;
  workspaceRoot: string;
  output?: string;
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface IslGenerateResult {
  success: boolean;
  output?: string;
  error?: string;
  generatedCount?: number;
  scannedCount?: number;
}

async function resolveIslExecutable(
  workspaceRoot: string,
  customPath?: string
): Promise<{ executable: string; args: string[] }> {
  if (customPath?.trim()) {
    return { executable: customPath.trim(), args: ['isl-generate', '-f', 'json'] };
  }

  const root = resolve(workspaceRoot);

  const localPaths = [
    join(root, 'packages', 'cli', 'dist', 'cli.cjs'),
    join(root, 'packages', 'cli', 'dist', 'cli.js'),
    join(root, 'node_modules', 'shipgate', 'dist', 'cli.cjs'),
  ];

  for (const p of localPaths) {
    if (existsSync(p)) {
      return { executable: 'node', args: [p, 'isl-generate', '-f', 'json'] };
    }
  }

  const pnpmLock = join(root, 'pnpm-lock.yaml');
  if (existsSync(pnpmLock)) {
    return { executable: 'pnpm', args: ['exec', 'isl', 'isl-generate', '-f', 'json'] };
  }

  return { executable: 'npx', args: ['--yes', 'shipgate', 'isl-generate', '-f', 'json'] };
}

export async function runIslGenerate(
  options: IslGenerateOptions
): Promise<IslGenerateResult> {
  const { path: targetPath, workspaceRoot, output, dryRun, overwrite } = options;

  const { executable, args } = await resolveIslExecutable(workspaceRoot);

  const fullArgs = [...args.slice(0, -2), targetPath, '-f', 'json'];
  if (output) fullArgs.push('--output', output);
  if (dryRun) fullArgs.push('--dry-run');
  if (overwrite) fullArgs.push('--overwrite');

  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(executable, fullArgs, {
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

    proc.on('close', (code) => {
      try {
        const data = JSON.parse(stdout.trim()) as {
          success?: boolean;
          generatedCount?: number;
          scannedCount?: number;
        };
        resolve({
          success: code === 0,
          output: stdout,
          generatedCount: data.generatedCount,
          scannedCount: data.scannedCount,
        });
      } catch {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || (code !== 0 ? 'Command failed' : undefined),
        });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}
