/**
 * JSON Report Generator
 *
 * Produces machine-readable JSON reports for CI/CD pipelines,
 * dashboards, and other automated consumers.
 */

import type {
  ReportData,
  ReportScope,
} from './reportTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// JSON Report Shape
// ─────────────────────────────────────────────────────────────────────────────

/** JSON report output — deliberately flat and explicit for easy consumption */
export interface JsonReportOutput {
  /** Schema version for forward compatibility */
  $schema: 'shipgate-report-v1';
  /** ISO 8601 generation timestamp */
  generatedAt: string;
  /** Overall verdict */
  verdict: string;
  /** Overall score (0–100, integer) */
  score: number;
  /** Repository metadata */
  repository: {
    url: string;
    branch: string;
    commit?: string;
  };
  /** Coverage summary */
  coverage: {
    totalFiles: number;
    specCoveredFiles: number;
    coveragePercent: number;
    passing: number;
    warnings: number;
    failures: number;
  };
  /** Verification mode */
  mode: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Per-file results */
  files: Array<{
    file: string;
    status: string;
    method: string;
    score: number;
    specFile?: string;
    blockers: string[];
    finding?: string;
    recommendation?: string;
  }>;
  /** Aggregated blockers */
  blockers: string[];
  /** Prioritized recommendations */
  recommendations: Array<{
    priority: number;
    text: string;
    target?: string;
  }>;
  /** Trend data (if available) */
  trends?: Array<{
    date: string;
    coverage: number;
    score: number;
    label?: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a machine-readable JSON report */
export function generateJsonReport(
  data: ReportData,
  scope: ReportScope = 'full',
): string {
  const filteredFiles =
    scope === 'failures-only'
      ? data.files.filter((f) => f.status === 'FAIL')
      : scope === 'summary'
        ? []
        : data.files;

  const output: JsonReportOutput = {
    $schema: 'shipgate-report-v1',
    generatedAt: data.generatedAt,
    verdict: data.verdict,
    score: Math.round(data.score * 100),
    repository: {
      url: data.repository.repository,
      branch: data.repository.branch,
      commit: data.repository.commit,
    },
    coverage: {
      totalFiles: data.coverage.totalFiles,
      specCoveredFiles: data.coverage.specCoveredFiles,
      coveragePercent: data.coverage.coveragePercent,
      passing: data.coverage.passingFiles,
      warnings: data.coverage.warningFiles,
      failures: data.coverage.failingFiles,
    },
    mode: data.mode,
    durationMs: data.duration,
    files: filteredFiles.map((f) => ({
      file: f.file,
      status: f.status,
      method: f.method,
      score: Math.round(f.score * 100),
      specFile: f.specFile,
      blockers: f.blockers,
      finding: f.finding,
      recommendation: f.recommendation,
    })),
    blockers: data.blockers,
    recommendations: data.recommendations.map((r) => ({
      priority: r.priority,
      text: r.text,
      target: r.target,
    })),
  };

  if (data.trends && data.trends.length > 0) {
    output.trends = data.trends.map((t) => ({
      date: t.date,
      coverage: t.coverage,
      score: t.score,
      label: t.label,
    }));
  }

  return JSON.stringify(output, null, 2);
}
