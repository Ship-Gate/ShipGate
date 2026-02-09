/**
 * Types for sandbox execution
 */

export type SandboxMode = 'auto' | 'worker' | 'docker' | 'off';

export interface SandboxOptions {
  /** Sandbox execution mode */
  mode?: SandboxMode;
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Maximum memory usage in bytes */
  maxMemory?: number;
  /** Allowed environment variables (allowlist) */
  allowedEnvVars?: string[];
  /** Secrets patterns to mask in logs */
  secretsPatterns?: RegExp[];
  /** Enable network access (default: false in sandbox mode) */
  allowNetwork?: boolean;
  /** Enable filesystem access (default: false in sandbox mode) */
  allowFilesystem?: boolean;
  /** Working directory for execution */
  workDir?: string;
  /** Verbose logging */
  verbose?: boolean;
}

export interface SandboxExecutionResult {
  /** Execution success */
  success: boolean;
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Memory usage in bytes */
  memoryUsed?: number;
  /** Whether execution was terminated due to timeout */
  timedOut: boolean;
  /** Whether execution exceeded memory limit */
  memoryExceeded: boolean;
  /** Masked stdout (with secrets redacted) */
  maskedStdout?: string;
  /** Masked stderr (with secrets redacted) */
  maskedStderr?: string;
}

export interface SandboxRunner {
  /** Execute a command in the sandbox */
  execute(
    command: string,
    args: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      input?: string;
    }
  ): Promise<SandboxExecutionResult>;
  
  /** Cleanup sandbox resources */
  cleanup(): Promise<void>;
}
