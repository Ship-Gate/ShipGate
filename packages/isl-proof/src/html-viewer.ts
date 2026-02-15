/**
 * ISL Proof Bundle - HTML Viewer
 * 
 * Generates a static HTML report for viewing proof bundles.
 * 
 * @module @isl-lang/proof
 */

import type { ProofBundleManifest } from './manifest.js';

// ============================================================================
// HTML Viewer
// ============================================================================

/**
 * Generate HTML viewer for proof bundle
 */
export function generateHtmlViewer(manifest: ProofBundleManifest): string {
  const verdictColor = getVerdictColor(manifest.verdict);
  const verdictIcon = getVerdictIcon(manifest.verdict);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proof Bundle: ${manifest.spec.domain}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #f8fafc; }
    h2 {
      font-size: 1.5rem;
      margin: 2rem 0 1rem;
      color: #94a3b8;
      border-bottom: 2px solid #334155;
      padding-bottom: 0.5rem;
    }
    h3 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: #cbd5e1; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #334155;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .verdict {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 700;
      font-size: 1.5rem;
      background: ${verdictColor}20;
      color: ${verdictColor};
      border: 2px solid ${verdictColor}40;
    }
    .card {
      background: #1e293b;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1rem;
      border: 1px solid #334155;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .stat {
      text-align: center;
      padding: 1rem;
      background: #0f172a;
      border-radius: 0.5rem;
      border: 1px solid #334155;
    }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 0.25rem;
    }
    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    .warn { color: #f59e0b; }
    .info { color: #3b82f6; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
      background: #0f172a;
      border-radius: 0.5rem;
      overflow: hidden;
    }
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    th {
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      background: #1e293b;
    }
    tr:hover { background: #1e293b; }
    code {
      background: #334155;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      color: #e2e8f0;
    }
    .meta {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.8;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-success { background: #22c55e20; color: #22c55e; }
    .badge-error { background: #ef444420; color: #ef4444; }
    .badge-warning { background: #f59e0b20; color: #f59e0b; }
    .badge-info { background: #3b82f620; color: #3b82f6; }
    .section {
      margin-bottom: 2rem;
    }
    .hash {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #94a3b8;
      word-break: break-all;
    }
    .tooltip {
      position: relative;
      cursor: help;
      border-bottom: 1px dotted #64748b;
    }
    .json-viewer {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      max-height: 400px;
      overflow-y: auto;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .collapsible {
      cursor: pointer;
      user-select: none;
    }
    .collapsible:hover {
      color: #cbd5e1;
    }
    .collapsible-content {
      display: none;
      margin-top: 1rem;
    }
    .collapsible-content.expanded {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Proof Bundle: ${escapeHtml(manifest.spec.domain)}</h1>
        <div class="meta" style="margin-top: 0.5rem;">
          Bundle ID: <code class="hash">${manifest.bundleId}</code><br>
          Generated: ${formatDate(manifest.generatedAt)}<br>
          Schema Version: ${manifest.schemaVersion}
        </div>
      </div>
      <div class="verdict">
        ${verdictIcon} ${manifest.verdict}
      </div>
    </div>

    <div class="card" style="background: ${verdictColor}10; border-color: ${verdictColor}40;">
      <p style="font-size: 1.125rem; line-height: 1.8;">
        <strong>Verdict Reason:</strong><br>
        ${escapeHtml(manifest.verdictReason)}
      </p>
    </div>

    <h2>Summary</h2>
    <div class="grid">
      <div class="stat">
        <div class="stat-value ${manifest.gateResult.verdict === 'SHIP' ? 'pass' : 'fail'}">
          ${manifest.gateResult.verdict}
        </div>
        <div class="stat-label">Gate Verdict</div>
        <div class="meta" style="margin-top: 0.5rem;">
          Score: ${manifest.gateResult.score}<br>
          Blockers: ${manifest.gateResult.blockers}<br>
          Warnings: ${manifest.gateResult.warnings}
        </div>
      </div>
      <div class="stat">
        <div class="stat-value ${manifest.buildResult.status === 'pass' ? 'pass' : manifest.buildResult.status === 'fail' ? 'fail' : 'info'}">
          ${manifest.buildResult.status.toUpperCase()}
        </div>
        <div class="stat-label">Build Status</div>
        <div class="meta" style="margin-top: 0.5rem;">
          Tool: ${manifest.buildResult.tool} ${manifest.buildResult.toolVersion}<br>
          Errors: ${manifest.buildResult.errorCount}<br>
          Warnings: ${manifest.buildResult.warningCount}
        </div>
      </div>
      <div class="stat">
        <div class="stat-value ${manifest.testResult.status === 'pass' ? 'pass' : manifest.testResult.status === 'fail' ? 'fail' : 'warn'}">
          ${manifest.testResult.passedTests}/${manifest.testResult.totalTests}
        </div>
        <div class="stat-label">Tests Passed</div>
        <div class="meta" style="margin-top: 0.5rem;">
          Framework: ${manifest.testResult.framework}<br>
          Failed: ${manifest.testResult.failedTests}<br>
          Skipped: ${manifest.testResult.skippedTests}
        </div>
      </div>
      ${manifest.verifyResults ? `
      <div class="stat">
        <div class="stat-value ${manifest.verifyResults.verdict === 'PROVEN' ? 'pass' : manifest.verifyResults.verdict === 'VIOLATED' ? 'fail' : 'warn'}">
          ${manifest.verifyResults.summary.provenClauses}/${manifest.verifyResults.summary.totalClauses}
        </div>
        <div class="stat-label">Clauses Proven</div>
        <div class="meta" style="margin-top: 0.5rem;">
          Verdict: ${manifest.verifyResults.verdict}<br>
          Unknown: ${manifest.verifyResults.summary.unknownClauses}<br>
          Violated: ${manifest.verifyResults.summary.violatedClauses}
        </div>
      </div>
      ` : ''}
    </div>

    <h2>Specification</h2>
    <div class="card">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div>
          <div class="meta"><strong>Domain:</strong></div>
          <div style="margin-top: 0.25rem; font-size: 1.125rem;">${escapeHtml(manifest.spec.domain)}</div>
        </div>
        <div>
          <div class="meta"><strong>Version:</strong></div>
          <div style="margin-top: 0.25rem; font-size: 1.125rem;">${escapeHtml(manifest.spec.version)}</div>
        </div>
        <div>
          <div class="meta"><strong>Spec Hash:</strong></div>
          <div style="margin-top: 0.25rem;"><code class="hash">${manifest.spec.specHash}</code></div>
        </div>
        ${manifest.spec.specPath ? `
        <div>
          <div class="meta"><strong>Spec Path:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.spec.specPath)}</code></div>
        </div>
        ` : ''}
      </div>
    </div>

    <h2>Policy Versions</h2>
    <div class="card">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div>
          <div class="meta"><strong>Policy Bundle:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.policyVersion.bundleVersion)}</code></div>
        </div>
        <div>
          <div class="meta"><strong>ShipGate:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.policyVersion.shipgateVersion)}</code></div>
        </div>
      </div>
      ${manifest.policyVersion.packs.length > 0 ? `
      <h3 style="margin-top: 1.5rem;">Rulepacks</h3>
      <table>
        <thead>
          <tr><th>ID</th><th>Version</th><th>Rules</th></tr>
        </thead>
        <tbody>
          ${manifest.policyVersion.packs.map(pack => `
          <tr>
            <td><code>${escapeHtml(pack.id)}</code></td>
            <td>${escapeHtml(pack.version)}</td>
            <td>${pack.rulesCount}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}
    </div>

    ${manifest.toolVersions ? `
    <h2>Tool Versions</h2>
    <div class="card">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        ${manifest.toolVersions.islCli ? `
        <div>
          <div class="meta"><strong>ISL CLI:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.toolVersions.islCli)}</code></div>
        </div>
        ` : ''}
        ${manifest.toolVersions.nodeVersion ? `
        <div>
          <div class="meta"><strong>Node.js:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.toolVersions.nodeVersion)}</code></div>
        </div>
        ` : ''}
        ${manifest.toolVersions.buildTool ? `
        <div>
          <div class="meta"><strong>Build Tool:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.toolVersions.buildTool)} ${manifest.toolVersions.buildToolVersion || ''}</code></div>
        </div>
        ` : ''}
        ${manifest.toolVersions.testFramework ? `
        <div>
          <div class="meta"><strong>Test Framework:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.toolVersions.testFramework)} ${manifest.toolVersions.testFrameworkVersion || ''}</code></div>
        </div>
        ` : ''}
        ${manifest.toolVersions.smtSolver ? `
        <div>
          <div class="meta"><strong>SMT Solver:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.toolVersions.smtSolver)} ${manifest.toolVersions.smtSolverVersion || ''}</code></div>
        </div>
        ` : ''}
        ${manifest.toolVersions.platform ? `
        <div>
          <div class="meta"><strong>Platform:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.toolVersions.platform)} ${manifest.toolVersions.arch || ''}</code></div>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <h2>Gate Details</h2>
    <div class="card">
      ${manifest.gateResult.violations.length > 0 ? `
      <table>
        <thead>
          <tr><th>Rule</th><th>File</th><th>Message</th><th>Tier</th></tr>
        </thead>
        <tbody>
          ${manifest.gateResult.violations.slice(0, 50).map(v => `
          <tr>
            <td><code>${escapeHtml(v.ruleId)}</code></td>
            <td>${escapeHtml(v.file)}${v.line ? `:${v.line}` : ''}</td>
            <td>${escapeHtml(v.message)}</td>
            <td>
              <span class="badge ${v.tier === 'hard_block' ? 'badge-error' : v.tier === 'soft_block' ? 'badge-warning' : 'badge-info'}">
                ${escapeHtml(v.tier)}
              </span>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ${manifest.gateResult.violations.length > 50 ? `<p class="meta" style="margin-top: 1rem;">... and ${manifest.gateResult.violations.length - 50} more violations</p>` : ''}
      ` : '<p>No violations</p>'}
    </div>

    ${manifest.verifyResults ? `
    <h2>Verification Results</h2>
    <div class="card">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 1rem;">
        <div class="stat">
          <div class="stat-value">${manifest.verifyResults.summary.totalClauses}</div>
          <div class="stat-label">Total Clauses</div>
        </div>
        <div class="stat">
          <div class="stat-value pass">${manifest.verifyResults.summary.provenClauses}</div>
          <div class="stat-label">Proven</div>
        </div>
        <div class="stat">
          <div class="stat-value warn">${manifest.verifyResults.summary.unknownClauses}</div>
          <div class="stat-label">Unknown</div>
        </div>
        <div class="stat">
          <div class="stat-value fail">${manifest.verifyResults.summary.violatedClauses}</div>
          <div class="stat-label">Violated</div>
        </div>
      </div>
      ${manifest.verifyResults.clauses.length > 0 ? `
      <h3>Clause Details</h3>
      <table>
        <thead>
          <tr><th>Clause ID</th><th>Type</th><th>Status</th><th>Reason</th></tr>
        </thead>
        <tbody>
          ${manifest.verifyResults.clauses.slice(0, 20).map(c => `
          <tr>
            <td><code>${escapeHtml(c.clauseId)}</code></td>
            <td>${escapeHtml(c.clauseType)}</td>
            <td>
              <span class="badge ${c.status === 'proven' ? 'badge-success' : c.status === 'violated' ? 'badge-error' : 'badge-warning'}">
                ${escapeHtml(c.status)}
              </span>
            </td>
            <td>${escapeHtml(c.reason || '')}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ${manifest.verifyResults.clauses.length > 20 ? `<p class="meta" style="margin-top: 1rem;">... and ${manifest.verifyResults.clauses.length - 20} more clauses</p>` : ''}
      ` : ''}
    </div>
    ` : ''}

    ${manifest.iterations.length > 0 ? `
    <h2>Healing Iterations</h2>
    <div class="card">
      <table>
        <thead>
          <tr><th>#</th><th>Violations</th><th>Patches</th><th>Score</th><th>Verdict</th><th>Duration</th></tr>
        </thead>
        <tbody>
          ${manifest.iterations.map(iter => `
          <tr>
            <td>${iter.iteration}</td>
            <td>${iter.violationCount}</td>
            <td>${iter.patches.length}</td>
            <td>${iter.score}</td>
            <td>
              <span class="badge ${iter.verdict === 'SHIP' ? 'badge-success' : 'badge-error'}">
                ${iter.verdict}
              </span>
            </td>
            <td>${iter.durationMs}ms</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${manifest.signature ? `
    <h2>Signature</h2>
    <div class="card">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div>
          <div class="meta"><strong>Algorithm:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.signature.algorithm)}</code></div>
        </div>
        ${manifest.signature.keyId ? `
        <div>
          <div class="meta"><strong>Key ID:</strong></div>
          <div style="margin-top: 0.25rem;"><code>${escapeHtml(manifest.signature.keyId)}</code></div>
        </div>
        ` : ''}
        <div>
          <div class="meta"><strong>Signature:</strong></div>
          <div style="margin-top: 0.25rem;"><code class="hash">${manifest.signature.value.slice(0, 32)}...</code></div>
        </div>
      </div>
    </div>
    ` : ''}

    <h2>Files</h2>
    <div class="card">
      <p class="meta">Total files: ${manifest.files.length}</p>
      <div style="margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.5rem;">
        ${manifest.files.map(file => `<code style="display: block; padding: 0.25rem;">${escapeHtml(file)}</code>`).join('')}
      </div>
    </div>
  </div>

  <script>
    // Add collapsible functionality if needed
    document.querySelectorAll('.collapsible').forEach(el => {
      el.addEventListener('click', () => {
        const content = el.nextElementSibling;
        if (content) {
          content.classList.toggle('expanded');
        }
      });
    });
  </script>
</body>
</html>`;
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'PROVEN':
      return '#22c55e';
    case 'INCOMPLETE_PROOF':
      return '#f59e0b';
    case 'VIOLATED':
      return '#ef4444';
    case 'UNPROVEN':
      return '#6b7280';
    default:
      return '#94a3b8';
  }
}

function getVerdictIcon(verdict: string): string {
  switch (verdict) {
    case 'PROVEN':
      return '✓';
    case 'INCOMPLETE_PROOF':
      return '⚠';
    case 'VIOLATED':
      return '✗';
    case 'UNPROVEN':
      return '?';
    default:
      return '○';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

