// ============================================================================
// Evidence Binder - Link spec clauses to implementation evidence
// ============================================================================

import * as crypto from 'node:crypto';
import type {
  Evidence,
  EvidenceKind,
  ClauseResult,
  ClauseStatus,
  SpecAST,
  BehaviorSpec,
  ClauseSpec,
  WorkspaceScanArtifacts,
  AssertionInfo,
  BindingInfo,
} from './types';

/**
 * Bind evidence to spec clauses
 * Returns deterministic results (stable ordering, stable IDs)
 */
export function bindEvidence(
  spec: SpecAST,
  artifacts: WorkspaceScanArtifacts,
  behavior?: string
): ClauseResult[] {
  const results: ClauseResult[] = [];
  
  // Filter behaviors if specific one requested
  const behaviors = behavior
    ? spec.behaviors.filter(b => b.name === behavior)
    : spec.behaviors;
  
  for (const beh of behaviors) {
    // Process preconditions
    results.push(...bindClauseGroup(
      spec.domain,
      beh.name,
      'precondition',
      beh.preconditions,
      artifacts
    ));
    
    // Process postconditions
    results.push(...bindClauseGroup(
      spec.domain,
      beh.name,
      'postcondition',
      beh.postconditions,
      artifacts
    ));
    
    // Process behavior invariants
    results.push(...bindClauseGroup(
      spec.domain,
      beh.name,
      'invariant',
      beh.invariants,
      artifacts
    ));
    
    // Process security clauses
    results.push(...bindClauseGroup(
      spec.domain,
      beh.name,
      'security',
      beh.security,
      artifacts
    ));
    
    // Process temporal clauses
    results.push(...bindClauseGroup(
      spec.domain,
      beh.name,
      'temporal',
      beh.temporal,
      artifacts
    ));
  }
  
  // Process domain invariants
  for (const inv of spec.invariants) {
    for (let i = 0; i < inv.predicates.length; i++) {
      const predicate = inv.predicates[i]!;
      results.push(bindSingleClause(
        spec.domain,
        inv.name,
        'invariant',
        i,
        { expression: predicate },
        artifacts
      ));
    }
  }
  
  // Sort for deterministic output
  return results.sort((a, b) => a.clauseId.localeCompare(b.clauseId));
}

/**
 * Bind a group of clauses of the same type
 */
function bindClauseGroup(
  domain: string,
  behaviorName: string,
  clauseType: ClauseResult['clauseType'],
  clauses: ClauseSpec[],
  artifacts: WorkspaceScanArtifacts
): ClauseResult[] {
  return clauses.map((clause, index) =>
    bindSingleClause(domain, behaviorName, clauseType, index, clause, artifacts)
  );
}

/**
 * Bind evidence to a single clause
 */
function bindSingleClause(
  domain: string,
  behaviorName: string,
  clauseType: ClauseResult['clauseType'],
  index: number,
  clause: ClauseSpec,
  artifacts: WorkspaceScanArtifacts
): ClauseResult {
  const clauseId = `${domain}.${behaviorName}.${clauseType}.${index}`;
  const expression = clause.expression;
  
  // Collect evidence for this clause
  const evidence = collectEvidenceForClause(
    clauseId,
    expression,
    behaviorName,
    clauseType,
    artifacts
  );
  
  // Determine status and reason
  const { status, reason, confidence } = evaluateClause(
    clauseType,
    evidence,
    artifacts,
    behaviorName
  );
  
  return {
    clauseId,
    clauseType,
    expression,
    status,
    evidence,
    reason,
    confidence,
  };
}

/**
 * Collect evidence for a specific clause
 */
function collectEvidenceForClause(
  clauseId: string,
  expression: string,
  behaviorName: string,
  clauseType: ClauseResult['clauseType'],
  artifacts: WorkspaceScanArtifacts
): Evidence[] {
  const evidence: Evidence[] = [];
  
  // Find matching bindings
  const bindingEvidence = findBindingEvidence(
    clauseId,
    behaviorName,
    artifacts.bindings
  );
  evidence.push(...bindingEvidence);
  
  // Find matching assertions
  const assertionEvidence = findAssertionEvidence(
    clauseId,
    expression,
    behaviorName,
    clauseType,
    artifacts.assertions
  );
  evidence.push(...assertionEvidence);
  
  // Add binding_missing evidence if no bindings found
  if (bindingEvidence.length === 0) {
    evidence.push(createEvidence({
      clauseId,
      kind: 'binding_missing',
      description: `No implementation binding found for ${behaviorName}`,
      file: '',
      line: 0,
      column: 0,
      metadata: { behaviorName },
    }));
  }
  
  // Sort evidence for deterministic output
  return evidence.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Find binding evidence for a clause
 */
function findBindingEvidence(
  clauseId: string,
  behaviorName: string,
  bindings: BindingInfo[]
): Evidence[] {
  const evidence: Evidence[] = [];
  
  // Look for bindings that match the behavior name
  const matchingBindings = bindings.filter(b => 
    b.specRef.toLowerCase() === behaviorName.toLowerCase() ||
    b.exportName.toLowerCase() === behaviorName.toLowerCase() ||
    b.exportName.toLowerCase().includes(behaviorName.toLowerCase())
  );
  
  for (const binding of matchingBindings) {
    evidence.push(createEvidence({
      clauseId,
      kind: 'binding_found',
      description: `Found binding: ${binding.exportName}`,
      file: binding.file,
      line: binding.line,
      column: 1,
      metadata: {
        bindingType: binding.bindingType,
        exportName: binding.exportName,
        specRef: binding.specRef,
      },
    }));
  }
  
  return evidence;
}

/**
 * Find assertion evidence for a clause
 */
function findAssertionEvidence(
  clauseId: string,
  expression: string,
  behaviorName: string,
  clauseType: ClauseResult['clauseType'],
  assertions: AssertionInfo[]
): Evidence[] {
  const evidence: Evidence[] = [];
  
  // Extract key terms from expression for matching
  const terms = extractTerms(expression);
  const behaviorTerms = extractTerms(behaviorName);
  
  for (const assertion of assertions) {
    // Check if assertion matches clause by:
    // 1. Explicit clause reference
    // 2. Term matching in assertion text
    // 3. Test name matching behavior
    
    const hasClauseRef = assertion.possibleClauseRef && 
      (assertion.possibleClauseRef.toLowerCase().includes(clauseType) ||
       terms.some(t => assertion.possibleClauseRef?.toLowerCase().includes(t)));
    
    const hasBehaviorMatch = behaviorTerms.some(t => 
      assertion.text.toLowerCase().includes(t) ||
      assertion.possibleClauseRef?.toLowerCase().includes(t)
    );
    
    const hasTermMatch = terms.some(t => 
      assertion.text.toLowerCase().includes(t)
    );
    
    if (hasClauseRef || (hasBehaviorMatch && hasTermMatch)) {
      evidence.push(createEvidence({
        clauseId,
        kind: 'test_assertion',
        description: `Found assertion that may test this clause`,
        file: assertion.file,
        line: assertion.line,
        column: assertion.column,
        snippet: assertion.text,
        metadata: {
          assertFn: assertion.assertFn,
          testContext: assertion.possibleClauseRef ?? null,
        },
      }));
    }
  }
  
  return evidence;
}

/**
 * Extract meaningful terms from expression for matching
 */
function extractTerms(text: string): string[] {
  // Split on non-word characters and filter
  const words = text.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2);
  
  // Also add camelCase/PascalCase splits
  const expanded: string[] = [];
  for (const word of words) {
    expanded.push(word.toLowerCase());
    // Split camelCase
    const parts = word.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    for (const part of parts) {
      if (part.length > 2) {
        expanded.push(part.toLowerCase());
      }
    }
  }
  
  return [...new Set(expanded)];
}

/**
 * Evaluate clause status based on evidence
 */
function evaluateClause(
  clauseType: ClauseResult['clauseType'],
  evidence: Evidence[],
  artifacts: WorkspaceScanArtifacts,
  behaviorName: string
): { status: ClauseStatus; reason: string; confidence: number } {
  // Count evidence types
  const hasBinding = evidence.some(e => e.kind === 'binding_found');
  const hasMissingBinding = evidence.some(e => e.kind === 'binding_missing');
  const hasTestAssertion = evidence.some(e => e.kind === 'test_assertion');
  const assertionCount = evidence.filter(e => e.kind === 'test_assertion').length;
  
  // Check if there are any tests for this behavior at all
  const hasAnyTests = artifacts.testFiles.some(tf =>
    tf.tests.some(t => t.toLowerCase().includes(behaviorName.toLowerCase())) ||
    tf.suites.some(s => s.toLowerCase().includes(behaviorName.toLowerCase()))
  );
  
  // SKIPPED: No binding at all
  if (hasMissingBinding && !hasBinding) {
    return {
      status: 'SKIPPED',
      reason: 'No implementation binding found',
      confidence: 0,
    };
  }
  
  // PASS: Has binding and good test coverage
  if (hasBinding && hasTestAssertion && assertionCount >= 1) {
    const confidence = Math.min(100, 50 + assertionCount * 20);
    return {
      status: 'PASS',
      reason: `Binding found with ${assertionCount} test assertion(s)`,
      confidence,
    };
  }
  
  // PARTIAL: Has binding but limited/no test coverage
  if (hasBinding && !hasTestAssertion) {
    // Check if there are any tests at all
    if (hasAnyTests) {
      return {
        status: 'PARTIAL',
        reason: 'Binding found, tests exist but no direct assertion for this clause',
        confidence: 30,
      };
    }
    return {
      status: 'PARTIAL',
      reason: 'Binding found but no test coverage detected',
      confidence: 20,
    };
  }
  
  // PARTIAL: Some evidence but incomplete
  if (hasTestAssertion && hasMissingBinding) {
    return {
      status: 'PARTIAL',
      reason: 'Test assertions found but binding unclear',
      confidence: 40,
    };
  }
  
  // Default PARTIAL
  return {
    status: 'PARTIAL',
    reason: 'Limited evidence available',
    confidence: 25,
  };
}

// ============================================================================
// EVIDENCE CREATION UTILITIES
// ============================================================================

interface CreateEvidenceParams {
  clauseId: string;
  kind: EvidenceKind;
  description: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  snippet?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Create evidence with deterministic ID
 */
function createEvidence(params: CreateEvidenceParams): Evidence {
  const id = generateEvidenceId(params.clauseId, params.kind, params.file, params.line);
  
  return {
    id,
    kind: params.kind,
    description: params.description,
    file: params.file,
    line: params.line,
    column: params.column,
    endLine: params.endLine,
    endColumn: params.endColumn,
    snippet: params.snippet,
    metadata: params.metadata,
  };
}

/**
 * Generate deterministic evidence ID
 */
function generateEvidenceId(
  clauseId: string,
  kind: EvidenceKind,
  file: string,
  line: number
): string {
  const content = `${clauseId}:${kind}:${file}:${line}`;
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  return `ev_${hash}`;
}

// ============================================================================
// EVIDENCE MARKING (for mutation testing)
// ============================================================================

/**
 * Mark evidence as pass or fail (for explicit test results)
 */
export function markEvidenceResult(
  evidence: Evidence,
  passed: boolean
): Evidence {
  return {
    ...evidence,
    kind: passed ? 'assertion_pass' : 'assertion_fail',
    metadata: {
      ...evidence.metadata,
      result: passed ? 'pass' : 'fail',
    },
  };
}

/**
 * Update clause result based on assertion execution
 */
export function updateClauseWithAssertion(
  clause: ClauseResult,
  assertionEvidence: Evidence,
  passed: boolean
): ClauseResult {
  const updatedEvidence = clause.evidence.map(e => 
    e.id === assertionEvidence.id ? markEvidenceResult(e, passed) : e
  );
  
  // Recalculate status
  const passCount = updatedEvidence.filter(e => e.kind === 'assertion_pass').length;
  const failCount = updatedEvidence.filter(e => e.kind === 'assertion_fail').length;
  
  let status: ClauseStatus;
  let reason: string;
  let confidence: number;
  
  if (failCount > 0) {
    status = 'FAIL';
    reason = `Assertion failed: ${failCount} failure(s)`;
    confidence = 100; // We have definitive evidence of failure
  } else if (passCount > 0) {
    status = 'PASS';
    reason = `All ${passCount} assertion(s) passed`;
    confidence = Math.min(100, 60 + passCount * 15);
  } else {
    status = clause.status;
    reason = clause.reason;
    confidence = clause.confidence;
  }
  
  return {
    ...clause,
    evidence: updatedEvidence,
    status,
    reason,
    confidence,
  };
}
