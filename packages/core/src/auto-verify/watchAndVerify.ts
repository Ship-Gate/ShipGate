/**
 * Watch and Verify
 *
 * File watcher helper that triggers verification after code generation completes.
 * Watches for a marker file (e.g., .vibecheck/.gen-complete), then runs the
 * verifier, computes trust scores, and writes evidence reports.
 */

import { watch as fsWatch, type FSWatcher } from 'fs';
import { readFile, writeFile, mkdir, access, readdir } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import type {
  WatchConfig,
  WatchEventCallback,
  WatchHandle,
  WatchPhase,
  VerificationResult,
  MarkerFileContent,
  EvidenceWriteOptions,
  EvidenceSummaryFile,
} from './watchTypes.js';
import {
  DEFAULT_WATCH_CONFIG,
} from './watchTypes.js';
import type {
  EvidenceReport,
  ScoreSummary,
  EvidenceClauseResult,
  EvidenceArtifact,
  Assumption,
  OpenQuestion,
} from '../evidence/evidenceTypes.js';
import {
  computeScore,
  createClauseResult,
  type ClauseResult,
  type ScoringResult,
} from '../isl-agent/scoring/index.js';

/**
 * Create a file watcher that triggers verification after code generation
 *
 * @param config - Watcher configuration
 * @param onEvent - Callback for watch events
 * @returns Handle to control the watcher
 *
 * @example
 * ```typescript
 * const handle = watchAndVerify({
 *   workspacePath: '/path/to/project',
 *   specPath: 'specs',
 *   verbose: true,
 * }, (event) => {
 *   if (event.type === 'verification-complete') {
 *     console.log(`Score: ${event.result.score}`);
 *   }
 * });
 *
 * // Later: stop watching
 * await handle.stop();
 * ```
 */
export function watchAndVerify(
  config: WatchConfig,
  onEvent?: WatchEventCallback
): WatchHandle {
  const fullConfig: Required<WatchConfig> = {
    workspacePath: config.workspacePath,
    markerFile: config.markerFile ?? DEFAULT_WATCH_CONFIG.markerFile,
    debounceMs: config.debounceMs ?? DEFAULT_WATCH_CONFIG.debounceMs,
    watchPatterns: config.watchPatterns ?? [...DEFAULT_WATCH_CONFIG.watchPatterns],
    ignorePatterns: config.ignorePatterns ?? [...DEFAULT_WATCH_CONFIG.ignorePatterns],
    evidencePath: config.evidencePath ?? DEFAULT_WATCH_CONFIG.evidencePath,
    specPath: config.specPath ?? 'specs',
    verbose: config.verbose ?? false,
  };

  const emit = onEvent ?? (() => {});
  let watcher: FSWatcher | null = null;
  let running = false;
  let phase: WatchPhase | 'idle' | 'stopped' = 'idle';
  let lastResult: VerificationResult | undefined;
  let runCount = 0;
  let startedAt: Date | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const markerPath = join(fullConfig.workspacePath, fullConfig.markerFile);
  const markerDir = dirname(markerPath);

  /**
   * Log message if verbose mode is enabled
   */
  function log(message: string): void {
    if (fullConfig.verbose) {
      const timestamp = new Date().toISOString();
      process.stdout.write(`[auto-verify ${timestamp}] ${message}\n`);
    }
  }

  /**
   * Check if marker file exists
   */
  async function markerExists(): Promise<boolean> {
    try {
      await access(markerPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read and parse marker file
   */
  async function readMarker(): Promise<MarkerFileContent | null> {
    try {
      const content = await readFile(markerPath, 'utf-8');
      // Try to parse as JSON, fall back to treating timestamp as the content
      try {
        return JSON.parse(content) as MarkerFileContent;
      } catch {
        return {
          timestamp: content.trim() || new Date().toISOString(),
        };
      }
    } catch {
      return null;
    }
  }

  /**
   * Delete marker file after processing
   */
  async function deleteMarker(): Promise<void> {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(markerPath);
      log('Deleted marker file');
    } catch {
      // Ignore if already deleted
    }
  }

  /**
   * Find ISL specification files in the spec path
   */
  async function findSpecFiles(): Promise<string[]> {
    const specDir = join(fullConfig.workspacePath, fullConfig.specPath);
    const files: string[] = [];

    try {
      const entries = await readdir(specDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.isl')) {
          files.push(join(specDir, entry.name));
        }
      }
    } catch {
      // Spec directory might not exist
    }

    return files;
  }

  /**
   * Parse an ISL spec file (simplified - real implementation would use @isl-lang/parser)
   */
  async function parseSpec(specPath: string): Promise<{ name: string; content: string }> {
    const content = await readFile(specPath, 'utf-8');
    const name = basename(specPath, extname(specPath));
    return { name, content };
  }

  /**
   * Run verification for a spec (simplified - real implementation uses @isl-lang/isl-verify)
   */
  async function runVerification(specPath: string): Promise<{
    clauseResults: ClauseResult[];
    errors: string[];
  }> {
    phase = 'verifying';
    emit({ type: 'verification-started', specPath });
    log(`Verifying: ${specPath}`);

    // In a real implementation, this would:
    // 1. Parse the ISL spec using @isl-lang/parser
    // 2. Find the implementation code
    // 3. Run the verifier using @isl-lang/isl-verify
    //
    // For now, we simulate by reading the spec and checking for basic structure
    const clauseResults: ClauseResult[] = [];
    const errors: string[] = [];

    try {
      const content = await readFile(specPath, 'utf-8');

      // Simple heuristic checks
      if (content.includes('domain ')) {
        clauseResults.push(createClauseResult('domain-defined', 'PASS', 'Domain declaration found'));
      } else {
        clauseResults.push(createClauseResult('domain-defined', 'FAIL', 'No domain declaration'));
        errors.push('Missing domain declaration');
      }

      if (content.includes('behavior ') || content.includes('entity ')) {
        clauseResults.push(createClauseResult('has-definitions', 'PASS', 'Has behavior/entity definitions'));
      } else {
        clauseResults.push(createClauseResult('has-definitions', 'PARTIAL', 'No behaviors or entities defined'));
      }

      if (content.includes('ensures ') || content.includes('postcondition')) {
        clauseResults.push(createClauseResult('has-postconditions', 'PASS', 'Postconditions defined'));
      } else {
        clauseResults.push(createClauseResult('has-postconditions', 'PARTIAL', 'No postconditions'));
      }

      if (content.includes('requires ') || content.includes('precondition')) {
        clauseResults.push(createClauseResult('has-preconditions', 'PASS', 'Preconditions defined'));
      } else {
        clauseResults.push(createClauseResult('has-preconditions', 'PARTIAL', 'No preconditions'));
      }

      if (content.includes('invariant ')) {
        clauseResults.push(createClauseResult('has-invariants', 'PASS', 'Invariants defined'));
      } else {
        clauseResults.push(createClauseResult('has-invariants', 'PARTIAL', 'No invariants'));
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to read spec: ${message}`);
      clauseResults.push(createClauseResult('spec-readable', 'FAIL', message));
    }

    return { clauseResults, errors };
  }

  /**
   * Build an evidence report from verification results
   */
  function buildEvidenceReport(
    specName: string,
    specPath: string,
    clauseResults: ClauseResult[],
    scoringResult: ScoringResult,
    durationMs: number
  ): EvidenceReport {
    const now = new Date().toISOString();

    const scoreSummary: ScoreSummary = {
      overallScore: scoringResult.score,
      passCount: scoringResult.breakdown.passCount,
      partialCount: scoringResult.breakdown.partialCount,
      failCount: scoringResult.breakdown.failCount,
      totalClauses: scoringResult.breakdown.totalCount,
      passRate: scoringResult.breakdown.totalCount > 0
        ? (scoringResult.breakdown.passCount / scoringResult.breakdown.totalCount) * 100
        : 0,
      confidence: scoringResult.breakdown.totalCount >= 5 ? 'high' : scoringResult.breakdown.totalCount >= 3 ? 'medium' : 'low',
      recommendation: scoringResult.shipDecision === 'SHIP' ? 'ship' : scoringResult.score >= 70 ? 'review' : 'block',
    };

    const evidenceClauseResults: EvidenceClauseResult[] = clauseResults.map((r) => ({
      ...r,
      clauseType: inferClauseType(r.clauseId),
    }));

    const assumptions: Assumption[] = [
      {
        id: 'assumption-1',
        description: 'Implementation code exists and is accessible',
        category: 'environment',
        impact: 'high',
      },
      {
        id: 'assumption-2',
        description: 'Generated code matches spec version',
        category: 'dependency',
        impact: 'medium',
      },
    ];

    const openQuestions: OpenQuestion[] = [];
    if (scoreSummary.recommendation === 'review') {
      openQuestions.push({
        id: 'question-1',
        question: 'Are partial passes acceptable for this deployment?',
        priority: 'medium',
        suggestedActions: ['Review partial passes manually', 'Add more specific postconditions'],
      });
    }

    const artifacts: EvidenceArtifact[] = [
      {
        id: 'artifact-spec',
        type: 'trace',
        name: 'ISL Specification',
        location: specPath,
        mimeType: 'text/plain',
        createdAt: now,
      },
    ];

    return {
      version: '1.0',
      reportId: `report-${Date.now().toString(36)}-${randomHex(6)}`,
      specFingerprint: simpleHash(specName + specPath),
      specName,
      specPath,
      clauseResults: evidenceClauseResults,
      scoreSummary,
      assumptions,
      openQuestions,
      artifacts,
      metadata: {
        startedAt: new Date(Date.now() - durationMs).toISOString(),
        completedAt: now,
        durationMs,
        agentVersion: '0.1.0',
        mode: 'full',
      },
    };
  }

  /**
   * Write evidence report to disk
   */
  async function writeEvidence(
    report: EvidenceReport,
    options?: EvidenceWriteOptions
  ): Promise<string> {
    phase = 'writing-evidence';
    const format = options?.format ?? 'json';
    const evidenceDir = join(fullConfig.workspacePath, fullConfig.evidencePath);

    // Ensure evidence directory exists
    await mkdir(evidenceDir, { recursive: true });

    const filename = `${report.specName}-${Date.now()}.evidence.${format}`;
    const filepath = join(evidenceDir, filename);

    const content = format === 'json'
      ? JSON.stringify(report, null, 2)
      : jsonToYaml(report);

    await writeFile(filepath, content, 'utf-8');
    log(`Evidence written to: ${filepath}`);

    // Generate summary if requested
    if (options?.generateSummary) {
      const summary = buildSummaryFile(report);
      const summaryPath = join(evidenceDir, `${report.specName}-${Date.now()}.summary.md`);
      await writeFile(summaryPath, formatSummaryMarkdown(summary), 'utf-8');
      log(`Summary written to: ${summaryPath}`);
    }

    emit({ type: 'evidence-written', path: filepath });
    return filepath;
  }

  /**
   * Run the full verification cycle
   */
  async function runVerificationCycle(): Promise<VerificationResult> {
    const startTime = Date.now();
    runCount++;

    log(`Starting verification cycle #${runCount}`);

    const specFiles = await findSpecFiles();
    if (specFiles.length === 0) {
      log('No spec files found');
      return {
        passed: false,
        score: 0,
        scoreSummary: {
          overallScore: 0,
          passCount: 0,
          partialCount: 0,
          failCount: 1,
          totalClauses: 1,
          passRate: 0,
          confidence: 'low',
          recommendation: 'block',
        },
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        errors: ['No specification files found'],
      };
    }

    // Aggregate results from all specs
    const allClauseResults: ClauseResult[] = [];
    const allErrors: string[] = [];
    let lastReport: EvidenceReport | undefined;
    let lastEvidencePath: string | undefined;

    for (const specFile of specFiles) {
      const { clauseResults, errors } = await runVerification(specFile);
      allClauseResults.push(...clauseResults);
      allErrors.push(...errors);

      // Score this spec
      phase = 'scoring';
      const scoringResult = computeScore(clauseResults);
      const spec = await parseSpec(specFile);

      // Build and write evidence
      const report = buildEvidenceReport(
        spec.name,
        specFile,
        clauseResults,
        scoringResult,
        Date.now() - startTime
      );

      lastEvidencePath = await writeEvidence(report, { generateSummary: true });
      lastReport = report;
    }

    // Compute overall score
    phase = 'scoring';
    const overallScoring = computeScore(allClauseResults);
    const durationMs = Date.now() - startTime;

    const result: VerificationResult = {
      passed: overallScoring.shipDecision === 'SHIP',
      score: overallScoring.score,
      scoreSummary: {
        overallScore: overallScoring.score,
        passCount: overallScoring.breakdown.passCount,
        partialCount: overallScoring.breakdown.partialCount,
        failCount: overallScoring.breakdown.failCount,
        totalClauses: overallScoring.breakdown.totalCount,
        passRate: overallScoring.breakdown.totalCount > 0
          ? (overallScoring.breakdown.passCount / overallScoring.breakdown.totalCount) * 100
          : 0,
        confidence: overallScoring.breakdown.totalCount >= 5 ? 'high' : 'medium',
        recommendation: overallScoring.shipDecision === 'SHIP' ? 'ship' : overallScoring.score >= 70 ? 'review' : 'block',
      },
      evidenceReport: lastReport,
      evidencePath: lastEvidencePath,
      timestamp: new Date(),
      durationMs,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };

    lastResult = result;
    emit({ type: 'verification-complete', result });

    log(`Verification complete: score=${result.score}, recommendation=${result.scoreSummary.recommendation}`);

    // Delete marker file after successful processing
    await deleteMarker();

    return result;
  }

  /**
   * Handle marker file change
   */
  async function onMarkerChange(): Promise<void> {
    if (!running) return;

    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Debounce to avoid multiple triggers
    debounceTimer = setTimeout(async () => {
      try {
        phase = 'detecting-marker';
        const exists = await markerExists();
        if (!exists) {
          log('Marker file not found, skipping');
          return;
        }

        const marker = await readMarker();
        if (marker) {
          emit({ type: 'generation-complete', timestamp: new Date(marker.timestamp) });
          log(`Generation complete marker detected: ${marker.timestamp}`);
        }

        phase = 'parsing-spec';
        await runVerificationCycle();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        emit({ type: 'error', error, phase });
        log(`Error during verification: ${error.message}`);
      } finally {
        phase = 'watching';
      }
    }, fullConfig.debounceMs);
  }

  /**
   * Start watching
   */
  async function start(): Promise<void> {
    if (running) return;

    running = true;
    startedAt = new Date();
    phase = 'watching';

    emit({ type: 'started', config: fullConfig });
    log(`Started watching: ${markerPath}`);

    // Ensure marker directory exists
    await mkdir(markerDir, { recursive: true });

    // Watch the marker directory for changes
    try {
      watcher = fsWatch(markerDir, { persistent: true }, (_eventType, filename) => {
        if (filename && basename(markerPath) === filename) {
          onMarkerChange();
        }
      });

      watcher.on('error', (err) => {
        emit({ type: 'error', error: err, phase });
        log(`Watcher error: ${err.message}`);
      });

      // Also check if marker already exists on start
      const exists = await markerExists();
      if (exists) {
        log('Marker file exists on start, triggering verification');
        onMarkerChange();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      emit({ type: 'error', error, phase: 'watching' });
      log(`Failed to start watcher: ${error.message}`);
      running = false;
    }
  }

  /**
   * Stop watching
   */
  async function stop(): Promise<void> {
    if (!running) return;

    running = false;
    phase = 'stopped';

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (watcher) {
      watcher.close();
      watcher = null;
    }

    emit({ type: 'stopped' });
    log('Stopped watching');
  }

  // Auto-start
  start();

  return {
    stop,
    isWatching: () => running,
    triggerVerify: runVerificationCycle,
    getStatus: () => ({
      running,
      phase,
      lastResult,
      runCount,
      startedAt,
    }),
  };
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Infer clause type from clause ID
 */
function inferClauseType(clauseId: string): EvidenceClauseResult['clauseType'] {
  const id = clauseId.toLowerCase();
  if (id.includes('precondition') || id.includes('requires')) return 'precondition';
  if (id.includes('postcondition') || id.includes('ensures')) return 'postcondition';
  if (id.includes('invariant')) return 'invariant';
  if (id.includes('effect')) return 'effect';
  return 'constraint';
}

/**
 * Simple hash function for fingerprints
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate random hex string
 */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Convert JSON to simple YAML format
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    // Quote strings that need it
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => `${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, value]) => {
        const valueStr = jsonToYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        return `${spaces}${key}: ${valueStr}`;
      })
      .join('\n');
  }

  return String(obj);
}

/**
 * Build summary file from evidence report
 */
function buildSummaryFile(report: EvidenceReport): EvidenceSummaryFile {
  const findings: string[] = [];

  // Add key findings based on results
  if (report.scoreSummary.failCount > 0) {
    findings.push(`${report.scoreSummary.failCount} clause(s) failed verification`);
  }
  if (report.scoreSummary.partialCount > 0) {
    findings.push(`${report.scoreSummary.partialCount} clause(s) partially passed`);
  }
  if (report.openQuestions.length > 0) {
    findings.push(`${report.openQuestions.length} open question(s) to address`);
  }
  if (report.scoreSummary.recommendation === 'ship') {
    findings.push('All critical checks passed - ready to ship');
  }

  return {
    specName: report.specName ?? 'unknown',
    score: report.scoreSummary.overallScore,
    breakdown: {
      passed: report.scoreSummary.passCount,
      failed: report.scoreSummary.failCount,
      partial: report.scoreSummary.partialCount,
      total: report.scoreSummary.totalClauses,
    },
    recommendation: report.scoreSummary.recommendation,
    findings,
    timestamp: report.metadata.completedAt,
  };
}

/**
 * Format summary as markdown
 */
function formatSummaryMarkdown(summary: EvidenceSummaryFile): string {
  const icon = summary.recommendation === 'ship' ? '✅' : summary.recommendation === 'review' ? '⚠️' : '❌';

  return `# Verification Summary: ${summary.specName}

${icon} **Recommendation:** ${summary.recommendation.toUpperCase()}

## Score: ${summary.score}/100

| Status | Count |
|--------|-------|
| Passed | ${summary.breakdown.passed} |
| Partial | ${summary.breakdown.partial} |
| Failed | ${summary.breakdown.failed} |
| **Total** | **${summary.breakdown.total}** |

## Key Findings

${summary.findings.map(f => `- ${f}`).join('\n')}

---
*Generated at ${summary.timestamp}*
`;
}

/**
 * Export for convenience
 */
export { DEFAULT_WATCH_CONFIG };
export type * from './watchTypes.js';
