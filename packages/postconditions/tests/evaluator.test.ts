import { describe, it, expect } from 'vitest';
import {
  evaluatePostconditions,
  compareEvidenceTypes,
  isEvidenceSufficientFor,
  getRequiredEvidenceFor,
  EVIDENCE_PRIORITY,
} from '../src/index.js';
import type {
  Evidence,
  SpecClause,
  EvidenceType,
  EvaluationInput,
} from '../src/index.js';

// Load fixtures
import bindingProofFixture from '../fixtures/binding-proof.json';
import executedTestsFixture from '../fixtures/executed-tests.json';
import runtimeAssertsFixture from '../fixtures/runtime-asserts.json';
import heuristicMatchFixture from '../fixtures/heuristic-match.json';
import noEvidenceFixture from '../fixtures/no-evidence.json';
import contradictingFixture from '../fixtures/contradicting-evidence.json';
import mixedEvidenceFixture from '../fixtures/mixed-evidence.json';

describe('evaluatePostconditions', () => {
  // =============================================================================
  // EVIDENCE LADDER RUNG 1: BINDING_PROOF (Strongest)
  // =============================================================================
  describe('BINDING_PROOF evidence (ladder rung 1)', () => {
    it('should PASS when type system proves postcondition', () => {
      const result = evaluatePostconditions({
        specClauses: bindingProofFixture.clauses as SpecClause[],
        evidence: bindingProofFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.status).toBe('PASS');
      expect(result.clauseResults[0]?.evidenceType).toBe('BINDING_PROOF');
    });

    it('should PASS when formal verification proves postcondition', () => {
      const result = evaluatePostconditions({
        specClauses: bindingProofFixture.clauses as SpecClause[],
        evidence: bindingProofFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[1]?.status).toBe('PASS');
      expect(result.clauseResults[1]?.evidenceType).toBe('BINDING_PROOF');
    });

    it('should prioritize BINDING_PROOF over other evidence types', () => {
      const input: EvaluationInput = {
        specClauses: [
          { id: 'post-type-safe', expression: 'result.value != null' },
        ],
        evidence: [
          {
            type: 'BINDING_PROOF',
            source: 'type-checker',
            description: 'Type proves post-type-safe: non-null',
          },
          {
            type: 'EXECUTED_TEST',
            source: 'tests/value.test.ts',
            description: 'Test also checks post-type-safe',
            coverage: 100,
          },
          {
            type: 'RUNTIME_ASSERT',
            source: 'runtime',
            description: 'Assert for post-type-safe exists',
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.evidenceType).toBe('BINDING_PROOF');
      expect(result.clauseResults[0]?.status).toBe('PASS');
    });

    it('should have high confidence for BINDING_PROOF', () => {
      const result = evaluatePostconditions({
        specClauses: bindingProofFixture.clauses as SpecClause[],
        evidence: bindingProofFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.confidence).toBeGreaterThan(0.8);
    });
  });

  // =============================================================================
  // EVIDENCE LADDER RUNG 2: EXECUTED_TEST
  // =============================================================================
  describe('EXECUTED_TEST evidence (ladder rung 2)', () => {
    it('should PASS with high coverage executed test', () => {
      const result = evaluatePostconditions({
        specClauses: executedTestsFixture.clauses as SpecClause[],
        evidence: executedTestsFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.status).toBe('PASS');
      expect(result.clauseResults[0]?.evidenceType).toBe('EXECUTED_TEST');
    });

    it('should PASS for error category postconditions with tests', () => {
      const result = evaluatePostconditions({
        specClauses: executedTestsFixture.clauses as SpecClause[],
        evidence: executedTestsFixture.evidence as Evidence[],
      });

      // post-login-error is category: error
      expect(result.clauseResults[1]?.status).toBe('PASS');
    });

    it('should PARTIAL with low coverage executed test', () => {
      const result = evaluatePostconditions({
        specClauses: executedTestsFixture.clauses as SpecClause[],
        evidence: executedTestsFixture.evidence as Evidence[],
      });

      // post-create-user has 50% coverage
      expect(result.clauseResults[2]?.status).toBe('PARTIAL');
      expect(result.clauseResults[2]?.evidenceType).toBe('EXECUTED_TEST');
    });

    it('should mention coverage in notes for low coverage', () => {
      const result = evaluatePostconditions({
        specClauses: executedTestsFixture.clauses as SpecClause[],
        evidence: executedTestsFixture.evidence as Evidence[],
      });

      const lowCoverageResult = result.clauseResults[2];
      expect(lowCoverageResult?.notes.some((n) => n.includes('coverage'))).toBe(true);
    });

    it('should provide next step for low coverage', () => {
      const result = evaluatePostconditions({
        specClauses: executedTestsFixture.clauses as SpecClause[],
        evidence: executedTestsFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[2]?.requiredNextStep).toMatch(/coverage/i);
    });

    it('should PASS when no coverage info but test passed', () => {
      const input: EvaluationInput = {
        specClauses: [{ id: 'post-no-coverage', expression: 'result.ok' }],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'tests/basic.test.ts',
            description: 'Test for post-no-coverage passed',
            // No coverage field
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.status).toBe('PASS');
    });

    it('should respect custom minCoverageForPass config', () => {
      const input: EvaluationInput = {
        specClauses: [{ id: 'post-custom-cov', expression: 'result.valid' }],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'test',
            description: 'Test for post-custom-cov',
            coverage: 60,
          },
        ],
      };

      // With default 70% threshold (MVP stable threshold)
      const resultDefault = evaluatePostconditions(input);
      expect(resultDefault.clauseResults[0]?.status).toBe('PARTIAL');

      // With lowered threshold
      const resultLowered = evaluatePostconditions(input, { minCoverageForPass: 50 });
      expect(resultLowered.clauseResults[0]?.status).toBe('PASS');
    });
  });

  // =============================================================================
  // EVIDENCE LADDER RUNG 3: RUNTIME_ASSERT
  // =============================================================================
  describe('RUNTIME_ASSERT evidence (ladder rung 3)', () => {
    it('should PARTIAL when runtime assert present but not executed', () => {
      const result = evaluatePostconditions({
        specClauses: runtimeAssertsFixture.clauses as SpecClause[],
        evidence: runtimeAssertsFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.status).toBe('PARTIAL');
      expect(result.clauseResults[0]?.evidenceType).toBe('RUNTIME_ASSERT');
    });

    it('should provide next step to execute tests for runtime assert', () => {
      const result = evaluatePostconditions({
        specClauses: runtimeAssertsFixture.clauses as SpecClause[],
        evidence: runtimeAssertsFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.requiredNextStep).toMatch(/execute/i);
    });

    it('should note that assertion is present but not executed', () => {
      const result = evaluatePostconditions({
        specClauses: runtimeAssertsFixture.clauses as SpecClause[],
        evidence: runtimeAssertsFixture.evidence as Evidence[],
      });

      expect(
        result.clauseResults[0]?.notes.some(
          (n) => n.includes('not yet executed') || n.includes('present')
        )
      ).toBe(true);
    });

    it('should match runtime assert by expression pattern', () => {
      const input: EvaluationInput = {
        specClauses: [
          { id: 'post-stock', expression: 'item.stock >= 0' },
        ],
        evidence: [
          {
            type: 'RUNTIME_ASSERT',
            source: 'inventory.ts',
            description: 'Checks item.stock non-negative',
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.evidence.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // EVIDENCE LADDER RUNG 4: HEURISTIC_MATCH
  // =============================================================================
  describe('HEURISTIC_MATCH evidence (ladder rung 4)', () => {
    it('should PARTIAL when only heuristic evidence (default config)', () => {
      const result = evaluatePostconditions({
        specClauses: heuristicMatchFixture.clauses as SpecClause[],
        evidence: heuristicMatchFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.status).toBe('PARTIAL');
      expect(result.clauseResults[0]?.evidenceType).toBe('HEURISTIC_MATCH');
    });

    it('should FAIL when heuristic not allowed and only heuristic evidence', () => {
      const result = evaluatePostconditions(
        {
          specClauses: heuristicMatchFixture.clauses as SpecClause[],
          evidence: heuristicMatchFixture.evidence as Evidence[],
        },
        { allowHeuristicPartial: false }
      );

      expect(result.clauseResults[0]?.status).toBe('FAIL');
    });

    it('should have lower confidence for heuristic evidence', () => {
      const result = evaluatePostconditions({
        specClauses: heuristicMatchFixture.clauses as SpecClause[],
        evidence: heuristicMatchFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.confidence).toBeLessThan(0.6);
    });

    it('should suggest adding explicit test as next step', () => {
      const result = evaluatePostconditions({
        specClauses: heuristicMatchFixture.clauses as SpecClause[],
        evidence: heuristicMatchFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.requiredNextStep).toMatch(/test/i);
    });
  });

  // =============================================================================
  // EVIDENCE LADDER RUNG 5: NO_EVIDENCE
  // =============================================================================
  describe('NO_EVIDENCE (ladder rung 5)', () => {
    it('should FAIL when no evidence found', () => {
      const result = evaluatePostconditions({
        specClauses: noEvidenceFixture.clauses as SpecClause[],
        evidence: noEvidenceFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.status).toBe('FAIL');
      expect(result.clauseResults[0]?.evidenceType).toBe('NO_EVIDENCE');
    });

    it('should FAIL for all clauses with no evidence', () => {
      const result = evaluatePostconditions({
        specClauses: noEvidenceFixture.clauses as SpecClause[],
        evidence: noEvidenceFixture.evidence as Evidence[],
      });

      result.clauseResults.forEach((r) => {
        expect(r.status).toBe('FAIL');
        expect(r.evidenceType).toBe('NO_EVIDENCE');
      });
    });

    it('should have zero confidence for no evidence', () => {
      const result = evaluatePostconditions({
        specClauses: noEvidenceFixture.clauses as SpecClause[],
        evidence: noEvidenceFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.confidence).toBeLessThan(0.3);
    });

    it('should suggest adding test as next step', () => {
      const result = evaluatePostconditions({
        specClauses: noEvidenceFixture.clauses as SpecClause[],
        evidence: noEvidenceFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.requiredNextStep).toMatch(/test|assert/i);
    });
  });

  // =============================================================================
  // CONTRADICTING EVIDENCE
  // =============================================================================
  describe('Contradicting evidence', () => {
    it('should FAIL when test failed (contradicting)', () => {
      const result = evaluatePostconditions({
        specClauses: contradictingFixture.clauses as SpecClause[],
        evidence: contradictingFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.status).toBe('FAIL');
    });

    it('should FAIL when evidence has contradicts flag', () => {
      const result = evaluatePostconditions({
        specClauses: contradictingFixture.clauses as SpecClause[],
        evidence: contradictingFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[1]?.status).toBe('FAIL');
    });

    it('should note contradicting evidence in notes', () => {
      const result = evaluatePostconditions({
        specClauses: contradictingFixture.clauses as SpecClause[],
        evidence: contradictingFixture.evidence as Evidence[],
      });

      expect(
        result.clauseResults[0]?.notes.some((n) => n.toLowerCase().includes('contradict'))
      ).toBe(true);
    });

    it('should suggest fixing failing test as next step', () => {
      const result = evaluatePostconditions({
        specClauses: contradictingFixture.clauses as SpecClause[],
        evidence: contradictingFixture.evidence as Evidence[],
      });

      expect(result.clauseResults[0]?.requiredNextStep).toMatch(/fix/i);
    });

    it('should PARTIAL for non-contradicting evidence in same set', () => {
      const result = evaluatePostconditions({
        specClauses: contradictingFixture.clauses as SpecClause[],
        evidence: contradictingFixture.evidence as Evidence[],
      });

      // post-refund-processed has RUNTIME_ASSERT but no contradiction
      expect(result.clauseResults[2]?.status).toBe('PARTIAL');
    });
  });

  // =============================================================================
  // MIXED EVIDENCE - Evidence Ladder Resolution
  // =============================================================================
  describe('Mixed evidence - ladder resolution', () => {
    it('should use strongest evidence type (BINDING_PROOF > EXECUTED_TEST)', () => {
      const result = evaluatePostconditions({
        specClauses: mixedEvidenceFixture.clauses as SpecClause[],
        evidence: mixedEvidenceFixture.evidence as Evidence[],
      });

      // post-cart-items has both BINDING_PROOF and EXECUTED_TEST
      expect(result.clauseResults[0]?.evidenceType).toBe('BINDING_PROOF');
      expect(result.clauseResults[0]?.status).toBe('PASS');
    });

    it('should use EXECUTED_TEST over RUNTIME_ASSERT', () => {
      const result = evaluatePostconditions({
        specClauses: mixedEvidenceFixture.clauses as SpecClause[],
        evidence: mixedEvidenceFixture.evidence as Evidence[],
      });

      // post-checkout-complete has both EXECUTED_TEST (75% cov) and RUNTIME_ASSERT
      expect(result.clauseResults[1]?.evidenceType).toBe('EXECUTED_TEST');
    });

    it('should use RUNTIME_ASSERT over HEURISTIC_MATCH', () => {
      const result = evaluatePostconditions({
        specClauses: mixedEvidenceFixture.clauses as SpecClause[],
        evidence: mixedEvidenceFixture.evidence as Evidence[],
      });

      // post-shipping-calculated has both HEURISTIC_MATCH and RUNTIME_ASSERT
      expect(result.clauseResults[2]?.evidenceType).toBe('RUNTIME_ASSERT');
    });

    it('should include all matched evidence in result', () => {
      const result = evaluatePostconditions({
        specClauses: mixedEvidenceFixture.clauses as SpecClause[],
        evidence: mixedEvidenceFixture.evidence as Evidence[],
      });

      // post-cart-items should have 2 pieces of evidence
      expect(result.clauseResults[0]?.evidence.length).toBe(2);
    });
  });

  // =============================================================================
  // SUMMARY STATISTICS
  // =============================================================================
  describe('Summary statistics', () => {
    it('should calculate correct totals', () => {
      const result = evaluatePostconditions({
        specClauses: mixedEvidenceFixture.clauses as SpecClause[],
        evidence: mixedEvidenceFixture.evidence as Evidence[],
      });

      expect(result.summary.total).toBe(3);
    });

    it('should calculate pass rate', () => {
      const result = evaluatePostconditions({
        specClauses: bindingProofFixture.clauses as SpecClause[],
        evidence: bindingProofFixture.evidence as Evidence[],
      });

      expect(result.summary.passRate).toBe(1); // All pass
    });

    it('should include evaluation timestamp', () => {
      const result = evaluatePostconditions({
        specClauses: [{ id: 'test', expression: 'true' }],
        evidence: [],
      });

      expect(result.evaluatedAt).toBeDefined();
      expect(new Date(result.evaluatedAt).getTime()).not.toBeNaN();
    });

    it('should count each status correctly', () => {
      const result = evaluatePostconditions({
        specClauses: [
          { id: 'p1', expression: 'a' },
          { id: 'p2', expression: 'b' },
          { id: 'p3', expression: 'c' },
        ],
        evidence: [
          { type: 'BINDING_PROOF', source: 'p1', description: 'proof for p1' },
          { type: 'RUNTIME_ASSERT', source: 'p2', description: 'assert for p2' },
          // p3 has no evidence
        ],
      });

      expect(result.summary.passed).toBe(1);
      expect(result.summary.partial).toBe(1);
      expect(result.summary.failed).toBe(1);
    });
  });

  // =============================================================================
  // EVIDENCE MATCHING
  // =============================================================================
  describe('Evidence matching', () => {
    it('should match evidence by clause ID in source', () => {
      const input: EvaluationInput = {
        specClauses: [{ id: 'post-auth-token', expression: 'result.token != null' }],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'test-post-auth-token.ts',
            description: 'Auth test',
            coverage: 100,
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.evidence.length).toBe(1);
    });

    it('should match evidence by clause ID in description', () => {
      const input: EvaluationInput = {
        specClauses: [{ id: 'post-user-email', expression: 'result.email' }],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'user.test.ts',
            description: 'Verifies post-user-email is returned',
            coverage: 100,
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.evidence.length).toBe(1);
    });

    it('should match evidence by expression pattern', () => {
      const input: EvaluationInput = {
        specClauses: [
          { id: 'post-status', expression: "result.status == 'success'" },
        ],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'api.test.ts',
            description: "Test checks result.status equals success",
            coverage: 100,
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.evidence.length).toBe(1);
    });

    it('should match evidence by behavior ID', () => {
      const input: EvaluationInput = {
        specClauses: [
          {
            id: 'post-order-created',
            expression: 'result.orderId != null',
            behaviorId: 'CreateOrder',
          },
        ],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'CreateOrder.test.ts',
            description: 'Tests order creation',
            coverage: 100,
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.evidence.length).toBe(1);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================
  describe('Edge cases', () => {
    it('should handle empty clauses', () => {
      const result = evaluatePostconditions({
        specClauses: [],
        evidence: [
          { type: 'BINDING_PROOF', source: 'test', description: 'proof' },
        ],
      });

      expect(result.clauseResults).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.passRate).toBe(0);
    });

    it('should handle empty evidence', () => {
      const result = evaluatePostconditions({
        specClauses: [{ id: 'test', expression: 'true' }],
        evidence: [],
      });

      expect(result.clauseResults[0]?.status).toBe('FAIL');
      expect(result.clauseResults[0]?.evidenceType).toBe('NO_EVIDENCE');
    });

    it('should handle special characters in expressions', () => {
      const input: EvaluationInput = {
        specClauses: [
          { id: 'post-regex', expression: "result.pattern =~ /^[a-z]+$/" },
        ],
        evidence: [
          {
            type: 'EXECUTED_TEST',
            source: 'regex.test.ts',
            description: 'Tests post-regex pattern matching',
            coverage: 100,
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.status).toBe('PASS');
    });

    it('should handle long expressions', () => {
      const longExpr =
        'result.data.items.filter(i => i.active).map(i => i.value).reduce((a, b) => a + b, 0) > 0';
      const input: EvaluationInput = {
        specClauses: [{ id: 'post-complex', expression: longExpr }],
        evidence: [
          {
            type: 'BINDING_PROOF',
            source: 'type-check',
            description: 'Proves post-complex via types',
          },
        ],
      };

      const result = evaluatePostconditions(input);
      expect(result.clauseResults[0]?.status).toBe('PASS');
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
describe('compareEvidenceTypes', () => {
  it('should return negative when first is stronger', () => {
    expect(compareEvidenceTypes('BINDING_PROOF', 'EXECUTED_TEST')).toBeLessThan(0);
    expect(compareEvidenceTypes('EXECUTED_TEST', 'RUNTIME_ASSERT')).toBeLessThan(0);
    expect(compareEvidenceTypes('RUNTIME_ASSERT', 'HEURISTIC_MATCH')).toBeLessThan(0);
  });

  it('should return positive when second is stronger', () => {
    expect(compareEvidenceTypes('NO_EVIDENCE', 'BINDING_PROOF')).toBeGreaterThan(0);
    expect(compareEvidenceTypes('HEURISTIC_MATCH', 'EXECUTED_TEST')).toBeGreaterThan(0);
  });

  it('should return zero for same type', () => {
    expect(compareEvidenceTypes('BINDING_PROOF', 'BINDING_PROOF')).toBe(0);
    expect(compareEvidenceTypes('EXECUTED_TEST', 'EXECUTED_TEST')).toBe(0);
  });
});

describe('isEvidenceSufficientFor', () => {
  it('should return true for BINDING_PROOF achieving PASS', () => {
    expect(isEvidenceSufficientFor('BINDING_PROOF', 'PASS')).toBe(true);
  });

  it('should return true for EXECUTED_TEST achieving PASS', () => {
    expect(isEvidenceSufficientFor('EXECUTED_TEST', 'PASS')).toBe(true);
  });

  it('should return false for RUNTIME_ASSERT achieving PASS', () => {
    expect(isEvidenceSufficientFor('RUNTIME_ASSERT', 'PASS')).toBe(false);
  });

  it('should return true for RUNTIME_ASSERT achieving PARTIAL', () => {
    expect(isEvidenceSufficientFor('RUNTIME_ASSERT', 'PARTIAL')).toBe(true);
  });

  it('should return false for HEURISTIC_MATCH achieving PARTIAL when not allowed', () => {
    expect(
      isEvidenceSufficientFor('HEURISTIC_MATCH', 'PARTIAL', {
        allowHeuristicPartial: false,
      })
    ).toBe(false);
  });
});

describe('getRequiredEvidenceFor', () => {
  it('should return BINDING_PROOF and EXECUTED_TEST for PASS', () => {
    const required = getRequiredEvidenceFor('PASS');
    expect(required).toContain('BINDING_PROOF');
    expect(required).toContain('EXECUTED_TEST');
    expect(required).not.toContain('RUNTIME_ASSERT');
  });

  it('should include RUNTIME_ASSERT for PARTIAL', () => {
    const required = getRequiredEvidenceFor('PARTIAL');
    expect(required).toContain('RUNTIME_ASSERT');
  });

  it('should return NO_EVIDENCE for FAIL', () => {
    const required = getRequiredEvidenceFor('FAIL');
    expect(required).toContain('NO_EVIDENCE');
  });
});

describe('EVIDENCE_PRIORITY', () => {
  it('should have BINDING_PROOF as highest priority (1)', () => {
    expect(EVIDENCE_PRIORITY.BINDING_PROOF).toBe(1);
  });

  it('should have NO_EVIDENCE as lowest priority (5)', () => {
    expect(EVIDENCE_PRIORITY.NO_EVIDENCE).toBe(5);
  });

  it('should have correct ordering', () => {
    expect(EVIDENCE_PRIORITY.BINDING_PROOF).toBeLessThan(EVIDENCE_PRIORITY.EXECUTED_TEST);
    expect(EVIDENCE_PRIORITY.EXECUTED_TEST).toBeLessThan(EVIDENCE_PRIORITY.RUNTIME_ASSERT);
    expect(EVIDENCE_PRIORITY.RUNTIME_ASSERT).toBeLessThan(EVIDENCE_PRIORITY.HEURISTIC_MATCH);
    expect(EVIDENCE_PRIORITY.HEURISTIC_MATCH).toBeLessThan(EVIDENCE_PRIORITY.NO_EVIDENCE);
  });
});
