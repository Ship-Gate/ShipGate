/**
 * Audit Module
 *
 * Workspace auditing for ISL coverage analysis.
 */

export * from './auditTypes.js';
export {
  auditWorkspace,
  formatAuditReportForStudio,
  getAuditSummaryText,
  type AuditWorkspaceOptions,
} from './audit.js';
export * from './detectors/index.js';
