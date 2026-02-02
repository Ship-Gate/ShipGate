// ============================================================================
// ISL MCP Server - Gate Tool (SHIP/NO-SHIP)
// ============================================================================

import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { parse } from '@isl-lang/parser';
import { check } from '@isl-lang/typechecker';
import { verify } from '@isl-lang/isl-verify';

import type {
  GateInput,
  GateResult,
  GateDecision,
  EvidenceManifest,
  EvidenceResults,
  EvidenceArtifact,
  ClauseResult,
} from './gate-types.js';

import { hashContent, generateFingerprint } from './gate-types.js';

// ISL version for fingerprinting
const ISL_VERSION = '0.1.0';

/**
 * SHIP/NO-SHIP gate - the core decision maker
 * 
 * This is the "moment of truth" for AI-generated code:
 * - Parses and type-checks the spec
 * - Verifies implementation against spec
 * - Generates deterministic evidence bundle
 * - Returns SHIP (exit 0) or NO-SHIP (exit 1)
 */
export async function handleGate(input: GateInput): Promise<GateResult> {
  const {
    spec,
    implementation,
    workspacePath,
    threshold = 95,
    writeBundle = true,
    config = {},
  } = input;

  try {
    // ========================================================================
    // Step 1: Resolve inputs (handle both source code and file paths)
    // ========================================================================
    
    let specSource: string;
    let implSource: string;

    // Resolve spec
    if (spec.includes('domain ') && spec.includes('version ')) {
      specSource = spec;
    } else if (existsSync(spec)) {
      specSource = await readFile(spec, 'utf-8');
    } else {
      return {
        decision: 'NO-SHIP',
        exitCode: 1,
        trustScore: 0,
        confidence: 0,
        summary: 'Failed to read spec: not valid ISL source or file path',
        error: 'INVALID_SPEC',
        suggestion: 'Provide valid ISL source code or a path to a .isl file',
      };
    }

    // Resolve implementation
    if (existsSync(implementation)) {
      const stats = await stat(implementation);
      if (stats.isDirectory()) {
        implSource = await readDirectoryImpl(implementation);
      } else {
        implSource = await readFile(implementation, 'utf-8');
      }
    } else {
      // Assume it's source code
      implSource = implementation;
    }

    // Generate input hashes
    const specHash = hashContent(specSource);
    const implHash = hashContent(implSource);

    // ========================================================================
    // Step 2: Parse and type-check the spec
    // ========================================================================
    
    const parseResult = parse(specSource, 'spec.isl');
    
    if (!parseResult.success || !parseResult.domain) {
      const errors = parseResult.errors?.map(e => e.message).join('; ') ?? 'Parse failed';
      return {
        decision: 'NO-SHIP',
        exitCode: 1,
        trustScore: 0,
        confidence: 100,
        summary: `NO-SHIP: Spec parse error - ${errors}`,
        error: 'PARSE_ERROR',
        suggestion: 'Fix the ISL syntax errors in the spec',
      };
    }

    const domain = parseResult.domain;
    
    // Type check
    const typeResult = check(domain);
    const typeErrors = typeResult.diagnostics.filter(d => d.severity === 'error');
    
    if (typeErrors.length > 0) {
      const errors = typeErrors.map(e => e.message).join('; ');
      return {
        decision: 'NO-SHIP',
        exitCode: 1,
        trustScore: 0,
        confidence: 100,
        summary: `NO-SHIP: Spec type error - ${errors}`,
        error: 'TYPE_ERROR',
        suggestion: 'Fix the type errors in the spec',
      };
    }

    // ========================================================================
    // Step 3: Run verification
    // ========================================================================
    
    let verifyResult;
    try {
      verifyResult = await verify(domain, implSource, {
        runner: { 
          framework: config.framework ?? 'vitest',
          timeout: config.timeout ?? 30000,
        },
      });
    } catch (e) {
      return {
        decision: 'NO-SHIP',
        exitCode: 1,
        trustScore: 0,
        confidence: 50,
        summary: `NO-SHIP: Verification failed to run - ${e instanceof Error ? e.message : 'unknown error'}`,
        error: 'VERIFICATION_ERROR',
        suggestion: 'Check that the implementation is valid TypeScript/JavaScript',
      };
    }

    // ========================================================================
    // Step 4: Build clause-by-clause results
    // ========================================================================
    
    const clauses: ClauseResult[] = [];
    const blockers: EvidenceResults['blockers'] = [];

    // Process verification details
    for (const detail of verifyResult.trustScore.details) {
      const clause: ClauseResult = {
        id: `${detail.category}-${detail.name}`.replace(/\s+/g, '-').toLowerCase(),
        type: mapCategory(detail.category),
        description: detail.name,
        status: detail.status as 'passed' | 'failed' | 'skipped',
        error: detail.message,
        durationMs: (detail as { durationMs?: number }).durationMs,
      };
      clauses.push(clause);

      // Track blockers
      if (detail.status === 'failed') {
        blockers.push({
          clause: detail.name,
          reason: detail.message ?? 'Verification failed',
          severity: detail.impact === 'critical' ? 'critical' : 
                   detail.impact === 'high' ? 'high' : 'medium',
        });
      }
    }

    // ========================================================================
    // Step 5: Calculate scores and make decision
    // ========================================================================
    
    const trustScore = verifyResult.trustScore.overall;
    const confidence = verifyResult.trustScore.confidence;
    const passed = verifyResult.testResult.passed;
    const failed = verifyResult.testResult.failed;
    const skipped = verifyResult.testResult.skipped;
    const total = passed + failed + skipped;

    // Decision logic
    let decision: GateDecision;
    let summary: string;

    if (failed > 0) {
      decision = 'NO-SHIP';
      summary = `NO-SHIP: ${failed} verification${failed > 1 ? 's' : ''} failed. Trust score: ${trustScore}%`;
    } else if (trustScore < threshold) {
      decision = 'NO-SHIP';
      summary = `NO-SHIP: Trust score ${trustScore}% below threshold ${threshold}%`;
    } else if (skipped > 0 && !config.allowSkipped) {
      decision = 'NO-SHIP';
      summary = `NO-SHIP: ${skipped} verification${skipped > 1 ? 's' : ''} skipped. Set allowSkipped: true to proceed.`;
    } else {
      decision = 'SHIP';
      summary = `SHIP: All ${passed} verifications passed. Trust score: ${trustScore}%`;
    }

    // ========================================================================
    // Step 6: Build evidence bundle
    // ========================================================================
    
    const results: EvidenceResults = {
      decision,
      trustScore,
      confidence,
      clauses,
      summary: {
        total,
        passed,
        failed,
        skipped,
      },
      categories: {
        preconditions: verifyResult.trustScore.breakdown.postconditions ?? { passed: 0, failed: 0, total: 0 },
        postconditions: verifyResult.trustScore.breakdown.postconditions ?? { passed: 0, failed: 0, total: 0 },
        invariants: verifyResult.trustScore.breakdown.invariants ?? { passed: 0, failed: 0, total: 0 },
        scenarios: verifyResult.trustScore.breakdown.scenarios ?? { passed: 0, failed: 0, total: 0 },
      },
      blockers,
    };

    const resultsJson = JSON.stringify(results, null, 2);
    const resultsHash = hashContent(resultsJson);
    const fingerprint = generateFingerprint(specHash, implHash, resultsHash, ISL_VERSION);

    const artifacts: EvidenceArtifact[] = [];
    let bundlePath: string | undefined;

    // ========================================================================
    // Step 7: Write evidence bundle (if requested)
    // ========================================================================
    
    if (writeBundle) {
      const root = resolve(workspacePath ?? process.cwd());
      const evidenceDir = join(root, 'evidence');
      const artifactsDir = join(evidenceDir, 'artifacts');
      
      await mkdir(evidenceDir, { recursive: true });
      await mkdir(artifactsDir, { recursive: true });

      // Write spec
      const specPath = join(artifactsDir, 'spec.isl');
      await writeFile(specPath, specSource, 'utf-8');
      artifacts.push({
        type: 'spec',
        path: 'artifacts/spec.isl',
        hash: specHash,
        sizeBytes: Buffer.byteLength(specSource, 'utf-8'),
      });

      // Write results.json
      const resultsPath = join(evidenceDir, 'results.json');
      await writeFile(resultsPath, resultsJson, 'utf-8');
      artifacts.push({
        type: 'report',
        path: 'results.json',
        hash: resultsHash,
        sizeBytes: Buffer.byteLength(resultsJson, 'utf-8'),
      });

      // Write report.html
      const reportHtml = generateHtmlReport(domain.name.name, results, fingerprint);
      const reportPath = join(evidenceDir, 'report.html');
      await writeFile(reportPath, reportHtml, 'utf-8');
      artifacts.push({
        type: 'report',
        path: 'report.html',
        hash: hashContent(reportHtml),
        sizeBytes: Buffer.byteLength(reportHtml, 'utf-8'),
      });

      // Write manifest.json
      const manifest: EvidenceManifest = {
        fingerprint,
        islVersion: ISL_VERSION,
        specHash,
        implHash,
        timestamp: new Date().toISOString(),
        inputs: {
          spec: specHash,
          implementation: implHash,
        },
        artifacts,
      };

      const manifestPath = join(evidenceDir, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      bundlePath = 'evidence/';
    }

    // ========================================================================
    // Step 8: Return result
    // ========================================================================
    
    return {
      decision,
      exitCode: decision === 'SHIP' ? 0 : 1,
      trustScore,
      confidence,
      summary,
      bundlePath,
      manifest: {
        fingerprint,
        islVersion: ISL_VERSION,
        specHash,
        implHash,
        timestamp: new Date().toISOString(),
        inputs: { spec: specHash, implementation: implHash },
        artifacts,
      },
      results,
      suggestion: decision === 'NO-SHIP' 
        ? `Fix the ${blockers.length} blocking issue${blockers.length > 1 ? 's' : ''}: ${blockers.map(b => b.clause).join(', ')}`
        : undefined,
    };
  } catch (error) {
    return {
      decision: 'NO-SHIP',
      exitCode: 1,
      trustScore: 0,
      confidence: 0,
      summary: `NO-SHIP: Internal error - ${error instanceof Error ? error.message : 'unknown'}`,
      error: 'INTERNAL_ERROR',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapCategory(category: string): ClauseResult['type'] {
  switch (category) {
    case 'preconditions': return 'precondition';
    case 'postconditions': return 'postcondition';
    case 'invariants': return 'invariant';
    default: return 'scenario';
  }
}

async function readDirectoryImpl(dirPath: string): Promise<string> {
  const { readdir } = await import('fs/promises');
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.endsWith('.d.ts')) {
        continue;
      }
      const content = await readFile(join(dirPath, entry.name), 'utf-8');
      files.push(`// === ${entry.name} ===\n${content}`);
    }
  }

  return files.join('\n\n');
}

function generateHtmlReport(
  domainName: string,
  results: EvidenceResults,
  fingerprint: string
): string {
  const statusColor = results.decision === 'SHIP' ? '#22c55e' : '#ef4444';
  const statusBg = results.decision === 'SHIP' ? '#dcfce7' : '#fef2f2';
  
  const clauseRows = results.clauses.map(c => {
    const color = c.status === 'passed' ? '#22c55e' : c.status === 'failed' ? '#ef4444' : '#f59e0b';
    const icon = c.status === 'passed' ? '✓' : c.status === 'failed' ? '✗' : '○';
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${icon}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${color}; font-weight: 500;">${c.status.toUpperCase()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${c.error ?? '-'}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISL Gate Report - ${domainName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; background: #f9fafb; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { background: ${statusBg}; border: 2px solid ${statusColor}; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .decision { font-size: 48px; font-weight: 700; color: ${statusColor}; margin: 0; }
    .summary { font-size: 18px; color: #374151; margin-top: 8px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card-title { font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; }
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .score-item { text-align: center; }
    .score-value { font-size: 32px; font-weight: 700; color: #111827; }
    .score-label { font-size: 14px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 8px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151; }
    .fingerprint { font-family: monospace; font-size: 12px; color: #6b7280; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="decision">${results.decision}</h1>
      <p class="summary">${domainName} • Trust Score: ${results.trustScore}% • Confidence: ${results.confidence}%</p>
    </div>

    <div class="card">
      <h2 class="card-title">Summary</h2>
      <div class="score-grid">
        <div class="score-item">
          <div class="score-value">${results.trustScore}%</div>
          <div class="score-label">Trust Score</div>
        </div>
        <div class="score-item">
          <div class="score-value" style="color: #22c55e;">${results.summary.passed}</div>
          <div class="score-label">Passed</div>
        </div>
        <div class="score-item">
          <div class="score-value" style="color: #ef4444;">${results.summary.failed}</div>
          <div class="score-label">Failed</div>
        </div>
        <div class="score-item">
          <div class="score-value" style="color: #f59e0b;">${results.summary.skipped}</div>
          <div class="score-label">Skipped</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Verification Details</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;"></th>
            <th style="width: 80px;">Status</th>
            <th style="width: 120px;">Type</th>
            <th>Description</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${clauseRows}
        </tbody>
      </table>
    </div>

    ${results.blockers.length > 0 ? `
    <div class="card">
      <h2 class="card-title" style="color: #ef4444;">Blocking Issues</h2>
      <ul style="margin: 0; padding-left: 20px;">
        ${results.blockers.map(b => `
          <li style="margin-bottom: 8px;">
            <strong>${b.clause}</strong> (${b.severity}): ${b.reason}
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    <div class="fingerprint">
      Evidence Fingerprint: ${fingerprint} • Generated by ISL Gate v${ISL_VERSION}
    </div>
  </div>
</body>
</html>`;
}
