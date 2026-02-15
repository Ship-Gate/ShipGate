// ============================================================================
// ISL Semantic Linter
// Advanced semantic lint rules with quickfix suggestions
// ============================================================================

import type { Domain, Behavior, Entity, TypeDeclaration, Expression } from '@isl-lang/parser';
import type { ISLDiagnostic, SourceLocation } from '@isl-lang/lsp-core';
import { DiagnosticSeverity } from '@isl-lang/lsp-core';

// ============================================================================
// Types
// ============================================================================

export interface LintRule {
  id: string;
  name: string;
  description: string;
  severity: DiagnosticSeverity;
  category: 'correctness' | 'best-practice' | 'security' | 'performance' | 'style';
}

export interface LintResult {
  rule: LintRule;
  diagnostic: ISLDiagnostic;
}

export interface QuickfixData {
  type: string;
  [key: string]: unknown;
}

// ============================================================================
// Lint Rules Registry
// ============================================================================

export const LINT_RULES: Record<string, LintRule> = {
  // Correctness rules
  'ISL1001': {
    id: 'ISL1001',
    name: 'missing-postcondition',
    description: 'Behavior should have postconditions to verify outcomes',
    severity: DiagnosticSeverity.Warning,
    category: 'correctness',
  },
  'ISL1002': {
    id: 'ISL1002',
    name: 'precondition-without-error',
    description: 'Behavior has preconditions but no error cases defined',
    severity: DiagnosticSeverity.Hint,
    category: 'correctness',
  },
  'ISL1003': {
    id: 'ISL1003',
    name: 'unused-type',
    description: 'Type is defined but never used',
    severity: DiagnosticSeverity.Hint,
    category: 'style',
  },
  'ISL1004': {
    id: 'ISL1004',
    name: 'undefined-behavior-reference',
    description: 'Scenarios reference undefined behavior',
    severity: DiagnosticSeverity.Error,
    category: 'correctness',
  },
  'ISL1005': {
    id: 'ISL1005',
    name: 'duplicate-entity-name',
    description: 'Duplicate entity name - entities must have unique names',
    severity: DiagnosticSeverity.Error,
    category: 'correctness',
  },
  'ISL1006': {
    id: 'ISL1006',
    name: 'undefined-entity-reference',
    description: 'Behavior references entity not defined in domain',
    severity: DiagnosticSeverity.Error,
    category: 'correctness',
  },
  'ISL1007': {
    id: 'ISL1007',
    name: 'type-constraint-mismatch',
    description: 'Constraint not valid for field type (e.g. min on string without length context)',
    severity: DiagnosticSeverity.Warning,
    category: 'correctness',
  },

  // Best practice rules
  'ISL1010': {
    id: 'ISL1010',
    name: 'missing-description',
    description: 'Behavior should have a description',
    severity: DiagnosticSeverity.Hint,
    category: 'best-practice',
  },
  'ISL1011': {
    id: 'ISL1011',
    name: 'entity-without-id',
    description: 'Entity should have an id field for identification',
    severity: DiagnosticSeverity.Warning,
    category: 'best-practice',
  },
  'ISL1012': {
    id: 'ISL1012',
    name: 'mutable-behavior-no-temporal',
    description: 'State-modifying behavior should specify temporal constraints',
    severity: DiagnosticSeverity.Hint,
    category: 'best-practice',
  },
  'ISL1013': {
    id: 'ISL1013',
    name: 'no-scenarios',
    description: 'Behavior has no test scenarios defined',
    severity: DiagnosticSeverity.Hint,
    category: 'best-practice',
  },

  // Security rules
  'ISL1020': {
    id: 'ISL1020',
    name: 'sensitive-field-unprotected',
    description: 'Potentially sensitive field should have constraints',
    severity: DiagnosticSeverity.Warning,
    category: 'security',
  },
  'ISL1021': {
    id: 'ISL1021',
    name: 'no-authentication',
    description: 'State-modifying behavior has no security requirements',
    severity: DiagnosticSeverity.Hint,
    category: 'security',
  },

  // Performance rules
  'ISL1030': {
    id: 'ISL1030',
    name: 'unbounded-list',
    description: 'List type without size constraint may cause performance issues',
    severity: DiagnosticSeverity.Hint,
    category: 'performance',
  },
  'ISL1031': {
    id: 'ISL1031',
    name: 'missing-pagination',
    description: 'Behavior returning a list should consider pagination',
    severity: DiagnosticSeverity.Hint,
    category: 'performance',
  },
};

// ============================================================================
// Semantic Linter
// ============================================================================

export class ISLSemanticLinter {
  private enabledRules: Set<string> = new Set(Object.keys(LINT_RULES));

  /**
   * Enable/disable specific rules
   */
  configureRules(enabled: string[], disabled: string[]): void {
    for (const rule of enabled) {
      this.enabledRules.add(rule);
    }
    for (const rule of disabled) {
      this.enabledRules.delete(rule);
    }
  }

  /**
   * Lint a domain and return all diagnostics
   */
  lint(domain: Domain, filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];

    // Run all lint checks
    diagnostics.push(...this.lintDuplicateEntities(domain, filePath));
    diagnostics.push(...this.lintBehaviors(domain, filePath));
    diagnostics.push(...this.lintEntities(domain, filePath));
    diagnostics.push(...this.lintTypes(domain, filePath));
    diagnostics.push(...this.lintScenarios(domain, filePath));
    diagnostics.push(...this.lintSecurity(domain, filePath));

    // Filter by enabled rules
    return diagnostics.filter(d => this.enabledRules.has(d.code || ''));
  }

  private lintDuplicateEntities(domain: Domain, _filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];
    const seen = new Map<string, Entity>();

    for (const entity of domain.entities) {
      const name = entity.name.name;
      const existing = seen.get(name);
      if (existing) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1005']!,
          `Duplicate entity name '${name}' - entities must have unique names`,
          entity.name.location,
          {
            type: 'duplicate-entity-name',
            entityName: name,
            firstLocation: existing.name.location,
          },
        ));
      } else {
        seen.set(name, entity);
      }
    }

    return diagnostics;
  }

  // ============================================================================
  // Behavior Linting
  // ============================================================================

  private lintBehaviors(domain: Domain, _filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];
    const behaviorsWithScenarios = new Set<string>();

    // Collect behaviors that have scenarios
    for (const scenarioBlock of domain.scenarios) {
      behaviorsWithScenarios.add(scenarioBlock.behaviorName.name);
    }

    for (const behavior of domain.behaviors) {
      // ISL1001: Missing postcondition
      if (behavior.postconditions.length === 0) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1001']!,
          `Behavior '${behavior.name.name}' has no postconditions`,
          behavior.name.location,
          {
            type: 'missing-postcondition',
            behaviorName: behavior.name.name,
            behaviorLocation: behavior.location,
          },
        ));
      }

      // ISL1002: Precondition without error cases
      if (behavior.preconditions.length > 0 && behavior.output.errors.length === 0) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1002']!,
          `Behavior '${behavior.name.name}' has preconditions but no error cases defined`,
          behavior.name.location,
          {
            type: 'precondition-without-error',
            behaviorName: behavior.name.name,
            preconditionCount: behavior.preconditions.length,
          },
        ));
      }

      // ISL1010: Missing description
      if (!behavior.description) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1010']!,
          `Behavior '${behavior.name.name}' should have a description`,
          behavior.name.location,
          {
            type: 'missing-description',
            behaviorName: behavior.name.name,
          },
        ));
      }

      // ISL1012: State-modifying behavior without temporal constraints
      if (this.isStateMutating(behavior) && behavior.temporal.length === 0) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1012']!,
          `Behavior '${behavior.name.name}' modifies state but has no temporal constraints`,
          behavior.name.location,
          {
            type: 'mutable-behavior-no-temporal',
            behaviorName: behavior.name.name,
          },
        ));
      }

      // ISL1013: No scenarios
      if (!behaviorsWithScenarios.has(behavior.name.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1013']!,
          `Behavior '${behavior.name.name}' has no test scenarios defined`,
          behavior.name.location,
          {
            type: 'no-scenarios',
            behaviorName: behavior.name.name,
          },
        ));
      }

      // ISL1021: No security for state-modifying behaviors
      if (this.isStateMutating(behavior) && (!behavior.security || behavior.security.length === 0)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1021']!,
          `Behavior '${behavior.name.name}' modifies state but has no security requirements`,
          behavior.name.location,
          {
            type: 'no-authentication',
            behaviorName: behavior.name.name,
          },
        ));
      }

      // ISL1031: List return without pagination
      if (this.returnsList(behavior) && !this.hasPagination(behavior)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1031']!,
          `Behavior '${behavior.name.name}' returns a list - consider adding pagination`,
          behavior.output.location,
          {
            type: 'missing-pagination',
            behaviorName: behavior.name.name,
          },
        ));
      }
    }

    return diagnostics;
  }

  // ============================================================================
  // Entity Linting
  // ============================================================================

  private lintEntities(domain: Domain, _filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];

    for (const entity of domain.entities) {
      // ISL1011: Entity without id field
      const hasId = entity.fields.some(f =>
        f.name.name === 'id' ||
        f.name.name.toLowerCase().endsWith('id')
      );

      if (!hasId) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1011']!,
          `Entity '${entity.name.name}' should have an 'id' field for identification`,
          entity.name.location,
          {
            type: 'entity-without-id',
            entityName: entity.name.name,
            fields: entity.fields.map(f => f.name.name),
          },
        ));
      }

      // ISL1020: Sensitive field detection
      for (const field of entity.fields) {
        if (this.isSensitiveFieldName(field.name.name)) {
          const hasConstraints = this.fieldHasConstraints(field);
          if (!hasConstraints) {
            diagnostics.push(this.createDiagnostic(
              LINT_RULES['ISL1020']!,
              `Field '${field.name.name}' appears sensitive and should have constraints`,
              field.name.location,
              {
                type: 'sensitive-field-unprotected',
                fieldName: field.name.name,
                entityName: entity.name.name,
                suggestedConstraints: this.suggestConstraints(field.name.name),
              },
            ));
          }
        }
      }
    }

    return diagnostics;
  }

  // ============================================================================
  // Type Linting
  // ============================================================================

  private lintTypes(domain: Domain, _filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];
    const usedTypes = this.collectUsedTypes(domain);

    for (const type of domain.types) {
      // ISL1003: Unused type
      if (!usedTypes.has(type.name.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1003']!,
          `Type '${type.name.name}' is defined but never used`,
          type.name.location,
          {
            type: 'unused-type',
            typeName: type.name.name,
          },
        ));
      }

      // ISL1030: Unbounded list
      if (this.isUnboundedList(type)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1030']!,
          `Type '${type.name.name}' is an unbounded list - consider adding max_size constraint`,
          type.name.location,
          {
            type: 'unbounded-list',
            typeName: type.name.name,
          },
        ));
      }
    }

    return diagnostics;
  }

  // ============================================================================
  // Scenario Linting
  // ============================================================================

  private lintScenarios(domain: Domain, _filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];
    const behaviorNames = new Set(domain.behaviors.map(b => b.name.name));

    for (const scenarioBlock of domain.scenarios) {
      // ISL1004: Undefined behavior reference
      if (!behaviorNames.has(scenarioBlock.behaviorName.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1004']!,
          `Scenarios reference undefined behavior '${scenarioBlock.behaviorName.name}'`,
          scenarioBlock.behaviorName.location,
          {
            type: 'undefined-behavior-reference',
            behaviorName: scenarioBlock.behaviorName.name,
            availableBehaviors: Array.from(behaviorNames),
          },
        ));
      }
    }

    // Same for chaos scenarios
    for (const chaosBlock of domain.chaos) {
      if (!behaviorNames.has(chaosBlock.behaviorName.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES['ISL1004']!,
          `Chaos tests reference undefined behavior '${chaosBlock.behaviorName.name}'`,
          chaosBlock.behaviorName.location,
          {
            type: 'undefined-behavior-reference',
            behaviorName: chaosBlock.behaviorName.name,
            availableBehaviors: Array.from(behaviorNames),
          },
        ));
      }
    }

    return diagnostics;
  }

  // ============================================================================
  // Security Linting
  // ============================================================================

  private lintSecurity(domain: Domain, _filePath: string): ISLDiagnostic[] {
    // Security checks are included in behavior linting
    // This method can be extended for domain-level security analysis
    return [];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createDiagnostic(
    rule: LintRule,
    message: string,
    location: SourceLocation,
    data: QuickfixData,
    relatedInfo?: Array<{ message: string; location: SourceLocation }>
  ): ISLDiagnostic {
    return {
      message,
      severity: rule.severity,
      location,
      code: rule.id,
      source: 'isl-semantic-linter',
      data,
      relatedInfo,
    };
  }

  private isStateMutating(behavior: Behavior): boolean {
    // Check if behavior creates, updates, or deletes
    const name = behavior.name.name.toLowerCase();
    const mutatingPatterns = [
      'create', 'update', 'delete', 'remove', 'add', 'set',
      'modify', 'change', 'assign', 'reset', 'clear',
    ];

    return mutatingPatterns.some(p => name.includes(p));
  }

  private returnsList(behavior: Behavior): boolean {
    const output = behavior.output.success;
    return output.kind === 'ListType';
  }

  private hasPagination(behavior: Behavior): boolean {
    // Check if input has pagination-related fields
    const paginationFields = ['page', 'limit', 'offset', 'cursor', 'pagesize', 'pagenumber'];
    return behavior.input.fields.some(f =>
      paginationFields.includes(f.name.name.toLowerCase())
    );
  }

  private isSensitiveFieldName(name: string): boolean {
    const sensitivePatterns = [
      'password', 'secret', 'token', 'key', 'credential',
      'ssn', 'social_security', 'credit_card', 'cc_number',
      'api_key', 'auth', 'private',
    ];
    const lower = name.toLowerCase();
    return sensitivePatterns.some(p => lower.includes(p));
  }

  private fieldHasConstraints(field: { type: unknown }): boolean {
    const type = field.type as Record<string, unknown>;
    return type?.kind === 'ConstrainedType';
  }

  private suggestConstraints(fieldName: string): string[] {
    const lower = fieldName.toLowerCase();
    if (lower.includes('password')) {
      return ['min_length: 8', 'pattern: "^(?=.*[A-Za-z])(?=.*\\d).+"'];
    }
    if (lower.includes('email')) {
      return ['format: "email"'];
    }
    if (lower.includes('token') || lower.includes('key')) {
      return ['immutable: true'];
    }
    return ['encrypted: true'];
  }

  private collectUsedTypes(domain: Domain): Set<string> {
    const usedTypes = new Set<string>();

    const collectFromType = (typeDef: unknown) => {
      if (!typeDef || typeof typeDef !== 'object') return;
      const t = typeDef as Record<string, unknown>;

      if (t.kind === 'ReferenceType' && t.name && typeof t.name === 'object') {
        const name = t.name as { parts?: Array<{ name: string }> };
        if (name.parts && name.parts.length > 0 && name.parts[0]) {
          usedTypes.add(name.parts[0].name);
        }
      }

      // Recurse into container types
      if (t.element) collectFromType(t.element);
      if (t.key) collectFromType(t.key);
      if (t.value) collectFromType(t.value);
      if (t.inner) collectFromType(t.inner);
      if (t.base) collectFromType(t.base);
    };

    // Collect from entities
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        collectFromType(field.type);
      }
    }

    // Collect from behaviors
    for (const behavior of domain.behaviors) {
      for (const field of behavior.input.fields) {
        collectFromType(field.type);
      }
      collectFromType(behavior.output.success);
    }

    // Collect from types
    for (const type of domain.types) {
      if (type.definition.kind === 'StructType') {
        for (const field of type.definition.fields) {
          collectFromType(field.type);
        }
      } else if (type.definition.kind === 'ConstrainedType') {
        collectFromType(type.definition.base);
      }
    }

    return usedTypes;
  }

  private isUnboundedList(type: TypeDeclaration): boolean {
    const def = type.definition;
    if (def.kind !== 'ConstrainedType') return false;

    const base = def.base as unknown as Record<string, unknown>;
    if (base.kind !== 'ListType') return false;

    // Check if there's a max_size constraint
    const hasMaxSize = def.constraints.some(c =>
      c.name === 'max_size' || c.name === 'max_length'
    );

    return !hasMaxSize;
  }
}
