/**
 * Audit V2 Module
 *
 * Enhanced audit engine for detecting implementations and
 * generating evidence-like audit reports.
 */

// Main audit functions
export {
  auditWorkspaceV2,
  formatAuditReportV2,
  getAuditSummaryTextV2,
} from './audit.js';
export type { AuditWorkspaceOptionsV2 } from './audit.js';

// Types
export type {
  AuditReportV2,
  AuditSummaryV2,
  AuditOptionsV2,
  DetectedCandidate,
  BehaviorMapping,
  RiskFlag,
  RiskSeverity,
  BehaviorCategory,
  FrameworkHint,
  DetectorResult,
  Detector,
} from './types.js';

export { DEFAULT_AUDIT_OPTIONS_V2 } from './types.js';

// Detectors (for advanced usage)
export {
  detectRoutes,
  detectAuth,
  detectDatabase,
  detectWebhooks,
  isRouteFile,
  isAuthFile,
  isDatabaseFile,
  isWebhookFile,
} from './detectors/index.js';
