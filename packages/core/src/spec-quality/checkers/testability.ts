/**
 * Testability Checker
 *
 * Evaluates whether the spec can be used to generate meaningful tests:
 * - Postconditions are concrete enough to assert against
 * - Scenarios are defined for behaviors
 * - Input/output types allow test data generation
 * - Behaviors have enough structure to generate test harness
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

/**
 * Determine if a postcondition predicate is too abstract to generate a test.
 * Abstract predicates are things like calls to unknown functions,
 * or predicates referencing external state without concrete values.
 */
function isAbstractPredicate(expr: Expression): boolean {
  // A bare identifier with no comparison is abstract
  if (expr.kind === 'Identifier') return true;

  // A call to a function that's not a known assertion pattern
  if (expr.kind === 'CallExpr') {
    const callee = expr.callee;
    if (callee.kind === 'Identifier') {
      const knownTestable = new Set([
        'matches', 'contains', 'startsWith', 'endsWith',
        'isEmpty', 'isNotEmpty', 'hash', 'length',
      ]);
      return !knownTestable.has(callee.name);
    }
    return true;
  }

  // Quantifiers over unknown collections
  if (expr.kind === 'QuantifierExpr') {
    if (expr.collection.kind === 'Identifier') return true;
  }

  return false;
}

/**
 * Check if a behavior has enough structure for test generation.
 */
function behaviorTestability(b: Behavior): {
  testable: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let testable = true;

  // No input fields — hard to generate test data
  if (!b.input || b.input.fields.length === 0) {
    // Some behaviors genuinely have no input; only flag if there's also no output
    if (!b.output) {
      testable = false;
      reasons.push('no input or output — nothing to test');
    }
  }

  // No postconditions — nothing to assert
  if (b.postconditions.length === 0) {
    testable = false;
    reasons.push('no postconditions to assert against');
  }

  return { testable, reasons };
}

// ============================================================================
// Check functions
// ============================================================================

function checkPostconditionTestability(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;
    let abstractCount = 0;
    let totalPredicates = 0;

    for (const pc of b.postconditions) {
      for (const pred of pc.predicates) {
        totalPredicates++;
        if (isAbstractPredicate(pred)) {
          abstractCount++;
        }
      }
    }

    if (abstractCount > 0) {
      penalty += abstractCount * 6;
      suggestions.push({
        dimension: 'testability',
        severity: 'warning',
        message: `${abstractCount} postcondition${abstractCount > 1 ? 's' : ''} in '${name}' can't generate tests (too abstract)`,
        example: `// Replace abstract predicates with concrete assertions:\n// Instead of: isValid(result)\n// Use: result.status == "active" and result.id != null`,
      });
    } else if (totalPredicates > 0) {
      findings.push(`${name}: all ${totalPredicates} postconditions are testable`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkScenarioCoverage(
  domain: Domain,
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  const scenarioBehaviors = new Set(
    domain.scenarios.map(s => s.behaviorName.name),
  );

  for (const b of domain.behaviors) {
    const name = b.name.name;
    if (scenarioBehaviors.has(name)) {
      findings.push(`${name}: has scenario tests`);
    } else {
      penalty += 5;
      suggestions.push({
        dimension: 'testability',
        severity: 'info',
        message: `Behavior '${name}' has no scenario tests`,
        example: `scenarios for ${name} {\n  scenario "happy path" {\n    given { /* setup */ }\n    when { ${name}(/* input */) }\n    then { result.success == true }\n  }\n}`,
      });
    }
  }

  return { findings, suggestions, penalty };
}

function checkBehaviorStructure(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;
    const { testable, reasons } = behaviorTestability(b);

    if (!testable) {
      penalty += 10;
      suggestions.push({
        dimension: 'testability',
        severity: 'warning',
        message: `Behavior '${name}' is hard to test: ${reasons.join(', ')}`,
      });
    } else {
      findings.push(`${name}: testable structure`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkChaosCoverage(
  domain: Domain,
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  if (domain.chaos.length > 0) {
    findings.push(`${domain.chaos.length} chaos test block(s) defined`);
  } else if (domain.behaviors.length >= 3) {
    // Only suggest chaos tests for non-trivial domains
    penalty += 3;
    suggestions.push({
      dimension: 'testability',
      severity: 'info',
      message: 'No chaos tests defined — consider adding fault injection scenarios',
      example: `chaos for MyBehavior {\n  scenario "database failure" {\n    inject database_failure on "primary"\n    then { result is GracefulDegradation }\n  }\n}`,
    });
  }

  return { findings, suggestions, penalty };
}

// ============================================================================
// Checker
// ============================================================================

export const testabilityChecker: DimensionChecker = {
  dimension: 'testability',

  check(domain: Domain, file: string): DimensionCheckResult {
    const allFindings: string[] = [];
    const allSuggestions: QualitySuggestion[] = [];
    let totalPenalty = 0;

    if (domain.behaviors.length === 0) {
      return {
        score: { score: 100, findings: ['No behaviors to evaluate'] },
        suggestions: [],
      };
    }

    const checks = [
      checkPostconditionTestability(domain.behaviors),
      checkScenarioCoverage(domain),
      checkBehaviorStructure(domain.behaviors),
      checkChaosCoverage(domain),
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
