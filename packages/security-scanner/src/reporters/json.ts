// ============================================================================
// JSON Reporter
// Simple JSON output format for scan results
// ============================================================================

import {
  ScanResult,
  Finding,
  ScanSummary,
  Severity,
  SecurityCategory,
  SEVERITY_INFO,
  CATEGORY_INFO,
} from '../severity';

// ============================================================================
// JSON Report Types
// ============================================================================

export interface JsonReport {
  metadata: JsonReportMetadata;
  summary: JsonReportSummary;
  findings: JsonFinding[];
  statistics: JsonStatistics;
}

export interface JsonReportMetadata {
  generatedAt: string;
  scanDuration: number;
  scannerVersion: string;
  filesScanned: number;
  rulesApplied: number;
}

export interface JsonReportSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  passed: boolean;
  score: number;
}

export interface JsonFinding {
  id: string;
  title: string;
  severity: Severity;
  severityScore: number;
  category: SecurityCategory;
  categoryName: string;
  location: {
    file: string;
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
  };
  description: string;
  recommendation: string;
  cwe?: string;
  cweUrl?: string;
  owasp?: string;
  owaspUrl?: string;
  fix?: string;
  context?: Record<string, unknown>;
}

export interface JsonStatistics {
  bySeverity: Record<Severity, number>;
  byCategory: Record<string, number>;
  byFile: Record<string, number>;
  byRule: Record<string, number>;
  topVulnerabilities: string[];
}

// ============================================================================
// JSON Generation
// ============================================================================

const SCANNER_VERSION = '1.0.0';
const CWE_BASE_URL = 'https://cwe.mitre.org/data/definitions/';
const OWASP_BASE_URL = 'https://owasp.org/Top10/';

function getCweUrl(cwe?: string): string | undefined {
  if (!cwe) return undefined;
  const cweNumber = cwe.replace('CWE-', '');
  return `${CWE_BASE_URL}${cweNumber}.html`;
}

function getOwaspUrl(owasp?: string): string | undefined {
  if (!owasp) return undefined;
  // OWASP format: A01:2021
  return `${OWASP_BASE_URL}${owasp.replace(':', '_')}/`;
}

function calculateSecurityScore(summary: ScanSummary): number {
  // Score from 0-100, where 100 is perfect
  // Deductions: Critical=-30, High=-15, Medium=-5, Low=-1
  const deductions =
    summary.critical * 30 +
    summary.high * 15 +
    summary.medium * 5 +
    summary.low * 1;

  return Math.max(0, 100 - deductions);
}

function findingToJson(finding: Finding): JsonFinding {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    severityScore: SEVERITY_INFO[finding.severity].score,
    category: finding.category,
    categoryName: CATEGORY_INFO[finding.category]?.name || finding.category,
    location: {
      file: finding.location.file,
      line: finding.location.startLine,
      column: finding.location.startColumn,
      endLine: finding.location.endLine,
      endColumn: finding.location.endColumn,
    },
    description: finding.description,
    recommendation: finding.recommendation,
    cwe: finding.cwe,
    cweUrl: getCweUrl(finding.cwe),
    owasp: finding.owasp,
    owaspUrl: getOwaspUrl(finding.owasp),
    fix: finding.fix,
    context: finding.context,
  };
}

function calculateStatistics(findings: Finding[]): JsonStatistics {
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byCategory: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  const byRule: Record<string, number> = {};

  for (const finding of findings) {
    // By severity
    const currentCount = bySeverity[finding.severity];
    if (currentCount !== undefined) {
      bySeverity[finding.severity] = currentCount + 1;
    }

    // By category
    byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;

    // By file
    byFile[finding.location.file] = (byFile[finding.location.file] || 0) + 1;

    // By rule
    byRule[finding.id] = (byRule[finding.id] || 0) + 1;
  }

  // Top vulnerabilities (most common rules)
  const topVulnerabilities = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ruleId]) => ruleId);

  return {
    bySeverity: bySeverity as Record<Severity, number>,
    byCategory,
    byFile,
    byRule,
    topVulnerabilities,
  };
}

// ============================================================================
// Export Functions
// ============================================================================

export interface JsonReportOptions {
  includeContext?: boolean;
  includeFixes?: boolean;
  includeStatistics?: boolean;
  minSeverity?: Severity;
}

/**
 * Generate JSON report from scan results
 */
export function generateJsonReport(
  scanResult: ScanResult,
  options: JsonReportOptions = {}
): JsonReport {
  const {
    includeContext = true,
    includeFixes = true,
    includeStatistics = true,
    minSeverity,
  } = options;

  // Filter findings by severity if needed
  let findings = scanResult.findings;
  if (minSeverity) {
    const minScore = SEVERITY_INFO[minSeverity].score;
    findings = findings.filter(
      (f) => SEVERITY_INFO[f.severity].score >= minScore
    );
  }

  // Convert findings
  let jsonFindings = findings.map(findingToJson);

  // Remove context/fixes if not requested
  if (!includeContext) {
    jsonFindings = jsonFindings.map((f) => ({ ...f, context: undefined }));
  }
  if (!includeFixes) {
    jsonFindings = jsonFindings.map((f) => ({ ...f, fix: undefined }));
  }

  // Calculate score
  const score = calculateSecurityScore(scanResult.summary);

  return {
    metadata: {
      generatedAt: scanResult.scannedAt.toISOString(),
      scanDuration: scanResult.duration,
      scannerVersion: SCANNER_VERSION,
      filesScanned: scanResult.filesScanned,
      rulesApplied: scanResult.rulesApplied,
    },
    summary: {
      total: scanResult.summary.total,
      critical: scanResult.summary.critical,
      high: scanResult.summary.high,
      medium: scanResult.summary.medium,
      low: scanResult.summary.low,
      passed: scanResult.summary.critical === 0 && scanResult.summary.high === 0,
      score,
    },
    findings: jsonFindings,
    statistics: includeStatistics ? calculateStatistics(findings) : {
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      byCategory: {},
      byFile: {},
      byRule: {},
      topVulnerabilities: [],
    },
  };
}

/**
 * Generate JSON report as string
 */
export function generateJsonString(
  scanResult: ScanResult,
  options: JsonReportOptions = {}
): string {
  const report = generateJsonReport(scanResult, options);
  return JSON.stringify(report, null, 2);
}

/**
 * Generate minimal JSON report (just summary and finding IDs)
 */
export function generateMinimalJson(scanResult: ScanResult): object {
  return {
    summary: scanResult.summary,
    findings: scanResult.findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      file: f.location.file,
      line: f.location.startLine,
    })),
  };
}
