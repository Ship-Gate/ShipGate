import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  SemgrepConfig,
  SemgrepFinding,
  SemgrepResult,
  SemgrepRawOutput,
  SemgrepRawResult,
  SemgrepRawError,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const PACKAGE_DIR = resolve(fileURLToPath(import.meta.url), '..', '..');
const BUILTIN_RULES_DIR = join(PACKAGE_DIR, 'src', 'rules');

function execFilePromise(
  cmd: string,
  args: string[],
  options: { timeout: number; cwd: string; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...options, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const code = (error as NodeJS.ErrnoException & { code?: string | number }).code;
        if (code === 'ETIMEDOUT' || error.killed) {
          reject(new SemgrepTimeoutError(options.timeout));
          return;
        }
        // Semgrep exits non-zero when it finds issues — stdout still has valid JSON
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
        return;
      }
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

export class SemgrepTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Semgrep scan timed out after ${timeoutMs}ms`);
    this.name = 'SemgrepTimeoutError';
  }
}

export class SemgrepRunner {
  private readonly rulesDir: string | undefined;
  private readonly configPreset: string | undefined;
  private readonly timeout: number;
  private readonly maxFindings: number;

  constructor(options: SemgrepConfig = {}) {
    this.rulesDir = options.rulesDir;
    this.configPreset = options.configPreset;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxFindings = options.maxFindings ?? 500;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execFilePromise('semgrep', ['--version'], {
        timeout: 10_000,
        cwd: process.cwd(),
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async scan(projectRoot: string, files?: string[]): Promise<SemgrepResult> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        findings: [],
        errors: ['semgrep CLI is not installed or not on PATH'],
        version: 'unknown',
      };
    }

    const configArgs = await this.buildConfigArgs();
    const target = files && files.length > 0 ? files : [projectRoot];

    const args = [
      ...configArgs,
      '--json',
      '--quiet',
      '--no-git-ignore',
      '--max-target-bytes', '1000000',
      ...target,
    ];

    try {
      const { stdout, stderr } = await execFilePromise('semgrep', args, {
        timeout: this.timeout,
        cwd: projectRoot,
      });

      if (!stdout.trim()) {
        return {
          findings: [],
          errors: stderr ? [stderr.trim()] : [],
          version: 'unknown',
        };
      }

      return this.parseOutput(stdout);
    } catch (error) {
      if (error instanceof SemgrepTimeoutError) {
        return {
          findings: [],
          errors: [error.message],
          version: 'unknown',
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        findings: [],
        errors: [`Semgrep execution failed: ${message}`],
        version: 'unknown',
      };
    }
  }

  private async buildConfigArgs(): Promise<string[]> {
    const args: string[] = [];

    if (this.configPreset) {
      args.push('--config', this.configPreset);
    }

    if (this.rulesDir) {
      args.push('--config', this.rulesDir);
    }

    const builtinAvailable = await this.directoryExists(BUILTIN_RULES_DIR);
    if (builtinAvailable) {
      args.push('--config', BUILTIN_RULES_DIR);
    }

    if (args.length === 0) {
      args.push('--config', 'auto');
    }

    return args;
  }

  private async directoryExists(dir: string): Promise<boolean> {
    try {
      await access(dir, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  private parseOutput(stdout: string): SemgrepResult {
    let raw: SemgrepRawOutput;
    try {
      raw = JSON.parse(stdout) as SemgrepRawOutput;
    } catch {
      return {
        findings: [],
        errors: [`Failed to parse Semgrep JSON output: ${stdout.substring(0, 200)}`],
        version: 'unknown',
      };
    }

    const errors = (raw.errors ?? []).map((e: SemgrepRawError) =>
      e.long_msg ?? e.short_msg ?? e.message ?? `Unknown error (type: ${e.type ?? 'unknown'})`,
    );

    let findings = (raw.results ?? []).map((r: SemgrepRawResult) =>
      this.mapRawResult(r),
    );

    if (findings.length > this.maxFindings) {
      errors.push(`Truncated from ${findings.length} to ${this.maxFindings} findings`);
      findings = findings.slice(0, this.maxFindings);
    }

    return {
      findings,
      errors,
      version: raw.version ?? 'unknown',
    };
  }

  private mapRawResult(r: SemgrepRawResult): SemgrepFinding {
    const severity = this.normalizeSeverity(r.extra.severity);
    return {
      check_id: r.check_id,
      path: r.path,
      start: r.start,
      end: r.end,
      message: r.extra.message,
      severity,
      metadata: r.extra.metadata ?? {},
      extra: {
        lines: r.extra.lines ?? '',
        message: r.extra.message,
        severity: r.extra.severity,
        metadata: r.extra.metadata,
        fingerprint: r.extra.fingerprint,
      },
    };
  }

  private normalizeSeverity(raw: string | undefined): SemgrepFinding['severity'] {
    switch (raw?.toUpperCase()) {
      case 'ERROR':
        return 'ERROR';
      case 'WARNING':
        return 'WARNING';
      case 'INFO':
        return 'INFO';
      default:
        return 'WARNING';
    }
  }
}
