/**
 * Assumptions List Component
 * 
 * Displays assumptions made during verification.
 */

import type { Assumption } from '../evidenceViewState';

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
 * Get confidence badge class
 */
function getConfidenceClass(confidence?: 'high' | 'medium' | 'low'): string {
  return confidence ? `confidence-${confidence}` : '';
}

/**
 * Build assumption icon SVG
 */
function buildAssumptionIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z"/>
    </svg>
  `;
}

/**
 * Build a single assumption item
 */
function buildAssumptionItem(assumption: Assumption): string {
  const confidenceClass = getConfidenceClass(assumption.confidence);

  return `
    <div class="list-item">
      <div class="list-icon">${buildAssumptionIcon()}</div>
      <div class="list-content">
        <div class="list-text">${escapeHtml(assumption.text)}</div>
        <div class="list-meta">
          ${assumption.confidence ? `
            <span class="confidence-badge ${confidenceClass}">${assumption.confidence}</span>
          ` : ''}
          ${assumption.source ? `<span>Source: ${escapeHtml(assumption.source)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Build the assumptions list HTML
 */
export function buildAssumptionsList(assumptions: ReadonlyArray<Assumption>): string {
  if (assumptions.length === 0) {
    return `
      <div class="section">
        <div class="section-header">
          <span class="section-title">Assumptions</span>
          <span class="section-count">0</span>
        </div>
        <div class="section-content">
          <div class="section-empty">No assumptions identified</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Assumptions</span>
        <span class="section-count">${assumptions.length}</span>
      </div>
      <div class="section-content">
        ${assumptions.map(buildAssumptionItem).join('')}
      </div>
    </div>
  `;
}
