/**
 * Verified Intent — Pillar Evaluators
 *
 * Evaluates each of the three pillars:
 *   1. Spec Fidelity  — signatures + types match source
 *   2. Coverage        — postconditions/invariants/error cases present
 *   3. Execution       — tests ran (not skipped), results attributable to spec
 *
 * @module @isl-lang/gate/verified-intent/pillars
 */

import type {
  PillarResult,
  PillarDetail,
  ProvenanceRecord,
  ProvenanceOrigin,
  ExecutionStatus,
  VerifiedIntentConfig,
} from './types.js';

import type {
  VerificationSignal,
  AggregatedSignals,
} from '../authoritative/types.js';

import type { GateEvidence } from '../authoritative/verdict-engine.js';

// ============================================================================
// Pillar 1: Spec Fidelity
// ============================================================================

/**
 * Input data for spec fidelity evaluation.
 */
export interface SpecFidelityInput {
  /** Did the spec parse successfully? */
  specParsed: boolean;
  /** Did the spec typecheck? */
  specTypechecked: boolean;
  /** Total signatures declared in spec */
  specSignatureCount: number;
  /** Signatures that matched source */
  matchedSignatureCount: number;
  /** Total types declared in spec */
  specTypeCount: number;
  /** Types that matched source */
  matchedTypeCount: number;
  /** Was the spec AI-generated? */
  specOrigin: ProvenanceOrigin;
  /** Was the implementation AI-generated? */
  implOrigin: ProvenanceOrigin;
}

/**
 * Evaluate Pillar 1: Spec Fidelity.
 *
 * Checks that signatures + types in the spec match the source implementation.
 */
export function evaluateSpecFidelity(
  input: SpecFidelityInput,
  config: VerifiedIntentConfig,
): PillarResult {
  const details: PillarDetail[] = [];
  const provenance: ProvenanceRecord[] = [];

  // ── Parse check ──────────────────────────────────────────────────────
  details.push({
    check: 'spec_parsed',
    passed: input.specParsed,
    message: input.specParsed ? 'Spec parsed successfully' : 'Spec failed to parse',
    origin: input.specOrigin,
    executionStatus: 'ran',
  });

  provenance.push({
    label: 'ISL spec',
    origin: input.specOrigin,
    executionStatus: input.specParsed ? 'ran' : 'errored',
    detail: input.specOrigin === 'ai-generated' ? 'Spec was AI-generated' : undefined,
  });

  if (!input.specParsed) {
    return {
      pillar: 'spec_fidelity',
      status: 'failed',
      score: 0,
      summary: 'Spec Fidelity: FAILED — spec did not parse',
      details,
      provenance,
    };
  }

  // ── Typecheck ────────────────────────────────────────────────────────
  details.push({
    check: 'spec_typechecked',
    passed: input.specTypechecked,
    message: input.specTypechecked ? 'Spec typechecked' : 'Spec has type errors',
    origin: input.specOrigin,
    executionStatus: 'ran',
  });

  if (!input.specTypechecked) {
    return {
      pillar: 'spec_fidelity',
      status: 'failed',
      score: 0.1,
      summary: 'Spec Fidelity: FAILED — spec has type errors',
      details,
      provenance,
    };
  }

  // ── Signature match ──────────────────────────────────────────────────
  const sigRatio = input.specSignatureCount > 0
    ? input.matchedSignatureCount / input.specSignatureCount
    : 0;
  const sigPassed = sigRatio >= config.specFidelity.minSignatureMatch;

  details.push({
    check: 'signature_match',
    passed: sigPassed,
    message: `Signature match: ${input.matchedSignatureCount}/${input.specSignatureCount} (${pct(sigRatio)}, threshold ${pct(config.specFidelity.minSignatureMatch)})`,
    origin: input.implOrigin,
    executionStatus: 'ran',
  });

  provenance.push({
    label: 'Signature matching',
    origin: 'inferred',
    executionStatus: 'ran',
    detail: `${input.matchedSignatureCount}/${input.specSignatureCount} matched`,
  });

  // ── Type match ───────────────────────────────────────────────────────
  const typeRatio = input.specTypeCount > 0
    ? input.matchedTypeCount / input.specTypeCount
    : 0;
  const typePassed = typeRatio >= config.specFidelity.minTypeMatch;

  details.push({
    check: 'type_match',
    passed: typePassed,
    message: `Type match: ${input.matchedTypeCount}/${input.specTypeCount} (${pct(typeRatio)}, threshold ${pct(config.specFidelity.minTypeMatch)})`,
    origin: input.implOrigin,
    executionStatus: 'ran',
  });

  provenance.push({
    label: 'Type matching',
    origin: 'inferred',
    executionStatus: 'ran',
    detail: `${input.matchedTypeCount}/${input.specTypeCount} matched`,
  });

  // ── Compute pillar score ─────────────────────────────────────────────
  const score = (sigRatio + typeRatio) / 2;
  const allPassed = sigPassed && typePassed;
  const status = allPassed ? 'passed' : sigRatio > 0 || typeRatio > 0 ? 'degraded' : 'failed';

  return {
    pillar: 'spec_fidelity',
    status,
    score,
    summary: `Spec Fidelity: ${status.toUpperCase()} — signatures ${pct(sigRatio)}, types ${pct(typeRatio)}`,
    details,
    provenance,
  };
}

// ============================================================================
// Pillar 2: Coverage
// ============================================================================

/**
 * Input data for coverage evaluation.
 */
export interface CoverageInput {
  /** Number of postconditions declared in spec */
  postconditionCount: number;
  /** Number of postconditions verified/checked */
  postconditionsVerified: number;
  /** Number of invariants declared in spec */
  invariantCount: number;
  /** Number of invariants verified/checked */
  invariantsVerified: number;
  /** Number of error/exception cases declared */
  errorCaseCount: number;
  /** Number of error cases verified/checked */
  errorCasesVerified: number;
  /** Total checkable clauses */
  totalClauses: number;
  /** Clauses that have verification evidence */
  coveredClauses: number;
  /** Provenance of the spec containing these clauses */
  specOrigin: ProvenanceOrigin;
}

/**
 * Evaluate Pillar 2: Coverage.
 *
 * Checks that postconditions, invariants, and error cases are present
 * at minimum thresholds.
 */
export function evaluateCoverage(
  input: CoverageInput,
  config: VerifiedIntentConfig,
): PillarResult {
  const details: PillarDetail[] = [];
  const provenance: ProvenanceRecord[] = [];

  // ── Postconditions ───────────────────────────────────────────────────
  const postOk = input.postconditionCount >= config.coverage.minPostconditions;
  details.push({
    check: 'postconditions_present',
    passed: postOk,
    message: postOk
      ? `Postconditions: ${input.postconditionCount} present (min ${config.coverage.minPostconditions})`
      : `Postconditions: ${input.postconditionCount} present, need at least ${config.coverage.minPostconditions}`,
    origin: input.specOrigin,
    executionStatus: input.postconditionCount > 0 ? 'ran' : 'not_run',
  });

  if (input.postconditionCount > 0) {
    provenance.push({
      label: `${input.postconditionCount} postcondition(s)`,
      origin: input.specOrigin,
      executionStatus: input.postconditionsVerified > 0 ? 'ran' : 'not_run',
      detail: `${input.postconditionsVerified}/${input.postconditionCount} verified`,
    });
  }

  // ── Invariants ───────────────────────────────────────────────────────
  const invOk = input.invariantCount >= config.coverage.minInvariants;
  details.push({
    check: 'invariants_present',
    passed: invOk,
    message: invOk
      ? `Invariants: ${input.invariantCount} present (min ${config.coverage.minInvariants})`
      : `Invariants: ${input.invariantCount} present, need at least ${config.coverage.minInvariants}`,
    origin: input.specOrigin,
    executionStatus: input.invariantCount > 0 ? 'ran' : 'not_run',
  });

  if (input.invariantCount > 0) {
    provenance.push({
      label: `${input.invariantCount} invariant(s)`,
      origin: input.specOrigin,
      executionStatus: input.invariantsVerified > 0 ? 'ran' : 'not_run',
      detail: `${input.invariantsVerified}/${input.invariantCount} verified`,
    });
  }

  // ── Error cases ──────────────────────────────────────────────────────
  const errOk = input.errorCaseCount >= config.coverage.minErrorCases;
  details.push({
    check: 'error_cases_present',
    passed: errOk,
    message: errOk
      ? `Error cases: ${input.errorCaseCount} present (min ${config.coverage.minErrorCases})`
      : `Error cases: ${input.errorCaseCount} present, need at least ${config.coverage.minErrorCases}`,
    origin: input.specOrigin,
    executionStatus: input.errorCaseCount > 0 ? 'ran' : 'not_run',
  });

  if (input.errorCaseCount > 0) {
    provenance.push({
      label: `${input.errorCaseCount} error case(s)`,
      origin: input.specOrigin,
      executionStatus: input.errorCasesVerified > 0 ? 'ran' : 'not_run',
      detail: `${input.errorCasesVerified}/${input.errorCaseCount} verified`,
    });
  }

  // ── Overall coverage ratio ───────────────────────────────────────────
  const coverageRatio = input.totalClauses > 0
    ? input.coveredClauses / input.totalClauses
    : 0;
  const coverageOk = coverageRatio >= config.coverage.minCoverageRatio;

  details.push({
    check: 'coverage_ratio',
    passed: coverageOk,
    message: `Coverage ratio: ${input.coveredClauses}/${input.totalClauses} (${pct(coverageRatio)}, threshold ${pct(config.coverage.minCoverageRatio)})`,
    origin: 'inferred',
    executionStatus: 'ran',
  });

  provenance.push({
    label: 'Clause coverage',
    origin: 'inferred',
    executionStatus: 'ran',
    detail: `${input.coveredClauses}/${input.totalClauses} clauses covered`,
  });

  // ── Compute pillar score ─────────────────────────────────────────────
  const allPresent = postOk && invOk && errOk && coverageOk;
  const presenceScore = [postOk, invOk, errOk, coverageOk].filter(Boolean).length / 4;
  const score = (presenceScore + coverageRatio) / 2;

  let status: PillarResult['status'];
  if (allPresent) {
    status = 'passed';
  } else if (input.totalClauses === 0) {
    status = 'missing';
  } else {
    status = presenceScore >= 0.5 ? 'degraded' : 'failed';
  }

  return {
    pillar: 'coverage',
    status,
    score,
    summary: `Coverage: ${status.toUpperCase()} — ${input.coveredClauses}/${input.totalClauses} clauses, ` +
      `${input.postconditionCount} post, ${input.invariantCount} inv, ${input.errorCaseCount} err`,
    details,
    provenance,
  };
}

// ============================================================================
// Pillar 3: Execution
// ============================================================================

/**
 * Input data for execution evaluation.
 */
export interface ExecutionInput {
  /** Total number of tests */
  totalTests: number;
  /** Tests that ran and passed */
  passedTests: number;
  /** Tests that ran and failed */
  failedTests: number;
  /** Tests that were skipped */
  skippedTests: number;
  /** Tests whose results are attributable to a spec clause */
  attributedTests: number;
  /** Per-test provenance (if available) */
  testProvenance: Array<{
    name: string;
    origin: ProvenanceOrigin;
    executionStatus: ExecutionStatus;
    specClause?: string;
  }>;
}

/**
 * Evaluate Pillar 3: Execution.
 *
 * Checks that tests actually ran, weren't all skipped, and that results
 * are attributable to spec clauses.
 */
export function evaluateExecution(
  input: ExecutionInput,
  config: VerifiedIntentConfig,
): PillarResult {
  const details: PillarDetail[] = [];
  const provenance: ProvenanceRecord[] = [];

  const ranCount = input.passedTests + input.failedTests;

  // ── At least one test ran ────────────────────────────────────────────
  const hasRan = ranCount > 0;
  if (config.execution.requireAtLeastOneRan) {
    details.push({
      check: 'at_least_one_ran',
      passed: hasRan,
      message: hasRan
        ? `${ranCount} test(s) executed`
        : 'No tests executed — all were skipped or absent',
      origin: 'inferred',
      executionStatus: hasRan ? 'ran' : 'not_run',
    });
  }

  // ── Pass rate ────────────────────────────────────────────────────────
  const passRate = ranCount > 0 ? input.passedTests / ranCount : 0;
  const passRateOk = passRate >= config.execution.minPassRate;

  details.push({
    check: 'pass_rate',
    passed: passRateOk,
    message: `Pass rate: ${input.passedTests}/${ranCount} (${pct(passRate)}, threshold ${pct(config.execution.minPassRate)})`,
    origin: 'inferred',
    executionStatus: ranCount > 0 ? 'ran' : 'not_run',
  });

  // ── Skip rate ────────────────────────────────────────────────────────
  const skipRate = input.totalTests > 0 ? input.skippedTests / input.totalTests : 0;
  const skipRateOk = skipRate <= config.execution.maxSkipRate;

  details.push({
    check: 'skip_rate',
    passed: skipRateOk,
    message: `Skip rate: ${input.skippedTests}/${input.totalTests} (${pct(skipRate)}, max ${pct(config.execution.maxSkipRate)})`,
    origin: 'inferred',
    executionStatus: 'ran',
  });

  // ── Attribution ──────────────────────────────────────────────────────
  let attributionOk = true;
  if (config.execution.requireAttribution) {
    const attributionRatio = ranCount > 0 ? input.attributedTests / ranCount : 0;
    attributionOk = attributionRatio > 0;

    details.push({
      check: 'spec_attribution',
      passed: attributionOk,
      message: attributionOk
        ? `${input.attributedTests}/${ranCount} test result(s) attributable to spec clauses`
        : 'No test results are attributable to spec clauses',
      origin: 'inferred',
      executionStatus: ranCount > 0 ? 'ran' : 'not_run',
    });
  }

  // ── Per-test provenance ──────────────────────────────────────────────
  for (const tp of input.testProvenance) {
    provenance.push({
      label: `Test: ${tp.name}`,
      origin: tp.origin,
      executionStatus: tp.executionStatus,
      detail: tp.specClause ? `Attributed to: ${tp.specClause}` : 'No spec attribution',
    });
  }

  if (input.testProvenance.length === 0 && input.totalTests > 0) {
    provenance.push({
      label: `${input.totalTests} test(s)`,
      origin: 'unknown',
      executionStatus: hasRan ? 'ran' : 'not_run',
      detail: `${input.passedTests} passed, ${input.failedTests} failed, ${input.skippedTests} skipped`,
    });
  }

  // ── Compute pillar score ─────────────────────────────────────────────
  const requirementsMet = [
    !config.execution.requireAtLeastOneRan || hasRan,
    passRateOk,
    skipRateOk,
    !config.execution.requireAttribution || attributionOk,
  ];
  const metCount = requirementsMet.filter(Boolean).length;
  const allMet = metCount === requirementsMet.length;

  // Score blends pass rate, skip compliance, and attribution
  const score = ranCount > 0
    ? (passRate * 0.5) + ((1 - skipRate) * 0.25) + (attributionOk ? 0.25 : 0)
    : 0;

  let status: PillarResult['status'];
  if (!hasRan && config.execution.requireAtLeastOneRan) {
    status = 'missing';
  } else if (allMet) {
    status = 'passed';
  } else if (metCount >= 2) {
    status = 'degraded';
  } else {
    status = 'failed';
  }

  return {
    pillar: 'execution',
    status,
    score,
    summary: `Execution: ${status.toUpperCase()} — ${ranCount} ran, ${input.passedTests} passed, ${input.skippedTests} skipped, ${input.attributedTests} attributed`,
    details,
    provenance,
  };
}

// ============================================================================
// Signal-to-Pillar Input Extractors
// ============================================================================

/**
 * Extract SpecFidelityInput from gate signals and evidence.
 */
export function extractSpecFidelityInput(
  signals: VerificationSignal[],
  evidence: readonly GateEvidence[],
): SpecFidelityInput {
  const parserSignal = signals.find(s => s.source === 'parser');
  const typecheckerSignal = signals.find(s => s.source === 'typechecker');
  const verifierSignal = signals.find(s => s.source === 'verifier');

  // Count signature/type matches from evidence
  const sigChecks = evidence.filter(e => e.check.includes('signature') || e.check.includes('function'));
  const typeChecks = evidence.filter(e => e.check.includes('type') || e.check.includes('interface'));

  const sigTotal = sigChecks.length || (verifierSignal ? 1 : 0);
  const sigMatched = sigChecks.filter(e => e.result === 'pass').length || (verifierSignal?.passed ? 1 : 0);

  const typeTotal = typeChecks.length || (typecheckerSignal ? 1 : 0);
  const typeMatched = typeChecks.filter(e => e.result === 'pass').length || (typecheckerSignal?.passed ? 1 : 0);

  // Determine origin from evidence sources
  const hasAiEvidence = evidence.some(e => e.details?.includes('AI-generated') || e.details?.includes('ai-generated'));
  const specOrigin: ProvenanceOrigin = hasAiEvidence ? 'ai-generated' : 'unknown';

  return {
    specParsed: parserSignal?.passed ?? false,
    specTypechecked: typecheckerSignal?.passed ?? false,
    specSignatureCount: Math.max(sigTotal, 1),
    matchedSignatureCount: sigMatched,
    specTypeCount: Math.max(typeTotal, 1),
    matchedTypeCount: typeMatched,
    specOrigin,
    implOrigin: 'unknown',
  };
}

/**
 * Extract CoverageInput from gate signals and evidence.
 */
export function extractCoverageInput(
  signals: VerificationSignal[],
  evidence: readonly GateEvidence[],
): CoverageInput {
  const postconditions = evidence.filter(e =>
    e.check.includes('postcondition') || e.check.includes('ensures')
  );
  const invariants = evidence.filter(e =>
    e.check.includes('invariant')
  );
  const errorCases = evidence.filter(e =>
    e.check.includes('error') || e.check.includes('exception') || e.check.includes('throws')
  );

  const allClauses = [...postconditions, ...invariants, ...errorCases];
  // Deduplicate by check name
  const uniqueChecks = new Set(allClauses.map(e => e.check));
  const coveredChecks = new Set(
    allClauses.filter(e => e.result === 'pass' || e.result === 'fail').map(e => e.check)
  );

  const hasAiEvidence = evidence.some(e => e.details?.includes('AI-generated') || e.details?.includes('ai-generated'));

  return {
    postconditionCount: postconditions.length,
    postconditionsVerified: postconditions.filter(e => e.result === 'pass').length,
    invariantCount: invariants.length,
    invariantsVerified: invariants.filter(e => e.result === 'pass').length,
    errorCaseCount: errorCases.length,
    errorCasesVerified: errorCases.filter(e => e.result === 'pass').length,
    totalClauses: uniqueChecks.size,
    coveredClauses: coveredChecks.size,
    specOrigin: hasAiEvidence ? 'ai-generated' : 'unknown',
  };
}

/**
 * Extract ExecutionInput from aggregated signals.
 */
export function extractExecutionInput(
  aggregation: AggregatedSignals,
  evidence: readonly GateEvidence[],
): ExecutionInput {
  const { tests } = aggregation;

  // Build per-test provenance from evidence
  const testEvidence = evidence.filter(e =>
    e.source === 'runtime-eval' || e.check.includes('test:') || e.check.includes('scenario:')
  );

  const attributed = testEvidence.filter(e =>
    e.check.includes('postcondition') ||
    e.check.includes('invariant') ||
    e.check.includes('scenario') ||
    e.check.includes('ensures')
  );

  const testProvenance = testEvidence.map(e => ({
    name: e.check,
    origin: (e.details?.includes('AI-generated') ? 'ai-generated' : 'unknown') as ProvenanceOrigin,
    executionStatus: mapResultToExecStatus(e.result),
    specClause: attributed.some(a => a.check === e.check) ? e.check : undefined,
  }));

  return {
    totalTests: tests.total,
    passedTests: tests.passed,
    failedTests: tests.failed,
    skippedTests: tests.skipped,
    attributedTests: attributed.length || (tests.passed > 0 ? tests.passed : 0),
    testProvenance,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function mapResultToExecStatus(result: GateEvidence['result']): ExecutionStatus {
  switch (result) {
    case 'pass': return 'ran';
    case 'fail': return 'ran';
    case 'warn': return 'ran';
    case 'skip': return 'skipped';
  }
}
