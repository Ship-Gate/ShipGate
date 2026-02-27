/**
 * Status Panel Component
 * 
 * Displays verification score, clause status breakdown,
 * and operation progress/logs.
 */

import type { StudioState, StudioScore, SpecClause } from '../studioState';
import { getStatusColorClass } from '../studioState';

/**
 * Build the status panel HTML
 */
export function buildStatusPanel(state: StudioState): string {
  const { status, statusMessage, score, spec, logs, error } = state;
  const statusClass = getStatusColorClass(status);
  
  return `
    <div class="status-panel ${statusClass}">
      ${buildStatusHeader(status, statusMessage)}
      ${error ? buildErrorDisplay(error) : ''}
      ${score ? buildScoreDisplay(score) : ''}
      ${spec ? buildClauseBreakdown(spec.clauses) : ''}
      ${buildActivityLog(logs, status)}
    </div>
  `;
}

/**
 * Build status header
 */
function buildStatusHeader(status: StudioState['status'], message: string): string {
  const icon = getStatusIcon(status);
  const statusLabel = formatStatus(status);
  
  return `
    <div class="status-header">
      <div class="status-indicator">
        ${icon}
        <span class="status-label">${statusLabel}</span>
      </div>
      <span class="status-message">${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * Get status icon SVG
 */
function getStatusIcon(status: StudioState['status']): string {
  switch (status) {
    case 'idle':
      return `<svg class="status-icon idle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
      </svg>`;
    case 'generating':
    case 'building':
    case 'auditing':
      return `<svg class="status-icon progress" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>`;
    case 'success':
      return `<svg class="status-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`;
    case 'error':
      return `<svg class="status-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>`;
    default:
      return '';
  }
}

/**
 * Format status for display
 */
function formatStatus(status: StudioState['status']): string {
  const labels: Record<StudioState['status'], string> = {
    idle: 'Ready',
    generating: 'Generating...',
    building: 'Building...',
    auditing: 'Auditing...',
    success: 'Complete',
    error: 'Error'
  };
  return labels[status];
}

/**
 * Build error display
 */
function buildErrorDisplay(error: string): string {
  return `
    <div class="error-display">
      <div class="error-header">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Error</span>
      </div>
      <div class="error-message">${escapeHtml(error)}</div>
    </div>
  `;
}

/**
 * Build score display
 */
function buildScoreDisplay(score: StudioScore): string {
  const scoreClass = getScoreClass(score.overall);
  
  return `
    <div class="score-display">
      <div class="score-main">
        <div class="score-circle ${scoreClass}">
          <span class="score-value">${score.overall}</span>
          <span class="score-percent">%</span>
        </div>
        <div class="score-label">Trust Score</div>
      </div>
      
      <div class="score-breakdown">
        <div class="breakdown-item passed">
          <span class="breakdown-value">${score.passed}</span>
          <span class="breakdown-label">Passed</span>
        </div>
        <div class="breakdown-item failed">
          <span class="breakdown-value">${score.failed}</span>
          <span class="breakdown-label">Failed</span>
        </div>
        <div class="breakdown-item pending">
          <span class="breakdown-value">${score.pending}</span>
          <span class="breakdown-label">Pending</span>
        </div>
        <div class="breakdown-item total">
          <span class="breakdown-value">${score.total}</span>
          <span class="breakdown-label">Total</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get score class based on value
 */
function getScoreClass(score: number): string {
  if (score >= 80) return 'score-high';
  if (score >= 50) return 'score-medium';
  return 'score-low';
}

/**
 * Build clause breakdown
 */
function buildClauseBreakdown(clauses: SpecClause[]): string {
  if (clauses.length === 0) {
    return '';
  }
  
  const byType = countByType(clauses);
  const byStatus = countByStatus(clauses);
  
  return `
    <div class="clause-breakdown">
      <h4 class="breakdown-title">Clause Breakdown</h4>
      
      <div class="breakdown-grid">
        <div class="breakdown-section">
          <h5>By Type</h5>
          <div class="breakdown-bars">
            ${Object.entries(byType).map(([type, count]) => `
              <div class="breakdown-bar">
                <span class="bar-label">${formatTypeLabel(type)}</span>
                <div class="bar-track">
                  <div class="bar-fill type-${type}" style="width: ${(count / clauses.length) * 100}%"></div>
                </div>
                <span class="bar-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="breakdown-section">
          <h5>By Status</h5>
          <div class="status-badges">
            ${byStatus.verified > 0 ? `<span class="status-badge verified">${byStatus.verified} verified</span>` : ''}
            ${byStatus.pending > 0 ? `<span class="status-badge pending">${byStatus.pending} pending</span>` : ''}
            ${byStatus.failed > 0 ? `<span class="status-badge failed">${byStatus.failed} failed</span>` : ''}
            ${byStatus.skipped > 0 ? `<span class="status-badge skipped">${byStatus.skipped} skipped</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Count clauses by type
 */
function countByType(clauses: SpecClause[]): Record<string, number> {
  return clauses.reduce((acc, clause) => {
    acc[clause.type] = (acc[clause.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Count clauses by status
 */
function countByStatus(clauses: SpecClause[]): Record<string, number> {
  return clauses.reduce((acc, clause) => {
    acc[clause.status] = (acc[clause.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Format type label
 */
function formatTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    precondition: 'Pre',
    postcondition: 'Post',
    invariant: 'Inv',
    effect: 'Eff',
    constraint: 'Con'
  };
  return labels[type] || type;
}

/**
 * Build activity log
 */
function buildActivityLog(logs: string[], status: StudioState['status']): string {
  const isActive = ['generating', 'building', 'auditing'].includes(status);
  
  return `
    <div class="activity-log ${isActive ? 'active' : ''}">
      <div class="log-header">
        <h4 class="log-title">Activity Log</h4>
        ${isActive ? '<span class="log-live">LIVE</span>' : ''}
      </div>
      <div class="log-content" id="activity-log">
        ${logs.length > 0 
          ? logs.map(log => `<div class="log-entry">${escapeHtml(log)}</div>`).join('')
          : '<div class="log-empty">No activity yet</div>'
        }
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => escapeMap[char]);
}
