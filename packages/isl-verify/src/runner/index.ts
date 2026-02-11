export * from './test-runner';

export interface RunnerOptions {
  timeout?: number;
  verbose?: boolean;
  workDir?: string;
  framework?: 'vitest' | 'jest';
  language?: 'typescript' | 'javascript' | 'python' | 'go';
  /** Sandbox execution mode */
  sandbox?: 'auto' | 'worker' | 'docker' | 'off';
  /** Sandbox timeout in milliseconds */
  sandboxTimeout?: number;
  /** Sandbox memory limit in MB */
  sandboxMemory?: number;
  /** Allowed environment variables (comma-separated) */
  sandboxEnv?: string;
}
