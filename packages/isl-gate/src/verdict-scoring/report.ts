/**
 * Verdict Explanation Report Generator
 * 
 * Generates human-readable and machine-readable explanation reports
 * for verdict scoring.
 * 
 * @module @isl-lang/gate/verdict-scoring/report
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import type { VerdictScoringResult } from './types.js';

// ============================================================================
// JSON Report
// ============================================================================

/**
 * Generate JSON explanation report
 */
export async function generateJsonReport(
  result: VerdictScoringResult,
  outputPath: string
): Promise<void> {
  const report = {
    verdict: result.verdict,
    score: result.score,
    confidence: result.confidence,
    summary: result.summary,
    timestamp: new Date().toISOString(),
    claims: result.scoredClaims.map(c => ({
      id: c.id,
      type: c.type,
      behavior: c.behavior,
      verdict: c.verdict,
      confidence: c.confidence,
      blastRadius: c.blastRadius,
      severity: c.severity,
      scoreContribution: c.scoreContribution,
      explanation: c.explanation,
      fixLocation: c.fixLocation,
    })),
    explanations: result.explanations,
    blockers: result.blockers,
    recommendations: result.recommendations,
    evidence: result.evidence.map((e, i) => ({
      index: i,
      source: e.source,
      check: e.check,
      result: e.result,
      confidence: e.confidence,
      details: e.details,
    })),
  };
  
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

// ============================================================================
// Markdown Report
// ============================================================================

/**
 * Generate Markdown explanation report
 */
export async function generateMarkdownReport(
  result: VerdictScoringResult,
  outputPath: string
): Promise<void> {
  const lines: string[] = [];
  
  // Header
  lines.push('# Verdict Explanation Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');
  
  // Verdict Summary
  lines.push('## Verdict Summary');
  lines.push('');
  lines.push(`| Verdict | Score | Confidence |`);
  lines.push(`|---------|-------|------------|`);
  lines.push(`| **${result.verdict}** | ${result.score}/100 | ${(result.confidence * 100).toFixed(1)}% |`);
  lines.push('');
  lines.push(`> ${result.summary}`);
  lines.push('');
  
  // Explanations
  if (result.explanations.length > 0) {
    lines.push('## Explanations');
    lines.push('');
    for (const exp of result.explanations) {
      lines.push(`### ${exp.category.replace(/_/g, ' ').toUpperCase()}`);
      lines.push('');
      lines.push(exp.message);
      if (exp.claimIds && exp.claimIds.length > 0) {
        lines.push('');
        lines.push(`**Related Claims:** ${exp.claimIds.join(', ')}`);
      }
      lines.push('');
    }
  }
  
  // Blockers
  if (result.blockers.length > 0) {
    lines.push('## Blockers');
    lines.push('');
    for (const blocker of result.blockers) {
      lines.push(`- ❌ ${blocker}`);
    }
    lines.push('');
  }
  
  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of result.recommendations) {
      lines.push(`- ✅ ${rec}`);
    }
    lines.push('');
  }
  
  // Scored Claims
  lines.push('## Scored Claims');
  lines.push('');
  lines.push(`Total: ${result.scoredClaims.length} claim(s)`);
  lines.push('');
  
  // Group by verdict
  const byVerdict = {
    pass: result.scoredClaims.filter(c => c.verdict === 'pass'),
    fail: result.scoredClaims.filter(c => c.verdict === 'fail'),
    warn: result.scoredClaims.filter(c => c.verdict === 'warn'),
    not_proven: result.scoredClaims.filter(c => c.verdict === 'not_proven'),
    skip: result.scoredClaims.filter(c => c.verdict === 'skip'),
  };
  
  if (byVerdict.fail.length > 0) {
    lines.push('### ❌ Failed Claims');
    lines.push('');
    for (const claim of byVerdict.fail) {
      lines.push(`#### ${claim.id}`);
      lines.push('');
      lines.push(`- **Type:** ${claim.type}`);
      if (claim.behavior) {
        lines.push(`- **Behavior:** ${claim.behavior}`);
      }
      if (claim.description) {
        lines.push(`- **Description:** ${claim.description}`);
      }
      lines.push(`- **Severity:** ${claim.severity}`);
      lines.push(`- **Blast Radius:** ${claim.blastRadius}`);
      lines.push(`- **Confidence:** ${(claim.confidence * 100).toFixed(1)}%`);
      lines.push(`- **Score Contribution:** ${claim.scoreContribution.toFixed(1)}`);
      if (claim.fixLocation) {
        lines.push(`- **Fix Location:** \`${claim.fixLocation.file}${claim.fixLocation.line ? `:${claim.fixLocation.line}` : ''}\``);
      }
      lines.push(`- **Explanation:** ${claim.explanation}`);
      lines.push('');
    }
  }
  
  if (byVerdict.warn.length > 0) {
    lines.push('### ⚠️ Warning Claims');
    lines.push('');
    for (const claim of byVerdict.warn) {
      lines.push(`- **${claim.id}** (${claim.type}): ${claim.description || 'No description'}`);
      if (claim.fixLocation) {
        lines.push(`  - Fix in: \`${claim.fixLocation.file}${claim.fixLocation.line ? `:${claim.fixLocation.line}` : ''}\``);
      }
    }
    lines.push('');
  }
  
  if (byVerdict.not_proven.length > 0) {
    lines.push('### ⚠️ Unproven Claims');
    lines.push('');
    for (const claim of byVerdict.not_proven) {
      lines.push(`- **${claim.id}** (${claim.type}): ${claim.description || 'No description'}`);
      lines.push(`  - Confidence: ${(claim.confidence * 100).toFixed(1)}%`);
    }
    lines.push('');
  }
  
  if (byVerdict.pass.length > 0) {
    lines.push(`### ✅ Passed Claims (${byVerdict.pass.length})`);
    lines.push('');
    lines.push('| ID | Type | Behavior | Score |');
    lines.push('|----|------|----------|-------|');
    for (const claim of byVerdict.pass.slice(0, 20)) { // Limit to first 20
      lines.push(`| ${claim.id} | ${claim.type} | ${claim.behavior || '-'} | ${claim.scoreContribution.toFixed(1)} |`);
    }
    if (byVerdict.pass.length > 20) {
      lines.push(`| ... | ... | ... | ... |`);
      lines.push(`*Showing first 20 of ${byVerdict.pass.length} passed claims*`);
    }
    lines.push('');
  }
  
  // Evidence Summary
  if (result.evidence.length > 0) {
    lines.push('## Evidence Summary');
    lines.push('');
    lines.push(`Total: ${result.evidence.length} evidence item(s)`);
    lines.push('');
    
    const byResult = {
      pass: result.evidence.filter(e => e.result === 'pass'),
      fail: result.evidence.filter(e => e.result === 'fail'),
      warn: result.evidence.filter(e => e.result === 'warn'),
      skip: result.evidence.filter(e => e.result === 'skip'),
    };
    
    lines.push(`- ✅ Passed: ${byResult.pass.length}`);
    lines.push(`- ❌ Failed: ${byResult.fail.length}`);
    lines.push(`- ⚠️ Warning: ${byResult.warn.length}`);
    lines.push(`- ⏭️ Skipped: ${byResult.skip.length}`);
    lines.push('');
    
    if (byResult.fail.length > 0) {
      lines.push('### Failed Evidence');
      lines.push('');
      for (const e of byResult.fail) {
        lines.push(`- **${e.check}** (${e.source})`);
        lines.push(`  - ${e.details}`);
        lines.push(`  - Confidence: ${(e.confidence * 100).toFixed(1)}%`);
        lines.push('');
      }
    }
  }
  
  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Report generated by ISL Gate Verdict Scorer*`);
  
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Generate both JSON and Markdown reports
 */
export async function generateExplainReports(
  result: VerdictScoringResult,
  outputDir: string
): Promise<{ jsonPath: string; mdPath: string }> {
  const jsonPath = join(outputDir, 'verdict-explain.json');
  const mdPath = join(outputDir, 'verdict-explain.md');
  
  await Promise.all([
    generateJsonReport(result, jsonPath),
    generateMarkdownReport(result, mdPath),
  ]);
  
  return { jsonPath, mdPath };
}
