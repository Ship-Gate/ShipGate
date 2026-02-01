/**
 * Results List Component
 * 
 * Displays the list of PASS/PARTIAL/FAIL verification results.
 */

import type { VerificationResult, VerificationStatus } from '../evidenceViewState';

/**
 * Get status icon
 */
function getStatusIcon(status: VerificationStatus): string {
  switch (status) {
    case 'PASS':
      return '✓';
    case 'PARTIAL':
      return '~';
    case 'FAIL':
      return '✗';
  }
}

/**
 * Format duration in ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build a single result item
 */
function buildResultItem(result: VerificationResult): string {
  const statusClass = result.status.toLowerCase();
  const icon = getStatusIcon(result.status);

  return `
    <div class="result-item" data-result-id="${escapeHtml(result.id)}">
      <div class="result-status ${statusClass}">${icon}</div>
      <div class="result-content">
        <div class="result-name">${escapeHtml(result.name)}</div>
        ${result.message ? `<div class="result-message">${escapeHtml(result.message)}</div>` : ''}
        <div class="result-meta">
          ${result.category ? `<span class="result-category">${escapeHtml(result.category)}</span>` : ''}
          ${result.duration !== undefined ? `<span class="result-duration">${formatDuration(result.duration)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Build the results list HTML
 */
export function buildResultsList(results: ReadonlyArray<VerificationResult>): string {
  if (results.length === 0) {
    return `
      <div class="section">
        <div class="section-header">
          <span class="section-title">Verification Results</span>
          <span class="section-count">0</span>
        </div>
        <div class="section-content">
          <div class="section-empty">No verification results available</div>
        </div>
      </div>
    `;
  }

  // Sort results: FAIL first, then PARTIAL, then PASS
  const sortedResults = [...results].sort((a, b) => {
    const order: Record<VerificationStatus, number> = { FAIL: 0, PARTIAL: 1, PASS: 2 };
    return order[a.status] - order[b.status];
  });

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Verification Results</span>
        <span class="section-count">${results.length}</span>
      </div>
      <div class="section-content">
        ${sortedResults.map(buildResultItem).join('')}
      </div>
    </div>
  `;
}
