/**
 * Sandbox Runner Factory
 * 
 * Creates appropriate sandbox runners based on mode and options.
 */

import type { SandboxRunner, SandboxOptions, SandboxMode } from './types.js';
import { WorkerSandbox } from './worker-sandbox.js';
import { DockerSandbox } from './docker-sandbox.js';
import { NoOpSandbox } from './noop-sandbox.js';

/**
 * Create a sandbox runner based on mode
 */
export function createSandboxRunner(options: SandboxOptions = {}): SandboxRunner {
  const mode = options.mode || 'auto';

  // Auto mode: prefer worker threads, fallback to no-op if unavailable
  if (mode === 'auto') {
    try {
      // Check if worker threads are available
      require('worker_threads');
      return new WorkerSandbox(options);
    } catch {
      // Fallback to no-op if worker threads not available
      return new NoOpSandbox(options);
    }
  }

  // Worker mode
  if (mode === 'worker') {
    return new WorkerSandbox(options);
  }

  // Docker mode
  if (mode === 'docker') {
    return new DockerSandbox(options);
  }

  // Off mode: no sandboxing (full trust)
  if (mode === 'off') {
    return new NoOpSandbox(options);
  }

  // Default to worker
  return new WorkerSandbox(options);
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('docker', ['--version'], { stdio: 'ignore' });
      proc.on('exit', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 2000);
    });
  } catch {
    return false;
  }
}

/**
 * Get recommended sandbox mode
 */
export async function getRecommendedMode(): Promise<SandboxMode> {
  const dockerAvailable = await isDockerAvailable();
  if (dockerAvailable) {
    return 'docker';
  }
  
  try {
    require('worker_threads');
    return 'worker';
  } catch {
    return 'off';
  }
}
