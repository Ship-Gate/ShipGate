/**
 * Specificity Checker
 *
 * Evaluates how concrete and specific postconditions and types are:
 * - Postconditions are more than simple type checks
 * - Temporal requirements exist (response time, timeouts)
 * - Preconditions are present (not any-input-accepted)
 * - Output types are specific (Email, UUID) not generic (String)
 */

import type { Domain, Behavior, Expression, PostconditionBlock } from '@isl-lang/parser';
import type {
  DimensionChecker,
  DimensionCheckResult,
  QualitySuggestion,
} from '../types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Generic output types that could be more specific */
const GENERIC_TYPES = new Set(['String', 'Int', 'Boolean', 'Object', 'Map']);

/** Semantic types that are more specific */
const SPECIFIC_TYPE_SUGGESTIONS: Record<string, string> = {
  String: 'Email, UUID, URL, PhoneNumber, or a constrained String',
  Int: 'PositiveInt, Percentage, or a constrained Int',
  Object: 'a defined entity or struct type',
};

/**
 * Detect weak postconditions: things like `result.x != null` or
 * simple `.length > 0` checks without behavioral assertions.
 */
function isWeakPostcondition(expr: Expression): { weak: boolean; reason?: string } {
  if (expr.kind === 'BinaryExpr') {
    const { operator, left, right } = expr;

    // result.x != null — trivial null check
    if ((operator === '!=' || operator === '==') && right.kind === 'NullLiteral') {
      return { weak: true, reason: 'is only a null check' };
    }

    // result.x.length > 0 — weak length check
    if (
      (operator === '>' || operator === '>=') &&
      left.kind === 'MemberExpr' &&
      left.property.name === 'length' &&
      right.kind === 'NumberLiteral' &&
      right.value <= 1
    ) {
      return { weak: true, reason: 'is a weak length check — consider asserting format or content' };
    }
  }

  return { weak: false };
}

/**
 * Walk postcondition blocks and evaluate specificity
 */
function checkPostconditionSpecificity(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;

    if (b.postconditions.length === 0) {
      // No postconditions — already caught by completeness checker
      continue;
    }

    let weakCount = 0;
    let totalPredicates = 0;

    for (const pc of b.postconditions) {
      for (const pred of pc.predicates) {
        totalPredicates++;
        const check = isWeakPostcondition(pred);
        if (check.weak) {
          weakCount++;
          suggestions.push({
            dimension: 'specificity',
            severity: 'warning',
            message: `Postcondition in '${name}' ${check.reason}`,
            example: `// Consider: result.token matches /^eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+$/`,
          });
        }
      }
    }

    if (totalPredicates > 0 && weakCount === 0) {
      findings.push(`${name}: all ${totalPredicates} postconditions are specific`);
    } else if (weakCount > 0) {
      penalty += weakCount * 8;
    }
  }

  return { findings, suggestions, penalty };
}

function checkTemporalRequirements(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  const behaviorsWithoutTemporal = behaviors.filter(
    b => !b.temporal || b.temporal.length === 0,
  );

  if (behaviorsWithoutTemporal.length > 0 && behaviors.length > 0) {
    // Only penalize if NONE of the behaviors have temporal — it's a spec-wide concern
    const ratio = behaviorsWithoutTemporal.length / behaviors.length;
    if (ratio === 1) {
      penalty += 15;
      suggestions.push({
        dimension: 'specificity',
        severity: 'warning',
        message: 'No temporal requirements defined for any behavior',
        example: `temporal {\n  response within 500.ms (p95)\n}`,
      });
    } else {
      for (const b of behaviorsWithoutTemporal) {
        suggestions.push({
          dimension: 'specificity',
          severity: 'info',
          message: `Behavior '${b.name.name}' has no temporal requirement`,
          example: `temporal {\n  response within 500.ms (p95)\n}`,
        });
      }
      penalty += Math.min(10, behaviorsWithoutTemporal.length * 3);
    }
  } else if (behaviorsWithoutTemporal.length === 0 && behaviors.length > 0) {
    findings.push('All behaviors have temporal requirements');
  }

  return { findings, suggestions, penalty };
}

function checkPreconditions(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;
    const hasInput = b.input && b.input.fields.length > 0;
    const hasPreconditions = b.preconditions && b.preconditions.length > 0;

    if (hasInput && !hasPreconditions) {
      penalty += 8;
      suggestions.push({
        dimension: 'specificity',
        severity: 'warning',
        message: `Behavior '${name}' accepts input but has no preconditions — any input is accepted`,
        example: `preconditions {\n  input.email matches /^[^@]+@[^@]+$/\n  input.amount > 0\n}`,
      });
    } else if (hasInput && hasPreconditions) {
      findings.push(`${name}: preconditions guard input`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkOutputTypeSpecificity(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;

    if (!b.output?.success) continue;

    const successType = b.output.success;

    if (successType.kind === 'PrimitiveType' && GENERIC_TYPES.has(successType.name)) {
      penalty += 5;
      const suggestion = SPECIFIC_TYPE_SUGGESTIONS[successType.name] ?? `a more specific type`;
      suggestions.push({
        dimension: 'specificity',
        severity: 'info',
        message: `Behavior '${name}' output type is generic '${successType.name}'`,
        example: `// Consider using ${suggestion} instead of ${successType.name}`,
      });
    } else {
      findings.push(`${name}: output type is specific`);
    }
  }

  return { findings, suggestions, penalty };
}

// ============================================================================
// Checker
// ============================================================================

export const specificityChecker: DimensionChecker = {
  dimension: 'specificity',

  check(domain: Domain, file: string): DimensionCheckResult {
    const allFindings: string[] = [];
    const allSuggestions: QualitySuggestion[] = [];
    let totalPenalty = 0;

    const checks = [
      checkPostconditionSpecificity(domain.behaviors),
      checkTemporalRequirements(domain.behaviors),
      checkPreconditions(domain.behaviors),
      checkOutputTypeSpecificity(domain.behaviors),
    ];

    for (const c of checks) {
      allFindings.push(...c.findings);
      allSuggestions.push(...c.suggestions);
      totalPenalty += c.penalty;
    }

    const score = Math.max(0, Math.min(100, 100 - totalPenalty));

    return {
      score: { score, findings: allFindings },
      suggestions: allSuggestions,
    };
  },
};
