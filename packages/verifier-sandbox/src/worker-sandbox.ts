/**
 * Worker Thread Sandbox
 * 
 * Executes code in Node.js worker threads with resource limits.
 * Note: Worker threads provide isolation but are NOT a complete security boundary.
 * Use Docker sandbox for production security-critical scenarios.
 */

import { Worker } from 'worker_threads';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import type { SandboxRunner, SandboxOptions, SandboxExecutionResult } from './types.js';
import { SecretsMasker } from './secrets-masker.js';

export class WorkerSandbox implements SandboxRunner {
  private options: Required<Pick<SandboxOptions, 'timeout' | 'maxMemory' | 'allowedEnvVars' | 'verbose'>> & {
    allowNetwork: boolean;
    allowFilesystem: boolean;
    workDir: string;
  };
  private secretsMasker: SecretsMasker;
  private workerScriptPath?: string;

  constructor(options: SandboxOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      maxMemory: options.maxMemory ?? 128 * 1024 * 1024, // 128MB default
      allowedEnvVars: options.allowedEnvVars ?? ['NODE_ENV', 'PATH', 'HOME', 'TMPDIR', 'TMP'],
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
    
    // Ensure work directory exists
    await mkdir(workDir, { recursive: true });

    // Filter environment variables
    const filteredEnv = this.filterEnv(execOptions?.env || process.env);

    // Create worker script
    const workerScript = this.createWorkerScript(command, args, filteredEnv, workDir);
    const scriptPath = join(workDir, `worker-${Date.now()}.js`);
    await writeFile(scriptPath, workerScript);
    this.workerScriptPath = scriptPath;

    let worker: Worker | undefined;
    let timedOut = false;
    let memoryExceeded = false;
    let stdout = '';
    let stderr = '';

    try {
      // Create worker with resource constraints
      worker = new Worker(scriptPath, {
        resourceLimits: {
          maxOldGenerationSizeMb: Math.ceil(this.options.maxMemory / (1024 * 1024)),
        },
        env: filteredEnv,
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        worker?.terminate();
      }, this.options.timeout);

      // Capture output
      worker.on('message', (data) => {
        if (data.type === 'stdout') {
          stdout += data.content;
        } else if (data.type === 'stderr') {
          stderr += data.content;
        }
      });

      // Wait for completion
      await new Promise<void>((resolve, reject) => {
        worker!.on('exit', (code) => {
          clearTimeout(timeoutId);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Worker exited with code ${code}`));
          }
        });
        worker!.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
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
        memoryExceeded,
        maskedStdout: this.secretsMasker.mask(stdout),
        maskedStderr: this.secretsMasker.mask(stderr),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        exitCode: 1,
        stdout,
        stderr: stderr || errorMessage,
        duration,
        timedOut,
        memoryExceeded,
        maskedStdout: this.secretsMasker.mask(stdout),
        maskedStderr: this.secretsMasker.mask(stderr || errorMessage),
      };
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.workerScriptPath && existsSync(this.workerScriptPath)) {
      await rm(this.workerScriptPath).catch(() => {
        // Ignore cleanup errors
      });
    }
  }

  /**
   * Filter environment variables based on allowlist
   */
  private filterEnv(env: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    for (const key of this.options.allowedEnvVars) {
      if (key in env) {
        filtered[key] = env[key]!;
      }
    }
    
    return filtered;
  }

  /**
   * Create worker script that executes the command with restrictions
   */
  private createWorkerScript(
    command: string,
    args: string[],
    env: Record<string, string>,
    cwd: string
  ): string {
    // Block network access if not allowed
    const networkBlock = this.options.allowNetwork
      ? ''
      : `
      // Block network access
      const originalRequire = require;
      require = function(id) {
        if (id.startsWith('http://') || id.startsWith('https://') || id.startsWith('net') || id.startsWith('dns')) {
          throw new Error('Network access blocked in sandbox');
        }
        return originalRequire(id);
      };
      `;

    // Block filesystem access if not allowed
    const fsBlock = this.options.allowFilesystem
      ? ''
      : `
      // Block filesystem access outside work directory
      const fs = require('fs');
      const path = require('path');
      const originalReadFile = fs.readFileSync;
      const originalWriteFile = fs.writeFileSync;
      const workDir = '${cwd.replace(/\\/g, '\\\\')}';
      
      function isAllowedPath(filePath) {
        const resolved = path.resolve(workDir, filePath);
        return resolved.startsWith(workDir);
      }
      
      fs.readFileSync = function(...args) {
        const filePath = args[0];
        if (!isAllowedPath(filePath)) {
          throw new Error('Filesystem access blocked: ' + filePath);
        }
        return originalReadFile.apply(fs, args);
      };
      
      fs.writeFileSync = function(...args) {
        const filePath = args[0];
        if (!isAllowedPath(filePath)) {
          throw new Error('Filesystem access blocked: ' + filePath);
        }
        return originalWriteFile.apply(fs, args);
      };
      `;

    return `
      const { spawn } = require('child_process');
      const { parentPort } = require('worker_threads');
      
      ${networkBlock}
      ${fsBlock}
      
      // Set environment
      process.env = ${JSON.stringify(env)};
      process.chdir('${cwd.replace(/\\/g, '\\\\')}');
      
      // Execute command
      const proc = spawn('${command}', ${JSON.stringify(args)}, {
        cwd: '${cwd.replace(/\\/g, '\\\\')}',
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        parentPort.postMessage({ type: 'stdout', content: data.toString() });
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        parentPort.postMessage({ type: 'stderr', content: data.toString() });
      });
      
      proc.on('exit', (code) => {
        process.exit(code || 0);
      });
      
      proc.on('error', (error) => {
        parentPort.postMessage({ type: 'stderr', content: error.message });
        process.exit(1);
      });
    `;
  }
}
