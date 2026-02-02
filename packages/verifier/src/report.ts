// ============================================================================
// Evidence Report Generator - Deterministic report output
// ============================================================================

import * as crypto from 'node:crypto';
import type {
  EvidenceReport,
  ClauseResult,
  WorkspaceScanArtifacts,
  ReportSummary,
  ScoreBreakdown,
  ShipVerdict,
  SpecAST,
} from './types';

/**
 * Generate a deterministic evidence report
 * No timestamps, stable ordering, reproducible
 */
export function generateReport(
  spec: SpecAST,
  clauseResults: ClauseResult[],
  artifacts: WorkspaceScanArtifacts,
  score: number,
  breakdown: ScoreBreakdown,
  verdict: ShipVerdict,
  blockingIssues: string[],
  behavior?: string
): EvidenceReport {
  // Sort clause results for deterministic output
  const sortedResults = [...clauseResults].sort((a, b) =>
    a.clauseId.localeCompare(b.clauseId)
  );
  
  // Calculate summary
  const summary = calculateSummary(sortedResults, blockingIssues);
  
  // Generate input hash for reproducibility verification
  const inputHash = generateInputHash(spec, artifacts);
  
  return {
    version: '1.0.0',
    domain: spec.domain,
    behavior: behavior ?? '*',
    verdict,
    score,
    scoreBreakdown: breakdown,
    clauseResults: sortedResults,
    summary,
    artifacts: sanitizeArtifacts(artifacts),
    inputHash,
  };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(
  results: ClauseResult[],
  blockingIssues: string[]
): ReportSummary {
  let passed = 0;
  let partial = 0;
  let failed = 0;
  let skipped = 0;
  let evidenceCount = 0;
  
  for (const result of results) {
    switch (result.status) {
      case 'PASS':
        passed++;
        break;
      case 'PARTIAL':
        partial++;
        break;
      case 'FAIL':
        failed++;
        break;
      case 'SKIPPED':
        skipped++;
        break;
    }
    evidenceCount += result.evidence.length;
  }
  
  return {
    totalClauses: results.length,
    passed,
    partial,
    failed,
    skipped,
    evidenceCount,
    blockingIssues: [...blockingIssues].sort(),
  };
}

/**
 * Generate deterministic hash of inputs
 */
function generateInputHash(
  spec: SpecAST,
  artifacts: WorkspaceScanArtifacts
): string {
  // Create canonical representation
  const canonical = {
    domain: spec.domain,
    behaviors: spec.behaviors.map(b => b.name).sort(),
    invariants: spec.invariants.map(i => i.name).sort(),
    testFiles: artifacts.testFiles.map(t => t.path).sort(),
    bindings: artifacts.bindings.map(b => `${b.file}:${b.line}:${b.exportName}`).sort(),
    assertionCount: artifacts.assertions.length,
  };
  
  const content = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Sanitize artifacts for deterministic output
 * Ensures consistent ordering
 */
function sanitizeArtifacts(artifacts: WorkspaceScanArtifacts): WorkspaceScanArtifacts {
  return {
    testFiles: [...artifacts.testFiles]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(tf => ({
        ...tf,
        suites: [...tf.suites].sort(),
        tests: [...tf.tests].sort(),
      })),
    bindings: [...artifacts.bindings]
      .sort((a, b) => {
        const fileCompare = a.file.localeCompare(b.file);
        if (fileCompare !== 0) return fileCompare;
        return a.line - b.line;
      }),
    assertions: [...artifacts.assertions]
      .sort((a, b) => {
        const fileCompare = a.file.localeCompare(b.file);
        if (fileCompare !== 0) return fileCompare;
        return a.line - b.line;
      }),
  };
}

// ============================================================================
// REPORT SERIALIZATION
// ============================================================================

/**
 * Serialize report to JSON (stable, deterministic)
 */
export function serializeReport(report: EvidenceReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Deserialize report from JSON
 */
export function deserializeReport(json: string): EvidenceReport {
  return JSON.parse(json) as EvidenceReport;
}

/**
 * Compare two reports for equality (ignoring transient data)
 */
export function reportsEqual(a: EvidenceReport, b: EvidenceReport): boolean {
  // Compare core deterministic fields
  if (a.version !== b.version) return false;
  if (a.domain !== b.domain) return false;
  if (a.behavior !== b.behavior) return false;
  if (a.verdict !== b.verdict) return false;
  if (a.score !== b.score) return false;
  if (a.inputHash !== b.inputHash) return false;
  
  // Compare summary
  if (a.summary.totalClauses !== b.summary.totalClauses) return false;
  if (a.summary.passed !== b.summary.passed) return false;
  if (a.summary.failed !== b.summary.failed) return false;
  
  // Compare clause results
  if (a.clauseResults.length !== b.clauseResults.length) return false;
  for (let i = 0; i < a.clauseResults.length; i++) {
    const aClause = a.clauseResults[i]!;
    const bClause = b.clauseResults[i]!;
    if (aClause.clauseId !== bClause.clauseId) return false;
    if (aClause.status !== bClause.status) return false;
  }
  
  return true;
}

// ============================================================================
// REPORT FORMATTING
// ============================================================================

/**
 * Format report as human-readable text
 */
export function formatReportText(report: EvidenceReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push('═'.repeat(70));
  lines.push(`Evidence Report: ${report.domain}${report.behavior !== '*' ? '.' + report.behavior : ''}`);
  lines.push('═'.repeat(70));
  lines.push('');
  
  // Verdict
  const verdictIcon = report.verdict === 'SHIP' ? '✓' : '✗';
  lines.push(`Verdict: ${verdictIcon} ${report.verdict}`);
  lines.push(`Score: ${report.score}/100`);
  lines.push('');
  
  // Score breakdown
  lines.push('Score Breakdown:');
  lines.push(`  Preconditions:  ${padScore(report.scoreBreakdown.preconditions)}/100`);
  lines.push(`  Postconditions: ${padScore(report.scoreBreakdown.postconditions)}/100`);
  lines.push(`  Invariants:     ${padScore(report.scoreBreakdown.invariants)}/100`);
  lines.push(`  Security:       ${padScore(report.scoreBreakdown.security)}/100`);
  lines.push(`  Bindings:       ${padScore(report.scoreBreakdown.bindings)}/100`);
  lines.push(`  Test Coverage:  ${padScore(report.scoreBreakdown.testCoverage)}/100`);
  lines.push('');
  
  // Summary
  lines.push('Summary:');
  lines.push(`  Total Clauses:  ${report.summary.totalClauses}`);
  lines.push(`  Passed:         ${report.summary.passed}`);
  lines.push(`  Partial:        ${report.summary.partial}`);
  lines.push(`  Failed:         ${report.summary.failed}`);
  lines.push(`  Skipped:        ${report.summary.skipped}`);
  lines.push(`  Evidence:       ${report.summary.evidenceCount} pieces`);
  lines.push('');
  
  // Blocking issues
  if (report.summary.blockingIssues.length > 0) {
    lines.push('Blocking Issues:');
    for (const issue of report.summary.blockingIssues) {
      lines.push(`  ✗ ${issue}`);
    }
    lines.push('');
  }
  
  // Clause results
  lines.push('─'.repeat(70));
  lines.push('Clause Results:');
  lines.push('');
  
  for (const clause of report.clauseResults) {
    const statusIcon = getStatusIcon(clause.status);
    lines.push(`${statusIcon} [${clause.status.padEnd(7)}] ${clause.clauseId}`);
    lines.push(`    Expression: ${clause.expression}`);
    lines.push(`    Reason: ${clause.reason}`);
    lines.push(`    Confidence: ${clause.confidence}%`);
    
    if (clause.evidence.length > 0) {
      lines.push('    Evidence:');
      for (const ev of clause.evidence.slice(0, 5)) { // Limit to 5 for readability
        const loc = ev.line > 0 ? `${ev.file}:${ev.line}` : '(no location)';
        lines.push(`      - [${ev.kind}] ${loc}`);
        if (ev.snippet) {
          lines.push(`        ${ev.snippet.slice(0, 60)}${ev.snippet.length > 60 ? '...' : ''}`);
        }
      }
      if (clause.evidence.length > 5) {
        lines.push(`      ... and ${clause.evidence.length - 5} more`);
      }
    }
    lines.push('');
  }
  
  // Footer
  lines.push('─'.repeat(70));
  lines.push(`Input Hash: ${report.inputHash}`);
  lines.push(`Report Version: ${report.version}`);
  lines.push('═'.repeat(70));
  
  return lines.join('\n');
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'PASS': return '✓';
    case 'PARTIAL': return '◐';
    case 'FAIL': return '✗';
    case 'SKIPPED': return '○';
    default: return '?';
  }
}

/**
 * Pad score for alignment
 */
function padScore(score: number): string {
  return String(score).padStart(3);
}

/**
 * Format report as markdown
 */
export function formatReportMarkdown(report: EvidenceReport): string {
  const lines: string[] = [];
  
  lines.push(`# Evidence Report: ${report.domain}`);
  if (report.behavior !== '*') {
    lines.push(`## Behavior: ${report.behavior}`);
  }
  lines.push('');
  
  // Badge
  const badge = report.verdict === 'SHIP' 
    ? '![SHIP](https://img.shields.io/badge/verdict-SHIP-green)'
    : '![NO_SHIP](https://img.shields.io/badge/verdict-NO__SHIP-red)';
  lines.push(badge);
  lines.push('');
  
  // Score
  lines.push(`**Score:** ${report.score}/100`);
  lines.push('');
  
  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Clauses | ${report.summary.totalClauses} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Partial | ${report.summary.partial} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  lines.push(`| Skipped | ${report.summary.skipped} |`);
  lines.push('');
  
  // Score breakdown
  lines.push('## Score Breakdown');
  lines.push('');
  lines.push('| Component | Score |');
  lines.push('|-----------|-------|');
  lines.push(`| Preconditions | ${report.scoreBreakdown.preconditions}/100 |`);
  lines.push(`| Postconditions | ${report.scoreBreakdown.postconditions}/100 |`);
  lines.push(`| Invariants | ${report.scoreBreakdown.invariants}/100 |`);
  lines.push(`| Security | ${report.scoreBreakdown.security}/100 |`);
  lines.push(`| Bindings | ${report.scoreBreakdown.bindings}/100 |`);
  lines.push(`| Test Coverage | ${report.scoreBreakdown.testCoverage}/100 |`);
  lines.push('');
  
  // Blocking issues
  if (report.summary.blockingIssues.length > 0) {
    lines.push('## ⚠️ Blocking Issues');
    lines.push('');
    for (const issue of report.summary.blockingIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }
  
  // Clause results
  lines.push('## Clause Results');
  lines.push('');
  
  for (const clause of report.clauseResults) {
    const icon = getStatusIcon(clause.status);
    lines.push(`### ${icon} ${clause.clauseId}`);
    lines.push('');
    lines.push(`- **Status:** ${clause.status}`);
    lines.push(`- **Expression:** \`${clause.expression}\``);
    lines.push(`- **Confidence:** ${clause.confidence}%`);
    lines.push(`- **Reason:** ${clause.reason}`);
    
    if (clause.evidence.length > 0) {
      lines.push('');
      lines.push('**Evidence:**');
      for (const ev of clause.evidence) {
        const loc = ev.line > 0 ? `\`${ev.file}:${ev.line}\`` : '';
        lines.push(`- [${ev.kind}] ${loc} - ${ev.description}`);
      }
    }
    lines.push('');
  }
  
  // Footer
  lines.push('---');
  lines.push(`*Input Hash: \`${report.inputHash}\` | Version: ${report.version}*`);
  
  return lines.join('\n');
}
