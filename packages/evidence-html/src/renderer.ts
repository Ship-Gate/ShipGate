/**
 * HTML Renderer for Evidence Reports
 *
 * Generates clean, readable HTML from evidence reports.
 * Output is self-contained and embeddable.
 */

import type {
  EvidenceReport,
  ClauseResult,
  Assumption,
  OpenQuestion,
  ReproCommand,
  EvidenceItem,
} from '@isl-lang/evidence-schema';
import { defaultStyles, minimalStyles } from './styles.js';

/**
 * Renderer options
 */
export interface RenderOptions {
  /** Include CSS styles in output (default: true) */
  includeStyles?: boolean;
  /** Style variant: 'default' for full styles, 'minimal' for embedded use */
  styleVariant?: 'default' | 'minimal';
  /** Generate a complete HTML document (default: false, outputs fragment) */
  fullDocument?: boolean;
  /** Document title (used when fullDocument is true) */
  title?: string;
  /** Additional CSS to include */
  customStyles?: string;
}

/**
 * Escape HTML special characters
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
 * Render the score banner (SHIP/NO_SHIP)
 */
function renderBanner(report: EvidenceReport): string {
  const isShip = report.verdict === 'SHIP';
  const bannerClass = isShip ? 'evidence-banner--ship' : 'evidence-banner--no-ship';
  const icon = isShip ? '✓' : '✗';
  const { summary } = report;

  return `
    <div class="evidence-banner ${bannerClass}">
      <div class="evidence-banner__verdict">
        <span>${icon}</span>
        <span>${report.verdict}</span>
      </div>
      <div class="evidence-banner__stats">
        <div class="evidence-banner__pass-rate">${summary.passRate}% Pass Rate</div>
        <div class="evidence-banner__details">
          ${summary.passedClauses} passed, ${summary.partialClauses} partial, ${summary.failedClauses} failed of ${summary.totalClauses} clauses
        </div>
        <div class="evidence-banner__details">
          Total duration: ${summary.totalDurationMs}ms
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a single evidence item
 */
function renderEvidenceItem(item: EvidenceItem): string {
  let html = `<div class="evidence-details">`;
  html += `<strong>${escapeHtml(item.type)}:</strong> ${escapeHtml(item.description)}`;

  if (item.location) {
    html += `
      <div class="evidence-location">
        ${escapeHtml(item.location.file)}:${item.location.line}${item.location.column ? `:${item.location.column}` : ''}
      </div>
    `;

    if (item.location.snippet) {
      html += `<pre class="evidence-snippet">${escapeHtml(item.location.snippet)}</pre>`;
    }
  }

  html += `</div>`;
  return html;
}

/**
 * Render the clause table
 */
function renderClausesTable(clauses: ClauseResult[]): string {
  if (clauses.length === 0) {
    return `<div class="evidence-empty">No clauses to display</div>`;
  }

  let rows = '';
  for (const clause of clauses) {
    const statusClass = `evidence-status--${clause.status.toLowerCase()}`;

    let evidenceHtml = '';
    if (clause.evidence.length > 0) {
      evidenceHtml = clause.evidence.map(renderEvidenceItem).join('');
    }

    rows += `
      <tr>
        <td>
          <code>${escapeHtml(clause.id)}</code>
        </td>
        <td>
          <strong>${escapeHtml(clause.name)}</strong>
          ${clause.description ? `<div style="font-size: 0.8125rem; color: var(--evidence-text-muted, #6b7280);">${escapeHtml(clause.description)}</div>` : ''}
        </td>
        <td>
          <span class="evidence-status ${statusClass}">${clause.status}</span>
        </td>
        <td>
          ${clause.durationMs !== undefined ? `${clause.durationMs}ms` : '-'}
        </td>
        <td>
          ${clause.error ? `<span style="color: var(--evidence-fail, #dc2626);">${escapeHtml(clause.error)}</span>` : '-'}
          ${evidenceHtml}
        </td>
      </tr>
    `;
  }

  return `
    <table class="evidence-clauses">
      <thead>
        <tr>
          <th>ID</th>
          <th>Clause</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Render assumptions section
 */
function renderAssumptions(assumptions: Assumption[]): string {
  if (assumptions.length === 0) {
    return `<div class="evidence-empty">No assumptions documented</div>`;
  }

  let items = '';
  for (const assumption of assumptions) {
    items += `
      <li class="evidence-list__item">
        <div class="evidence-list__item-header">
          <span class="evidence-list__item-id">${escapeHtml(assumption.id)}</span>
          <span class="evidence-risk evidence-risk--${assumption.risk}">${assumption.risk} risk</span>
        </div>
        <div>${escapeHtml(assumption.description)}</div>
        ${assumption.rationale ? `<div style="font-size: 0.8125rem; color: var(--evidence-text-muted, #6b7280); margin-top: 0.25rem;"><em>Rationale:</em> ${escapeHtml(assumption.rationale)}</div>` : ''}
      </li>
    `;
  }

  return `<ul class="evidence-list">${items}</ul>`;
}

/**
 * Render open questions section
 */
function renderOpenQuestions(questions: OpenQuestion[]): string {
  if (questions.length === 0) {
    return `<div class="evidence-empty">No open questions</div>`;
  }

  let items = '';
  for (const question of questions) {
    let actionsHtml = '';
    if (question.suggestedActions && question.suggestedActions.length > 0) {
      const actions = question.suggestedActions
        .map((a) => `<li>${escapeHtml(a)}</li>`)
        .join('');
      actionsHtml = `<div style="font-size: 0.8125rem; margin-top: 0.5rem;"><em>Suggested actions:</em><ul style="margin: 0.25rem 0 0 1rem;">${actions}</ul></div>`;
    }

    items += `
      <li class="evidence-list__item">
        <div class="evidence-list__item-header">
          <span class="evidence-list__item-id">${escapeHtml(question.id)}</span>
          <span class="evidence-risk evidence-priority--${question.priority}">${question.priority} priority</span>
        </div>
        <div><strong>${escapeHtml(question.question)}</strong></div>
        ${question.context ? `<div style="font-size: 0.8125rem; color: var(--evidence-text-muted, #6b7280); margin-top: 0.25rem;">${escapeHtml(question.context)}</div>` : ''}
        ${actionsHtml}
      </li>
    `;
  }

  return `<ul class="evidence-list">${items}</ul>`;
}

/**
 * Render reproduction commands section
 */
function renderReproCommands(commands: ReproCommand[]): string {
  if (commands.length === 0) {
    return `<div class="evidence-empty">No reproduction commands available</div>`;
  }

  let html = '';
  for (const cmd of commands) {
    let metaHtml = '';
    if (cmd.workingDirectory) {
      metaHtml += `<div>Working directory: <code>${escapeHtml(cmd.workingDirectory)}</code></div>`;
    }
    if (cmd.env && Object.keys(cmd.env).length > 0) {
      const envVars = Object.entries(cmd.env)
        .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(v)}`)
        .join(' ');
      metaHtml += `<div>Environment: <code>${envVars}</code></div>`;
    }

    html += `
      <div class="evidence-command">
        <div class="evidence-command__description">${escapeHtml(cmd.description)}</div>
        <pre class="evidence-command__code">${escapeHtml(cmd.command)}</pre>
        ${metaHtml ? `<div class="evidence-command__meta">${metaHtml}</div>` : ''}
      </div>
    `;
  }

  return html;
}

/**
 * Render metadata footer
 */
function renderMetadata(report: EvidenceReport): string {
  const { metadata } = report;

  let items = `
    <dt>Contract</dt>
    <dd>${escapeHtml(metadata.contractName)}</dd>
  `;

  if (metadata.contractFile) {
    items += `
      <dt>File</dt>
      <dd>${escapeHtml(metadata.contractFile)}</dd>
    `;
  }

  items += `
    <dt>Verifier</dt>
    <dd>v${escapeHtml(metadata.verifierVersion)}</dd>
  `;

  if (metadata.gitCommit) {
    items += `
      <dt>Commit</dt>
      <dd>${escapeHtml(metadata.gitCommit.substring(0, 8))}</dd>
    `;
  }

  if (metadata.gitBranch) {
    items += `
      <dt>Branch</dt>
      <dd>${escapeHtml(metadata.gitBranch)}</dd>
    `;
  }

  if (metadata.buildId) {
    items += `
      <dt>Build</dt>
      <dd>${escapeHtml(metadata.buildId)}</dd>
    `;
  }

  return `
    <div class="evidence-metadata">
      <dl>${items}</dl>
    </div>
  `;
}

/**
 * Render an evidence report to HTML
 *
 * @param report - The evidence report to render
 * @param options - Rendering options
 * @returns HTML string
 */
export function render(report: EvidenceReport, options: RenderOptions = {}): string {
  const {
    includeStyles = true,
    styleVariant = 'default',
    fullDocument = false,
    title = `Evidence Report: ${report.metadata.contractName}`,
    customStyles = '',
  } = options;

  const styles = styleVariant === 'minimal' ? minimalStyles : defaultStyles;

  const content = `
    <div class="evidence-report">
      ${renderBanner(report)}

      <section class="evidence-section">
        <h2 class="evidence-section__title">Clause Results</h2>
        ${renderClausesTable(report.clauses)}
      </section>

      <section class="evidence-section">
        <h2 class="evidence-section__title">Assumptions</h2>
        ${renderAssumptions(report.assumptions)}
      </section>

      <section class="evidence-section">
        <h2 class="evidence-section__title">Open Questions</h2>
        ${renderOpenQuestions(report.openQuestions)}
      </section>

      <section class="evidence-section">
        <h2 class="evidence-section__title">Reproduction Commands</h2>
        ${renderReproCommands(report.reproCommands)}
      </section>

      ${renderMetadata(report)}
    </div>
  `;

  if (fullDocument) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${includeStyles ? `<style>${styles}${customStyles}</style>` : ''}
</head>
<body>
  ${content}
</body>
</html>`;
  }

  if (includeStyles) {
    return `<style>${styles}${customStyles}</style>${content}`;
  }

  return content;
}

/**
 * Render just the clause table (for embedding)
 */
export function renderClausesOnly(clauses: ClauseResult[]): string {
  return renderClausesTable(clauses);
}

/**
 * Render just the score banner (for embedding)
 */
export function renderBannerOnly(report: EvidenceReport): string {
  return renderBanner(report);
}
