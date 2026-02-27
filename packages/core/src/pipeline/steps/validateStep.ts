/**
 * Validation Step
 *
 * Validates the ISL AST for structural and semantic correctness.
 */

import type { Domain } from '@isl-lang/parser';
import type { ValidateStepResult, PipelineState } from '../pipelineTypes.js';

/**
 * Validation issue found in the AST
 */
interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate the structure of a Domain AST
 *
 * @param ast - The Domain AST to validate
 * @returns List of validation issues
 */
function validateDomainStructure(ast: Domain): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check domain name
  if (!ast.name?.name) {
    issues.push({
      path: 'name',
      message: 'Domain must have a name',
      severity: 'error',
    });
  }

  // Check version
  if (!ast.version?.value) {
    issues.push({
      path: 'version',
      message: 'Domain must have a version',
      severity: 'error',
    });
  }

  // Validate entities
  for (let i = 0; i < ast.entities.length; i++) {
    const entity = ast.entities[i];
    if (!entity) continue;

    if (!entity.name?.name) {
      issues.push({
        path: `entities[${i}].name`,
        message: 'Entity must have a name',
        severity: 'error',
      });
    }

    // Check for duplicate field names
    const fieldNames = new Set<string>();
    for (const field of entity.fields || []) {
      if (field.name?.name) {
        if (fieldNames.has(field.name.name)) {
          issues.push({
            path: `entities[${i}].fields`,
            message: `Duplicate field name: ${field.name.name}`,
            severity: 'error',
          });
        }
        fieldNames.add(field.name.name);
      }
    }
  }

  // Validate behaviors
  for (let i = 0; i < ast.behaviors.length; i++) {
    const behavior = ast.behaviors[i];
    if (!behavior) continue;

    if (!behavior.name?.name) {
      issues.push({
        path: `behaviors[${i}].name`,
        message: 'Behavior must have a name',
        severity: 'error',
      });
    }

    // Check that behaviors have at least one clause
    const hasClauses =
      (behavior.preconditions?.length ?? 0) > 0 ||
      (behavior.postconditions?.length ?? 0) > 0;

    if (!hasClauses) {
      issues.push({
        path: `behaviors[${i}]`,
        message: `Behavior '${behavior.name?.name || 'unnamed'}' has no clauses`,
        severity: 'warning',
      });
    }
  }

  // Validate invariants
  for (let i = 0; i < ast.invariants.length; i++) {
    const invariantBlock = ast.invariants[i];
    if (!invariantBlock) continue;

    if (!invariantBlock.predicates?.length) {
      issues.push({
        path: `invariants[${i}]`,
        message: 'Invariant block is empty',
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Run the validation step
 *
 * @param state - Current pipeline state
 * @returns Validation step result
 */
export async function runValidateStep(state: PipelineState): Promise<ValidateStepResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    if (!state.ast) {
      return {
        stepName: 'validate',
        success: false,
        error: 'No AST available for validation',
        durationMs: performance.now() - startTime,
        warnings,
      };
    }

    const issues = validateDomainStructure(state.ast);
    const errors = issues.filter((i) => i.severity === 'error');
    const warns = issues.filter((i) => i.severity === 'warning');

    // Add warnings to output
    for (const warn of warns) {
      warnings.push(`${warn.path}: ${warn.message}`);
    }

    const valid = errors.length === 0;

    return {
      stepName: 'validate',
      success: true,
      data: {
        valid,
        issues: errors.map((e) => `${e.path}: ${e.message}`),
      },
      durationMs: performance.now() - startTime,
      warnings,
    };
  } catch (error) {
    return {
      stepName: 'validate',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startTime,
      warnings,
    };
  }
}
