/**
 * Application Launcher
 * 
 * Starts the app in a child process, waits for readiness, manages cleanup
 */

import { spawn, type ChildProcess } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { AppLaunchConfig } from './types';

export interface AppProcess {
  process: ChildProcess;
  baseUrl: string;
  port: number;
  cleanup: () => Promise<void>;
}

export class AppLauncher {
  private process?: ChildProcess;
  private stdoutBuffer: string[] = [];
  private stderrBuffer: string[] = [];

  async launch(config: AppLaunchConfig): Promise<AppProcess> {
    const startCommand = config.startCommand || await this.detectStartCommand(config.projectDir);
    const port = config.port || await this.findAvailablePort();
    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      ...config.env,
    };

    const [command, ...args] = this.parseCommand(startCommand);
    
    this.process = spawn(command, args, {
      cwd: config.projectDir,
      env,
      shell: true,
      stdio: 'pipe',
    });

    // Capture output for debugging
    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        const text = data.toString();
        this.stdoutBuffer.push(text);
        if (this.stdoutBuffer.length > 100) this.stdoutBuffer.shift();
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        const text = data.toString();
        this.stderrBuffer.push(text);
        if (this.stderrBuffer.length > 100) this.stderrBuffer.shift();
      });
    }

    // Wait for app to be ready
    const baseUrl = `http://localhost:${port}`;
    const timeout = config.startTimeout || 30000;
    
    try {
      await this.waitForReady(baseUrl, config.healthEndpoint || '/', timeout);
    } catch (error) {
      const stdout = this.stdoutBuffer.join('');
      const stderr = this.stderrBuffer.join('');
      await this.cleanup();
      throw new Error(
        `App failed to start within ${timeout}ms.\n` +
        `Command: ${startCommand}\n` +
        `Stdout: ${stdout.slice(-500)}\n` +
        `Stderr: ${stderr.slice(-500)}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!this.process) {
      throw new Error('Process was terminated during startup');
    }

    return {
      process: this.process,
      baseUrl,
      port,
      cleanup: async () => this.cleanup(),
    };
  }

  private async detectStartCommand(projectDir: string): Promise<string> {
    try {
      const pkgPath = join(projectDir, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      
      // Try common script names in order
      const scripts = pkg.scripts || {};
      if (scripts.dev) return 'npm run dev';
      if (scripts.start) return 'npm start';
      if (scripts['start:test']) return 'npm run start:test';
      
      throw new Error('No start script found in package.json');
    } catch (error) {
      throw new Error(`Failed to detect start command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseCommand(command: string): string[] {
    // Simple command parsing - handle "npm run dev", "node server.js", etc.
    const parts = command.split(/\s+/);
    return parts;
  }

  private async findAvailablePort(): Promise<number> {
    // Start from a high port to avoid conflicts
    const basePort = 13000 + Math.floor(Math.random() * 1000);
    
    // Try to import net module for port checking
    try {
      const net = await import('net');
      
      return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(basePort, () => {
          const port = (server.address() as { port: number }).port;
          server.close(() => resolve(port));
        });
        server.on('error', () => {
          // Port in use, try next one
          resolve(basePort + 1);
        });
      });
    } catch {
      // Fallback if net module not available
      return basePort;
    }
  }

  private async waitForReady(
    baseUrl: string,
    healthEndpoint: string,
    timeout: number
  ): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;
    const endpoint = healthEndpoint;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });
        
        // Accept any 2xx, 3xx, or 404 (app is running even if endpoint doesn't exist)
        if (response.status < 500) {
          return;
        }
      } catch (error) {
        // Check if process crashed
        if (this.process?.killed || this.process?.exitCode !== null) {
          throw new Error('Process exited unexpectedly');
        }
        // Otherwise, keep waiting
      }

      // Check stdout for "listening on" patterns
      const recentOutput = this.stdoutBuffer.slice(-10).join('');
      if (
        recentOutput.includes('listening on') ||
        recentOutput.includes('started server') ||
        recentOutput.includes('ready on') ||
        recentOutput.includes('Local:')
      ) {
        // Give it a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Timeout waiting for app to be ready at ${baseUrl}${endpoint}`);
  }

  private async cleanup(): Promise<void> {
    if (!this.process) return;

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const proc = this.process;
      
      // Try graceful shutdown first
      proc.kill('SIGTERM');
      
      const forceKillTimeout = setTimeout(() => {
        proc.kill('SIGKILL');
      }, 5000);

      proc.on('exit', () => {
        clearTimeout(forceKillTimeout);
        resolve();
      });

      // Force resolve after 10 seconds
      setTimeout(() => {
        clearTimeout(forceKillTimeout);
        resolve();
      }, 10000);
    });
  }

  getOutput(): { stdout: string; stderr: string } {
    return {
      stdout: this.stdoutBuffer.join(''),
      stderr: this.stderrBuffer.join(''),
    };
  }
}
