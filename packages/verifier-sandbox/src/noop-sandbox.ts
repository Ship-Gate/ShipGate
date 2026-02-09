/**
 * No-Op Sandbox (Full Trust Mode)
 * 
 * Executes commands without sandboxing. Use only when you trust the code.
 * This mode provides no security isolation.
 */

import { spawn } from 'child_process';
import type { SandboxRunner, SandboxOptions, SandboxExecutionResult } from './types.js';
import { SecretsMasker } from './secrets-masker.js';

export class NoOpSandbox implements SandboxRunner {
  private options: Required<Pick<SandboxOptions, 'timeout' | 'verbose'>>;
  private secretsMasker: SecretsMasker;

  constructor(options: SandboxOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
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
    let timedOut = false;
    let stdout = '';
    let stderr = '';

    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd: execOptions?.cwd,
        env: execOptions?.env || process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        resolve({
          success: false,
          exitCode: 124,
          stdout,
          stderr: stderr + '\nExecution timeout',
          duration: Date.now() - startTime,
          timedOut: true,
          memoryExceeded: false,
          maskedStdout: this.secretsMasker.mask(stdout),
          maskedStderr: this.secretsMasker.mask(stderr + '\nExecution timeout'),
        });
      }, this.options.timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          exitCode: code || 0,
          stdout,
          stderr,
          duration: Date.now() - startTime,
          timedOut: false,
          memoryExceeded: false,
          maskedStdout: this.secretsMasker.mask(stdout),
          maskedStderr: this.secretsMasker.mask(stderr),
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          exitCode: 1,
          stdout,
          stderr: stderr || error.message,
          duration: Date.now() - startTime,
          timedOut: false,
          memoryExceeded: false,
          maskedStdout: this.secretsMasker.mask(stdout),
          maskedStderr: this.secretsMasker.mask(stderr || error.message),
        });
      });

      if (execOptions?.input) {
        proc.stdin.write(execOptions.input);
        proc.stdin.end();
      }
    });
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for no-op sandbox
  }
}
