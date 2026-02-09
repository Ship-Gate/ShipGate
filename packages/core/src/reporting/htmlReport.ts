/**
 * HTML Report Generator
 *
 * Produces a self-contained HTML verification report with embedded
 * CSS for professional presentation. Also serves as the base for
 * PDF generation (via md-to-pdf or direct HTML).
 */

import type {
  ReportData,
  ReportFileResult,
  ReportScope,
  ReportVerdict,
} from './reportTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Color & Style Constants
// ─────────────────────────────────────────────────────────────────────────────

const VERDICT_COLORS: Record<ReportVerdict, string> = {
  SHIP: '#22c55e',
  WARN: '#eab308',
  NO_SHIP: '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  PASS: '#22c55e',
  WARN: '#eab308',
  FAIL: '#ef4444',
};

// ─────────────────────────────────────────────────────────────────────────────
// Default Stylesheet
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_REPORT_CSS = `
  :root {
    --sg-bg: #ffffff;
    --sg-text: #1e293b;
    --sg-muted: #64748b;
    --sg-border: #e2e8f0;
    --sg-surface: #f8fafc;
    --sg-green: #22c55e;
    --sg-yellow: #eab308;
    --sg-red: #ef4444;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, sans-serif;
    color: var(--sg-text);
    background: var(--sg-bg);
    line-height: 1.6;
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    border-bottom: 2px solid var(--sg-border);
    padding-bottom: 0.5rem;
  }

  h2 {
    font-size: 1.25rem;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    color: var(--sg-text);
  }

  h3 {
    font-size: 1rem;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .meta { color: var(--sg-muted); font-size: 0.875rem; margin-bottom: 1.5rem; }
  .meta strong { color: var(--sg-text); }

  .verdict-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  th, td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--sg-border);
  }

  th {
    background: var(--sg-surface);
    font-weight: 600;
    color: var(--sg-muted);
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  tr:hover td { background: var(--sg-surface); }

  .status-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    font-size: 0.75rem;
  }

  .file-detail {
    background: var(--sg-surface);
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .file-detail h3 { margin-top: 0; }
  .file-detail p { margin: 0.25rem 0; font-size: 0.875rem; }
  .file-detail .label { color: var(--sg-muted); font-weight: 600; }

  .recommendation-list {
    list-style: none;
    counter-reset: rec;
  }

  .recommendation-list li {
    counter-increment: rec;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--sg-border);
    font-size: 0.875rem;
  }

  .recommendation-list li::before {
    content: counter(rec) ".";
    font-weight: 700;
    margin-right: 0.5rem;
    color: var(--sg-muted);
  }

  .footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--sg-border);
    font-size: 0.75rem;
    color: var(--sg-muted);
  }

  code {
    background: var(--sg-surface);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.8125rem;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// HTML Generator
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a self-contained HTML verification report */
export function generateHtmlReport(
  data: ReportData,
  scope: ReportScope = 'full',
  options?: {
    includeRecommendations?: boolean;
    includeTrends?: boolean;
    title?: string;
    customCss?: string;
  },
): string {
  const title = options?.title ?? 'ShipGate Verification Report';
  const css = options?.customCss ?? DEFAULT_REPORT_CSS;

  const failures = data.files.filter((f) => f.status === 'FAIL');
  const warnings = data.files.filter((f) => f.status === 'WARN');
  const passing = data.files.filter((f) => f.status === 'PASS');

  const sections: string[] = [];

  // Summary table
  sections.push(renderSummarySection(data));

  // Failures
  if (failures.length > 0) {
    sections.push(renderFileSection('Failures', failures));
  }

  // Warnings (not in failures-only scope)
  if (scope !== 'failures-only' && warnings.length > 0) {
    sections.push(renderFileSection('Warnings', warnings));
  }

  // Passing (full scope only)
  if (scope === 'full' && passing.length > 0) {
    sections.push(renderPassingSection(passing));
  }

  // Trends
  if (
    options?.includeTrends !== false &&
    data.trends &&
    data.trends.length > 0
  ) {
    sections.push(renderTrendsSection(data.trends));
  }

  // Recommendations
  if (
    options?.includeRecommendations !== false &&
    data.recommendations.length > 0
  ) {
    sections.push(renderRecommendationsSection(data.recommendations));
  }

  const verdictColor = VERDICT_COLORS[data.verdict];
  const scorePercent = Math.round(data.score * 100);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <p><strong>Repository:</strong> ${escapeHtml(data.repository.repository)}</p>
    <p><strong>Branch:</strong> ${escapeHtml(data.repository.branch)}</p>
    ${data.repository.commit ? `<p><strong>Commit:</strong> <code>${escapeHtml(data.repository.commit)}</code></p>` : ''}
    <p><strong>Date:</strong> ${escapeHtml(formatDate(data.generatedAt))}</p>
    <p>
      <strong>Verdict:</strong>
      <span class="verdict-badge" style="background:${verdictColor}">
        ${escapeHtml(data.verdict)}
      </span>
      &nbsp; Score: ${scorePercent}
    </p>
  </div>

  ${sections.join('\n\n')}

  <div class="footer">
    Generated by ShipGate in ${formatDuration(data.duration)} | Mode: ${escapeHtml(data.mode)}
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Renderers
// ─────────────────────────────────────────────────────────────────────────────

function renderSummarySection(data: ReportData): string {
  return `
  <h2>Summary</h2>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Files Verified</td><td>${data.coverage.totalFiles}</td></tr>
      <tr><td>ISL Coverage</td><td>${data.coverage.coveragePercent}% (${data.coverage.specCoveredFiles}/${data.coverage.totalFiles})</td></tr>
      <tr><td>Passing</td><td>${data.coverage.passingFiles}</td></tr>
      <tr><td>Warnings</td><td>${data.coverage.warningFiles}</td></tr>
      <tr><td>Failures</td><td>${data.coverage.failingFiles}</td></tr>
      <tr><td>Duration</td><td>${formatDuration(data.duration)}</td></tr>
    </tbody>
  </table>`;
}

function renderFileSection(heading: string, files: ReportFileResult[]): string {
  const items = files
    .map((f) => {
      const color = STATUS_COLORS[f.status] ?? '#64748b';
      const scorePercent = Math.round(f.score * 100);
      const blockers = f.blockers.length > 0
        ? `<p class="label">Blockers:</p><ul>${f.blockers.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
        : '';
      const finding = f.finding
        ? `<p><span class="label">Finding:</span> ${escapeHtml(f.finding)}</p>`
        : '';
      const recommendation = f.recommendation
        ? `<p><span class="label">Recommendation:</span> ${escapeHtml(f.recommendation)}</p>`
        : '';

      return `
      <div class="file-detail">
        <h3>
          <code>${escapeHtml(f.file)}</code>
          &mdash;
          <span class="status-badge" style="background:${color}">${escapeHtml(f.status)}</span>
          (Score: ${scorePercent})
        </h3>
        <p><span class="label">Method:</span> ${escapeHtml(f.method)}</p>
        ${finding}
        ${blockers}
        ${recommendation}
      </div>`;
    })
    .join('\n');

  return `<h2>${escapeHtml(heading)}</h2>\n${items}`;
}

function renderPassingSection(files: ReportFileResult[]): string {
  const rows = files
    .map(
      (f) =>
        `<tr><td><code>${escapeHtml(f.file)}</code></td><td>${escapeHtml(f.method)}</td><td>${Math.round(f.score * 100)}</td></tr>`,
    )
    .join('\n');

  return `
  <h2>Passing</h2>
  <table>
    <thead><tr><th>File</th><th>Method</th><th>Score</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTrendsSection(
  trends: Array<{ date: string; coverage: number; score: number; label?: string }>,
): string {
  const rows = trends
    .map(
      (t) =>
        `<tr><td>${escapeHtml(formatDate(t.date))}</td><td>${t.coverage}%</td><td>${t.score}</td><td>${escapeHtml(t.label ?? '')}</td></tr>`,
    )
    .join('\n');

  return `
  <h2>Coverage Trend</h2>
  <table>
    <thead><tr><th>Date</th><th>Coverage</th><th>Score</th><th>Label</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderRecommendationsSection(
  recs: Array<{ priority: number; text: string; target?: string }>,
): string {
  const items = recs
    .map((r) => {
      const target = r.target ? ` (<code>${escapeHtml(r.target)}</code>)` : '';
      return `<li>${escapeHtml(r.text)}${target}</li>`;
    })
    .join('\n');

  return `
  <h2>Recommendations</h2>
  <ol class="recommendation-list">${items}</ol>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().split('T')[0] ?? iso;
  } catch {
    return iso;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
