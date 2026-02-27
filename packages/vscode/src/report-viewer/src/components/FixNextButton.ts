/**
 * Fix Next Button Component
 * 
 * Displays a prominent button to navigate to the highest-impact failing clause.
 */

import type { ClauseResult } from '../types';
import { getHighestImpactFailure } from '../types';

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
 * Build the wrench/fix icon
 */
function buildFixIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 0L0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675a1 1 0 0 1 .293.708v.07a1 1 0 0 0 .419.815L9.5 11v.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V10a.5.5 0 0 0-.146-.354l-1.854-1.854a.5.5 0 0 0-.354-.146H9.5v-.5a1 1 0 0 0-.293-.707L6.207 3.707A1 1 0 0 0 5.5 3.414V3a.5.5 0 0 0-.5-.5H4a.5.5 0 0 0-.5.5v.5H2.707L1 2.293V1H0V0h1z"/>
      <path d="M12.146 8.354l-2.5 2.5a.5.5 0 0 0 0 .707l3.5 3.5a.5.5 0 0 0 .708 0l2.5-2.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/>
    </svg>
  `;
}

/**
 * Build the arrow right icon
 */
function buildArrowIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
    </svg>
  `;
}

/**
 * Format impact level for display
 */
function formatImpact(impact?: string): string {
  if (!impact) return 'Medium Impact';
  return impact.charAt(0).toUpperCase() + impact.slice(1) + ' Impact';
}

/**
 * Build the Fix Next button section
 */
export function buildFixNextButton(clauses: ReadonlyArray<ClauseResult>): string {
  const nextFailure = getHighestImpactFailure(clauses);
  const failCount = clauses.filter(c => c.status === 'FAIL').length;

  // No failures - show success state
  if (!nextFailure) {
    return `
      <div class="fix-next-container">
        <button class="fix-next-btn" disabled>
          ${buildFixIcon()}
          <span>All Clauses Passing!</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="fix-next-container">
      <button class="fix-next-btn" onclick="fixNext()">
        ${buildFixIcon()}
        <span>Fix Next (${failCount} remaining)</span>
        ${buildArrowIcon()}
      </button>
      
      <div class="fix-next-info">
        <strong>${formatImpact(nextFailure.impact)}:</strong> 
        ${escapeHtml(nextFailure.name)}
        ${nextFailure.message ? ` — ${escapeHtml(nextFailure.message)}` : ''}
      </div>
    </div>
  `;
}

/**
 * Build compact Fix Next for inline use
 */
export function buildCompactFixNext(clauses: ReadonlyArray<ClauseResult>): string {
  const nextFailure = getHighestImpactFailure(clauses);
  
  if (!nextFailure) {
    return '';
  }

  return `
    <button class="action-btn" onclick="fixNext()" title="Navigate to highest-impact failure">
      ${buildFixIcon()}
      Fix Next
    </button>
  `;
}
