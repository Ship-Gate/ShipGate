/**
 * Chaos Proof Bundle
 *
 * Produces a self-contained, JSON-serialisable proof artefact that
 * cryptographically ties a chaos verification run to its inputs,
 * outputs, and timeline.  Intended for audit trails, CI gates, and
 * the broader ISL proof-bundle manifest (v2).
 */

import * as crypto from 'crypto';
import type { ChaosReport } from './report.js';
import type { TimelineReport, TimelineEvent } from './timeline.js';

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface ChaosProofBundle {
  /** Bundle format version. */
  version: '1.0.0';
  /** Deterministic bundle ID (SHA-256 of inputs). */
  bundleId: string;
  /** ISO-8601 timestamp. */
  generatedAt: string;
  /** High-level verdict. */
  verdict: ChaosProofVerdict;
  /** Scenario-level evidence. */
  evidence: ChaosProofEvidence[];
  /** Full timeline (JSON timeline output). */
  timeline: ChaosProofTimeline;
  /** Coverage attestation. */
  coverage: ChaosProofCoverage;
  /** Integrity hash over the entire bundle (excluding this field). */
  integrityHash: string;
}

export type ChaosProofVerdict = 'PROVEN' | 'INCOMPLETE_PROOF' | 'FAILED';

export interface ChaosProofEvidence {
  scenarioName: string;
  injectionTypes: string[];
  result: 'pass' | 'fail' | 'skip';
  durationMs: number;
  assertions: ChaosProofAssertion[];
  error?: string;
  timelineSlice: TimelineEvent[];
}

export interface ChaosProofAssertion {
  type: string;
  passed: boolean;
  expected: unknown;
  actual?: unknown;
  message?: string;
}

export interface ChaosProofTimeline {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  injectionCount: number;
  errorCount: number;
  recoveryCount: number;
}

export interface ChaosProofCoverage {
  injectionTypeCoverage: number;
  scenarioCoverage: number;
  behaviorCoverage: number;
  overallCoverage: number;
  coveredInjectionTypes: string[];
  uncoveredInjectionTypes: string[];
}

/* ------------------------------------------------------------------ */
/*  Builder                                                           */
/* ------------------------------------------------------------------ */

export function buildProofBundle(
  report: ChaosReport,
  timeline: TimelineReport,
): ChaosProofBundle {
  const evidence = buildEvidence(report, timeline);
  const proofTimeline = buildTimeline(timeline);
  const coverage = buildCoverage(report);
  const verdict = deriveVerdict(report);

  // Compute deterministic bundle ID from report content
  const bundleId = computeHash(
    JSON.stringify({
      domain: report.domainName,
      scenarios: report.scenarios.map((s) => s.name),
      results: report.summary,
    }),
  );

  // Build the bundle without integrityHash first
  const bundle: ChaosProofBundle = {
    version: '1.0.0',
    bundleId,
    generatedAt: new Date().toISOString(),
    verdict,
    evidence,
    timeline: proofTimeline,
    coverage,
    integrityHash: '',
  };

  // Compute integrity hash over the entire bundle
  bundle.integrityHash = computeHash(
    JSON.stringify(bundle, (key, value) =>
      key === 'integrityHash' ? undefined : value,
    ),
  );

  return bundle;
}

/* ------------------------------------------------------------------ */
/*  Evidence                                                          */
/* ------------------------------------------------------------------ */

function buildEvidence(
  report: ChaosReport,
  timeline: TimelineReport,
): ChaosProofEvidence[] {
  return report.scenarios.map((scenario) => {
    // Slice timeline events relevant to this scenario
    const timelineSlice = timeline.events.filter(
      (evt) =>
        (evt.data as Record<string, unknown>).behavior === scenario.behaviorName ||
        (evt.data as Record<string, unknown>).scenario === scenario.name,
    );

    return {
      scenarioName: scenario.name,
      injectionTypes: scenario.injections.map((i) => i.type),
      result: scenario.passed ? 'pass' : 'fail',
      durationMs: scenario.durationMs,
      assertions: scenario.assertions.map((a) => ({
        type: a.type,
        passed: a.passed,
        expected: a.expected,
        actual: a.actual,
        message: a.message,
      })),
      error: scenario.error?.message,
      timelineSlice,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Timeline                                                          */
/* ------------------------------------------------------------------ */

function buildTimeline(timeline: TimelineReport): ChaosProofTimeline {
  return {
    events: timeline.events,
    startTime: timeline.startTime,
    endTime: timeline.endTime,
    totalDurationMs: timeline.totalDuration,
    injectionCount: timeline.injectionCount,
    errorCount: timeline.errorCount,
    recoveryCount: timeline.recoveryCount,
  };
}

/* ------------------------------------------------------------------ */
/*  Coverage                                                          */
/* ------------------------------------------------------------------ */

function buildCoverage(report: ChaosReport): ChaosProofCoverage {
  const covered = report.coverage.injectionTypes
    .filter((t) => t.covered)
    .map((t) => t.type);
  const uncovered = report.coverage.injectionTypes
    .filter((t) => !t.covered)
    .map((t) => t.type);

  return {
    injectionTypeCoverage: report.coverage.injectionTypeCoverage,
    scenarioCoverage: report.coverage.scenarioCoverage,
    behaviorCoverage: report.coverage.behaviorCoverage,
    overallCoverage: report.coverage.overallCoverage,
    coveredInjectionTypes: covered,
    uncoveredInjectionTypes: uncovered,
  };
}

/* ------------------------------------------------------------------ */
/*  Verdict                                                           */
/* ------------------------------------------------------------------ */

function deriveVerdict(report: ChaosReport): ChaosProofVerdict {
  if (report.summary.failed === 0 && report.summary.skipped === 0) {
    return 'PROVEN';
  }
  if (report.summary.failed === 0 && report.summary.skipped > 0) {
    return 'INCOMPLETE_PROOF';
  }
  return 'FAILED';
}

/* ------------------------------------------------------------------ */
/*  Hashing                                                           */
/* ------------------------------------------------------------------ */

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Serialise a proof bundle to indented JSON.
 */
export function serialiseProofBundle(bundle: ChaosProofBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Verify the integrity of a proof bundle.
 */
export function verifyProofIntegrity(bundle: ChaosProofBundle): boolean {
  const expected = computeHash(
    JSON.stringify(bundle, (key, value) =>
      key === 'integrityHash' ? undefined : value,
    ),
  );
  return expected === bundle.integrityHash;
}
