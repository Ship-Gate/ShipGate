/**
 * Compliance Report Generation Module
 * 
 * Maps ISL Verify proof bundles to compliance framework controls
 * and generates formatted reports for auditors.
 * 
 * @module compliance
 */

export {
  ComplianceReportGenerator,
  type ComplianceFramework,
  type ControlStatus,
  type ComplianceControl,
  type ComplianceEvidence,
  type ComplianceReport,
  type ExecutiveSummary,
  type PropertyToControlMapping,
} from './compliance-report-generator.js';

export {
  formatMarkdownReport,
  formatHtmlReport,
  formatJsonReport,
  type ReportFormat,
} from './report-formatter.js';

export {
  generatePdfReport,
  generateEnhancedPdf,
  generatePdfFromMarkdown,
  type PdfGeneratorOptions,
  type EnhancedPdfOptions,
} from './pdf-generator.js';

export {
  generateSoc2Report,
  generateHipaaReport,
  generatePciDssReport,
  generateEuAiActReport,
  printComplianceResult,
  getComplianceExitCode,
  type ComplianceCommandOptions,
  type ComplianceCommandResult,
} from './cli-commands.js';
