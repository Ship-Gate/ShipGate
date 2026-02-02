/**
 * Completeness Analyzer
 * 
 * Checks for missing specifications, incomplete behaviors, and gaps.
 */

import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';

export interface CompletenessIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: { line: number; column: number };
  fix?: string;
}

export interface CompletenessResult {
  score: number;
  issues: CompletenessIssue[];
  suggestions: string[];
}

/**
 * Analyze domain for completeness issues
 */
export function analyzeCompleteness(domain: DomainDeclaration): CompletenessResult {
  const issues: CompletenessIssue[] = [];
  const suggestions: string[] = [];

  // Check behaviors
  for (const behavior of domain.behaviors) {
    issues.push(...checkBehaviorCompleteness(behavior));
  }

  // Check entities
  for (const entity of domain.entities) {
    // Check for missing invariants
    if (!entity.invariants || entity.invariants.length === 0) {
      issues.push({
        id: `completeness-entity-no-invariants-${entity.name.name}`,
        severity: 'warning',
        title: `Entity "${entity.name.name}" has no invariants`,
        description: 'Entities should define invariants to ensure data integrity.',
        location: entity.span ? { line: entity.span.start.line, column: entity.span.start.column } : undefined,
        fix: `Add invariants block to entity ${entity.name.name}`,
      });
      suggestions.push(`Consider adding invariants to entity "${entity.name.name}" to enforce data integrity rules.`);
    }

    // Check for missing lifecycle
    if (hasStatusField(entity) && !entity.lifecycle) {
      issues.push({
        id: `completeness-entity-no-lifecycle-${entity.name.name}`,
        severity: 'info',
        title: `Entity "${entity.name.name}" has status field but no lifecycle`,
        description: 'Entities with status fields should define lifecycle transitions.',
        location: entity.span ? { line: entity.span.start.line, column: entity.span.start.column } : undefined,
      });
    }
  }

  // Check for orphan types
  const usedTypes = collectUsedTypes(domain);
  for (const type of domain.types) {
    if (!usedTypes.has(type.name.name)) {
      issues.push({
        id: `completeness-unused-type-${type.name.name}`,
        severity: 'info',
        title: `Type "${type.name.name}" is defined but never used`,
        description: 'Consider removing unused types or using them in entity/behavior definitions.',
        location: type.span ? { line: type.span.start.line, column: type.span.start.column } : undefined,
      });
    }
  }

  // Check for missing error handling
  for (const behavior of domain.behaviors) {
    if (behavior.output?.errors && behavior.output.errors.length === 0) {
      issues.push({
        id: `completeness-behavior-no-errors-${behavior.name.name}`,
        severity: 'warning',
        title: `Behavior "${behavior.name.name}" defines no error cases`,
        description: 'Most behaviors should handle at least some error conditions.',
        location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
      });
      suggestions.push(`Add error cases to behavior "${behavior.name.name}" to handle failure scenarios.`);
    }
  }

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const maxScore = 100;
  const deductions = criticalCount * 20 + warningCount * 10 + infoCount * 2;
  const score = Math.max(0, maxScore - deductions);

  return { score, issues, suggestions };
}

/**
 * Check behavior for completeness
 */
function checkBehaviorCompleteness(behavior: BehaviorDeclaration): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  const name = behavior.name.name;

  // Check for missing description
  if (!behavior.description) {
    issues.push({
      id: `completeness-behavior-no-description-${name}`,
      severity: 'info',
      title: `Behavior "${name}" has no description`,
      description: 'Behaviors should have descriptions explaining their purpose.',
      location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
      fix: `Add description: "..." to behavior ${name}`,
    });
  }

  // Check for missing input
  if (!behavior.input) {
    issues.push({
      id: `completeness-behavior-no-input-${name}`,
      severity: 'warning',
      title: `Behavior "${name}" has no input block`,
      description: 'Behaviors typically need input parameters.',
      location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
    });
  }

  // Check for missing output
  if (!behavior.output) {
    issues.push({
      id: `completeness-behavior-no-output-${name}`,
      severity: 'critical',
      title: `Behavior "${name}" has no output block`,
      description: 'Behaviors must define their output type.',
      location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
    });
  }

  // Check for missing preconditions/postconditions
  if (!behavior.preconditions && !behavior.postconditions) {
    issues.push({
      id: `completeness-behavior-no-conditions-${name}`,
      severity: 'warning',
      title: `Behavior "${name}" has no pre/postconditions`,
      description: 'Behaviors should define preconditions and/or postconditions for verification.',
      location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
    });
  }

  // Check for missing temporal requirements on state-changing behaviors
  if (isStateChangingBehavior(behavior) && !behavior.temporal) {
    issues.push({
      id: `completeness-behavior-no-temporal-${name}`,
      severity: 'info',
      title: `State-changing behavior "${name}" has no temporal requirements`,
      description: 'Consider adding response time or eventual consistency requirements.',
      location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
    });
  }

  return issues;
}

/**
 * Check if entity has a status/state field
 */
function hasStatusField(entity: { fields: Array<{ name: { name: string } }> }): boolean {
  return entity.fields.some(f => 
    f.name.name.toLowerCase().includes('status') || 
    f.name.name.toLowerCase().includes('state')
  );
}

/**
 * Collect all types used in the domain
 */
function collectUsedTypes(domain: DomainDeclaration): Set<string> {
  const used = new Set<string>();

  // From entities
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      collectTypesFromExpression(field.type, used);
    }
  }

  // From behaviors
  for (const behavior of domain.behaviors) {
    if (behavior.input?.fields) {
      for (const field of behavior.input.fields) {
        collectTypesFromExpression(field.type, used);
      }
    }
    if (behavior.output?.success) {
      collectTypesFromExpression(behavior.output.success, used);
    }
  }

  return used;
}

/**
 * Collect type names from type expression
 */
function collectTypesFromExpression(type: unknown, used: Set<string>): void {
  if (!type || typeof type !== 'object') return;

  const typeObj = type as Record<string, unknown>;

  if (typeObj.kind === 'SimpleType' && typeObj.name) {
    const nameObj = typeObj.name as { name?: string };
    if (nameObj.name) {
      used.add(nameObj.name);
    }
  }

  if (typeObj.kind === 'GenericType') {
    const nameObj = typeObj.name as { name?: string };
    if (nameObj?.name) {
      used.add(nameObj.name);
    }
    const typeArgs = typeObj.typeArguments as unknown[];
    if (Array.isArray(typeArgs)) {
      for (const arg of typeArgs) {
        collectTypesFromExpression(arg, used);
      }
    }
  }
}

/**
 * Check if behavior modifies state
 */
function isStateChangingBehavior(behavior: BehaviorDeclaration): boolean {
  const name = behavior.name.name.toLowerCase();
  return (
    name.startsWith('create') ||
    name.startsWith('update') ||
    name.startsWith('delete') ||
    name.startsWith('add') ||
    name.startsWith('remove') ||
    name.startsWith('set')
  );
}
