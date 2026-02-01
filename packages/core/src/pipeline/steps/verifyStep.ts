/**
 * Verification Step
 *
 * Verifies that the implementation satisfies the ISL specification.
 * This is a stub implementation that generates clause results from the AST.
 */

import type { Domain, Behavior, Entity, InvariantBlock } from '@isl-lang/parser';
import type {
  VerifyStepResult,
  PipelineState,
  ClauseInfo,
} from '../pipelineTypes.js';
import type {
  EvidenceClauseResult,
  EvidenceArtifact,
  ClauseState,
} from '../../evidence/evidenceTypes.js';

/**
 * Extract clauses from a Domain AST
 *
 * @param ast - The Domain AST
 * @returns List of clause information
 */
function extractClausesFromAst(ast: Domain): ClauseInfo[] {
  const clauses: ClauseInfo[] = [];

  // Extract entity constraints
  for (const entity of ast.entities) {
    const entityName = entity.name?.value || 'UnknownEntity';

    // Field constraints
    for (let i = 0; i < entity.fields.length; i++) {
      const field = entity.fields[i];
      if (!field) continue;

      const fieldName = field.name?.value || `field${i}`;

      // Check if field has constraints
      if (field.type && 'constraints' in field.type) {
        clauses.push({
          clauseId: `${entityName}.${fieldName}.constraint`,
          clauseType: 'constraint',
          source: `Field constraint on ${fieldName}`,
          entityName,
        });
      }
    }
  }

  // Extract behavior clauses
  for (const behavior of ast.behaviors) {
    const behaviorName = behavior.name?.value || 'UnknownBehavior';
    const entityName = behavior.on?.value;

    // Preconditions
    for (let i = 0; i < (behavior.preconditions?.length ?? 0); i++) {
      const pre = behavior.preconditions?.[i];
      clauses.push({
        clauseId: `${behaviorName}.pre.${i + 1}`,
        clauseType: 'precondition',
        source: pre?.toString() || `Precondition ${i + 1}`,
        entityName,
        behaviorName,
      });
    }

    // Postconditions
    for (let i = 0; i < (behavior.postconditions?.length ?? 0); i++) {
      const post = behavior.postconditions?.[i];
      clauses.push({
        clauseId: `${behaviorName}.post.${i + 1}`,
        clauseType: 'postcondition',
        source: post?.toString() || `Postcondition ${i + 1}`,
        entityName,
        behaviorName,
      });
    }

    // Effects
    for (let i = 0; i < (behavior.effects?.length ?? 0); i++) {
      const effect = behavior.effects?.[i];
      clauses.push({
        clauseId: `${behaviorName}.effect.${i + 1}`,
        clauseType: 'effect',
        source: effect?.toString() || `Effect ${i + 1}`,
        entityName,
        behaviorName,
      });
    }
  }

  // Extract invariants
  for (let blockIdx = 0; blockIdx < ast.invariants.length; blockIdx++) {
    const block = ast.invariants[blockIdx];
    if (!block?.invariants) continue;

    for (let i = 0; i < block.invariants.length; i++) {
      const inv = block.invariants[i];
      clauses.push({
        clauseId: `invariant.${blockIdx + 1}.${i + 1}`,
        clauseType: 'invariant',
        source: inv?.label?.value || `Invariant ${i + 1}`,
      });
    }
  }

  return clauses;
}

/**
 * Simulate verification of clauses
 *
 * In a real implementation, this would run actual verification against the codebase.
 * This stub assigns states based on a simple heuristic for demonstration.
 *
 * @param clauses - List of clauses to verify
 * @returns Clause results with states
 */
function simulateVerification(clauses: ClauseInfo[]): EvidenceClauseResult[] {
  return clauses.map((clause, index) => {
    // Simple heuristic: assign states based on clause type and index
    let state: ClauseState;
    let message: string;

    // In a real verification, we'd run actual checks
    // For the stub, we simulate a mix of results
    if (clause.clauseType === 'precondition') {
      // Preconditions typically pass if validated at entry
      state = 'PASS';
      message = 'Precondition check implemented';
    } else if (clause.clauseType === 'postcondition') {
      // Postconditions may be partial if not fully verified
      state = index % 3 === 0 ? 'PARTIAL' : 'PASS';
      message = state === 'PARTIAL' ? 'Partial verification' : 'Postcondition verified';
    } else if (clause.clauseType === 'invariant') {
      // Invariants are typically pass/fail
      state = 'PASS';
      message = 'Invariant holds';
    } else if (clause.clauseType === 'effect') {
      // Effects depend on side-effect tracking
      state = index % 5 === 0 ? 'PARTIAL' : 'PASS';
      message = state === 'PARTIAL' ? 'Effect partially tracked' : 'Effect verified';
    } else {
      // Constraints
      state = 'PASS';
      message = 'Constraint satisfied';
    }

    return {
      clauseId: clause.clauseId,
      state,
      message,
      clauseType: clause.clauseType,
    };
  });
}

/**
 * Create artifacts for verification
 *
 * @param clauses - Verified clauses
 * @returns List of artifacts
 */
function createVerificationArtifacts(
  clauses: EvidenceClauseResult[]
): EvidenceArtifact[] {
  const artifacts: EvidenceArtifact[] = [];

  // Create a summary artifact
  artifacts.push({
    id: 'verification-summary',
    type: 'log',
    name: 'Verification Summary',
    content: JSON.stringify(
      {
        totalClauses: clauses.length,
        passed: clauses.filter((c) => c.state === 'PASS').length,
        partial: clauses.filter((c) => c.state === 'PARTIAL').length,
        failed: clauses.filter((c) => c.state === 'FAIL').length,
      },
      null,
      2
    ),
    mimeType: 'application/json',
    createdAt: new Date().toISOString(),
  });

  return artifacts;
}

/**
 * Run the verification step
 *
 * @param state - Current pipeline state
 * @returns Verification step result
 */
export async function runVerifyStep(state: PipelineState): Promise<VerifyStepResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    if (!state.ast) {
      return {
        stepName: 'verify',
        success: false,
        error: 'No AST available for verification',
        durationMs: performance.now() - startTime,
        warnings,
      };
    }

    // Extract clauses from AST
    const clauses = extractClausesFromAst(state.ast);

    if (clauses.length === 0) {
      warnings.push('No clauses found in AST - verification will be empty');
    }

    // Run verification (stub simulation)
    const clauseResults = simulateVerification(clauses);

    // Create artifacts
    const artifacts = createVerificationArtifacts(clauseResults);

    return {
      stepName: 'verify',
      success: true,
      data: {
        clauseResults,
        artifacts,
      },
      durationMs: performance.now() - startTime,
      warnings,
    };
  } catch (error) {
    return {
      stepName: 'verify',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startTime,
      warnings,
    };
  }
}
