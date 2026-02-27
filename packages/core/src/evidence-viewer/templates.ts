/**
 * HTML Templates for Evidence Report Viewer
 *
 * Template functions for generating HTML from evidence report data.
 */

import type {
  ThemeColors,
  EvidenceClauseResult,
  Assumption,
  OpenQuestion,
  EvidenceArtifact,
  ScoreSummary,
  BadgeType,
  RenderOptions,
} from './viewerTypes.js';

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => escapeMap[char] ?? char);
}

/**
 * Formats a date string for display
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Formats duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Generates CSS styles for the report
 */
export function generateStyles(theme: ThemeColors, prefix: string): string {
  return `
    .${prefix}-report {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: ${theme.text};
      background: ${theme.background};
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .${prefix}-header {
      border-bottom: 2px solid ${theme.border};
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .${prefix}-title {
      font-size: 1.75rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
    }
    .${prefix}-subtitle {
      color: ${theme.textSecondary};
      font-size: 0.875rem;
      margin: 0;
    }
    .${prefix}-score-card {
      background: ${theme.surface};
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      align-items: center;
    }
    .${prefix}-score-main {
      text-align: center;
      min-width: 120px;
    }
    .${prefix}-score-value {
      font-size: 3rem;
      font-weight: 700;
      line-height: 1;
    }
    .${prefix}-score-label {
      color: ${theme.textSecondary};
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .${prefix}-score-stats {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .${prefix}-stat {
      text-align: center;
      min-width: 80px;
    }
    .${prefix}-stat-value {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .${prefix}-stat-label {
      color: ${theme.textSecondary};
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .${prefix}-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    .${prefix}-badge-pass { background: ${theme.passBg}; color: ${theme.pass}; }
    .${prefix}-badge-partial { background: ${theme.partialBg}; color: ${theme.partial}; }
    .${prefix}-badge-fail { background: ${theme.failBg}; color: ${theme.fail}; }
    .${prefix}-badge-ship { background: ${theme.passBg}; color: ${theme.ship}; }
    .${prefix}-badge-review { background: ${theme.partialBg}; color: ${theme.review}; }
    .${prefix}-badge-block { background: ${theme.failBg}; color: ${theme.block}; }
    .${prefix}-badge-info { background: ${theme.code}; color: ${theme.textSecondary}; }
    .${prefix}-badge-warning { background: ${theme.partialBg}; color: ${theme.partial}; }
    .${prefix}-section {
      margin-bottom: 2rem;
    }
    .${prefix}-section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid ${theme.border};
    }
    .${prefix}-section-count {
      color: ${theme.textSecondary};
      font-weight: 400;
      font-size: 1rem;
    }
    .${prefix}-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .${prefix}-item {
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }
    .${prefix}-item-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .${prefix}-item-id {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      font-size: 0.875rem;
      color: ${theme.link};
      font-weight: 500;
    }
    .${prefix}-item-message {
      color: ${theme.textSecondary};
      font-size: 0.875rem;
      margin: 0;
    }
    .${prefix}-item-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: ${theme.textSecondary};
    }
    .${prefix}-code {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      background: ${theme.code};
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.8125rem;
    }
    .${prefix}-link {
      color: ${theme.link};
      text-decoration: none;
    }
    .${prefix}-link:hover {
      text-decoration: underline;
    }
    .${prefix}-empty {
      color: ${theme.textSecondary};
      font-style: italic;
      padding: 1rem;
      text-align: center;
      background: ${theme.surface};
      border-radius: 6px;
    }
    .${prefix}-artifact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .${prefix}-artifact {
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 6px;
      padding: 1rem;
    }
    .${prefix}-artifact-name {
      font-weight: 500;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }
    .${prefix}-artifact-meta {
      font-size: 0.75rem;
      color: ${theme.textSecondary};
    }
    .${prefix}-footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid ${theme.border};
      color: ${theme.textSecondary};
      font-size: 0.75rem;
      text-align: center;
    }
    .${prefix}-collapsible {
      cursor: pointer;
    }
    .${prefix}-collapsible:hover {
      background: ${theme.code};
    }
    .${prefix}-progress-bar {
      height: 8px;
      background: ${theme.border};
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .${prefix}-progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }
    .${prefix}-assumption-impact {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 0.5rem;
    }
    .${prefix}-impact-low { background: ${theme.pass}; }
    .${prefix}-impact-medium { background: ${theme.partial}; }
    .${prefix}-impact-high { background: ${theme.fail}; }
    .${prefix}-impact-critical { background: ${theme.block}; }
    @media (max-width: 768px) {
      .${prefix}-report { padding: 1rem; }
      .${prefix}-score-card { flex-direction: column; gap: 1rem; }
      .${prefix}-artifact-grid { grid-template-columns: 1fr; }
    }
  `;
}

/**
 * Renders a badge element
 */
export function renderBadge(type: BadgeType, text: string, prefix: string): string {
  return `<span class="${prefix}-badge ${prefix}-badge-${type}">${escapeHtml(text)}</span>`;
}

/**
 * Renders the score card section
 */
export function renderScoreCard(
  summary: ScoreSummary,
  prefix: string,
  theme: ThemeColors
): string {
  const scoreColor =
    summary.recommendation === 'ship'
      ? theme.ship
      : summary.recommendation === 'review'
        ? theme.review
        : theme.block;

  const recommendationBadge = renderBadge(
    summary.recommendation as BadgeType,
    summary.recommendation.toUpperCase(),
    prefix
  );

  const confidenceBadge = renderBadge(
    'info',
    `${summary.confidence} confidence`,
    prefix
  );

  const passWidth = summary.totalClauses > 0 
    ? (summary.passCount / summary.totalClauses) * 100 
    : 0;
  const partialWidth = summary.totalClauses > 0 
    ? (summary.partialCount / summary.totalClauses) * 100 
    : 0;

  return `
    <div class="${prefix}-score-card">
      <div class="${prefix}-score-main">
        <div class="${prefix}-score-value" style="color: ${scoreColor}">${summary.overallScore}</div>
        <div class="${prefix}-score-label">Score</div>
      </div>
      <div class="${prefix}-score-stats">
        <div class="${prefix}-stat">
          <div class="${prefix}-stat-value" style="color: ${theme.pass}">${summary.passCount}</div>
          <div class="${prefix}-stat-label">Passed</div>
        </div>
        <div class="${prefix}-stat">
          <div class="${prefix}-stat-value" style="color: ${theme.partial}">${summary.partialCount}</div>
          <div class="${prefix}-stat-label">Partial</div>
        </div>
        <div class="${prefix}-stat">
          <div class="${prefix}-stat-value" style="color: ${theme.fail}">${summary.failCount}</div>
          <div class="${prefix}-stat-label">Failed</div>
        </div>
        <div class="${prefix}-stat">
          <div class="${prefix}-stat-value">${summary.passRate.toFixed(1)}%</div>
          <div class="${prefix}-stat-label">Pass Rate</div>
        </div>
      </div>
      <div>
        ${recommendationBadge}
        ${confidenceBadge}
      </div>
    </div>
    <div class="${prefix}-progress-bar">
      <div class="${prefix}-progress-fill" style="width: ${passWidth}%; background: ${theme.pass}; display: inline-block;"></div><div class="${prefix}-progress-fill" style="width: ${partialWidth}%; background: ${theme.partial}; display: inline-block;"></div>
    </div>
  `;
}

/**
 * Renders a single clause result item
 */
export function renderClauseItem(
  clause: EvidenceClauseResult,
  prefix: string
): string {
  const stateBadge = renderBadge(
    clause.state.toLowerCase() as BadgeType,
    clause.state,
    prefix
  );

  const typeLabel = clause.clauseType
    ? `<span class="${prefix}-code">${escapeHtml(clause.clauseType)}</span>`
    : '';

  const message = clause.message
    ? `<p class="${prefix}-item-message">${escapeHtml(clause.message)}</p>`
    : '';

  const trace = clause.trace
    ? `<div class="${prefix}-item-meta"><strong>Trace:</strong> <code class="${prefix}-code">${escapeHtml(clause.trace)}</code></div>`
    : '';

  const values = [];
  if (clause.expectedValue !== undefined) {
    values.push(`Expected: <code class="${prefix}-code">${escapeHtml(String(clause.expectedValue))}</code>`);
  }
  if (clause.actualValue !== undefined) {
    values.push(`Actual: <code class="${prefix}-code">${escapeHtml(String(clause.actualValue))}</code>`);
  }
  const valuesHtml = values.length > 0
    ? `<div class="${prefix}-item-meta">${values.join(' | ')}</div>`
    : '';

  const timing = clause.evaluationTimeMs !== undefined
    ? `<span>${formatDuration(clause.evaluationTimeMs)}</span>`
    : '';

  return `
    <li class="${prefix}-item">
      <div class="${prefix}-item-header">
        ${stateBadge}
        <span class="${prefix}-item-id">${escapeHtml(clause.clauseId)}</span>
        ${typeLabel}
      </div>
      ${message}
      ${valuesHtml}
      ${trace}
      ${timing ? `<div class="${prefix}-item-meta">${timing}</div>` : ''}
    </li>
  `;
}

/**
 * Renders a list of clause results
 */
export function renderClauseList(
  clauses: EvidenceClauseResult[],
  title: string,
  state: string,
  prefix: string
): string {
  if (clauses.length === 0) {
    return `
      <div class="${prefix}-section">
        <h3 class="${prefix}-section-title">${escapeHtml(title)} <span class="${prefix}-section-count">(0)</span></h3>
        <div class="${prefix}-empty">No ${state.toLowerCase()} clauses</div>
      </div>
    `;
  }

  const items = clauses.map((c) => renderClauseItem(c, prefix)).join('');

  return `
    <div class="${prefix}-section">
      <h3 class="${prefix}-section-title">${escapeHtml(title)} <span class="${prefix}-section-count">(${clauses.length})</span></h3>
      <ul class="${prefix}-list">
        ${items}
      </ul>
    </div>
  `;
}

/**
 * Renders a single assumption item
 */
export function renderAssumptionItem(
  assumption: Assumption,
  prefix: string
): string {
  const impactClass = `${prefix}-impact-${assumption.impact}`;
  const categoryBadge = renderBadge('info', assumption.category, prefix);
  
  const relatedClauses = assumption.relatedClauses?.length
    ? `<div class="${prefix}-item-meta">Related: ${assumption.relatedClauses.map(c => `<code class="${prefix}-code">${escapeHtml(c)}</code>`).join(', ')}</div>`
    : '';

  return `
    <li class="${prefix}-item">
      <div class="${prefix}-item-header">
        <span class="${prefix}-assumption-impact ${impactClass}" title="${assumption.impact} impact"></span>
        <span class="${prefix}-item-id">${escapeHtml(assumption.id)}</span>
        ${categoryBadge}
      </div>
      <p class="${prefix}-item-message">${escapeHtml(assumption.description)}</p>
      ${relatedClauses}
    </li>
  `;
}

/**
 * Renders the assumptions section
 */
export function renderAssumptions(
  assumptions: Assumption[],
  prefix: string
): string {
  if (assumptions.length === 0) {
    return `
      <div class="${prefix}-section">
        <h3 class="${prefix}-section-title">Assumptions <span class="${prefix}-section-count">(0)</span></h3>
        <div class="${prefix}-empty">No assumptions recorded</div>
      </div>
    `;
  }

  const items = assumptions.map((a) => renderAssumptionItem(a, prefix)).join('');

  return `
    <div class="${prefix}-section">
      <h3 class="${prefix}-section-title">Assumptions <span class="${prefix}-section-count">(${assumptions.length})</span></h3>
      <ul class="${prefix}-list">
        ${items}
      </ul>
    </div>
  `;
}

/**
 * Renders a single open question item
 */
export function renderQuestionItem(
  question: OpenQuestion,
  prefix: string
): string {
  const priorityBadge = renderBadge(
    question.priority === 'high' ? 'warning' : 'info',
    question.priority,
    prefix
  );

  const context = question.context
    ? `<p class="${prefix}-item-message">${escapeHtml(question.context)}</p>`
    : '';

  const actions = question.suggestedActions?.length
    ? `<div class="${prefix}-item-meta"><strong>Suggested:</strong> ${question.suggestedActions.map(a => escapeHtml(a)).join('; ')}</div>`
    : '';

  const relatedClauses = question.relatedClauses?.length
    ? `<div class="${prefix}-item-meta">Related: ${question.relatedClauses.map(c => `<code class="${prefix}-code">${escapeHtml(c)}</code>`).join(', ')}</div>`
    : '';

  return `
    <li class="${prefix}-item">
      <div class="${prefix}-item-header">
        ${priorityBadge}
        <span class="${prefix}-item-id">${escapeHtml(question.id)}</span>
      </div>
      <p style="margin: 0.5rem 0; font-weight: 500;">${escapeHtml(question.question)}</p>
      ${context}
      ${actions}
      ${relatedClauses}
    </li>
  `;
}

/**
 * Renders the open questions section
 */
export function renderOpenQuestions(
  questions: OpenQuestion[],
  prefix: string
): string {
  if (questions.length === 0) {
    return `
      <div class="${prefix}-section">
        <h3 class="${prefix}-section-title">Open Questions <span class="${prefix}-section-count">(0)</span></h3>
        <div class="${prefix}-empty">No open questions</div>
      </div>
    `;
  }

  const items = questions.map((q) => renderQuestionItem(q, prefix)).join('');

  return `
    <div class="${prefix}-section">
      <h3 class="${prefix}-section-title">Open Questions <span class="${prefix}-section-count">(${questions.length})</span></h3>
      <ul class="${prefix}-list">
        ${items}
      </ul>
    </div>
  `;
}

/**
 * Renders a single artifact item
 */
export function renderArtifactItem(
  artifact: EvidenceArtifact,
  prefix: string,
  basePath: string
): string {
  const typeBadge = renderBadge('info', artifact.type, prefix);
  
  const location = artifact.location
    ? `<div class="${prefix}-artifact-meta">
        <strong>Location:</strong> 
        <a href="${escapeHtml(basePath + '/' + artifact.location)}" class="${prefix}-link">${escapeHtml(artifact.location)}</a>
      </div>`
    : '';

  const size = artifact.size !== undefined
    ? `<span>${formatFileSize(artifact.size)}</span>`
    : '';

  const mimeType = artifact.mimeType
    ? `<span>${escapeHtml(artifact.mimeType)}</span>`
    : '';

  const created = `<span>${formatDate(artifact.createdAt)}</span>`;

  return `
    <div class="${prefix}-artifact">
      <div class="${prefix}-artifact-name">
        ${typeBadge}
        ${escapeHtml(artifact.name)}
      </div>
      ${location}
      <div class="${prefix}-artifact-meta">
        ${[mimeType, size, created].filter(Boolean).join(' • ')}
      </div>
    </div>
  `;
}

/**
 * Formats file size in bytes to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders the artifacts section
 */
export function renderArtifacts(
  artifacts: EvidenceArtifact[],
  prefix: string,
  basePath: string
): string {
  if (artifacts.length === 0) {
    return `
      <div class="${prefix}-section">
        <h3 class="${prefix}-section-title">Artifacts <span class="${prefix}-section-count">(0)</span></h3>
        <div class="${prefix}-empty">No artifacts collected</div>
      </div>
    `;
  }

  const items = artifacts.map((a) => renderArtifactItem(a, prefix, basePath)).join('');

  return `
    <div class="${prefix}-section">
      <h3 class="${prefix}-section-title">Artifacts <span class="${prefix}-section-count">(${artifacts.length})</span></h3>
      <div class="${prefix}-artifact-grid">
        ${items}
      </div>
    </div>
  `;
}

/**
 * Renders the report header
 */
export function renderHeader(
  title: string,
  specPath: string | undefined,
  specFingerprint: string,
  metadata: { startedAt: string; completedAt: string; durationMs: number; agentVersion: string },
  showTimestamp: boolean,
  prefix: string
): string {
  const pathInfo = specPath
    ? `<p class="${prefix}-subtitle">Spec: <code class="${prefix}-code">${escapeHtml(specPath)}</code></p>`
    : '';

  const timestamp = showTimestamp
    ? `<p class="${prefix}-subtitle">Generated: ${formatDate(metadata.completedAt)} (took ${formatDuration(metadata.durationMs)})</p>`
    : '';

  return `
    <header class="${prefix}-header">
      <h1 class="${prefix}-title">${escapeHtml(title)}</h1>
      ${pathInfo}
      <p class="${prefix}-subtitle">Fingerprint: <code class="${prefix}-code">${escapeHtml(specFingerprint.substring(0, 16))}...</code></p>
      ${timestamp}
      <p class="${prefix}-subtitle">Agent: v${escapeHtml(metadata.agentVersion)}</p>
    </header>
  `;
}

/**
 * Renders the report footer
 */
export function renderFooter(footerText: string | undefined, prefix: string): string {
  const text = footerText ?? 'Generated by ISL Evidence Viewer';
  return `
    <footer class="${prefix}-footer">
      ${escapeHtml(text)}
    </footer>
  `;
}

/**
 * Wraps content in a full HTML document
 */
export function wrapInDocument(
  content: string,
  styles: string,
  title: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}
