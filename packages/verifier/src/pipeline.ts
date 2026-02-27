// ============================================================================
// Verification Pipeline - Main entry point
// ============================================================================

import type {
  SpecAST,
  VerifyOptions,
  EvidenceReport,
  ClauseResult,
  WorkspaceScanArtifacts,
} from './types';
import { scanWorkspace } from './scanner';
import { bindEvidence, updateClauseWithAssertion } from './evidence';
import { computeScore, DEFAULT_SHIP_THRESHOLD } from './scoring';
import { generateReport } from './report';

/**
 * Main verification pipeline
 * Input: spec AST + workspace root
 * Output: deterministic evidence report
 */
export function verify(
  spec: SpecAST,
  options: VerifyOptions
): EvidenceReport {
  // 1. Scan workspace for artifacts
  const artifacts = scanWorkspace({
    workspaceRoot: options.workspaceRoot,
    testPatterns: options.testPatterns,
    implPatterns: options.implPatterns,
  });
  
  // 2. Bind evidence to spec clauses
  const clauseResults = bindEvidence(spec, artifacts, options.behavior);
  
  // 3. Compute score
  const shipThreshold = options.shipThreshold ?? DEFAULT_SHIP_THRESHOLD;
  const { score, breakdown, verdict, blockingIssues } = computeScore(
    clauseResults,
    artifacts,
    shipThreshold
  );
  
  // 4. Generate report
  return generateReport(
    spec,
    clauseResults,
    artifacts,
    score,
    breakdown,
    verdict,
    blockingIssues,
    options.behavior
  );
}

/**
 * Verify with pre-scanned artifacts
 * Useful for testing or when artifacts are already available
 */
export function verifyWithArtifacts(
  spec: SpecAST,
  artifacts: WorkspaceScanArtifacts,
  options: Partial<VerifyOptions> = {}
): EvidenceReport {
  // 1. Bind evidence to spec clauses
  const clauseResults = bindEvidence(spec, artifacts, options.behavior);
  
  // 2. Compute score
  const shipThreshold = options.shipThreshold ?? DEFAULT_SHIP_THRESHOLD;
  const { score, breakdown, verdict, blockingIssues } = computeScore(
    clauseResults,
    artifacts,
    shipThreshold
  );
  
  // 3. Generate report
  return generateReport(
    spec,
    clauseResults,
    artifacts,
    score,
    breakdown,
    verdict,
    blockingIssues,
    options.behavior
  );
}

/**
 * Re-verify after assertion execution results
 * Used for mutation testing - run tests, update evidence, regenerate report
 */
export function verifyWithAssertionResults(
  spec: SpecAST,
  artifacts: WorkspaceScanArtifacts,
  assertionResults: Map<string, boolean>, // evidenceId -> passed
  options: Partial<VerifyOptions> = {}
): EvidenceReport {
  // 1. Bind evidence to spec clauses
  let clauseResults = bindEvidence(spec, artifacts, options.behavior);
  
  // 2. Update clause results with assertion execution results
  clauseResults = applyAssertionResults(clauseResults, assertionResults);
  
  // 3. Compute score
  const shipThreshold = options.shipThreshold ?? DEFAULT_SHIP_THRESHOLD;
  const { score, breakdown, verdict, blockingIssues } = computeScore(
    clauseResults,
    artifacts,
    shipThreshold
  );
  
  // 4. Generate report
  return generateReport(
    spec,
    clauseResults,
    artifacts,
    score,
    breakdown,
    verdict,
    blockingIssues,
    options.behavior
  );
}

/**
 * Apply assertion execution results to clause results
 */
function applyAssertionResults(
  clauseResults: ClauseResult[],
  assertionResults: Map<string, boolean>
): ClauseResult[] {
  return clauseResults.map(clause => {
    // Find evidence with assertion results
    for (const evidence of clause.evidence) {
      if (assertionResults.has(evidence.id)) {
        const passed = assertionResults.get(evidence.id)!;
        return updateClauseWithAssertion(clause, evidence, passed);
      }
    }
    return clause;
  });
}

// ============================================================================
// QUICK VERIFICATION
// ============================================================================

/**
 * Quick verification for a single behavior
 */
export function verifyBehavior(
  spec: SpecAST,
  behaviorName: string,
  options: VerifyOptions
): EvidenceReport {
  return verify(spec, {
    ...options,
    behavior: behaviorName,
  });
}

/**
 * Verify all behaviors and return combined report
 */
export function verifyAll(
  spec: SpecAST,
  options: VerifyOptions
): EvidenceReport {
  return verify(spec, {
    ...options,
    behavior: undefined,
  });
}

// ============================================================================
// SPEC PARSING HELPERS
// ============================================================================

/**
 * Create a minimal spec from raw data
 */
export function createSpec(
  domain: string,
  behaviors: Array<{
    name: string;
    preconditions?: string[];
    postconditions?: string[];
    invariants?: string[];
    security?: string[];
    temporal?: string[];
  }>,
  invariants: Array<{
    name: string;
    predicates: string[];
  }> = []
): SpecAST {
  return {
    domain,
    behaviors: behaviors.map(b => ({
      name: b.name,
      preconditions: (b.preconditions ?? []).map(e => ({ expression: e })),
      postconditions: (b.postconditions ?? []).map(e => ({ expression: e })),
      invariants: (b.invariants ?? []).map(e => ({ expression: e })),
      security: (b.security ?? []).map(e => ({ expression: e })),
      temporal: (b.temporal ?? []).map(e => ({ expression: e })),
    })),
    invariants: invariants.map(i => ({
      name: i.name,
      predicates: i.predicates,
    })),
  };
}

// ============================================================================
// EMPTY/DEFAULT ARTIFACTS
// ============================================================================

/**
 * Create empty artifacts for testing
 */
export function createEmptyArtifacts(): WorkspaceScanArtifacts {
  return {
    testFiles: [],
    bindings: [],
    assertions: [],
  };
}
