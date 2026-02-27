/**
 * Open Questions List Component
 * 
 * Displays open questions identified during verification.
 */

import type { OpenQuestion } from '../evidenceViewState';

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
 * Get priority badge class
 */
function getPriorityClass(priority?: 'critical' | 'high' | 'medium' | 'low'): string {
  return priority ? `priority-${priority}` : '';
}

/**
 * Build question icon SVG
 */
function buildQuestionIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1.5 1.5 0 10-1 2.83V8a.75.75 0 101.5 0v-.67A3 3 0 109 5zm-.75 7a1 1 0 11-2 0 1 1 0 012 0z"/>
    </svg>
  `;
}

/**
 * Build a single question item
 */
function buildQuestionItem(question: OpenQuestion): string {
  const priorityClass = getPriorityClass(question.priority);

  return `
    <div class="list-item">
      <div class="list-icon">${buildQuestionIcon()}</div>
      <div class="list-content">
        <div class="list-text">${escapeHtml(question.text)}</div>
        <div class="list-meta">
          ${question.priority ? `
            <span class="priority-badge ${priorityClass}">${question.priority}</span>
          ` : ''}
          ${question.suggestedAction ? `
            <span>Suggested: ${escapeHtml(question.suggestedAction)}</span>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Build the open questions list HTML
 */
export function buildOpenQuestionsList(questions: ReadonlyArray<OpenQuestion>): string {
  if (questions.length === 0) {
    return `
      <div class="section">
        <div class="section-header">
          <span class="section-title">Open Questions</span>
          <span class="section-count">0</span>
        </div>
        <div class="section-content">
          <div class="section-empty">No open questions</div>
        </div>
      </div>
    `;
  }

  // Sort by priority: critical first
  const sortedQuestions = [...questions].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const aOrder = a.priority ? order[a.priority] : 4;
    const bOrder = b.priority ? order[b.priority] : 4;
    return aOrder - bOrder;
  });

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Open Questions</span>
        <span class="section-count">${questions.length}</span>
      </div>
      <div class="section-content">
        ${sortedQuestions.map(buildQuestionItem).join('')}
      </div>
    </div>
  `;
}
