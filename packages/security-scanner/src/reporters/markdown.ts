// ============================================================================
// Markdown Reporter
// Human-readable markdown format for scan results
// ============================================================================

import {
  ScanResult,
  Finding,
  Severity,
  SEVERITY_INFO,
  CATEGORY_INFO,
} from '../severity';

// ============================================================================
// Markdown Generation Helpers
// ============================================================================

function getSeverityBadge(severity: Severity): string {
  const info = SEVERITY_INFO[severity];
  return `${info.emoji} **${severity.toUpperCase()}**`;
}

function getSeverityIcon(severity: Severity): string {
  return SEVERITY_INFO[severity].emoji;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function getCweLink(cwe?: string): string {
  if (!cwe) return '';
  const cweNumber = cwe.replace('CWE-', '');
  return `[${cwe}](https://cwe.mitre.org/data/definitions/${cweNumber}.html)`;
}

function getOwaspLink(owasp?: string): string {
  if (!owasp) return '';
  return `[${owasp}](https://owasp.org/Top10/${owasp.replace(':', '_')}/)`;
}

// ============================================================================
// Report Sections
// ============================================================================

function generateHeader(scanResult: ScanResult): string {
  const score = calculateScore(scanResult);
  const status = score >= 70 ? '✅ PASSED' : '❌ FAILED';

  return `# 🔒 Security Scan Report

**Generated:** ${scanResult.scannedAt.toISOString()}  
**Duration:** ${formatDuration(scanResult.duration)}  
**Files Scanned:** ${formatNumber(scanResult.filesScanned)}  
**Rules Applied:** ${formatNumber(scanResult.rulesApplied)}  
**Status:** ${status}  
**Security Score:** ${score}/100

---
`;
}

function generateSummary(scanResult: ScanResult): string {
  const { summary } = scanResult;

  return `## 📊 Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${summary.critical} |
| 🟠 High | ${summary.high} |
| 🟡 Medium | ${summary.medium} |
| 🟢 Low | ${summary.low} |
| **Total** | **${summary.total}** |

`;
}

function generateFindingsTable(findings: Finding[]): string {
  if (findings.length === 0) {
    return `## ✅ No Issues Found

Great job! No security vulnerabilities were detected.

`;
  }

  // Sort by severity
  const sorted = [...findings].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  let output = `## 🚨 Findings

| # | Severity | Rule | Location | Description |
|---|----------|------|----------|-------------|
`;

  sorted.forEach((finding, index) => {
    const severity = getSeverityIcon(finding.severity);
    const location = `\`${finding.location.file}:${finding.location.startLine}\``;
    const description = truncate(escapeMarkdown(finding.description), 60);

    output += `| ${index + 1} | ${severity} | ${finding.id} | ${location} | ${description} |\n`;
  });

  return output + '\n';
}

function generateDetailedFindings(findings: Finding[]): string {
  if (findings.length === 0) return '';

  // Group by severity
  const bySeverity: Record<Severity, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const finding of findings) {
    bySeverity[finding.severity].push(finding);
  }

  let output = `## 📋 Detailed Findings\n\n`;

  for (const severity of ['critical', 'high', 'medium', 'low'] as Severity[]) {
    const severityFindings = bySeverity[severity];
    if (severityFindings.length === 0) continue;

    const info = SEVERITY_INFO[severity];
    output += `### ${info.emoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${severityFindings.length})\n\n`;

    for (const finding of severityFindings) {
      output += generateFindingDetail(finding);
    }
  }

  return output;
}

function generateFindingDetail(finding: Finding): string {
  let output = `#### ${finding.id}: ${finding.title}\n\n`;

  output += `**Location:** \`${finding.location.file}:${finding.location.startLine}\`\n\n`;
  output += `**Category:** ${CATEGORY_INFO[finding.category]?.name || finding.category}\n\n`;

  if (finding.cwe || finding.owasp) {
    output += `**References:** `;
    const refs = [];
    if (finding.cwe) refs.push(getCweLink(finding.cwe));
    if (finding.owasp) refs.push(getOwaspLink(finding.owasp));
    output += refs.join(' | ') + '\n\n';
  }

  output += `**Description:**\n${finding.description}\n\n`;
  output += `**Recommendation:**\n${finding.recommendation}\n\n`;

  if (finding.fix) {
    output += `**Suggested Fix:**\n\`\`\`\n${finding.fix}\n\`\`\`\n\n`;
  }

  output += `---\n\n`;

  return output;
}

function generateStatistics(findings: Finding[]): string {
  if (findings.length === 0) return '';

  // Category breakdown
  const byCategory: Record<string, number> = {};
  const byFile: Record<string, number> = {};

  for (const finding of findings) {
    byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
    byFile[finding.location.file] = (byFile[finding.location.file] || 0) + 1;
  }

  let output = `## 📈 Statistics\n\n`;

  // By category
  output += `### By Category\n\n`;
  output += `| Category | Count |\n|----------|-------|\n`;
  for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    const categoryName = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO]?.name || category;
    output += `| ${categoryName} | ${count} |\n`;
  }
  output += '\n';

  // By file (top 10)
  const topFiles = Object.entries(byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topFiles.length > 0) {
    output += `### Top Files by Issues\n\n`;
    output += `| File | Issues |\n|------|--------|\n`;
    for (const [file, count] of topFiles) {
      output += `| \`${file}\` | ${count} |\n`;
    }
    output += '\n';
  }

  return output;
}

function generateRecommendations(scanResult: ScanResult): string {
  const { summary } = scanResult;

  if (summary.total === 0) {
    return `## 💡 Recommendations

Your codebase passed the security scan with no issues detected. Continue following security best practices:

- Regular dependency updates
- Code reviews for security-sensitive changes
- Periodic security audits
- Security training for developers

`;
  }

  let output = `## 💡 Recommendations\n\n`;

  if (summary.critical > 0) {
    output += `### ⚠️ Immediate Action Required\n\n`;
    output += `You have **${summary.critical} critical** vulnerabilities that require immediate attention. `;
    output += `These issues could lead to severe security breaches.\n\n`;
  }

  if (summary.high > 0) {
    output += `### 🔴 High Priority\n\n`;
    output += `Address the **${summary.high} high** severity issues in your next sprint. `;
    output += `These vulnerabilities pose significant security risks.\n\n`;
  }

  if (summary.medium > 0) {
    output += `### 🟡 Medium Priority\n\n`;
    output += `Plan to fix the **${summary.medium} medium** severity issues. `;
    output += `While not immediately exploitable, they represent security weaknesses.\n\n`;
  }

  output += `### 📚 Resources\n\n`;
  output += `- [OWASP Top 10](https://owasp.org/Top10/)\n`;
  output += `- [CWE Top 25](https://cwe.mitre.org/top25/)\n`;
  output += `- [NIST Security Guidelines](https://csrc.nist.gov/)\n\n`;

  return output;
}

function calculateScore(scanResult: ScanResult): number {
  const { summary } = scanResult;
  const deductions =
    summary.critical * 30 +
    summary.high * 15 +
    summary.medium * 5 +
    summary.low * 1;
  return Math.max(0, 100 - deductions);
}

// ============================================================================
// Export Functions
// ============================================================================

export interface MarkdownOptions {
  includeDetails?: boolean;
  includeStatistics?: boolean;
  includeRecommendations?: boolean;
  includeFixes?: boolean;
  title?: string;
}

/**
 * Generate full markdown report
 */
export function generateMarkdownReport(
  scanResult: ScanResult,
  options: MarkdownOptions = {}
): string {
  const {
    includeDetails = true,
    includeStatistics = true,
    includeRecommendations = true,
  } = options;

  let output = '';

  output += generateHeader(scanResult);
  output += generateSummary(scanResult);
  output += generateFindingsTable(scanResult.findings);

  if (includeDetails) {
    output += generateDetailedFindings(scanResult.findings);
  }

  if (includeStatistics) {
    output += generateStatistics(scanResult.findings);
  }

  if (includeRecommendations) {
    output += generateRecommendations(scanResult);
  }

  output += `---\n\n*Generated by ISL Security Scanner v1.0.0*\n`;

  return output;
}

/**
 * Generate summary-only markdown (for PR comments)
 */
export function generateMarkdownSummary(scanResult: ScanResult): string {
  const score = calculateScore(scanResult);
  const status = score >= 70 ? '✅' : '❌';
  const { summary } = scanResult;

  let output = `## ${status} Security Scan Results\n\n`;
  output += `**Score:** ${score}/100\n\n`;
  output += `| 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | Total |\n`;
  output += `|------------|---------|-----------|--------|-------|\n`;
  output += `| ${summary.critical} | ${summary.high} | ${summary.medium} | ${summary.low} | ${summary.total} |\n\n`;

  if (summary.critical > 0 || summary.high > 0) {
    output += `⚠️ **Action required:** Please address the critical and high severity issues before merging.\n`;
  }

  return output;
}

/**
 * Generate GitHub-flavored markdown with collapsible sections
 */
export function generateGitHubMarkdown(scanResult: ScanResult): string {
  let output = generateMarkdownSummary(scanResult);

  if (scanResult.findings.length > 0) {
    output += `\n<details>\n<summary>View ${scanResult.findings.length} findings</summary>\n\n`;
    output += generateFindingsTable(scanResult.findings);
    output += `</details>\n`;
  }

  return output;
}
