/**
 * Docker Sandbox
 * 
 * Executes code in Docker containers for strict isolation.
 * This provides the strongest security boundary.
 */

import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import type { SandboxRunner, SandboxOptions, SandboxExecutionResult } from './types.js';
import { SecretsMasker } from './secrets-masker.js';

export class DockerSandbox implements SandboxRunner {
  private options: Required<Pick<SandboxOptions, 'timeout' | 'maxMemory' | 'allowedEnvVars' | 'verbose'>> & {
    allowNetwork: boolean;
    workDir: string;
    dockerImage: string;
  };
  private secretsMasker: SecretsMasker;
  private containerId?: string;

  constructor(options: SandboxOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      maxMemory: options.maxMemory ?? 128 * 1024 * 1024, // 128MB default
      allowedEnvVars: options.allowedEnvVars ?? ['NODE_ENV'],
      allowNetwork: options.allowNetwork ?? false,
      workDir: options.workDir ?? join(tmpdir(), 'isl-sandbox'),
      verbose: options.verbose ?? false,
      dockerImage: 'node:20-alpine', // Default Docker image
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

    // Build Docker command
    const dockerArgs = this.buildDockerArgs(command, args, filteredEnv, workDir);
    
    let timedOut = false;
    let stdout = '';
    let stderr = '';

    try {
      // Execute in Docker
      const result = await this.runDocker(dockerArgs, this.options.timeout);
      
      timedOut = result.timedOut;
      stdout = result.stdout;
      stderr = result.stderr;
      this.containerId = result.containerId;

      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout,
        stderr,
        duration,
        timedOut,
        memoryExceeded: false, // Docker handles memory limits
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
        memoryExceeded: false,
        maskedStdout: this.secretsMasker.mask(stdout),
        maskedStderr: this.secretsMasker.mask(stderr || errorMessage),
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.containerId) {
      try {
        await this.runCommand('docker', ['rm', '-f', this.containerId], 5000);
      } catch {
        // Ignore cleanup errors
      }
      this.containerId = undefined;
    }
  }

  /**
   * Filter environment variables based on allowlist
   */
  private filterEnv(env: Record<string, string | undefined>): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    for (const key of this.options.allowedEnvVars) {
      const v = env[key];
      if (typeof v === 'string') filtered[key] = v;
    }
    
    return filtered;
  }

  /**
   * Build Docker run arguments
   */
  private buildDockerArgs(
    command: string,
    args: string[],
    env: Record<string, string>,
    workDir: string
  ): string[] {
    const dockerArgs: string[] = [
      'run',
      '--rm',
      '--memory', `${Math.ceil(this.options.maxMemory / (1024 * 1024))}m`,
      '--cpus', '1', // Limit CPU
      '--network', this.options.allowNetwork ? 'bridge' : 'none', // Block network if not allowed
      '--read-only', // Read-only root filesystem
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=100m', // Temporary writable directory
      '--workdir', '/work',
      '--volume', `${workDir}:/work:ro`, // Mount work directory as read-only
    ];

    // Add environment variables
    for (const [key, value] of Object.entries(env)) {
      dockerArgs.push('--env', `${key}=${value}`);
    }

    // Add image and command
    dockerArgs.push(this.options.dockerImage);
    dockerArgs.push(command);
    dockerArgs.push(...args);

    return dockerArgs;
  }

  /**
   * Run Docker command
   */
  private async runDocker(
    args: string[],
    timeout: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean; containerId?: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('docker', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        resolve({
          exitCode: 124, // Timeout exit code
          stdout,
          stderr: stderr + '\nExecution timeout',
          timedOut: true,
        });
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          timedOut: false,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Run a command and return output
   */
  private async runCommand(
    command: string,
    args: string[],
    timeout: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Command timeout'));
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
}
