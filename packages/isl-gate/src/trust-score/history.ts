/**
 * Trust Score History & Delta Detection
 *
 * Tracks trust scores over time and detects regressions / improvements
 * between consecutive runs. History is stored as a local JSON file.
 *
 * @module @isl-lang/gate/trust-score/history
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

import type {
  TrustCategory,
  TrustScoreResult,
  TrustHistoryEntry,
  TrustDelta,
  TrustHistory,
  ResolvedTrustConfig,
  EvidenceSource,
} from './types.js';

import { TRUST_CATEGORIES } from './types.js';
import { computeProjectFingerprint } from './fingerprint.js';

// ============================================================================
// History I/O
// ============================================================================

/**
 * Load trust history from disk.
 * Returns an empty history if the file does not exist.
 */
export async function loadHistory(historyPath: string): Promise<TrustHistory> {
  try {
    const raw = await readFile(historyPath, 'utf-8');
    const parsed = JSON.parse(raw) as TrustHistory;

    if (parsed.version !== 1) {
      return createEmptyHistory();
    }

    return parsed;
  } catch {
    return createEmptyHistory();
  }
}

/**
 * Save trust history to disk.
 * Creates parent directories if needed.
 */
export async function saveHistory(
  historyPath: string,
  history: TrustHistory,
): Promise<void> {
  await mkdir(dirname(historyPath), { recursive: true });
  const json = JSON.stringify(history, null, 2);
  await writeFile(historyPath, json, 'utf-8');
}

/**
 * Create a new empty history object.
 */
export function createEmptyHistory(projectFingerprint?: string): TrustHistory {
  return {
    version: 1,
    entries: [],
    lastUpdated: new Date().toISOString(),
    projectFingerprint,
  };
}

// ============================================================================
// History Updates
// ============================================================================

/**
 * Record a new trust score result into history.
 * Trims entries beyond maxHistoryEntries.
 * Filters to same project fingerprint.
 */
export function recordEntry(
  history: TrustHistory,
  result: TrustScoreResult,
  config: ResolvedTrustConfig,
  commitHash?: string,
  projectFingerprint?: string,
): TrustHistory {
  const categoryScores = {} as Record<TrustCategory, number>;
  for (const cs of result.categories) {
    categoryScores[cs.category] = cs.score;
  }

  // Count evidence by source (if available in clauses)
  // This is a simplified version - in practice, clauses would need to be passed
  const evidenceBreakdown = {
    smt: 0,
    runtime: 0,
    heuristic: 0,
  };

  const entry: TrustHistoryEntry = {
    score: result.score,
    verdict: result.verdict,
    categoryScores,
    timestamp: result.timestamp,
    specFile: result.config.historyPath,
    commitHash,
    projectFingerprint,
    counts: { ...result.counts },
    evidenceBreakdown,
  };

  // Filter existing entries to same project fingerprint
  const existingEntries = projectFingerprint
    ? history.entries.filter(e => e.projectFingerprint === projectFingerprint)
    : history.entries;

  // Newest first
  const entries = [entry, ...existingEntries].slice(0, config.maxHistoryEntries);

  return {
    version: 1,
    entries,
    lastUpdated: new Date().toISOString(),
    projectFingerprint: projectFingerprint ?? history.projectFingerprint,
  };
}

// ============================================================================
// Delta Detection
// ============================================================================

/**
 * Compute the delta between the current result and the most recent
 * history entry. Returns undefined if there is no previous entry.
 */
export function computeDelta(
  current: TrustScoreResult,
  history: TrustHistory,
): TrustDelta | undefined {
  if (history.entries.length === 0) {
    return undefined;
  }

  const previous = history.entries[0];
  return computeDeltaBetween(current, previous);
}

/**
 * Compute delta between a result and a specific history entry.
 */
export function computeDeltaBetween(
  current: TrustScoreResult,
  previous: TrustHistoryEntry,
): TrustDelta {
  const scoreDelta = current.score - previous.score;
  const verdictChanged = current.verdict !== previous.verdict;

  const categoryDeltas = {} as Record<TrustCategory, number>;
  const improved: TrustCategory[] = [];
  const regressed: TrustCategory[] = [];
  const unchanged: TrustCategory[] = [];

  for (const cat of TRUST_CATEGORIES) {
    const currentScore = current.categories.find(c => c.category === cat)?.score ?? 0;
    const previousScore = previous.categoryScores[cat] ?? 0;
    const delta = currentScore - previousScore;

    categoryDeltas[cat] = delta;

    if (delta > 0) {
      improved.push(cat);
    } else if (delta < 0) {
      regressed.push(cat);
    } else {
      unchanged.push(cat);
    }
  }

  const summary = buildDeltaSummary(scoreDelta, verdictChanged, current.verdict, previous.verdict, improved, regressed);

  return {
    scoreDelta,
    verdictChanged,
    previousVerdict: verdictChanged ? previous.verdict : undefined,
    categoryDeltas,
    improved,
    regressed,
    unchanged,
    summary,
  };
}

// ============================================================================
// Trend Analysis
// ============================================================================

/**
 * Compute a simple trend direction from the last N entries.
 * Returns 'improving', 'declining', or 'stable'.
 */
export function computeTrend(
  history: TrustHistory,
  windowSize: number = 5,
): 'improving' | 'declining' | 'stable' {
  const entries = history.entries.slice(0, windowSize);

  if (entries.length < 2) {
    return 'stable';
  }

  // Simple linear regression on scores (entries are newest-first)
  const scores = entries.map(e => e.score).reverse(); // oldest-first for regression
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (scores[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (denominator === 0) return 'stable';

  const slope = numerator / denominator;

  // Threshold: slope > 1 point per run = improving, < -1 = declining
  if (slope > 1) return 'improving';
  if (slope < -1) return 'declining';
  return 'stable';
}

// ============================================================================
// Helpers
// ============================================================================

function buildDeltaSummary(
  scoreDelta: number,
  verdictChanged: boolean,
  currentVerdict: string,
  previousVerdict: string,
  improved: TrustCategory[],
  regressed: TrustCategory[],
): string {
  const parts: string[] = [];

  if (scoreDelta === 0) {
    parts.push('Trust score unchanged');
  } else if (scoreDelta > 0) {
    parts.push(`Trust score improved by +${scoreDelta} points`);
  } else {
    parts.push(`Trust score regressed by ${scoreDelta} points`);
  }

  if (verdictChanged) {
    parts.push(`Verdict changed: ${previousVerdict} -> ${currentVerdict}`);
  }

  if (improved.length > 0) {
    parts.push(`Improved: ${improved.join(', ')}`);
  }

  if (regressed.length > 0) {
    parts.push(`Regressed: ${regressed.join(', ')}`);
  }

  return parts.join('. ');
}
