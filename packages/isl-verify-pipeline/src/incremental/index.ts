/**
 * Incremental verification orchestrator.
 *
 * Coordinates change detection, dependency analysis, caching, and selective
 * verification to only re-verify files that have actually changed or are
 * affected by changes.
 */

import * as path from 'path';
import * as crypto from 'crypto';
import { detectChanges, type ChangedFile, type ChangeDetectorOptions } from './change-detector.js';
import { buildDependencyGraph, getAffectedFiles, type DependencyGraph } from './dependency-graph.js';
import { VerificationCache, type CachedResult, type CachedFinding } from './cache.js';
import type {
  VerificationResult,
  PipelineVerdict,
  ClauseResult,
  UnknownReason,
  EvidenceRef,
} from '../types.js';

// ============================================================================
// Public types
// ============================================================================

export interface IncrementalOptions {
  /** Root directory of the project to verify */
  projectRoot: string;
  /** Directory containing ISL spec files */
  specDir?: string;
  /** Git ref to compare against (default: HEAD~1) */
  baseCommit?: string;
  /** Cache directory (default: .shipgate/cache/incremental) */
  cacheDir?: string;
  /** Force full verification, ignoring the cache */
  force?: boolean;
  /** File globs to include */
  include?: string[];
  /** File globs to exclude */
  exclude?: string[];
}

export interface IncrementalStats {
  totalFiles: number;
  changedFiles: number;
  dependentFiles: number;
  cachedFiles: number;
  verifiedFiles: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface IncrementalVerificationResult {
  /** Merged verification result across all files */
  result: VerificationResult;
  /** Breakdown of what was verified vs cached */
  stats: IncrementalStats;
  /** Which files were actually re-verified this run */
  verifiedPaths: string[];
  /** Which files used cached results */
  cachedPaths: string[];
  /** The full dependency graph built during analysis */
  dependencyGraph: DependencyGraph;
}

// Re-export sub-module types for consumers
export { type ChangedFile, type ChangeDetectorOptions } from './change-detector.js';
export { type DependencyGraph } from './dependency-graph.js';
export { VerificationCache, type CachedResult, type CachedFinding } from './cache.js';
export { detectChanges } from './change-detector.js';
export { buildDependencyGraph, getAffectedFiles } from './dependency-graph.js';

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Run incremental verification:
 *   1. Detect changed files via git
 *   2. Build a dependency graph of the project
 *   3. Compute the transitive set of affected files
 *   4. Look up cached results for unaffected files
 *   5. Run verification only for uncached affected files
 *   6. Update the cache
 *   7. Merge cached + fresh results into a single VerificationResult
 */
export async function runIncrementalVerification(
  options: IncrementalOptions,
  verifyFile: (filePath: string) => Promise<SingleFileResult>,
): Promise<IncrementalVerificationResult> {
  const {
    projectRoot,
    baseCommit,
    cacheDir,
    force = false,
    include,
    exclude,
  } = options;

  const root = path.resolve(projectRoot);
  const cache = new VerificationCache(cacheDir ? path.resolve(cacheDir) : undefined);

  // Step 1: Detect changed files
  const changedFiles = await detectChanges(root, {
    baseRef: baseCommit,
    include,
    exclude,
  });

  const changedPaths = changedFiles
    .filter((f) => f.status !== 'deleted')
    .map((f) => f.path);

  // Step 2: Enumerate all project files for the dependency graph
  const allFiles = await detectChanges(root, {
    baseRef: undefined, // not used when enumerating all
    include,
    exclude,
  });
  const allPaths = allFiles.map((f) => f.path);

  // Step 3: Build dependency graph
  const graph = await buildDependencyGraph(allPaths, root);

  // Step 4: Find affected files (changed + their transitive dependents)
  const affectedPaths = getAffectedFiles(changedPaths, graph);
  const affectedSet = new Set(affectedPaths);

  // Step 5: Partition into cached vs needs-verification
  const fileHashMap = new Map<string, string>();
  for (const f of allFiles) {
    fileHashMap.set(f.path, f.hash);
  }

  const cachedPaths: string[] = [];
  const cachedResults: Map<string, CachedResult> = new Map();
  const toVerify: string[] = [];

  for (const filePath of allPaths) {
    const hash = fileHashMap.get(filePath) ?? '';

    if (force || affectedSet.has(filePath)) {
      toVerify.push(filePath);
    } else {
      const cached = await cache.get(hash);
      if (cached) {
        cachedPaths.push(filePath);
        cachedResults.set(filePath, cached);
      } else {
        toVerify.push(filePath);
      }
    }
  }

  // Step 6: Run verification on uncached affected files
  const freshResults: Map<string, SingleFileResult> = new Map();
  for (const filePath of toVerify) {
    const result = await verifyFile(path.join(root, filePath));
    freshResults.set(filePath, result);

    // Update cache with new result
    const hash = fileHashMap.get(filePath);
    if (hash && hash !== 'deleted' && hash !== 'unreadable') {
      await cache.set(hash, {
        verdict: result.verdict,
        findings: result.findings,
        timestamp: new Date().toISOString(),
        specHash: result.specHash ?? '',
        score: result.score,
      });
    }
  }

  // Step 7: Merge all results
  const merged = mergeResults(freshResults, cachedResults, allPaths);

  const stats: IncrementalStats = {
    totalFiles: allPaths.length,
    changedFiles: changedPaths.length,
    dependentFiles: Math.max(0, affectedPaths.length - changedPaths.length),
    cachedFiles: cachedPaths.length,
    verifiedFiles: toVerify.length,
    cacheHits: cachedPaths.length,
    cacheMisses: toVerify.length,
  };

  return {
    result: merged,
    stats,
    verifiedPaths: toVerify,
    cachedPaths,
    dependencyGraph: graph,
  };
}

// ============================================================================
// Internal types
// ============================================================================

export interface SingleFileResult {
  verdict: PipelineVerdict;
  findings: CachedFinding[];
  score: number;
  clauseResults: ClauseResult[];
  unknownReasons: UnknownReason[];
  evidenceRefs: EvidenceRef[];
  specHash?: string;
  durationMs: number;
}

// ============================================================================
// Result merging
// ============================================================================

function mergeResults(
  fresh: Map<string, SingleFileResult>,
  cached: Map<string, CachedResult>,
  allPaths: string[],
): VerificationResult {
  const allClauseResults: ClauseResult[] = [];
  const allUnknownReasons: UnknownReason[] = [];
  const allEvidenceRefs: EvidenceRef[] = [];
  let totalScore = 0;
  let fileCount = 0;
  let totalDurationMs = 0;

  let hasFailure = false;
  let hasIncomplete = false;

  for (const filePath of allPaths) {
    const freshResult = fresh.get(filePath);
    const cachedResult = cached.get(filePath);

    if (freshResult) {
      allClauseResults.push(...freshResult.clauseResults);
      allUnknownReasons.push(...freshResult.unknownReasons);
      allEvidenceRefs.push(...freshResult.evidenceRefs);
      totalScore += freshResult.score;
      totalDurationMs += freshResult.durationMs;
      fileCount++;

      if (freshResult.verdict === 'FAILED') hasFailure = true;
      if (freshResult.verdict === 'INCOMPLETE_PROOF') hasIncomplete = true;
    } else if (cachedResult) {
      totalScore += cachedResult.score;
      fileCount++;

      if (cachedResult.verdict === 'FAILED') hasFailure = true;
      if (cachedResult.verdict === 'INCOMPLETE_PROOF') hasIncomplete = true;

      for (const f of cachedResult.findings) {
        allClauseResults.push({
          clauseId: f.clauseId,
          status: f.status,
          expression: f.expression ?? '',
          triState: f.status === 'proven' ? true : f.status === 'violated' ? false : 'unknown',
          sourceLocation: undefined as never,
          evidence: [],
        });
      }
    }
  }

  const overallVerdict: PipelineVerdict = hasFailure
    ? 'FAILED'
    : hasIncomplete
      ? 'INCOMPLETE_PROOF'
      : 'PROVEN';

  const summary = {
    totalClauses: allClauseResults.length,
    proven: allClauseResults.filter((c) => c.status === 'proven').length,
    violated: allClauseResults.filter((c) => c.status === 'violated').length,
    unknown: allClauseResults.filter((c) => c.status === 'not_proven').length,
    skipped: allClauseResults.filter((c) => c.status === 'skipped').length,
  };

  const avgScore = fileCount > 0 ? Math.round(totalScore / fileCount) : 0;

  return {
    schemaVersion: '1.0.0',
    runId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    domain: 'incremental',
    version: '1.0.0',
    verdict: overallVerdict,
    verdictReason: buildVerdictReason(overallVerdict, summary),
    score: avgScore,
    clauseResults: allClauseResults,
    unknownReasons: allUnknownReasons,
    evidenceRefs: allEvidenceRefs,
    summary,
    timing: {
      totalMs: totalDurationMs,
    },
    exitCode: overallVerdict === 'PROVEN' ? 0 : overallVerdict === 'FAILED' ? 1 : 2,
  };
}

function buildVerdictReason(
  verdict: PipelineVerdict,
  summary: { proven: number; violated: number; unknown: number },
): string {
  switch (verdict) {
    case 'PROVEN':
      return `All ${summary.proven} clauses proven`;
    case 'FAILED':
      return `${summary.violated} clause(s) violated`;
    case 'INCOMPLETE_PROOF':
      return `${summary.unknown} clause(s) could not be proven`;
  }
}

/**
 * Format incremental stats as a human-readable summary line.
 */
export function formatIncrementalStats(stats: IncrementalStats): string {
  const parts: string[] = [];
  if (stats.changedFiles > 0) parts.push(`${stats.changedFiles} changed`);
  if (stats.dependentFiles > 0) parts.push(`${stats.dependentFiles} dependent`);
  if (stats.cachedFiles > 0) parts.push(`${stats.cachedFiles} cached`);

  return `Verified ${stats.verifiedFiles}/${stats.totalFiles} files (${parts.join(', ')})`;
}
