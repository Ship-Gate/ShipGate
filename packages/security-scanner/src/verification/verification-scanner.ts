/**
 * Verification Security Scanner
 *
 * Orchestrates all security checks for the verification pipeline.
 * Critical/high findings → NO_SHIP. Medium/low → warnings only.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { runSqlInjectionCheck } from './checks/sql-injection.js';
import { runAuthBypassCheck } from './checks/auth-bypass.js';
import { runSecretExposureCheck } from './checks/secret-exposure.js';
import { runXssCheck } from './checks/xss.js';
import { runSsrfCheck } from './checks/ssrf.js';
import { runDependencyAuditCheck } from './checks/dependency-audit.js';
import { runOwaspHeadersCheck } from './checks/owasp-headers.js';
import type {
  VerificationSecurityScanOptions,
  VerificationSecurityScanResult,
  SecurityCheckResult,
  SecurityFinding,
  SecuritySeverity,
} from './types.js';

export type { VerificationSecurityScanOptions, VerificationSecurityScanResult };

/** Recursively find files matching extensions */
async function findFiles(
  dir: string,
  extensions: RegExp,
  maxDepth = 5,
  currentDepth = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (
        ent.name !== 'node_modules' &&
        ent.name !== '.git' &&
        ent.name !== 'dist' &&
        ent.name !== 'build'
      ) {
        files.push(...(await findFiles(full, extensions, maxDepth, currentDepth + 1)));
      }
    } else if (extensions.test(ent.name)) {
      files.push(full);
    }
  }

  return files;
}

/** Read file contents */
async function readFiles(paths: string[]): Promise<Array<{ path: string; content: string }>> {
  const result: Array<{ path: string; content: string }> = [];
  for (const p of paths) {
    try {
      const content = await fs.readFile(p, 'utf-8');
      result.push({ path: p, content });
    } catch {
      // Skip unreadable files
    }
  }
  return result;
}

export class VerificationSecurityScanner {
  constructor(private options: VerificationSecurityScanOptions = {}) {}

  /**
   * Run all security checks and return aggregated result.
   */
  async scan(): Promise<VerificationSecurityScanResult> {
    const start = Date.now();
    const rootDir = this.options.rootDir ?? process.cwd();

    // Gather files
    const implPaths =
      this.options.implPaths ??
      (await findFiles(
        rootDir,
        /\.(ts|tsx|js|jsx|json|env|yaml|yml)$/
      ));

    const implFiles = await readFiles(implPaths);

    // ISL source
    let islSource = this.options.islSource ?? '';
    if (!islSource && this.options.islSpecPath) {
      try {
        islSource = await fs.readFile(this.options.islSpecPath, 'utf-8');
      } catch {
        // No ISL file
      }
    }
    if (!islSource) {
      const islPaths = await findFiles(rootDir, /\.isl$/);
      for (const p of islPaths) {
        try {
          islSource += await fs.readFile(p, 'utf-8');
          islSource += '\n';
        } catch {
          //
        }
      }
    }

    const checks: SecurityCheckResult[] = [];

    // 1. SQL Injection
    checks.push(runSqlInjectionCheck({ files: implFiles }));

    // 2. Auth Bypass
    checks.push(
      runAuthBypassCheck({
        islSource,
        implFiles,
      })
    );

    // 3. Secret Exposure (async)
    checks.push(
      await runSecretExposureCheck({
        rootDir,
        files: implFiles,
      })
    );

    // 4. XSS
    checks.push(runXssCheck({ files: implFiles }));

    // 5. SSRF
    checks.push(runSsrfCheck({ files: implFiles }));

    // 6. Dependency Audit
    if (!this.options.skipDependencyAudit) {
      checks.push(
        await runDependencyAuditCheck({
          rootDir,
          packageJsonPath: this.options.packageJsonPath,
        })
      );
    }

    // 7. OWASP Headers
    checks.push(runOwaspHeadersCheck({ files: implFiles }));

    // Aggregate
    const allFindings: SecurityFinding[] = checks.flatMap((c) => c.findings);
    const summary = this.computeSummary(allFindings);
    const hasBlockingFindings = summary.critical > 0 || summary.high > 0;
    const hasWarnings = summary.medium > 0 || summary.low > 0;

    return {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      checks,
      hasBlockingFindings,
      hasWarnings,
      summary,
    };
  }

  private computeSummary(findings: SecurityFinding[]): VerificationSecurityScanResult['summary'] {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: findings.length,
    };
    for (const f of findings) {
      summary[f.severity as SecuritySeverity]++;
    }
    return summary;
  }

  /**
   * Returns true if scan passes (no critical/high findings).
   * Critical/high → NO_SHIP.
   */
  shouldBlockShip(result: VerificationSecurityScanResult): boolean {
    return result.hasBlockingFindings;
  }
}

/**
 * Run verification security scan with default options.
 */
export async function runVerificationSecurityScan(
  options?: VerificationSecurityScanOptions
): Promise<VerificationSecurityScanResult> {
  const scanner = new VerificationSecurityScanner(options);
  return scanner.scan();
}
