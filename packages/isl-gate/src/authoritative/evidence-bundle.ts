/**
 * Evidence Bundle Generator
 * 
 * Creates deterministic, machine-readable evidence bundles.
 * All outputs are reproducible given the same inputs.
 * 
 * @module @isl-lang/gate/authoritative/evidence-bundle
 */

import * as crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import type {
  EvidenceBundle,
  EvidenceArtifact,
  AuthoritativeGateResult,
  AuthoritativeVerdict,
} from './types.js';

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Hash content with SHA-256
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Generate deterministic fingerprint from multiple hashes
 */
export function generateFingerprint(
  specHash: string,
  implHash: string,
  resultsHash: string,
  islVersion: string
): string {
  const combined = `${specHash}:${implHash}:${resultsHash}:${islVersion}`;
  return hashContent(combined).slice(0, 16);
}

// ============================================================================
// Artifact Creation
// ============================================================================

/**
 * Create an evidence artifact
 */
export function createArtifact(
  type: EvidenceArtifact['type'],
  path: string,
  content: string
): EvidenceArtifact {
  return {
    type,
    path,
    sha256: hashContent(content),
    sizeBytes: Buffer.byteLength(content, 'utf-8'),
  };
}

// ============================================================================
// Bundle Generation
// ============================================================================

/**
 * Create an evidence bundle manifest
 */
export function createBundle(options: {
  specHash: string;
  implHash: string;
  resultsHash: string;
  islVersion: string;
  artifacts: EvidenceArtifact[];
  git?: { sha?: string; branch?: string };
  ci?: { runId?: string };
  deterministic?: boolean;
}): EvidenceBundle {
  const {
    specHash,
    implHash,
    resultsHash,
    islVersion,
    artifacts,
    git,
    ci,
    deterministic = true,
  } = options;

  const fingerprint = generateFingerprint(specHash, implHash, resultsHash, islVersion);
  
  return {
    schemaVersion: '2.0.0',
    fingerprint,
    islVersion,
    timestamp: deterministic ? '1970-01-01T00:00:00.000Z' : new Date().toISOString(),
    gitSha: git?.sha,
    gitBranch: git?.branch,
    ciRunId: ci?.runId,
    inputs: {
      specHash,
      implHash,
    },
    artifacts,
  };
}

// ============================================================================
// Bundle Writer
// ============================================================================

/**
 * Write evidence bundle to disk
 */
export async function writeBundle(
  outputPath: string,
  result: AuthoritativeGateResult,
  spec: string,
  implementation?: string
): Promise<string> {
  // Create directories
  const bundleDir = outputPath;
  const artifactsDir = join(bundleDir, 'artifacts');
  
  await mkdir(bundleDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });

  // Write manifest.json
  const manifestPath = join(bundleDir, 'manifest.json');
  await writeFile(
    manifestPath,
    JSON.stringify(result.evidence, null, 2),
    'utf-8'
  );

  // Write verdict.json (machine-readable verdict)
  const verdictPath = join(bundleDir, 'verdict.json');
  const verdictJson = {
    schemaVersion: '2.0.0',
    verdict: result.verdict,
    exitCode: result.exitCode,
    score: result.score,
    confidence: result.confidence,
    summary: result.summary,
    fingerprint: result.evidence.fingerprint,
    timestamp: result.evidence.timestamp,
    reasons: result.reasons.map(r => ({
      code: r.code,
      message: r.message,
      severity: r.severity,
      blocking: r.blocking,
    })),
    thresholds: result.thresholds,
    aggregation: {
      overallScore: result.aggregation.overallScore,
      tests: result.aggregation.tests,
      findings: result.aggregation.findings,
      coverage: result.aggregation.coverage,
      blockingIssuesCount: result.aggregation.blockingIssues.length,
    },
    suggestions: result.suggestions,
    riskAcceptances: result.riskAcceptances ?? [],
  };
  await writeFile(verdictPath, JSON.stringify(verdictJson, null, 2), 'utf-8');

  // Write spec artifact
  const specPath = join(artifactsDir, 'spec.isl');
  await writeFile(specPath, spec, 'utf-8');

  // Write implementation artifact (if provided and not too large)
  if (implementation && implementation.length < 1024 * 1024) {
    const implPath = join(artifactsDir, 'implementation.txt');
    await writeFile(implPath, implementation, 'utf-8');
  }

  // Write HTML report
  const reportHtml = generateHtmlReport(result);
  const reportPath = join(bundleDir, 'report.html');
  await writeFile(reportPath, reportHtml, 'utf-8');

  // Write SARIF report (for IDE/CI integration)
  const sarifReport = generateSarifReport(result);
  const sarifPath = join(bundleDir, 'results.sarif');
  await writeFile(sarifPath, JSON.stringify(sarifReport, null, 2), 'utf-8');

  return bundleDir;
}

// ============================================================================
// Report Generators
// ============================================================================

/**
 * Generate HTML report
 */
function generateHtmlReport(result: AuthoritativeGateResult): string {
  const verdictColor = result.verdict === 'SHIP' ? '#22c55e' : '#ef4444';
  const verdictEmoji = result.verdict === 'SHIP' ? '✅' : '❌';
  
  const reasonsHtml = result.reasons
    .map(r => {
      const severityColor = {
        critical: '#ef4444',
        high: '#f97316',
        medium: '#eab308',
        info: '#3b82f6',
      }[r.severity] || '#6b7280';
      
      return `<li style="color: ${severityColor}">
        <strong>[${r.code}]</strong> ${escapeHtml(r.message)}
        ${r.blocking ? '<span style="color: #ef4444">(BLOCKING)</span>' : ''}
      </li>`;
    })
    .join('\n');

  const suggestionsHtml = result.suggestions?.length
    ? `<h3>Suggestions</h3><ul>${result.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('\n')}</ul>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISL Gate Report - ${result.verdict}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .verdict { font-size: 2em; font-weight: bold; color: ${verdictColor}; margin-bottom: 20px; }
    .score { font-size: 1.5em; margin-bottom: 10px; }
    .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; }
    .fingerprint { font-family: monospace; font-size: 0.9em; color: #6b7280; }
    ul { padding-left: 20px; }
    li { margin-bottom: 5px; }
  </style>
</head>
<body>
  <h1>ISL Gate Report</h1>
  
  <div class="verdict">${verdictEmoji} ${result.verdict}</div>
  
  <div class="score">Score: ${result.score}/100 (Confidence: ${result.confidence}%)</div>
  
  <div class="summary">${escapeHtml(result.summary)}</div>
  
  <h2>Metrics</h2>
  <table>
    <tr><th>Metric</th><th>Value</th><th>Threshold</th></tr>
    <tr><td>Overall Score</td><td>${result.score}</td><td>≥ ${result.thresholds.minScore}</td></tr>
    <tr><td>Test Pass Rate</td><td>${result.aggregation.tests.passRate}%</td><td>≥ ${result.thresholds.minTestPassRate}%</td></tr>
    <tr><td>Tests Passed</td><td>${result.aggregation.tests.passed}/${result.aggregation.tests.total}</td><td>-</td></tr>
    <tr><td>Tests Failed</td><td>${result.aggregation.tests.failed}</td><td>0</td></tr>
    <tr><td>Critical Findings</td><td>${result.aggregation.findings.critical}</td><td>≤ ${result.thresholds.maxCriticalFindings}</td></tr>
    <tr><td>High Findings</td><td>${result.aggregation.findings.high}</td><td>≤ ${result.thresholds.maxHighFindings}</td></tr>
    ${result.aggregation.coverage !== undefined ? `<tr><td>Coverage</td><td>${result.aggregation.coverage}%</td><td>≥ ${result.thresholds.minCoverage}%</td></tr>` : ''}
  </table>
  
  <h2>Reasons</h2>
  <ul>${reasonsHtml}</ul>
  
  ${suggestionsHtml}
  
  <hr>
  <p class="fingerprint">
    Fingerprint: <code>${result.evidence.fingerprint}</code><br>
    Generated: ${result.evidence.timestamp}<br>
    Duration: ${result.durationMs}ms
  </p>
</body>
</html>`;
}

/**
 * Generate SARIF report for CI/IDE integration
 */
function generateSarifReport(result: AuthoritativeGateResult): object {
  const rules = result.reasons
    .filter((r, i, arr) => arr.findIndex(x => x.code === r.code) === i)
    .map(r => ({
      id: r.code,
      name: r.code.replace(/_/g, ' ').toLowerCase(),
      shortDescription: { text: r.message },
      defaultConfiguration: {
        level: r.severity === 'critical' ? 'error' : 
               r.severity === 'high' ? 'error' :
               r.severity === 'medium' ? 'warning' : 'note',
      },
    }));

  const results = result.reasons.map((r, index) => ({
    ruleId: r.code,
    level: r.severity === 'critical' ? 'error' : 
           r.severity === 'high' ? 'error' :
           r.severity === 'medium' ? 'warning' : 'note',
    message: { text: r.message },
    properties: {
      blocking: r.blocking,
      source: r.source,
    },
  }));

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'ISL Gate',
          version: result.evidence.islVersion,
          informationUri: 'https://github.com/isl-lang/isl',
          rules,
        },
      },
      results,
      invocations: [{
        executionSuccessful: true,
        exitCode: result.exitCode,
        properties: {
          verdict: result.verdict,
          score: result.score,
          confidence: result.confidence,
          fingerprint: result.evidence.fingerprint,
        },
      }],
    }],
  };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
