/**
 * Consistency Analyzer
 * 
 * Checks for internal consistency issues in the spec.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';

export interface ConsistencyIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: { line: number; column: number };
  relatedLocations?: Array<{ line: number; column: number; description: string }>;
  fix?: string;
}

export interface ConsistencyResult {
  score: number;
  issues: ConsistencyIssue[];
  suggestions: string[];
}

/**
 * Analyze domain for consistency issues
 */
export function analyzeConsistency(domain: DomainDeclaration): ConsistencyResult {
  const issues: ConsistencyIssue[] = [];
  const suggestions: string[] = [];

  // Build type registry
  const typeRegistry = buildTypeRegistry(domain);

  // Check type references
  issues.push(...checkTypeReferences(domain, typeRegistry));

  // Check entity references in behaviors
  issues.push(...checkEntityReferences(domain));

  // Check precondition/postcondition consistency
  issues.push(...checkConditionConsistency(domain));

  // Check error code uniqueness
  issues.push(...checkErrorCodeUniqueness(domain));

  // Check invariant consistency
  issues.push(...checkInvariantConsistency(domain));

  // Check lifecycle consistency
  issues.push(...checkLifecycleConsistency(domain));

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const maxScore = 100;
  const deductions = criticalCount * 25 + warningCount * 10 + infoCount * 3;
  const score = Math.max(0, maxScore - deductions);

  if (issues.length === 0) {
    suggestions.push('Spec has good internal consistency!');
  }

  return { score, issues, suggestions };
}

/**
 * Build registry of all defined types
 */
function buildTypeRegistry(domain: DomainDeclaration): Set<string> {
  const registry = new Set<string>();

  // Built-in types
  const builtins = [
    'String', 'Int', 'Boolean', 'UUID', 'Timestamp', 'Duration',
    'Decimal', 'Float', 'List', 'Map', 'Set', 'Optional',
  ];
  builtins.forEach(t => registry.add(t));

  // Custom types
  for (const type of domain.types) {
    registry.add(type.name.name);
  }

  // Entities
  for (const entity of domain.entities) {
    registry.add(entity.name.name);
  }

  // Enums
  for (const enumDecl of domain.enums) {
    registry.add(enumDecl.name.name);
  }

  return registry;
}

/**
 * Check all type references are valid
 */
function checkTypeReferences(domain: DomainDeclaration, typeRegistry: Set<string>): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check entity field types
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const undefinedTypes = findUndefinedTypes(field.type, typeRegistry);
      for (const typeName of undefinedTypes) {
        issues.push({
          id: `consistency-undefined-type-${entity.name.name}-${field.name.name}-${typeName}`,
          severity: 'critical',
          title: `Undefined type "${typeName}"`,
          description: `Field "${field.name.name}" in entity "${entity.name.name}" references undefined type "${typeName}".`,
          location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
          fix: `Define type "${typeName}" or use an existing type.`,
        });
      }
    }
  }

  // Check behavior input/output types
  for (const behavior of domain.behaviors) {
    if (behavior.input?.fields) {
      for (const field of behavior.input.fields) {
        const undefinedTypes = findUndefinedTypes(field.type, typeRegistry);
        for (const typeName of undefinedTypes) {
          issues.push({
            id: `consistency-undefined-type-${behavior.name.name}-input-${typeName}`,
            severity: 'critical',
            title: `Undefined type "${typeName}" in behavior input`,
            description: `Input field references undefined type "${typeName}" in behavior "${behavior.name.name}".`,
            location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Find undefined types in a type expression
 */
function findUndefinedTypes(type: unknown, registry: Set<string>): string[] {
  const undefined: string[] = [];

  if (!type || typeof type !== 'object') return undefined;

  const typeObj = type as Record<string, unknown>;

  if (typeObj.kind === 'SimpleType') {
    const nameObj = typeObj.name as { name?: string };
    if (nameObj?.name && !registry.has(nameObj.name)) {
      undefined.push(nameObj.name);
    }
  }

  if (typeObj.kind === 'GenericType') {
    const typeArgs = typeObj.typeArguments as unknown[];
    if (Array.isArray(typeArgs)) {
      for (const arg of typeArgs) {
        undefined.push(...findUndefinedTypes(arg, registry));
      }
    }
  }

  return undefined;
}

/**
 * Check entity references in behaviors
 */
function checkEntityReferences(domain: DomainDeclaration): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const entityNames = new Set(domain.entities.map(e => e.name.name));

  for (const behavior of domain.behaviors) {
    // Check preconditions for entity references
    if (behavior.preconditions?.conditions) {
      for (const condition of behavior.preconditions.conditions) {
        const refs = extractEntityReferences(condition);
        for (const ref of refs) {
          if (!entityNames.has(ref)) {
            issues.push({
              id: `consistency-undefined-entity-${behavior.name.name}-${ref}`,
              severity: 'critical',
              title: `Undefined entity "${ref}" in precondition`,
              description: `Behavior "${behavior.name.name}" references undefined entity "${ref}".`,
              location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Extract entity references from condition
 */
function extractEntityReferences(condition: unknown): string[] {
  const refs: string[] = [];
  
  // Simple pattern matching for Entity.exists(), Entity.lookup() etc.
  const str = JSON.stringify(condition);
  const pattern = /([A-Z][a-zA-Z0-9]*)\.(exists|lookup|create|update|delete)/g;
  let match;
  
  while ((match = pattern.exec(str)) !== null) {
    if (match[1]) {
      refs.push(match[1]);
    }
  }
  
  return refs;
}

/**
 * Check precondition/postcondition consistency
 */
function checkConditionConsistency(domain: DomainDeclaration): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const behavior of domain.behaviors) {
    // Check that postconditions reference fields defined in output
    if (behavior.postconditions?.conditions && behavior.output) {
      // Simplified check - in real implementation would parse expressions
    }

    // Check that preconditions reference fields defined in input
    if (behavior.preconditions?.conditions && behavior.input) {
      // Simplified check
    }
  }

  return issues;
}

/**
 * Check error code uniqueness within behavior
 */
function checkErrorCodeUniqueness(domain: DomainDeclaration): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.output?.errors) {
      const errorCodes = new Map<string, number>();
      
      for (const error of behavior.output.errors) {
        const code = error.name.name;
        const count = (errorCodes.get(code) ?? 0) + 1;
        errorCodes.set(code, count);
        
        if (count > 1) {
          issues.push({
            id: `consistency-duplicate-error-${behavior.name.name}-${code}`,
            severity: 'warning',
            title: `Duplicate error code "${code}"`,
            description: `Behavior "${behavior.name.name}" defines error code "${code}" multiple times.`,
            location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
            fix: `Remove duplicate error code or use distinct codes.`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check invariant consistency
 */
function checkInvariantConsistency(domain: DomainDeclaration): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check for contradictory invariants (simplified)
  for (const invariantBlock of domain.invariants) {
    // Would need expression analysis to detect contradictions
    // For now, just check that invariant names are unique
    const names = new Set<string>();
    
    if (names.has(invariantBlock.name.name)) {
      issues.push({
        id: `consistency-duplicate-invariant-${invariantBlock.name.name}`,
        severity: 'warning',
        title: `Duplicate invariant block name "${invariantBlock.name.name}"`,
        description: 'Invariant block names should be unique within a domain.',
        location: invariantBlock.span ? { line: invariantBlock.span.start.line, column: invariantBlock.span.start.column } : undefined,
      });
    }
    names.add(invariantBlock.name.name);
  }

  return issues;
}

/**
 * Check lifecycle consistency
 */
function checkLifecycleConsistency(domain: DomainDeclaration): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const entity of domain.entities) {
    if (!entity.lifecycle) continue;

    // Collect all states from transitions
    const states = new Set<string>();
    const transitions = entity.lifecycle.transitions;

    for (const transition of transitions) {
      for (const state of transition.states) {
        states.add(state.name);
      }
    }

    // Check for unreachable states (states that can't be transitioned to)
    const targetStates = new Set<string>();
    const sourceStates = new Set<string>();

    for (const transition of transitions) {
      if (transition.states.length >= 2) {
        const firstState = transition.states[0];
        if (firstState) {
          sourceStates.add(firstState.name);
        }
        for (let i = 1; i < transition.states.length; i++) {
          const state = transition.states[i];
          if (state) {
            targetStates.add(state.name);
          }
        }
      }
    }

    // Find states that are targets but never sources (terminal states - ok)
    // Find states that are sources but never targets (initial states - should have only one)
    const initialStates = [...sourceStates].filter(s => !targetStates.has(s));
    
    if (initialStates.length > 1) {
      issues.push({
        id: `consistency-multiple-initial-states-${entity.name.name}`,
        severity: 'warning',
        title: `Entity "${entity.name.name}" has multiple initial states`,
        description: `States ${initialStates.join(', ')} appear to be initial states. Consider having a single initial state.`,
        location: entity.span ? { line: entity.span.start.line, column: entity.span.start.column } : undefined,
      });
    }
  }

  return issues;
}
