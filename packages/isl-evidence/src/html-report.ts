/**
 * ISL Evidence - HTML Report Generator
 * 
 * Generates human-readable HTML reports.
 * 
 * @module @isl-lang/evidence
 */

import type { GateResult, Finding } from '@isl-lang/gate';
import type { EvidenceOptions } from './types.js';

/**
 * Generate HTML report from gate result
 */
export function generateHtmlReport(
  result: GateResult,
  findings: Finding[],
  options: EvidenceOptions
): string {
  const verdictColor = result.verdict === 'SHIP' ? '#22c55e' : '#ef4444';
  const verdictEmoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;

  const findingsHtml = findings.length > 0
    ? findings.map(f => `
      <tr>
        <td><span class="severity severity-${f.severity}">${f.severity.toUpperCase()}</span></td>
        <td>${escapeHtml(f.type)}</td>
        <td>${escapeHtml(f.message)}</td>
        <td>${f.file ? escapeHtml(f.file) : '-'}${f.line ? `:${f.line}` : ''}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="no-findings">No findings</td></tr>';

  const reasonsHtml = result.reasons.length > 0
    ? result.reasons.map(r => `
      <div class="reason">
        <strong>[${escapeHtml(r.code)}]</strong> ${escapeHtml(r.message)}
        ${r.files.length > 0 ? `<br><small>Files: ${r.files.map(f => escapeHtml(f)).join(', ')}</small>` : ''}
      </div>
    `).join('')
    : '<div class="reason">All checks passed</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISL Gate Report - ${result.verdict}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; 
      color: #e2e8f0;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { 
      text-align: center; 
      padding: 2rem;
      margin-bottom: 2rem;
      background: #1e293b;
      border-radius: 12px;
      border-left: 4px solid ${verdictColor};
    }
    .verdict { 
      font-size: 3rem; 
      font-weight: bold;
      color: ${verdictColor};
      margin-bottom: 0.5rem;
    }
    .score { 
      font-size: 1.5rem;
      color: #94a3b8;
    }
    .score-value { 
      font-weight: bold;
      color: ${verdictColor};
    }
    .meta { 
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 1rem;
    }
    .section { 
      background: #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section h2 { 
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1rem;
    }
    .summary-card {
      background: #334155;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card .count {
      font-size: 2rem;
      font-weight: bold;
    }
    .summary-card .label {
      font-size: 0.75rem;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .summary-card.critical .count { color: #ef4444; }
    .summary-card.high .count { color: #f97316; }
    .summary-card.medium .count { color: #eab308; }
    .summary-card.low .count { color: #22c55e; }
    table { 
      width: 100%; 
      border-collapse: collapse;
    }
    th, td { 
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    th { 
      color: #94a3b8;
      font-weight: 500;
      font-size: 0.875rem;
    }
    .severity {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .severity-critical { background: #991b1b; color: #fecaca; }
    .severity-high { background: #9a3412; color: #fed7aa; }
    .severity-medium { background: #854d0e; color: #fef08a; }
    .severity-low { background: #166534; color: #bbf7d0; }
    .reason {
      background: #334155;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }
    .no-findings {
      text-align: center;
      color: #64748b;
      padding: 2rem !important;
    }
    .footer {
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #334155;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="verdict">${verdictEmoji} ${result.verdict}</div>
      <div class="score">Score: <span class="score-value">${result.score}/100</span></div>
      <div class="meta">
        Project: ${escapeHtml(options.projectName || options.projectRoot)}<br>
        Fingerprint: ${result.fingerprint} | Duration: ${result.durationMs}ms
      </div>
    </div>

    <div class="section">
      <h2>📊 Summary</h2>
      <div class="summary-grid">
        <div class="summary-card critical">
          <div class="count">${criticalCount}</div>
          <div class="label">Critical</div>
        </div>
        <div class="summary-card high">
          <div class="count">${highCount}</div>
          <div class="label">High</div>
        </div>
        <div class="summary-card medium">
          <div class="count">${mediumCount}</div>
          <div class="label">Medium</div>
        </div>
        <div class="summary-card low">
          <div class="count">${lowCount}</div>
          <div class="label">Low</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📋 Reasons</h2>
      ${reasonsHtml}
    </div>

    <div class="section">
      <h2>🔍 Findings (${findings.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Message</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          ${findingsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated by ISL Gate v${escapeHtml(options.deterministic ? '0.1.0' : '0.1.0')}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m] || m);
}
