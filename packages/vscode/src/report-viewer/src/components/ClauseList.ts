/**
 * Clause List Component
 * 
 * Displays the list of clause verification results with navigation.
 */

import type { ClauseResult, ClauseStatus, ClauseCategory } from '../types';

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
 * Get status icon content
 */
function getStatusIcon(status: ClauseStatus): string {
  switch (status) {
    case 'PASS':
      return '✓';
    case 'PARTIAL':
      return '~';
    case 'FAIL':
      return '✗';
    case 'SKIP':
      return '−';
  }
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format location for display
 */
function formatLocation(filePath: string, startLine: number): string {
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
  return `${fileName}:${startLine}`;
}

/**
 * Build navigate icon SVG
 */
function buildNavigateIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
      <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
    </svg>
  `;
}

/**
 * Build a single clause item
 */
function buildClauseItem(clause: ClauseResult, isSelected: boolean): string {
  const statusClass = clause.status.toLowerCase();
  const hasLocation = clause.location !== undefined;

  return `
    <div class="clause-item ${isSelected ? 'selected' : ''}" 
         data-clause-id="${escapeHtml(clause.id)}"
         onclick="selectClause('${escapeHtml(clause.id)}')">
      <div class="clause-status-icon ${statusClass}">${getStatusIcon(clause.status)}</div>
      
      <div class="clause-content">
        <div class="clause-name">${escapeHtml(clause.name)}</div>
        ${clause.message ? `<div class="clause-message">${escapeHtml(clause.message)}</div>` : ''}
        
        <div class="clause-meta">
          <span class="clause-category">${escapeHtml(clause.category)}</span>
          ${clause.impact ? `<span class="clause-impact ${clause.impact}">${clause.impact}</span>` : ''}
          ${clause.location ? `
            <span class="clause-location">
              ${escapeHtml(formatLocation(clause.location.filePath, clause.location.startLine))}
            </span>
          ` : ''}
          ${clause.duration !== undefined ? `
            <span class="clause-duration">${formatDuration(clause.duration)}</span>
          ` : ''}
        </div>
      </div>
      
      ${hasLocation ? `
        <button class="clause-navigate" 
                onclick="event.stopPropagation(); navigateToClause('${escapeHtml(clause.id)}')"
                title="Go to source">
          ${buildNavigateIcon()}
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Build filter controls
 */
export function buildFilters(
  statusFilter: ClauseStatus | 'ALL',
  categoryFilter: ClauseCategory | 'ALL'
): string {
  const statuses: (ClauseStatus | 'ALL')[] = ['ALL', 'PASS', 'PARTIAL', 'FAIL', 'SKIP'];
  const categories: (ClauseCategory | 'ALL')[] = [
    'ALL', 'precondition', 'postcondition', 'invariant', 'scenario', 'effect', 'state'
  ];

  return `
    <div class="filters">
      <div class="filter-group">
        <label class="filter-label">Status:</label>
        <select class="filter-select" onchange="filterByStatus(this.value)">
          ${statuses.map(status => `
            <option value="${status}" ${status === statusFilter ? 'selected' : ''}>
              ${status === 'ALL' ? 'All' : status}
            </option>
          `).join('')}
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label">Category:</label>
        <select class="filter-select" onchange="filterByCategory(this.value)">
          ${categories.map(category => `
            <option value="${category}" ${category === categoryFilter ? 'selected' : ''}>
              ${category === 'ALL' ? 'All' : formatCategoryLabel(category)}
            </option>
          `).join('')}
        </select>
      </div>
    </div>
  `;
}

/**
 * Format category label for dropdown
 */
function formatCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Build the clause list section
 */
export function buildClauseList(
  clauses: ReadonlyArray<ClauseResult>,
  selectedClauseId?: string
): string {
  if (clauses.length === 0) {
    return `
      <div class="clause-list">
        <div class="clause-list-header">
          <span class="clause-list-title">Clauses</span>
          <span class="clause-count">0</span>
        </div>
        <div class="clause-empty">No clauses match the current filters</div>
      </div>
    `;
  }

  return `
    <div class="clause-list">
      <div class="clause-list-header">
        <span class="clause-list-title">Clauses</span>
        <span class="clause-count">${clauses.length}</span>
      </div>
      <div class="clause-list-content">
        ${clauses.map(clause => buildClauseItem(clause, clause.id === selectedClauseId)).join('')}
      </div>
    </div>
  `;
}

/**
 * Build clause list with filters
 */
export function buildClauseSection(
  clauses: ReadonlyArray<ClauseResult>,
  statusFilter: ClauseStatus | 'ALL' = 'ALL',
  categoryFilter: ClauseCategory | 'ALL' = 'ALL',
  selectedClauseId?: string
): string {
  return `
    ${buildFilters(statusFilter, categoryFilter)}
    ${buildClauseList(clauses, selectedClauseId)}
  `;
}
