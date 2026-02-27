/**
 * Report Generator
 *
 * Produces machine-readable JSON reports and human-readable summaries
 * from runtime probe results. Also generates proof bundle artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  RuntimeProbeReport,
  RuntimeProofArtifact,
  RuntimeVerdict,
  RuntimeClaim,
  RouteProbeResult,
  EnvCheckResult,
  SideEffectResult,
} from './types.js';
import { computeHash, generateId } from './types.js';
import { scoreClaims } from './claim-builder.js';

// ── Public API ─────────────────────────────────────────────────────────────

export interface BuildReportInput {
  baseUrl: string;
  truthpackHash: string;
  routeResults: RouteProbeResult[];
  envResults: EnvCheckResult[];
  sideEffectResults: SideEffectResult[];
  claims: RuntimeClaim[];
  durationMs: number;
}

/**
 * Build the full machine-readable report.
 */
export function buildReport(input: BuildReportInput): RuntimeProbeReport {
  const score = scoreClaims(input.claims);
  const verdict = determineVerdict(score, input.claims);

  const report: RuntimeProbeReport = {
    version: '1.0.0',
    reportId: generateId('rpt'),
    generatedAt: new Date().toISOString(),
    verdict,
    score,
    baseUrl: input.baseUrl,
    truthpackHash: input.truthpackHash,

    summary: {
      routes: {
        total: input.routeResults.length,
        probed: input.routeResults.filter((r) => r.status !== 'skip').length,
        passed: input.routeResults.filter((r) => r.status === 'pass').length,
        failed: input.routeResults.filter((r) => r.status === 'fail').length,
        skipped: input.routeResults.filter((r) => r.status === 'skip').length,
      },
      envVars: {
        total: input.envResults.length,
        checked: input.envResults.filter((r) => r.status !== 'skip').length,
        passed: input.envResults.filter((r) => r.status === 'pass').length,
        failed: input.envResults.filter((r) => r.status === 'fail').length,
        skipped: input.envResults.filter((r) => r.status === 'skip').length,
      },
      sideEffects: {
        total: input.sideEffectResults.length,
        checked: input.sideEffectResults.filter((r) => r.status !== 'skip').length,
        passed: input.sideEffectResults.filter((r) => r.status === 'pass').length,
        failed: input.sideEffectResults.filter((r) => r.status === 'fail').length,
      },
      fakeSuccessDetections: input.routeResults.filter((r) => r.fakeSuccessDetected).length,
      totalClaims: input.claims.length,
      durationMs: input.durationMs,
    },

    routeResults: input.routeResults,
    envResults: input.envResults,
    sideEffectResults: input.sideEffectResults,
    claims: input.claims,

    integrityHash: '',
  };

  // Compute integrity hash over the serialized report (minus the hash field)
  const hashContent = JSON.stringify({ ...report, integrityHash: '' });
  report.integrityHash = computeHash(hashContent);

  return report;
}

/**
 * Build a proof bundle artifact from the report.
 */
export function buildProofArtifact(
  report: RuntimeProbeReport,
): RuntimeProofArtifact {
  return {
    type: 'runtime-probe',
    version: '1.0.0',
    reportId: report.reportId,
    verdict: report.verdict,
    score: report.score,
    claimCount: report.claims.length,
    passedClaims: report.claims.filter((c) => c.status === 'pass').length,
    failedClaims: report.claims.filter((c) => c.status === 'fail').length,
    generatedAt: report.generatedAt,
    integrityHash: report.integrityHash,
  };
}

/**
 * Write report and artifacts to the output directory.
 */
export function writeReportToDir(
  report: RuntimeProbeReport,
  outputDir: string,
): { reportPath: string; artifactPath: string; summaryPath: string } {
  fs.mkdirSync(outputDir, { recursive: true });

  const reportPath = path.join(outputDir, 'runtime-probe-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  const artifact = buildProofArtifact(report);
  const artifactPath = path.join(outputDir, 'runtime-probe-artifact.json');
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');

  const summary = formatHumanSummary(report);
  const summaryPath = path.join(outputDir, 'runtime-probe-summary.md');
  fs.writeFileSync(summaryPath, summary, 'utf-8');

  return { reportPath, artifactPath, summaryPath };
}

// ── Human-Readable Summary ─────────────────────────────────────────────────

/**
 * Format a human-readable summary of the runtime probe report.
 */
export function formatHumanSummary(report: RuntimeProbeReport): string {
  const lines: string[] = [];
  const { summary } = report;

  lines.push('# Runtime Probe Report');
  lines.push('');
  lines.push(`**Verdict:** ${verdictEmoji(report.verdict)} ${report.verdict}`);
  lines.push(`**Score:** ${report.score}/100`);
  lines.push(`**Base URL:** ${report.baseUrl}`);
  lines.push(`**Duration:** ${summary.durationMs.toFixed(0)}ms`);
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // Routes
  lines.push('## Routes');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total | ${summary.routes.total} |`);
  lines.push(`| Probed | ${summary.routes.probed} |`);
  lines.push(`| Passed | ${summary.routes.passed} |`);
  lines.push(`| Failed | ${summary.routes.failed} |`);
  lines.push(`| Skipped | ${summary.routes.skipped} |`);
  lines.push('');

  // Failed routes detail
  const failedRoutes = report.routeResults.filter((r) => r.status === 'fail');
  if (failedRoutes.length > 0) {
    lines.push('### Failed Routes');
    lines.push('');
    for (const r of failedRoutes) {
      lines.push(`- **${r.route.method} ${r.route.path}** — ${r.error ?? `HTTP ${r.httpStatus}`}`);
    }
    lines.push('');
  }

  // Fake-success warnings
  const fakeRoutes = report.routeResults.filter((r) => r.fakeSuccessDetected);
  if (fakeRoutes.length > 0) {
    lines.push('### Fake-Success Warnings');
    lines.push('');
    for (const r of fakeRoutes) {
      lines.push(`- **${r.route.method} ${r.route.path}** — signals: ${r.fakeSuccessSignals.join(', ')}`);
    }
    lines.push('');
  }

  // Env Vars
  lines.push('## Environment Variables');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total | ${summary.envVars.total} |`);
  lines.push(`| Checked | ${summary.envVars.checked} |`);
  lines.push(`| Passed | ${summary.envVars.passed} |`);
  lines.push(`| Failed | ${summary.envVars.failed} |`);
  lines.push(`| Skipped | ${summary.envVars.skipped} |`);
  lines.push('');

  // Failed env vars detail
  const failedEnv = report.envResults.filter((r) => r.status === 'fail');
  if (failedEnv.length > 0) {
    lines.push('### Missing / Failed Env Vars');
    lines.push('');
    for (const r of failedEnv) {
      lines.push(`- **${r.variable.name}** (required: ${r.variable.required}, source: ${r.variable.file}:${r.variable.line})`);
    }
    lines.push('');
  }

  // Side Effects
  if (summary.sideEffects.total > 0) {
    lines.push('## Side Effects');
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total | ${summary.sideEffects.total} |`);
    lines.push(`| Checked | ${summary.sideEffects.checked} |`);
    lines.push(`| Passed | ${summary.sideEffects.passed} |`);
    lines.push(`| Failed | ${summary.sideEffects.failed} |`);
    lines.push('');
  }

  // Claims summary
  lines.push('## Claims');
  lines.push('');
  lines.push(`Total claims generated: **${summary.totalClaims}**`);
  lines.push('');

  const claimsByType = groupBy(report.claims, (c) => c.type);
  lines.push('| Claim Type | Pass | Fail | Warn | Skip |');
  lines.push('|------------|------|------|------|------|');
  for (const [type, claims] of Object.entries(claimsByType)) {
    const pass = claims.filter((c) => c.status === 'pass').length;
    const fail = claims.filter((c) => c.status === 'fail').length;
    const warn = claims.filter((c) => c.status === 'warn').length;
    const skip = claims.filter((c) => c.status === 'skip').length;
    lines.push(`| ${type} | ${pass} | ${fail} | ${warn} | ${skip} |`);
  }
  lines.push('');

  // Integrity
  lines.push('---');
  lines.push(`Report ID: \`${report.reportId}\``);
  lines.push(`Integrity: \`${report.integrityHash.slice(0, 16)}...\``);
  lines.push(`Truthpack Hash: \`${report.truthpackHash.slice(0, 16)}...\``);

  return lines.join('\n');
}

/**
 * Format a compact one-line CLI summary.
 */
export function formatCliSummary(report: RuntimeProbeReport): string {
  const icon = verdictEmoji(report.verdict);
  const { summary } = report;
  return [
    `${icon} Runtime Probe: ${report.verdict} (${report.score}/100)`,
    `  Routes: ${summary.routes.passed}/${summary.routes.total} pass`,
    `  Env: ${summary.envVars.passed}/${summary.envVars.total} pass`,
    summary.fakeSuccessDetections > 0
      ? `  Fake-success: ${summary.fakeSuccessDetections} detected`
      : null,
    `  Claims: ${summary.totalClaims} total`,
    `  Duration: ${summary.durationMs.toFixed(0)}ms`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Internal helpers ───────────────────────────────────────────────────────

function determineVerdict(
  score: number,
  claims: RuntimeClaim[],
): RuntimeVerdict {
  const failCount = claims.filter((c) => c.status === 'fail').length;

  if (score >= 85 && failCount === 0) return 'PROVEN';
  if (score >= 50 || failCount <= 2) return 'INCOMPLETE';
  return 'FAILED';
}

function verdictEmoji(verdict: RuntimeVerdict): string {
  switch (verdict) {
    case 'PROVEN': return '[PASS]';
    case 'INCOMPLETE': return '[WARN]';
    case 'FAILED': return '[FAIL]';
    default: return '[????]';
  }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key]!.push(item);
  }
  return result;
}
