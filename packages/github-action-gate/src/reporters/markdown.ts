/**
 * Markdown reporter for PR comments
 */

import { GateReport, Finding } from '../types.js';

/**
 * Generate markdown report for PR comment
 */
export function generateMarkdownReport(report: GateReport): string {
  const emoji = report.verdict === 'SHIP' ? '✅' : '🛑';
  
  let markdown = `## ${emoji} ISL Gate: ${report.verdict}\n\n`;
  
  // Score and summary
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| **Score** | ${report.score}/100 |\n`;
  markdown += `| **Total Findings** | ${report.totalFindings} |\n`;
  
  if (report.findingsBySeverity.critical > 0) {
    markdown += `| **🛑 Critical** | ${report.findingsBySeverity.critical} |\n`;
  }
  if (report.findingsBySeverity.high > 0) {
    markdown += `| **⚠️ High** | ${report.findingsBySeverity.high} |\n`;
  }
  if (report.findingsBySeverity.medium > 0) {
    markdown += `| **ℹ️ Medium** | ${report.findingsBySeverity.medium} |\n`;
  }
  if (report.findingsBySeverity.low > 0) {
    markdown += `| **💡 Low** | ${report.findingsBySeverity.low} |\n`;
  }
  
  markdown += `\n`;
  
  // Findings table
  if (report.findings.length > 0) {
    markdown += `### Findings (${report.findings.length})\n\n`;
    
    // Limit to first 20 findings to avoid comment size limits
    const displayedFindings = report.findings.slice(0, 20);
    
    markdown += `| Severity | Rule | File | Message |\n`;
    markdown += `|----------|------|------|--------|\n`;
    
    for (const finding of displayedFindings) {
      const severity = getSeverityEmoji(finding.severity);
      const file = finding.filePath ? `\`${finding.filePath}:${finding.line || 0}\`` : '-';
      const message = finding.message.length > 80 
        ? finding.message.substring(0, 77) + '...' 
        : finding.message;
      
      markdown += `| ${severity} | \`${finding.ruleId}\` | ${file} | ${message} |\n`;
    }
    
    if (report.findings.length > 20) {
      markdown += `\n*...and ${report.findings.length - 20} more findings*\n`;
    }
    
    // How to fix section
    markdown += `\n### How to Fix\n\n`;
    markdown += `Run locally with detailed output:\n`;
    markdown += `\`\`\`bash\n`;
    markdown += `npx @isl-lang/cli gate <spec> --impl <path> --explain\n`;
    markdown += `\`\`\`\n\n`;
  } else {
    markdown += `✨ No findings found. Safe to merge!\n\n`;
  }
  
  // Evidence link
  if (report.fingerprint) {
    markdown += `---\n`;
    markdown += `📦 Evidence fingerprint: \`${report.fingerprint}\`\n`;
    markdown += `🔗 [View detailed evidence](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})\n`;
  }
  
  return markdown;
}

/**
 * Get emoji for severity level
 */
function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🛑 Critical';
    case 'high':
      return '⚠️ High';
    case 'medium':
      return 'ℹ️ Medium';
    case 'low':
      return '💡 Low';
    default:
      return '❓ Unknown';
  }
}

/**
 * Generate summary for GitHub step summary
 */
export function generateStepSummary(report: GateReport): string {
  const emoji = report.verdict === 'SHIP' ? '✅' : '❌';
  
  let summary = `## ${emoji} ISL Gate Result\n\n`;
  summary += `**Verdict:** ${report.verdict}\n`;
  summary += `**Score:** ${report.score}/100\n`;
  summary += `**Findings:** ${report.totalFindings}\n\n`;
  
  if (report.findingsBySeverity.critical > 0 || report.findingsBySeverity.high > 0) {
    summary += `### 🚨 Blocking Issues\n\n`;
    if (report.findingsBySeverity.critical > 0) {
      summary += `- Critical: ${report.findingsBySeverity.critical}\n`;
    }
    if (report.findingsBySeverity.high > 0) {
      summary += `- High: ${report.findingsBySeverity.high}\n`;
    }
  }
  
  return summary;
}
