/**
 * Verified Intent — Provenance Report Builder
 *
 * Builds the provenance report that explicitly answers:
 *   - what was inferred
 *   - what was AI-generated
 *   - what was unknown
 *   - what ran
 *   - what didn't run
 *   - what evidence exists
 *
 * @module @isl-lang/gate/verified-intent/provenance
 */

import type {
  ProvenanceReport,
  ProvenanceRecord,
  PillarResult,
} from './types.js';

// ============================================================================
// Build Provenance Report
// ============================================================================

/**
 * Build a complete ProvenanceReport from all pillar results.
 *
 * Collects every ProvenanceRecord from all three pillars, then partitions
 * into the six output categories.
 */
export function buildProvenanceReport(
  pillarResults: PillarResult[],
): ProvenanceReport {
  // Collect all provenance records from all pillars
  const allRecords: ProvenanceRecord[] = [];
  for (const pr of pillarResults) {
    allRecords.push(...pr.provenance);
  }

  return partitionProvenance(allRecords);
}

/**
 * Partition a flat list of ProvenanceRecords into the six report categories.
 */
export function partitionProvenance(
  records: ProvenanceRecord[],
): ProvenanceReport {
  const inferred: ProvenanceRecord[] = [];
  const aiGenerated: ProvenanceRecord[] = [];
  const unknown: ProvenanceRecord[] = [];
  const ran: ProvenanceRecord[] = [];
  const didNotRun: ProvenanceRecord[] = [];
  const evidence: ProvenanceRecord[] = [];

  for (const r of records) {
    // ── By origin ──────────────────────────────────────────────────────
    switch (r.origin) {
      case 'inferred':
        inferred.push(r);
        break;
      case 'ai-generated':
        aiGenerated.push(r);
        break;
      case 'unknown':
        unknown.push(r);
        break;
      // 'human-authored' goes nowhere special — it's the baseline
    }

    // ── By execution status ────────────────────────────────────────────
    if (r.executionStatus === 'ran') {
      ran.push(r);
    } else {
      didNotRun.push(r);
    }

    // ── Evidence ───────────────────────────────────────────────────────
    if (r.evidenceRef) {
      evidence.push(r);
    }
  }

  return { inferred, aiGenerated, unknown, ran, didNotRun, evidence };
}

// ============================================================================
// Provenance Summary Formatter
// ============================================================================

/**
 * Format a ProvenanceReport as a human-readable multi-line string.
 */
export function formatProvenanceReport(report: ProvenanceReport): string {
  const lines: string[] = [];

  lines.push('═══ Provenance Report ═══');
  lines.push('');

  // ── What was inferred ────────────────────────────────────────────────
  lines.push(`▸ Inferred (${report.inferred.length}):`);
  if (report.inferred.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of report.inferred) {
      lines.push(`  • ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }
  lines.push('');

  // ── What was AI-generated ────────────────────────────────────────────
  lines.push(`▸ AI-Generated (${report.aiGenerated.length}):`);
  if (report.aiGenerated.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of report.aiGenerated) {
      lines.push(`  • ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }
  lines.push('');

  // ── What was unknown ─────────────────────────────────────────────────
  lines.push(`▸ Unknown Origin (${report.unknown.length}):`);
  if (report.unknown.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of report.unknown) {
      lines.push(`  • ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }
  lines.push('');

  // ── What ran ─────────────────────────────────────────────────────────
  lines.push(`▸ Ran (${report.ran.length}):`);
  if (report.ran.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of report.ran) {
      lines.push(`  • ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }
  lines.push('');

  // ── What didn't run ──────────────────────────────────────────────────
  lines.push(`▸ Did Not Run (${report.didNotRun.length}):`);
  if (report.didNotRun.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of report.didNotRun) {
      lines.push(`  • ${r.label} [${r.executionStatus}]${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }
  lines.push('');

  // ── What evidence exists ─────────────────────────────────────────────
  lines.push(`▸ Evidence (${report.evidence.length}):`);
  if (report.evidence.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of report.evidence) {
      lines.push(`  • ${r.label} → ${r.evidenceRef}`);
    }
  }

  return lines.join('\n');
}
