/**
 * Evidence Adapters
 *
 * Converts evidence from existing ISL verification packages into
 * the TrustEvidenceInput format for trust score computation.
 *
 * @module @isl-lang/trust-score
 */

import type {
  TrustEvidenceInput,
  PBTEvidence,
  ChaosEvidence,
  SignalVerdict,
  StaticCheckResult,
  ClauseEvaluation,
  SMTProofResult,
  PBTBehaviorResult,
  ChaosScenarioResult,
} from './types.js';

// ============================================================================
// GENERIC ADAPTER
// ============================================================================

/**
 * Builder for constructing TrustEvidenceInput from various sources
 */
export class EvidenceBuilder {
  private evidence: TrustEvidenceInput = {};

  /**
   * Add static check results
   */
  withStaticChecks(checks: StaticCheckResult[]): this {
    this.evidence.staticChecks = {
      category: 'static_checks',
      timestamp: new Date().toISOString(),
      durationMs: 0,
      checks,
    };
    return this;
  }

  /**
   * Add evaluator verdicts
   */
  withEvaluatorVerdicts(clauses: ClauseEvaluation[]): this {
    this.evidence.evaluatorVerdicts = {
      category: 'evaluator_verdicts',
      timestamp: new Date().toISOString(),
      durationMs: 0,
      clauses,
    };
    return this;
  }

  /**
   * Add SMT proof results
   */
  withSMTProofs(proofs: SMTProofResult[]): this {
    this.evidence.smtProofs = {
      category: 'smt_proofs',
      timestamp: new Date().toISOString(),
      durationMs: 0,
      proofs,
    };
    return this;
  }

  /**
   * Add PBT results
   */
  withPBTResults(behaviors: PBTBehaviorResult[]): this {
    this.evidence.pbtResults = {
      category: 'pbt_results',
      timestamp: new Date().toISOString(),
      durationMs: 0,
      behaviors,
    };
    return this;
  }

  /**
   * Add chaos testing results
   */
  withChaosOutcomes(scenarios: ChaosScenarioResult[]): this {
    this.evidence.chaosOutcomes = {
      category: 'chaos_outcomes',
      timestamp: new Date().toISOString(),
      durationMs: 0,
      scenarios,
    };
    return this;
  }

  /**
   * Build the evidence input
   */
  build(): TrustEvidenceInput {
    return { ...this.evidence };
  }
}

// ============================================================================
// ISL-VERIFY-PIPELINE ADAPTER
// ============================================================================

/**
 * Adapts VerificationResult from @isl-lang/verify-pipeline
 */
export function fromVerifyPipelineResult(result: {
  verdict: string;
  clauses: Array<{
    clauseId: string;
    type: string;
    expression: string;
    status: string;
    resolvedBy?: string;
    reason?: string;
  }>;
  smtResolutions?: Array<{
    clauseId: string;
    verdict: string;
    evidence?: {
      solver: string;
      status: string;
      durationMs: number;
      queryHash?: string;
      model?: Record<string, unknown>;
    };
  }>;
}): Partial<TrustEvidenceInput> {
  const evidence: Partial<TrustEvidenceInput> = {};

  // Map clause results to evaluator verdicts
  const clauses: ClauseEvaluation[] = result.clauses.map(c => ({
    clauseId: c.clauseId,
    type: c.type as 'postcondition' | 'invariant' | 'precondition',
    expression: c.expression,
    verdict: mapClauseStatus(c.status),
    resolvedBy: c.resolvedBy as 'runtime' | 'smt' | 'timeout' | undefined,
    reason: c.reason,
  }));

  if (clauses.length > 0) {
    evidence.evaluatorVerdicts = {
      category: 'evaluator_verdicts',
      timestamp: new Date().toISOString(),
      durationMs: 0,
      clauses,
    };
  }

  // Map SMT resolutions
  if (result.smtResolutions && result.smtResolutions.length > 0) {
    const proofs: SMTProofResult[] = result.smtResolutions.map(r => ({
      clauseId: r.clauseId,
      verdict: mapSMTVerdict(r.verdict),
      solver: r.evidence?.solver ?? 'unknown',
      solverStatus: mapSolverStatus(r.evidence?.status),
      durationMs: r.evidence?.durationMs ?? 0,
      queryHash: r.evidence?.queryHash,
      counterexample: r.evidence?.model,
    }));

    evidence.smtProofs = {
      category: 'smt_proofs',
      timestamp: new Date().toISOString(),
      durationMs: proofs.reduce((sum, p) => sum + p.durationMs, 0),
      proofs,
    };
  }

  return evidence;
}

// ============================================================================
// ISL-PBT ADAPTER
// ============================================================================

/**
 * Adapts PBTReport from @isl-lang/isl-pbt
 */
export function fromPBTReport(report: {
  behaviorName: string;
  success: boolean;
  testsRun: number;
  testsPassed: number;
  stats: {
    successes: number;
    failures: number;
    filtered: number;
  };
  violations: Array<{
    property: unknown;
    input: Record<string, unknown>;
    minimalInput?: Record<string, unknown>;
    error: string;
  }>;
}): PBTEvidence {
  return {
    category: 'pbt_results',
    timestamp: new Date().toISOString(),
    durationMs: 0,
    behaviors: [{
      behaviorName: report.behaviorName,
      verdict: report.success ? 'pass' : 'fail',
      iterations: report.testsRun,
      successes: report.stats.successes,
      failures: report.stats.failures,
      filtered: report.stats.filtered,
      violations: report.violations.map(v => ({
        property: String(v.property),
        input: v.input,
        minimalInput: v.minimalInput,
        error: v.error,
      })),
    }],
  };
}

// ============================================================================
// CHAOS ADAPTER
// ============================================================================

/**
 * Adapts ChaosStepResult from @isl-lang/verifier-chaos
 */
export function fromChaosResult(result: {
  success: boolean;
  data?: {
    report: {
      summary: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
      };
      scenarios: Array<{
        id: string;
        name: string;
        faultType: string;
        verdict: string;
        recovered: boolean;
        recoveryTimeMs?: number;
        invariantsMaintained: boolean;
        details?: string;
      }>;
    };
  };
}): ChaosEvidence {
  const scenarios: ChaosScenarioResult[] = result.data?.report.scenarios.map(s => ({
    scenarioId: s.id,
    name: s.name,
    faultType: s.faultType,
    verdict: s.verdict === 'pass' ? 'pass' : s.verdict === 'fail' ? 'fail' : 'unknown',
    recovered: s.recovered,
    recoveryTimeMs: s.recoveryTimeMs,
    invariantsMaintained: s.invariantsMaintained,
    details: s.details,
  })) ?? [];

  return {
    category: 'chaos_outcomes',
    timestamp: new Date().toISOString(),
    durationMs: 0,
    scenarios,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function mapClauseStatus(status: string): SignalVerdict {
  switch (status.toLowerCase()) {
    case 'proven':
    case 'pass':
    case 'passed':
      return 'pass';
    case 'violated':
    case 'fail':
    case 'failed':
      return 'fail';
    case 'skipped':
      return 'skipped';
    default:
      return 'unknown';
  }
}

function mapSMTVerdict(verdict: string): SignalVerdict {
  switch (verdict.toLowerCase()) {
    case 'proved':
    case 'proven':
      return 'pass';
    case 'disproved':
    case 'disproven':
      return 'fail';
    default:
      return 'unknown';
  }
}

function mapSolverStatus(status: string | undefined): 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error' {
  switch (status?.toLowerCase()) {
    case 'sat':
      return 'sat';
    case 'unsat':
      return 'unsat';
    case 'timeout':
      return 'timeout';
    case 'error':
      return 'error';
    default:
      return 'unknown';
  }
}
