/**
 * Evaluation Table Generator
 * 
 * Generates evaluation tables for proof bundles showing the
 * tri-state result of each postcondition and invariant.
 * 
 * @module @isl-lang/verify-pipeline
 */

import type {
  PipelineResult,
  EvaluationTable,
  EvaluationTableRow,
  ClauseEvidence,
  InvariantEvidence,
} from '../types.js';

// ============================================================================
// Table Generation
// ============================================================================

/**
 * Generate evaluation table from pipeline result
 */
export function generateEvaluationTable(
  result: PipelineResult,
  domain: string,
  specVersion: string
): EvaluationTable {
  const rows: EvaluationTableRow[] = [];
  
  // Add postcondition rows
  for (const evidence of result.evidence.postconditions) {
    rows.push({
      clauseId: evidence.clauseId,
      type: 'postcondition',
      behavior: evidence.behavior,
      outcome: evidence.outcome,
      expression: evidence.expression,
      status: evidence.status,
      triState: evidence.triStateResult,
      reason: evidence.reason,
      sourceLocation: evidence.sourceLocation,
      traceId: evidence.traceSlice?.traceId,
    });
  }
  
  // Add invariant rows
  for (const evidence of result.evidence.invariants) {
    rows.push({
      clauseId: evidence.clauseId,
      type: 'invariant',
      scope: evidence.scope,
      behavior: evidence.behavior,
      expression: evidence.expression,
      status: evidence.status,
      triState: evidence.triStateResult,
      reason: evidence.reason,
      sourceLocation: evidence.sourceLocation,
      traceId: evidence.traceSlice?.traceId,
    });
  }
  
  // Sort rows deterministically
  rows.sort((a, b) => {
    // First by type (postconditions before invariants)
    if (a.type !== b.type) {
      return a.type === 'postcondition' ? -1 : 1;
    }
    // Then by behavior
    if (a.behavior !== b.behavior) {
      return (a.behavior || '').localeCompare(b.behavior || '');
    }
    // Then by clause ID
    return a.clauseId.localeCompare(b.clauseId);
  });
  
  // Calculate summary
  const summary = {
    total: rows.length,
    proven: rows.filter(r => r.status === 'proven').length,
    violated: rows.filter(r => r.status === 'violated').length,
    notProven: rows.filter(r => r.status === 'not_proven').length,
    skipped: rows.filter(r => r.status === 'skipped').length,
  };
  
  return {
    version: '1.0.0',
    domain,
    specVersion,
    generatedAt: new Date().toISOString(),
    runId: result.runId,
    verdict: result.verdict,
    rows,
    summary,
  };
}

// ============================================================================
// Table Formatting
// ============================================================================

/**
 * Format evaluation table as JSON
 */
export function formatTableAsJSON(table: EvaluationTable): string {
  return JSON.stringify(table, null, 2);
}

/**
 * Format evaluation table as Markdown
 */
export function formatTableAsMarkdown(table: EvaluationTable): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# Evaluation Table: ${table.domain}`);
  lines.push('');
  lines.push(`- **Version:** ${table.specVersion}`);
  lines.push(`- **Run ID:** ${table.runId}`);
  lines.push(`- **Verdict:** ${table.verdict}`);
  lines.push(`- **Generated:** ${table.generatedAt}`);
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total | ${table.summary.total} |`);
  lines.push(`| Proven | ${table.summary.proven} |`);
  lines.push(`| Violated | ${table.summary.violated} |`);
  lines.push(`| Not Proven | ${table.summary.notProven} |`);
  lines.push(`| Skipped | ${table.summary.skipped} |`);
  lines.push('');
  
  // Postconditions table
  const postconditions = table.rows.filter(r => r.type === 'postcondition');
  if (postconditions.length > 0) {
    lines.push('## Postconditions');
    lines.push('');
    lines.push('| Behavior | Outcome | Expression | Status | Result |');
    lines.push('|----------|---------|------------|--------|--------|');
    for (const row of postconditions) {
      const statusIcon = statusToIcon(row.status);
      const triState = formatTriState(row.triState);
      lines.push(`| ${row.behavior || '-'} | ${row.outcome || 'success'} | \`${truncate(row.expression, 40)}\` | ${statusIcon} ${row.status} | ${triState} |`);
    }
    lines.push('');
  }
  
  // Invariants table
  const invariants = table.rows.filter(r => r.type === 'invariant');
  if (invariants.length > 0) {
    lines.push('## Invariants');
    lines.push('');
    lines.push('| Scope | Entity/Behavior | Expression | Status | Result |');
    lines.push('|-------|-----------------|------------|--------|--------|');
    for (const row of invariants) {
      const statusIcon = statusToIcon(row.status);
      const triState = formatTriState(row.triState);
      const context = row.scope === 'entity' ? (row as EvaluationTableRow & { entity?: string }).entity || '-' : row.behavior || '-';
      lines.push(`| ${row.scope} | ${context} | \`${truncate(row.expression, 40)}\` | ${statusIcon} ${row.status} | ${triState} |`);
    }
    lines.push('');
  }
  
  // Violations details
  const violations = table.rows.filter(r => r.status === 'violated');
  if (violations.length > 0) {
    lines.push('## Violation Details');
    lines.push('');
    for (const row of violations) {
      lines.push(`### ${row.clauseId}`);
      lines.push('');
      lines.push(`- **Type:** ${row.type}`);
      if (row.behavior) lines.push(`- **Behavior:** ${row.behavior}`);
      lines.push(`- **Expression:** \`${row.expression}\``);
      if (row.reason) lines.push(`- **Reason:** ${row.reason}`);
      if (row.sourceLocation) {
        lines.push(`- **Location:** ${row.sourceLocation.file || ''}:${row.sourceLocation.line}:${row.sourceLocation.column}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Format evaluation table as HTML
 */
export function formatTableAsHTML(table: EvaluationTable): string {
  const verdictColor = {
    PROVEN: '#22c55e',
    INCOMPLETE_PROOF: '#f59e0b',
    FAILED: '#ef4444',
  }[table.verdict];
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evaluation Table - ${table.domain}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.5;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1, h2 { margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; color: #94a3b8; margin-top: 2rem; }
    .verdict {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      background: ${verdictColor}20;
      color: ${verdictColor};
      font-weight: 600;
    }
    .summary { 
      display: grid; 
      grid-template-columns: repeat(5, 1fr); 
      gap: 1rem; 
      margin: 1.5rem 0;
    }
    .summary-card {
      background: #1e293b;
      padding: 1rem;
      border-radius: 0.5rem;
      text-align: center;
    }
    .summary-value { font-size: 1.5rem; font-weight: 700; }
    .summary-label { font-size: 0.75rem; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-weight: 500; font-size: 0.875rem; }
    td { font-size: 0.875rem; }
    .proven { color: #22c55e; }
    .violated { color: #ef4444; }
    .not_proven { color: #f59e0b; }
    .skipped { color: #64748b; }
    code { background: #334155; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.8rem; }
    .icon { margin-right: 0.25rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Evaluation Table: ${table.domain}</h1>
    <p>
      <span class="verdict">${table.verdict}</span>
      <span style="margin-left: 1rem; color: #64748b;">
        Run: ${table.runId} | Generated: ${table.generatedAt}
      </span>
    </p>
    
    <div class="summary">
      <div class="summary-card">
        <div class="summary-value">${table.summary.total}</div>
        <div class="summary-label">Total</div>
      </div>
      <div class="summary-card">
        <div class="summary-value proven">${table.summary.proven}</div>
        <div class="summary-label">Proven</div>
      </div>
      <div class="summary-card">
        <div class="summary-value violated">${table.summary.violated}</div>
        <div class="summary-label">Violated</div>
      </div>
      <div class="summary-card">
        <div class="summary-value not_proven">${table.summary.notProven}</div>
        <div class="summary-label">Not Proven</div>
      </div>
      <div class="summary-card">
        <div class="summary-value skipped">${table.summary.skipped}</div>
        <div class="summary-label">Skipped</div>
      </div>
    </div>
    
    <h2>Postconditions</h2>
    <table>
      <thead>
        <tr>
          <th>Behavior</th>
          <th>Outcome</th>
          <th>Expression</th>
          <th>Status</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${table.rows.filter(r => r.type === 'postcondition').map(row => `
        <tr>
          <td>${row.behavior || '-'}</td>
          <td>${row.outcome || 'success'}</td>
          <td><code>${escapeHtml(truncate(row.expression, 50))}</code></td>
          <td class="${row.status}">${statusToIcon(row.status)} ${row.status}</td>
          <td>${formatTriState(row.triState)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>Invariants</h2>
    <table>
      <thead>
        <tr>
          <th>Scope</th>
          <th>Context</th>
          <th>Expression</th>
          <th>Status</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${table.rows.filter(r => r.type === 'invariant').map(row => `
        <tr>
          <td>${row.scope}</td>
          <td>${row.behavior || '-'}</td>
          <td><code>${escapeHtml(truncate(row.expression, 50))}</code></td>
          <td class="${row.status}">${statusToIcon(row.status)} ${row.status}</td>
          <td>${formatTriState(row.triState)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

// ============================================================================
// Utilities
// ============================================================================

function statusToIcon(status: string): string {
  switch (status) {
    case 'proven': return '✓';
    case 'violated': return '✗';
    case 'not_proven': return '?';
    case 'skipped': return '○';
    default: return '•';
  }
}

function formatTriState(triState: true | false | 'unknown'): string {
  if (triState === true) return '✓ true';
  if (triState === false) return '✗ false';
  return '? unknown';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
