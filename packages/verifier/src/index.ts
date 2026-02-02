// ============================================================================
// Evidence-First Verifier - Public API
// ============================================================================

// Main verification pipeline
export {
  verify,
  verifyWithArtifacts,
  verifyWithAssertionResults,
  verifyBehavior,
  verifyAll,
  createSpec,
  createEmptyArtifacts,
} from './pipeline';

// Workspace scanner
export {
  scanWorkspace,
  type ScannerOptions,
} from './scanner';

// Evidence binding
export {
  bindEvidence,
  markEvidenceResult,
  updateClauseWithAssertion,
} from './evidence';

// Deterministic scoring
export {
  computeScore,
  explainScore,
  formatScoreCompact,
  SCORING_WEIGHTS,
  STATUS_SCORES,
  DEFAULT_SHIP_THRESHOLD,
  NO_SHIP_RULES,
} from './scoring';

// Report generation
export {
  generateReport,
  serializeReport,
  deserializeReport,
  reportsEqual,
  formatReportText,
  formatReportMarkdown,
} from './report';

// Types
export type {
  // Core types
  ClauseStatus,
  EvidenceKind,
  Evidence,
  ClauseResult,
  
  // Workspace artifacts
  WorkspaceScanArtifacts,
  TestFileInfo,
  BindingInfo,
  AssertionInfo,
  
  // Scoring
  ShipVerdict,
  ScoreBreakdown,
  
  // Report
  EvidenceReport,
  ReportSummary,
  
  // Options
  VerifyOptions,
  
  // Spec types
  SpecAST,
  BehaviorSpec,
  ClauseSpec,
  InvariantSpec,
} from './types';
