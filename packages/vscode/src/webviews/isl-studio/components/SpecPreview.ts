/**
 * Spec Preview Component
 * 
 * Displays the generated ISL specification with syntax highlighting
 * and clause breakdown.
 */

import type { GeneratedSpec, SpecClause, StudioAssumption, StudioOpenQuestion } from '../studioState';
import { getClauseTypeLabel } from '../studioState';

/**
 * Build the spec preview panel HTML
 */
export function buildSpecPreview(spec: GeneratedSpec | null): string {
  if (!spec) {
    return buildEmptyPreview();
  }
  
  return `
    <div class="spec-preview">
      <div class="spec-header">
        <h2 class="spec-title">
          <svg class="spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Generated Specification
        </h2>
        <div class="spec-actions">
          <button class="icon-button" data-action="copySpec" title="Copy to clipboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="icon-button" data-action="saveSpec" title="Save to file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="spec-content">
        <div class="spec-tabs">
          <button class="spec-tab active" data-tab="code">Code</button>
          <button class="spec-tab" data-tab="clauses">Clauses (${spec.clauses.length})</button>
          <button class="spec-tab" data-tab="assumptions">Assumptions (${spec.assumptions.length})</button>
          ${spec.openQuestions.length > 0 ? `<button class="spec-tab alert" data-tab="questions">Questions (${spec.openQuestions.length})</button>` : ''}
        </div>
        
        <div class="spec-tab-content" id="tab-code">
          ${buildCodeView(spec.formatted)}
        </div>
        
        <div class="spec-tab-content hidden" id="tab-clauses">
          ${buildClausesList(spec.clauses)}
        </div>
        
        <div class="spec-tab-content hidden" id="tab-assumptions">
          ${buildAssumptionsList(spec.assumptions)}
        </div>
        
        ${spec.openQuestions.length > 0 ? `
          <div class="spec-tab-content hidden" id="tab-questions">
            ${buildQuestionsList(spec.openQuestions)}
          </div>
        ` : ''}
      </div>
      
      <div class="spec-footer">
        <span class="timestamp">Generated ${formatTimestamp(spec.timestamp)}</span>
      </div>
    </div>
  `;
}

/**
 * Build empty preview state
 */
function buildEmptyPreview(): string {
  return `
    <div class="spec-preview empty">
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <h3 class="empty-title">No Specification Yet</h3>
        <p class="empty-text">Enter a prompt above and click "Generate Spec" to create an ISL specification from your natural language description.</p>
      </div>
    </div>
  `;
}

/**
 * Build code view with syntax highlighting placeholders
 */
function buildCodeView(code: string): string {
  const escapedCode = escapeHtml(code);
  const highlightedCode = applySyntaxHighlighting(escapedCode);
  
  return `
    <div class="code-view">
      <pre class="code-block"><code class="language-isl">${highlightedCode}</code></pre>
    </div>
  `;
}

/**
 * Apply basic ISL syntax highlighting
 */
function applySyntaxHighlighting(code: string): string {
  // Keywords
  code = code.replace(
    /\b(contract|endpoint|type|enum|requires|ensures|invariant|effect|raises|returns|with|import|from|version)\b/g,
    '<span class="keyword">$1</span>'
  );
  
  // Types
  code = code.replace(
    /\b(String|Number|Boolean|Int|Float|Date|DateTime|UUID|Email|URL|JSON|Array|Map|Optional|void)\b/g,
    '<span class="type">$1</span>'
  );
  
  // HTTP methods
  code = code.replace(
    /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
    '<span class="method">$1</span>'
  );
  
  // Strings
  code = code.replace(
    /(["'])(?:(?=(\\?))\2.)*?\1/g,
    '<span class="string">$&</span>'
  );
  
  // Comments
  code = code.replace(
    /(\/\/.*$)/gm,
    '<span class="comment">$1</span>'
  );
  code = code.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="comment">$1</span>'
  );
  
  // Numbers
  code = code.replace(
    /\b(\d+(?:\.\d+)?)\b/g,
    '<span class="number">$1</span>'
  );
  
  return code;
}

/**
 * Build clauses list
 */
function buildClausesList(clauses: SpecClause[]): string {
  if (clauses.length === 0) {
    return '<div class="empty-list">No clauses extracted</div>';
  }
  
  const grouped = groupClausesByType(clauses);
  
  return `
    <div class="clauses-list">
      ${Object.entries(grouped).map(([type, items]) => `
        <div class="clause-group">
          <h4 class="clause-group-title">${formatClauseType(type as SpecClause['type'])} (${items.length})</h4>
          ${items.map(clause => buildClauseItem(clause)).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Build single clause item
 */
function buildClauseItem(clause: SpecClause): string {
  const statusClass = `clause-status-${clause.status}`;
  const typeLabel = getClauseTypeLabel(clause.type);
  
  return `
    <div class="clause-item ${statusClass}">
      <span class="clause-badge ${clause.type}">${typeLabel}</span>
      <span class="clause-description">${escapeHtml(clause.description)}</span>
      <span class="clause-status">${clause.status}</span>
    </div>
  `;
}

/**
 * Group clauses by type
 */
function groupClausesByType(clauses: SpecClause[]): Record<string, SpecClause[]> {
  return clauses.reduce((acc, clause) => {
    if (!acc[clause.type]) {
      acc[clause.type] = [];
    }
    acc[clause.type].push(clause);
    return acc;
  }, {} as Record<string, SpecClause[]>);
}

/**
 * Format clause type for display
 */
function formatClauseType(type: SpecClause['type']): string {
  const labels: Record<SpecClause['type'], string> = {
    precondition: 'Preconditions',
    postcondition: 'Postconditions',
    invariant: 'Invariants',
    effect: 'Effects',
    constraint: 'Constraints'
  };
  return labels[type];
}

/**
 * Build assumptions list
 */
function buildAssumptionsList(assumptions: StudioAssumption[]): string {
  if (assumptions.length === 0) {
    return '<div class="empty-list">No assumptions made</div>';
  }
  
  return `
    <div class="assumptions-list">
      ${assumptions.map(assumption => `
        <div class="assumption-item">
          <div class="assumption-header">
            <span class="assumption-topic">${escapeHtml(assumption.topic)}</span>
            <span class="confidence-badge confidence-${assumption.confidence}">${assumption.confidence}</span>
          </div>
          <div class="assumption-value">${escapeHtml(assumption.assumed)}</div>
          <div class="assumption-rationale">${escapeHtml(assumption.rationale)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Build open questions list
 */
function buildQuestionsList(questions: StudioOpenQuestion[]): string {
  return `
    <div class="questions-list">
      ${questions.map(question => `
        <div class="question-item ${question.answered ? 'answered' : ''}">
          <div class="question-header">
            <span class="priority-badge priority-${question.priority}">${question.priority}</span>
            ${question.answered ? '<span class="answered-badge">Answered</span>' : ''}
          </div>
          <div class="question-text">${escapeHtml(question.question)}</div>
          ${question.options ? `
            <div class="question-options">
              ${question.options.map(opt => `
                <button 
                  class="option-button ${question.answer === opt ? 'selected' : ''}"
                  data-question-id="${question.id}"
                  data-answer="${escapeHtml(opt)}"
                >
                  ${escapeHtml(opt)}
                </button>
              `).join('')}
            </div>
          ` : `
            <input 
              type="text" 
              class="question-input" 
              data-question-id="${question.id}"
              placeholder="Enter your answer..."
              value="${question.answer ? escapeHtml(question.answer) : ''}"
            />
          `}
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
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
