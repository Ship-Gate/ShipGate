/**
 * Consistency Checker
 *
 * Evaluates whether the spec follows project-level patterns:
 * - Naming conventions (PascalCase entities, PascalCase behaviors)
 * - Version is declared
 * - Domain has a description / owner
 * - Field naming is consistent (all camelCase)
 * - Types reuse existing domain entities rather than inline definitions
 */

import type { Domain, Entity, Behavior, Field } from '@isl-lang/parser';
import type {
  DimensionChecker,
  DimensionCheckResult,
  QualitySuggestion,
} from '../types.js';

// ============================================================================
// Helpers
// ============================================================================

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;

// ============================================================================
// Check Functions
// ============================================================================

function checkNamingConventions(
  domain: Domain,
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  // Entity names should be PascalCase
  for (const e of domain.entities) {
    if (!PASCAL_CASE.test(e.name.name)) {
      penalty += 3;
      suggestions.push({
        dimension: 'consistency',
        severity: 'info',
        message: `Entity '${e.name.name}' should be PascalCase`,
      });
    }
  }

  // Behavior names should be PascalCase
  for (const b of domain.behaviors) {
    if (!PASCAL_CASE.test(b.name.name)) {
      penalty += 3;
      suggestions.push({
        dimension: 'consistency',
        severity: 'info',
        message: `Behavior '${b.name.name}' should be PascalCase`,
      });
    }
  }

  // Field names should be camelCase
  const allFields: Array<{ field: Field; parent: string }> = [];
  for (const e of domain.entities) {
    for (const f of e.fields) {
      allFields.push({ field: f, parent: e.name.name });
    }
  }
  for (const b of domain.behaviors) {
    if (b.input) {
      for (const f of b.input.fields) {
        allFields.push({ field: f, parent: `${b.name.name}.input` });
      }
    }
  }

  let fieldViolations = 0;
  for (const { field, parent } of allFields) {
    const name = field.name.name;
    // Allow 'id', 'ID', or camelCase
    if (name !== 'id' && name !== 'ID' && !CAMEL_CASE.test(name)) {
      fieldViolations++;
      if (fieldViolations <= 3) {
        suggestions.push({
          dimension: 'consistency',
          severity: 'info',
          message: `Field '${name}' in ${parent} should be camelCase`,
        });
      }
    }
  }
  if (fieldViolations > 3) {
    penalty += fieldViolations * 2;
    suggestions.push({
      dimension: 'consistency',
      severity: 'warning',
      message: `${fieldViolations} fields use inconsistent naming — use camelCase for all fields`,
    });
  } else {
    penalty += fieldViolations * 2;
  }

  if (fieldViolations === 0 && suggestions.length === 0) {
    findings.push('Naming conventions are consistent');
  }

  return { findings, suggestions, penalty };
}

function checkDomainMetadata(
  domain: Domain,
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  // Version check
  if (!domain.version || domain.version.value === '') {
    penalty += 5;
    suggestions.push({
      dimension: 'consistency',
      severity: 'info',
      message: 'Domain has no version — add a version for tracking',
      example: `domain MyDomain version "1.0.0" { ... }`,
    });
  } else {
    findings.push(`Domain version: ${domain.version.value}`);
  }

  // Owner check
  if (!domain.owner) {
    penalty += 3;
    suggestions.push({
      dimension: 'consistency',
      severity: 'info',
      message: 'Domain has no owner — consider adding an owner for accountability',
      example: `domain MyDomain version "1.0.0" owner "team-backend" { ... }`,
    });
  } else {
    findings.push(`Domain owner: ${domain.owner.value}`);
  }

  return { findings, suggestions, penalty };
}

function checkInvariantPresence(
  domain: Domain,
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  // Domain-level invariants signal maturity
  if (domain.invariants.length > 0) {
    findings.push(`${domain.invariants.length} domain-level invariant(s) defined`);
  } else if (domain.entities.length >= 2) {
    penalty += 5;
    suggestions.push({
      dimension: 'consistency',
      severity: 'info',
      message: 'No domain-level invariants — consider adding cross-entity constraints',
      example: `invariants "business rules" {\n  // e.g. all accounts.balance >= 0\n}`,
    });
  }

  // Policies
  if (domain.policies.length > 0) {
    findings.push(`${domain.policies.length} policy block(s) defined`);
  }

  return { findings, suggestions, penalty };
}

function checkTypeReuse(
  domain: Domain,
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  // Check if there are shared type declarations
  if (domain.types.length > 0) {
    findings.push(`${domain.types.length} reusable type declaration(s)`);
  } else if (domain.entities.length >= 2 && domain.behaviors.length >= 2) {
    // Suggest type declarations for larger specs
    penalty += 3;
    suggestions.push({
      dimension: 'consistency',
      severity: 'info',
      message: 'No shared type declarations — consider extracting common types',
      example: `type Email = String { matches /^[^@]+@[^@]+$/ }\ntype PositiveAmount = Decimal { min 0.01 }`,
    });
  }

  return { findings, suggestions, penalty };
}

// ============================================================================
// Checker
// ============================================================================

export const consistencyChecker: DimensionChecker = {
  dimension: 'consistency',

  check(domain: Domain, file: string): DimensionCheckResult {
    const allFindings: string[] = [];
    const allSuggestions: QualitySuggestion[] = [];
    let totalPenalty = 0;

    const checks = [
      checkNamingConventions(domain),
      checkDomainMetadata(domain),
      checkInvariantPresence(domain),
      checkTypeReuse(domain),
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
