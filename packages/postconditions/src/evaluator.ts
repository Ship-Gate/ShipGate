/**
 * Postcondition evaluator with evidence-based PASS/PARTIAL/FAIL semantics.
 *
 * Evidence Ladder (highest to lowest priority):
 * 1. BINDING_PROOF - Static bindings prove the postcondition
 * 2. EXECUTED_TEST - Test executed and assertion passed with coverage
 * 3. RUNTIME_ASSERT - Runtime assertion present but not yet executed
 * 4. HEURISTIC_MATCH - Heuristic analysis suggests compliance
 * 5. NO_EVIDENCE - No evidence found
 */

import type {
  ClauseResult,
  EvaluationInput,
  EvaluationResult,
  EvaluatorConfig,
  Evidence,
  EvidenceType,
  PostconditionStatus,
  SpecClause,
} from './types.js';
import { EVIDENCE_PRIORITY } from './types.js';

/**
 * Internal configuration type with fully resolved evidence priority.
 */
interface ResolvedConfig {
  minCoverageForPass: number;
  requireExecutedTests: boolean;
  allowHeuristicPartial: boolean;
  evidencePriority: Record<EvidenceType, number>;
}

/**
 * Default configuration for the evaluator.
 * 70% coverage is the stable MVP threshold - provides flexibility for
 * partial test coverage while still requiring meaningful verification
 */
const DEFAULT_CONFIG: ResolvedConfig = {
  minCoverageForPass: 70,
  requireExecutedTests: false,
  allowHeuristicPartial: true,
  evidencePriority: EVIDENCE_PRIORITY,
};

/**
 * Match evidence to clauses by analyzing expression patterns.
 */
function matchEvidenceToClause(
  clause: SpecClause,
  evidence: Evidence[]
): Evidence[] {
  const matched: Evidence[] = [];

  for (const e of evidence) {
    // Direct ID match in source or description
    if (
      e.source.includes(clause.id) ||
      e.description.toLowerCase().includes(clause.id.toLowerCase())
    ) {
      matched.push(e);
      continue;
    }

    // Expression pattern matching
    const exprPatterns = extractPatterns(clause.expression);
    const clauseDescPatterns = clause.description
      ? extractPatterns(clause.description)
      : [];
    const allClausePatterns = [...exprPatterns, ...clauseDescPatterns];

    const evidenceText = `${e.source} ${e.description}`.toLowerCase();

    // Check if significant patterns match
    let matchCount = 0;
    const significantPatterns = allClausePatterns.filter((p) => p.length >= 3);

    for (const pattern of significantPatterns) {
      if (evidenceText.includes(pattern.toLowerCase())) {
        matchCount++;
      }
    }

    // Match if at least 1 significant pattern matches, or multiple short patterns
    if (matchCount >= 1) {
      matched.push(e);
      continue;
    }

    // Also check shorter patterns (2 chars) but require more matches
    const shortPatterns = allClausePatterns.filter(
      (p) => p.length === 2 && /^[a-z]+$/i.test(p)
    );
    let shortMatchCount = 0;
    for (const pattern of shortPatterns) {
      // For short patterns, use word boundary matching
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(evidenceText)) {
        shortMatchCount++;
      }
    }
    if (shortMatchCount >= 2) {
      matched.push(e);
      continue;
    }

    // Behavior ID match
    if (clause.behaviorId && e.source.includes(clause.behaviorId)) {
      matched.push(e);
    }
  }

  return matched;
}

/**
 * Extract meaningful patterns from an expression for matching.
 */
function extractPatterns(expression: string): string[] {
  const patterns: string[] = [];

  // Common words to ignore
  const ignoreWords = new Set([
    'result',
    'input',
    'error',
    'typeof',
    'null',
    'true',
    'false',
    'undefined',
    'the',
    'and',
    'for',
    'must',
    'should',
    'have',
    'return',
    'returns',
    'test',
    'tests',
    'after',
    'before',
  ]);

  // Extract identifiers (variable names, property access)
  const identifiers = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
  if (identifiers) {
    for (const id of identifiers) {
      // Skip very common words
      if (!ignoreWords.has(id.toLowerCase()) && id.length >= 2) {
        patterns.push(id);
        // Also add parts of camelCase or dot-notation
        const parts = id.split(/(?=[A-Z])|[._]/);
        for (const part of parts) {
          if (part.length >= 2 && !ignoreWords.has(part.toLowerCase())) {
            patterns.push(part);
          }
        }
      }
    }
  }

  // Extract string literals
  const stringLiterals = expression.match(/'[^']*'|"[^"]*"/g);
  if (stringLiterals) {
    for (const s of stringLiterals) {
      const literal = s.slice(1, -1);
      if (literal.length >= 2 && !ignoreWords.has(literal.toLowerCase())) {
        patterns.push(literal);
      }
    }
  }

  return [...new Set(patterns)];
}

/**
 * Get the strongest evidence type from a list of evidence.
 */
function getStrongestEvidenceType(
  evidence: Evidence[],
  priority: Record<EvidenceType, number>
): EvidenceType {
  if (evidence.length === 0) {
    return 'NO_EVIDENCE';
  }

  return evidence.reduce((strongest, e) => {
    const currentPriority = priority[e.type] ?? 5;
    const strongestPriority = priority[strongest] ?? 5;
    return currentPriority < strongestPriority ? e.type : strongest;
  }, 'NO_EVIDENCE' as EvidenceType);
}

/**
 * Check if evidence contains contradicting information.
 */
function hasContradictingEvidence(evidence: Evidence[]): boolean {
  // Look for explicit failure indicators in metadata
  for (const e of evidence) {
    if (e.metadata?.['failed'] === true) {
      return true;
    }
    if (e.metadata?.['contradicts'] === true) {
      return true;
    }
    if (
      e.description.toLowerCase().includes('fail') &&
      !e.description.toLowerCase().includes('should fail')
    ) {
      // Check if it's an actual failure, not a "test for failure"
      if (e.type === 'EXECUTED_TEST' && e.metadata?.['passed'] === false) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determine status based on evidence type and configuration.
 */
function determineStatus(
  evidenceType: EvidenceType,
  evidence: Evidence[],
  config: ResolvedConfig
): PostconditionStatus {
  // Check for contradicting evidence first
  if (hasContradictingEvidence(evidence)) {
    return 'FAIL';
  }

  switch (evidenceType) {
    case 'BINDING_PROOF':
      // Static proofs always pass
      return 'PASS';

    case 'EXECUTED_TEST': {
      // Check coverage requirements
      const testEvidence = evidence.filter((e) => e.type === 'EXECUTED_TEST');
      const avgCoverage = calculateAverageCoverage(testEvidence);

      if (avgCoverage >= config.minCoverageForPass) {
        return 'PASS';
      }
      // Executed but low coverage = PARTIAL
      return 'PARTIAL';
    }

    case 'RUNTIME_ASSERT':
      // Assert present but not executed = PARTIAL
      return 'PARTIAL';

    case 'HEURISTIC_MATCH':
      // Heuristic match = PARTIAL (if allowed) or FAIL
      return config.allowHeuristicPartial ? 'PARTIAL' : 'FAIL';

    case 'NO_EVIDENCE':
      // No evidence = FAIL
      return 'FAIL';

    default:
      return 'FAIL';
  }
}

/**
 * Calculate average coverage from test evidence.
 */
function calculateAverageCoverage(evidence: Evidence[]): number {
  const withCoverage = evidence.filter((e) => e.coverage !== undefined);
  if (withCoverage.length === 0) {
    // No coverage info but tests passed = assume full coverage
    return 100;
  }
  const total = withCoverage.reduce((sum, e) => sum + (e.coverage ?? 0), 0);
  return total / withCoverage.length;
}

/**
 * Calculate confidence score based on evidence strength and quantity.
 */
function calculateConfidence(
  evidenceType: EvidenceType,
  evidence: Evidence[],
  config: ResolvedConfig
): number {
  const priority = config.evidencePriority[evidenceType] ?? 5;

  // Base confidence from evidence type (inverse of priority)
  const typeConfidence = Math.max(0, 1 - (priority - 1) * 0.2);

  // Bonus for multiple pieces of evidence (capped at 0.2)
  const quantityBonus = Math.min(0.2, evidence.length * 0.05);

  // Coverage bonus for executed tests
  let coverageBonus = 0;
  if (evidenceType === 'EXECUTED_TEST') {
    const avgCoverage = calculateAverageCoverage(evidence);
    coverageBonus = (avgCoverage / 100) * 0.1;
  }

  return Math.min(1, typeConfidence + quantityBonus + coverageBonus);
}

/**
 * Generate notes explaining the evaluation.
 */
function generateNotes(
  status: PostconditionStatus,
  evidenceType: EvidenceType,
  evidence: Evidence[],
  config: ResolvedConfig
): string[] {
  const notes: string[] = [];

  // Evidence type note
  notes.push(`Evidence type: ${evidenceType}`);

  // Count by type
  const byCounts = evidence.reduce(
    (acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<EvidenceType, number>
  );

  if (Object.keys(byCounts).length > 0) {
    const countStr = Object.entries(byCounts)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    notes.push(`Evidence breakdown: ${countStr}`);
  }

  // Status-specific notes
  switch (status) {
    case 'PASS':
      if (evidenceType === 'BINDING_PROOF') {
        notes.push('Postcondition proven via static binding/type system');
      } else if (evidenceType === 'EXECUTED_TEST') {
        const testEvidence = evidence.filter((e) => e.type === 'EXECUTED_TEST');
        const avgCoverage = calculateAverageCoverage(testEvidence);
        notes.push(`Tests executed with ${avgCoverage.toFixed(0)}% coverage`);
      }
      break;

    case 'PARTIAL':
      if (evidenceType === 'EXECUTED_TEST') {
        const testEvidence = evidence.filter((e) => e.type === 'EXECUTED_TEST');
        const avgCoverage = calculateAverageCoverage(testEvidence);
        notes.push(
          `Test coverage is ${avgCoverage.toFixed(0)}% (required: ${config.minCoverageForPass}%)`
        );
      } else if (evidenceType === 'RUNTIME_ASSERT') {
        notes.push('Runtime assertion present but not yet executed in tests');
      } else if (evidenceType === 'HEURISTIC_MATCH') {
        notes.push('Only heuristic evidence available');
      }
      break;

    case 'FAIL':
      if (hasContradictingEvidence(evidence)) {
        notes.push('Contradicting evidence found: test failed or assertion violated');
      } else if (evidenceType === 'NO_EVIDENCE') {
        notes.push('No evidence found for this postcondition');
      }
      break;
  }

  return notes;
}

/**
 * Generate the required next step to improve status.
 */
function generateRequiredNextStep(
  status: PostconditionStatus,
  evidenceType: EvidenceType,
  clause: SpecClause,
  evidence: Evidence[],
  config: ResolvedConfig
): string | undefined {
  if (status === 'PASS') {
    return undefined;
  }

  // Check for contradicting evidence first - this takes priority
  if (hasContradictingEvidence(evidence)) {
    return 'Fix the failing test or resolve contradicting evidence';
  }

  switch (evidenceType) {
    case 'EXECUTED_TEST': {
      const testEvidence = evidence.filter((e) => e.type === 'EXECUTED_TEST');
      const avgCoverage = calculateAverageCoverage(testEvidence);
      return `Increase test coverage from ${avgCoverage.toFixed(0)}% to at least ${config.minCoverageForPass}%`;
    }

    case 'RUNTIME_ASSERT':
      return `Execute tests that trigger the runtime assertion for clause "${clause.id}"`;

    case 'HEURISTIC_MATCH':
      return `Add explicit test for: ${clause.expression}`;

    case 'NO_EVIDENCE':
      return `Add test or runtime assertion for: ${clause.expression}`;

    default:
      return `Provide evidence for clause "${clause.id}"`;
  }
}

/**
 * Evaluate a single postcondition clause.
 */
function evaluateClause(
  clause: SpecClause,
  allEvidence: Evidence[],
  config: ResolvedConfig
): ClauseResult {
  // Match evidence to this clause
  const matchedEvidence = matchEvidenceToClause(clause, allEvidence);

  // Get the strongest evidence type
  const evidenceType = getStrongestEvidenceType(
    matchedEvidence,
    config.evidencePriority
  );

  // Determine status
  const status = determineStatus(evidenceType, matchedEvidence, config);

  // Calculate confidence
  const confidence = calculateConfidence(evidenceType, matchedEvidence, config);

  // Generate notes
  const notes = generateNotes(status, evidenceType, matchedEvidence, config);

  // Generate required next step
  const requiredNextStep = generateRequiredNextStep(
    status,
    evidenceType,
    clause,
    matchedEvidence,
    config
  );

  return {
    clauseId: clause.id,
    status,
    evidenceType,
    evidence: matchedEvidence,
    notes,
    requiredNextStep,
    confidence,
  };
}

/**
 * Evaluate postconditions with evidence-based semantics.
 *
 * @param input - Specification clauses and collected evidence
 * @param config - Optional evaluator configuration
 * @returns Evaluation results for each clause
 *
 * @example
 * ```typescript
 * const result = evaluatePostconditions({
 *   specClauses: [
 *     { id: 'post-1', expression: 'result.status == "success"' }
 *   ],
 *   evidence: [
 *     { type: 'EXECUTED_TEST', source: 'test-post-1.ts', description: 'checks status' }
 *   ]
 * });
 * // result.clauseResults[0].status === 'PASS'
 * ```
 */
export function evaluatePostconditions(
  input: EvaluationInput,
  config?: EvaluatorConfig
): EvaluationResult {
  const mergedConfig: ResolvedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    evidencePriority: {
      ...DEFAULT_CONFIG.evidencePriority,
      ...config?.evidencePriority,
    },
  };

  // Evaluate each clause
  const clauseResults = input.specClauses.map((clause) =>
    evaluateClause(clause, input.evidence, mergedConfig)
  );

  // Calculate summary
  const total = clauseResults.length;
  const passed = clauseResults.filter((r) => r.status === 'PASS').length;
  const partial = clauseResults.filter((r) => r.status === 'PARTIAL').length;
  const failed = clauseResults.filter((r) => r.status === 'FAIL').length;
  const passRate = total > 0 ? passed / total : 0;

  return {
    clauseResults,
    summary: {
      total,
      passed,
      partial,
      failed,
      passRate,
    },
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Compare two evidence types by priority.
 * Returns negative if a is stronger, positive if b is stronger, 0 if equal.
 */
export function compareEvidenceTypes(
  a: EvidenceType,
  b: EvidenceType,
  priority: Record<EvidenceType, number> = EVIDENCE_PRIORITY
): number {
  return (priority[a] ?? 5) - (priority[b] ?? 5);
}

/**
 * Check if evidence is strong enough for a given status.
 */
export function isEvidenceSufficientFor(
  evidenceType: EvidenceType,
  targetStatus: PostconditionStatus,
  config?: EvaluatorConfig
): boolean {
  const mergedConfig: ResolvedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    evidencePriority: {
      ...DEFAULT_CONFIG.evidencePriority,
      ...config?.evidencePriority,
    },
  };

  switch (targetStatus) {
    case 'PASS':
      return (
        evidenceType === 'BINDING_PROOF' || evidenceType === 'EXECUTED_TEST'
      );

    case 'PARTIAL':
      return (
        evidenceType === 'BINDING_PROOF' ||
        evidenceType === 'EXECUTED_TEST' ||
        evidenceType === 'RUNTIME_ASSERT' ||
        (mergedConfig.allowHeuristicPartial &&
          evidenceType === 'HEURISTIC_MATCH')
      );

    case 'FAIL':
      return true; // Any evidence can result in FAIL
  }
}

/**
 * Get the required evidence type to achieve a target status.
 */
export function getRequiredEvidenceFor(
  targetStatus: PostconditionStatus
): EvidenceType[] {
  switch (targetStatus) {
    case 'PASS':
      return ['BINDING_PROOF', 'EXECUTED_TEST'];
    case 'PARTIAL':
      return ['BINDING_PROOF', 'EXECUTED_TEST', 'RUNTIME_ASSERT', 'HEURISTIC_MATCH'];
    case 'FAIL':
      return ['NO_EVIDENCE'];
  }
}
