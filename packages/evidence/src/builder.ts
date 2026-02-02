/**
 * Builder Helpers
 *
 * Utility functions for creating evidence reports programmatically.
 */

import type {
  EvidenceReport,
  ClauseResult,
  EvidenceItem,
  ClauseStatus,
  Verdict,
  Assumption,
  OpenQuestion,
  ReproCommand,
  SourceLocation,
} from './types.js';

/**
 * Options for creating a new evidence report
 */
export interface CreateReportOptions {
  contractName: string;
  contractFile?: string;
  verifierVersion?: string;
  gitCommit?: string;
  gitBranch?: string;
  buildId?: string;
}

/**
 * Create a new evidence report
 *
 * @param options - Report configuration
 * @returns A new evidence report with default values
 */
export function createReport(options: CreateReportOptions): EvidenceReport {
  return {
    schemaVersion: '1.0.0',
    verdict: 'NO_SHIP', // Default to NO_SHIP until proven otherwise
    summary: {
      totalClauses: 0,
      passedClauses: 0,
      partialClauses: 0,
      failedClauses: 0,
      passRate: 0,
      totalDurationMs: 0,
    },
    metadata: {
      contractName: options.contractName,
      contractFile: options.contractFile,
      verifierVersion: options.verifierVersion ?? '1.0.0',
      gitCommit: options.gitCommit,
      gitBranch: options.gitBranch,
      buildId: options.buildId,
    },
    clauses: [],
    assumptions: [],
    openQuestions: [],
    reproCommands: [],
  };
}

/**
 * Options for creating a clause result
 */
export interface CreateClauseOptions {
  id: string;
  name: string;
  status: ClauseStatus;
  description?: string;
  durationMs?: number;
  error?: string;
}

/**
 * Create a new clause result
 *
 * @param options - Clause configuration
 * @returns A new clause result
 */
export function createClause(options: CreateClauseOptions): ClauseResult {
  return {
    id: options.id,
    name: options.name,
    status: options.status,
    description: options.description,
    evidence: [],
    durationMs: options.durationMs,
    error: options.error,
  };
}

/**
 * Options for creating an evidence item
 */
export interface CreateEvidenceOptions {
  type: EvidenceItem['type'];
  description: string;
  location?: SourceLocation;
  value?: unknown;
}

/**
 * Create a new evidence item
 *
 * @param options - Evidence configuration
 * @returns A new evidence item
 */
export function createEvidence(options: CreateEvidenceOptions): EvidenceItem {
  return {
    type: options.type,
    description: options.description,
    location: options.location,
    value: options.value,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * Add a clause to a report and update summary
 *
 * @param report - Report to update
 * @param clause - Clause to add
 * @returns Updated report
 */
export function addClause(
  report: EvidenceReport,
  clause: ClauseResult
): EvidenceReport {
  const clauses = [...report.clauses, clause];
  const summary = computeSummary(clauses);
  const verdict = computeVerdict(summary);

  return {
    ...report,
    clauses,
    summary,
    verdict,
  };
}

/**
 * Add an assumption to a report
 *
 * @param report - Report to update
 * @param assumption - Assumption to add
 * @returns Updated report
 */
export function addAssumption(
  report: EvidenceReport,
  assumption: Assumption
): EvidenceReport {
  return {
    ...report,
    assumptions: [...report.assumptions, assumption],
  };
}

/**
 * Add an open question to a report
 *
 * @param report - Report to update
 * @param question - Question to add
 * @returns Updated report
 */
export function addOpenQuestion(
  report: EvidenceReport,
  question: OpenQuestion
): EvidenceReport {
  return {
    ...report,
    openQuestions: [...report.openQuestions, question],
  };
}

/**
 * Add a reproduction command to a report
 *
 * @param report - Report to update
 * @param command - Command to add
 * @returns Updated report
 */
export function addReproCommand(
  report: EvidenceReport,
  command: ReproCommand
): EvidenceReport {
  return {
    ...report,
    reproCommands: [...report.reproCommands, command],
  };
}

/**
 * Compute summary statistics from clauses
 */
function computeSummary(clauses: ClauseResult[]): EvidenceReport['summary'] {
  const totalClauses = clauses.length;
  const passedClauses = clauses.filter((c) => c.status === 'PASS').length;
  const partialClauses = clauses.filter((c) => c.status === 'PARTIAL').length;
  const failedClauses = clauses.filter((c) => c.status === 'FAIL').length;
  const totalDurationMs = clauses.reduce(
    (sum, c) => sum + (c.durationMs ?? 0),
    0
  );

  const passRate =
    totalClauses > 0 ? Math.round((passedClauses / totalClauses) * 100) : 0;

  return {
    totalClauses,
    passedClauses,
    partialClauses,
    failedClauses,
    passRate,
    totalDurationMs,
  };
}

/**
 * Compute verdict from summary
 */
function computeVerdict(summary: EvidenceReport['summary']): Verdict {
  // SHIP only if all clauses pass (no partial or failed)
  if (summary.failedClauses === 0 && summary.partialClauses === 0) {
    return 'SHIP';
  }
  return 'NO_SHIP';
}

/**
 * Finalize a report by computing summary and verdict
 *
 * @param report - Report to finalize
 * @returns Finalized report
 */
export function finalizeReport(report: EvidenceReport): EvidenceReport {
  const summary = computeSummary(report.clauses);
  const verdict = computeVerdict(summary);

  return {
    ...report,
    summary,
    verdict,
  };
}
