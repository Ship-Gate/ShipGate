/**
 * ISL Studio Webviews
 * 
 * Webview panels for the ISL VS Code extension.
 */

// Evidence View
export { EvidenceView, EvidenceViewSerializer } from './EvidenceView';
export { buildEvidenceViewHtml } from './evidenceView.html';
export {
  createInitialState,
  calculateSummary,
  type EvidenceViewState,
  type VerificationResult,
  type VerificationStatus,
  type Assumption,
  type OpenQuestion,
  type FileReference,
  type ReportMetadata,
  type ScoreBreakdown,
  type WebviewMessage,
  type ExtensionMessage
} from './evidenceViewState';
