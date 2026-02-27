/**
 * ISL Studio - Evidence Report Generator
 * 
 * Generates a beautiful HTML report that makes people go:
 * "Oh… it's not a linter. It's a ship decision with receipts."
 */

import type { GateResult } from './gate.js';

export function generateHtmlReport(result: GateResult, projectName?: string): string {
  const verdictColor = result.verdict === 'SHIP' ? '#22c55e' : '#ef4444';
  const verdictEmoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  
  const violationRows = result.violations.map(v => {
    const tierBadge = v.tier === 'hard_block' 
      ? '<span class="badge blocker">BLOCKER</span>'
      : v.tier === 'soft_block'
      ? '<span class="badge warning">WARNING</span>'
      : '<span class="badge info">INFO</span>';
    
    return `
      <tr>
        <td>${tierBadge}</td>
        <td><code>${v.ruleId}</code></td>
        <td><code>${v.filePath || '-'}</code></td>
        <td>${v.message}</td>
        <td>${v.suggestion || '-'}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISL Gate Report - ${result.verdict}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --green: #22c55e;
      --red: #ef4444;
      --yellow: #eab308;
      --blue: #3b82f6;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    
    .container { max-width: 1200px; margin: 0 auto; }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    
    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
    }
    
    .verdict-card {
      background: var(--card);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      border: 2px solid ${verdictColor};
    }
    
    .verdict-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .verdict-emoji { font-size: 3rem; }
    
    .verdict-text {
      font-size: 2.5rem;
      font-weight: 700;
      color: ${verdictColor};
    }
    
    .score {
      font-size: 1.25rem;
      color: var(--muted);
      margin-left: auto;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .stat {
      background: var(--bg);
      padding: 1rem;
      border-radius: 0.5rem;
      text-align: center;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
    }
    
    .stat-label {
      color: var(--muted);
      font-size: 0.875rem;
    }
    
    .section {
      background: var(--card);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    
    th {
      color: var(--muted);
      font-weight: 500;
      font-size: 0.875rem;
    }
    
    code {
      background: var(--bg);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-family: 'Fira Code', monospace;
      font-size: 0.875rem;
    }
    
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge.blocker { background: var(--red); color: white; }
    .badge.warning { background: var(--yellow); color: black; }
    .badge.info { background: var(--blue); color: white; }
    
    .evidence {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }
    
    .evidence-item {
      flex: 1;
      min-width: 200px;
    }
    
    .evidence-label {
      color: var(--muted);
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
    }
    
    .evidence-value {
      font-family: 'Fira Code', monospace;
      word-break: break-all;
    }
    
    .rerun {
      background: var(--bg);
      padding: 1rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
    }
    
    .rerun code {
      display: block;
      padding: 0.5rem;
    }
    
    footer {
      text-align: center;
      padding-top: 2rem;
      color: var(--muted);
      font-size: 0.875rem;
    }
    
    @media (max-width: 768px) {
      body { padding: 1rem; }
      .verdict-header { flex-wrap: wrap; }
      .score { margin-left: 0; margin-top: 0.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">ISL Studio</div>
      <div>${projectName || 'Gate Report'}</div>
    </header>

    <div class="verdict-card">
      <div class="verdict-header">
        <span class="verdict-emoji">${verdictEmoji}</span>
        <span class="verdict-text">${result.verdict}</span>
        <span class="score">Score: ${result.score}/100</span>
      </div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${result.summary.filesChecked}</div>
          <div class="stat-label">Files Checked</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--red)">${result.summary.blockers}</div>
          <div class="stat-label">Blockers</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--yellow)">${result.summary.warnings}</div>
          <div class="stat-label">Warnings</div>
        </div>
      </div>
    </div>

    ${result.violations.length > 0 ? `
    <div class="section">
      <h2>🚨 Violations</h2>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Rule</th>
            <th>File</th>
            <th>Message</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          ${violationRows}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="section">
      <h2>✅ No Violations</h2>
      <p>All checks passed. Safe to ship!</p>
    </div>
    `}

    <div class="section">
      <h2>📦 Evidence</h2>
      <div class="evidence">
        <div class="evidence-item">
          <div class="evidence-label">Fingerprint</div>
          <div class="evidence-value"><code>${result.fingerprint}</code></div>
        </div>
        <div class="evidence-item">
          <div class="evidence-label">Generated</div>
          <div class="evidence-value">${new Date().toISOString()}</div>
        </div>
      </div>
      
      <div class="rerun">
        <div class="evidence-label">Rerun locally:</div>
        <code>npx islstudio gate</code>
      </div>
    </div>

    <footer>
      Generated by ISL Studio v0.1.0 • <a href="https://islstudio.dev" style="color: var(--blue)">islstudio.dev</a>
    </footer>
  </div>
</body>
</html>`;
}
