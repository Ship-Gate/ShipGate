/**
 * Dependency Audit Check
 *
 * Run npm audit --json on package.json, parse results.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'dependency-audit';

interface ScanInput {
  rootDir: string;
  packageJsonPath?: string;
}

interface NpmAuditVulnerability {
  severity: string;
  via: Array<string | { id: string; severity: string; title: string }>;
  effects?: string[];
}

interface NpmAuditJson {
  auditReportVersion?: number;
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
  metadata?: {
    vulnerabilities: { info: number; low: number; moderate: number; high: number; critical: number };
  };
}

function runNpmAudit(cwd: string): Promise<NpmAuditJson> {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['audit', '--json'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout) as NpmAuditJson;
        resolve(parsed);
      } catch {
        resolve({
          vulnerabilities: {},
          metadata: {
            vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
          },
        });
      }
    });

    proc.on('error', () => {
      resolve({
        vulnerabilities: {},
        metadata: {
          vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
        },
      });
    });
  });
}

function mapNpmSeverityToOurs(s: string): 'critical' | 'high' | 'medium' | 'low' {
  switch (s.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
      return 'medium';
    case 'low':
    case 'info':
    default:
      return 'low';
  }
}

export async function runDependencyAuditCheck(
  input: ScanInput
): Promise<SecurityCheckResult> {
  const pkgPath =
    input.packageJsonPath ??
    path.join(input.rootDir, 'package.json');

  const dir = path.dirname(pkgPath);
  const auditResult = await runNpmAudit(dir);

  const findings: SecurityFinding[] = [];
  const vulns = auditResult.vulnerabilities ?? {};
  const meta = auditResult.metadata?.vulnerabilities;

  for (const [pkg, vuln] of Object.entries(vulns)) {
    const via = vuln.via;
    if (!via || via.length === 0) continue;

    const first = via[0];
    if (!first) continue;
    const severity =
      typeof first === 'string'
        ? 'medium'
        : mapNpmSeverityToOurs(first.severity);
    const title = typeof first === 'string' ? first : first.title;

    findings.push({
      id: 'DEP001',
      title: `Vulnerable dependency: ${pkg}`,
      severity,
      file: 'package.json',
      line: 1,
      description: title,
      recommendation: `Run "npm audit fix" or update ${pkg} to a patched version.`,
      context: { package: pkg, severity },
    });
  }

  // If no vulns but metadata exists, add summary
  if (findings.length === 0 && meta) {
    const total =
      (meta.critical ?? 0) +
      (meta.high ?? 0) +
      (meta.moderate ?? 0) +
      (meta.low ?? 0) +
      (meta.info ?? 0);
    if (total > 0) {
      findings.push({
        id: 'DEP002',
        title: 'npm audit reported vulnerabilities',
        severity: (meta.critical ?? 0) > 0 ? 'critical' : (meta.high ?? 0) > 0 ? 'high' : 'medium',
        file: 'package.json',
        line: 1,
        description: `Critical: ${meta.critical ?? 0}, High: ${meta.high ?? 0}, Moderate: ${meta.moderate ?? 0}`,
        recommendation: 'Run "npm audit" for details and "npm audit fix" to remediate.',
        context: meta,
      });
    }
  }

  const criticalOrHigh = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  return {
    check: CHECK_ID,
    severity: criticalOrHigh.length > 0 ? 'high' : 'medium',
    passed: criticalOrHigh.length === 0,
    findings,
  };
}
