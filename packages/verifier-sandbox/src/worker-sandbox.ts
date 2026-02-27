/**
 * Worker Thread Sandbox
 *
 * Executes code in Node.js worker threads with resource limits.
 * For node script.js, runs the script inside the worker with fs/network
 * patches so blocking is observable (BLOCKED marker in stdout).
 */

import { Worker } from 'worker_threads';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import type {
  SandboxRunner,
  SandboxOptions,
  SandboxExecutionResult,
} from './types.js';
import { SecretsMasker } from './secrets-masker.js';

const BLOCKED_PREFIX = 'BLOCKED';

export class WorkerSandbox implements SandboxRunner {
  private options: Required<
    Pick<
      SandboxOptions,
      'timeout' | 'maxMemory' | 'allowedEnvVars' | 'verbose'
    >
  > & {
    allowNetwork: boolean;
    allowFilesystem: boolean;
    workDir: string;
  };
  private secretsMasker: SecretsMasker;
  private workerScriptPath?: string;

  constructor(options: SandboxOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      maxMemory: options.maxMemory ?? 128 * 1024 * 1024,
      allowedEnvVars:
        options.allowedEnvVars ?? ['NODE_ENV', 'PATH', 'HOME', 'TMPDIR', 'TMP'],
      allowNetwork: options.allowNetwork ?? false,
      allowFilesystem: options.allowFilesystem ?? false,
      workDir: options.workDir ?? join(tmpdir(), 'isl-sandbox'),
      verbose: options.verbose ?? false,
    };
    this.secretsMasker = new SecretsMasker({ patterns: options.secretsPatterns });
  }

  async execute(
    command: string,
    args: string[],
    execOptions?: {
      cwd?: string;
      env?: Record<string, string>;
      input?: string;
    }
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const workDir = execOptions?.cwd || this.options.workDir;
    await mkdir(workDir, { recursive: true });

    const filteredEnv = this.filterEnv(execOptions?.env || process.env);

    const workerScript = this.createWorkerScript(command, args, filteredEnv, workDir);
    const scriptPath = join(workDir, `worker-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`);
    await writeFile(scriptPath, workerScript);
    this.workerScriptPath = scriptPath;

    let worker: Worker | undefined;
    let timedOut = false;
    let stdout = '';
    let stderr = '';

    try {
      worker = new Worker(scriptPath, {
        resourceLimits: {
          maxOldGenerationSizeMb: Math.ceil(
            this.options.maxMemory / (1024 * 1024)
          ),
        },
        env: { ...filteredEnv, __ISL_WORK_DIR__: workDir },
      });

      const timeoutMs = this.options.timeout;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        worker?.terminate();
      }, timeoutMs);

      worker.on('message', (data: { type: string; content: string }) => {
        if (data.type === 'stdout') stdout += data.content;
        else if (data.type === 'stderr') stderr += data.content;
      });

      await new Promise<void>((resolve, reject) => {
        worker!.on('exit', (code) => {
          clearTimeout(timeoutId);
          if (code === 0) resolve();
          else reject(new Error(`Worker exited with code ${code}`));
        });
        worker!.on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      const duration = Date.now() - startTime;
      return {
        success: true,
        exitCode: 0,
        stdout,
        stderr,
        duration,
        timedOut,
        memoryExceeded: false,
        maskedStdout: this.secretsMasker.mask(stdout),
        maskedStderr: this.secretsMasker.mask(stderr),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (timedOut && !stderr) {
        stderr = `Execution timeout after ${this.options.timeout}ms`;
      }
      const finalStderr = stderr || errorMessage;
      return {
        success: false,
        exitCode: 1,
        stdout,
        stderr: finalStderr,
        duration,
        timedOut,
        memoryExceeded: false,
        maskedStdout: this.secretsMasker.mask(stdout),
        maskedStderr: this.secretsMasker.mask(stderr || errorMessage),
      };
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // ignore
        }
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.workerScriptPath && existsSync(this.workerScriptPath)) {
      await rm(this.workerScriptPath).catch(() => {});
    }
  }

  private filterEnv(env: Record<string, string | undefined>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of this.options.allowedEnvVars) {
      const v = env[key];
      if (typeof v === 'string') out[key] = v;
    }
    return out;
  }

  private createWorkerScript(
    command: string,
    args: string[],
    env: Record<string, string>,
    cwd: string
  ): string {
    const escapedCwd = cwd.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const scriptArg = args[0] ?? '';
    const isNodeScript =
      command === 'node' &&
      scriptArg &&
      (scriptArg.endsWith('.js') || scriptArg.endsWith('.mjs'));

    const emitBlocked = (reason: string) =>
      `parentPort.postMessage({ type: 'stdout', content: '${BLOCKED_PREFIX}: ' + ${reason} + '\\n' });`;

    let networkBlock = '';
    if (!this.options.allowNetwork) {
      networkBlock = `
      const origRequire = module.constructor.prototype.require;
      module.constructor.prototype.require = function(id) {
        if (typeof id === 'string' && (id === 'http' || id === 'https' || id === 'net' || id.startsWith('net/') || id === 'dns' || id.startsWith('dns/'))) {
          ${emitBlocked("'Network access blocked'")}
          throw new Error('Network access blocked in sandbox');
        }
        return origRequire.apply(this, arguments);
      };
      `;
    }

    let fsBlock = '';
    if (!this.options.allowFilesystem) {
      fsBlock = `
      const path = require('path');
      const workDir = process.env.__ISL_WORK_DIR__ || '${escapedCwd}';
      const fs = require('fs');
      const origReadFileSync = fs.readFileSync;
      const origWriteFileSync = fs.writeFileSync;
      const origReadFile = fs.readFile;
      const origWriteFile = fs.writeFile;
      function isInsideWorkDir(filePath) {
        const resolved = path.resolve(filePath);
        const normalized = path.normalize(resolved);
        const wdNorm = path.normalize(workDir);
        return normalized === wdNorm || normalized.startsWith(wdNorm + path.sep);
      }
      fs.readFileSync = function(...args) {
        if (!isInsideWorkDir(args[0])) {
          ${emitBlocked("'Filesystem access outside work directory'")}
          throw new Error('BLOCKED: Filesystem access outside work directory');
        }
        return origReadFileSync.apply(fs, args);
      };
      fs.writeFileSync = function(...args) {
        if (!isInsideWorkDir(args[0])) {
          ${emitBlocked("'Filesystem access outside work directory'")}
          throw new Error('BLOCKED: Filesystem access outside work directory');
        }
        return origWriteFileSync.apply(fs, args);
      };
      fs.readFile = function(...args) {
        if (!isInsideWorkDir(args[0])) {
          ${emitBlocked("'Filesystem access outside work directory'")}
          return args[2] && args[2](new Error('BLOCKED: Filesystem access outside work directory'));
        }
        return origReadFile.apply(fs, args);
      };
      fs.writeFile = function(...args) {
        if (!isInsideWorkDir(args[0])) {
          ${emitBlocked("'Filesystem access outside work directory'")}
          return args[3] && args[3](new Error('BLOCKED: Filesystem access outside work directory'));
        }
        return origWriteFile.apply(fs, args);
      };
      `;
    }

    const envJson = JSON.stringify(env);
    const redirectConsole = `
      const util = require('util');
      const origLog = console.log;
      const origError = console.error;
      const origWarn = console.warn;
      function send(type, ...args) {
        const s = util.format.apply(util, args) + (args.length && !String(args[args.length-1]).endsWith('\\n') ? '\\n' : '');
        parentPort.postMessage({ type, content: s });
      }
      console.log = (...a) => send('stdout', ...a);
      console.error = (...a) => send('stderr', ...a);
      console.warn = (...a) => send('stderr', ...a);
    `;

    if (isNodeScript) {
      const scriptPath = scriptArg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `
      const { parentPort } = require('worker_threads');
      ${redirectConsole}
      process.env = ${envJson};
      ${networkBlock}
      ${fsBlock}
      try {
        require('${scriptPath}');
        process.exit(0);
      } catch (e) {
        if (e.message && e.message.startsWith('BLOCKED')) {
          process.exit(1);
        }
        origError(e.message || e);
        process.exit(1);
      }
      `;
    }

    const spawnBlock = `
      const { spawn } = require('child_process');
      const proc = spawn(${JSON.stringify(command)}, ${JSON.stringify(args)}, {
        cwd: '${escapedCwd}',
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      proc.stdout.on('data', (d) => parentPort.postMessage({ type: 'stdout', content: d.toString() }));
      proc.stderr.on('data', (d) => parentPort.postMessage({ type: 'stderr', content: d.toString() }));
      proc.on('exit', (code) => process.exit(code ?? 0));
      proc.on('error', (err) => {
        parentPort.postMessage({ type: 'stderr', content: err.message });
        process.exit(1);
      });
    `;

    return `
      const { parentPort } = require('worker_threads');
      process.env = ${envJson};
      ${networkBlock}
      ${fsBlock}
      ${spawnBlock}
    `;
  }
}
