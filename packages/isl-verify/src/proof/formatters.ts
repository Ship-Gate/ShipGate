import type { ProofBundle, PropertyProof } from './types.js';
import { getTrustScoreGrade } from './trust-score.js';
import { categorizeRisks } from './residual-risks.js';

export function formatBundleAsJson(bundle: ProofBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function formatBundleAsMarkdown(bundle: ProofBundle): string {
  const lines: string[] = [];

  lines.push('# ISL Verification Proof Bundle');
  lines.push('');
  lines.push(`**Bundle ID:** \`${bundle.id}\``);
  lines.push(`**Generated:** ${new Date(bundle.timestamp).toLocaleString()}`);
  lines.push(`**Project:** ${bundle.project.name}`);
  lines.push(`**Framework:** ${bundle.project.framework} (${bundle.project.language})`);
  lines.push('');

  lines.push('## Trust Score');
  lines.push('');
  const grade = getTrustScoreGrade(bundle.summary.trustScore);
  const verdict = bundle.summary.overallVerdict;
  lines.push(`**Score:** ${bundle.summary.trustScore}/100 (${grade})`);
  lines.push(`**Verdict:** ${verdict}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- ✅ **Proven:** ${bundle.summary.proven} properties`);
  lines.push(`- ⚠️ **Partial:** ${bundle.summary.partial} properties`);
  lines.push(`- ❌ **Failed:** ${bundle.summary.failed} properties`);
  lines.push(`- ⏭️ **Not Verified:** ${bundle.summary.notVerified} properties`);
  lines.push('');

  lines.push('## Properties Verified');
  lines.push('');
  lines.push('| Property | Status | Confidence | Findings | Duration |');
  lines.push('|----------|--------|------------|----------|----------|');
  
  for (const prop of bundle.properties) {
    const statusIcon = getStatusIcon(prop.status);
    const findingCount = prop.findings.length;
    const duration = `${prop.duration_ms}ms`;
    lines.push(`| ${prop.property} | ${statusIcon} ${prop.status} | ${prop.confidence} | ${findingCount} | ${duration} |`);
  }
  lines.push('');

  if (bundle.summary.residualRisks.length > 0) {
    lines.push('## Residual Risks');
    lines.push('');
    const categorized = categorizeRisks(bundle.summary.residualRisks);
    
    if (categorized.critical.length > 0) {
      lines.push('### 🔴 Critical Risks');
      lines.push('');
      for (const risk of categorized.critical) {
        lines.push(`- ${risk}`);
      }
      lines.push('');
    }

    if (categorized.important.length > 0) {
      lines.push('### 🟡 Important Risks');
      lines.push('');
      for (const risk of categorized.important) {
        lines.push(`- ${risk}`);
      }
      lines.push('');
    }

    if (categorized.limitations.length > 0) {
      lines.push('### ℹ️ Inherent Limitations');
      lines.push('');
      for (const limitation of categorized.limitations) {
        lines.push(`- ${limitation.replace('LIMITATION — ', '')}`);
      }
      lines.push('');
    }
  }

  lines.push('## Project Details');
  lines.push('');
  lines.push(`- **Path:** \`${bundle.project.path}\``);
  lines.push(`- **Files Scanned:** ${bundle.project.fileCount}`);
  lines.push(`- **Lines of Code:** ${bundle.project.loc.toLocaleString()}`);
  if (bundle.project.commit) {
    lines.push(`- **Git Commit:** \`${bundle.project.commit.substring(0, 8)}\``);
  }
  if (bundle.project.branch) {
    lines.push(`- **Git Branch:** \`${bundle.project.branch}\``);
  }
  lines.push('');

  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Tool Version:** ${bundle.metadata.toolVersion}`);
  lines.push(`- **Duration:** ${bundle.metadata.duration_ms}ms`);
  lines.push(`- **Provers Run:** ${bundle.metadata.proversRun.join(', ')}`);
  lines.push('');

  lines.push('## Verification');
  lines.push('');
  lines.push('This bundle is cryptographically signed. To verify:');
  lines.push('');
  lines.push('```bash');
  lines.push('isl-verify verify-bundle proof-bundle.json');
  lines.push('```');
  lines.push('');
  lines.push(`**Signature:** \`${bundle.signature.substring(0, 16)}...\``);

  return lines.join('\n');
}

export function formatBundleAsPRComment(bundle: ProofBundle): string {
  const lines: string[] = [];

  const grade = getTrustScoreGrade(bundle.summary.trustScore);
  const verdict = bundle.summary.overallVerdict;
  const icon = verdict === 'VERIFIED' ? '✅' : verdict === 'PARTIAL' ? '⚠️' : '❌';

  lines.push(`## ${icon} ISL Verification Results`);
  lines.push('');
  lines.push(`**Trust Score:** ${bundle.summary.trustScore}/100 (${grade}) | **Verdict:** ${verdict}`);
  lines.push('');

  lines.push('### Summary');
  lines.push('');
  lines.push(`| ✅ Proven | ⚠️ Partial | ❌ Failed | ⏭️ Not Verified |`);
  lines.push(`|-----------|-----------|----------|----------------|`);
  lines.push(`| ${bundle.summary.proven} | ${bundle.summary.partial} | ${bundle.summary.failed} | ${bundle.summary.notVerified} |`);
  lines.push('');

  if (bundle.summary.failed > 0) {
    const failedProps = bundle.properties.filter(p => p.status === 'FAILED');
    lines.push('### ❌ Failed Properties');
    lines.push('');
    for (const prop of failedProps) {
      lines.push(`- **${prop.property}**: ${prop.findings.length} issues found`);
    }
    lines.push('');
  }

  if (bundle.summary.residualRisks.length > 0) {
    const categorized = categorizeRisks(bundle.summary.residualRisks);
    const criticalCount = categorized.critical.length;
    
    if (criticalCount > 0) {
      lines.push(`### 🔴 ${criticalCount} Critical Risk${criticalCount > 1 ? 's' : ''}`);
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>View risks</summary>');
      lines.push('');
      for (const risk of categorized.critical.slice(0, 5)) {
        lines.push(`- ${risk}`);
      }
      if (categorized.critical.length > 5) {
        lines.push(`- ... and ${categorized.critical.length - 5} more`);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  lines.push('<details>');
  lines.push('<summary>View all properties</summary>');
  lines.push('');
  lines.push('| Property | Status | Findings |');
  lines.push('|----------|--------|----------|');
  for (const prop of bundle.properties) {
    const statusIcon = getStatusIcon(prop.status);
    lines.push(`| ${prop.property} | ${statusIcon} ${prop.status} | ${prop.findings.length} |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  lines.push(`📋 **Files:** ${bundle.project.fileCount} | **LOC:** ${bundle.project.loc.toLocaleString()} | **Duration:** ${bundle.metadata.duration_ms}ms`);

  return lines.join('\n');
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'PROVEN':
      return '✅';
    case 'PARTIAL':
      return '⚠️';
    case 'FAILED':
      return '❌';
    case 'NOT_VERIFIED':
      return '⏭️';
    default:
      return '❓';
  }
}
