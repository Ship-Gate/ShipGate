/**
 * Canonical Serialization
 *
 * Provides stable, deterministic serialization of evidence reports.
 * Ensures identical reports produce identical JSON output for:
 * - Content-addressable storage
 * - Caching and deduplication
 * - Consistent hashing
 * - Reproducible snapshots
 */

import type { EvidenceReport } from './types.js';

/**
 * Sort object keys recursively for stable serialization
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}

/**
 * Serialize evidence report to canonical JSON
 *
 * Guarantees:
 * - Keys are sorted alphabetically
 * - No trailing whitespace
 * - Consistent indentation (2 spaces)
 * - No BOM or special characters
 * - Arrays maintain original order (they are semantically ordered)
 *
 * @param report - Evidence report to serialize
 * @param options - Serialization options
 * @returns Canonical JSON string
 */
export function serialize(
  report: EvidenceReport,
  options: SerializeOptions = {}
): string {
  const { pretty = true, indent = 2 } = options;

  // Sort all object keys for deterministic output
  const normalized = sortObjectKeys(report);

  // Serialize with consistent formatting
  if (pretty) {
    return JSON.stringify(normalized, null, indent);
  }

  return JSON.stringify(normalized);
}

/**
 * Options for serialization
 */
export interface SerializeOptions {
  /** Whether to pretty-print the output (default: true) */
  pretty?: boolean;
  /** Number of spaces for indentation (default: 2) */
  indent?: number;
}

/**
 * Deserialize JSON to evidence report
 *
 * @param json - JSON string to parse
 * @returns Parsed evidence report
 * @throws SyntaxError if JSON is invalid
 */
export function deserialize(json: string): EvidenceReport {
  return JSON.parse(json) as EvidenceReport;
}

/**
 * Compute a stable hash of an evidence report
 *
 * Uses canonical serialization to ensure identical reports
 * produce identical hashes.
 *
 * @param report - Evidence report to hash
 * @returns Hex-encoded hash string
 */
export async function computeHash(report: EvidenceReport): Promise<string> {
  const canonical = serialize(report, { pretty: false });
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);

  // Use SubtleCrypto for SHA-256 (available in Node.js and browsers)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare two evidence reports for equality
 *
 * Uses canonical serialization to compare reports,
 * ignoring property order differences.
 *
 * @param a - First report
 * @param b - Second report
 * @returns True if reports are semantically equal
 */
export function areEqual(a: EvidenceReport, b: EvidenceReport): boolean {
  const serializedA = serialize(a, { pretty: false });
  const serializedB = serialize(b, { pretty: false });
  return serializedA === serializedB;
}

/**
 * Create a diff-friendly representation of changes between reports
 *
 * @param before - Original report
 * @param after - Modified report
 * @returns Object describing the differences
 */
export function diff(
  before: EvidenceReport,
  after: EvidenceReport
): ReportDiff {
  const changes: ReportDiff = {
    verdictChanged: before.verdict !== after.verdict,
    clauseChanges: [],
    summaryChanges: {},
  };

  // Track clause changes
  const beforeClauses = new Map(before.clauses.map((c) => [c.id, c]));
  const afterClauses = new Map(after.clauses.map((c) => [c.id, c]));

  // Find added, removed, and modified clauses
  for (const [id, clause] of afterClauses) {
    const beforeClause = beforeClauses.get(id);
    if (!beforeClause) {
      changes.clauseChanges.push({ id, type: 'added', after: clause });
    } else if (beforeClause.status !== clause.status) {
      changes.clauseChanges.push({
        id,
        type: 'modified',
        before: beforeClause,
        after: clause,
      });
    }
  }

  for (const [id, clause] of beforeClauses) {
    if (!afterClauses.has(id)) {
      changes.clauseChanges.push({ id, type: 'removed', before: clause });
    }
  }

  // Track summary changes
  if (before.summary.passRate !== after.summary.passRate) {
    changes.summaryChanges.passRate = {
      before: before.summary.passRate,
      after: after.summary.passRate,
    };
  }

  return changes;
}

/**
 * Represents differences between two evidence reports
 */
export interface ReportDiff {
  verdictChanged: boolean;
  clauseChanges: ClauseChange[];
  summaryChanges: {
    passRate?: { before: number; after: number };
  };
}

/**
 * Represents a change to a single clause
 */
export interface ClauseChange {
  id: string;
  type: 'added' | 'removed' | 'modified';
  before?: { status: string };
  after?: { status: string };
}

/**
 * Strip timestamps from evidence report for snapshot testing
 *
 * Removes all timestamp fields to allow deterministic comparisons.
 *
 * @param report - Evidence report to strip
 * @returns Report without timestamps
 */
export function stripTimestamps(report: EvidenceReport): EvidenceReport {
  return {
    ...report,
    clauses: report.clauses.map((clause) => ({
      ...clause,
      evidence: clause.evidence.map((item) => {
        const { collectedAt, ...rest } = item;
        return rest;
      }),
    })),
  };
}
