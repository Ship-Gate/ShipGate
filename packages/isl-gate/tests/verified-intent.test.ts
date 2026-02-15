/**
 * Verified Intent — 3-Pillar Contract Tests
 *
 * Covers:
 *   1. Spec Fidelity pillar evaluation
 *   2. Coverage pillar evaluation
 *   3. Execution pillar evaluation
 *   4. All-3-required-for-SHIP rule
 *   5. Missing pillar policy (WARN vs NO_SHIP)
 *   6. Provenance report (inferred/AI-generated/unknown/ran/didn't run/evidence)
 *   7. Verdict cap integration
 *   8. Format helpers
 */

import { describe, it, expect } from 'vitest';

import {
  evaluateSpecFidelity,
  evaluateCoverage,
  evaluateExecution,
  evaluateVerifiedIntentFromInputs,
  applyVerifiedIntentCap,
  buildProvenanceReport,
  partitionProvenance,
  formatProvenanceReport,
  formatVerifiedIntentReport,
  DEFAULT_VERIFIED_INTENT_CONFIG,
  DEV_VERIFIED_INTENT_CONFIG,
} from '../src/verified-intent/index.js';

import type {
  SpecFidelityInput,
  CoverageInput,
  ExecutionInput,
  VerifiedIntentConfig,
  ProvenanceRecord,
} from '../src/verified-intent/index.js';

// ============================================================================
// Helpers
// ============================================================================

function makeSpecInput(overrides?: Partial<SpecFidelityInput>): SpecFidelityInput {
  return {
    specParsed: true,
    specTypechecked: true,
    specSignatureCount: 5,
    matchedSignatureCount: 5,
    specTypeCount: 5,
    matchedTypeCount: 5,
    specOrigin: 'human-authored',
    implOrigin: 'human-authored',
    ...overrides,
  };
}

function makeCoverageInput(overrides?: Partial<CoverageInput>): CoverageInput {
  return {
    postconditionCount: 3,
    postconditionsVerified: 3,
    invariantCount: 2,
    invariantsVerified: 2,
    errorCaseCount: 2,
    errorCasesVerified: 2,
    totalClauses: 7,
    coveredClauses: 7,
    specOrigin: 'human-authored',
    ...overrides,
  };
}

function makeExecInput(overrides?: Partial<ExecutionInput>): ExecutionInput {
  return {
    totalTests: 10,
    passedTests: 9,
    failedTests: 1,
    skippedTests: 0,
    attributedTests: 9,
    testProvenance: [],
    ...overrides,
  };
}

// ============================================================================
// 1. Spec Fidelity Pillar
// ============================================================================

describe('Pillar 1: Spec Fidelity', () => {
  it('passes when all signatures and types match', () => {
    const result = evaluateSpecFidelity(makeSpecInput(), DEFAULT_VERIFIED_INTENT_CONFIG);
    expect(result.status).toBe('passed');
    expect(result.score).toBe(1.0);
    expect(result.pillar).toBe('spec_fidelity');
  });

  it('fails when spec does not parse', () => {
    const result = evaluateSpecFidelity(
      makeSpecInput({ specParsed: false }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).toBe('failed');
    expect(result.score).toBe(0);
  });

  it('fails when spec has type errors', () => {
    const result = evaluateSpecFidelity(
      makeSpecInput({ specTypechecked: false }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).toBe('failed');
    expect(result.score).toBe(0.1);
  });

  it('degrades when signature match is below threshold', () => {
    const result = evaluateSpecFidelity(
      makeSpecInput({ matchedSignatureCount: 2 }), // 2/5 = 40%
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
    expect(result.score).toBeLessThan(1.0);
  });

  it('degrades when type match is below threshold', () => {
    const result = evaluateSpecFidelity(
      makeSpecInput({ matchedTypeCount: 2 }), // 2/5 = 40%
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
  });

  it('tracks provenance origin for AI-generated specs', () => {
    const result = evaluateSpecFidelity(
      makeSpecInput({ specOrigin: 'ai-generated' }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.provenance.some(p => p.origin === 'ai-generated')).toBe(true);
  });

  it('summary includes signature and type percentages', () => {
    const result = evaluateSpecFidelity(makeSpecInput(), DEFAULT_VERIFIED_INTENT_CONFIG);
    expect(result.summary).toContain('100.0%');
  });
});

// ============================================================================
// 2. Coverage Pillar
// ============================================================================

describe('Pillar 2: Coverage', () => {
  it('passes when all clause types are present and covered', () => {
    const result = evaluateCoverage(makeCoverageInput(), DEFAULT_VERIFIED_INTENT_CONFIG);
    expect(result.status).toBe('passed');
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.pillar).toBe('coverage');
  });

  it('fails when postconditions are missing', () => {
    const result = evaluateCoverage(
      makeCoverageInput({ postconditionCount: 0, postconditionsVerified: 0, totalClauses: 4, coveredClauses: 4 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
  });

  it('fails when invariants are missing', () => {
    const result = evaluateCoverage(
      makeCoverageInput({ invariantCount: 0, invariantsVerified: 0, totalClauses: 5, coveredClauses: 5 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
  });

  it('fails when error cases are missing', () => {
    const result = evaluateCoverage(
      makeCoverageInput({ errorCaseCount: 0, errorCasesVerified: 0, totalClauses: 5, coveredClauses: 5 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
  });

  it('reports missing status when there are zero clauses', () => {
    const result = evaluateCoverage(
      makeCoverageInput({
        postconditionCount: 0, postconditionsVerified: 0,
        invariantCount: 0, invariantsVerified: 0,
        errorCaseCount: 0, errorCasesVerified: 0,
        totalClauses: 0, coveredClauses: 0,
      }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).toBe('missing');
  });

  it('relaxed config allows zero postconditions', () => {
    const result = evaluateCoverage(
      makeCoverageInput({ postconditionCount: 0, postconditionsVerified: 0 }),
      DEV_VERIFIED_INTENT_CONFIG,
    );
    // Dev config has minPostconditions: 0, so this detail should pass
    const postCheck = result.details.find(d => d.check === 'postconditions_present');
    expect(postCheck?.passed).toBe(true);
  });

  it('summary includes clause counts', () => {
    const result = evaluateCoverage(makeCoverageInput(), DEFAULT_VERIFIED_INTENT_CONFIG);
    expect(result.summary).toContain('post');
    expect(result.summary).toContain('inv');
    expect(result.summary).toContain('err');
  });
});

// ============================================================================
// 3. Execution Pillar
// ============================================================================

describe('Pillar 3: Execution', () => {
  it('passes when tests ran with good pass rate and attribution', () => {
    const result = evaluateExecution(makeExecInput(), DEFAULT_VERIFIED_INTENT_CONFIG);
    expect(result.status).toBe('passed');
    expect(result.pillar).toBe('execution');
  });

  it('reports missing when no tests ran', () => {
    const result = evaluateExecution(
      makeExecInput({ totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, attributedTests: 0 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).toBe('missing');
  });

  it('fails when pass rate is too low', () => {
    const result = evaluateExecution(
      makeExecInput({ passedTests: 3, failedTests: 7 }), // 30% pass rate
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
  });

  it('fails when skip rate is too high', () => {
    const result = evaluateExecution(
      makeExecInput({ totalTests: 10, passedTests: 1, failedTests: 0, skippedTests: 9 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.status).not.toBe('passed');
  });

  it('fails when no tests are attributed to spec', () => {
    const result = evaluateExecution(
      makeExecInput({ attributedTests: 0 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    const attrCheck = result.details.find(d => d.check === 'spec_attribution');
    expect(attrCheck?.passed).toBe(false);
  });

  it('passes with relaxed config even with low pass rate', () => {
    const result = evaluateExecution(
      makeExecInput({ passedTests: 6, failedTests: 4 }), // 60% pass rate
      DEV_VERIFIED_INTENT_CONFIG, // minPassRate: 0.5
    );
    const passRateCheck = result.details.find(d => d.check === 'pass_rate');
    expect(passRateCheck?.passed).toBe(true);
  });

  it('tracks per-test provenance', () => {
    const result = evaluateExecution(
      makeExecInput({
        testProvenance: [
          { name: 'test-auth', origin: 'ai-generated', executionStatus: 'ran', specClause: 'postcondition:auth' },
          { name: 'test-db', origin: 'human-authored', executionStatus: 'ran' },
        ],
      }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.provenance).toHaveLength(2);
    expect(result.provenance[0].origin).toBe('ai-generated');
    expect(result.provenance[1].origin).toBe('human-authored');
  });
});

// ============================================================================
// 4. All-3-Required-for-SHIP Rule
// ============================================================================

describe('3-Pillar Contract: SHIP requires all 3', () => {
  it('SHIP when all three pillars pass', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.verdict).toBe('SHIP');
    expect(result.allPillarsPassed).toBe(true);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.blockers).toHaveLength(0);
  });

  it('NO_SHIP when spec fidelity fails (default policy)', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.verdict).toBe('NO_SHIP');
    expect(result.allPillarsPassed).toBe(false);
    expect(result.pillars.specFidelity.status).toBe('failed');
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('NO_SHIP when coverage is missing (default policy)', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput({
        postconditionCount: 0, postconditionsVerified: 0,
        invariantCount: 0, invariantsVerified: 0,
        errorCaseCount: 0, errorCasesVerified: 0,
        totalClauses: 0, coveredClauses: 0,
      }),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.verdict).toBe('NO_SHIP');
    expect(result.pillars.coverage.status).toBe('missing');
  });

  it('NO_SHIP when execution is missing (default policy)', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput({ totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, attributedTests: 0 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.verdict).toBe('NO_SHIP');
    expect(result.pillars.execution.status).toBe('missing');
  });

  it('NO_SHIP when two pillars fail', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput({
        postconditionCount: 0, postconditionsVerified: 0,
        invariantCount: 0, invariantsVerified: 0,
        errorCaseCount: 0, errorCasesVerified: 0,
        totalClauses: 0, coveredClauses: 0,
      }),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.verdict).toBe('NO_SHIP');
    expect(result.allPillarsPassed).toBe(false);
  });

  it('compositeScore is 0 when any pillar fails', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.compositeScore).toBe(0);
  });

  it('compositeScore is average of pillar scores when all pass', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    const expected = (
      result.pillars.specFidelity.score +
      result.pillars.coverage.score +
      result.pillars.execution.score
    ) / 3;
    expect(result.compositeScore).toBeCloseTo(expected, 5);
  });
});

// ============================================================================
// 5. Missing Pillar Policy
// ============================================================================

describe('Missing Pillar Policy', () => {
  const warnConfig: VerifiedIntentConfig = {
    ...DEFAULT_VERIFIED_INTENT_CONFIG,
    missingPillarVerdict: 'WARN',
  };

  it('NO_SHIP policy: missing pillar → NO_SHIP', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.verdict).toBe('NO_SHIP');
  });

  it('WARN policy: degraded pillar → WARN (not NO_SHIP)', () => {
    // Make spec fidelity degraded (not failed/missing) by partial match
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ matchedSignatureCount: 3 }), // 3/5 = 60%, below 80% threshold → degraded
      makeCoverageInput(),
      makeExecInput(),
      warnConfig,
    );
    // With WARN policy, degraded (not failed/missing) → WARN
    expect(result.verdict).toBe('WARN');
  });

  it('WARN policy: hard failure still → NO_SHIP', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }), // Hard failure
      makeCoverageInput(),
      makeExecInput(),
      warnConfig,
    );
    expect(result.verdict).toBe('NO_SHIP');
  });
});

// ============================================================================
// 6. Provenance Report
// ============================================================================

describe('Provenance Report', () => {
  it('partitions records by origin and execution status', () => {
    const records: ProvenanceRecord[] = [
      { label: 'a', origin: 'inferred', executionStatus: 'ran' },
      { label: 'b', origin: 'ai-generated', executionStatus: 'ran' },
      { label: 'c', origin: 'unknown', executionStatus: 'not_run' },
      { label: 'd', origin: 'human-authored', executionStatus: 'ran', evidenceRef: '/path/to/report' },
      { label: 'e', origin: 'inferred', executionStatus: 'skipped' },
    ];

    const report = partitionProvenance(records);

    expect(report.inferred).toHaveLength(2);
    expect(report.aiGenerated).toHaveLength(1);
    expect(report.unknown).toHaveLength(1);
    expect(report.ran).toHaveLength(3);
    expect(report.didNotRun).toHaveLength(2);
    expect(report.evidence).toHaveLength(1);
  });

  it('buildProvenanceReport collects from all pillars', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    const report = result.provenance;

    // Should have records from all three pillars
    expect(report.ran.length).toBeGreaterThan(0);
    // inferred records come from signature/type matching and coverage
    expect(report.inferred.length).toBeGreaterThan(0);
  });

  it('AI-generated items appear in aiGenerated category', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specOrigin: 'ai-generated' }),
      makeCoverageInput({ specOrigin: 'ai-generated' }),
      makeExecInput({
        testProvenance: [
          { name: 'test-1', origin: 'ai-generated', executionStatus: 'ran' },
        ],
      }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );

    expect(result.provenance.aiGenerated.length).toBeGreaterThan(0);
  });

  it('formatProvenanceReport produces readable output', () => {
    const records: ProvenanceRecord[] = [
      { label: 'ISL spec', origin: 'ai-generated', executionStatus: 'ran', detail: 'Generated by Anthropic' },
      { label: 'Test: auth', origin: 'human-authored', executionStatus: 'ran' },
      { label: 'Type check', origin: 'inferred', executionStatus: 'not_run' },
    ];
    const report = partitionProvenance(records);
    const formatted = formatProvenanceReport(report);

    expect(formatted).toContain('Provenance Report');
    expect(formatted).toContain('Inferred');
    expect(formatted).toContain('AI-Generated');
    expect(formatted).toContain('Ran');
    expect(formatted).toContain('Did Not Run');
  });
});

// ============================================================================
// 7. Verdict Cap Integration
// ============================================================================

describe('applyVerifiedIntentCap', () => {
  it('SHIP gate + SHIP intent → SHIP', () => {
    const intentResult = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(applyVerifiedIntentCap('SHIP', intentResult)).toBe('SHIP');
  });

  it('SHIP gate + NO_SHIP intent → NO_SHIP', () => {
    const intentResult = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(applyVerifiedIntentCap('SHIP', intentResult)).toBe('NO_SHIP');
  });

  it('NO_SHIP gate + SHIP intent → NO_SHIP (gate is already lower)', () => {
    const intentResult = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(applyVerifiedIntentCap('NO_SHIP', intentResult)).toBe('NO_SHIP');
  });

  it('WARN gate + SHIP intent → WARN (unchanged)', () => {
    const intentResult = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(applyVerifiedIntentCap('WARN', intentResult)).toBe('WARN');
  });

  it('SHIP gate + WARN intent → WARN (capped)', () => {
    const warnConfig: VerifiedIntentConfig = {
      ...DEFAULT_VERIFIED_INTENT_CONFIG,
      missingPillarVerdict: 'WARN',
    };
    const intentResult = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ matchedSignatureCount: 3 }), // degraded
      makeCoverageInput(),
      makeExecInput(),
      warnConfig,
    );
    expect(applyVerifiedIntentCap('SHIP', intentResult)).toBe('WARN');
  });
});

// ============================================================================
// 8. Format Helpers
// ============================================================================

describe('formatVerifiedIntentReport', () => {
  it('formats SHIP result with all pillar details', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    const report = formatVerifiedIntentReport(result);

    expect(report).toContain('VERIFIED INTENT: SHIP');
    expect(report).toContain('Spec Fidelity');
    expect(report).toContain('Coverage');
    expect(report).toContain('Execution');
    expect(report).toContain('Provenance Report');
  });

  it('formats NO_SHIP result with blockers and recommendations', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    const report = formatVerifiedIntentReport(result);

    expect(report).toContain('VERIFIED INTENT: NO_SHIP');
    expect(report).toContain('Blockers');
    expect(report).toContain('Recommendations');
  });
});

// ============================================================================
// 9. Summary Output Content
// ============================================================================

describe('Summary output content', () => {
  it('summary explicitly states what pillars passed', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput(),
      makeCoverageInput(),
      makeExecInput(),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.summary).toContain('All 3 pillars passed');
    expect(result.summary).toContain('Fidelity:PASS');
    expect(result.summary).toContain('Coverage:PASS');
    expect(result.summary).toContain('Execution:PASS');
  });

  it('summary states how many pillars failed', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput(),
      makeExecInput({ totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, attributedTests: 0 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.summary).toContain('2/3 pillar(s) not passing');
  });

  it('recommendations list each failing pillar', () => {
    const result = evaluateVerifiedIntentFromInputs(
      makeSpecInput({ specParsed: false }),
      makeCoverageInput({
        postconditionCount: 0, postconditionsVerified: 0,
        invariantCount: 0, invariantsVerified: 0,
        errorCaseCount: 0, errorCasesVerified: 0,
        totalClauses: 0, coveredClauses: 0,
      }),
      makeExecInput({ totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, attributedTests: 0 }),
      DEFAULT_VERIFIED_INTENT_CONFIG,
    );
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('spec fidelity'),
        expect.stringContaining('coverage'),
        expect.stringContaining('execution'),
      ]),
    );
  });
});

// ============================================================================
// 10. Config Defaults
// ============================================================================

describe('Config defaults', () => {
  it('DEFAULT config has strict thresholds', () => {
    expect(DEFAULT_VERIFIED_INTENT_CONFIG.missingPillarVerdict).toBe('NO_SHIP');
    expect(DEFAULT_VERIFIED_INTENT_CONFIG.specFidelity.minSignatureMatch).toBe(0.8);
    expect(DEFAULT_VERIFIED_INTENT_CONFIG.coverage.minPostconditions).toBe(1);
    expect(DEFAULT_VERIFIED_INTENT_CONFIG.execution.requireAtLeastOneRan).toBe(true);
    expect(DEFAULT_VERIFIED_INTENT_CONFIG.execution.requireAttribution).toBe(true);
  });

  it('DEV config has relaxed thresholds', () => {
    expect(DEV_VERIFIED_INTENT_CONFIG.missingPillarVerdict).toBe('WARN');
    expect(DEV_VERIFIED_INTENT_CONFIG.specFidelity.minSignatureMatch).toBe(0.5);
    expect(DEV_VERIFIED_INTENT_CONFIG.coverage.minPostconditions).toBe(0);
    expect(DEV_VERIFIED_INTENT_CONFIG.execution.requireAtLeastOneRan).toBe(false);
    expect(DEV_VERIFIED_INTENT_CONFIG.execution.requireAttribution).toBe(false);
  });
});
