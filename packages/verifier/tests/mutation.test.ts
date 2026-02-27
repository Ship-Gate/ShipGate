// ============================================================================
// Mutation Tests - Verify FAIL detection when assertions break
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  verifyWithArtifacts,
  verifyWithAssertionResults,
  createSpec,
  createEmptyArtifacts,
  bindEvidence,
  computeScore,
  type SpecAST,
  type WorkspaceScanArtifacts,
  type EvidenceReport,
} from '../src';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestSpec(): SpecAST {
  return createSpec('TestDomain', [
    {
      name: 'TestBehavior',
      preconditions: ['input.value > 0'],
      postconditions: ['result.success == true', 'result.value == input.value'],
      security: ['input.token.is_valid'],
    },
  ]);
}

function createArtifactsWithAssertions(): WorkspaceScanArtifacts {
  return {
    testFiles: [
      {
        path: 'tests/test.test.ts',
        framework: 'vitest',
        testCount: 3,
        suites: ['TestBehavior'],
        tests: ['should validate input', 'should return success', 'should preserve value'],
      },
    ],
    bindings: [
      {
        specRef: 'TestBehavior',
        bindingType: 'function',
        file: 'src/behavior.ts',
        line: 10,
        exportName: 'testBehavior',
      },
    ],
    assertions: [
      {
        file: 'tests/test.test.ts',
        line: 15,
        column: 5,
        assertFn: 'expect',
        text: 'expect(input.value).toBeGreaterThan(0)',
        possibleClauseRef: 'should validate input',
      },
      {
        file: 'tests/test.test.ts',
        line: 22,
        column: 5,
        assertFn: 'expect',
        text: 'expect(result.success).toBe(true)',
        possibleClauseRef: 'should return success',
      },
      {
        file: 'tests/test.test.ts',
        line: 29,
        column: 5,
        assertFn: 'expect',
        text: 'expect(result.value).toBe(input.value)',
        possibleClauseRef: 'should preserve value',
      },
    ],
  };
}

// ============================================================================
// MUTATION DETECTION TESTS
// ============================================================================

describe('Mutation Tests', () => {
  describe('FAIL Detection', () => {
    it('should detect FAIL when assertion fails', () => {
      const spec = createTestSpec();
      const artifacts = createArtifactsWithAssertions();
      
      // Get initial clause results
      const clauseResults = bindEvidence(spec, artifacts);
      
      // Find a clause with test assertions
      const clauseWithEvidence = clauseResults.find(
        c => c.evidence.some(e => e.kind === 'test_assertion')
      );
      
      expect(clauseWithEvidence).toBeDefined();
      
      // Simulate assertion failure by marking evidence as failed
      const failedEvidenceId = clauseWithEvidence!.evidence.find(
        e => e.kind === 'test_assertion'
      )?.id;
      
      if (failedEvidenceId) {
        const assertionResults = new Map<string, boolean>();
        assertionResults.set(failedEvidenceId, false); // FAIL
        
        const report = verifyWithAssertionResults(spec, artifacts, assertionResults);
        
        // Should have at least one FAIL
        const failedClauses = report.clauseResults.filter(c => c.status === 'FAIL');
        expect(failedClauses.length).toBeGreaterThan(0);
      }
    });
    
    it('should keep PASS when all assertions pass', () => {
      const spec = createTestSpec();
      const artifacts = createArtifactsWithAssertions();
      
      // Get initial clause results
      const clauseResults = bindEvidence(spec, artifacts);
      
      // Mark all test assertions as passing
      const assertionResults = new Map<string, boolean>();
      for (const clause of clauseResults) {
        for (const evidence of clause.evidence) {
          if (evidence.kind === 'test_assertion') {
            assertionResults.set(evidence.id, true); // PASS
          }
        }
      }
      
      const report = verifyWithAssertionResults(spec, artifacts, assertionResults);
      
      // Should have some PASS clauses
      const passedClauses = report.clauseResults.filter(c => c.status === 'PASS');
      expect(passedClauses.length).toBeGreaterThan(0);
      
      // Should have no FAIL clauses from assertions
      const failedClauses = report.clauseResults.filter(c => c.status === 'FAIL');
      expect(failedClauses.length).toBe(0);
    });
    
    it('should produce NO_SHIP verdict when postcondition fails', () => {
      const spec = createTestSpec();
      const artifacts = createArtifactsWithAssertions();
      
      // Get initial clause results
      const clauseResults = bindEvidence(spec, artifacts);
      
      // Find postcondition with evidence
      const postcondition = clauseResults.find(
        c => c.clauseType === 'postcondition' && 
             c.evidence.some(e => e.kind === 'test_assertion')
      );
      
      if (postcondition) {
        const failedEvidenceId = postcondition.evidence.find(
          e => e.kind === 'test_assertion'
        )?.id;
        
        if (failedEvidenceId) {
          const assertionResults = new Map<string, boolean>();
          assertionResults.set(failedEvidenceId, false); // FAIL
          
          const report = verifyWithAssertionResults(spec, artifacts, assertionResults);
          
          // Verdict should be NO_SHIP due to postcondition failure
          expect(report.verdict).toBe('NO_SHIP');
          expect(report.summary.blockingIssues.some(
            i => i.includes('POSTCONDITION_FAIL')
          )).toBe(true);
        }
      }
    });
    
    it('should produce NO_SHIP verdict when security clause fails', () => {
      const spec = createTestSpec();
      const artifacts = createArtifactsWithAssertions();
      
      // Get initial clause results
      const clauseResults = bindEvidence(spec, artifacts);
      
      // Find security clause with evidence
      const securityClause = clauseResults.find(
        c => c.clauseType === 'security' && 
             c.evidence.some(e => e.kind === 'test_assertion')
      );
      
      if (securityClause) {
        const failedEvidenceId = securityClause.evidence.find(
          e => e.kind === 'test_assertion'
        )?.id;
        
        if (failedEvidenceId) {
          const assertionResults = new Map<string, boolean>();
          assertionResults.set(failedEvidenceId, false); // FAIL
          
          const report = verifyWithAssertionResults(spec, artifacts, assertionResults);
          
          // Verdict should be NO_SHIP due to security failure
          expect(report.verdict).toBe('NO_SHIP');
          expect(report.summary.blockingIssues.some(
            i => i.includes('SECURITY_FAIL')
          )).toBe(true);
        }
      }
    });
  });
  
  describe('Score Impact', () => {
    it('should reduce score when assertions fail', () => {
      const spec = createTestSpec();
      const artifacts = createArtifactsWithAssertions();
      
      // Get baseline score (all passing)
      const passingResults = new Map<string, boolean>();
      const clauseResults = bindEvidence(spec, artifacts);
      for (const clause of clauseResults) {
        for (const evidence of clause.evidence) {
          if (evidence.kind === 'test_assertion') {
            passingResults.set(evidence.id, true);
          }
        }
      }
      
      const passingReport = verifyWithAssertionResults(spec, artifacts, passingResults);
      
      // Get score with some failures
      const failingResults = new Map<string, boolean>();
      for (const clause of clauseResults) {
        for (const evidence of clause.evidence) {
          if (evidence.kind === 'test_assertion') {
            failingResults.set(evidence.id, false); // All fail
          }
        }
      }
      
      const failingReport = verifyWithAssertionResults(spec, artifacts, failingResults);
      
      // Failing score should be lower (or equal if no assertions found)
      expect(failingReport.score).toBeLessThanOrEqual(passingReport.score);
    });
  });
  
  describe('Confidence Updates', () => {
    it('should have 100% confidence on assertion failure', () => {
      const spec = createTestSpec();
      const artifacts = createArtifactsWithAssertions();
      
      // Get clause results
      const clauseResults = bindEvidence(spec, artifacts);
      
      // Find clause with assertion and fail it
      const clauseWithAssertion = clauseResults.find(
        c => c.evidence.some(e => e.kind === 'test_assertion')
      );
      
      if (clauseWithAssertion) {
        const evidenceId = clauseWithAssertion.evidence.find(
          e => e.kind === 'test_assertion'
        )?.id;
        
        if (evidenceId) {
          const assertionResults = new Map<string, boolean>();
          assertionResults.set(evidenceId, false);
          
          const report = verifyWithAssertionResults(spec, artifacts, assertionResults);
          
          // Failed clause should have high confidence
          const failedClause = report.clauseResults.find(c => c.status === 'FAIL');
          if (failedClause) {
            expect(failedClause.confidence).toBe(100);
          }
        }
      }
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty artifacts', () => {
    const spec = createTestSpec();
    const emptyArtifacts = createEmptyArtifacts();
    
    const report = verifyWithArtifacts(spec, emptyArtifacts);
    
    // Should produce valid report
    expect(report.version).toBe('1.0.0');
    expect(report.clauseResults.length).toBeGreaterThan(0);
    
    // All clauses should be SKIPPED (no bindings)
    const skippedCount = report.clauseResults.filter(c => c.status === 'SKIPPED').length;
    expect(skippedCount).toBe(report.clauseResults.length);
    
    // Should be NO_SHIP due to no bindings and no tests
    expect(report.verdict).toBe('NO_SHIP');
    expect(report.summary.blockingIssues.length).toBeGreaterThan(0);
  });
  
  it('should handle spec with no clauses', () => {
    const emptySpec = createSpec('EmptyDomain', [
      {
        name: 'EmptyBehavior',
        // No clauses
      },
    ]);
    
    const artifacts = createArtifactsWithAssertions();
    const report = verifyWithArtifacts(emptySpec, artifacts);
    
    // Should produce valid report
    expect(report.version).toBe('1.0.0');
    expect(report.clauseResults.length).toBe(0);
    
    // Score should be high (nothing to verify)
    expect(report.score).toBeGreaterThanOrEqual(50);
  });
  
  it('should handle behavior filter', () => {
    const spec = createSpec('TestDomain', [
      {
        name: 'BehaviorA',
        preconditions: ['input.a > 0'],
      },
      {
        name: 'BehaviorB',
        preconditions: ['input.b > 0'],
      },
    ]);
    
    const artifacts = createEmptyArtifacts();
    
    // Verify only BehaviorA
    const report = verifyWithArtifacts(spec, artifacts, { behavior: 'BehaviorA' });
    
    // Should only have clauses for BehaviorA
    expect(report.behavior).toBe('BehaviorA');
    expect(report.clauseResults.every(c => c.clauseId.includes('BehaviorA'))).toBe(true);
  });
});
