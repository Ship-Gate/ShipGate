/**
 * Summary Component
 * 
 * Displays the overall score and statistics from the evidence report.
 */

import type { ReportSummary } from '../types';

/**
 * Get the score class based on value
 */
function getScoreClass(score: number): string {
  if (score >= 80) return 'pass';
  if (score >= 50) return 'partial';
  return 'fail';
}

/**
 * Build the summary card HTML
 */
export function buildSummaryCard(summary: ReportSummary): string {
  const scoreClass = getScoreClass(summary.score);

  return `
    <div class="summary-card">
      <div class="summary-score">
        <div class="score-value ${scoreClass}">${summary.score}%</div>
        <div class="score-label">Verification Score</div>
      </div>
      
      <div class="summary-stats">
        <span class="stat-badge pass">
          <span class="stat-count">${summary.passed}</span>
          <span>Passed</span>
        </span>
        ${summary.partial > 0 ? `
        <span class="stat-badge partial">
          <span class="stat-count">${summary.partial}</span>
          <span>Partial</span>
        </span>
        ` : ''}
        <span class="stat-badge fail">
          <span class="stat-count">${summary.failed}</span>
          <span>Failed</span>
        </span>
        ${summary.skipped > 0 ? `
        <span class="stat-badge skip">
          <span class="stat-count">${summary.skipped}</span>
          <span>Skipped</span>
        </span>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Build the category breakdown (optional, for expanded view)
 */
export function buildCategoryBreakdown(summary: ReportSummary): string {
  if (!summary.byCategory) return '';

  const categories = Object.entries(summary.byCategory);
  if (categories.length === 0) return '';

  return `
    <div class="category-breakdown">
      <div class="breakdown-title">By Category</div>
      <div class="breakdown-grid">
        ${categories.map(([category, stats]) => `
          <div class="breakdown-item">
            <span class="breakdown-label">${formatCategory(category)}</span>
            <span class="breakdown-value">${stats.passed}/${stats.total}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Format category name for display
 */
function formatCategory(category: string): string {
  return category
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
