/**
 * Completeness Checker
 *
 * Evaluates whether an ISL spec covers all expected elements:
 * - Behaviors have input AND output definitions
 * - Behaviors with postconditions also define error cases
 * - Entities with fields also have invariants
 * - Domains with entities also have behaviors
 * - Behaviors that reference entities ensure those entities exist
 */

import type { Domain, Behavior, Entity, Expression } from '@isl-lang/parser';
import type {
  DimensionChecker,
  DimensionCheckResult,
  DimensionScore,
  QualitySuggestion,
} from '../types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Collect all entity names in the domain */
function entityNames(domain: Domain): Set<string> {
  return new Set(domain.entities.map(e => e.name.name));
}

/** Recursively collect all ReferenceType names from an expression tree */
function collectReferences(expr: Expression): string[] {
  const refs: string[] = [];

  if (expr.kind === 'Identifier') {
    refs.push(expr.name);
  } else if (expr.kind === 'QualifiedName') {
    refs.push(expr.parts.map(p => p.name).join('.'));
  } else if (expr.kind === 'MemberExpr') {
    refs.push(...collectReferences(expr.object));
  } else if (expr.kind === 'BinaryExpr') {
    refs.push(...collectReferences(expr.left));
    refs.push(...collectReferences(expr.right));
  } else if (expr.kind === 'UnaryExpr') {
    refs.push(...collectReferences(expr.operand));
  } else if (expr.kind === 'CallExpr') {
    refs.push(...collectReferences(expr.callee));
    for (const arg of expr.arguments) {
      refs.push(...collectReferences(arg));
    }
  }

  return refs;
}

// ============================================================================
// Check Functions
// ============================================================================

function checkBehaviorIO(behaviors: Behavior[], file: string): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;
    const hasInput = b.input && b.input.fields.length > 0;
    const hasOutput = b.output !== undefined;

    if (hasInput && hasOutput) {
      findings.push(`${name}: input/output defined`);
    } else if (hasInput && !hasOutput) {
      penalty += 15;
      suggestions.push({
        dimension: 'completeness',
        severity: 'warning',
        message: `Behavior '${name}' has input but no output definition`,
        example: `behavior ${name} {\n  output {\n    success: /* result type */\n  }\n}`,
      });
    } else if (!hasInput && hasOutput) {
      findings.push(`${name}: output defined (no input needed)`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkErrorCases(behaviors: Behavior[], file: string): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;
    const hasPostconditions = b.postconditions && b.postconditions.length > 0;
    const hasErrors = b.output?.errors && b.output.errors.length > 0;

    if (hasPostconditions && !hasErrors) {
      penalty += 10;
      suggestions.push({
        dimension: 'completeness',
        severity: 'warning',
        message: `Behavior '${name}' has postconditions but no error cases — add error responses`,
        example: `behavior ${name} {\n  output {\n    errors {\n      InvalidInput when "input validation fails"\n      NotFound when "resource not found"\n    }\n  }\n}`,
      });
    } else if (hasPostconditions && hasErrors) {
      findings.push(`${name}: postconditions and error cases defined`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkEntityInvariants(entities: Entity[]): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const e of entities) {
    const name = e.name.name;
    const hasFields = e.fields && e.fields.length > 0;
    const hasInvariants = e.invariants && e.invariants.length > 0;

    if (hasFields && !hasInvariants) {
      penalty += 8;
      suggestions.push({
        dimension: 'completeness',
        severity: 'info',
        message: `Entity '${name}' has fields but no invariants — consider adding constraints`,
        example: `entity ${name} {\n  invariants {\n    // e.g. this.email matches /^[^@]+@[^@]+$/\n  }\n}`,
      });
    } else if (hasFields && hasInvariants) {
      findings.push(`${name}: fields and invariants defined`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkDomainCoverage(domain: Domain): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  if (domain.entities.length > 0 && domain.behaviors.length === 0) {
    penalty += 20;
    suggestions.push({
      dimension: 'completeness',
      severity: 'critical',
      message: `Domain '${domain.name.name}' has entities but no behaviors — add behaviors to describe operations`,
    });
  } else if (domain.entities.length > 0 && domain.behaviors.length > 0) {
    findings.push(`Domain has ${domain.entities.length} entities and ${domain.behaviors.length} behaviors`);
  }

  if (domain.entities.length === 0 && domain.behaviors.length === 0) {
    penalty += 30;
    suggestions.push({
      dimension: 'completeness',
      severity: 'critical',
      message: `Domain '${domain.name.name}' is empty — no entities or behaviors defined`,
    });
  }

  return { findings, suggestions, penalty };
}

function checkEntityReferences(domain: Domain): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  const knownEntities = entityNames(domain);

  for (const b of domain.behaviors) {
    const name = b.name.name;

    // Collect references from postconditions
    const allRefs: string[] = [];
    for (const pc of b.postconditions) {
      for (const pred of pc.predicates) {
        allRefs.push(...collectReferences(pred));
      }
    }

    // Check if any ref looks like an entity name (PascalCase) that doesn't exist
    const pascalPattern = /^[A-Z][a-zA-Z0-9]+$/;
    for (const ref of allRefs) {
      const baseName = ref.split('.')[0] ?? ref;
      if (pascalPattern.test(baseName) && !knownEntities.has(baseName) && baseName !== 'String' && baseName !== 'Int' && baseName !== 'Boolean' && baseName !== 'Decimal' && baseName !== 'UUID' && baseName !== 'Timestamp' && baseName !== 'Duration') {
        penalty += 5;
        suggestions.push({
          dimension: 'completeness',
          severity: 'warning',
          message: `Behavior '${name}' references '${baseName}' but no matching entity is defined`,
        });
      }
    }
  }

  if (suggestions.length === 0 && domain.behaviors.length > 0) {
    findings.push('All behavior entity references resolve');
  }

  return { findings, suggestions, penalty };
}

// ============================================================================
// Checker
// ============================================================================

export const completenessChecker: DimensionChecker = {
  dimension: 'completeness',

  check(domain: Domain, file: string): DimensionCheckResult {
    const allFindings: string[] = [];
    const allSuggestions: QualitySuggestion[] = [];
    let totalPenalty = 0;

    const checks = [
      checkBehaviorIO(domain.behaviors, file),
      checkErrorCases(domain.behaviors, file),
      checkEntityInvariants(domain.entities),
      checkDomainCoverage(domain),
      checkEntityReferences(domain),
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
