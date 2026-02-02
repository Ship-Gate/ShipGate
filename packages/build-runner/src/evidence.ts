// ============================================================================
// Evidence Generator - JSON and HTML Report Generation
// ============================================================================

import type { BuildEvidence, BehaviorEvidence, CheckEvidence } from './types.js';

/**
 * Generate evidence JSON content (deterministic)
 */
export function generateEvidenceJson(evidence: BuildEvidence): string {
  // Create a stable JSON output with sorted keys
  const output = {
    version: evidence.version,
    buildId: evidence.buildId,
    spec: {
      path: evidence.specPath,
      hash: evidence.specHash,
    },
    domain: {
      name: evidence.domainName,
      version: evidence.domainVersion,
    },
    summary: {
      totalBehaviors: evidence.summary.totalBehaviors,
      passedBehaviors: evidence.summary.passedBehaviors,
      failedBehaviors: evidence.summary.failedBehaviors,
      totalChecks: evidence.summary.totalChecks,
      passedChecks: evidence.summary.passedChecks,
      failedChecks: evidence.summary.failedChecks,
      overallScore: evidence.summary.overallScore,
      verdict: evidence.summary.verdict,
    },
    behaviors: evidence.behaviors.map(serializeBehaviorEvidence),
    timing: {
      parseMs: evidence.timing.parse,
      checkMs: evidence.timing.check,
      importResolveMs: evidence.timing.importResolve,
      codegenMs: evidence.timing.codegen,
      testgenMs: evidence.timing.testgen,
      verifyMs: evidence.timing.verify,
      totalMs: evidence.timing.total,
    },
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Serialize behavior evidence with stable ordering
 */
function serializeBehaviorEvidence(behavior: BehaviorEvidence): object {
  return {
    name: behavior.name,
    success: behavior.success,
    score: behavior.score,
    verdict: behavior.verdict,
    inputUsed: behavior.inputUsed,
    executionDurationMs: behavior.executionDurationMs,
    preconditions: behavior.preconditions.map(serializeCheckEvidence),
    postconditions: behavior.postconditions.map(serializeCheckEvidence),
    invariants: behavior.invariants.map(serializeCheckEvidence),
  };
}

/**
 * Serialize check evidence with stable ordering
 */
function serializeCheckEvidence(check: CheckEvidence): object {
  const result: Record<string, unknown> = {
    expression: check.expression,
    passed: check.passed,
  };

  if (check.expected !== undefined) {
    result.expected = check.expected;
  }
  if (check.actual !== undefined) {
    result.actual = check.actual;
  }
  if (check.error !== undefined) {
    result.error = check.error;
  }

  return result;
}

/**
 * Generate HTML report content
 */
export function generateEvidenceHtml(evidence: BuildEvidence): string {
  const verdictColor = getVerdictColor(evidence.summary.verdict);
  const verdictIcon = getVerdictIcon(evidence.summary.verdict);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISL Build Report - ${escapeHtml(evidence.domainName)}</title>
  <style>
    :root {
      --color-success: #22c55e;
      --color-warning: #f59e0b;
      --color-error: #ef4444;
      --color-bg: #f8fafc;
      --color-card: #ffffff;
      --color-border: #e2e8f0;
      --color-text: #1e293b;
      --color-muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: var(--color-muted); }
    h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; }
    .card {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat {
      text-align: center;
      padding: 1rem;
      background: var(--color-bg);
      border-radius: 0.375rem;
    }
    .stat-value { font-size: 2rem; font-weight: 700; }
    .stat-label { font-size: 0.875rem; color: var(--color-muted); }
    .verdict {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
    }
    .verdict-verified { background: #dcfce7; color: #166534; }
    .verdict-risky { background: #fef3c7; color: #92400e; }
    .verdict-unsafe { background: #fee2e2; color: #991b1b; }
    .behavior {
      border-bottom: 1px solid var(--color-border);
      padding: 1rem 0;
    }
    .behavior:last-child { border-bottom: none; }
    .behavior-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .behavior-name { font-weight: 600; }
    .behavior-score { font-size: 0.875rem; color: var(--color-muted); }
    .check-list { list-style: none; margin-top: 0.5rem; }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.25rem 0;
      font-size: 0.875rem;
    }
    .check-icon { flex-shrink: 0; }
    .check-pass { color: var(--color-success); }
    .check-fail { color: var(--color-error); }
    .meta { font-size: 0.75rem; color: var(--color-muted); margin-top: 2rem; }
    .progress-bar {
      height: 0.5rem;
      background: var(--color-border);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .progress-fill {
      height: 100%;
      background: var(--color-success);
      transition: width 0.3s;
    }
    .collapsible { cursor: pointer; user-select: none; }
    .collapsible::before { content: '\\25B6'; margin-right: 0.5rem; font-size: 0.75rem; }
    .collapsible.open::before { content: '\\25BC'; }
    .collapsible-content { display: none; margin-top: 0.5rem; }
    .collapsible.open + .collapsible-content { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <header class="card">
      <h1>ISL Build Report</h1>
      <h2>${escapeHtml(evidence.domainName)} v${escapeHtml(evidence.domainVersion)}</h2>
      <div class="verdict verdict-${evidence.summary.verdict}">
        ${verdictIcon} ${evidence.summary.verdict.toUpperCase()}
      </div>
    </header>

    <section class="card">
      <h3>Summary</h3>
      <div class="summary-grid">
        <div class="stat">
          <div class="stat-value" style="color: ${verdictColor}">${evidence.summary.overallScore}</div>
          <div class="stat-label">Overall Score</div>
        </div>
        <div class="stat">
          <div class="stat-value">${evidence.summary.passedBehaviors}/${evidence.summary.totalBehaviors}</div>
          <div class="stat-label">Behaviors Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${evidence.summary.passedChecks}/${evidence.summary.totalChecks}</div>
          <div class="stat-label">Checks Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${evidence.timing.total.toFixed(0)}ms</div>
          <div class="stat-label">Total Time</div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${evidence.summary.overallScore}%"></div>
      </div>
    </section>

    <section class="card">
      <h3>Behaviors</h3>
      ${evidence.behaviors.map(renderBehavior).join('')}
    </section>

    <section class="card">
      <h3>Timing Breakdown</h3>
      <table style="width: 100%; font-size: 0.875rem;">
        <tr><td>Parse</td><td style="text-align: right;">${evidence.timing.parse.toFixed(2)}ms</td></tr>
        <tr><td>Type Check</td><td style="text-align: right;">${evidence.timing.check.toFixed(2)}ms</td></tr>
        <tr><td>Import Resolve</td><td style="text-align: right;">${evidence.timing.importResolve.toFixed(2)}ms</td></tr>
        <tr><td>Code Generation</td><td style="text-align: right;">${evidence.timing.codegen.toFixed(2)}ms</td></tr>
        <tr><td>Test Generation</td><td style="text-align: right;">${evidence.timing.testgen.toFixed(2)}ms</td></tr>
        <tr><td>Verification</td><td style="text-align: right;">${evidence.timing.verify.toFixed(2)}ms</td></tr>
        <tr style="font-weight: 600;"><td>Total</td><td style="text-align: right;">${evidence.timing.total.toFixed(2)}ms</td></tr>
      </table>
    </section>

    <footer class="meta">
      <p>Build ID: ${escapeHtml(evidence.buildId)}</p>
      <p>Spec Hash: ${escapeHtml(evidence.specHash)}</p>
      <p>Generated by ISL Build Runner v${escapeHtml(evidence.version)}</p>
    </footer>
  </div>

  <script>
    document.querySelectorAll('.collapsible').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('open'));
    });
  </script>
</body>
</html>`;
}

/**
 * Render a single behavior section
 */
function renderBehavior(behavior: BehaviorEvidence): string {
  const statusIcon = behavior.success ? '&#10003;' : '&#10007;';
  const statusClass = behavior.success ? 'check-pass' : 'check-fail';

  return `
    <div class="behavior">
      <div class="behavior-header">
        <span class="behavior-name">
          <span class="${statusClass}">${statusIcon}</span>
          ${escapeHtml(behavior.name)}
        </span>
        <span class="behavior-score">${behavior.score}/100 - ${behavior.verdict}</span>
      </div>
      <div class="collapsible">Details</div>
      <div class="collapsible-content">
        <p style="font-size: 0.875rem; color: var(--color-muted);">
          Input: ${escapeHtml(behavior.inputUsed)} | Duration: ${behavior.executionDurationMs.toFixed(2)}ms
        </p>
        ${renderCheckSection('Preconditions', behavior.preconditions)}
        ${renderCheckSection('Postconditions', behavior.postconditions)}
        ${renderCheckSection('Invariants', behavior.invariants)}
      </div>
    </div>
  `;
}

/**
 * Render a check section
 */
function renderCheckSection(title: string, checks: CheckEvidence[]): string {
  if (checks.length === 0) return '';

  const passed = checks.filter(c => c.passed).length;

  return `
    <div style="margin-top: 0.75rem;">
      <strong style="font-size: 0.75rem;">${title} (${passed}/${checks.length})</strong>
      <ul class="check-list">
        ${checks.map(renderCheck).join('')}
      </ul>
    </div>
  `;
}

/**
 * Render a single check
 */
function renderCheck(check: CheckEvidence): string {
  const icon = check.passed ? '&#10003;' : '&#10007;';
  const iconClass = check.passed ? 'check-pass' : 'check-fail';

  let details = '';
  if (!check.passed) {
    if (check.error) {
      details = `<br><small style="color: var(--color-error);">Error: ${escapeHtml(check.error)}</small>`;
    } else if (check.expected !== undefined) {
      details = `<br><small style="color: var(--color-muted);">Expected: ${escapeHtml(JSON.stringify(check.expected))}, Actual: ${escapeHtml(JSON.stringify(check.actual))}</small>`;
    }
  }

  return `
    <li class="check-item">
      <span class="check-icon ${iconClass}">${icon}</span>
      <span><code>${escapeHtml(check.expression)}</code>${details}</span>
    </li>
  `;
}

/**
 * Get color for verdict
 */
function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'verified': return '#22c55e';
    case 'risky': return '#f59e0b';
    case 'unsafe': return '#ef4444';
    default: return '#64748b';
  }
}

/**
 * Get icon for verdict
 */
function getVerdictIcon(verdict: string): string {
  switch (verdict) {
    case 'verified': return '&#10003;';
    case 'risky': return '&#9888;';
    case 'unsafe': return '&#10007;';
    default: return '?';
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
