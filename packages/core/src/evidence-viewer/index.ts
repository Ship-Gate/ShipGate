/**
 * Evidence Viewer Module
 *
 * Static HTML report generator for ISL evidence reports.
 *
 * @example
 * ```ts
 * import { renderHtml, renderTextSummary } from '@isl-lang/core/evidence-viewer';
 *
 * const report = JSON.parse(fs.readFileSync('evidence-report.json', 'utf-8'));
 *
 * // Generate HTML report
 * const html = renderHtml(report, { darkMode: true });
 * fs.writeFileSync('report.html', html);
 *
 * // Generate text summary for terminal
 * console.log(renderTextSummary(report));
 * ```
 */

// Main rendering functions
export {
  renderHtml,
  renderSummaryCard,
  renderClausesOnly,
  renderTextSummary,
  groupClausesByState,
  calculateStats,
} from './renderHtml.js';

// Types
export type {
  RenderOptions,
  ThemeColors,
  GroupedClauses,
  ReportStats,
  RenderedSection,
  BadgeType,
} from './viewerTypes.js';

export { lightTheme, darkTheme } from './viewerTypes.js';

// Re-export evidence types for convenience
export type {
  EvidenceReport,
  EvidenceClauseResult,
  Assumption,
  OpenQuestion,
  EvidenceArtifact,
  ScoreSummary,
} from './viewerTypes.js';

// Template utilities (for custom rendering)
export {
  escapeHtml,
  formatDate,
  formatDuration,
  generateStyles,
  renderBadge,
  renderScoreCard,
  renderClauseItem,
  renderClauseList,
  renderAssumptionItem,
  renderAssumptions,
  renderQuestionItem,
  renderOpenQuestions,
  renderArtifactItem,
  renderArtifacts,
  renderHeader,
  renderFooter,
  wrapInDocument,
} from './templates.js';
