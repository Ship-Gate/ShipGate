/**
 * Reporting Module — Barrel Export
 *
 * Generates formatted verification reports in Markdown, PDF, JSON,
 * and HTML for stakeholders who don't use the CLI.
 */

// Types
export type {
  ReportFormat,
  ReportScope,
  ReportVerdict,
  FileStatus,
  FileVerificationMethod,
  ReportOptions,
  ReportRepositoryInfo,
  ReportFileResult,
  ReportCoverageSummary,
  TrendDataPoint,
  ReportRecommendation,
  ReportData,
  ReportResult,
} from './reportTypes.js';

// Generators
export { generateMarkdownReport } from './markdownReport.js';
export { generateJsonReport } from './jsonReport.js';
export type { JsonReportOutput } from './jsonReport.js';
export { generateHtmlReport, DEFAULT_REPORT_CSS } from './htmlReport.js';
export { generatePdfReport } from './pdfReport.js';

// Orchestrator
export { generateReport, buildReportData } from './generateReport.js';
export type { BuildReportDataOptions } from './generateReport.js';
